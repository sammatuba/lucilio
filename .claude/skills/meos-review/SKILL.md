---
name: meos-review
description: Review a change independently against its intent, boundaries and executed verification, with evidenced findings and one verdict.
---

# MEOS Review

From the Git root, run `bash ./meos start` if this session has not started MEOS (Claude Code runs it from the installed SessionStart hook; Codex runs it at the first task), then read `.meos/lifecycle.md` and the project's AGENTS.md. Follow its domain routes, skills and verification commands.

Use the project's designated independent reviewer when it names one; otherwise run `./meos review` (a GPT reviewer through Codex, read-only). Load the intent, the actual diff including staged, unstaged and relevant untracked files, the affected contracts and the implementation evidence. Check that observed behavior meets the acceptance criteria, that the project's invariants and authorization boundaries hold, that failures or adversarial inputs cannot produce an unsupported result, that tests exercise behavior and reported results match evidence, and that docs and work records agree with the code. State each finding as severity | path:line | failure mechanism | evidence | correction, then one verdict: accept, rework or escalate. A review by the author is self-review and is labelled so. Record dispositions in the work packet; never post, approve, commit or push as a side effect of reviewing.

Explicit user tasks and existing authorization take precedence. A phase change does not authorize external actions. This portable binding does not install the full framework's hooks or gates.
