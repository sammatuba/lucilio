#!/usr/bin/env python3
"""Select a project runtime and resume work from files, independently of login state.

Invoked by meos.sh runtime or the installed repo-local ./meos command.
No authentication mutation.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import uuid


MODES = ("codex", "dsh", "claude")
# The updater ships beside the runtime in both the framework (scripts/) and an
# installed project (.meos/), so `dsh` launches can move the profile's pins with
# the globally installed core instead of relying on the operator to remember.
DSH_UPDATE_HOOK = "meos-dsh-update.sh"
# Portable entrypoints are embedded so a copied runtime can reinstall them
# without a framework checkout. Domain routes and checks remain project-owned.
SKILL_STEPS = {
    "strategy": ("Explore a MEOS project decision, challenge assumptions and record the chosen direction.",
                 "Use the project's strategy route or skill when present. Record the decision, material "
                 "unknowns and what would change it in the relevant work record. Continue to intent "
                 "when implementation is requested and the outcome is clear."),
    "intent": ("Turn a MEOS project request into a bounded implementation intent with observable checks.",
               "Use the project's intent route or skill when present. Capture the outcome, scope, "
               "constraints, failure behavior and acceptance checks in its work packet. Scale the "
               "record to the task; a small fix needs only a brief intent. Continue authorized implementation."),
    "implement": ("Build or fix code in a MEOS project against its intent, then execute its verification checks.",
                  "Use the project's implementation route or skill when present. Read the relevant "
                  "intent and boundaries, implement the bounded change, run the project's relevant "
                  "checks and review the diff. Request an independent review with `./meos review` "
                  "(a GPT reviewer through Codex, read-only) before claiming completion. Record executed "
                  "evidence and material unresolved findings. Preserve unrelated edits; a review by the "
                  "author is self-review and is labelled so."),
    "review": ("Review a change independently against its intent, boundaries and executed verification, with evidenced findings and one verdict.",
               "Use the project's designated independent reviewer when it names one; otherwise run "
               "`./meos review` (a GPT reviewer through Codex, read-only). Load the intent, the actual "
               "diff including staged, unstaged and relevant untracked files, the affected contracts and "
               "the implementation evidence. Check that observed behavior meets the acceptance criteria, "
               "that the project's invariants and authorization boundaries hold, that failures or "
               "adversarial inputs cannot produce an unsupported result, that tests exercise behavior "
               "and reported results match evidence, and that docs and work records agree with the code. "
               "State each finding as severity | path:line | failure mechanism | evidence | correction, "
               "then one verdict: accept, rework or escalate. A review by the author is self-review and "
               "is labelled so. Record dispositions in the work packet; never post, approve, commit or "
               "push as a side effect of reviewing."),
    "wrapup": ("Wrap up a MEOS project session with verification evidence, unfinished work and an exact handoff.",
               "Use the project's wrapup procedure when present. Run the required project checks "
               "for changed code, run `./meos review` for material changes, and record outcome, actual "
               "results, review verdict, unresolved findings and the exact next action in its work "
               "packet. The live docs/work/current.json wins over an old checkpoint. Optionally persist "
               "recovery using ./meos handoff --to codex|claude "
               "--note 'Outcome and unfinished work' --next-action 'Exact next step' "
               "--verification 'Checks actually run'. Keep credentials out of handoffs. "
               "Suggest a commit when useful; do not commit or publish solely because wrapup was invoked."),
}


def skill_payload() -> dict[str, bytes]:
    result = {}
    for phase, (description, steps) in SKILL_STEPS.items():
        name = f"meos-{phase}"
        text = (f"---\nname: {name}\ndescription: {description}\n---\n\n"
                f"# MEOS {phase.title()}\n\n"
                "From the Git root, run `bash ./meos start` if this session has not started MEOS "
                "(Claude Code runs it from the installed SessionStart hook; Codex runs it at the first "
                "task), then read `.meos/lifecycle.md` and the project's AGENTS.md. Follow its domain "
                "routes, skills and verification commands.\n\n"
                f"{steps}\n\n"
                "Explicit user tasks and existing authorization take precedence. A phase change "
                "does not authorize external actions. This portable binding does not install "
                "the full framework's hooks or gates.\n")
        # Codex discovers .agents/skills; Claude Code discovers .claude/skills only
        # (verified against claude 2.1.301, 2026-10-16). Copies, not symlinks: the
        # runtime refuses symlinked project paths.
        result[f".agents/skills/{name}/SKILL.md"] = text.encode()
        result[f".claude/skills/{name}/SKILL.md"] = text.encode()
    return result


SKILL_DIRECTORIES = [".agents", ".agents/skills",
                     *[f".agents/skills/meos-{phase}" for phase in SKILL_STEPS]]
# The 2026-10-04 payload shipped four skills; its ignore block is accepted on reinstall.
PREVIOUS_SKILL_DIRECTORIES = [d for d in SKILL_DIRECTORIES if d != ".agents/skills/meos-review"]


def skill_ignore_block(ignored: list[str], directories: list[str] | None = None) -> str:
    directories = SKILL_DIRECTORIES if directories is None else directories
    if (not isinstance(ignored, list) or any(p not in directories for p in ignored)
            or len(set(ignored)) != len(ignored)):
        raise ValueError("Invalid installed skill ignore policy")
    lines = ["# MEOS-SKILLS:START", "# Track portable Codex skill entrypoints."]
    for directory in directories:
        lines.append(f"!/{directory}/")
        if directory in ignored:
            lines.append(f"/{directory}/*")
        if directory.startswith(".agents/skills/meos-"):
            lines.append(f"!/{directory}/SKILL.md")
    lines.append("# MEOS-SKILLS:END")
    return "\n".join(lines)


def ignored_paths(repo: Path, ignore_text: str, paths: list[str]) -> list[str]:
    """Evaluate a proposed policy with Git, without changing the target worktree."""
    git_dir = git(repo, "rev-parse", "--absolute-git-dir")
    # core.excludesFile may be relative to the caller's worktree. Keep it
    # pointed at the operator's file when evaluating in a disposable tree.
    config = subprocess.run(["git", "-C", str(repo), "config", "--path", "--get", "core.excludesFile"],
                            capture_output=True, text=True)
    if config.returncode not in (0, 1):
        raise ValueError(f"Git ignore configuration failed: {config.stderr.strip()}")
    options = []
    if config.returncode == 0 and config.stdout.strip():
        excludes = Path(config.stdout.strip()).expanduser()
        if not excludes.is_absolute():
            excludes = repo / excludes
        options = ["-c", f"core.excludesFile={excludes}"]
    ignored = []
    with tempfile.TemporaryDirectory(prefix="meos-ignore-") as temporary:
        tree = Path(temporary)
        (tree / ".gitignore").write_text(ignore_text, encoding="utf-8")
        for directory in [".meos", *SKILL_DIRECTORIES]:
            (tree / directory).mkdir(parents=True, exist_ok=True)
            original = member(repo, directory + "/.gitignore")
            if original.exists():
                (tree / directory / ".gitignore").write_bytes(original.read_bytes())
        for relative in paths:
            result = subprocess.run(["git", "-C", str(tree), *options, "--git-dir", git_dir,
                                     "--work-tree", str(tree), "check-ignore", "--no-index",
                                     "--quiet", relative], capture_output=True, text=True,
                                    env=dict(os.environ, GIT_OPTIONAL_LOCKS="0"))
            if result.returncode == 0:
                ignored.append(relative)
            elif result.returncode != 1:
                raise ValueError(f"Git ignore preflight failed: {result.stderr.strip()}")
    return ignored


def skill_ignore_policy(repo: Path, marker: dict | None, ignore_text: str) -> tuple[list[str], str, tuple[str, ...]]:
    """Refresh from operator rules, retaining the old block as the ownership baseline."""
    recorded = (marker or {}).get("skills_ignored_directories", [])
    old_block = skill_ignore_block(recorded)
    four_skill_block = skill_ignore_block([d for d in recorded if d in PREVIOUS_SKILL_DIRECTORIES],
                                          PREVIOUS_SKILL_DIRECTORIES)
    legacy_block = four_skill_block.replace("/.agents", ".agents")
    start, end = "# MEOS-SKILLS:START", "# MEOS-SKILLS:END"
    validated = managed_text(ignore_text, old_block, start, end, (four_skill_block, legacy_block))
    first, last = validated.index(start), validated.index(end) + len(end)
    baseline = validated[:first] + validated[last:]
    ignored = [p.rstrip("/") for p in ignored_paths(repo, baseline,
                                                    [p + "/" for p in SKILL_DIRECTORIES])]
    return ignored, skill_ignore_block(ignored), (old_block, four_skill_block, legacy_block)
AGENTS_START = "<!-- MEOS-REPO:START -->"
AGENTS_END = "<!-- MEOS-REPO:END -->"
# The AGENTS block is runtime-neutral: the saved runtime mode decides which
# command `./meos start` uses, so the block must not name Codex. Consuming repos
# budget their bootstrap words (Builder Cup: AGENTS.md + docs/status.md <= 1400);
# the review verb stays in the lifecycle and the skills. The older Codex-specific
# wording and the interim review line are accepted on reinstall and rewritten.
AGENTS_BLOCK = f"""{AGENTS_START}
## MEOS installed

