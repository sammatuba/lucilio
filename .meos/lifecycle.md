---
type: meos/guidance
title: MEOS repo-local lifecycle
description: Portable native lifecycle and work recovery for explicitly installed Codex repositories.
meos:
  profile: 1
  id: adapter.codex-repo-lifecycle
  lifecycle: current
  visibility: internal
  owner: framework
  authority: guidance
  producer: authored
  load: on-demand
  legacy_paths: []
---

# MEOS local lifecycle

This repository has a lightweight MEOS native runtime installed. The indicator
is `.meos/repo.json`; `./meos` runs the copied runtime without a sibling framework
checkout or estate registration. The project's own AGENTS instructions, routes,
skills, boundaries and verification commands supply its domain contract. Load
only the documents needed for the current task. Explicit user instructions win.

On the first task in a fresh Codex session, run `bash ./meos start --runtime codex`
from the Git root. Report the `[MEOS]` indicator, current work and next step
briefly. This is an instruction-driven preamble after the first user message,
not a trusted shell hook executing before a prompt. Starting plain `codex`
loads the root AGENTS section automatically and uses normal Codex permissions.

In Claude Code the same brief arrives through the installed project hook:
`.claude/settings.json` runs `bash ./meos start --runtime claude` at session
start, resume and clear. The lifecycle skills are copied to `.claude/skills/`
because Claude Code does not discover `.agents/skills/`. If CLAUDE.md exists,
it carries the managed MEOS section; Claude Code reads AGENTS.md only when no
CLAUDE.md is present, so the installer never creates one.

Use strategy → intent → implement → verify/review → wrapup, scaled to the task:

- Strategy: challenge material assumptions and record decisions when needed.
- Intent: capture outcome, constraints, failure cases and observable checks.
- Implement: follow the intent and the project's own boundaries; preserve
  unrelated edits and run the relevant verification commands.
- Review (`meos-review` skill): inspect the diff and executed evidence; fix material findings.
  `./meos review [--base REF] [--model ID] [--effort E] [--note TEXT]` runs an
  independent GPT reviewer through `codex exec` in a read-only sandbox (Codex's
  configured default model unless overridden) and saves the report and a
  verdict record under local `.meos/reviews/`. A review by the author is
  self-review and is labelled so; do not claim parity with the full audit gate.
- Wrapup: record outcome, checks, unresolved findings and the exact next action
  in the project's work packet. The live `docs/work/current.json` and its
  references win over an old checkpoint. Explicit user tasks win over both.

All phases may run directly in Codex or Claude Code with the user-selected
model. `./meos use codex|dsh|claude` selects the default for `./meos launch`; it
cannot change an already running runtime. Direct `codex` or `claude` means that
runtime even if the saved default differs. `./meos launch` in claude mode starts
`claude` in this Git root with the resume brief as the first prompt.
The optional local launcher applies workspace-write and on-request approvals
for Codex, with temporary files and state inside this Git root. It does not
enforce read confinement. dsh uses the existing meos profile, whose enforcement
and provider remain its own responsibility. Neither route proves full harness
parity or installs the full framework's hooks, registry, gates or lane routing.

Use `./meos resume` to inspect live state. Before a session change, persist work
and optionally run `./meos handoff --to codex --note 'Outcome and unfinished work'
--next-action 'Exact next step' --verification 'Checks actually run'`. Checkpoints
remain local and must contain no credentials. Authentication and user-selected
models stay with Codex; no account selection or quota routing is installed.

Do not publish, push, merge, deploy, send messages or start external jobs solely
because a lifecycle phase changed. Continue already-authorized reversible work.
