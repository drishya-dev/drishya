# Drishya landing page — complete motion specification and execution plan

Harsh requested a fresh audit on 9 November 2026, followed by a complete selection and build specification in this same MD. LAND-7 supplies the reference evidence below; LAND-8 supplies the selected design, exact behavior and execution contract. This document supersedes LAND-4's abbreviated motion inventory and its decision to omit an opening. It specifies future work; it does not claim that LAND-9 through LAND-14 are implemented.

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
| 03 | Name wave | Seven real DOM brand letters arrive with 24 ms offsets, 500 ms each. Captured text is never split. | LAND-9 |
| 04 | Name → page handoff | The same real mark travels to its hero allocation; overlay fades and is removed. | LAND-9 |
| 05 | Dimensional hero | Retain procedural projected geometry; add bounded pointer tilt instead of a looping phone video. | LAND-11 |
| 06 | Layered ambient field | Two SVG repository-node depth layers; at most 24 decorative nodes, seeded deterministically. | LAND-11 |
| 07 | Pointer parallax | Front layer ±6/4 px, back ±3/2 px; mark yaw ±4°, pitch ±2.5°. | LAND-11 |
| 08 | Character reveal | Brand letters only; marketing headings use whole-line arrivals. Code/prose recorded from an agent stays whole. | LAND-9 / LAND-10 |
| 09 | Line reveal | Whole marketing lines rise 12 px and resolve up to 4 px blur over 420 ms. | LAND-10 |
| 10 | Floating nav and mark rotation | Retain compact header; mark rotates at most 36° across page progress, not continuous spinning. | LAND-13 |
| 11 | Scroll logo assembly | Aperture resolves into a repository constellation at the hero/explainer boundary. | LAND-10 |
| 12 | Logo scale/rotation/halo | Scale 1→0.78 and turn at most 55°; replace halo with a bounded 1 px mint contour. | LAND-10 |
| 13 | Pinned benefit phrase | “Your agent writes code.” → “Drishya shows the work.” | LAND-10 |
| 14 | Depth transition | Only inactive marketing phrases translate/fade/blur; active phrase and captured material stay sharp. | LAND-10 |
| 15 | Inline living emblems | Original read/run/edit SVGs animate inside fixed-size slots; text never reflows around growing boxes. | LAND-10 |
| 16 | Paragraph emphasis | Whole paragraph is mounted; line emphasis advances with scroll, without typing or hiding unvisited words. | LAND-10 |
| 17 | Background heading parallax | One “See the work.” line moves at 0.15 of scene travel, ≤48 px. | LAND-11 |
| 18 | Layered process elements | File/terminal/diff/result illustrations share sample state; decorations move ≤24 px in depth. | LAND-11 |
| 19 | Staggered arrivals | Whole illustration surfaces arrive at 80 ms offsets, 360 ms each; one entrance per page load. | LAND-11 / LAND-12 |
| 20 | Living widgets | Exact synthetic read/failure/edit/retest material; shared finite playback, explicit optional repeat, no invented gauges. | LAND-11 |
| 21 | Edge illumination | A 1 px mint edge trace travels once in 720 ms on pointer hover; keyboard focus gets the immediate final contour. | LAND-12 |
| 22 | Product stack | Captured source → recorded edit showcase: rear scale 0.94→1, opacity 0.55→1, foreground moves up ≤64 px. | LAND-12 |
| 23 | Brand backdrop | Original aperture-derived ribbon field, scrubbed through ≤24° turn and ≤40 px travel. | LAND-12 |
| 24 | Moving wordmark | One user-paced desktop wordmark passage, x=+6%→−6%; no phone-only or endless ticker. | LAND-12 |
| 25 | Rolling hover labels | Whole labels move ≤4 px; one text copy, optional arrow motion. No duplicated captured characters or letter clones. | LAND-13 |
| 26 | Inertial hover | Decorative icon/edge only: ≤3 px and ≤1.5°, returning in 180 ms. Button hit areas never move. | LAND-13 |
| 27 | Modal entrance | “About this sample” dialog with 260 ms panel arrival and three restrained decorative contours. | LAND-13 |
| 28 | Modal exit | 160 ms paired close; Escape/outside click work immediately and interrupted close can reopen. | LAND-13 |
| 29 | Compact menu morph | Two-line CSS/SVG menu icon, 160 ms reversible open/close at supported compact desktop widths. | LAND-13 |
| 30 | Small-control feedback | Explicit 120 ms colour/border changes; focus immediate; press scale 0.98 for pointer activation. | LAND-13 |

LAND-14 verifies the combined experience. None of these items changes the local application's UI, capture, controller, storage or schema.

## Page flow and exact copy

### Home order and jobs

1. **Branded opening**, first eligible visit only: establish identity without requiring a wait.
2. **Hero**, `#main`: explain the category and offer the real demo/setup paths.
3. **Simple explanation**, `#how-it-works`: communicate the job in two short statements, then one paragraph.
4. **Living sample**, `#live-sample`: show reads, commands, edits and outcomes as inspectable material.
5. **Four-moment walkthrough**, `#session`: preserve the existing detailed reader and transport.
6. **Capabilities/showcase**, `#workspace`: source reading and recorded-change review, with honest current-workspace distinctions.
7. **Local/privacy section**, `#local`: explain where the user's own sessions stay.
8. **Brand passage and closing actions**: a final identity beat and clear next step.
9. **Footer**: real route links, motion settings and Replay intro.

Each section has a real heading and a useful static state. Opening, animation and scroll pinning are enhancements, not prerequisites for reaching links or reading material.

