---
name: meos-intent
description: Turn a MEOS project request into a bounded implementation intent with observable checks.
---

# MEOS Intent

From the Git root, run `bash ./meos start` if this session has not started MEOS (Claude Code runs it from the installed SessionStart hook; Codex runs it at the first task), then read `.meos/lifecycle.md` and the project's AGENTS.md. Follow its domain routes, skills and verification commands.

Use the project's intent route or skill when present. Capture the outcome, scope, constraints, failure behavior and acceptance checks in its work packet. Scale the record to the task; a small fix needs only a brief intent. Continue authorized implementation.

Explicit user tasks and existing authorization take precedence. A phase change does not authorize external actions. This portable binding does not install the full framework's hooks or gates.
