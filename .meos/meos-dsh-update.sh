#!/usr/bin/env bash
# meos-dsh-update.sh — keep the DSH core and the live `meos` profile's
# version-pinned adapter plugins on the same published version, then let the
# caller boot the web host.
#
# Called by meos-dsh() in ~/.bashrc AND by `meos launch` (both the framework
# checkout and each installed .meos/runtime.py), before the host boots. It
# deliberately refuses to run while a host is listening: the running host holds
# the old module graph and dsh-hmr watches the profile files, so mutating the
# profile under it is the exact failure mode that killed the tool gateway on
# 2026-10-21.
#
# Operator policy (2026-10-21): always track npm's `latest` dist-tag, but never
# boot a composition that fails `dsh --dump-config`; roll core + tracked plugins
# back to the previous version on failure. Every action is appended to
# $DSH_HOME/update.log.
#
# Tests and other non-interactive callers set MEOS_DSH_NO_UPDATE=1 to make the
# script inert; it also exits quietly when the `meos` profile is not installed.
#
# Usage:
#   meos-dsh-update.sh          # check + update + validate (no boot)
#   meos-dsh-update.sh --check  # print current/latest and exit
#   meos-dsh-update.sh --now    # skip the live-host guard

set -euo pipefail

DSH_HOME="${DSH_HOME:-$HOME/.local/state/meos/dsh}"
PROFILE="${DSH_PROFILE:-meos}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PORT="${MEOS_DSH_PORT:-3080}"
LOG="$DSH_HOME/update.log"
CORE="@deepseek-ai/dsh"

# Plugins the live profile pins to an exact core version (peerDependencies are
# exact, so they must move with the core or profile startup rejects them).
TRACKED=(
  "@deepseek-ai/dsh-hooks-claude-code"
  "@deepseek-ai/dsh-subagent-acp"
  "@deepseek-ai/dsh-subagent-codex"
)

MODE="${1:-update}"
NO_UPDATE="${MEOS_DSH_NO_UPDATE:-0}"

mkdir -p "$(dirname "$LOG")"
log() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG" >&2; }

installed_plugin() {
  python3 - "$PROFILE_DIR/package.json" "$1" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print(""); raise SystemExit
print(d.get("dependencies", {}).get(sys.argv[2], ""))
PY
}

core_version() { command dsh --version 2>/dev/null | tail -1 | tr -d '[:space:]'; }
latest_version() { npm view "$CORE" dist-tags.latest 2>/dev/null | tr -d '"[:space:]'; }
profile_installed() { [ -f "$PROFILE_DIR/package.json" ]; }

current="$(core_version)"

if [ "$MODE" = "--check" ]; then
  latest="$(latest_version)"
  printf 'core:    %s\nlatest:  %s\n' "$current" "${latest:-<unresolved>}"
  if ! profile_installed; then
    printf 'profile: %s (not installed at %s)\n' "$PROFILE" "$PROFILE_DIR"
    exit 0
  fi
  stale=0
  [ -n "$latest" ] && [ "$current" = "$latest" ] || stale=1
  for p in "${TRACKED[@]}"; do
    printf '%-8s %s\n' "${p##*/}" "$(installed_plugin "$p")"
    [ "$(installed_plugin "$p")" = "$latest" ] || stale=1
  done
  if [ "$stale" -eq 0 ]; then printf 'state:   in sync\n'; else printf 'state:   STALE\n'; fi
  exit 0
fi

# Tests, CI and non-interactive callers opt out entirely.
[ "$NO_UPDATE" = "1" ] && exit 0

if ! profile_installed; then
  log "profile $PROFILE is not installed at $PROFILE_DIR; nothing to sync"
  exit 0
fi

for tool in npm dsh; do
  command -v "$tool" >/dev/null 2>&1 || { log "$tool is not on PATH; booting unchanged"; exit 0; }
done

latest="$(latest_version)"
[ -n "$latest" ] || { log "cannot resolve $CORE latest; booting unchanged"; exit 0; }