| Surface | Exact selected copy / action |
|---|---|
| Opening name | `Drishya` |
| Opening descriptor | `A live view and replay of your coding agent’s work.` |
| Hero H1 | `See what your agent did.` — at most two lines |
| Hero body | `Follow Codex and Claude Code through the files they read, the commands they ran, and the changes they made.` |
| Hero primary | `Try the demo` → `/#session` |
| Hero secondary | `Get Drishya` → `/get-started/` |
| Hero facts | `Claude Code + Codex` · `Local by design` |
| Explanation phrase A | `Your agent writes code.` |
| Explanation phrase B | `Drishya shows the work.` |
| Explanation support | `Watch the files it reads, commands it runs, and changes it makes.` |
| Explanation paragraph | `Keep your agent’s work in view as it happens. Open the source it read, inspect the output it received, and review the edit it recorded. Return to any captured moment without losing the context of your repository.` |
| Living sample heading | `From a read to a recorded change.` |
| Living sample label | `Interactive sample · synthetic recording` |
| Walkthrough heading | Keep `Follow one checkout fix.` and its existing four chapter titles. |
| Source showcase | `See the source it saw.` |
| Change showcase | `Review the recorded change.` |
| Local heading | Keep `Your sessions stay on your machine.` |
| Closing heading | Keep `Try it with your own sessions.` |
| Preview availability | Keep the manifest-driven statement that Drishya is in development and local checkout access is limited. |
| Sample details | `About this sample` |
| Opening controls | `Skip intro` / `Replay intro` |
| Site preference | `Motion` with `Auto`, `Reduced`, `Off` |

The hero descriptor appears before feature jargon. “Live” describes the product's supported local capability; the public example always says synthetic sample. No wording implies that the hosted site has discovered or connected to the visitor's agents.

### Routes and system connection

| Route | Connection / behavior | Motion boundary |
|---|---|---|
| `/` | Static public landing built from committed synthetic content. | Full selected composition, subject to policy. |
| `/#how-it-works` | Native explanation anchor. | Bypass intro, scroll natively, focus heading without another jump. |
| `/#live-sample` | Interactive illustrations of the committed sample. | Bypass intro; one sample controller. |
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
| Hero H1 | `clamp(52px, 5.7vw, 84px)`, line-height 1.02, tracking −0.065 em, maximum two lines. |
| Explanation display | `clamp(40px, 5.5vw, 80px)`, line-height 1.08; two short phrase blocks. |
| Main body | 16–17 px / 1.6; reading measure ≤65 ch. |
| Captured material | At least 14 px / 1.65; local horizontal/vertical scrolling, selectable text. |
| Metadata | 12 px minimum; controls retain visible labels or accessible names. |
| Content width | Existing 1200 px maximum; compact side margins 24–32 px. Documentation measure ≤760 px. |
| Header | 72 px allocation; 56 px inner pill, 8 px top/bottom allowance. Native anchor inset 96 px. |
| Reading stage | Top inset 104 px; at least 24 px bottom clearance. Stage chrome reserves 132 px; material uses the remaining bounded height. |
| Shape | Existing squared 3–6 px corners, flat surfaces and meaningful syntax. No pill around every paragraph. |
| Assets | Original aperture geometry and original SVG emblems; existing licensed brand/fonts; committed synthetic material. |

At 600–999 px, use normal document flow and compact/manual sample navigation. At width ≥1000 **and** height ≥700, spatial pinning is eligible. At 1440/1920, retain a deliberate reading measure rather than stretching code across unused space. At 1440×600, disable pinning. No phone-width or touch-specific work is included.

Static artwork must look finished before motion is enabled. Text never goes into WebGL. A browser snapshot at any paused point must retain a clear active phrase, readable material and visible controls.

## Shared motion policy and runtime

### Policy and precedence

Inputs: viewport width/height, fine-pointer capability, `prefers-reduced-motion`, `navigator.connection.saveData` when available, `document.hidden`, per-tab user mode, `?motion=0`, and a low-resource hint. Low-resource means reported device memory ≤2 GB or hardware concurrency ≤2; absent hints do not become a failure and no hint is persisted or transmitted.

1. `?motion=0` or user `Off`: no timed decoration, intro, pointer depth or pinning.
2. OS reduced motion or Save Data: the same static behavior; a user setting cannot force these off.
3. Low-resource hint or user `Reduced`: normal flow, static object and instantaneous material swaps; colour/border transitions may last at most 120 ms.
4. Otherwise `Auto`: enable finite effects; enable pinning only at ≥1000×700 and pointer depth only with a fine pointer.
5. Hidden tab: cancel time-based effects and queued frames, preserve the current layout heights/scroll position, and pause sample transport. Visibility never collapses a pinned track.

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

`resolveMotionPolicy(input: MotionInputs): MotionPolicy` is pure and tested. Its `pin` output excludes hidden-tab state so layout remains stable; `animate`, `pointer` and `intro` become false while hidden. `createMotionRuntime(): MotionRuntime` is browser-only. Build-time markup modules must not evaluate `window`, `document`, `matchMedia` or navigator at import time.

Invalid/non-positive viewport dimensions fail to the static policy with `invalid-viewport`. For scene projection functions, negative progress clamps to 0, progress above 1 clamps to 1, and non-finite progress returns the finished readable state. Keyboard navigation, selection, menu and dialog state changes are immediate; explicitly choosing Play/Replay is permission to view the requested timed content under the current policy.

Every owner unregisters observers/listeners on dispose. `pagehide` cancels owned WAAPI/CSS work and sample timers. On `pageshow`, remeasure and restore policy; do not replay entrance effects. Keep the existing `motionAllowed()` export as a compatibility wrapper until all callers use the runtime. Menu, chapter, tether and new effects must use the same policy.

When a visible preference change switches a scene between pinned and flow layout, preserve the focused control or current reading heading and its viewport offset across that one reflow. Do not run a continuous scroll-correction loop. A newer wheel/navigation intent cancels the adjustment. Hidden-tab changes only suspend work and must not perform this layout switch.

