# 71 — PicGen-inspired integrated workspace

14 October 2026, local branch `codex/picgen-redesign`, based on the existing
Git handoff candidate. The builder explicitly authorized a local redesign with
the requested installed skills, overriding the missing `emil-design-eng`
requirement for this session. No remote branch or PR is created by this pass.

## Reference and scope

The builder supplied six screenshots from
[PicGen / RonDesignLab](https://dribbble.com/shots/26824576-PicGen-SaaS-Image-Generator-Dashboard).
Their dotted black world, charcoal floating materials, compact utility controls
and Outfit typography are the primary visual reference. Awwwards references
[Lev](https://www.awwwards.com/sites/lev),
[Twain](https://www.awwwards.com/sites/twain) and
[Creative Reference Library](https://www.awwwards.com/sites/creative-reference-library)
were inspected for agent/content/navigation ideas. Their recorded marketing
demonstrations are not evidence about Drishya or its harnesses.

Two generated full-screen references preceded the supplied screenshots. Both
were design inputs, not a replacement application. Private reference and QA
files stay under the local workspace and are excluded from the candidate changes.

## Delivered

- [UI design system](../../apps/ui/DESIGN.md) and `atelier.css` supply a consistent
  active layer across Home, Classic/Studio materials, source/patch readers,
  tools, native composer, Settings, search, current-Git and review dialogs.
- Outfit is locally served with its OFL license; no new runtime dependency or
  network font loading. Semantic material glyphs and the supplied crystal mark
  remain intact. Utility icons share a small purpose-built SVG set.
- Home becomes a session library with an actual recording/following inventory,
  wrapped titles, divider rows, search/filter grouping, compact storage
  disclosure and a usable initial empty state. Existing discovery retry/import/
  watch/selection behavior remains.
- Multiple evidenced agents get named header shortcuts sharing the existing
  compound focus. Families remain explicitly captured relationships in the
  station. Single-agent headers avoid duplication. The visible shortcut is also
  the measured prose origin.
- Static 22 px dots, neutral rounded materials, flat tool rows, quieter map
  edges and matched 15 px prompt/prose reading replace competing texture,
  colour and chrome choices. Jet/Midnight/Paper identities stay persisted.
  Low-resource mode removes the dot field; motion preferences still gate cues.
- Real-browser review exposed prompt navigation behind the fixed header. Prompt
  anchors and selected actions now measure overlapping controls and align to
  the readable viewport. The regression assertion checks actual visible prompt
  clearance. A compacted station keeps the native Test instrument visible for
  its measured tether at laptop height.

No capture, schema, controller policy, native configuration, repository content
or current-Git behavior is changed. Prose stays unboxed and each captured string
retains its existing provenance. Reference data and artwork are not imported.

## Validation

Local Windows Node 24.11.1. Browser review covers desktop, laptop, narrow and
short aspect ratios, all three palettes, session library, map and settings.
Outfit loads successfully; reviewed 1440/390 px pages have zero horizontal
document overflow and no page errors. Visual QA uses explicitly synthetic
sessions. Real native-account and human/physical/platform acceptance are not
part of this pass.

Both typechecks and 364 unit tests pass. The initial sandbox-only backend checks
could not resolve installed dependency types/worker files; the same commands
pass with full read access. Existing browser assertions for old colours, blur
and Home wording were deliberately updated; reader, origin, keyboard, privacy,
native and history invariants remain asserted. Final browser/package outcomes
are recorded in STATUS after completion.
