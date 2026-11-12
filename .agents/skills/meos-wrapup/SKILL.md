---
name: meos-wrapup
description: Wrap up a MEOS project session with verification evidence, unfinished work and an exact handoff.
---

# MEOS Wrapup

From the Git root, run `bash ./meos start` if this session has not started MEOS (Claude Code runs it from the installed SessionStart hook; Codex runs it at the first task), then read `.meos/lifecycle.md` and the project's AGENTS.md. Follow its domain routes, skills and verification commands.

Use the project's wrapup procedure when present. Run the required project checks for changed code, run `./meos review` for material changes, and record outcome, actual results, review verdict, unresolved findings and the exact next action in its work packet. The live docs/work/current.json wins over an old checkpoint. Optionally persist recovery using ./meos handoff --to codex|claude --note 'Outcome and unfinished work' --next-action 'Exact next step' --verification 'Checks actually run'. Keep credentials out of handoffs. Suggest a commit when useful; do not commit or publish solely because wrapup was invoked.

Explicit user tasks and existing authorization take precedence. A phase change does not authorize external actions. This portable binding does not install the full framework's hooks or gates.