## Scene choreography

### 1. Opening: exact 1800 ms scene

Eligibility: Home only, no hash/deep-link/moment intent, not a return/BFCache navigation, width ≥600 and height ≥650, normal motion policy, visible tab, valid measurable hero mark. Auto-play once per tab under `drishya.landing.intro.v1`, marking the visit at start so interruption cannot create a replay loop. Storage denial skips automatic intro; Replay intro remains explicit.

Use a local, at-most-2 KiB uncompressed `intro-boot.js` before the stylesheet to set the eligible root state before first paint. Copy it into the static artifact; keep `script-src 'self'`, no inline script exception. The SSR default is the visible hero with the decorative intro layer absent. No-JS, missing bootstrap or missing module therefore keeps useful content. The boot guard installs an independent **2400 ms fail-open fuse** and immediate Skip/Escape/focus/pointer cancellation. The main module has at most 300 ms to become ready and obtain local font/geometry readiness; otherwise skip instead of showing a loading screen.

| Time from scene start | Visual state | Parameters |
|---|---|---|
| 0–120 ms | Centre outline appears. | Opacity 0→1; scale 0.75→1. |
| 120–560 ms | Faceted aperture resolves. | Facets move inward by at most 28 px using one shared assembly progress; final pose matches `identityFaces(0)`. |
| 400–1044 ms | `Drishya` arrives as a short wave. | Letter i starts at `400 + i×24` ms; 500 ms duration; y 16→0 px, rotateX 18→0°, opacity 0→1. Seven DOM spans; accessible name remains one `Drishya`. |
| 680–1040 ms | Product descriptor arrives. | Whole line, y 8→0 px, opacity 0→1. |
| 1060–1200 ms | Resolved identity holds. | No pulse, spinner, progress bar or percentage. |
| 1200–1800 ms | Mark settles into the hero. | FLIP from centred original SVG to measured hero allocation; one real mark, 600 ms morph ease. |
| 1320–1560 ms | Intro name fades away. | Whole-name opacity 1→0; no letter-by-letter exit. |
| 1320–1680 ms | Overlay reveals the already-mounted hero. | Black overlay opacity 1→0. |
| 1800 ms | Ready. | Remove overlay/Skip control, restore normal SVG allocation and enable hero scroll/pointer ownership. |

Measure the destination once, after stable fonts/layout, then animate the same SVG node; do not fly a cloned picture over a second mark. Centre intro SVG width is `clamp(144px,14vw,200px)`. Wordmark is `clamp(56px,8vw,104px)` and must fit at 600 px. If the destination is outside the visible window or invalid, use a 160 ms fade handoff instead of an offscreen flight. Resize, orientation-like window changes or invalid geometry cancel to the finished hero, never retarget a long flight.

The decorative overlay has `aria-hidden=true` and `pointer-events:none`; its sibling Skip button remains accessible. Main content stays mounted, readable to assistive technology and navigable. Any genuine focus/navigation/pointer intent ends the intro before that action continues. Escape/Skip reveal the final hero in ≤80 ms. Never steal focus on automatic completion. Explicit Replay intro moves to the top and focuses the hero heading on completion with `preventScroll`; Auto does not replay on Back/Forward.

`introFrame(elapsedMs: number): IntroFrame` is a pure projection. Stages are seed [0,120), assemble [120,400), name [400,1200), handoff [1200,1800), ready ≥1800. Assembly/name/handoff progress may overlap as the table specifies. Negative input clamps to zero; non-finite input returns ready/fail-open. Test exact boundaries 0/120/400/560/1044/1200/1320/1680/1800 and invalid input.

Its complete output contract is `IntroFrame { stage: 'seed'|'assemble'|'name'|'handoff'|'ready'; seedOpacity: number; assembly: number; letters: readonly number[]; descriptor: number; nameOpacity: number; handoff: number; overlayOpacity: number }`. `letters` has exactly seven clamped values; assembly is `clamp((t-120)/440)`, letter i is `clamp((t-400-i*24)/500)`, descriptor is `clamp((t-680)/360)`, handoff is `clamp((t-1200)/600)`, name opacity is `1-clamp((t-1320)/240)`, overlay opacity is `1-clamp((t-1320)/360)`. At ready, the overlay/name are absent and the real mark has its final allocation. The Home template gets a dedicated bootstrap placeholder; other routes emit no intro bootstrap request.

### 2. Hero and repository depth

Retain #380's original aperture and recorded edit material. The hero track is 170 svh when eligible; sticky top is the shared 72 px header allocation. Normal-flow fallback shows the same finished content. Headline, description and both actions remain readable at every scroll position.

Track progress is `clamp((scrollY - trackTop)/(trackHeight - viewportHeight),0,1)`, adjusted once for the header inset. Across progress 0→1: aperture turn ≤55°, scale 1→0.78, vertical shift 0→−40 px, copy shift 0→−20 px, repository relationship layer opacity 0.22→1. Use existing deterministic face projection and true fixture mappings. Clip decorative artwork only; never clip the sticky ancestor or hide evidence during compositor scrolling.

Pointer depth runs only while the hero is visible and the pointer is inside the artwork region. Normalized x/y clamp to [−1,1]; front nodes shift ±6/4 px, rear ±3/2 px; mark yaw/pitch add ±4°/±2.5°. Ignore movement below a 2 px dead zone. Exit returns to neutral over 180 ms. Pointer movement never changes sample chapter, detaches a reader, or moves text/hit areas. At most 24 decorative nodes; actual named file nodes come only from fixture graph evidence.

### 3. Simple explanation

