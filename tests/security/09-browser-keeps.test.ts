// SEC-3 item 9, the part that needs no browser: what the page's source and build may keep. The part that runs
// in a real browser (actual storage contents, cookies, cache entries) is tests/browser/security-injected.spec.ts.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const walk = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(join(dir, e.name))) : [join(dir, e.name)])) : []);
const ui = walk(join(root, 'apps', 'ui', 'src')).filter((f) => /\.(tsx?|jsx?)$/.test(f) && !/\.test\./.test(f));
const read = (f: string) => readFileSync(f, 'utf8');

describe('what the page may keep', () => {
  it('no service worker, no Cache API, no IndexedDB, no web SQL, no cookie written by script', () => {
    const offenders = ui.filter((f) => /serviceWorker|caches\.(?:open|match|keys)|indexedDB|openDatabase|document\.cookie\s*=/.test(read(f)));
    expect(offenders.map((f) => f.slice(root.length + 1))).toEqual([]);
    for (const dir of ['apps/ui/public', 'apps/ui/dist']) {
      const names = walk(join(root, dir)).map((f) => f.slice(join(root, dir).length + 1).replace(/\\/g, '/'));
      expect(names.filter((n) => /(^|\/)(sw|service-?worker|workbox[^/]*)\.js$|manifest\.webmanifest$/i.test(n)), dir).toEqual([]);
    }
  });

  it('every localStorage and sessionStorage key is in the drishya namespace', () => {
    const keys = new Set<string>();
    for (const f of ui) for (const m of read(f).matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([`'"])([^`'"]+)\1/g)) keys.add(m[2]!);
    expect([...keys].filter((k) => !/^drishya/.test(k) && !/^\$\{storageKey\}\//.test(k))).toEqual([]);
    expect(keys.size).toBeGreaterThan(3);
  });

  it('nothing writes the launch token, a prompt or a tool result into storage, a cookie or the address bar', () => {
    for (const f of ui) {
      const source = read(f);
      // Storage writes never take a token or a captured string; the key/value pairs are preferences and disclosure flags.
      for (const m of source.matchAll(/(?:localStorage|sessionStorage)\.setItem\([^;]*\)/g)) expect(m[0], f).not.toMatch(/token|prompt|\.text\b|output|content|message|command|session/i);
    }
    const api = read(join(root, 'apps', 'ui', 'src', 'api.ts'));
    // The token is read from the fragment, sent once as a header, and removed from the address bar.
    expect(api).toMatch(/location\.hash/);
    expect(api).toMatch(/history\.replaceState\(null, '', location\.pathname \+ location\.search\)/);
    expect(api).not.toMatch(/\?token=|[&?]access_token=/);
  });

  it('the page never sends the token in a URL', () => {
    for (const f of ui) expect(read(f), f).not.toMatch(/[?&]token=\$\{|[?&]token=['"`]\s*\+/);
  });
});
