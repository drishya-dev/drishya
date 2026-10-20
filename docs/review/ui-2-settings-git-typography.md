# UI-2 — Settings and Git history typography

20 October 2026 · `codex/ui-2-settings-type` · PR #155. This is a bounded slice of UI-2; its parent remains open for other surfaces.

| Before | After | Why |
| --- | --- | --- |
| Settings navigation metadata and palette captions were 10px | Metadata is at least 11px | Make secondary information readable without raising the whole interface scale |
| Keyboard rows were 11px and used a fixed 120px key column | 12px rows with flexible columns and wrapping | Keep both shortcut and explanation readable in narrow windows |
| Phone theme descriptions inherited a hidden state | Descriptions remain visible in the existing scrollable panel | Theme names alone do not communicate their palette |
| Git reference status, scope, graph captions, hover metadata and commit badges used 8–10px text | 11px metadata and 12px controls/reference labels | Make the useful context legible while the graph remains the main material |
| Parent comparison used an unwrapped label row | The row can wrap within its existing detail pane | Larger control text must not push the file reader outside a phone viewport |

## Validation

- Before changing UI, opened the actual redacted Drishya Codex session in the running app and inspected Settings and the current repository Git graph. Baseline inspection found the 10px Settings text and 8–10px Git metadata described above.
- Settings browser tests visit all six categories across all seven palettes. The test measures actual text sizes and composited foreground/background contrast; every measured enabled text node reaches 4.5:1. It also checks 1440×900, 600×500, 390×844 and 320×568 layouts, scroll access to the last theme/shortcut/version note, a working reasoning select and Escape dismissal.
- Git browser tests cover all seven palettes, three actual fixture commits, multiple reference badges, hover details, 12px controls, and file-detail navigation at 1440/900/390/320px. The existing root/merge-patch and continuous-history browser journeys also pass. Existing palette contrast guard passes; no palette colors changed.
- Actual redacted Drishya Codex Settings and its real local Git graph were rechecked after the change, including the commit rows. Actual Skeletongraph Claude Settings was checked at 390px. No text below 11px was found in these Settings checks or the Git metadata check. Screenshots inspected locally; no real session content is committed.
- Both TypeScript checks and the Vite production build pass. Local checks only, no hosted CI, native prompt execution or journal/configuration writes.

## Limits and integration

Modern-only CSS; Legacy retains its previous typography. No timeline geometry, shader, history virtualization, captured material, native policy, schema or animation changes. Coarse-pointer inputs retain 16px text. Other UI-2 surfaces, physical/assistive-technology acceptance and the human ten-minute check remain open. The visual checks above are bounded acceptance, not whole-product completion.

Claude owns review and squash-merge. Claims for the other agents are retained.