Desktop scene: 220 svh, one sticky reading viewport below the header. It contains two whole phrase blocks, three original emblems and one mounted paragraph. Do not pin a viewport whose width/height policy is ineligible.

| Progress | State |
|---|---|
| 0–0.18 | Phrase A is sharp; the aperture/constellation relationship settles beside it. |
| 0.18–0.42 | Phrase A moves up/left ≤32/48 px, opacity 1→0.35 and blur 0→4 px. Phrase B moves from y 24 px to 0, opacity 0.55→1 and blur 4→0. |
| 0.42–0.62 | Phrase B holds sharp. Read/run/edit emblems enter at 80 ms offsets on first crossing, scale 0.8→1 over 320 ms. |
| 0.62–0.88 | Paragraph receives whole-line emphasis in reading order; all words were already mounted/selectable. Unemphasized lines remain at least 0.65 opacity, blur ≤2 px. |
| 0.88–1 | Full explanation is sharp; all icons are settled; the next section enters naturally. |

Inline slots are fixed at 44 px on compact windows and 64 px on wide desktop. Animate the inner graphic, never width/height/margins that reflow the sentence. File, terminal and diff emblems each perform one ≤600 ms relationship animation and hold. No continuously spinning inline ornament.

At 600–999, short windows or reduced/off, show both phrases and the whole sharp paragraph in normal flow. If reading focus/selection occurs mid-scene, finish text transforms immediately, retain the user's selection and keep the scene fully sharp for the rest of that visit. Preserve its current track height instead of collapsing it under the reader. Screen readers encounter one sensible static explanation; scroll changes do not fire repeated live announcements. Native scroll is never intercepted. Reversal recomputes absolute state when there is no reading override.

Projection rules: let `S(a,b,p)` be smoothstep of the clamped interval fraction, `u*u*(3-2*u)`. Phrase A uses x=−48S(.18,.42,p), y=−32S, opacity=1−0.65S, blur=4S. Phrase B uses y=24(1−S), opacity=0.55+0.45S, blur=4(1−S) over the same interval. Paragraph line i of N uses emphasis `clamp(clamp((p-.62)/.26)*N-i)`; opacity=0.65+0.35×emphasis and blur=2(1−emphasis). Group marketing words into visual lines only after fonts/layout and on resize, never during every frame; every word remains in its original single DOM home. This grouping is not applied to captured material.

`explanationFrame(progress)` returns `{ phraseA: {x,y,opacity,blur}, phraseB: {x,y,opacity,blur}, paragraphProgress: number, emblemProgress: number }`; the controller derives per-line emphasis from its current line count. The explainer uses a simplified aperture outline instead of a second faceted mesh: outline opacity 1→0 and constellation opacity 0.22→1 across p=0–0.18. The single 192-face sculpture remains in the hero. Each emblem's 320 ms entrance includes its relationship stroke; it does not append another hidden animation cycle.

### 4. Living sample and the detailed walkthrough

The content is the existing committed synthetic checkout investigation. `resolveChapters()` remains authoritative; never replace its observations with invented terminal text.

| Chapter | Replay step | Material / status | Presentation |
|---|---|---|---|
| read | 4 | Exact source and captured lines 1–14. | File emblem relates to the actual mapped file node; full supplied text remains mounted and scrollable. No scanning/highlighting one line at a time. |
| failure | 24 | Recorded command/output, 5 passed / 1 failed. | Tool instrument emits the complete result; red is confined to the recorded failure state. |
| edit | 26 | Recorded reconstructed hunk. | Whole real hunk arrives ≤12 px from its evidence-backed map/tool origin; additions/removals remain static semantic colour. |
| retest | 28 | Later run, 6 passed / 0 failed. | Outcome lands once. Caption retains that later does not itself prove coverage. |

One controller supplies every sample surface. The decorative hero edit preview can remain a fixed, labelled preview; it must not run a second playback clock. There is one real material node per active illustration surface and no duplicated text used as an animation overlay. Tooltips, maps and motion use metadata; copied characters never simulate agent reading or terminal typing.

The living scene uses four small semantic illustration articles and one dominant material reader. At ≥1200 px, the illustrations form a 2×2 composition beside the reader; at 1000–1199, use a 2×2 strip above it; at 600–999, use compact selectors plus one full-width reader. Avoid four miniature unreadable code panes. Each article has a plain selection button and a separate native `Open recorded moment` link. Do not nest links/buttons or turn captured text into a giant hidden hit area.

Controls: `Play sample`, `Pause sample`, `Replay sample`, optional `Repeat sample` checkbox (off by default), previous/next or the existing Moment range, and the existing `Follow scroll` control for the detailed walkthrough. Show Pause wherever playback is initiated. Progress is the exact current chapter/step, never an interpolated productivity number.

Use one visibility aggregator for `[data-sample-surface]` readers and their `[data-sample-transport]` controls. It calls `setVisible(true)` only when at least one reader is ≥20% visible **and** its Pause/control bar is ≥50% visible. Separate widgets must not race by overwriting a shared visible boolean independently. If the control bar scrolls away in compact flow, playback pauses even if some material remains visible.

Default cycle: read 0–1600 ms; failure 1600–3800; edit 3800–6400; retest 6400–8200; then stop and hold retest. Explicit repeat adds a 1200 ms settled hold before a new cycle. It must never enable itself. Offscreen (<20% intersection of every sample surface), hidden, Escape, resize, policy change, selection, range/keyboard action or reading focus pauses playback and requires explicit Play to resume. No catch-up of missed chapters on return.

Pause holds the selected chapter and clears its timer. A subsequent Play starts that chapter's full dwell again; it does not replay missed time. At the completed retest, Replay starts at read. Repeat is memory-only and resets off on a new document. The injected clock contract is `SampleClock { set(callback: () => void, delayMs: number): unknown; clear(handle: unknown): void }`; tests advance it without real sleeps.