This is a MEOS repository; `.meos/repo.json` is its indicator.
At the first task in each session, run `bash ./meos start`
from the Git root (including when launched in a subdirectory), then read
[MEOS lifecycle](.meos/lifecycle.md). Follow the project's own routes and skills.
{AGENTS_END}"""
AGENTS_BLOCK_PREVIOUS = AGENTS_BLOCK.replace(
    "At the first task in each session, run `bash ./meos start`",
    "At the first task in each Codex session, run `bash ./meos start --runtime codex`")
AGENTS_BLOCK_INTERIM = AGENTS_BLOCK.replace(
    AGENTS_END, "Independent review: `./meos review` (GPT reviewer through Codex, read-only).\n" + AGENTS_END)
CLAUDE_BLOCK = f"""{AGENTS_START}
## MEOS installed

This is a MEOS repository; `.meos/repo.json` is its indicator. The project
SessionStart hook in `.claude/settings.json` runs `bash ./meos start --runtime claude`
and prints the `[MEOS]` brief; if it did not run, run that command yourself from the
Git root. Then read [MEOS lifecycle](.meos/lifecycle.md) and follow the project's own
routes and skills (`.claude/skills/meos-*`). Independent review: `./meos review`
(GPT reviewer through Codex, read-only; never the author).
{AGENTS_END}"""
HOOK_COMMAND = 'bash "$CLAUDE_PROJECT_DIR/meos" start --runtime claude'
HOOK_ENTRY = {"matcher": "startup|resume|clear",
              "hooks": [{"type": "command", "command": HOOK_COMMAND, "timeout": 20}]}
IGNORE_START = "# MEOS-REPO:START"
IGNORE_END = "# MEOS-REPO:END"
LEGACY_IGNORE_BLOCK = f"""{IGNORE_START}
# Track the installed contract/runtime; keep session state local.
!.meos/
.meos/*
!.meos/repo.json
!.meos/runtime.py
!.meos/lifecycle.md
!.meos/meos-dsh-update.sh
{IGNORE_END}"""
PREVIOUS_IGNORE_BLOCK = LEGACY_IGNORE_BLOCK.replace("!.meos/", "!/.meos/").replace("\n.meos/*", "\n/.meos/*")
IGNORE_BLOCK = PREVIOUS_IGNORE_BLOCK.replace(IGNORE_END, "!/meos\n" + IGNORE_END)
LOCAL_COMMAND = '''#!/usr/bin/env bash
# MEOS repo-local entrypoint. Works from any current directory.
set -euo pipefail
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd -- "$repo_root"
exec python3 "$repo_root/.meos/runtime.py" "$@"
'''


def digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def repo_project(root: Path) -> tuple[Path, dict, Path]:
    """Explicit installed identity; never infer opt-in from a parent repository."""
    marker = read_object(member(root, ".meos/repo.json"))
    if (marker.get("$schema") != "meos-repo.v1" or marker.get("version") != 1
            or not isinstance(marker.get("id"), str) or not marker["id"]):
        raise ValueError("Invalid repo-local MEOS identity/schema")
    if Path(git(root, "rev-parse", "--show-toplevel")).resolve() != root:
        raise ValueError("Installed MEOS identity must be at its Git root")
    runtime = marker.get("runtime")
    if not isinstance(runtime, dict) or runtime.get("mode") not in MODES:
        raise ValueError("repo runtime.mode must be codex or dsh")
    if "repo_id" in marker and (not isinstance(marker["repo_id"], str) or not marker["repo_id"]):
        raise ValueError("Invalid portable repository identity")
    data = {"$schema": "meos-project.v1", "id": marker["id"],
            "repos": [{"path": ".", "role": "primary"}],
            "scope": {"mode": "estate-read"}, "runtime": {"mode": runtime["mode"], "repo": "."},
            "repo_installation": marker}
    return root, data, root


def read_object(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def member(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError(f"Expected a project-relative path: {value!r}")
    relative = Path(value)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Path leaves the project: {value}")
    path = root
    for index, part in enumerate(relative.parts):
        path = path / part
        if path.is_symlink():
            raise ValueError(f"Symlinked project path is not allowed: {value}")
        if index < len(relative.parts) - 1 and path.exists() and not path.is_dir():
            raise ValueError(f"Non-directory project path component: {value}")
    if not path.resolve().is_relative_to(root):
        raise ValueError(f"Path leaves the project: {value}")
    return path


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True,
                            env=dict(os.environ, GIT_OPTIONAL_LOCKS="0"))
    if result.returncode:
        raise ValueError(f"Git failed in {repo}: {result.stderr.strip()}")
    return result.stdout.strip()


def head(repo: Path) -> str:
    try:
        return git(repo, "rev-parse", "--verify", "HEAD")
    except ValueError:
        reference = git(repo, "symbolic-ref", "--quiet", "HEAD")
        if reference not in git(repo, "for-each-ref", "--format=%(refname)", reference).splitlines():
            return "UNBORN"
        raise


def install_target(path: str, identity: str | None, mode: str | None) -> tuple[Path, dict, Path]:
    if not path.strip():
        raise ValueError("Installation target must be a nonempty path")
    target = Path(path).expanduser().absolute()
    for component in (target, *target.parents):
        if component.is_symlink():
            raise ValueError(f"Symlinked installation target is not allowed: {component}")
    root = target.resolve(strict=True)
    if not root.is_dir() or Path(git(root, "rev-parse", "--show-toplevel")).resolve() != root:
        raise ValueError("Installation target must be an existing Git repository root")
    marker = member(root, ".meos/repo.json")
    if marker.exists():
        _, data, _ = repo_project(root)
        if identity is not None and identity != data["id"]:
            raise ValueError("--id conflicts with the installed repository identity")
    else:
        selected_id = identity if identity is not None else root.name
        if not selected_id.strip():
            raise ValueError("--id must be nonempty")
        data = {"id": selected_id, "runtime": {"mode": mode or "codex"}}
    return root, data, root


def project(path: str, prefer_repo: bool = False) -> tuple[Path, dict, Path]:
    root = Path(path).expanduser().resolve(strict=True)
    manifest = member(root, ".meos/project.json")
    if member(root, ".meos/repo.json").is_file() and (prefer_repo or not manifest.is_file()):
        return repo_project(root)
    if not manifest.is_file():
        # Plain Codex may start below the Git root. Only that root's explicit
        # marker may opt it in; never walk into a sibling/parent project.
        git_root = Path(git(root, "rev-parse", "--show-toplevel")).resolve()
        if member(git_root, ".meos/repo.json").is_file():
            return repo_project(git_root)
        raise ValueError(f"Missing {manifest}; declare this project before selecting a runtime")
    data = read_object(manifest)
    if data.get("$schema") != "meos-project.v1" or not isinstance(data.get("id"), str) or not data["id"]:
        raise ValueError(f"Invalid project identity/schema: {manifest}")
    estate = read_object(root.parent / "estate.json")
    bindings = estate.get("projects", {})
    if not isinstance(bindings, dict):
        raise ValueError("Estate projects must be an object")
    binding = bindings.get(data["id"], {})
    if not isinstance(binding, dict) or not binding.get("path") or member(root.parent, binding["path"]) != root:
        raise ValueError(f"Project {data['id']} is not registered in {root.parent / 'estate.json'}")
    repos = data.get("repos")
    if not isinstance(repos, list) or not repos:
        raise ValueError("Project needs a nonempty repos list")
    seen = set()
    for entry in repos:
        if not isinstance(entry, dict):
            raise ValueError("Each repo must be an object")
        repo = member(root, entry.get("path", ""))
        if repo in seen or not repo.is_dir() or not (repo / ".git").exists():
            raise ValueError(f"Missing or duplicate repository: {repo}")
        if Path(git(repo, "rev-parse", "--show-toplevel")).resolve() != repo:
            raise ValueError(f"Repo member is not its Git root: {repo}")
        seen.add(repo)
    scope = data.get("scope", {})
    if not isinstance(scope, dict) or scope.get("mode") != "estate-read":
        raise ValueError("This interim runtime supports scope.mode=estate-read only")
    runtime = data.get("runtime", {})
    if not isinstance(runtime, dict) or runtime.get("mode", "dsh") not in MODES:
        raise ValueError("runtime.mode must be codex or dsh")
    default = next((r["path"] for r in repos if r.get("role") == "primary"), repos[0]["path"])
    selected = runtime.get("repo", default)
    if selected not in [r["path"] for r in repos]:
        raise ValueError("runtime.repo must be a declared repo member")
    return root, data, member(root, selected)


def atomic_json(path: Path, data: dict) -> None:
    # Resolve/check every component before creating state or replacing a file.
    if path.is_symlink():
        raise ValueError(f"Refusing to replace a symlink: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".runtime-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def managed_text(text: str, block: str, start: str, end: str,
                 previous_blocks: tuple[str, ...] = ()) -> str:
    if start not in text and end not in text:
        return text + ("\n" if text.endswith("\n") or not text else "\n\n") + block + "\n"
    if text.count(start) != 1 or text.count(end) != 1 or text.index(start) >= text.index(end):
        raise ValueError(f"Malformed managed section: {start}")
    first, last = text.index(start), text.index(end) + len(end)
    if text[first:last] not in (block, *previous_blocks):
        raise ValueError(f"Managed section has local edits: {start}")
    return text[:first] + block + text[last:]


def claude_settings(repo: Path, recorded: dict) -> tuple[str | None, bool]:
    """Project SessionStart hook: create and own when absent, merge one entry otherwise."""
    path = member(repo, ".claude/settings.json")
    if not path.exists():
        return json.dumps({"hooks": {"SessionStart": [HOOK_ENTRY]}}, indent=2) + "\n", True
    if not path.is_file():
        raise ValueError("Refusing to replace a non-file .claude/settings.json")
    raw = path.read_bytes()
    owned = recorded.get(".claude/settings.json") == digest(raw)
    try:
        current = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"Invalid JSON in .claude/settings.json; fix it before installing: {error}")
    if not isinstance(current, dict):
        raise ValueError("Expected a JSON object in .claude/settings.json")
    hooks = current.setdefault("hooks", {})
    if not isinstance(hooks, dict) or not isinstance(hooks.setdefault("SessionStart", []), list):
        raise ValueError("hooks.SessionStart in .claude/settings.json must be a list")
    if any(isinstance(entry, dict) and any(isinstance(h, dict) and h.get("command") == HOOK_COMMAND
                                           for h in entry.get("hooks", []))
           for entry in hooks["SessionStart"]):
        return (raw.decode("utf-8-sig") if owned else None), owned
    hooks["SessionStart"].append(HOOK_ENTRY)
    return json.dumps(current, indent=2, ensure_ascii=False) + "\n", owned


def install(root: Path, data: dict, repo: Path, dry_run: bool, mode: str | None = None) -> None:
    """Portable native binding, preserving operator files with rollback on error."""
    if member(repo, "AGENTS.override.md").exists():
        raise ValueError("AGENTS.override.md shadows AGENTS.md; integrate the MEOS startup there explicitly first")
    agents = member(repo, "AGENTS.md")
    existing_agents = agents.read_text(encoding="utf-8") if agents.exists() else ""
    if "MEOS-GENERATED" in existing_agents:
        raise ValueError("Generated AGENTS.md is generator-owned; use the full Codex adapter installation")
    marker_path = member(repo, ".meos/repo.json")
    old_marker = read_object(marker_path) if marker_path.exists() else None
    if old_marker is not None:
        repo_project(repo)
        if old_marker.get("id") != data["id"]:
            raise ValueError("Repository is installed for another MEOS project")
    source = Path(__file__).resolve()
    lifecycle = (source.parent / "lifecycle.md" if source.parent.name == ".meos"
                 else source.parent.parent / "adapters/codex/repo-lifecycle.md")
    payload = {".meos/runtime.py": source.read_bytes(), ".meos/lifecycle.md": lifecycle.read_bytes(),
               "meos": LOCAL_COMMAND.encode()}
    updater = source.parent / DSH_UPDATE_HOOK
    if updater.is_file():
        payload[f".meos/{DSH_UPDATE_HOOK}"] = updater.read_bytes()
    payload.update(skill_payload())
    recorded = old_marker.get("files", {}) if old_marker else {}
    if not isinstance(recorded, dict):
        raise ValueError("Invalid installed-file ledger")
    for relative in payload:
        target = member(repo, relative)
        if target.exists() and (not target.is_file() or digest(target.read_bytes()) != recorded.get(relative)):
            raise ValueError(f"Refusing to overwrite unowned or locally edited file: {relative}")
    settings_text, settings_owned = claude_settings(repo, recorded)
    instructions = member(repo, "CLAUDE.md")
    ignore = member(repo, ".gitignore")
    ignore_text = ignore.read_text(encoding="utf-8") if ignore.exists() else ""
    ignored_skill_directories, skills_ignore_block, previous_skill_blocks = skill_ignore_policy(repo, old_marker, ignore_text)
    payload["AGENTS.md"] = managed_text(existing_agents, AGENTS_BLOCK, AGENTS_START, AGENTS_END,
                                        (AGENTS_BLOCK_INTERIM, AGENTS_BLOCK_PREVIOUS)).encode()
    ignore_text = managed_text(ignore_text, IGNORE_BLOCK, IGNORE_START, IGNORE_END,
                               (LEGACY_IGNORE_BLOCK, PREVIOUS_IGNORE_BLOCK))
    ignore_text = managed_text(ignore_text, skills_ignore_block,
                               "# MEOS-SKILLS:START", "# MEOS-SKILLS:END", previous_skill_blocks)
    hidden_files = ignored_paths(repo, ignore_text, [*(p for p in payload if not p.startswith(".claude/")),
                                                     ".meos/repo.json", ".gitignore"])
    if hidden_files:
        raise ValueError(f"Existing ignore rules prevent tracking installed file: {hidden_files[0]}")
    payload[".gitignore"] = ignore_text.encode()
    # Claude Code surfaces work untracked (hook + skills load from the worktree),
    # so operator ignore rules on .claude/ or CLAUDE.md warn instead of refusing.
    if settings_text is not None:
        payload[".claude/settings.json"] = settings_text.encode()
    if instructions.exists():
        payload["CLAUDE.md"] = managed_text(instructions.read_text(encoding="utf-8"), CLAUDE_BLOCK,
                                            AGENTS_START, AGENTS_END).encode()
    claude_paths = [p for p in payload if p.startswith(".claude/") or p == "CLAUDE.md"]
    for hidden in ignored_paths(repo, ignore_text, claude_paths):
        print(f"warning: ignore rules keep {hidden} untracked; Claude Code still loads it locally", file=sys.stderr)
    marker = {"$schema": "meos-repo.v1", "version": 1, "id": data["id"],
              "repo_id": (old_marker or {}).get("repo_id") or str(uuid.uuid4()),
              "runtime": {"mode": mode or (old_marker["runtime"]["mode"] if old_marker else data.get("runtime", {}).get("mode", "dsh"))},
              "skills_ignored_directories": ignored_skill_directories,
              "files": {relative: digest(content) for relative, content in payload.items()
                        if relative not in ("AGENTS.md", ".gitignore", "CLAUDE.md")
                        and (relative != ".claude/settings.json" or settings_owned)}}
    payload[".meos/repo.json"] = (json.dumps(marker, indent=2, ensure_ascii=False) + "\n").encode()
    # Preflight every destination before making any change.
    previous = {}
    for relative in payload:
        target = member(repo, relative)
        previous[relative] = (target.read_bytes(), target.stat().st_mode) if target.exists() else None
    print(f"{'Would install' if dry_run else 'Installing'} MEOS ({marker['runtime']['mode']}) in {repo}")
    if dry_run:
        for relative in payload:
            print(f"  {relative}")
        return
    created_directories = []
    try:
        for relative, content in payload.items():
            target = member(repo, relative)
            missing = []
            parent = target.parent
            while not parent.exists():
                missing.append(parent)
                parent = parent.parent
            for parent in reversed(missing):
                parent.mkdir()
                created_directories.append(parent)
            target.write_bytes(content)
            if relative == "meos":
                target.chmod(0o755)
    except OSError:
        for relative, saved in previous.items():
            target = repo / relative
            if saved is None:
                target.unlink(missing_ok=True)
            else:
                target.write_bytes(saved[0])
                target.chmod(saved[1])
        for directory in reversed(created_directories):
            directory.rmdir()
        raise
    print("MEOS installed. Start Codex with: codex; Claude Code with: claude (restart a running session); dsh with: ./meos launch")
    print("Skills: " + ", ".join(f"meos-{phase}" for phase in SKILL_STEPS) + " (dsh and Codex load .agents/skills; Claude Code loads .claude/skills)")
    print("Local controls: ./meos status | ./meos use codex|dsh|claude | ./meos launch | ./meos review")


def brief(root: Path, data: dict, repo: Path) -> dict:
    result = {
        "schema": 1, "project": data["id"], "project_root": str(root),
        "repo": str(repo), "runtime": data.get("runtime", {}).get("mode", "dsh"),
        "read_scope_enforced": False,
        "installed": "repo_installation" in data,
        "repositories": [{"path": r["path"],
                          "branch": git(member(root, r["path"]), "branch", "--show-current") or "DETACHED",
                          "head": head(member(root, r["path"])),
                          "dirty": git(member(root, r["path"]), "status", "--short").splitlines()}
                         for r in data["repos"]],
    }
    current = member(repo, "docs/work/current.json")
    if current.is_file():
        pointer = read_object(current)
        references = pointer.get("references", [])
        if not isinstance(references, list):
            raise ValueError("Work pointer references must be a list")
        for reference in references:
            if not member(repo, reference).is_file():
                raise ValueError(f"Missing work reference: {reference}")
        result["work"] = {key: pointer.get(key) for key in
                          ("work_id", "phase", "status", "references", "blockers", "next_action")}
    checkpoint = member(repo, ".meos/runtime-handoff.json")
    if checkpoint.is_file():
        saved = read_object(checkpoint)
        installed = data.get("repo_installation", {})
        portable_match = bool(installed.get("repo_id")) and saved.get("repo_id") == installed["repo_id"]
        path_match = saved.get("repo") == str(repo)
        if saved.get("schema") != 1:
            raise ValueError(f"Handoff belongs to another repository or schema: {checkpoint}")
        if not path_match and not portable_match:
            if not installed:
                raise ValueError(f"Handoff belongs to another repository or schema: {checkpoint}")
            result["handoff_warning"] = "Checkpoint belongs to another checkout and was ignored; use the live work pointer."
        else:
            # Always expose freshness: a checkpoint never overrides the live work pointer.
            result["handoff"] = {key: saved.get(key) for key in
                                 ("captured_at", "to", "note", "next_action", "verification", "head")}
            result["handoff"]["head_matches"] = saved.get("head") == head(repo)
            result["handoff"]["repo_path_matches"] = path_match
    return result


def render(state: dict) -> str:
    lines = [f"Project: {state['project']}", f"Repo: {state['repo']}", f"Runtime: {state['runtime']}"]
    for repo in state["repositories"]:
        lines.append(f"{repo['path']}: {repo['branch']} @ {repo['head'][:12]}")
        lines.extend(f"  {line}" for line in repo["dirty"][:25])
        if len(repo["dirty"]) > 25:
            lines.append(f"  ... {len(repo['dirty']) - 25} more dirty paths; inspect git status")
    work = state.get("work")
    if work:
        lines += [f"Work: {work['work_id']} ({work['phase']}, {work['status']})",
                  "References: " + ", ".join(work["references"] or []),
                  "Blockers: " + json.dumps(work["blockers"], ensure_ascii=False),
                  f"Next: {work['next_action']}"]
    else:
        lines.append("No docs/work/current.json; inspect the repository's own instructions and handoff.")
    if state.get("handoff"):
        lines.append("Checkpoint (compare with live pointer and tree): " + json.dumps(state["handoff"], ensure_ascii=False))
    if state.get("handoff_warning"):
        lines.append(state["handoff_warning"])
    lines.append("Use AGENTS.md and the selected local skill. Explicit task context wins. Preserve unrelated changes.")
    text = "\n".join(lines)
    return text[:7400] + ("\n[Brief truncated; read the referenced work packet.]" if len(text) > 7400 else "")


def launch_args(mode: str, root: Path, repo: Path, args: argparse.Namespace) -> list[str]:
    if mode == "codex":
        command = ["codex", "-C", str(repo), "--sandbox", "workspace-write", "--ask-for-approval", "on-request"]
        # The parent is a declared project root, never the estate/framework root.
        if repo != root:
            command += ["--add-dir", str(root)]
        command += ["-c", "sandbox_workspace_write.exclude_slash_tmp=true",
                    "-c", "sandbox_workspace_write.exclude_tmpdir_env_var=true",
                    "-c", "shell_environment_policy.set.TMPDIR=" + json.dumps(str(root / ".meos/tmp"), ensure_ascii=False)]
        if args.model:
            command += ["--model", args.model]
        if args.reasoning:
            command += ["-c", f"model_reasoning_effort={args.reasoning}"]
        return command
    if mode == "claude":
        if args.reasoning:
            raise ValueError("--reasoning applies to Codex only; pick effort inside Claude Code")
        command = ["claude"]
        if repo != root:
            command += ["--add-dir", str(root)]
        if args.model:
            command += ["--model", args.model]
        return command
    if args.model or args.reasoning:
        raise ValueError("--model/--reasoning apply to Codex only; dsh uses the existing meos profile")
    return ["dsh", "--profile", "meos"]


def dsh_update_hook(mode: str, dry_run: bool) -> Path | None:
    """The dsh updater to run before boot, or None when this launch runs none.

    `MEOS_DSH_UPDATE` points the hook at a specific script (tests); the shipped
    default sits beside the runtime, which is the framework's `scripts/` and an
    installed project's `.meos/`. `MEOS_DSH_NO_UPDATE=1` disables it entirely.
    """
    if mode != "dsh" or dry_run or os.environ.get("MEOS_DSH_NO_UPDATE") == "1":
        return None
    configured = os.environ.get("MEOS_DSH_UPDATE")
    if configured:
        return Path(configured).expanduser()
    return Path(__file__).resolve().parent / DSH_UPDATE_HOOK


def review_base(repo: Path) -> tuple[str, str]:
    """Independent-review base: configured integration branch, else main/master; HEAD~1 on the base itself."""
    config = subprocess.run(["git", "-C", str(repo), "config", "--get", "meos.integrationBranch"],
                            capture_output=True, text=True)
    candidates = [config.stdout.strip()] if config.returncode == 0 and config.stdout.strip() else []
    candidates += ["main", "master"]
    for candidate in candidates:
        if subprocess.run(["git", "-C", str(repo), "show-ref", "--verify", "--quiet", f"refs/heads/{candidate}"]).returncode:
            continue
        if git(repo, "rev-parse", candidate) != git(repo, "rev-parse", "HEAD"):
            return candidate, f"the current branch against {candidate}"
        break
    parent = subprocess.run(["git", "-C", str(repo), "rev-parse", "--verify", "--quiet", "HEAD~1"], capture_output=True)
    if parent.returncode:
        return "HEAD", "the working tree against HEAD (single commit)"
    return "HEAD~1", "the last commit plus the working tree (HEAD is on the integration branch)"


def review(repo: Path, state: dict, args: argparse.Namespace) -> int:
    base, scope = (args.base, f"the current branch against {args.base}") if args.base else review_base(repo)
    if args.base:
        git(repo, "rev-parse", "--verify", "--quiet", f"{base}^{{commit}}")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = member(repo, f".meos/reviews/{stamp}.md")
    command = ["codex", "exec", "--sandbox", "read-only", "-C", str(repo), "--output-last-message", str(output)]
    if args.model:
        command += ["-c", "model=" + json.dumps(args.model)]
    if args.effort:
        command += ["-c", "model_reasoning_effort=" + json.dumps(args.effort)]
    command.append("-")
    work = state.get("work") or {}
    prompt = (f"You are the independent REVIEWER for project {state['project']}; you did not write this change "
              f"and must not edit files. Review {scope}: run `git diff {base}...HEAD --stat`, `git diff {base}...HEAD`, "
              f"`git log --oneline {base}..HEAD`, then `git status --short` and `git diff HEAD` for every uncommitted "
              "tracked change, staged or not (`git diff --cached` shows the staged part alone); ignore untracked "
              "files unless the diff references them. Read AGENTS.md (and CLAUDE.md if "
              "present) for the project's intent, boundaries and verification commands; read the work packet the "
              "live pointer names; run the verification commands if the read-only sandbox allows, otherwise say "
              "they were not run. Check: the diff matches its stated intent and stays inside allowed paths; "
              "acceptance items are demonstrated, not asserted; no credentials, generated-file hand edits or "
              "unrelated changes; tests cover new behavior and failure paths; docs and work records match. "
              "List findings as: severity (blocking/important/minor) | path:line | failure mechanism | evidence | "
              "correction. End with exactly one line `VERDICT: accept|rework|escalate` and one sentence of reason. "
              "Do not accept undemonstrated claims.\n")
    if work:
        prompt += f"\nLive work pointer: {json.dumps(work, ensure_ascii=False)}\n"
    if args.note.strip():
        prompt += f"\nTask context from the requester: {args.note.strip()}\n"
    print(f"review scope: {scope}")
    print(shlex.join(command))
    if args.dry_run:
        print(prompt)
        return 0
    if not shutil.which(command[0]):
        raise ValueError("codex is not installed; install/authenticate it in your terminal")
    output.parent.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    for key in ("CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID", "CODEX_THREAD_ID", "DSH_SESSION_ID"):
        env.pop(key, None)
    sys.stdout.flush()
    # Stream codex's progress through while reading its "model:" header, so the
    # record names the model that actually reviewed, not the requested one.
    observed_model = None
    with subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
                          cwd=repo, env=env) as process:
        process.stdin.write(prompt)
        process.stdin.close()
        for line in process.stdout:
            if observed_model is None and line.startswith("model:"):
                observed_model = line.split(":", 1)[1].strip()
            sys.stdout.write(line)
            sys.stdout.flush()
    verdict = next((line for line in output.read_text(encoding="utf-8").splitlines()
                    if line.strip().upper().startswith("VERDICT:")), None) if output.is_file() else None
    atomic_json(member(repo, f".meos/reviews/{stamp}.json"),
                {"schema": 1, "captured_at": stamp, "base": base, "scope": scope, "head": head(repo),
                 "model": observed_model or args.model or "codex default (not reported)",
                 "requested_model": args.model, "effort": args.effort or "codex default",
                 "exit_code": process.returncode, "verdict": verdict, "report": str(output)})
    if process.returncode or not output.is_file() or not output.stat().st_size:
        raise ValueError(f"codex review did not complete (exit {process.returncode}); see {output}")
    print(f"review saved: {output}")
    print(verdict or "No VERDICT line found; read the report.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="verb", required=True)
    for name in ("status", "use", "launch", "resume", "handoff", "install", "start", "review"):
        child = commands.add_parser(name)
        child.add_argument("--project", help="Registered project directory containing .meos/project.json; defaults to cwd")
        child.add_argument("--dry-run", action="store_true")
        if name == "use":
            child.add_argument("mode", choices=MODES)
            child.add_argument("--repo", help="Declared repo to open; defaults to the primary member")
        if name == "install":
            child.add_argument("--repo", help="Declared repo to install; defaults to the selected member")
            child.add_argument("--target", help="Install directly into this Git root without estate registration")
            child.add_argument("--id", help="Identity for a new direct installation; defaults to the folder name")
            child.add_argument("--runtime", choices=MODES, help="Initial mode or an explicit reinstall override")
        if name in ("status", "resume"):
            child.add_argument("--json", action="store_true")
        if name == "launch":
            child.add_argument("--runtime", choices=MODES, help="One-run override without changing the saved mode")
            child.add_argument("--model")
            child.add_argument("--reasoning", choices=("minimal", "low", "medium", "high", "xhigh"))
        if name == "start":
            child.add_argument("--runtime", choices=MODES, help="Active runtime; does not change the saved default")
        if name == "review":
            child.add_argument("--base", help="Base ref; defaults to meos.integrationBranch, main or master")
            child.add_argument("--model", help="Codex model id; defaults to the Codex config default")
            child.add_argument("--effort", choices=("minimal", "low", "medium", "high", "xhigh"))
            child.add_argument("--note", default="", help="Task context for the reviewer; never credentials")
        if name == "handoff":
            child.add_argument("--to", choices=MODES, required=True)
            child.add_argument("--note", required=True, help="Outcome and unfinished work; never include credentials")
            child.add_argument("--next-action", required=True)
            child.add_argument("--verification", default="Not recorded")
    args = parser.parse_args()
    if args.verb == "install" and args.target is not None:
        if args.project is not None or args.repo is not None:
            parser.error("--target cannot be combined with --project or --repo")
        root, data, repo = install_target(args.target, args.id, args.runtime)
        install(root, data, repo, args.dry_run, mode=args.runtime)
        return 0
    if args.verb == "install" and args.id is not None:
        parser.error("--id requires --target")
    # Local controls and framework project controls are distinct even when
    # a parent Git member contains both identities.
    root, data, repo = project(args.project or ".", prefer_repo=Path(__file__).resolve().parent.name == ".meos")
    if args.verb == "install":
        if args.repo is not None:
            if args.repo not in [r["path"] for r in data["repos"]]:
                raise ValueError("--repo must be a declared repo member")
            repo = member(root, args.repo)
        install(root, data, repo, args.dry_run, mode=args.runtime)
        return 0
    if args.verb == "use":
        runtime = dict(data.get("runtime", {}))
        selected = next(r["path"] for r in data["repos"] if member(root, r["path"]) == repo)
        runtime.update(mode=args.mode, repo=args.repo if args.repo is not None else selected)
        if runtime["repo"] not in [r["path"] for r in data["repos"]]:
            raise ValueError("--repo must be a declared repo member")
        data["runtime"] = runtime
        if not args.dry_run:
            if "repo_installation" in data:
                marker = data["repo_installation"]
                marker["runtime"] = {"mode": args.mode}
                atomic_json(member(root, ".meos/repo.json"), marker)
            else:
                atomic_json(member(root, ".meos/project.json"), data)
        print(f"{'Would select' if args.dry_run else 'Selected'} {args.mode} for {data['id']} ({runtime['repo']})")
        return 0
    state = brief(root, data, repo)
    if args.verb == "start":
        state["runtime"] = args.runtime or state["runtime"]
        print(f"[MEOS] {state['project']} | {state['runtime']} | {repo.name}")
        print(render(state))
    elif args.verb in ("status", "resume"):
        if not args.json:
            print(f"[MEOS] {state['project']} | {state['runtime']} | {repo.name}")
        print(json.dumps(state, indent=2, ensure_ascii=False) if args.json else render(state))
    elif args.verb == "handoff":
        if not args.note.strip() or not args.next_action.strip():
            raise ValueError("Handoff needs nonempty --note and --next-action")
        checkpoint = {"schema": 1, "repo": str(repo), "captured_at": datetime.now(timezone.utc).isoformat(),
                      "to": args.to, "note": args.note, "next_action": args.next_action,
                      "verification": args.verification, "head": head(repo),
                      "repositories": state["repositories"], "work": state.get("work")}
        if data.get("repo_installation", {}).get("repo_id"):
            checkpoint["repo_id"] = data["repo_installation"]["repo_id"]
        target = member(repo, ".meos/runtime-handoff.json")
        if not args.dry_run:
            atomic_json(target, checkpoint)
        print(f"{'Would save' if args.dry_run else 'Saved'} handoff: {target}")
        print("Resume from files in a fresh session. The live work pointer remains authoritative.")
    elif args.verb == "review":
        return review(repo, state, args)
    elif args.verb == "launch":
        mode = args.runtime or state["runtime"]
        state["runtime"] = mode
        temporary = member(root, ".meos/tmp")
        state_root = member(root, ".meos/state/projects")
        command = launch_args(mode, root, repo, args)
        prompt = ("Resume this project from the work records below. Read AGENTS.md, compare the actual tree "
                  "with the handoff, and follow the local lifecycle. Do not start external jobs or delegate "
                  "solely to enforce a model preference.\n")
        if mode == "codex":
            prompt += "Codex mode is active: perform strategy, intent, implementation, verification and self-review directly.\n"
        elif mode == "claude":
            prompt += ("Claude Code mode is active: the SessionStart hook printed the brief; use the "
                       "meos-* skills and ./meos review for independent review.\n")
        prompt += render(state)
        print(f"cwd: {root if mode == 'dsh' else repo}")
        print(shlex.join(command))
        print("Read confinement is not enforced by this interim launcher; the selected runtime's sandbox governs writes.")
        if args.dry_run:
            print(prompt)
            return 0
        if not shutil.which(command[0]):
            raise ValueError(f"{command[0]} is not installed; install/authenticate it in your terminal")
        if mode == "dsh":
            print("dsh uses the existing meos profile. Paste the resume brief into its new session.")
            print(prompt)
            hook = dsh_update_hook(mode, args.dry_run)
            if hook is not None:
                if hook.is_file():
                    subprocess.run(["bash", str(hook)], check=False)
                else:
                    print(f"meos: dsh update hook missing at {hook}; booting the installed composition",
                          file=sys.stderr)
        temporary.mkdir(parents=True, exist_ok=True)
        env = dict(os.environ, MEOS_PROJECT_STATE_ROOT=str(state_root),
                   MEOS_RUNTIME=mode, TMPDIR=str(temporary))
        # A fresh runtime must not inherit another harness's session identity.
        for key in ("CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID", "CODEX_THREAD_ID", "DSH_SESSION_ID",
                    "CLAUDE_PROJECT_DIR", "MEOS_LAUNCH_RECORD"):
            env.pop(key, None)
        if mode in ("codex", "claude"):
            command.append(prompt)
        sys.stdout.flush()
        os.chdir(root if mode == "dsh" else repo)
        os.execvpe(command[0], command, env)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"meos runtime: {error}", file=sys.stderr)
        sys.exit(2)
