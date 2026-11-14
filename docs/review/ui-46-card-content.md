# UI-46 — Tool cards show their content cleanly

**What Yash saw (13 Nov).** Commands broke inside words and paths (`.loca` / `l/wt-docs`), heredocs lost their lines, output ended on half a line under its fade, tool-call arguments and results were cut at arbitrary points, and the gaps between header, command and output were uneven.

**Cause (found in the running app, not guessed).** Three older layers stacked:

- `stage.css` capped `.command-request` and `.tool-input` at 88 px and `.result-content` at 142 px, each its own scroll box, inside a card body that was itself a scroll box clipped by the card's height class (340 px). Every one of them ended wherever its pixels ran out.
- `recovered-surfaces.css` faded the last 32 px of those boxes, which looks like a half line fading, not a whole one.
- `overflow-wrap: anywhere` on commands and output, plus tokens such as `/dir/.local/x` that the browser refuses to break (it never breaks between `/` and `.`), so a long path broke mid-word.

**What it does now.**

- **`LineClamp`** (`lib/line-clamp.tsx`) measures the real text lines (wrapping included), shows the first N (or, for the end of an output, the last N) and cuts halfway through the leading below the last one, so the bottom edge is a line-box boundary; that line fades to 42 %. It re-measures when the width changes. Hover reading and Expand lift it.
- **Budgets:** command 4 lines, output 3 + "N more lines" + 3, arguments 4, MCP result 3, sized so header, command and output fit the 340 px class.
- **`CardBody`** (`components/CardBody.tsx`) is the safety net for every other card kind (browser results, reads, searches, plans): if a collapsed body is still taller than its card, it is cut at the last line that fits whole. Nothing past it shows; Expand opens all of it.
- **Commands** (`CommandText.tsx`): one block per command line with a 2 ch hanging indent, so a wrapped line hangs under its own start and a heredoc keeps its structure; `<wbr>` after every `/` and `\` (text unchanged, so copy is exact).
- **Arguments** (`ToolInput.tsx`, `card-content.css`): aligned key / value rows (a subgrid), values wrap; the "Inspect argument data" chip floats at the lower corner like the output chips instead of taking a row.
- **One rhythm:** header, command, output and arguments sit `--card-gap` (8 px) apart.

**Card kinds checked** (frames in `.local/ui-46/before` and `after`, never committed):

| Kind | Before | Now |
|---|---|---|
| Shell command and output | mid-word and mid-path breaks, output cut mid-line | whole words, hanging indent, whole lines |
| Heredoc | one run of text | one block per line, blank lines kept |
| Test output | cut mid-line | whole lines |
| MCP / other tool call, arguments | stacked, clipped at 88 px | key/value rows, whole lines |
| MCP result, browser result | clipped at the card edge | whole lines |
| Write, Edit (code, Markdown) | wrapped since UI-44 | unchanged; body ends on a whole line |
| Read, search, plan | text cut at the card bottom when tall | body ends on a whole line |
| Web, question, image | not changed (no cut text found) | unchanged |

**Checked.** `tests/browser/card-content.spec.ts` (fixtures of a long command, a heredoc, long and wide output, a long Markdown write and a tool call with long arguments, at 1440 and 600): no horizontal overflow, each clamp ends between lines, every collapsed card ends on a whole line, line breaks kept, copying returns the original text, Expand shows everything. The `passage-layout`, `diff-line-wrap`, `conversation-view` and history-related specs are unchanged and green; no golden changed.

**Real sessions** (journals are never printed; prefixes and counts only). Claude Code `rec_ebc58aff` (384 cards at 1440) and `rec_45b046b2` (216 cards) and Codex `rec_372f6b61` (339 cards): no card overflows sideways and no line is cut at a card edge. At 600 a smaller sample (7 to 46 cards each) was clean. Known gap: 10 of 146 MCP cards (browser results) and 1 Read card in `rec_ebc58aff` still have text below the card edge that no cut hides (cause not found); `rec_45b046b2` showed 9 MCP and 5 Read cards of the same kind before the closed-details fix to the counter.

**Not green, not caused here.** `reading-column-edges.spec.ts` at 2000 and 2560 measures the first mounted `.prose p`; card heights decide which rows are mounted, and the paragraph it lands on has 12 px of padding (13 px indent against 8). It fails intermittently at 2560 on clean main.

**Left alone.** Hover zoom keeps its own room (the clamps and the cut lift while a card is read in place). The reading-edge, map and History paging code belong to other tasks.
