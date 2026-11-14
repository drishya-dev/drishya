// SEC-3 items 4, 6 and 9, in the page: hostile content from every harness's real ingest path is walked through
// the product and nothing executes, nothing leaves the page, every link is safe, and the browser keeps nothing
// it should not. The daemon side of the same corpus is tests/security/04-injected-content.test.ts.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { defaultUiDir } from '../../apps/daemon/src/server.ts';
import { defaultAdapters } from '../../packages/ingest/src/index.ts';
import { HOSTILE_FILE_NAMES, PAYLOADS, hostileScenario } from '../security/lib/corpus.ts';
import { git, grantAccess, importHostile, makeRepo, write } from '../security/lib/seed.ts';
import { startScratch, type Scratch } from '../security/lib/scratch.ts';

let s: Scratch, repo: string;
const recordings: { adapter: string; id: string }[] = [];

test.beforeAll(async () => {
  s = await startScratch({ keepOperatingSystemHome: true, uiDir: defaultUiDir() });
  repo = makeRepo(join(s.dir, 'repo'));
  for (const name of HOSTILE_FILE_NAMES) write(join(repo, 'src', name), `export const x = ${JSON.stringify(PAYLOADS[1]!.text)};\n`);
  write(join(repo, 'src', 'a.ts'), 'export const a = 3;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', PAYLOADS[1]!.text + ' hostile commit message');
  write(join(repo, 'src', HOSTILE_FILE_NAMES[0]!), '// changed after the commit\n');
  for (const { descriptor } of defaultAdapters()) {
    const id = await importHostile(s, descriptor.id, repo);
    // Antigravity's transcript names no workspace, so it has no checkout to grant (its Files and Changes stay unreachable).
    if (descriptor.id !== 'antigravity') await grantAccess(s, id);
    recordings.push({ adapter: descriptor.id, id });
  }
});
test.afterAll(async () => { await s?.close(); });

interface Observed { requests: string[]; popups: number; dialogs: string[]; consoleErrors: string[]; responses: { url: string; cache: string | undefined; type: string | undefined }[] }

/** Wires everything a payload could reach for, before any page script runs. */
async function observe(page: Page): Promise<Observed> {
  const seen: Observed = { requests: [], popups: 0, dialogs: [], consoleErrors: [], responses: [] };
  await page.addInitScript(() => {
    const w = window as unknown as { __hits: string[]; __csp: string[]; __pwned?: unknown };
    w.__hits = []; w.__csp = [];
    Object.defineProperty(window, '__pwned', { configurable: false, get: () => undefined, set: (v) => { w.__hits.push(String(v)); } });
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    window.open = () => { w.__hits.push('window.open'); return null; };
  });
  page.on('request', (r) => seen.requests.push(r.url()));
  page.on('response', (r) => { if (r.url().includes('/v1/')) seen.responses.push({ url: r.url(), cache: r.headers()['cache-control'], type: r.headers()['content-type'] }); });
  page.on('dialog', async (d) => { seen.dialogs.push(d.message()); await d.dismiss(); });
  page.context().on('page', () => { seen.popups++; });
  page.on('pageerror', (e) => seen.consoleErrors.push('pageerror ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') seen.consoleErrors.push(m.text().slice(0, 200)); });
  return seen;
}

