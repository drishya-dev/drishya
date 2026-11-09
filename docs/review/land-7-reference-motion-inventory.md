# Drishya landing page — complete motion specification and execution plan

LAND-7 supplies the reference evidence below. LAND-8 supplies the selected design and execution contract. Harsh’s 9 November feedback sets a lighter branded entry, a hero about following agent work, three compact content sections and an ASCII closing area. TASKS and STATUS track implementation and review.

> **For implementers:** use `executing-plans` or the builder's explicitly chosen execution method. Claim one TASKS item before work, open its draft PR after its first implementation commit, complete that whole item's acceptance, then request Yash's review. Do not merge or publish automatically.

**Goal:** explain Drishya immediately, introduce its identity memorably, and let visitors inspect authentic recorded work through a calm, original motion system.

**Architecture:** preserve the static generator and isolated synthetic replay. Use deterministic SVG geometry, one shared event-driven motion runtime and one sample controller; DOM owns every readable character. Existing #380/#381 behavior is the baseline, not a second implementation to recreate.

**Stack:** the repository's existing Node 24, TypeScript, Vite, DOM/SVG/CSS, WAAPI and Playwright tooling. No new animation dependency, Webflow export, downloaded reference media or new home-page WebGL context.

**Reading order:** [reference inventory](#inventory) → [selected features](#selected-features-and-ownership) → [page and copy contract](#page-flow-and-exact-copy) → [motion states](#shared-motion-policy-and-runtime) → [choreography](#scene-choreography) → [execution PRs](#execution-plan-and-pr-boundaries) → [verification](#acceptance-and-verification).

Reference: [Superconscious live site](https://superconscious-app.webflow.io/) and the previously supplied [Outcrowd presentation](https://dribbble.com/shots/27239697-Superconscious-AI-Powered-Self-Growth-App).

## Method and evidence

Fresh page load/reloads; successive browser scrolls through hero, logo, large-word explanation, paragraph explanation, process scene, live feature grid, individual/business stack, name artwork, closing CTA and footer; waitlist modal opened and closed without submitting data. The introductory animation's original frames were inspected at frames 20, 60, 100 and 130, including its intermediate logo/letter composition.

Inspected public HTML, inline scripts, CSS, particle script, opening/logo Lottie data and the site's Webflow interaction configuration. Parsed JavaScript literals with the TypeScript AST without executing downloaded scripts. Retained source captures and frames only under ignored `.local/landing-reference/`. No reference asset or implementation is added to the product.

Applied REA's installed investigation instructions; its MCP tools remain unconnected, so the actual mechanisms used were browser observation and public-source inspection. No REA engine execution is claimed.

Reference HTML SHA-256: `97748aba34bd2a1cdf505e956d0ff4e8628d3c85866f6acf29bd1e1b654228ef`. It matches the previous saved version, but this pass examined substantially more of its animation system.

Evidence keys: **B** browser-observed; **A** original animation frames inspected; **S** confirmed in served source/configuration. Source-only effects are marked explicitly. Framework capabilities without a page instance are excluded.

## Inventory

| # | Area | Effect and trigger | Evidence |
|---|---|---|---|
| 01 | Opening | A small circular seed appears before the wordmark. | A: opening frame 20 |
| 02 | Opening | The circular motif becomes the multi-ring logo at the centre of the identity composition. | A: intermediate opening frames |
| 03 | Opening | Letter shapes arrive as a wave of displaced/rotated fragments with purple accents around the logo. | A: frame 60 |
| 04 | Opening | Fragments settle into the complete product name, then the overlay fades to the actual hero. | A: frames 100/130; B: reload handoff; S: preloader handler |
| 05 | Hero | A dimensional phone and illuminated mesh/object scene moves continuously. | B; S: desktop MP4 plus a separate responsive hero MP4 |
| 06 | Ambient | Two layers of small particles drift at different speeds and sizes. | B; S: custom `ParticleCanvas`/`Particle` classes |
| 07 | Ambient | Particle layers ease to pointer-dependent parallax offsets. | S: mousemove and per-layer strengths; no separate pointer-hover recording claimed |
| 08 | Headlines | Characters arrive from the right with blur, scale and stagger. | S: `from-right-blur` preset; B: process/name headings |
| 09 | Supporting text | Lines rise into place and sharpen with a stagger. | S: `from-down-blur`; B: supporting/feature copy |
| 10 | Navigation | The compact floating navigation stays in view; its brand mark rotates with whole-page scrolling. | B; S: `All | Nav Logo Rotate`, 0→720 degrees |
| 11 | Logo passage | Separate large circles converge into the central multi-ring mark as scrolling advances. | B; S: `Home | Logo Scroll` and circle Lottie |
| 12 | Logo passage | The resolved motif enlarges/rotates while a soft background halo changes opacity. | B; S: scale to 1.4, rotation to 360 degrees and halo opacity keyframes |
| 13 | Simple explanation | The short product-benefit phrase occupies a pinned viewport rather than scrolling away immediately. | B; S: `initAboutAnimation` pin |
| 14 | Simple explanation | Earlier words drift left/up, fade and blur while later words remain nearer and sharp. | B; S: separate scrubbed lateral/upward target groups |
| 15 | Simple explanation | Small animated icon pills expand within the large typography. | B; S: looping `about-lottie` and `about-tag` width/height/margin reveal |
| 16 | Paragraph explanation | The longer explanation resolves from blurred/low-emphasis words into readable lines as the visitor scrolls. | B; S: `about-pg` line grouping and scrubbed word properties |
| 17 | Process scene | The huge background headline moves through the scene at a different scroll rate. | B; S: `Home | How Work Scroll` |
| 18 | Process scene | Foreground mini-widgets and step cards travel at different depths/speeds; a decorative star rotates. | B; S: independent `hw-position` transforms and star rotation |
| 19 | Viewport arrivals | Widget groups grow from the centre or rise from below; their children enter in sequence. | B; S: `view-item` CSS and 100 ms per-child observer stagger |
| 20 | Live illustrations | Gauges, result digits, chart curves/bars, orbit-like rings and journal/AI panels animate repeatedly inside feature illustrations. | B; S: 15 looping Lottie placements using 12 distinct looping assets |
| 21 | Card lighting | A rotating gradient produces moving edge illumination around masked cards. | S: `.card-gradient-point`, 12-second linear `rotate360`; not every instance separately recorded |
| 22 | Product stack | The foreground product card moves upward while the next card grows from 0.8 scale and fades from 0.28 opacity to full emphasis. | B: individual → business transition; S: `Home | Stactk Scroll` |
| 23 | Brand interlude | A moving volumetric ribbon/gradient field sits behind the oversized brand name. | B; S: the third MP4 is inside `name-bg-wrapper`, not the footer |
| 24 | Brand interlude | A repeating horizontal wordmark track runs on a 40-second cycle. | S only: `Home | Name Headline` is configured for the `tiny` breakpoint; not a verified desktop effect |
| 25 | Link hover | Original letters roll upward while a second letter set rolls in, with blur and stagger. | S: `text-hover-trigger` timelines; hover playback not separately captured |
| 26 | Button/widget hover | Pointer entry gives buttons/widgets a velocity-dependent nudge and small returning tilt. | S: InertiaPlugin handlers for buttons and process elements; not a magnetic hit target |
| 27 | Modal entrance | The waitlist scene fades in; the form/close action expand and three surrounding rings grow with delays. | B; S: `All | Form Open`, exponential ease and 200/400/600 ms ring delays |
| 28 | Modal exit | The form, close action and rings shrink/fade, then the overlay is removed. | B; S: `All | Form Close` |
| 29 | Compact navigation | The menu icon morphs through a Lottie and shrinks on open, then returns on close. | S only: navbar open/close action lists; desktop compact menu playback not exercised |
| 30 | Small controls | Footer policy links transition their colour on hover, alongside the richer rolling-label treatment on other links. | S: `.policy-link` colour transition |

These are grouped motion patterns, not thirty unrelated animation engines. The main systems are: entry sequence, ambient media, scroll scrubbing, viewport reveals, looping illustrations, pointer feedback and modal/navigation state transitions.

## Technical findings that change the implementation approach

- **The opening is a dedicated asset.** The `lottie-preloader` plays an image-sequence Lottie at 30 fps with a 133-frame playback range: about 4.43 seconds. The overlay handler starts a one-second fade after a four-second delay. The source also branches on reload, navigation/referrer and per-tab session flags. The name is not simply the hero heading fading in.
- **Several dimensional effects are rendered media.** There are three video elements: two responsive versions of the hero and one animated name-section background. That is not evidence of a real-time interactive WebGL phone/mesh. Drishya can use its own procedural object instead.
- **The live illustrations are separate small animations.** The HTML contains 19 Lottie placements and 15 unique asset URLs: preload/menu/logo variants plus the looping illustrations. They are authored demo graphics, not evidence of live product analytics.
- **The stars are custom canvas particles.** The source defines 150 back and 50 front particles per active canvas, with differing speeds/sizes and pointer parallax. IntersectionObserver creates the canvas on entry and destroys it on exit. It is not the standard particles.js library despite the script filename.
- **The explanation is two scenes.** A short, pinned, very large phrase establishes the benefit; a following paragraph explains it. Both have their own scroll choreography. A static statement plus a demo does not reproduce that sequence.
- **Not every visual is moving.** The footer glow is a background-image treatment. Its appearance alone does not establish a separate glow animation. The generic Webflow lightbox loading spinner is not counted as a used page effect.
- **Responsive branches matter.** The 40-second name marquee is `tiny`-only. No phone-width testing was performed; Drishya's desktop minimum remains 600 px. Do not describe this branch as something observed at desktop width.

## What the current Drishya adaptation is missing

| Part | Current implementation in #380/#381 | Gap to address |
|---|---|---|
| Branded opening | Immediate headline/CTA; no introductory takeover | Original logo → name → page sequence |
| Explain the product | Static statement, then synthetic walkthrough | Short cinematic plain-language scene before detailed features |
| Living illustrations | Finite four-moment replay; faceted object/map scroll pose | Small interactive illustrations tied to real synthetic material |
| Pointer depth | Bounded scroll motion | Pointer-responsive repository/object depth |
| Product showcase | One pinned evidence stage | Distinct layered showcase transitions if they improve the story |
| Hover | Arrow translation, press scale and footer mark rotation | More expressive bounded feedback; rolling text/inertia were not implemented |
| Ambient brand treatment | Quiet black/mint scene | Original motion texture, rather than importing the reference's purple star field |

The earlier implementation intentionally omitted a preloader under LAND-4's initial contract. Harsh's 9 November correction changes that landing-page direction. The previous two implementation PRs should be described as a partial original adaptation, not a recreation of the reference's complete motion system.

## Selected features and ownership

All thirty patterns receive a concrete retain/adapt decision. Continuous decorative loops become scroll/pointer-driven or finite interactions; an explicitly played sample can repeat only while visible and with Pause available. The reference's small-screen marquee becomes a desktop brand passage. These decisions preserve the repository's calm-at-rest/evidence doctrine while implementing the requested motion vocabulary.

| Ref | Selected Drishya feature | Exact adaptation | Whole TASKS item |
|---|---|---|---|
| 01 | Opening seed | One aperture-centre outline, 120 ms arrival. | LAND-9 |
| 02 | Logo assembly | Original 192-facet aperture resolves over 440 ms; no borrowed rings. | LAND-9 |
| 03 | Opening | A lighter, spaced `Drishya` wordmark rises in a short stagger synchronized with the aperture. | LAND-9 |
| 04 | Name → page handoff | The same real mark travels to its hero allocation; overlay fades and is removed. | LAND-9 |
| 05 | Dimensional hero | A finite aperture-to-repository cue leads to the real synthetic product preview. The recording plays on request. | LAND-11 / LAND-15 |
| 06 | Layered ambient field | Two SVG repository-node depth layers; at most 24 decorative nodes, seeded deterministically. | LAND-11 |
| 07 | Pointer parallax | Front layer ±6/4 px, back ±3/2 px; mark yaw ±4°, pitch ±2.5°. | LAND-11 |
| 08 | Character reveal | Brand letters only; marketing headings use whole-line arrivals. Code/prose recorded from an agent stays whole. | LAND-9 / LAND-10 |
| 09 | Line reveal | Whole marketing lines rise 12 px and resolve up to 4 px blur over 420 ms. | LAND-10 |
| 10 | Floating nav and mark rotation | Retain compact header; mark rotates at most 36° across page progress, not continuous spinning. | LAND-13 |
| 11 | Emblem morph | The hero aperture resolves into an outline and evidenced repository nodes in one finite arrival. | LAND-11 |
| 12 | Scale, rotation, edge | The hero mark turns at most 18° and settles from scale 0.94 to 1. Fine-pointer depth stays bounded. | LAND-11 |
| 13 | Plain-language explanation | Two readable phrases introduce one compact walkthrough in normal flow. | LAND-10 / LAND-11 |
| 14 | Phrase depth | The phrases stay sharp while one decorative stroke marks their connection. | LAND-10 |
| 15 | Inline living emblems | Original read/run/edit SVGs animate inside fixed-size slots; text never reflows around growing boxes. | LAND-10 |
| 16 | Paragraph emphasis | The paragraph stays readable. The file, command and diff emblems receive one finite emphasis. | LAND-10 |
| 17 | Background heading depth | The heading stays stationary. Depth belongs to the sample’s decorative geometry. | LAND-11 |
| 18 | Layered process elements | File/terminal/diff/result illustrations share sample state; decorations move ≤24 px in depth. | LAND-11 |
| 19 | Staggered arrivals | Sample illustrations arrive at 80 ms offsets, 360 ms each. Showcase selection has one finite 200 ms card arrival. | LAND-11 / LAND-12 |
| 20 | Living widgets | Exact synthetic read/failure/edit/retest material; shared finite playback, explicit optional repeat, no invented gauges. | LAND-11 |
| 21 | Edge illumination | A 1 px mint edge trace travels once in 720 ms on pointer hover; keyboard focus gets the immediate final contour. | LAND-12 |
| 22 | Product stack | Three floating controls show captured snippets on hover and focus. Explicit selection opens the full evidence in one panel. | LAND-12 |
| 23 | Brand backdrop | An ASCII repository tree beside the closing action echoes the source, command and edit relationship. | LAND-16 |
| 24 | Wordmark | A quiet wordmark anchors the ASCII close. A single connector emphasis supplies the arrival. | LAND-16 |
| 25 | Rolling hover labels | Whole labels move ≤4 px; one text copy, optional arrow motion. No duplicated captured characters or letter clones. | LAND-13 |
| 26 | Inertial hover | Decorative icon/edge only: ≤3 px and ≤1.5°, returning in 180 ms. Button hit areas never move. | LAND-13 |
| 27 | Modal entrance | “About this sample” dialog with 260 ms panel arrival and three restrained decorative contours. | LAND-13 |
| 28 | Modal exit | 160 ms paired close; Escape/outside click work immediately and interrupted close can reopen. | LAND-13 |
| 29 | Compact menu morph | Two-line CSS/SVG menu icon, 160 ms reversible open/close at supported compact desktop widths. | LAND-13 |
| 30 | Small-control feedback | Explicit 120 ms colour/border changes; focus immediate; press scale 0.98 for pointer activation. | LAND-13 |

LAND-14 verifies the combined experience. None of these items changes the local application's UI, capture, controller, storage or schema.

## Page flow and exact copy

### Home order and jobs

1. **Opening overlay** on the first eligible Home visit. The aperture and wordmark resolve and hold for entry.
2. **Hero**, `#main`. The left states the product’s purpose. The right shows the aperture-to-evidence cue and product recording.
3. **Walkthrough**, `#how-it-works`. A brief explanation leads into one reader with `#live-sample` and `#session` anchors and four direct moment controls.
4. **Product showcase**, `#workspace`. The third content section after the hero and walkthrough. Three floating cards let visitors preview and select examples.
5. **Close**, `#local`. The local-by-design explanation, ASCII artwork and closing actions sit together above the utility footer.

All content sections use normal document flow. At 1440×900 target Home height ≤3600 CSS px, with the showcase ≤900 CSS px. Measure document scroll height and showcase height against the same browser and baseline with the opening dismissed and fonts ready. Record the actual change. Direct anchors reach the content.

| Surface | Exact selected copy / action |
|---|---|
| Opening name | `Drishya` |
| Opening descriptor | `See the work behind every change.` |
| Hero H1 | `Follow your agent’s work.` |
| Hero body | `See the source it read, the command that failed, and the edit it recorded.` |
| Hero primary | `Try the demo` → `/#session` |
| Hero secondary | `Get Drishya` → `/get-started/` |
| Hero facts | `Claude Code + Codex` · `Local by design` |
| Hero preview | `Watch 12-second demo` · `Recorded in Drishya · Synthetic sample` |
| Explanation phrase A | `Your agent writes code.` |
| Explanation phrase B | `Drishya shows the work.` |
| Explanation support | `Watch the files it reads, commands it runs, and changes it makes.` |
| Explanation paragraph | `Keep your agent’s work in view as it happens. Open the source it read, inspect the output it received, and review the edit it recorded. Return to any captured moment without losing the context of your repository.` |
| Living sample heading | `From a read to a recorded change.` |
| Living sample label | `Interactive sample · synthetic recording` |
| Walkthrough heading | `Follow one checkout fix.` with the existing four chapter titles. |
| Showcase heading | `Read the work where it happened.` |
| Showcase choices | `Watch live` · `Inspect a file` · `Review changes` |
| Local message | `Your sessions stay on your machine.` within the closing section. |
| Closing heading | `See your next agent session in Drishya.` |
| Preview availability | Keep the manifest-driven statement that Drishya is in development and local checkout access is limited. |
| Sample details | `About this sample` |
| Opening controls | `Enter Drishya` · `Skip intro` · `Replay intro` |
| Site preference | `Motion` with `Auto`, `Reduced`, `Off` |

The hero descriptor appears before feature jargon. “Live” describes the product's supported local capability; the public example always says synthetic sample. No wording implies that the hosted site has discovered or connected to the visitor's agents.

### Routes and system connection

| Route | Connection / behavior | Motion boundary |
|---|---|---|
| `/` | Static public landing built from committed synthetic content. | Full selected composition, subject to policy. |
| `/#how-it-works` | Native explanation anchor. | Bypass intro, scroll natively, focus heading without another jump. |
| `/#live-sample` / `/#session` | Native anchors for the same walkthrough reader. | Bypass intro. Ordinary scroll preserves the selected chapter. |
| `/?moment=read|failure|edit|retest#session` | Explicit chapter bookmark. | Restore manual ownership; no scroll override. |
| `/#workspace` / `/#local` | Existing capability/privacy anchors. | Bypass intro; preserve direct navigation. |
| `/demo/?demo&at=4|24|26|28` | Existing isolated public replay of the fixed bundle. | No opening or new showcase runtime; retain existing replay controls. Append `&motion=0` when the landing preference is static. |
| `/get-started/` | Manifest-driven preview/setup information for an authorized checkout. Preserve `#requirements`, `#first-session`, `#troubleshooting`. | One 180 ms whole-heading entrance at most; no pinning or intro. Commands remain immediately copyable. |
| `/privacy/` | Existing honest local storage, redaction, export and native-control explanation. | Static diagram by default; optional one 240 ms decorative relationship arrival. No moving body paragraphs. |
| `/releases/` | `apps/landing/release.json` is authoritative; current state is `preview`, `sourceUrl: null`, `releases: []`. | No invented downloads or empty buttons. At most 180 ms whole-surface arrival. |
| `/404.html` / unknown path | Existing real 404 with Home/demo actions and correct response status. | No intro, spinner or repeated logo loop. |

The public site makes only same-origin static requests. It does not probe localhost daemons, request a token, import journals, resume a harness or open an arbitrary workspace. Local product use begins through the existing setup instructions and the actual launch URL printed by the local daemon. Keep the public replay's hostile-query stripping, CSP and same-origin read-only fetch boundary intact.

## Visual and layout contract

| Role | Value / rule |
|---|---|
| Ground | `#000000`; body, header and transitions share it. |
| Elevated material | `#111615`; secondary neutral `#191C20`; no large glow pools. |
| Primary text / muted | `#F4F6F8` / `#ADB5BF`; paper copy uses its existing darker roles. |
| Accent / hairline | `#92D6C3` / `#33383D`; hairlines 1 px. |
| Evidence status | Existing failure `#F49C9C`, pass `#A8DFBF`, edited `#D6BB88`. Do not use success colour to imply unrecorded coverage. |
| Paper fields | Existing `#F4F5F3` privacy/local sections remain intentional contrast. |
| Type | Locally bundled Inter + JetBrains Mono only; no new font request. |
| Hero H1 | `clamp(52px, 5.7vw, 84px)`, line-height 1.02, tracking −0.065 em. Fit to two lines from 1200 px and up to three below that. |
| Explanation display | `clamp(40px, 5.5vw, 80px)`, line-height 1.08; two short phrase blocks. |
| Main body | 16–17 px / 1.6; reading measure ≤65 ch. |
| Captured material | At least 14 px / 1.65; local horizontal/vertical scrolling, selectable text. |
| Metadata | 12 px minimum; controls retain visible labels or accessible names. |
| Content width | Existing 1200 px maximum; compact side margins 24–32 px. Documentation measure ≤760 px. |
| Header | 72 px allocation; 56 px inner pill, 8 px top/bottom allowance. Native anchor inset 96 px. |
| Reading stage | Top inset 104 px; at least 24 px bottom clearance. Stage chrome reserves 132 px; material uses the remaining bounded height. |
| Shape | Existing squared 3–6 px corners, flat surfaces and meaningful syntax. No pill around every paragraph. |
| Assets | Original aperture geometry and original SVG emblems; existing licensed brand/fonts; committed synthetic material. |

At 600–999 px, use compact selectors and normal document flow. At 1440/1920, retain a deliberate reading measure. Use the same content order in short windows. Supported desktop widths start at 600 px.

Static artwork must look finished before motion is enabled. Text never goes into WebGL. A browser snapshot at any paused point must retain a clear active phrase, readable material and visible controls.

## Shared motion policy and runtime

### Policy and precedence

Inputs: viewport width/height, fine-pointer capability, `prefers-reduced-motion`, `navigator.connection.saveData` when available, `document.hidden`, per-tab user mode, `?motion=0`, and a low-resource hint. Low-resource means reported device memory ≤2 GB or hardware concurrency ≤2; absent hints do not become a failure and no hint is persisted or transmitted.

1. `?motion=0` or user `Off`: no timed decoration, intro, pointer depth or pinning.
2. OS reduced motion or Save Data: the same static behavior; a user setting cannot force these off.
3. Low-resource hint or user `Reduced`: normal flow, static object and instantaneous material swaps; colour/border transitions may last at most 120 ms.
4. Otherwise `Auto` enables finite effects. Fine-pointer depth applies only to visible hero artwork. Home uses normal flow.
5. A hidden tab cancels timed decoration and queued frames, pauses playback and preserves layout and scroll position.

Reduced/off modes keep native navigation, selection, Copy commands and explicit replay available. A user can play the recorded sequence with instant material swaps. Changing policy pauses any currently playing sample; returning to Auto or to a visible tab does not restart it.

The Motion control lives in the footer and compact navigation's utility group, not as another large hero action. Store only `auto|reduced|off` in `sessionStorage` under `drishya.landing.motion.v1`; catch storage denial and use Auto. No localStorage identifier, telemetry or cross-tab identity.

### Timing tokens

| Token | Value | Use |
|---|---|---|
| `instant` | 0 ms | Keyboard navigation, source selection, off-mode state change. |
| `feedback` | 120 ms | Colour/border changes. |
| `hover` | 160 ms | Arrow/label response. |
| `return` | 180 ms | Pointer-depth return, small whole-heading arrival. |
| `close` | 160 ms | Dialog/menu close. |
| `surface` | 260 ms | Dialog entrance. |
| `arrive` | 360–420 ms | Whole illustration/marketing-line entrance. |
| `edge` | 720 ms | Single edge trace. |
| `ease-out` | `cubic-bezier(.22,1,.36,1)` | Arrivals and returns. |
| `ease-morph` | `cubic-bezier(.76,0,.24,1)` | Deliberate mark handoff. |
| `ease-standard` | `cubic-bezier(.2,0,.2,1)` | Continuous relationship changes. |

Scroll-scrubbed properties derive directly from clamped absolute progress, without accumulated deltas or an easing clock that lags behind the user's reading. Timed transitions always cancel/reverse from their current visual state. Do not use `transition: all` or permanently apply `will-change`.

### Runtime ownership

One runtime owns preference listeners, visibility/page lifecycle and a keyed invalidation queue. At most one animation frame is queued for all landing scroll/pointer clients. No self-scheduling frame runs while the page is at rest. An explicitly playing/repeating sample may keep one transport timer; decorations do not create separate clocks.

```ts
export type MotionMode = 'auto' | 'reduced' | 'off';
export interface MotionInputs {
  width: number;
  height: number;
  finePointer: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  lowResource: boolean;
  hidden: boolean;
  queryOff: boolean;
  userMode: MotionMode;
}
export interface MotionPolicy {
  animate: boolean;
  pin: boolean;
  pointer: boolean;
  intro: boolean;
  static: boolean;
  reason: 'full' | 'query-off' | 'user-off' | 'system-reduced' | 'save-data' | 'low-resource' | 'user-reduced' | 'hidden' | 'invalid-viewport';
}
export interface MotionRuntime {
  policy(): MotionPolicy;
  subscribe(listener: (policy: MotionPolicy) => void): () => void;
  invalidate(key: string, render: () => void): void;
  animate(owner: Element, frames: Keyframe[], options: KeyframeAnimationOptions): Animation | null;
  cancel(owner: Element): void;
  dispose(): void;
}
```

`resolveMotionPolicy(input: MotionInputs): MotionPolicy` is pure and tested. Keep `pin` in the interface for compatibility and return false for the landing page. While hidden, `animate`, `pointer` and `intro` are false. `createMotionRuntime()` is browser-only. Build-time markup imports stay safe in Node.

Invalid/non-positive viewport dimensions fail to the static policy with `invalid-viewport`. For scene projection functions, negative progress clamps to 0, progress above 1 clamps to 1, and non-finite progress returns the finished readable state. Keyboard navigation, selection, menu and dialog state changes are immediate; explicitly choosing Play/Replay is permission to view the requested timed content under the current policy.

Every owner unregisters observers/listeners on dispose. `pagehide` cancels owned WAAPI/CSS work and sample timers. On `pageshow`, remeasure and restore policy; do not replay entrance effects. Keep the existing `motionAllowed()` export as a compatibility wrapper until all callers use the runtime. Menu, chapter, tether and new effects must use the same policy.

Motion preference changes settle active transitions in place. Normal flow preserves the reading anchor and focused control.

## Scene choreography

### 1. Branded entry

Use a single jet-black field. Centre the aperture above the wordmark and tagline. Set the bundled Inter wordmark at weight 350, tracking 0.05 em, line-height 1.05 and size `clamp(56px, 8vw, 104px)`. Use 18–22 px Inter at weight 400 for the tagline. Reserve 24 px below the wordmark and 28 px above the controls. Keep the letters flat and sharp and let the aperture carry the depth.

Eligibility is Home only, no hash or moment, no return/BFCache visit, a visible viewport of at least 600×650, usable mark geometry and normal motion policy. Mark the visit when the controller opens. Storage denial skips automatic presentation. Replay uses the same controls. Use a Home-only external boot guard ≤2 KiB raw and preserve CSP. The server-rendered default is the usable hero. If initialization, fonts or geometry cannot be established in 300 ms, reveal Home. Keep the independent 2400 ms bootstrap fuse until the interactive overlay is ready.

| Time from reveal | Choreography |
|---|---|
| 0–120 ms | The outline arrives. Opacity 0→1, scale 0.85→1. |
| 120–520 ms | Original facets settle inward by at most 20 px. The final pose matches the hero mark. |
| 300–788 ms | Letter i starts at `300 + i×18` ms and rises 8 px over 380 ms with `ease-out` and opacity 0→1. Seven spans have one accessible name. |
| 520–840 ms | `See the work behind every change.` rises 6 px as a whole line over 320 ms. |
| After 840 ms | The identity holds still. Enter and Skip are available from the first interactive frame. |

Keep manual entry from the opening stack. Enter or deliberate downward wheel input begins the handoff. An upward wheel can reverse a wheel-initiated handoff before completion. Enter, Skip and Escape override it. Let native scroll proceed. Use the same measured SVG for a 520 ms handoff and fade the tagline and overlay over its first 240 ms. Use a 160 ms fade for an offscreen destination. Skip and Escape reveal Home within 80 ms.

The navbar and page controls are out of pointer and keyboard reach while the overlay is active. Mount the accessible dialog once its controls work and restore the page on all exits. Focus Enter on Replay. If a focused intro control closes, focus the hero heading without scrolling. Direct links, static modes, script failure and repeat visits show the header on arrival. Reuse Enter and Skip for Replay. Hidden tab, an ineligible resize or a switch to static completes the exit.

`introFrame(elapsedMs: number): IntroFrame` projects reveal stage, seed opacity, assembly, seven letter progress values and descriptor progress. Stages are `seed` below 120 ms, `assemble` to 300 ms, `name` to 840 ms and `hold` thereafter. Negative time clamps to zero and non-finite time returns the settled identity. Handoff time starts on the visitor’s action. Test 0, 120, 300, 520, 788 and 840 ms, invalid input and early entry.

### 2. Hero, repository depth and product recording

Use a two-column hero at ≥1000 px. Give the left headline the larger typographic weight. Fit it to two lines at ≥1200 px and up to three at narrower supported widths. Keep both links and the right preview visible at 1440×900. At 600–999 px place the visual after the copy.

The right tells the same story as the left. The aperture settles over 420 ms, turning ≤18° and scaling 0.94→1. A 280 ms relationship cue then leads from the resolved mark to the poster’s edge. Use the mapped fixture node when naming a source. Run once after entry or when the hero is first visibly ready on a visit without the overlay. Static and interrupted states show the settled frame. Keep the hero and poster in normal flow.

Pointer depth runs only while the hero is visible and the pointer is inside the artwork region. Normalized x/y clamp to [−1,1]; front nodes shift ±6/4 px, rear ±3/2 px; mark yaw/pitch add ±4°/±2.5°. Ignore movement below a 2 px dead zone. Exit returns to neutral over 180 ms. Pointer movement never changes sample chapter, detaches a reader, or moves text/hit areas. At most 24 decorative nodes; actual named file nodes come only from fixture graph evidence.

**Product preview.** Show a 16:9 poster from the actual Drishya replay under the SVG, in the former terminal slot. Keep the same allocation for the poster, video and error state. At 600–999 px the preview follows the hero copy in normal flow. Keep the two hero CTAs above the preview in reading order. Use `Recorded in Drishya · Synthetic sample` beside the `Watch 12-second demo` button.

Capture the real public replay interface using the committed synthetic checkout bundle. Frame the map and active material closely enough to read the action at the intended hero size. The poster shows the repository and an open captured file. Record in a clean demo browser context and inspect all four cuts for personal identifiers and local URLs before committing media.

| Clip time | Evidence on screen |
|---|---|
| 0–3 s | Step 4. Show the file opening from its recorded repository node and the captured source. |
| 3–6 s | Step 24. Show the command result with 5 passed and 1 failed. |
| 6–9 s | Step 26. Open the recorded edit and hold the changed lines. |
| 9–12 s | Step 28. Hold the later test result with 6 passed and 0 failed. Use the caption `Later recorded run`. |

Use one same-origin silent MP4 and an optimized WebP poster. Provide the four beats as a concise text description under `About the recording`, accessible with native disclosure. The end frame holds and `Replay preview` starts again on explicit activation. Playback starts only after Play attaches the media source. Keep native pause and playback controls available and a visible `Open interactive demo` link to `/#session` next to the player. A failed request, decode failure or rejected Play restores the poster, shows `The preview couldn’t play. Open the interactive demo instead.`, and offers `Retry preview`. Without script, the poster, description and demo link are usable.

Pause playback when the tab is hidden, on pagehide or when less than 20% of the preview is visible. Returning leaves it paused. Reduced motion, Off and Save Data retain the poster and link with explicit playback available. Landing scroll and sample playback do not drive this media. No new pin or scroll track is allocated to it.

### 3. Explanation inside the walkthrough

Place `Your agent writes code.` and `Drishya shows the work.` above the shared reader at `#how-it-works`. Keep the support line and paragraph sharp and mounted. A simplified aperture outline and three original emblems connect the copy to the read, command and edit examples.

Use fixed 44 px compact and 64 px wide slots. On first visibility in full motion, the inner file, terminal and diff graphics arrive over 320 ms at 80 ms offsets. Text stays still. Reduced, Off and no-script use the settled graphics. Focus or text selection settles active effects immediately.

### 4. Living sample and the detailed walkthrough

The content is the existing committed synthetic checkout investigation. `resolveChapters()` remains authoritative; never replace its observations with invented terminal text.

| Chapter | Replay step | Material / status | Presentation |
|---|---|---|---|
| read | 4 | Exact source and captured lines 1–14. | File emblem relates to the actual mapped file node; full supplied text remains mounted and scrollable. No scanning/highlighting one line at a time. |
| failure | 24 | Recorded command/output, 5 passed / 1 failed. | Tool instrument emits the complete result; red is confined to the recorded failure state. |
| edit | 26 | Recorded reconstructed hunk. | Whole real hunk arrives ≤12 px from its evidence-backed map/tool origin; additions/removals remain static semantic colour. |
| retest | 28 | Later run, 6 passed / 0 failed. | Outcome lands once. Caption retains that later does not itself prove coverage. |

One controller owns the four moments and one material reader. Put the selectors beside the reader at ≥1000 px and above it at 600–999 px. Keep a single transport. The LAND-15 recording has its own explicit video controls.

Each selector shows its exact moment label and a semantic icon. Keep `Open recorded moment` as a separate native link for the selected chapter. Use a fixed material allocation with local overflow for long evidence.

Controls are `Play sample`, `Pause sample`, `Replay sample`, optional `Repeat sample` (off initially), and the Moment range or previous/next controls. Show the current chapter and step.

The reader is visible for playback when at least 20% of its surface and 50% of the transport are visible. One observer coordinator owns that result. If the control bar leaves view, pause playback.

Default cycle: read 0–1600 ms; failure 1600–3800; edit 3800–6400; retest 6400–8200; then stop and hold retest. Explicit repeat adds a 1200 ms settled hold before a new cycle. It must never enable itself. Offscreen (<20% intersection of every sample surface), hidden, Escape, resize, policy change, selection, range/keyboard action or reading focus pauses playback and requires explicit Play to resume. No catch-up of missed chapters on return.

Pause holds the selected chapter and clears its timer. A subsequent Play starts that chapter's full dwell again; it does not replay missed time. At the completed retest, Replay starts at read. Repeat is memory-only and resets off on a new document. The injected clock contract is `SampleClock { set(callback: () => void, delayMs: number): unknown; clear(handle: unknown): void }`; tests advance it without real sleeps.

Ownership is `manual` or `playback`. Start in manual on the first chapter or valid bookmarked moment. Deliberate selection pauses playback. Document scroll and pointer movement preserve the selection. Unknown moment falls back to read.

Explicit selections replace `moment` and retain the active `#session` or `#live-sample` anchor. Both point into the same reader. Full replay links stay `/demo/?demo&at=4|24|26|28`, with static preference propagated.

If `mapped` or path evidence is absent, use the tool origin with `Location not recorded`. Show temporal order as recorded order. A chapter change mounts the whole material, with at most one 190 ms translation for pointer and playback. Keyboard, range and restored states apply immediately.

Metadata failure keeps the server-rendered first chapter and all four native replay links. Show playback when data is valid. Validate the four ordered keys, increasing positive steps and bounded strings from `chapters.json`. Reuse the escaped renderer. Retry is explicit.

Public validation bounds are 512 KiB for the metadata response and 65,536 UTF-16 code units per chapter text. The current fixed fixture fits well below them. Reject reordered/missing/duplicate keys, non-integer steps, invalid material/provenance types and unsafe paths; retain the SSR fallback. This is a public-sample validator, not a new real-journal import limit. Keep existing `Chapter` fields, including `operationId`, `short`, `description`, `mapped` and the exact source strings, in the shared model.

### 5. Selectable showcase, edge trace and brand passage

Replace the three `.editorial-row` examples within `#workspace` with one showcase in normal document flow. Keep `Read the work where it happened.` and `Go from watching the agent to understanding the code.` Group three exposed card edges above a single reading stage. Each edge stays visible and names the capability. Watch live is selected on a fresh visit. Native scrolling moves past the section and leaves the selection in place.

| Choice | Panel content | Action |
|---|---|---|
| Watch live | Existing short synthetic timeline of read, failed test and edit. Label it `Synthetic sample` and keep the illustrative-arrangement caption. | `Open your first session` → `/get-started/#first-session` |
| Inspect a file | Captured source, lines 1–14, with the original file path and provenance. Keep the distinction between captured source and the current file. | `Inspect captured source` → `/demo/?demo&at=4` |
| Review changes | Recorded edit with reconstructed hunk and the later test result. Keep the separate opt-in current Git explanation and the later-run scope caption. | `Review the recorded edit` → `/demo/?demo&at=26` |

Use one server-rendered article per choice and reuse the existing evidence renderer. Use a labelled native radio group (`Explore product examples`) styled as the three card edges. Radio state selects the visible article with CSS, so selection works if JavaScript fails. The checked edge has a visible foreground border and the focused edge has an independent focus ring. Native arrows select, Tab reaches the visible reader and link, and hidden articles do not receive focus. Keep the `#workspace` anchor and the shared static-motion link policy for replay destinations.

At ≥1000 px put the selected explanation beside its evidence, with the controls across the top. At 600–999 px put explanation and action above the evidence and allow the three labels to wrap. The stage has the same height across choices at each supported viewport. Use a bounded material scroller, at least 14 px type, and internal horizontal scroll for long lines. Keep the card labels and action outside the material scroller. At 1440×900 target a `#workspace` section at most 900 CSS px tall, including heading and padding. Record before/after section heights on the same browser, baseline and viewport. There is no pinned showcase track.

Switch the selection immediately. For pointer activation in full motion mode, give the selected outer card shell one 200 ms rise from 8 px below its rest position with `ease-standard`. Keep the selected content sharp at its final size. Keyboard and static policy switch immediately. A new selection, focus entering the reader, text selection, hidden tab or policy change cancels the current motion. Style the exposed edges as the rear layers and keep their hit areas fixed. Keep the panel links separate from the radio controls. Hover and scroll never change the selected card or the walkthrough's chapter.

A decorative 1 px edge overlay uses `pointer-events:none`. On pointer hover, one trace completes in 720 ms at ≤0.18 mint alpha, then holds/fades over 120 ms. Leaving early reverses/cancels within 120 ms. Keyboard focus gets the final border immediately. Never animate a gradient around every card at rest. Error contours remain semantically distinct.

Floating cards rise 4 px on fine-pointer hover over 160 ms. Hover or visible keyboard focus reveals a two-line evidence peek in a reserved strip. Keep it sharp at ≥14 px with a path or command label. Watch live shows the recorded failure command and status. Inspect a file shows the first nonblank captured source line. Review changes shows the first nonblank added hunk line. Derive and escape each excerpt from the fixture. When the active reader already displays the same excerpt, show its path or status in the peek. The full selectable material lives in the reader. Pointer leave, blur or Escape clears the peek. Clicking or using the radio keys selects a card. Keyboard and static transitions are immediate.

### 6. Navigation, labels, menus and sample details

Header routes remain Product → `/#workspace`, Demo → `/#session`, Privacy → `/privacy/`, Get Drishya → `/get-started/`. Add a modest `See how it works` native link/cue in hero support leading to `/#how-it-works`. Preserve existing URLs and Back/Forward. Focus a destination heading with `preventScroll` after native anchor navigation; do not focus the sample's controls merely because a section was entered.

Hover: transform only the arrow/inner decorative icon or the single whole label. Arrow x=3 px / 160 ms; label y=−2 px then 0 / 160 ms; optional icon tilt ≤1.5° with a ≤3 px nudge and 180 ms neutral return. Calculate pointer velocity only inside the active target, clamp it, and discard after leave. No global pointer attraction, movable hit area, text clones or residual spring loop. Keyboard activates immediately; focus rings appear without waiting. Press feedback is pointer-only scale 0.98 over 80 ms, returning in 120 ms.

Track press origin explicitly for pointer feedback; an unconditional `:active` transform must not animate keyboard activation. Ignore the first velocity sample on entry rather than inferring a large speed from a stale pointer location.

Compact Menu uses the existing details/native dismissal semantics or an equivalently accessible owner. Closed icon is two lines; open lines rotate ±45° over 160 ms with no scale below 0.9. Close reverses in 160 ms. Escape returns focus to summary, outside click closes, link activation closes and navigates, rapid reversal starts from the current state. Its menu remains within the viewport at 600 px. A menu and sample-details dialog cannot compete for focus: opening the dialog closes the menu first.

Add a small `About this sample` action to the sample toolbar; at compact widths it joins the secondary action group rather than crowding Play. The native dialog contains:

- Heading `About this sample`.
- Text `This is a fixed synthetic recording, served with the website. It does not read your files or connect to your local agents.`
- The four recorded moment names and real replay links.
- A `Read privacy details` link to `/privacy/` and `Run locally` to `/get-started/`.
- Visible `Close` control; no input fields, waitlist, signup, upload or API submission.

Panel width `min(560px, calc(100vw - 48px))`, bounded by `100svh - 48px` with internal content scrolling. Backdrop is solid black at 0.72 opacity, without backdrop blur. Open: opacity 0→1, y 10→0 px, scale 0.96→1 over 260 ms. Three decorative neutral/mint contours expand 0.9→1 at 40 ms offsets, each 240 ms, opacity ≤0.18; no glowing pool. Close: opacity 1→0, y 0→6 px, scale 1→0.98 over 160 ms; contours settle with it. Keep the dialog in the top layer until close finishes; immediate policy/off or Escape cancellation may complete close immediately.

Move focus to heading/first useful control on open; native dialog traps focus. Escape, visible Close and backdrop click dismiss. Restore the invoker with `preventScroll` if still connected; otherwise focus the relevant section heading. Rapid close/reopen cancels the exit and retains correct open/focus state. Closing never activates an underlying link. Scrollable material in the dialog does not scroll the body. Modal state is in-memory and never changes sample playback or opens native permissions.

Backdrop dismissal requires both pointer press and release on the backdrop; dragging a selection from the panel to the outside must not dismiss it.

The timed dialog/menu transitions described above are for pointer activation. Keyboard activation uses the same final geometry/focus rules immediately, without a transform delay. Only explicit Play/Replay actions request timed content from the keyboard.

Footer Motion settings use the same popover/dismissal rules, real radio controls and immediate keyboard changes. Explain when the system preference/Save Data constrains Auto. Replay intro is disabled with a clear short reason when static policy applies; otherwise it is an explicit action. There is no unimplemented Theme/download/waitlist control.

### 7. ASCII closing and footer

Bring the local/privacy message and closing call to action together in one normal-flow section at `#local`. Use `See your next agent session in Drishya.` with `Follow your own sessions locally, or try the synthetic sample first.` Put `Get Drishya` → `/get-started/` and `Open the demo` → `/#session` beside the availability note and privacy link.

```text
repository/
|-- source
|-- commands
`-- recorded edits
```

Set this decorative tree in the bundled mono font. Use one static wordmark and a hairline above the utility footer. The tree is aria-hidden and one connector accent settles over 240 ms on first visibility in full motion. The footer holds Product, Demo, Setup, Privacy, Releases, Motion and Replay intro. Keep native destinations, LAND-13 controls and the license notice. At 600–999 px the tree follows the CTA and the footer wraps naturally.

## Loading, failure, accessibility and lifecycle states

| Condition | Required result |
|---|---|
| No JavaScript / blocked module | Normal static page, real anchors/setup/complete walkthrough; no permanent intro cover. |
| Slow fonts/art readiness | Skip automatic intro after the 300 ms readiness window; use existing font-display fallback; no invisible heading. |
| Invalid intro geometry | Finish to the hero without flight. |
| Intro controller failure | The boot fuse releases at 2400 ms maximum from boot if controls are unavailable. Skip and Escape release the overlay as soon as it is interactive. |
| Chapter fetch blocked/malformed | Existing static material/error explanation and real replay links; no playback controls claiming readiness. |
| Missing decorative asset | Keep the text/actions and original static mark. Original geometry is code-native. |
| Missing poster or preview playback failure | Preserve the player allocation and demo link. Show the static sample label if the poster fails and the explicit retry state if playback fails. |
| Showcase script unavailable | The radio group still selects each article. The chosen evidence and its native action remain readable. |
| Reduced motion, Save Data, low resources | Shared policy and full manual reading. Preview media stays unloaded until explicit Play. |
| Hidden tab / pagehide | Cancel owned animation/timers; preserve layout heights, selection and sample state. |
| BFCache/pageshow | Recompute policy/absolute geometry; restore explicit bookmark; no intro or automatic sample restart. |
| Resize/zoom/reversal | Cancel finite position transitions; remeasure next frame; no accumulating offsets, stale targets or offscreen controls. |
| Focus or text selection | Give reading ownership, finish relevant material transforms and keep selection/copy intact. |
| Clipboard refusal | Keep existing select-and-copy fallback on setup; no dead “Copied” state. |
| Offline public replay failure | Keep the existing honest Retry sample path; no invented local connection. |

Exact failure/status copy: metadata failure — `The interactive sample couldn’t load. Read the recorded walkthrough or open the full replay.`; retry — `Retry sample`; unmapped material — `Location not recorded`; reduced setting explanation — `Your system preference limits site motion.`; Save Data explanation — `Save Data is on. The sample remains available with static transitions.`; completed playback — `Sample complete. Replay it or open the full replay.` Use a polite status only for explicit control outcomes or a single failure announcement, not for passive scroll progress. Existing availability and clipboard-refusal copy remains source-checked in the setup/release generator.

One page H1; proper section H2s; native links/buttons; 2 px visible focus outline with 4 px offset; normal desktop targets ≥32 px, primary controls ≥44 px. Capture state uses text labels as well as colour. No auto-typing, count-up metrics, flashing effects, audio or screen-reader announcements during passive scrolling. Maintain meaningful DOM order even when visuals overlap. At 200% desktop zoom use the equivalent supported CSS width and also record any physical browser-zoom check separately.

## Asset, privacy and performance budgets

Ship original SVG/DOM and the two LAND-15 media assets captured from Drishya’s committed synthetic fixture. Reuse the licensed fonts and brand with their notices. Original runtime dependencies and same-origin boundaries apply to the preview.

Landing copy and selectable evidence stay in the DOM. The preview poster and clip are illustrations of the product, with an equivalent text description and the interactive replay link. The illustrative repository uses SVG/DOM. Runtime work is bounded to ≤192 aperture faces, ≤24 decorative nodes, one shared frame queue and one sample timer. Source changes render at chapter boundaries. Pointer and scroll frames update transforms and geometry.

Release-candidate landing targets, measured on the recorded review machine rather than claimed for every computer:

- Boot script ≤2 KiB uncompressed; total Home JavaScript ≤35 KiB gzip; Home CSS ≤20 KiB gzip; Home HTML ≤180 KiB uncompressed.
- New procedural decorative files ≤60 KiB gzip combined. Initial Home non-font transfer ≤250 KiB gzip; existing font bytes are reported separately and no new font family/weight is loaded.
- LAND-15 poster ≤60 KiB on disk and counted in initial Home transfer. Clip ≤1.5 MiB on disk and fetched only after explicit Play or Retry. Record both sizes and verify zero video requests on initial Home load.
- No `/demo/assets/` JavaScript/CSS before a real full-replay navigation, no daemon/API probe, and no third-party runtime request.
- Event-driven render callback p95 ≤8 ms, typical ≤4 ms over 100 scripted scroll/pointer invalidations at 1440×900. No landing-owned task >50 ms during a ten-second normal scroll/reversal probe. Record the browser, CPU/core/memory summary and actual result; a miss is a performance issue to fix, not a reason to relax the budget silently.
- After finite arrivals/transport are stopped, wait two frame opportunities: zero running landing animations, zero pending landing RAF and zero sample timers. Idle CPU work is not hidden behind opacity.
- Main-content CLS caused by enhancements ≤0.02; reserve all marks/illustrations before animation. No scene hides the primary CTA after the intro finishes.

Fonts and the existing full replay have separate pre-existing costs; do not count a lazy React replay bundle against Home to conceal eager loading or claim a product-wide performance gate. No telemetry, remote font, background request, user-data persistence or native-harness access is introduced.

Source-checked font baseline on 9 November: InterVariable 352,240 bytes and JetBrainsMono-Regular 92,164 bytes, 444,404 bytes combined. These are existing WOFF2 assets, reported separately from the Home non-font budget.

## Execution plan and PR boundaries

TASKS is the active queue; the steps here are the execution contract for those IDs. Before LAND-9, integrate the reviewed #378/#380/#381 source baseline and #384/this specification through the normal builder-reviewed workflow. If waiting on parent review, draft a clearly stacked branch from the correct source parent; do not recreate earlier work or mix unrelated app changes into a landing PR. Each item is one whole PR; build/test evidence and completion docs travel with it. The other builder reviews before squash merge; this document does not authorize merging or publication.

Use this order for the shared landing files: LAND-9 → LAND-10 → LAND-11 → LAND-12 → LAND-13 → LAND-15 → LAND-16 → LAND-14. LAND-15 can prepare the capture locally once the replay is available. LAND-14 measures the combined page after the stack, preview and close are integrated.

### LAND-9 — shared runtime and branded opening (maximum 15 paths)

Use the existing `codex/land-9-opening-stack` implementation as the source baseline after review. Reconcile the known Home-only boot and reusable Replay controls there. Review the local changes in that checkout before integrating them.

Files: create `apps/landing/src/motion-policy.ts`, `motion-runtime.ts`, `opening.ts`, `opening.css`, `apps/landing/public/intro-boot.js`, `apps/landing/public/intro-boot.css`, `tests/browser/landing-opening.spec.ts`. Modify `site.ts`, `landing-motion.ts`, `identity.ts`, `apps/landing/index.html`, `scripts/build-landing.ts`, `tests/landing-motion.test.ts`, TASKS and STATUS. Reuse matching paths already present in the stack.

Interfaces: `resolveMotionPolicy`, `createMotionRuntime`, `introFrame`, `initOpening(runtime: MotionRuntime): () => void`. The projection describes the finite reveal. The controller owns manual entry, reversible wheel handoff, exit and cleanup.

- [ ] Add policy and projection tests for hidden, constrained, short and 600×900 modes and all reveal boundaries. Run `node --test tests/landing-motion.test.ts` and observe the failing cases.
- [ ] Add browser cases for Home-only bootstrap, invisible/inert navbar during opening, Enter → Replay → Enter, manual wheel reversal and immediate Skip/Escape, no-JS, missing module, denied storage, slow fonts, hidden, return and resize.
- [ ] Apply the lighter lockup, finite name/tagline reveal, and accessible entry controls. Reuse the existing opening branch implementation where it matches the contract.
- [ ] Build and run the opening and existing landing specs. Inspect reveal, hold and handoff at 600 and 1440 px and static at 1440×600. Record the boot size, stable header behavior and zero running animations during hold.
- [ ] Complete the item, remove its claim, sync TASKS, record results and request review in its own PR.

### LAND-10 — compact plain-language explanation (maximum 8 paths)

Files: create `apps/landing/src/explainer.ts`, `explainer-markup.ts`, `explainer.css` and `tests/browser/landing-explainer.spec.ts`. Modify `site.ts`, `scripts/build-landing.ts`, TASKS and STATUS.

Interfaces: `explanationHTML(): string` emits the copy at the top of the walkthrough. `initExplainer(runtime: MotionRuntime): () => void` owns only the first-visibility emblem arrival.

- [ ] Add browser cases for exact readable copy, the native `#how-it-works` anchor, no-script and static emblems, and the absence of an additional sticky reading stage. Observe failure against the existing build.
- [ ] Add the normal-flow markup with fixed emblem slots. Bind one finite decorative arrival and cancel it on reading intent or policy change.
- [ ] Build and run the explainer, opening and base landing specs. Check 600, 1024, 1440 and 1920 px and the short-window state. Complete the whole item in its own PR.

### LAND-11 — compact walkthrough and hero motion (maximum 15 paths)

Files: create `apps/landing/src/sample-model.ts`, `sample-controller.ts`, `living-sample.ts`, `living-sample.css`, `tests/landing-sample.test.ts`, `tests/browser/landing-living-sample.spec.ts`. Modify `site.ts`, `landing-motion.ts`, `landing-motion.css`, `identity-geometry.ts`, `identity.ts`, `scripts/build-landing.ts`, `tests/browser/landing-motion.spec.ts`, TASKS and STATUS.

Interfaces: shared `Chapter` data comes from the generator. `SampleSnapshot { index: 0|1|2|3; owner: 'manual'|'playback'; playing: boolean; repeat: boolean }`. `createSampleController(chapters: readonly Chapter[], runtime: MotionRuntime, clock?: SampleClock): SampleController` exposes `snapshot(): SampleSnapshot`, `subscribe(listener: (snapshot: SampleSnapshot) => void): () => void`, `select(index: number, origin: 'pointer'|'keyboard'|'range'|'restore'): void`, `play(): void`, `pause(): void`, `setRepeat(value: boolean): void`, `setVisible(value: boolean): void` and `dispose(): void`. `initLivingSample(runtime, sample)` binds the shared reader. Extend `identityFaces(turn, pointer?)` with a neutral default that preserves one-argument geometry.

- [ ] Unit-test 1600/3800/6400/8200 ms boundaries, final hold, repeat delay, pause/dispose, restored selection, metadata validation and escaping. Run `node --test tests/landing-sample.test.ts tests/landing-motion.test.ts` and observe missing behavior.
- [ ] Replace the two sample stages with one reader and transport. Preserve anchors, native replay links and exact source/status/provenance. Retire hero and sample scroll tracks and scroll-driven selection. Update earlier browser expectations that explicitly require those tracks.
- [ ] Add the finite hero cue and bounded pointer depth with one invalidation key. Keep the preview slot and right visual aligned with the new left copy. LAND-15 supplies the recording.
- [ ] Browser-check both anchors, stable selection on scroll, every chapter, visibility and policy interruption, malformed metadata, no-JS and desktop layout. Verify both hero CTAs and the right visual at 1440×900.
- [ ] Build and run the named unit and landing browser specs. Complete the whole item in its own PR.

### LAND-12 — floating showcase cards (maximum 7 paths)

Files: create `apps/landing/src/showcase.ts`, `showcase.css` and `tests/browser/landing-showcase.spec.ts`. Modify `site.ts`, `scripts/build-landing.ts`, TASKS and STATUS.

Interfaces: `showcaseHTML(chapters: readonly Chapter[], renderEvidence: (chapter: Chapter) => string): string` uses the shared model and existing renderer. `initShowcase(runtime: MotionRuntime): () => void` owns temporary peeks and finite feedback. Native radio state owns selection.

- [ ] Add browser cases for hover/focus peeks with exact fixture excerpts, Escape/leave dismissal, independent selection, three native choices, one active reader, links and no-script selection. Assert stable page height and a section ≤900 CSS px at 1440×900. Run to observe missing behavior and record the old height.
- [ ] Replace the three editorial rows with the server-rendered group and stable reader. Use a reserved peek strip and keep card links/focus outside overflowing material.
- [ ] Add the 4 px hover lift, one-shot edge feedback and 200 ms selection arrival. Verify static behavior, rapid switching and scroll passing through without selecting a card.
- [ ] Build and run showcase/base landing browser specs at the supported widths. Record the measured reduction and complete the item in its own PR.

### LAND-13 — navigation, hover, settings and sample details (maximum 10 paths)

Files: create `apps/landing/src/navigation-motion.ts`, `navigation-motion.css`, `sample-details.ts`, `sample-details.css`, `tests/browser/landing-interactions.spec.ts`; modify `site.ts`, `landing-motion.ts`, `scripts/build-landing.ts`, TASKS and STATUS.

Interfaces: `initNavigationMotion(runtime): () => void` preserves native destinations and delegates bounded feedback; `initSampleDetails(runtime): () => void` owns the native dialog and focus restoration. Both use runtime-owned animation cancellation and the shared policy rather than independent preference checks.

LAND-13 removes the old hero-local header-mark writer from `landing-motion.ts`; navigation becomes its sole owner. Do not run the old 24° hero assignment and new 36° whole-page assignment concurrently.

- [ ] Add failing browser cases for rapid open/close/reopen, current-state reversal, Escape/outside click, disconnected invoker, compact focus return, policy constraints and unchanged native link targets.
- [ ] Implement the exact sample-details copy/actions, three contour entrances and paired close; no input/submission endpoint. Add compact utility Motion settings and footer Replay intro.
- [ ] Implement single-label/icon feedback and compact menu morph. Keyboard stays immediate; hover never modifies a hit area's geometry or sample state.
- [ ] Run `landing-interactions`, opening and existing landing specs, including clipboard refusal, Save Data and static modes. Inspect every open/closed/focus/failure state at 600 and 1440.
- [ ] Complete the whole interaction task and request review in its own PR.

### LAND-15 — hero product recording (maximum 9 paths)

Files: create `apps/landing/src/hero-preview.ts`, `hero-preview.css`, `apps/landing/public/hero-preview.webp`, `apps/landing/public/hero-preview.mp4` and `tests/browser/landing-hero-preview.spec.ts`. Modify `site.ts`, `scripts/build-landing.ts`, TASKS and STATUS.

Interfaces: `heroPreviewHTML(): string` emits the fixed poster allocation, initially hidden enhancement button, native description and demo link. `initHeroPreview(): () => void` binds the actual video, playback/error states and visibility cleanup. Both live in `hero-preview.ts` and the markup export is safe to import during build. The generator copies the two known files, enforces their byte budgets and serves MP4/WebP MIME types. The preview owns its playback separately from LAND-11's sample controller.

- [ ] Add a browser case that records network requests from initial navigation through Play. Assert a visible poster/link, zero MP4 requests before Play and actual playback after it. Add cases for failed media, Retry, video end/Replay, paused when hidden/offscreen, no automatic restart, no-script link, and fixed dimensions at 600 and 1440 px.
- [ ] Run the targeted preview spec and observe the missing preview failure. Capture the four-beat synthetic sequence from the built demo and export the poster/clip within the byte budgets. Record source revision, capture dimensions, duration and sizes in the PR. Review every cut for readable material and synthetic-only content.
- [ ] Render the preview where the hero's static terminal is built. Add the native description and working demo link, then connect Play, pause, ended, replay and retry with the shared allocation. Build and verify there is no media request on Home before activation and no preview media loaded on other routes.
- [ ] Run `node scripts/build-landing.ts` and the preview plus base landing browser specs. Watch the actual clip in the built site, check controls and static/failure states, and complete the whole item in its own PR.

### LAND-16 — ASCII closing and footer (maximum 7 paths)

Files: create `apps/landing/src/closing.ts`, `closing.css` and `tests/browser/landing-closing.spec.ts`. Modify `site.ts`, `scripts/build-landing.ts`, TASKS and STATUS.

Interfaces: `closingHTML(availabilityHTML: string): string` emits the Home-only CTA and ASCII art. The generator supplies escaped manifest-derived availability markup and reuses the shared footer. `initClosing(runtime: MotionRuntime): () => void` owns the optional finite connector emphasis.

- [ ] Add browser cases for the native CTA, privacy and footer links, manifest-derived availability, Motion and Replay controls, short windows, 600 px wrapping and no-JS. Run to observe missing markup.
- [ ] Merge local and closing content into one compact section and keep the footer grouped in a simple utility row. Render the tree as aria-hidden decoration and add its one 240 ms emphasis.
- [ ] Build, run the closing and navigation browser specs, and inspect 600 and 1440 px. Complete the item in its own PR.

### LAND-14 — integrated acceptance (maximum 7 planned paths)

Files: create `tests/browser/landing-acceptance.spec.ts`, `scripts/check-landing-performance.ts`, `docs/review/landing-motion-acceptance.md`; modify `tests/browser/landing.spec.ts`, `tests/browser/landing-motion.spec.ts`, TASKS and STATUS. If measured defects require source changes outside this bounded task, give them a whole TASKS item or update the claim before implementation; do not hide unfinished work in the acceptance report.

Interfaces: performance helper reads the built manifest/artifacts and emits numeric sizes plus a pass/fail result; it does not instrument agent sessions or send data. The browser acceptance spec measures runtime/DOM behavior on the static artifact.

- [ ] Run every scenario in the matrix below on the integrated branch, from an independent frozen install when a new checkout is used. Never share node_modules between worktrees.
- [ ] Measure Home assets, preview requests, frame/idle work and layout shift. Compare total Home and showcase height with the same baseline at 1440×900. Check the ≤3600 and ≤900 CSS px targets, direct anchors and fixed selection geometry. Record browser, machine, source revision and observed results.
- [ ] Inspect 600/1024/1440/1920, 1440×600 and a supported desktop zoom configuration; record real screenshots locally, not real user content. Perform freeze/truth/calm-reading checks; distinguish an agent pass from Yash's human visual approval.
- [ ] Run one complete landing suite and artifact build after all feature tasks finish. Preserve unrelated clean-main failures as evidence rather than weakening assertions. Full product/package/genuine-session gates are not claimed for this marketing-only batch.
- [ ] Request a fresh review of the integrated landing range, fix actionable findings, repeat only affected checks, record remaining external review requirements, and present the final unmerged review stack to Yash.

## Acceptance and verification

### Review focus

Test opening failure recovery, hidden-tab layout stability, explicit chapter ownership, keyboard access to the active showcase reader, preview playback failure and public replay isolation. The owning tasks define each case above.

| Test dimension | Required cases | Owner |
|---|---|---|
| Opening | Lighter lockup and finite hold, inert navbar, Home-only guard, Enter/Skip/Escape, wheel reversal, full enter→replay→enter, return, direct links, fonts/storage/geometry/module failure and static policy. | LAND-9 |
| Explanation | Exact readable copy, native anchor, finite emblem timing, selection/focus, no-script and static states. | LAND-10 |
| Evidence | Four exact steps/provenance/materials; mapped/unresolved origins; escaping; later-test qualification; exact links. | LAND-11 |
| Ownership | Click, keyboard, range, selection, playing/repeat, stable selection on document scroll, both anchors, bookmark and return. | LAND-11 |
| Live transport | Exact cycle times, final hold, explicit repeat, one timer, visible pause, all offscreen, hidden, policy change, no catch-up. | LAND-11 |
| Showcase | Three native selections, fixture-backed hover/focus peeks, Escape/leave, one active reader, fixed height, sharp evidence, no-script and native links. | LAND-12 |
| Hero preview | Real synthetic clip and poster, zero eager video requests, explicit Play/Pause/Replay/Retry, visibility pause, fixed allocation, media failure and demo fallback. | LAND-15 |
| Controls | Hover entry/leave, press, rapid reversal, native links, compact Menu, Motion options, dialog focus/escape/outside, closed states. | LAND-13 |
| Availability | Current preview manifest, source/release absence, Copy commands denial, no fabricated downloads or dead control. | LAND-13 / LAND-14 |
| Responsive | 600×900, 1024×900, 1440×900, 1920×1080, 1440×600; supported equivalent zoom width and explicitly reported physical zoom. | All / LAND-14 |
| Static/lifecycle | Reduced motion, motion=0, Save Data, low resources, no-JS, failed enhancement, hidden/pagehide/pageshow, no replay on return. | All / LAND-14 |
| Privacy/isolation | Same-origin resources only, no `/v1`, no daemon probe, hostile replay selectors ignored, no upload/native prompt control. | LAND-14 plus existing suite |
| Close | Compact ASCII section, meaningful CTA and footer links, static and no-JS reading, manifest truth, keyboard and supported-width wrapping. | LAND-16 |
| Performance | Asset budgets, no eager replay or video, Home ≤3600 CSS px and showcase ≤900 CSS px at 1440×900, stable layout and no idle RAF/timer/animation. | LAND-14 |

While implementing, run pure units and the touched browser spec. At each finished item, build and run its named specs plus existing landing regressions. Once the batch finishes, run the complete landing suite once. Example final commands, from the correct integrated source checkout:

```powershell
node --test tests/landing-motion.test.ts tests/landing-sample.test.ts
node --check apps/landing/public/intro-boot.js
node node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target ES2023 --module ESNext --moduleResolution bundler --lib ES2023,DOM,DOM.Iterable --allowImportingTsExtensions apps/landing/src/site.ts apps/landing/src/identity.ts apps/landing/src/explainer-markup.ts apps/landing/src/showcase.ts scripts/build-landing.ts
node scripts/build-landing.ts
$env:DRISHYA_BROWSER_CHANNEL = 'msedge'
node node_modules/@playwright/test/cli.js test 'landing.*\.spec\.ts$' --workers=1
node scripts/check-landing-performance.ts
node scripts/sync-tasks.ts --check
git diff --check
```

The current checkout may use another installed supported browser; record its actual channel and worker count. New test/module/performance files in these final commands are implementation deliverables, not currently existing tools. The entry modules in the TypeScript command must import every runtime/markup dependency; check any isolated new entry explicitly if it is not reachable from them. The Playwright argument is a regular expression covering all landing specs, not an assumed shell glob. Add new browser files to existing test discovery; do not change product tests to accommodate marketing motion.

Every PR records its source revision, actual passing commands/counts, visual states/widths, unmet external conditions and evidence limits. Documentation-only LAND-8 requires source/contract/link/task checks, not product browser tests. No effect is marked implemented or an item ticked because its design appears in this MD. Publication, a public source URL/installer, real platform certification and builder approval remain separate recorded actions.

## Self-review and completion contract

- All reference IDs 01–30 have a selected adaptation and owner; no small-screen source-only effect is misrepresented as an observed desktop implementation.
- Opening, hero, explanation, living sample, detailed reading, showcase, brand, navigation, dialog, settings and all public routes have exact states and destinations.
- Shared policy, frame/timer ownership, interruptions and static/failure paths apply to every module rather than being redefined per effect.
- Every cross-task interface has one named owner and consumer; future code files and commands are labelled future until implemented.
- Each implementation item has a bounded file list, a failing-test-first step, meaningful acceptance and an independent PR boundary.
- TASKS remains the only active product queue. This MD is the selected design/execution contract; STATUS records claims, decisions and measured results.

LAND-8 owns this specification. TASKS records completion for LAND-9 through LAND-16.