Ownership is `scroll`, `manual` or `playback`. A deliberate chapter selection pauses and owns the state; pointer movement alone never does. Native scroll can change the detailed chapter only while owner is scroll. Follow scroll explicitly returns ownership and derives the stop immediately. Ordinary hash navigation without `moment` restores scroll ownership; a valid `moment` bookmark restores manual. Unknown moment falls back to read with an honest default. Playback cannot overwrite a reading selection.

Scroll-driven changes do not rewrite the URL or announce every change through aria-live. Explicit selections replace `moment`; keep `#session` for the detailed reader and `#live-sample` for living-scene actions. Direct links to both restore the same chapter. Full replay links remain `/demo/?demo&at=4|24|26|28`, with static preference propagated.

If `mapped`/path evidence is absent, use the appropriate tool-instrument origin with “Location not recorded”; never tether to a fabricated file node. Timeline adjacency is presented as recorded order, not reason/coverage. A state change mounts the complete next material and applies at most one 190 ms whole-surface translation for pointer/playback; keyboard/range/restore/scroll are immediate.

Metadata failure: show existing static material, complete walkthrough and replay links; hide playback/repeat/Follow scroll until valid metadata exists. Validate exactly four ordered keys, increasing positive steps and bounded string content from the same-origin `chapters.json`. Reuse the existing escaped renderer. A failed fetch or malformed payload never hides setup/navigation or starts a retry loop; one explicit Retry action may reattempt.

Public validation bounds are 512 KiB for the metadata response and 65,536 UTF-16 code units per chapter text. The current fixed fixture fits well below them. Reject reordered/missing/duplicate keys, non-integer steps, invalid material/provenance types and unsafe paths; retain the SSR fallback. This is a public-sample validator, not a new real-journal import limit. Keep existing `Chapter` fields, including `operationId`, `short`, `description`, `mapped` and the exact source strings, in the shared model.

### 5. Layered showcase, edge trace and brand passage

Use two supported capabilities: captured source reading and recorded-change review. Keep an explicit caption that current Git/workspace views are separate, opt-in local capabilities. Do not build a generic IDE mockup or add fabricated settings/screens.

Showcase track: 160 svh when pin-eligible. p=0–0.25 holds source; p=0.25–0.7 moves foreground up ≤64 px/opacity 1→0.55, while the rear edit surface scales 0.94→1, y 24→0 px and opacity 0.55→1; p=0.7–1 holds the edit. Captured characters stay sharp. Preserve true DOM reading order and exact links to source step 4/edit step 26. Focus/selection ends transforms, promotes the selected surface and provides reading space; it never leaves a keyboard control behind another card. Normal flow displays both complete articles.

`showcaseFrame(progress)` returns `{ source: {y,scale,opacity}, edit: {y,scale,opacity} }`. With v=S(.25,.7,p): source={y:−64v,scale:1,opacity:1−0.45v}; edit={y:24(1−v),scale:0.94+0.06v,opacity:0.55+0.45v}. Reading override switches both articles to normal flow, preserving at least the previous track height and the active reading anchor. Reading override lasts for that visit; no automatic return to a stack underneath the reader.

A decorative 1 px edge overlay uses `pointer-events:none`. On pointer hover, one trace completes in 720 ms at ≤0.18 mint alpha, then holds/fades over 120 ms. Leaving early reverses/cancels within 120 ms. Keyboard focus gets the final border immediately. Never animate a gradient around every card at rest. Error contours remain semantically distinct.

The brand passage is a single 110 svh scene, not another long pinned chapter. Aperture-derived lines/ribbon respond directly to scroll: rotation ≤24°, travel ≤40 px, opacity 0.08–0.18. One real `Drishya` wordmark moves from +6% to −6% of its own width through the passage. It does not repeat, run a 40-second clock, or depend on phone-only markup. No cloned text is needed. Decorative geometry is aria-hidden; accessible brand text is present once in that passage. Static mode shows the settled mark/ribbon without animation.

`brandFrame(progress)` returns `{ wordmarkXPercent, rotation, y, opacity }` with x=6−12p, rotation=24p, y=40(p−0.5), opacity=0.08+0.1×sin(πp). Progress spans entry-to-exit: `clamp((viewportHeight-rect.top)/(rect.height+viewportHeight))`. Static mode uses p=0.5. Clip only the decorative brand-field allocation to prevent horizontal overflow, never a sticky reading ancestor.

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

## Loading, failure, accessibility and lifecycle states

| Condition | Required result |
|---|---|
| No JavaScript / blocked module | Normal static page, real anchors/setup/complete walkthrough; no permanent intro cover. |
| Slow fonts/art readiness | Skip automatic intro after the 300 ms readiness window; use existing font-display fallback; no invisible heading. |
| Invalid intro geometry | Finish to the hero without flight. |
| Intro controller failure | Boot fuse releases at 2400 ms maximum from boot; Skip/Escape remains independently effective. |
| Chapter fetch blocked/malformed | Existing static material/error explanation and real replay links; no playback controls claiming readiness. |
| Missing decorative asset | Keep the text/actions and original static mark; no broken-image spinner. All new geometry should be code-native. |
| Reduced motion, Save Data, low resources | Shared policy, full manual reading, no new heavy media download or hidden animation. |
| Hidden tab / pagehide | Cancel owned animation/timers; preserve layout heights, selection and sample state. |
| BFCache/pageshow | Recompute policy/absolute geometry; restore explicit bookmark; no intro or automatic sample restart. |
| Resize/zoom/reversal | Cancel finite position transitions; remeasure next frame; no accumulating offsets, stale targets or offscreen controls. |
| Focus or text selection | Give reading ownership, finish relevant material transforms and keep selection/copy intact. |
| Clipboard refusal | Keep existing select-and-copy fallback on setup; no dead “Copied” state. |
| Offline public replay failure | Keep the existing honest Retry sample path; no invented local connection. |

