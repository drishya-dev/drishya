// SITE-1: a static site. `base` stays '/' for a custom domain; set SITE_BASE=/drishya/ for a github.io project page.
export default {
  base: process.env.SITE_BASE ?? '/',
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  server: { port: 5180 },
};
