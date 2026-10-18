# 104 — Balance request and result previews

**Superseded,18 October:** The builder rejected this allocation/spacing change after viewing it. Restore the exact pre-PR88 exchange CSS (88px input/142px output, original hover caps, separator and control spacing). Keep later independent prose-overflow and Follow repairs. The retained regression expectations now verify the restored layout.

18 October 2026. Builder feedback on an actual captured command: input is barely visible while the output occupies most of the enlarged card. Apply the installed Emil design skill to spacing and allocation, preserving the shared real material and its existing motion.

| Before | After | Why |
| --- | --- | --- |
| Input capped at 88px; result at 142px | Transfer 21px, approximately one code line, from result to input | Show more of the command without enlarging the normal card budget |
| Hover keeps the same unequal allocation | Apply the same one-line transfer to both enlarged caps | Keep the balance consistent when deliberately reading |
| Command surface followed by another separator and stacked control margins | Remove the second rule and its padding; use a compact 4px control gap | Separate by surface and meaning without wasting vertical space |

This changes display allocation only. Short requests/results retain their natural size. Long sections remain independently scrollable; raw request/result controls and captured blank lines remain available. Expanded detail, recorded bytes, copy, search, provenance, capture and native execution are unchanged. No new animation.

Both typechecks, UI build and447 unit tests across77 files pass. The strengthened allocation check fails against the preceding build and passes after the change, covering12 short/long shell/MCP/other combinations and enlarged geometry. Two local-wheel/hover-boundary browser cases and an opt-in actual-session command check pass; its settled frame was inspected. No hosted CI or native turn. The full pre-change browser sweep separately reported174 passed,6 skipped and4 failures; those findings remain open for103 rather than being hidden by this focused pass.
