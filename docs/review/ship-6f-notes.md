# SHIP-6f · Notes gives the route

## What changed

- **Empty Notes with a selected step (`apps/ui/src/components/StepNotes.tsx`)**: reads `expandedOp ?? selectedOp` so both card-click selection and clicking **Expand** work uniformly. When empty and a step is selected/expanded, shows **`Add a note to the selected step`** plus its step title and opens/scrolls/focuses `textarea[aria-label="Note on this step"]` in **one click** (`openStepNoteEditor`).
- **Empty Notes without a selected step (`apps/ui/src/components/StepNotes.tsx`, `apps/ui/src/components/Viewer.tsx`, `apps/ui/src/components/ReadingKeys.tsx`)**: shows **`Choose a step`**, returns from History or Workspace to History, focuses `.history`, and displays a dismissible one-line bottom hint (`Open any step for Add a note at the bottom, or focus a step and press a.`). Selecting/expanding a step, opening a note disclosure, switching mode/session, or dismissing clears the hint.
- **Keyboard shortcut `a` (`apps/ui/src/components/ReadingKeys.tsx`)**: documented in `READING_SHORTCUTS` (`Add or edit a note on the focused step`) and mapped to open and focus the note editor on the focused/selected step (also deduplicated the repeated `o` / `y` legend line).
- **`Earlier reading notes` disclosure (`apps/ui/src/components/StepNotes.tsx`, `apps/ui/src/workflow-finishing.css`)**: styled as an outlined full-width disclosure control with a rotating chevron icon and `Show` / `Hide` right-aligned indicator (`aria-hidden="true"` so the button accessible name remains `Earlier reading notes`).

## Real-session & browser verification

- Scratch store verification across real local sessions (no journal content printed; `.local/ship-6f/` screenshots inspected across widths and palettes and deleted afterwards):
  - **Claude Code (`rec_ff1113cf`, `4` ops):** verified at `600px` (`jet`) and `1440px` (`jet`, `midnight`, `paper`) — `Choose a step` hint centered cleanly above the composer pill (`y=788`, `h=40`, `w=481.56`, `overflow=0`), and `Add a note to the selected step` focused the note textarea in one click (`oneClickFocused=true`).
  - **Codex (`rec_aba0ec58`, `4` ops):** verified at `600px` (`jet`) and `1440px` (`jet`, `midnight`, `paper`) — `Choose a step` hint cleared chrome cleanly (`y=788`, `overflow=0`) and one-click note editor focused (`oneClickFocused=true`).
- Browser specs (`msedge`, `--retries=0`):
  - `tests/browser/ship-6f-notes.spec.ts` (`claude-code` and `codex` fixtures at `600px` and `1440px`)
  - `tests/browser/investigation-finishing.spec.ts`
  - `tests/browser/review-questions.spec.ts`
  - `tests/browser/product-menu.spec.ts`
  - `tests/browser/reading-keys.spec.ts`
