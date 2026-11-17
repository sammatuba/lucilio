# Lucilio: reading, inquiry, and philosophical writing

## Authorization and outcome

2026-11-18: the owner requests a complete execution plan and end-to-end implementation in this session, extending the strategy in the local ROADMAP. The subsequent instruction explicitly authorizes autonomous completion, review, commit, push, production deployment, and a full report. Release follows the documented local verification gate and existing production configuration; no security bypasses, unrelated infrastructure changes, live Gemini evaluation, or sibling-repository modifications. Independent read-only Codex review follows the installed MEOS workflow.

Lucilio becomes a reading-first personal philosophy practice. A learner encounters a substantial essay, starts an inquiry, follows an unexpected personal question, explores competing philosophical positions, writes reflections and arguments, revises without losing originals, and resumes later. AI-safety research supplies an initial example, never a curriculum filter. The sustainable rhythm is 2–3 hours weekly, not a deadline or mandatory completion.

“Complete” describes the functioning experience and its execution/verification plan, not exhaustive coverage of all philosophy. The first edition must clearly disclose its boundaries and editorial status. Historical and cultural traditions must be taught on their own terms rather than collapsed into generic self-help.

## Product contract

- Home is a useful reading invitation plus saved inquiries, not a blank composer. The Notebook remains directly available.
- No first-entry requirement in onboarding. Explain reading, free inquiry, source limits, and private writing before inviting action.
- A foundation map spans Western, Chinese, Indian, Islamic, and African philosophical entry points, with acknowledged gaps. Each node has orientation, depth, questions, sources, and explained relationships. The graph has an accessible linked-list equivalent; visual proximity is not evidence of influence.
- A first edition supplies six substantial original editorial essays (target 650–950 words each), contrasting arguments, writing invitations, and source notes. Readings are not personalized or model-generated on demand. Primary texts are linked with locators rather than copied without translation/rights checks.
- Every inquiry has a reader-owned question, optional seed reading, optional parent inquiry, explicit concept links, and active/paused/resting state. Branching preserves the parent, sources, and writing. Any topic may be entered manually.
- Multiple immutable writing records support reflection, argument, question, and revision. A revision points to an earlier record; the original remains visible. No automated grade, diagnosis, ghostwriting, or compelled closure.
- Writing guidance supplies concrete interpret/reflect/argue/revise prompts. Existing invited AI reflection remains in the Notebook; the new practice works without AI and does not silently import inquiry writing into correspondence or model context. The user can explicitly copy a selected saved piece into the Notebook, with clear disclosure of existing correspondence preferences, then separately choose reflection. No new model prompt/pipeline is required in this slice.
- A suggested 150-minute rhythm is guidance only: 40 reading, 25 reflecting, 30 comparing/exploring, 40 writing/revising, 15 synthesis. No weekly reset, notification, streak, or backlog.

## Architecture and data boundaries

- Shared Zod contracts: `src/shared/philosophy.ts` for the versioned static content graph, `src/shared/inquiry.ts` for inquiry/write requests and responses. Referential integrity is validated, including source/node/reading IDs.
- `GET /api/philosophy` serves an authenticated static pack; no outside fetch or model call at runtime.
- New owner-scoped server-only collections `users/{uid}/inquiries` and `users/{uid}/inquiryWritings`. Existing deny-by-default rules remain unchanged. Every endpoint uses existing auth, App Check, payload validation, and general rate limiting.
- `GET/POST /api/inquiries`; `GET/POST /api/inquiries/:id`; `POST /api/inquiries/:id/writings`. IDs are supplied by the client for retry idempotency; collisions with different content return conflict. Updates require matching revision. Parent/reading/concept/revision links are validated within the owner and content pack.
- Explicit `POST /api/inquiries/:id/writings/:writingId/notebook` copies a selected piece idempotently into Notebook. It performs no model call; limits and consent are visible. Inquiry writing otherwise stays out of correspondence.
- Flat collections avoid new composite indexes. Export includes inquiries and writing; existing recursive account deletion removes both. Unsubmitted drafts are UID/inquiry-scoped device-local storage with honest failure notices and download. Export stays bound to the initiating authentication session. Sign-out/account deletion attempts to clear local drafts with prior consent; unavailable storage offers warned sign-out recovery and explains that uncleared data requires browser site-data cleanup. Completed deletion never asks for redundant discard consent.
- Client routes: `/` practice home, `/read/:id`, `/inquiry/:id`, `/philosophy` with query-based focus/filter, `/notebook` legacy journal, `/atlas` preserved. Deep links, invalid IDs, empty states, loading, and retry are explicit.
- Preserve existing correspondence, Atlas, safety/security behavior. Do not change model prompts, providers, deployment configuration, permissions, or sibling research data.