Exact failure/status copy: metadata failure — `The interactive sample couldn’t load. Read the recorded walkthrough or open the full replay.`; retry — `Retry sample`; unmapped material — `Location not recorded`; reduced setting explanation — `Your system preference limits site motion.`; Save Data explanation — `Save Data is on. The sample remains available with static transitions.`; completed playback — `Sample complete. Replay it or open the full replay.` Use a polite status only for explicit control outcomes or a single failure announcement, not for passive scroll progress. Existing availability and clipboard-refusal copy remains source-checked in the setup/release generator.

One page H1; proper section H2s; native links/buttons; 2 px visible focus outline with 4 px offset; normal desktop targets ≥32 px, primary controls ≥44 px. Capture state uses text labels as well as colour. No auto-typing, count-up metrics, flashing effects, audio or screen-reader announcements during passive scrolling. Maintain meaningful DOM order even when visuals overlap. At 200% desktop zoom use the equivalent supported CSS width and also record any physical browser-zoom check separately.

## Asset, privacy and performance budgets

New assets are original procedural SVG/DOM. Do not ship the reference's PNG-sequence preloader, videos, Lottie JSON, images, Webflow runtime or purple star design. Reuse the existing licensed fonts/brand and committed synthetic fixture; keep their notices. No new runtime dependency is selected. If a measured implementation needs one, record the concrete reason and scope before changing the manifest; it is not implied by this spec.

All readable content stays in the DOM. The illustrative repository uses SVG/DOM; no canvas text, rasterized code screenshot or new WebGL context on Home. Runtime work is bounded: ≤192 aperture faces, ≤24 decorative nodes, one shared frame queue, one sample timer, no independent per-widget loops. Source changes render only at chapter boundaries; pointer/scroll frames update transforms/geometry, not syntax/tokenization or captured text.

Release-candidate landing targets, measured on the recorded review machine rather than claimed for every computer:

- Boot script ≤2 KiB uncompressed; total Home JavaScript ≤35 KiB gzip; Home CSS ≤20 KiB gzip; Home HTML ≤180 KiB uncompressed.
- New original decorative files ≤60 KiB gzip combined. Initial Home non-font transfer ≤250 KiB gzip; existing font bytes are reported separately and no new font family/weight is loaded.
- No `/demo/assets/` JavaScript/CSS before a real full-replay navigation, no daemon/API probe, and no third-party runtime request.
- Event-driven render callback p95 ≤8 ms, typical ≤4 ms over 100 scripted scroll/pointer invalidations at 1440×900. No landing-owned task >50 ms during a ten-second normal scroll/reversal probe. Record the browser, CPU/core/memory summary and actual result; a miss is a performance issue to fix, not a reason to relax the budget silently.
- After finite arrivals/transport are stopped, wait two frame opportunities: zero running landing animations, zero pending landing RAF and zero sample timers. Idle CPU work is not hidden behind opacity.
- Main-content CLS caused by enhancements ≤0.02; reserve all marks/illustrations before animation. No scene hides the primary CTA after the intro finishes.

Fonts and the existing full replay have separate pre-existing costs; do not count a lazy React replay bundle against Home to conceal eager loading or claim a product-wide performance gate. No telemetry, remote font, background request, user-data persistence or native-harness access is introduced.

Source-checked font baseline on 9 November: InterVariable 352,240 bytes and JetBrainsMono-Regular 92,164 bytes, 444,404 bytes combined. These are existing WOFF2 assets, reported separately from the Home non-font budget.

## Execution plan and PR boundaries

TASKS is the active queue; the steps here are the execution contract for those IDs. Before LAND-9, integrate the reviewed #378/#380/#381 source baseline and #384/this specification through the normal builder-reviewed workflow. If waiting on parent review, draft a clearly stacked branch from the correct source parent; do not recreate earlier work or mix unrelated app changes into a landing PR. Each item is one whole PR; build/test evidence and completion docs travel with it. The other builder reviews before squash merge; this document does not authorize merging or publication.

### LAND-9 — shared runtime and branded opening (maximum 14 paths)

Files: create `apps/landing/src/motion-policy.ts`, `motion-runtime.ts`, `opening.ts`, `opening.css`, `apps/landing/public/intro-boot.js`, `tests/browser/landing-opening.spec.ts`; modify `site.ts`, `landing-motion.ts`, `identity.ts`, `apps/landing/index.html`, `scripts/build-landing.ts`, `tests/landing-motion.test.ts`, TASKS and STATUS. Keep the code-native mark generator reusable and build-time-safe.

Interfaces: `resolveMotionPolicy`, `createMotionRuntime`, `introFrame`, `initOpening(runtime: MotionRuntime): () => void`. `introFrame` exposes stage plus clamped assembly/name/handoff/overlay values. `initOpening` binds the real SVG, cancels the boot fuse when ready, and disposes all event/animation ownership.

- [ ] Write policy/intro boundary tests first: hidden leaves pin eligibility unchanged but disables animation; off/reduced/Save Data block intro; 600×900 is non-pinned but eligible for intro; 1440×600 skips intro; invalid time/geometry fail open.
- [ ] Run `node --test tests/landing-motion.test.ts`; observe the missing/new behavior failure.
- [ ] Add the boot guard, SSR/default/fallback markup and shared policy/runtime. Preserve CSP and no-JS visibility.
- [ ] Implement the exact opening table and single-node handoff. Test fresh visit, repeat visit, Replay, Skip, Escape, Tab, direct hashes/moments, missing module, denied storage, delayed fonts, hidden tab, BFCache and resize mid-flight.
- [ ] Build the static site; run opening and existing landing specs. Inspect seed/name/handoff/ready frames at 600 and 1440, plus static 1440×600. No captured-content animation or new runtime dependency.
- [ ] Complete the item, remove its claim, sync TASKS, record results and request review in its own PR.