/** Everything that must hold at any moment, after any click. */
async function invariants(page: Page, seen: Observed, label: string) {
  const state = await page.evaluate(() => {
    const w = window as unknown as { __hits: string[]; __csp: string[] };
    const bad = (url: string) => { try { return !['http:', 'https:'].includes(new URL(url, location.href).protocol); } catch { return true; } };
    const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) => ({ href: a.getAttribute('href') ?? '', rel: a.rel, target: a.target, external: a.origin !== location.origin }));
    return {
      hits: w.__hits, csp: w.__csp,
      badLinks: anchors.filter((a) => a.href && !a.href.startsWith('#') && bad(a.href)).map((a) => a.href.slice(0, 40)),
      externalNoRel: anchors.filter((a) => a.external && !(/noopener/.test(a.rel) && /noreferrer/.test(a.rel))).map((a) => a.href.slice(0, 60)),
      blankNoRel: anchors.filter((a) => a.target === '_blank' && !(/noopener/.test(a.rel) && /noreferrer/.test(a.rel))).map((a) => a.href.slice(0, 60)),
      dangerous: ['iframe', 'object', 'embed', 'form[action]', 'base[href]', 'meta[http-equiv="refresh"]', 'script:not([src]):not([type="application/json"])', 'link[rel="stylesheet"][href^="http"]', 'svg script', '[onerror]', '[onload]', '[onclick]'].filter((q) => document.querySelector(q)),
      scripts: [...document.querySelectorAll('script[src]')].map((x) => (x as HTMLScriptElement).src).filter((src) => new URL(src).origin !== location.origin),
      images: [...document.images].map((i) => i.currentSrc || i.src).filter((src) => src && !src.startsWith('data:') && !src.startsWith('blob:') && new URL(src).origin !== location.origin),
    };
  });
  const origin = new URL(s.run.url).origin;
  const outside = seen.requests.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin);
  expect({ label, hits: state.hits }).toEqual({ label, hits: [] });
  expect({ label, csp: state.csp }).toEqual({ label, csp: [] });
  expect({ label, badLinks: state.badLinks }).toEqual({ label, badLinks: [] });
  expect({ label, externalNoRel: state.externalNoRel }).toEqual({ label, externalNoRel: [] });
  expect({ label, blankNoRel: state.blankNoRel }).toEqual({ label, blankNoRel: [] });
  expect({ label, dangerous: state.dangerous }).toEqual({ label, dangerous: [] });
  expect({ label, scripts: state.scripts, images: state.images }).toEqual({ label, scripts: [], images: [] });
  expect({ label, outside }).toEqual({ label, outside: [] });
  expect({ label, dialogs: seen.dialogs, popups: seen.popups }).toEqual({ label, dialogs: [], popups: 0 });
}

const SKIP = /sign out|delete|forget|remove|clear|revoke|disconnect|stop|send|submit/i;

async function walk(page: Page, seen: Observed, label: string, maxClicks = 36) {
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(80); }
  await invariants(page, seen, `${label}: scrolled`);
  const buttons = page.locator('main button:visible, [role="region"] button:visible, nav button:visible');
  const total = Math.min(await buttons.count(), maxClicks);
  for (let i = 0; i < total; i++) {
    const button = buttons.nth(i);
    const name = ((await button.getAttribute('aria-label', { timeout: 300 }).catch(() => null)) ?? (await button.innerText({ timeout: 300 }).catch(() => ''))).trim();
    if (SKIP.test(name)) continue;
    await button.click({ timeout: 400 }).catch(() => undefined);
    await page.waitForTimeout(60);
    await page.keyboard.press('Escape').catch(() => undefined);
    if (i % 10 === 9) await invariants(page, seen, `${label}: after ${i + 1} clicks`);
  }
  await invariants(page, seen, `${label}: end`);
}

for (const width of [600, 1440]) {
  test(`hostile content from every harness is inert in the page at ${width}px`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width, height: 960 });
    const seen = await observe(page);
    await page.goto(s.run.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await invariants(page, seen, 'home');
    expect(recordings.length).toBeGreaterThanOrEqual(2);
    for (const { adapter, id } of recordings) {
      await page.goto(`${s.run.url}/?experience=modern&motion=0#/r/${id}`);
      await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
      await walk(page, seen, `${adapter} session`);
      // The hostile text really is on screen as text (so the checks above looked at something).
      await expect(page.getByText('window.__pwned', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    }
    // The page asked only for this origin's own data, and nothing that carries captured content is cacheable.
    const origin = new URL(s.run.url).origin;
    expect(seen.responses.length).toBeGreaterThan(10);
    for (const r of seen.responses) {
      expect(new URL(r.url).origin).toBe(origin);
      expect(r.cache, r.url.replace(origin, '')).toBe('no-store');
      expect(r.type ?? '', r.url.replace(origin, '')).not.toMatch(/html/);
    }
  });
}

