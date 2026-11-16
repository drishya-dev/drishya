# Drishya brand files

The woven mark and the name. The code in this repository is Apache-2.0; the **name and logo are not licensed for other products** (see [TRADEMARKS.md](../../TRADEMARKS.md)).

| File | Use |
|---|---|
| `mark-on-dark.svg` | The mark in ivory (`#ece9dd`) for dark or graphite backgrounds. Vector, 460 × 430 viewBox |
| `mark-on-light.svg` | The mark for light backgrounds |
| `mark-adaptive.svg` | The mark that switches colour with the viewer's light or dark setting; used as the browser-tab icon |
| `app-icon.svg`, `app-icon.png` | The mark on a square 500 × 500 canvas (the PNG is 512 × 512) for app icons and avatars |
| `logo.png` | The 2048 × 2048 raster logo, for places that cannot take SVG |
| `social-preview.png` | The 1280 × 640 image GitHub shows when the repository is shared. Upload it under Settings, then Social preview. Rebuild it from `social-preview.html` |

## Using them

- Keep the mark's proportions, and do not recolour, outline, rotate or animate it for your own use. Give it room; do not crowd it with other marks.
- The name is set in **Inter** (SemiBold, tight tracking); the product's code font is JetBrains Mono. Both are licensed under the SIL Open Font License, with the licences in [`apps/ui/public/fonts`](../../apps/ui/public/fonts).
- Graphite (`#131516`) is the ground the mark was drawn for.
- The agent logos in [`docs/readme/agents`](../../docs/readme/agents) belong to their owners and are not part of this brand.

## Where the copies live

The app and the website serve their own copies from their `public` folders, because a bundler cannot reach outside its root: `apps/ui/public/brand/` (app icon, tab icon, favicon sizes) and `apps/site/public/mark.svg`. A unit test (`apps/ui/test/brand-assets.test.ts`) fails if those copies differ from the files here, so **change a file here first and copy it to where it is served**.

## Rebuilding the social preview

`social-preview.html` is the source. Render it at 1280 × 640 with any Chromium, for example Playwright's `page.screenshot` after `document.fonts.ready`, and save over `social-preview.png`.