## Execution order and ownership

1. **Contracts and intent (parent):** write this work packet and shared schemas; settle boundaries using agreed strategy. Done when components and data ownership have exact contracts.
2. **Editorial foundation (content workstream):** static pack, broad nodes/edges, six readings, verified source URLs/locators, explicit limitations, content integrity tests. No fabricated citations or claimed full scholarly review.
3. **Persistence/API (server workstream):** authenticated endpoints, transactional idempotency/conflict handling, foreign-link validation, export coverage, integration/rules tests. Keep default-deny rules.
4. **Reading/map UI (library workstream):** reader, sources, explanatory graph and accessible list, search/filter/depth, inquiry creation with retry preservation. Existing typography and mobile accessibility conventions.
5. **Practice/writing UI (parent):** home, inquiry lifecycle, branching, editor/local drafts, revision provenance, pause/resume, Notebook handoff, onboarding/navigation/product copy.
6. **Integration and verification (parent, independent reviewer):** build, unit/client/rules/integration tests, mock reflection evals, browser use on desktop/mobile and failure cases; fix findings before handoff. No paid live calls without authorization.

Parallel work begins only after contracts exist; each workstream has non-overlapping files. Parent checks actual diffs, not just agent summaries.

## Failure behavior

- Failed or delayed API writes do not clear draft text. Retry uses the same operation ID; editing after an ambiguous failure must not overwrite a previously saved version.
- Local draft storage errors are visible; do not claim persistence when unavailable. Drafts survive reload/navigation per user and inquiry. Server save acknowledgment only clears the submitted snapshot, never newer typing.
- Conflicting inquiry updates return 409 and preserve the user's proposed text; reload is explicit rather than silently overwriting either version.
- Missing/private foreign IDs return 404; malformed requests return 400; no credentials or raw server errors appear in the UI.
- Sources load as explicit external links with `noopener noreferrer`; source unavailability must not erase static readings or personal writing. External content is not fetched into model context.
- Starting/branching/reading/saving never triggers a model call. Device drafts are distinct from server-saved writing.

## Observable acceptance checks

1. A new user can enter without writing, read a substantial essay, and start its inquiry.
2. The suggested trust inquiry can branch to belonging or any custom question with no AI-safety condition; parent and child remain navigable after reload.
3. A reader can browse at least 14 traditions/concepts across the stated regions, search, follow explained connections, inspect source locators and coverage limits, and reach a deeper reading without unlocking anything.
4. Multiple reflections and an argument can be saved to one inquiry; a revision retains its predecessor. Different users cannot access each other's inquiries, writing, or device drafts.
5. Pause/rest/resume does not lose data or require a new week. An unfinished inquiry remains usable.
6. Offline/failed/ambiguous writes and reload preserve draft text, and idempotent retries do not duplicate saved work. Concurrent updates do not silently overwrite.
7. Only explicit Notebook copy creates a notebook entry; only the separate existing reflection action invokes AI. Oversize copies are explained rather than truncated.
8. Export includes saved inquiries, writings/revision links, and initiating user's local drafts; account changes abort the download. Account deletion recursively removes new collections. Device-local data is cleared on sign-out/delete when storage permits; failures warn about remaining device data and provide sign-out recovery without claiming cleanup succeeded.
9. Desktop/mobile browser walkthrough covers reading, non-research branching, map, write/revise, reload, pause/resume, errors, old Notebook/Atlas navigation, and no console errors attributable to the change. Keyboard labels, focus, contrast, and width overflow checked.
10. `npm run build`, `npm test`, `npm run test:client`, `npm run test:rules`, `npm run test:integration`, and mock reflection evals execute; failures and unexecuted checks are recorded honestly.

## Verification and handoff

The complete first-edition experience is implemented, locally verified, and independently accepted. Production release is authorized and being prepared.

