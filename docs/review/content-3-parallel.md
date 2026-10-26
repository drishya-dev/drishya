# CONTENT-3 — preserve multi-select choices with additional text

26 October 2026, PR #239. Focused repair of the existing connected question form; broader CONTENT-3 source/native-account acceptance remains open.

| Before | After | Why |
| --- | --- | --- |
| Typing custom text cleared selected multi-select options; clicking an option cleared typed text. | Multi-select retains both explicit option IDs and additional text in either interaction order. | The existing answer endpoint supports that combination; the UI must not discard part of the person's answer. |
| The multi-select text label described an exclusive alternative. | It now says the person's own answer is an optional addition. Single-choice stays exclusive. | Wording and interaction must agree with the existing request's multiple flag. |

## Verification

- Desktop regression reproduces the original loss of the selected checkbox when typing. Three new browser journeys pass: 1440/390 px multi-select, plus retained single-choice exclusivity. They cover selecting/typing/unselecting in both orders, exact HTTP payloads with punctuation/tab/newline/outer whitespace, retry after a 409, disabled controls while submitting, no extra prompt POST, and reset for a new request ID.
- Root took over verification after the subagent hit model capacity. Sixteen focused units pass: existing input and question parsers plus two direct endpoint-contract guards. The backend preserves option selection order and interior text while applying its existing outer-text trim; the browser does not silently trim or erase the submitted text. No backend production code changed.
- Four focused browser cases pass including the existing Claude question journey through the real local answer endpoint with a synthetic CLI. New combination tests use mocked request/answer transport; **no genuine signed-in account turn or fresh native multi-select capture was executed**. Such source/account acceptance remains CONTENT-3 / NATIVE-1/2.
- Own UI build passed before browser verification. Whole-repository types/build/units are verified centrally on the combined parallel branch; new worktree package junctions can otherwise produce duplicate nominal Store/BlobStore module identities unrelated to this component.

## Boundaries

Only NativeQuestions production code changes. No composer layout, CSS, controller/protocol, schema/capture, persistence, native policy or History/common/worker/PERF-2/3 change. No new controls or animation. Installed emil-design-eng guidance informs preserving the person's composed answer and matching the label to interaction. Parent CONTENT-3 is not marked complete by a supported mock journey; raw source/screenshots remain local. No hosted CI/full browser gate.

## Combined integration

Parent verified all three independent content increments together: 857 whole units /152 files, both TypeScript projects and production build pass; eight initial new browser cases plus the added late-image guard pass (nine distinct cases). Source changes merge without conflicts. Temporary verification merge was aborted; separate PRs remain for builder review. The existing pending-form waiting/status strip at phone width remains a UI-6 layout concern, not changed by this answer-composition fix.