if [ "$MODE" != "--now" ] && curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/"; then
  log "dsh web already listening on $PORT; skipping update"
  exit 0
fi

stale=0
[ "$current" = "$latest" ] || stale=1
for p in "${TRACKED[@]}"; do
  [ "$(installed_plugin "$p")" = "$latest" ] || stale=1
done

if [ "$stale" -eq 0 ]; then
  log "dsh $current is current"
  exit 0
fi

log "updating: dsh ${current:-<unknown>} -> $latest (profile $PROFILE)"
# Roll back to the core version this profile was booting before the update.
# That is the known-good composition; the plugins moved with it.
prev="$current"
[ -n "$prev" ] || prev="$(installed_plugin "${TRACKED[0]}")"

# --- core ---------------------------------------------------------------
if [ "$current" != "$latest" ]; then
  npm install -g "$CORE@$latest" >>"$LOG" 2>&1 || {
    log "core install failed; booting the installed version unchanged"
    exit 0
  }
fi
new="$(core_version)"

# --- profile adapters ---------------------------------------------------
cp -p "$PROFILE_DIR/package.json" "$PROFILE_DIR/package.json.pre-update" 2>/dev/null || true
(
  cd "$PROFILE_DIR"
  for p in "${TRACKED[@]}"; do
    if npm view "$p@$latest" version >/dev/null 2>&1; then
      command dsh plugin --profile "$PROFILE" add "$p@$latest" >>"$LOG" 2>&1 \
        || log "WARN: $p@$latest install failed"
    else
      log "WARN: $p@$latest is not published; leaving $(installed_plugin "$p")"
    fi
  done
)

# dsh plugin add may append an already-enabled bundle to the end of
# dsh.profile.bundles, changing layer precedence. Restore the previous order
# when the set is unchanged.
python3 - "$PROFILE_DIR/package.json.pre-update" "$PROFILE_DIR/package.json" <<'PY'
import json, sys
try:
    old = json.load(open(sys.argv[1]))
    new = json.load(open(sys.argv[2]))
except Exception:
    raise SystemExit
old_b = (old.get("dsh", {}).get("profile", {}) or {}).get("bundles", [])
new_b = (new.get("dsh", {}).get("profile", {}) or {}).get("bundles", [])
if old_b and new_b and set(old_b) == set(new_b) and old_b != new_b:
    new["dsh"]["profile"]["bundles"] = old_b
    with open(sys.argv[2], "w") as f:
        json.dump(new, f, indent=2)
        f.write("\n")
    print("restored bundle order", file=sys.stderr)
PY

# --- assert the plugins actually moved with the core -------------------
# A plugin whose exact version is missing from npm (or whose install failed)
# otherwise leaves a mixed core/plugin set that dump-config still accepts:
# dsh then skips that plugin's bundle at startup and boots a composition the
# operator believes is current. Treat any skew as a failed update.
skew=""
[ -n "$new" ] || skew=" core-version-unreadable"
for p in "${TRACKED[@]}"; do
  v="$(installed_plugin "$p")"
  [ "$v" = "$new" ] || skew="${skew} ${p##*/}=${v:-missing}"
done
[ -z "$skew" ] || log "version skew after install (expected ${new:-$latest}):${skew}"

# --- validate composition before the caller boots ----------------------
if [ -n "$skew" ] || ! command dsh --profile "$PROFILE" --dump-config >/dev/null 2>>"$LOG"; then
  log "composition failed to validate on ${new:-$latest}; rolling back to ${prev:-unknown}"
  if [ -n "$prev" ]; then
    npm install -g "$CORE@$prev" >>"$LOG" 2>&1 || log "rollback core install failed"
    (
      cd "$PROFILE_DIR"
      for p in "${TRACKED[@]}"; do
        command dsh plugin --profile "$PROFILE" add "$p@$prev" >>"$LOG" 2>&1 || true
      done
    )
  fi
  exit 0
fi

log "updated to ${new:-$latest}; composition validates"
exit 0
