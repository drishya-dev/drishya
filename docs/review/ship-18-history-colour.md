# SHIP-18 — Shared and History colour adoption

Taken over from Codex by Claude Sonnet 5.5 with Yash, 10 Nov. Applies the SHIP-17 roles ([contract](ship-17-palette-contract.md)) to History, with the 10 Nov hierarchy rules from Opus. Yash's complaint it answers: "just content and content, no distinction".

## What changed

Colour and weight only. No spacing, layout, layer, size or motion, and no new boxes.

One new Modern sheet, `apps/ui/src/modern/history-ink.css` (imported after `conversation.css`), holds the hierarchy so it has one home:

| Material | Ink and weight |
| --- | --- |
| Prose body, prompt text, command output, requests, diff context lines, definition values | `--text-primary` |
| Prose headings | `--text-primary`, weight 600 |
| Inline code in prose | `--source` on a faint wash of it (11%); border colour transparent so nothing shifts |
| Card title | `--text-primary`, weight 500 |
| Tool kind, provenance, clock, turn author, result labels, hunk headers, line numbers, definition terms | `--text-muted` |
| Paths, links and URLs (path chips, markdown links, notice paths, browser URLs) | `--source` |
| Card outcome | `--pass` / `--fail` |
| Diff signs and washes | `--diff-added` / `--diff-removed` (already in place), with ordinary line text in primary |

Literal-colour audit of the listed sheets, scoped to what paints History. Every text colour in Modern History already resolved to a role token; the remaining literals were Jet-only hard-coded greys that would have made Jet drift from its own tokens. Replaced with tokens: `polish.css` (op, head, foot, command and selected borders and backgrounds), `p1.css` (expanded card), `ink.css` (card border and head mixes, the line highlight and read-preview hover). The remaining hex values in these sheets are black shadows, masks and legacy-skin rules outside Modern History. They are left as they are.

## Verification

- Ink mapping measured in the running app on the genuine sessions below (token names per element, no content): before, ordinary output, requests, context diff lines and paths used secondary or muted ink and inline code used primary; after, the table above.
- Frames: Jet Black, Midnight and Daylight on the same anchors at 1440 and 600 px in the ignored `.local/ship-18/` (`compare/` has the side-by-side images, `frames/` the singles). Claude Code `rec_f230ca48` (read, edit, pass, fail, prompt), `rec_e1f36f6e` (long prose with headings, lists, a table and fenced code), `rec_b837071b` (compaction), `rec_8d7e3351` (plan), `rec_24f408f6` (notice); Codex `rec_44739d61` (edit, pass, fail, prompt) and `rec_7cb1cda1` (prose with bold and lists).
- Gaps: no real Codex session has a plan (none contains plan material) or a notice in the user role, and the Codex compaction in `rec_7cb1cda1` is not rendered in History at all (so no frame); Codex has no markdown heading in any local journal.
- Specs: see the PR for the run and the failures that reproduce on clean `origin/main`.
