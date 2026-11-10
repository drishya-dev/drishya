# UI-27 · Conversation reads like a chat

Modern only. Yash, 5 and 8 Nov: the agent's prose uses the full reading width, as in Claude Code and ChatGPT; only the person's prompt sits on the right in a capsule coloured from the active theme; passages keep their layout.

**Before:** prose capped at 74 ch with paragraphs at 540 px; the prompt was plain right-aligned text with a "You" label. **After:**

- `.history .prose` spans the reading column; `p` and `li` keep `max-width: 100ch` (about 810 px at 15 px) so lines stay readable while code and tables use the column.
- `.turn` holds a `.turn-capsule` (new wrapper, Modern branch of `History.tsx` only) with a 20 px radius (6 px at the bottom right), `color-mix` of `--palette-active` into `--s1` and `--line-2`; no new tokens. The three-line clamp stays on the inner `.turn-text`, so no fourth line shows through the padding. "Show full prompt" and images/attachments sit under it on the right.
- The "You" label is visually hidden but kept (tests and screen readers). Notices Claude Code wrote in the user role (`.turn-source`) are not the person's: left-aligned, unboxed.
- Prose and prompts keep 16 px clear of the prompt rail (26 px at 880 px and below, where the history padding is 16 px).
- No motion added; the existing arrival and disclosure motion applies.

Check: `tests/browser/conversation-chat.spec.ts` (600, 1440, 1920 px). Real-session record: STATUS, last session.
