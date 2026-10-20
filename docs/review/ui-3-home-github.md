# UI-3 — Home GitHub action

20 October 2026. First UI-3 increment only; broader component survey/prototype selection stays open.

| Before | After | Why |
|---|---|---|
| GitHub link beside search and settings in the primary header | Compact footer link, existing session count and privacy note retained | Reserve navigation for work; support remains discoverable without competing with sessions |
| Unicode star | Sized SVG star, theme tokens, finite 1-second diagonal hover sweep and offset hover ring | Match the builder-selected reference without another runtime dependency |
| No dedicated motion/privacy acceptance | Static keyboard focus; no sweep under reduced motion, low resources, motion off or forced colors; no external request until click | Support stays optional and does not add background work |

## Validation and limits

Verified against the running production build before and after, using an existing redacted store containing Drishya Codex and Skeletongraph Codex/Claude sessions. Two local Edge browser checks (`tests/browser/home-github.spec.ts`):1440/390/320px, visible session rows after clearing saved filters, no page horizontal overflow, footer in viewport, settings visible, keyboard outline, reduced motion, forced colors, low resources, disabled UI motion and zero external requests. UI typecheck and Vite build pass. Screenshots inspected locally. These are emulated layouts, not physical-device or broad theme acceptance. Tests opt in via `DRISHYA_REVIEW_STORE` and never import/resume native sessions.

No Tailwind, Uiverse embed, GitHub API, count, background timer or automatic network fetch. The one-second sweep is the explicitly selected reference duration, only on fine-pointer hover; it does not affect agent-material motion. It runs once per hover, never loops, and disappears on exit. Broader UI-3 remains open, including the required prototype picker and builder selection for other controls.

## Design attribution

CSS adaptation of **Button by elijahgummer (Elijah W Gummer)**, builder-selected [bright-chicken-11](https://uiverse.io/elijahgummer/bright-chicken-11). Original reference published under MIT; implemented with Drishya tokens and accessibility fallbacks. No external runtime source is loaded.

MIT License

Copyright (c) 2026 elijahgummer (Elijah W Gummer)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
