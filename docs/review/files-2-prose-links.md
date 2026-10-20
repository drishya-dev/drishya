# FILES-2 — captured-work links in agent prose

20 October 2026 · `codex/files-2-prose-links` · PR #157. Prose and typed card/search paths; FILES-2 remains open for test/output paths and search surfaces outside History.

| Before | After | Why |
| --- | --- | --- |
| Local Markdown file links were inert spans, including the actual Drishya Codex documentation link | A keyboard-accessible button opens the existing captured-file reader | Follow the evidence directly from the agent's explanation |
| Inline code passed absolute paths without resolving their workspace | One lexical resolver returns workspace-relative paths and optional line references | Match stored file identities without probing disk or guessing a different root |
| Links with Windows display prefixes and line anchors were not navigable | Workspace-contained `/C:/…`, Windows/POSIX paths, `:line[:column]` and `#Lline[-Lline]` are supported | Handle the forms actually emitted in captured prose |
| A version such as `v0.2.0` could become a file button | Bare version strings and IP addresses remain code | Do not invent a file location from ordinary version text |
| File card headings only opened operation details; expanded search paths were plain text | Read/edit/write title paths open their exact recorded excerpt/patch; both search preview and expanded matches open the exact captured match and line | Keep the selected action's evidence, rather than falling back to a different read of the same path |

The captured display text is unchanged. External URLs, unsupported schemes, UNC targets, parent traversal, unknown absolute roots and paths outside the recorded workspace remain inert. Workspace matching is case-insensitive for Windows drive paths and case-sensitive for POSIX paths. This is lexical containment, not a filesystem authorization mechanism: the existing captured/source services retain their own boundaries.

## Verification

- Actual redacted Drishya Codex baseline contained a local docs link rendered as `SPAN`. Afterward it opens `Work on docs/review/92-feature-value-and-placement.md` without changing the browser URL. Missing recorded source remains honestly missing; this route does not substitute today's disk file.
- Actual Skeletongraph Claude prose was also exercised. Its version string exposed the false positive fixed above; supported file references retain the existing reader route.
- Actual Skeletongraph Claude keyboard navigation to its first operation exposed a `.gitignore` read. Its new title button opened that exact operation's `…/read` evidence, not the later edit. The final frame was inspected locally. The loaded Codex wrapper window has no typed read headers; enrichment remains DATA-1.
- Thirteen local unit cases across Markdown links, lists and reference rendering pass, including Windows/POSIX containment, line anchors, nested emphasis/lists/quotes, external/scheme/traversal rejection and one-button link labels.
- Browser acceptance opens relative, rooted and inline-code references by keyboard, checks exact stored source, current-file consent still being required, inert outside/web targets, stable browser URL and 320px containment. Read/Edit/Write headings and preview/expanded Grep matches select the correct read/patch/search evidence. No workspace file/document/approval request occurs. The existing distant stored-line and missing-range regression also passes.
- Both TypeScript checks and the Vite build pass. Actual screenshots stay under ignored `.local`; no native submission, journal/configuration writes, new endpoint, schema, dependency or hosted CI.

Other FILES-2 surfaces and the broader native/physical/human acceptance gates remain in TASKS. Claude owns review and squash-merge.
