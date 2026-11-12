---
name: meos-implement
description: Build or fix code in a MEOS project against its intent, then execute its verification checks.
---

# MEOS Implement

From the Git root, run `bash ./meos start` if this session has not started MEOS (Claude Code runs it from the installed SessionStart hook; Codex runs it at the first task), then read `.meos/lifecycle.md` and the project's AGENTS.md. Follow its domain routes, skills and verification commands.

Use the project's implementation route or skill when present. Read the relevant intent and boundaries, implement the bounded change, run the project's relevant checks and review the diff. Request an independent review with `./meos review` (a GPT reviewer through Codex, read-only) before claiming completion. Record executed evidence and material unresolved findings. Preserve unrelated edits; a review by the author is self-review and is labelled so.

Explicit user tasks and existing authorization take precedence. A phase change does not authorize external actions. This portable binding does not install the full framework's hooks or gates.
