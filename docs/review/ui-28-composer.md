# UI-28 — Composer to the premium bar (Modern)

Modern only; the older composer markup is untouched. Code: `PromptComposer` in `components/SessionWorkspace.tsx`, `components/ComposerMenu.tsx`, `modern/composer.css`.

## What it is now

- **A box that grows.** One line at rest; it grows with the prompt up to 40 % of the window (at most 240 px), then scrolls inside, with the top and bottom edges fading while it scrolls. It also refits when the window is resized.
- **Images above the text.** Images are 64 px thumbnails in one strip (sideways scroll when there are many); click opens the existing preview, the remove button appears on hover or focus. Text files and folders keep a named chip.
- **Product menus, no native select.** `+` (Images or files, Folder contents), the model and the reasoning effort are popover menus: arrow keys, Home/End, Enter/Space, Escape and Tab; focus returns to the trigger; `menuitemradio` for choices. They open from the trigger (scale .95 → 1, 160 ms) and close faster (120 ms) on the shared Modern motion gates (motion on, pointer press, not low resource, no reduced-motion preference). Keyboard use stays immediate, as everywhere else in Modern.
- **Setup is one inline row** ("Enable this workspace to send prompts from here", the button, Remember for this checkout; the CLI instructions when the CLI is missing), shown only while it is needed. It replaces the hidden "Connection & permissions" menu.
- **The model list is read where it is needed:** with no list yet, the model menu offers "Load model list" (the old "Read native settings", same call, same consent gate: disabled until the workspace is enabled).
- **Status only when there is something to say:** a turn running, a question, an approval, a failure, no connection. Nothing at rest.

## Facts removed, and why

| Removed | Why |
|---|---|
| `Target: <path> · recording …` in the connection menu | The folder name stays in the box's first line; the full path and recording suffix are not something a person acts on. |
| "Native settings describe the last reported policy;" | Explained the button, not the product. |
| `Connected session · never · dangerFullAccess` (scope, approval policy, sandbox) | Raw harness vocabulary people do not read; each action is still asked at its own approval card. |
| "Each Allow once applies only to its native request. Full access and global settings remain in the native CLI." | Static reassurance; the approval card says what it asks. |
| `Codex · replied 3 m 08 s ago`, `… · live`, `… · no activity for …` | Not needed (Yash, 5 Nov). Only open work (`running`, `asking`, `working`) shows. |
| `Ready`, `Checking…`, `Needs access`, `CLI unavailable` as the status word | Resting or duplicated by the setup row. |
| `Native defaults` / `Native default` wording and the native model text | Replaced by the model menu (`Default model`). |
| "Connection & permissions" as a permanent control | Nothing in it is left to act on once the workspace is enabled and the CLI is present. |
| The text on the Send button | Round icon button; its accessible name is still "Send prompt". |
| The two separate attach icon buttons | One `+` menu. |

Unchanged on purpose: sending (including the idle-in-other-clients confirmation), approvals and native questions, queued inputs, minimize, draft persistence, the 64 KiB and 32-file limits and their messages.

## Checks

Recorded in the PR description.
