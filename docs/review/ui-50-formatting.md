# UI-50 — Text formatting handled the same everywhere

**What Yash saw (14 Nov).** A Shell card's output was a Markdown table (printed by `node table.cjs`). In the card the rows wrapped mid-row and read as broken text:
> *"the same handling we did for normal text, but not done in boxes, now this also tells that maybe all things are not handled at both the places, and maybe others as well, all types of text formatting, we should also do that part."*

**The core rule kept (AGENTS.md, non-negotiable 4: captured ≠ derived).**
- Content that **is** Markdown by where it comes from is rendered (agent prose, plans, `.md` file previews).
- Captured command output stays literal: shell stdout is **never** re-rendered as HTML Markdown.
- Literal output must still be readable: it keeps its line structure. Wide or table-shaped blocks scroll sideways inside their card rather than wrapping mid-row.
- UI-46's rule that a collapsed preview ends on a whole line is strictly preserved.

---

## 1. Matrix: Formatting × Surfaces

| Formatting | Agent prose (Work & Conversation) | Plans (cards & documents) | Questions (`ask_user`) | Sub-agent results (`spawn` / thread) | MCP & Web results | Write / Edit `.md` previews | Shell & terminal output | File peek (`.md` & code) |
|---|---|---|---|---|---|---|---|---|
| **Headings** (`#`-`######`) | Rendered (`h1`-`h6`, unified typography scale) | Rendered in plan documents; checklist heads bold | Rendered in question text/headers | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in document view; literal in diffs | **Literal** (`# Heading` kept verbatim) | Rendered in Document mode; literal in Source |
| **Lists** (ordered `1.`, unordered `-`) | Rendered (`<ol>`, `<ul>`, `<li>`, 1.6 line height) | Rendered in plan docs; plan checklist flat rows | Rendered options list with state indicators | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in Document mode; literal in diffs | **Literal** (preserved verbatim with line breaks) | Rendered in Document mode; literal in Source |
| **Task lists** (`- [ ]`, `- [x]`) | Rendered (`md-task-list`, disabled check, done style) | Rendered in plan docs; plan checklist flat rows | Rendered options with radio/check indicators | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in Document mode; literal in diffs | **Literal** (`- [ ]` kept verbatim) | Rendered in Document mode; literal in Source |
| **Tables** (pipe `\| a \| b \|`) | Rendered (`MarkdownTable`, horizontal scroll) | Rendered in plan docs (`MarkdownTable`, scroll) | Plain text / options (no tables observed) | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in Document mode; literal in diffs | **Literal table-scroll** (keeps lines, scrolls sideways) | Rendered in Document mode; literal in Source |
| **Code blocks** (`` ```lang ``) | Rendered (`FencedCode`, highlight, wrap, copy) | Rendered (`FencedCode` in plan documents) | Literal text in questions/descriptions | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in Document mode; literal in diffs | **Literal** (monospace pre block) | Rendered in Document mode; literal in Source |
| **Inline code** (`` `code` ``) | Rendered (code chip, path/link candidates) | Rendered (code chip, path/link candidates) | Rendered text (inline code preserved) | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in Document mode; literal in diffs | **Literal** (monospace inline) | Rendered in Document mode; literal in Source |
| **Links** (`[text](url)`, web, file) | Rendered (clickable, LINK-1 hover cards, paths) | Rendered (file paths clickable, web links) | Rendered (plain links / question targets) | Rendered in decoded tool markdown; literal in plaintext | Rendered (clickable web addresses, origin chips) | Rendered in Document mode; literal in diffs | **Literal** (`outputPathNodes` path detection only) | Rendered in Document mode; literal in Source |
| **Quotes** (`> quote`) | Rendered (`<blockquote>`, left border, muted) | Rendered in plan docs (`<blockquote>`) | Literal text in question context | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in Document mode; literal in diffs | **Literal** (`>` kept verbatim) | Rendered in Document mode; literal in Source |
| **Emphasis** (`**bold**`, `*italic*`) | Rendered (`<strong>`, `<em>`) | Rendered (`<strong>`, `<em>` in plan docs) | Rendered (bold headers, muted facts) | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in Document mode; literal in diffs | **Literal** (`**` and `*` kept verbatim) | Rendered in Document mode; literal in Source |
| **Rules** (`---`, `***`) | Rendered (`<hr>`, 1px hairline) | Rendered (`<hr>` in plan docs) | Divider line between questions | Rendered in decoded tool markdown; literal in plaintext | Rendered in tool markdown; literal in tool text | Rendered in Document mode; literal in diffs | **Literal** (`---` kept verbatim) | Rendered in Document mode; literal in Source |
| **Long unbroken lines** | Wrapped with break-word/anywhere | Wrapped in plan docs; code/tables scroll | Wrapped in question cards | Wrapped in tool markdown; pre-scroll in wide blocks | Wrapped in tool markdown; pre-scroll in wide blocks | Wrapped in diff lines (UI-44); scroll in source | **Pre-scroll** (sideways scroll, no mid-row wrap) | Wrapped in Document mode; scroll/wrap toggle in source |
| **ANSI colours** | N/A (prose does not have ANSI) | N/A (plans do not have ANSI) | N/A | Stripped cleanly; outcome tokens retained | Stripped cleanly; outcome tokens retained | N/A | **Stripped cleanly**; pass/fail semantic coloring | Stripped cleanly |
| **Tabs** (`\t`) | Preserved in code blocks (`tab-size: 4`) | Preserved in code blocks (`tab-size: 4`) | Preserved in options/descriptions | Preserved in tool output (`tab-size: 4`) | Preserved in tool output (`tab-size: 4`) | Preserved in source reading (`tab-size: 4`) | **Preserved with `tab-size: 4`** for tabular alignment | Preserved with `tab-size: 4` |

---

## 2. Real sessions checked

Journals and real session contents are never printed or committed. Sessions checked by id prefix, size, and counts:

### Claude Code
- `rec_c8e5c9c8` (83.7 MB, 2,695 operations): assistant prose with 75 table headers, 926 prose blocks, 92 web/link addresses, 637 shell/file operations.
- `rec_554b9318` (10.0 MB, 222 operations): plan material (49 native plan calls, 25 projected list revisions).
- `rec_024517cd` (6.3 MB, 426 operations): questions (9 native questions, 9 projected question cards, 17 offered options, 5 literal answers).
- `rec_64d5c199` (13.2 MB, 992 operations): browser and MCP ops (202 native browser/web records, 365 web operations).
- `rec_ebc58aff` (384 cards): shell commands, test output, heredocs, MCP cards, Markdown write previews.

### Codex
- `rec_2dcde4d9` (0.2 MB, 7 operations): assistant prose with Markdown tables.
- `rec_af2cd202` (3.3 MB, 311 operations): assistant prose with links and commit references.
- `rec_fa9e37da` (39.2 MB, 459 operations): sub-agent delegation thread (7 native deliveries, 2 child prose messages).
- `rec_7f1936ab` (7.7 MB, 50 operations): browser and web operations.
- `rec_372f6b61` (25.6 MB, 643 operations): workspace files, shell commands, test runs.
- **Not present in any local Codex session:** `plan-material` (0 local Codex sessions) and `questions` (0 local Codex sessions). Recorded as not present.

---

## 3. What changed

1. **Literal output line structure & horizontal scroll (`apps/ui/src/components/common.tsx`, `apps/ui/src/modern/card-content.css`, `apps/ui/src/lib/tool-output.ts`):**
   - Captured command stdout/stderr stays literal: shell stdout is never re-rendered as Markdown (captured ≠ derived).
   - `isTableShaped(text)` detects Markdown tables (`| ... |`), ASCII/box-drawing tables (`+---+`, `┌───┐`), tab-delimited columns (`\t`), and fixed-width columnar output.
   - When table-shaped or wide, literal output receives `.output-scroll`: `white-space: pre; overflow-x: auto; tab-size: 4;`.
   - The rows do not wrap mid-row; columns stay aligned; wide rows scroll sideways inside the card.
   - `LineClamp` measures real line boxes: collapsed previews end on a whole line, preserving UI-46.

2. **Unified Markdown renderer & styling (`apps/ui/src/lib/markdown.tsx`, `apps/ui/src/modern/markdown.css`):**
   - Quotes (`> quote`) and horizontal rules (`---`) enabled across all Markdown (both agent prose and card documents).
   - Task lists (`- [ ]`, `- [x]`) rendered with styled checkboxes and `md-task-list` / `md-task-item`.
   - HTML markup safely rendered as `<pre className="md-html">` everywhere.
   - One shared stylesheet `markdown.css` for typography, headings, paragraphs, inline code chips, blockquotes, horizontal rules, task lists, and tables across `:is(.prose, .tool-markdown, .plan-document, .desk-markdown, .resource-document)`.