### LAND-10 — cinematic plain-language explanation (maximum 10 paths)

Files: create `apps/landing/src/explainer.ts`, `explainer-markup.ts`, `explainer.css`, `tests/landing-explainer.test.ts`, `tests/browser/landing-explainer.spec.ts`; modify `site.ts`, `motion-runtime.ts`, `scripts/build-landing.ts`, TASKS and STATUS.

Interfaces: pure `explanationFrame(progress: number)` returns the specified phrase/paragraph/emblem values; `explanationHTML(): string` emits static complete copy; `initExplainer(runtime: MotionRuntime): () => void` owns only this scene. Existing identity geometry is consumed, not reimplemented.

- [ ] Write boundary tests for progress 0/.18/.42/.62/.88/1 and clamped invalid input; verify active text sharpness and finite transforms.
- [ ] Run `node --test tests/landing-explainer.test.ts` and observe failure before implementing the projection.
- [ ] Implement static copy/semantics, fixed emblem allocations and normal-flow composition first, then the 220 svh scene and original SVG arrivals.
- [ ] Add browser checks for reverse/rapid scroll, direct anchor, focus/selection cancellation, readable paused frames, all four widths, short-window/reduced/no-JS paths and zero repeated live announcements.
- [ ] Build, run the explainer/opening/base landing specs, inspect keyframes and complete the whole item in a separate PR.

### LAND-11 — living sample and pointer depth (maximum 15 paths)

Files: create `apps/landing/src/sample-model.ts`, `sample-controller.ts`, `living-sample.ts`, `living-sample.css`, `tests/landing-sample.test.ts`, `tests/browser/landing-living-sample.spec.ts`; modify `site.ts`, `landing-motion.ts`, `identity-geometry.ts`, `identity.ts`, `scripts/build-landing.ts`, `tests/landing-motion.test.ts`, `tests/browser/landing-motion.spec.ts`, TASKS and STATUS.

Interfaces: shared `Chapter` data replaces duplicate local type declarations. `SampleSnapshot { index: 0|1|2|3; owner: 'scroll'|'manual'|'playback'; playing: boolean; repeat: boolean }`. `createSampleController(chapters: readonly Chapter[], runtime: MotionRuntime, clock?: SampleClock): SampleController` exposes `snapshot(): SampleSnapshot`, `subscribe(listener: (snapshot: SampleSnapshot) => void): () => void`, `select(index: number, origin: 'pointer'|'keyboard'|'range'|'scroll'|'restore'): void`, `play(): void`, `pause(): void`, `setRepeat(value: boolean): void`, `setVisible(value: boolean): void`, `followScroll(): void`, `restore(index: number, owner: SampleSnapshot['owner']): void`, `dispose(): void`. `initLivingSample(runtime, sample)` and the existing walkthrough consume that one controller. Extend `identityFaces(turn, pointer?)` with a neutral default; pointer coordinates clamp to [−1,1] and combine with the existing scroll pose. Existing one-argument consumers must keep identical geometry.

- [ ] Unit-test exact 1600/3800/6400/8200 ms boundaries, final hold, explicit repeat delay, pause/dispose cleanup, explicit selection versus scroll, restore, invalid metadata and source escaping. First observe failure with `node --test tests/landing-sample.test.ts tests/landing-motion.test.ts`.
- [ ] Extract the existing sample owner without changing its passing bookmark/keyboard behavior; integrate the living illustrations and fixed material layout. Keep `resolveChapters()`/fixture identities authoritative.
- [ ] Add bounded fine-pointer depth with one runtime invalidation key; no per-node listener/timer, no automatic chapter selection on pointer movement.
- [ ] Browser-check every chapter's exact source/status/link, visible Pause, explicit repeat, focus/selection ownership, offscreen/hidden/policy/resize interruption, return without catch-up, malformed metadata, no-JS and all supported layouts.
- [ ] Run the new unit/specs and all existing landing specs; inspect true/unresolved origins and material readability. Finish one whole PR; do not touch private journals or local API code.

### LAND-12 — showcase, edge trace and brand passage (maximum 9 paths)

Files: create `apps/landing/src/showcase.ts`, `showcase.css`, `tests/landing-showcase.test.ts`, `tests/browser/landing-showcase.spec.ts`; modify `site.ts`, `motion-runtime.ts`, `scripts/build-landing.ts`, TASKS and STATUS.

Interfaces: pure `showcaseFrame(progress)` and `brandFrame(progress)` enforce the specified bounds; `showcaseHTML(chapters): string` uses existing source/edit evidence; `initShowcase(runtime): () => void` owns both bounded passages and their edge traces.

- [ ] Write failing endpoint/reversal/bounds tests; run `node --test tests/landing-showcase.test.ts`.
- [ ] Build the two complete static articles and brand passage, then add the 160/110 svh behavior and original decorative ribbon.
- [ ] Implement one-shot edge feedback, stable hit areas and immediate focus/selection promotion. Do not clone captured material to transition between cards.
- [ ] Browser-check links, sharp selected text, paused overlaps, rapid reversal, focused rear-card controls, all widths, reduced/short/static modes and zero idle animations.
- [ ] Build/run showcase plus the base landing regressions, inspect both layer allocations and publish the separate review PR.

### LAND-13 — navigation, hover, settings and sample details (maximum 10 paths)

