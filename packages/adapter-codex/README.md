# Codex journal capabilities

The adapter guards each shape rather than assuming that a CLI version records every field. An unrecognised typed item becomes metadata-only; its content is not copied. Older response-item rollouts retain their existing IDs and projection behavior.

| Recorded CLI version | Evidence checked | Typed-item support |
| --- | --- | --- |
| `0.162.0-alpha.2` | Existing local journal field names/types checked on 20 October; invented fixtures use those shapes | Commands with real exits/output/duration; exact-path file-change outcomes; MCP results/metadata; image paths as references; `web.search` results. Partial overall: no inline images, no unknown Extension kinds, no assumed nested outcome. |
| `0.162.0-alpha.17.2` | Existing local journals contained AgentMessage and Reasoning typed items only | These typed duplicates stay metadata-only in DATA-1; existing response-item message/reasoning parsing continues. No claim that this version records command/file/MCP items. |
| Unreported or other versions | Shape guards and synthetic fixtures only | Recognised fields may import; version acceptance is unverified. Unknown shapes stay metadata-only. |

`SubAgentActivity` and `Extension:image.generation` have synthetic coverage only in this checkout. They retain captured identity/image-reference fields; no native run or image-byte support is claimed. DATA-1 does not add image/question operation kinds (D3) or inline image bytes (D7).

Correlation prefers an exact existing call ID. Otherwise it requires exactly one open `exec`/`functions.exec` call, and is labelled as an enclosing-call relationship. Restart priming includes results, so closed windows do not become open again. No time window alone is called causation.