test('what the browser keeps: no token, no session id, no journal content, no service worker', async ({ page, context }) => {
  test.setTimeout(240_000);
  const seen = await observe(page);
  await page.goto(s.run.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  for (const { id } of recordings) {
    await page.goto(`${s.run.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
    await walk(page, seen, 'storage walk', 12);
  }
  // The address bar no longer carries the launch token.
  expect(page.url()).not.toContain(s.token);
  expect(page.url()).not.toContain('token=');

  const kept = await page.evaluate(async () => {
    const dump = (store: Storage) => Object.fromEntries(Object.keys(store).map((k) => [k, store.getItem(k) ?? '']));
    const databases = (await (indexedDB as unknown as { databases?: () => Promise<{ name?: string }[]> }).databases?.().catch(() => [])) ?? [];
    const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    const cacheNames = 'caches' in window ? await caches.keys() : [];
    return { local: dump(localStorage), session: dump(sessionStorage), databases: databases.map((d) => d.name), registrations: registrations.length, cacheNames, cookie: document.cookie };
  });
  const cookies = await context.cookies();
  const sid = cookies.find((c) => c.name === 'drishya_session');
  expect(sid, 'the session cookie exists').toBeTruthy();
  expect(sid!.httpOnly).toBe(true);
  expect(sid!.sameSite).toBe('Strict');
  expect(kept.cookie, 'script cannot read the cookie').not.toContain('drishya_session');

  // Keys are listed here so a new one is a visible change; values are searched, never printed.
  const keys = [...Object.keys(kept.local), ...Object.keys(kept.session)];
  expect(keys.filter((k) => !/^drishya[.\-/]/.test(k)), 'storage keys outside the drishya namespace').toEqual([]);
  const values = JSON.stringify(kept);
  for (const [name, secret] of [['launch token', s.token], ['session id', sid!.value], ['prompt text', 'PROMPT '], ['reply text', 'REPLY '], ['command output', 'OUTPUT '], ['payload', 'window.__pwned'], ['repository path', repo.replace(/\\/g, '\\\\')], ['repository path', repo]] as const) {
    expect(values.includes(secret), `${name} found in browser storage`).toBe(false);
  }
  expect(kept.databases).toEqual([]);
  expect(kept.registrations).toBe(0);
  expect(kept.cacheNames).toEqual([]);
  // What it keeps are small preferences and which cards were opened, by recording id and position: flags, not content.
  expect(keys.filter((k) => !/^drishya\.[A-Za-z]+$|^drishya-disclosures-v1\/rec_[0-9a-f]+\/[a-z-]+\/\d+$/.test(k)), 'a storage key this test has not seen before').toEqual([]);
  expect(Object.values({ ...kept.local, ...kept.session }).filter((v) => v.length > 64).length, 'a long value in browser storage').toBe(0);
});

test('control: the detectors do catch an injection (so a clean walk above means something)', async ({ page }) => {
  const seen = await observe(page);
  await page.goto(s.run.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<a href="javascript:void(0)" target="_blank">x</a><iframe></iframe><img src="http://127.0.0.1:9/leak.png">'));
  await page.waitForTimeout(300);
  await expect(invariants(page, seen, 'injected')).rejects.toThrow();
  await page.evaluate(() => { (window as unknown as { __pwned: string }).__pwned = 'hit'; });
  const hits = await page.evaluate(() => (window as unknown as { __hits: string[] }).__hits);
  expect(hits).toEqual(['hit']);
});