Files: create `apps/landing/src/navigation-motion.ts`, `navigation-motion.css`, `sample-details.ts`, `sample-details.css`, `tests/browser/landing-interactions.spec.ts`; modify `site.ts`, `landing-motion.ts`, `scripts/build-landing.ts`, TASKS and STATUS.

Interfaces: `initNavigationMotion(runtime): () => void` preserves native destinations and delegates bounded feedback; `initSampleDetails(runtime): () => void` owns the native dialog and focus restoration. Both use runtime-owned animation cancellation and the shared policy rather than independent preference checks.

LAND-13 removes the old hero-local header-mark writer from `landing-motion.ts`; navigation becomes its sole owner. Do not run the old 24° hero assignment and new 36° whole-page assignment concurrently.

- [ ] Add failing browser cases for rapid open/close/reopen, current-state reversal, Escape/outside click, disconnected invoker, compact focus return, policy constraints and unchanged native link targets.
- [ ] Implement the exact sample-details copy/actions, three contour entrances and paired close; no input/submission endpoint. Add compact utility Motion settings and footer Replay intro.
- [ ] Implement single-label/icon feedback and compact menu morph. Keyboard stays immediate; hover never modifies a hit area's geometry or sample state.
- [ ] Run `landing-interactions`, opening and existing landing specs, including clipboard refusal, Save Data and static modes. Inspect every open/closed/focus/failure state at 600 and 1440.
- [ ] Complete the whole interaction task and request review in its own PR.

### LAND-14 — integrated acceptance (maximum 7 planned paths)

Files: create `tests/browser/landing-acceptance.spec.ts`, `scripts/check-landing-performance.ts`, `docs/review/landing-motion-acceptance.md`; modify `tests/browser/landing.spec.ts`, `tests/browser/landing-motion.spec.ts`, TASKS and STATUS. If measured defects require source changes outside this bounded task, give them a whole TASKS item or update the claim before implementation; do not hide unfinished work in the acceptance report.

Interfaces: performance helper reads the built manifest/artifacts and emits numeric sizes plus a pass/fail result; it does not instrument agent sessions or send data. The browser acceptance spec measures runtime/DOM behavior on the static artifact.

- [ ] Run every scenario in the matrix below on the integrated branch, from an independent frozen install when a new checkout is used. Never share node_modules between worktrees.
- [ ] Measure Home-only assets, frame/idle work and layout shift; record actual browser, dimensions, hardware summary, source revision and budgets in the acceptance report.
- [ ] Inspect 600/1024/1440/1920, 1440×600 and a supported desktop zoom configuration; record real screenshots locally, not real user content. Perform freeze/truth/calm-reading checks; distinguish an agent pass from Yash's human visual approval.
- [ ] Run one complete landing suite and artifact build after all feature tasks finish. Preserve unrelated clean-main failures as evidence rather than weakening assertions. Full product/package/genuine-session gates are not claimed for this marketing-only batch.
- [ ] Request a fresh review of the integrated landing range, fix actionable findings, repeat only affected checks, record remaining external review requirements, and present the final unmerged review stack to Yash.

## Acceptance and verification

### Review focus

The highest-risk cases are: opening failure trapping content; hidden-tab changes collapsing pin heights; scroll taking a deliberately selected chapter; focused controls hidden behind stacked cards; and public navigation loading private/native capabilities. Each has an explicit owning task and tests above; no implicit “happy path only” completion.

| Test dimension | Required cases | Owner |
|---|---|---|
| Opening | First visit, return, Back/Forward, hash, moment, Skip, Escape, Tab, pointer intent, blocked storage/module, slow font, invalid rect, resize, hidden, fuse. | LAND-9 |
| Explanation | Exact copy/semantics; every progress boundary; forward/reverse; pause at any frame; selection/focus; full paragraph with no-JS/static. | LAND-10 |
| Evidence | Four exact steps/provenance/materials; mapped/unresolved origins; escaping; later-test qualification; exact links. | LAND-11 |
| Ownership | Click, keyboard, range, selection, playing/repeat, Follow scroll, anchor navigation, explicit bookmark and browser return. | LAND-11 |
| Live transport | Exact cycle times, final hold, explicit repeat, one timer, visible pause, all offscreen, hidden, policy change, no catch-up. | LAND-11 |
| Showcase | Focused rear card, reading space, sharp text, bounds/reversal, single DOM material per transition, native links. | LAND-12 |
| Controls | Hover entry/leave, press, rapid reversal, native links, compact Menu, Motion options, dialog focus/escape/outside, closed states. | LAND-13 |
| Availability | Current preview manifest, source/release absence, Copy commands denial, no fabricated downloads or dead control. | LAND-13 / LAND-14 |
| Responsive | 600×900, 1024×900, 1440×900, 1920×1080, 1440×600; supported equivalent zoom width and explicitly reported physical zoom. | All / LAND-14 |
| Static/lifecycle | Reduced motion, motion=0, Save Data, low resources, no-JS, failed enhancement, hidden/pagehide/pageshow, no replay on return. | All / LAND-14 |
| Privacy/isolation | Same-origin resources only, no `/v1`, no daemon probe, hostile replay selectors ignored, no upload/native prompt control. | LAND-14 plus existing suite |
| Performance | Asset budgets, no eager replay bundle, bounded frame work, stable layout, no idle RAF/timer/animation. | LAND-14 |

While implementing, run pure units and the touched browser spec. At each finished item, build and run its named specs plus existing landing regressions. Once the batch finishes, run the complete landing suite once. Example final commands, from the correct integrated source checkout:

```powershell
node --test tests/landing-motion.test.ts tests/landing-explainer.test.ts tests/landing-sample.test.ts tests/landing-showcase.test.ts
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

LAND-8 completes this specification only. LAND-9 through LAND-14 are queued implementation work; none is completed by writing this document.
