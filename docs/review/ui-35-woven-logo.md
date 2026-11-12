# UI-35 · Woven aperture brand mark and favicons

- **Summary:**
  - Replaced the legacy faceted crystal PNG/ICO files under `apps/ui/public/brand/` and `apps/ui/public/favicon.ico` with the new cream (`#ece9dd`) six-ribbon woven aperture mark on matte `#0b0c0f` backing (`drishya.png` 512x512, `drishya-192.png` 192x192, `drishya-180.png` 180x180, `drishya-32.png` 32x32, multi-entry 16x16+32x32 `favicon.ico`, and normalized square `drishya.svg`), rendered via supersampled iterative downscaling from the vector paths of `docs/Logo.svg`.
  - Removed the legacy crystal crop workaround (`.brand-image img { transform: scale(1.55); }` -> `object-fit: contain;`) in `apps/ui/src/classic.css` so the woven aperture mark renders complete and centered inside Home (`28x28`), Session Header (`25x25`), Classic (`30x30`), browser tabs, and `scripts/build-landing.ts` / `scripts/build-site.ts` copies.

- **Verification:**
  - `corepack pnpm typecheck` + `corepack pnpm ui:build`: passed.
  - `corepack pnpm exec vitest run apps/ui/test`: 118 files / 580 passed / 1 existing skip (`palette-paint-policy.test.ts` verified token compliance with `background: var(--s1)`).
  - Edge browser specs (`DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=2`): `header-cluster.spec.ts`, `palette-contrast.spec.ts`, `session-typography.spec.ts`, `prose-reference-preview.spec.ts` — `28 passed / 0 failed / 0 retries`.
  - Real local sessions checked in scratch store across `1440x900` & `600x900` in Jet Black, Midnight, and Paper (`claude-code rec_c251d257` +8 obs & `codex rec_7f72dcb0` +156 obs): `BrandMark` `naturalWidth = 192`, `transform = none`, crisp and centered across Home and Session Header in all three palettes (screenshots retained privately in `.local/ui-35/`).