- First edition: six original essay bodies of 832, 855, 855, 858, 847, and 895 words; sixteen entry points; twenty-six explained editorial connections; seventeen sources. Preparation checked HTTP 200, headings, authors, locators, and selected passages, not full scholarly or primary-edition accuracy.
- `npm test`: 106/106 passed, including 43 new content/contract cases.
- `npm run build`: passed after correcting a Testing Library matcher; Vite reports a >500 KB bundle warning (approximately 1.13 MB raw / 337 KB gzip). No deployment was performed.
- `npm run test:client`: final full run 154/154 passed, including actual-function delayed account-switch exports, unavailable/corrupt storage sign-out, confirmed deletion cleanup for the original UID after account switching, unchanged branch-snapshot retry after parent connections change, and recovered-draft retry regressions.
- `npm run test:rules`: 100/100 passed, including 36 new default-deny cases for inquiry collections. Firestore security rules were not relaxed.
- `npm run test:integration`: 73/73 passed, including 25 new inquiry API cases, real cross-owner isolation, transactional retries/conflicts, revision provenance, explicit Notebook copying, export and recursive deletion.
- `GEMINI_API_KEY='' npm run evals:reflections`: 4/4 mock cases passed. `GEMINI_API_KEY='' npm run evals`: 24/24 mock cases and 6/6 deterministic adversarial rejection checks passed; three live-only judge cases were deliberately skipped. These are plumbing/regression checks, not live model-safety or quality evidence. Generated mock result files were refreshed by the scripts, not hand-edited.
- First real Chromium walkthrough passed reading-first onboarding, full essay/inquiry creation, device-draft reload, failed-save retry, revision with original preserved, non-research branching, map search, pause/resume, 375px mobile width, Notebook copy, existing Atlas navigation, and export including a local draft. Screenshots were inspected. The expanded walkthrough also passed keyboard connection navigation with focus transfer, explicit connection persistence, committed-write/lost-response/reload/edit/resave, required revision-source selection on mobile, invalid-reading recovery, sign-out cancellation and confirmed draft clearing, with no unexpected browser console errors or runtime exceptions. A separate real-browser lifecycle check passed sign-out and confirmed account deletion with draft storage reads/removals deliberately failing: both reached signed-out state and displayed truthful warnings about uncleared device data. It also delayed a successful deletion response, signed into a different synthetic emulator account, and verified that the new account stayed signed in with its local draft preserved; the script’s initial Vite-root import-path error was corrected before the successful rerun. Browser coverage is Chromium at 1280px desktop and 375px mobile, not a cross-browser or assistive-technology certification.
- Local test setup required a checksum-verified Linux JDK and official Firestore 1.22 emulator download. `scripts/with-java.mjs` now selects the platform-compatible cached executable. `firebase.test.json` assigns separate hub/logging ports because otherwise tests collided with a running development emulator. No production configuration or permissions changed.

Independent review `.meos/reviews/20261117T184040Z.md`: **rework**. All five findings have implemented corrections awaiting independent confirmation: (1) unsupported matcher removed and final build passed; (2) exports bind tokens, server data, and drafts to the initiating Firebase User and reject authentication changes across header/fetch/body waits; (3) recovered draft edits rotate the operation ID while unchanged retries retain it, verified in client tests and a real committed-write/lost-response browser scenario; (4) unreadable, malformed, or uncleared storage offers warned sign-out recovery, while completed deletion uses existing consent and distinguishes post-delete sign-out failures; (5) required build, unit, client, rules, integration, mock eval, and browser evidence is now recorded. The parent inspected the actual delegated source/test changes. The reviewer could not run unit/client suites inside its read-only sandbox and did not independently execute browser/emulator/eval checks.

Follow-up `.meos/reviews/20261117T185914Z.md`: **rework**, with two findings subsequently corrected. The first delayed-deletion guard protected the new account but skipped cleanup of the deleted account; cleanup now explicitly targets the original Firebase User’s UID regardless of the current session, with Firebase sign-out guarded separately and truthful warnings when storage fails. Tests seed both users’ inquiry and Notebook drafts. Branch attempts now retain the complete original creation snapshot, not only the question/ID, so changed parent connections cannot produce a conflicting retry. A full 154-client-test run and build passed after both corrections. The expanded browser walkthrough passed the actual committed-branch/lost-response/parent-connection-change/retry scenario, and delayed deletion against real local Firebase emulators cleared A’s device draft while preserving signed-in B and B’s draft. Final independent confirmation `.meos/reviews/20261117T191441Z.md`: **accept**. Both follow-up findings were independently probed and resolved; no remaining material scope, credential, authorization, or generated-file concern was found. Client/server typechecks and pack validation also passed independently; other checks remained sandbox-limited as described above. The minor stale README product/navigation/onboarding descriptions were corrected afterward; no application code changed after acceptance.

Limitations: this is a finite introductory edition, not comprehensive philosophy, expert-reviewed scholarship, a new weekly content generator, or evidence of improved thinking. Most sources are secondary English-language guides; only the trust essay has a directly linked primary passage. Initial question/branch inputs remain in memory until explicitly saved. One device draft is stored per user/inquiry; simultaneous editing in several tabs is not a collaborative merge workflow. New practice remains model-free; existing Notebook and correspondence use their existing separate preferences. Expand content and depth from actual use, not node/click counts.
