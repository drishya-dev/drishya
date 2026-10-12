# Studio workbench and promoted Classic

11 October 2026. Supersedes the design names/default in 45; 46's review scores describe the prior compositions, not this new Studio.

The builder judged the first Studio too close to Classic. Its functional composition and cool graphite palette are now **Classic**, with centered action groups, a translucent header and ordinary Tools/MCP server naming. **Legacy** retains the pre-Studio design behind an advanced Settings disclosure and `?experience=legacy`. **Studio** is a separately composed developer workbench, not a palette override on Classic. Default is Classic; use Settings → Workspace design or `?experience=studio`. Preference key v2 avoids silently treating an old saved design name as a new design.

## Developer jobs define the composition

1. Follow the agent: the middle remains a continuous, centered canvas of captured inputs/results/source/patches and unboxed prose. No simulated reading, hidden reasoning, presentation queue or fake causal edge. Parallel captured operations remain left-to-right and wrap at available width.
2. Find relevant source: Studio's left **Working set** is a distinct source-reference index, ordered by captured change inputs then path. It opens recorded file work at a change when present. It is explicitly the loaded window in paged history; no claim to enumerate an entire long session. Filter plus an 80-item rendering bound keeps it usable. Folders remain an explicit alternative, not a second simultaneous source index. The actual 3D repository map remains available and independently consented.
3. Review what matters: Studio's right **Evidence desk** places Review work and current Git review beside the true native/MCP tool origins. Recorded changes/checks and separately consented current Git remain different evidence modes. Tool names and MCP identities remain visible. Phone layouts provide Review work in the header and Tools as a deliberate disclosure.
4. Read without losing place: shared artifact/file/diff/inspector services retain exact recorded provenance, current-source consent, bounded paging, line navigation and existing single-material arrival/hover transforms. Reusing these mechanics avoids a second evidence engine; it does not make the visual shells the same.

The Studio header is a new three-part composition with project title centered and utilities separate from review actions. Multiple captured agents get a real identity strip; single-agent sessions do not. Capture-health/privacy/reconnection warnings are preserved. Chrome is bounded translucent tint/blur, with solid low-resource fallback. The neutral materials have semantic colored glyphs and readable syntax; failed materials alone have red contours. Source and prose sizes stay coherent. No new animation library or GPU text renderer was introduced.

| Before | After | Why |
| --- | --- | --- |
| First Studio and Classic used essentially the same persistent folder/history/tool hierarchy | Studio starts with a referenced-source working set and a separate evidence desk; Classic keeps the previous composition | Begin with developer reading/review jobs rather than recoloring the same shell |
| Studio action groups left aligned | Both primary designs center content-shaped groups | Preserve balance when differently sized materials share a passage |
| Studio header entirely transparent | Bounded tinted translucent header, solid fallback | Maintain readability while the world continues beneath |
| Tools renamed Instruments | Tools and MCP servers | Use the developer's actual language |
| New Studio grid squeezed long native tool names | Single-column tool instruments with separate names/subtool text | Keep the actual available/observed identities readable |
| Demo always loaded an invented conversation | Optional local preview references a real already-imported recording | Validate actual capture capabilities without distributing private journals |

## Local preview, not a public real-session fixture

Open an imported native recording, then More → Use this session as local preview. The browser stores only its recording ID. More → Open local preview uses `?demo=local`, authenticates to the daemon, and opens that recording through the usual data source. Home exposes the selected real recording too. No native journal is copied, configuration changed, or recording exported. A missing/deleted reference goes to the session chooser; absent daemon/auth requires the normal launch flow rather than substituting a synthetic conversation. The synthetic sample remains explicitly named and opt-in, useful for reproducible tests but never proof that a real session exposed the same reasoning/tool/file evidence.

## Validation and acceptance

Local checks only: 317 unit tests and both TypeScript checks passed; production build and isolated offline packaging (Claude/Codex imports, authenticated API, persisted restart) passed. Full browser run passed 81 regular checks with one outdated Classic color assertion; that expectation was corrected and passed on rerun. Additional final-code checks cover Studio Git/native/aspect-ratio journeys: 85 distinct regular browser checks pass across full and focused runs, two opt-ins (real-session and ten-minute reading) were not run this pass. A repeat Git test initially assumed fresh daemon consent; it now correctly handles consent retained from the first design. No product permissions were weakened. Existing Git/changes tests cover staged/worktree content, separate consent, redaction, exact-content review marks, stale invalidation and handoff. New journeys cover both designs, complete long previews/hover geometry, Working set → captured patch, explorer selection, and real local preview/missing-reference recovery. Synthetic native transport tests are distinct from actual account/version/platform acceptance. The builder's visual preference is not certified by automated passes.

Remaining developer-product work from 41/46: continuous review trail and unresolved decisions/bookmarks; curated historical evidence handoff; resolvable diagnostic-to-source links and semantic navigation; native Claude/Codex real account/approval/attachment/reconnect/compaction acceptance; physical low-resource/platform/multi-agent and assistive-technology acceptance. Preserve these after any chat/model switch. No hosted CI until completed-product publishing verification.
