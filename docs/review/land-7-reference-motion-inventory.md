# LAND-7 — full reference motion inventory

Harsh requested a fresh audit on 9 November 2026: opening logo → name → landing, an animated plain-language explanation, and more live elements. This report completes the audit-first request. It supersedes LAND-4's abbreviated inventory; it does not claim these additional effects have been implemented in Drishya.

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

## Proposed original Drishya sequence

1. **Opening:** the aperture resolves, “Drishya” appears, then the same mark settles into the hero's repository scene. Proposed total budget 1.5–2 seconds, with Skip/Escape, reduced-motion and return-navigation fallbacks. This timing is a design proposal, not a measured implementation or a new loading delay requirement.
2. **Plain-language explanation:** “Your agent writes code. Drishya shows the work.” Supporting sentence: “Watch the files it reads, commands it runs, and changes it makes.” Use whole DOM phrases in a short scroll sequence, with one original animated read/run/edit emblem beside each. Captured material remains whole and selectable.
3. **Living sample:** source node → actual recorded command → recorded edit → later test result. Build small interactive file/terminal/diff illustrations from the existing synthetic recording. Label the public material as a sample; tie activity and counts to recorded events.
4. **Pointer depth and return:** a restrained pointer-responsive repository constellation and original logo motion, then the existing walkthrough and honest local setup actions. Motion settles when interaction stops and respects hidden tabs, Save Data and reduced motion.

No product code is changed by LAND-7. Implementation should follow this delivered inventory as separately claimed whole tasks in TASKS, rather than silently expanding the existing hero/story PRs.
