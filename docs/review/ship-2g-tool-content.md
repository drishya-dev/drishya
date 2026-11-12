# SHIP-2g — Tool results read as content

- **MCP `content[]` unwrapping (`apps/ui/src/lib/tool-output.ts`, `ToolOutput.tsx`, `StructuredResult.tsx`, `StoredToolResult.tsx`, `captured-content.css`):**
  - Unwraps Anthropic/MCP `content[]` text items recursively up to 8 levels (including truncated preview envelopes and text + image envelopes without dropping images).
  - Classifies unwrapped payloads accurately: valid JSON routes into `CapturedResultViews` / `InlineData`, Markdown renders cleanly via `Markdown` inside `.tool-markdown`, and plain text renders unescaped while keeping an `Original` / `Envelope` toggle and `500`-line paging.
- **Codex `exec` `apply_patch` detection (`packages/capture-core/src/code-mode.ts`, `packages/projection/src/reduce.ts` `r40`, `apps/ui/src/lib/exec-patch.ts`, `ExecPatchMaterial.tsx`, `CapturedCommands.tsx`, `History.tsx`):**
  - Extends static `literalPatch` capture recognition to safe single-binding `const|let|var <id> = "<patch>"; await tools.apply_patch(<id>);` wrappers while continuing to reject dynamic control flow, reassignment, and non-patch calls.
  - Adds UI-level `extractExecPatches` + `ExecPatchMaterial` with `DiffReader` (expanded History and Commands) and compact `DiffView` (8-line preview in History), plus a `Script` toggle to inspect the raw JavaScript wrapper when needed.
- **Browser `get_page_text` result URL fallback (`apps/ui/src/lib/browser-evidence.ts`, `BrowserEvidence.tsx`, `browser-evidence.css`):**
  - Extracts a validated `http(s)://` URL from leading returned page metadata lines (`URL:`, `Page URL:`, or standalone `get_page_text` URL before `---` / `Tab Context:`) when call arguments omit `url`, labelled `from result`.

## Real local sessions verified (`600 px` and `1440 px`; `jet`, `midnight`, `paper`)

- **Codex `rec_7f72dcb0` (`39` ops):** Static-binding promotion promoted all `exec` `apply_patch` calls (`0` remaining shell patch ops; `3` multi-hunk `edit` ops, `1` write, `1` delete); expanded diff reader verified clean (`escN=false`, `escQ=false`).
- **Codex `rec_7cb1cda1` (`1115` ops, `4` wrapped `cua_repl` results):** Unwrapped compact and expanded Markdown (`.tool-markdown`), zero raw wrapper/escape leakage.
- **Codex `rec_8415940e` (`79` ops, `33` wrapped MCP results, `2` strict JSON) and `rec_45333698` (`75` ops, `29` wrapped MCP results):** Unwrapped compact and expanded views including `<InlineData>` tree rendering, zero raw wrapper/escape leakage.
- **Claude Code `rec_dac6d1d1` (`52` ops, `2` `get_page_text` calls) and `rec_64d5c199` (`992` ops, `2` `get_page_text` calls):** Extracted link from returned metadata with `from result` label and unwrapped compact/expanded text. (`rec_fa9c` was not present locally, so `rec_dac6d1d1` was verified end-to-end in Edge and `rec_64d5c199` checked at projection level.)
