// SEC-5 parts 1 and 2: what the npm package may contain, and that the daemon has no runtime dependencies.
// `package:verify` runs the same checker on the real built package (scripts/verify-package.ts); this file
// proves each rule fails when the thing it guards appears, so the real run is not a check that cannot fail.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  checkFile, checkManifest, checkPackage, checkPaths, checkSourceMap, foreignImports, localIdentity, type LocalIdentity,
} from '../../scripts/lib/package-contents.ts';
import { CANARIES } from './lib/secrets.ts';

const root = process.cwd();
const who: LocalIdentity = { home: 'C:\\Users\\someone-else', user: 'someone-else', workspace: 'D:\\work\\drishya' };

const goodManifest = {
  name: '@drishya-dev/cli', version: '0.1.0', license: 'Apache-2.0', type: 'module',
  repository: { type: 'git', url: 'git+https://github.com/drishya-dev/drishya.git' },
  publishConfig: { access: 'public', provenance: true },
  bin: { drishya: './apps/daemon/src/cli.mjs' },
};

describe('SEC-5 package allowlist: paths', () => {
  it('accepts the shapes the build produces', () => {
    expect(checkPaths([
      'package.json', 'LICENSE', 'BUILD.json', 'SHA256SUMS', 'apps/daemon/src/cli.mjs', 'apps/daemon/src/history-worker.mjs',
      'apps/daemon/src/chunk-KYZ4RF23.mjs', 'apps/daemon/src/commands-KXXD2ROC.mjs',
      'apps/ui/dist/index.html', 'apps/ui/dist/assets/index-DoktY-FK.js', 'apps/ui/dist/assets/index-BaS5tzNV.css',
      'apps/ui/dist/brand/drishya.svg', 'apps/ui/dist/fonts/Inter-OFL.txt', 'apps/ui/dist/demo/bundle.json',
      'fixtures/synthetic/claude/checkout-fix.jsonl', 'fixtures/synthetic/workspace/shop/src/cart/total.ts',
    ])).toEqual([]);
  });

  const bad: [string, RegExp][] = [
    ['.env', /environment file/],
    ['apps/ui/dist/.env.local', /environment file/],
    ['.local/session.png', /local scratch folder/],
    ['.claude/settings.json', /local scratch folder/],
    ['.vscode/settings.json', /editor or tooling settings/],
    ['.npmrc', /editor or tooling settings/],
    ['.git/config', /editor or tooling settings/],
    ['node_modules/x/index.js', /dependency folder/],
    ['data/drishya.sqlite', /store, database or blob file/],
    ['data/store.db-wal', /store, database or blob file/],
    ['keys/id_rsa', /key or certificate/],
    ['server.pem', /key or certificate/],
    ['docs/screenshot-home.png', /screenshot or capture/],
    ['test-results/trace.zip', /screenshot or capture/],
    ['fixtures/redacted/real.jsonl', /real-journal folder/],
    ['fixtures/local/real.jsonl', /real-journal folder/],
    ['sessions/rollout-2026-11-01.jsonl', /journal outside the synthetic fixtures/],
    ['apps/daemon/src/cli.ts', /TypeScript source/],
    ['binding.gyp', /install-time script or native build file/],
    ['scripts/postinstall.js', /install-time script or native build file/],
    ['build/addon.node', /install-time script or native build file/],
  ];
  for (const [path, why] of bad) {
    it(`refuses ${path}`, () => {
      const found = checkPaths([path]);
      expect(found).toHaveLength(1);
      expect(found[0]).toMatch(why);
    });
  }

  it('refuses anything not on the list, even an innocent-looking file', () => {
    expect(checkPaths(['notes.txt', 'apps/daemon/src/extra.js', 'apps/ui/dist/assets/app.js.map', 'README.md', 'apps/ui/dist/assets/a b.js']).every((p) => /not on the allowlist/.test(p))).toBe(true);
    expect(checkPaths(['notes.txt', 'apps/daemon/src/extra.js'])).toHaveLength(2);
  });

  it('lets invented journals and sources live only under fixtures/synthetic', () => {
    expect(checkPaths(['fixtures/synthetic/codex/rollout.jsonl', 'fixtures/synthetic/workspace/shop/src/a.ts'])).toEqual([]);
    expect(checkPaths(['fixtures/other/rollout.jsonl'])).toHaveLength(1);
  });
});

describe('SEC-5 package allowlist: manifest', () => {
  it('accepts the generated manifest', () => {
    expect(checkManifest(goodManifest)).toEqual([]);
  });
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepack']) {
    it(`refuses an ${hook} script`, () => {
      expect(checkManifest({ ...goodManifest, scripts: { [hook]: 'node x.js' } }).join()).toMatch(new RegExp(`script "${hook}"`));
    });
  }
  it('refuses any dependency, a workspace dependency and a native build', () => {
    expect(checkManifest({ ...goodManifest, dependencies: { left: '^1.0.0' } }).join()).toMatch(/"dependencies" present/);
    expect(checkManifest({ ...goodManifest, dependencies: { '@drishya/store': 'workspace:*' } }).join()).toMatch(/workspace dependency/);
    expect(checkManifest({ ...goodManifest, optionalDependencies: { left: '1' } }).join()).toMatch(/optionalDependencies/);
    expect(checkManifest({ ...goodManifest, peerDependencies: { left: '1' } }).join()).toMatch(/peerDependencies/);
    expect(checkManifest({ ...goodManifest, gypfile: true }).join()).toMatch(/gypfile/);
  });
  it('requires provenance and a repository', () => {
    expect(checkManifest({ ...goodManifest, publishConfig: { access: 'public' } }).join()).toMatch(/provenance/);
    const { repository: _repository, ...noRepository } = goodManifest;
    expect(checkManifest(noRepository).join()).toMatch(/repository/);
  });
});

describe('SEC-5 package allowlist: contents of files', () => {
  const none = new Set<string>();
  const check = (path: string, text: string, packed = none) => checkFile(path, Buffer.from(text), who, packed);

  it('passes ordinary code and the invented sessions\' own sandbox path', () => {
    expect(check('apps/ui/dist/assets/index-a.js', 'const a = "/home/dev/shop/src/cart.ts"; const b = "C:/not-a-user-path";')).toEqual([]);
  });
  it('refuses absolute local paths of every kind', () => {
    for (const text of ['at C:\\Users\\jane\\code\\x.ts:1', '"/Users/jane/code/x.ts"', 'in /home/jane/repo/src', 'file:///C:/work/x', '\\\\server\\share\\file']) {
      expect(check('apps/daemon/src/cli.mjs', text).join(), text).toMatch(/absolute local path/);
    }
  });
  it('refuses this machine\'s own home, workspace and user name', () => {
    expect(check('a.json', '{"p":"c:/users/someone-else/x"}').join()).toMatch(/home folder/);
        expect(check('a.json', 'D:/work/drishya/apps').join()).toMatch(/workspace folder/);
    expect(check('a.json', '{"p":"/mnt/x/someone-else/y"}').join()).toMatch(/user name/);
  });
  it('refuses a secret matching any redaction rule, found in a packed file', () => {
    for (const canary of CANARIES.filter((c) => c.rule !== 'secret-assignment').slice(0, 8)) {
      expect(check('fixtures/synthetic/x.jsonl', `{"output":${JSON.stringify(canary.text)}}`).join(), canary.rule).toMatch(/redaction rule/);
    }
  });
  it('allows only the exact invented secrets the fixtures carry on purpose', () => {
    const gh = CANARIES.find((c) => c.rule === 'github-token')!;
    expect(check('fixtures/synthetic/antigravity/corpus.ndjson', gh.text)).toEqual([]);
    expect(check('fixtures/synthetic/antigravity/corpus.ndjson', `${gh.text} ${gh.text}`).join()).toMatch(/github-token/);
    expect(check('fixtures/synthetic/claude/other.jsonl', gh.text).join()).toMatch(/github-token/);
  });

  it('source maps: relative sources pass; absolute sources, a dangling reference and inline maps are checked', () => {
    const relative = JSON.stringify({ version: 3, sources: ['../../src/a.ts'], mappings: '' });
    const absolute = JSON.stringify({ version: 3, sources: ['C:\\Users\\jane\\src\\a.ts'], mappings: '' });
    const rooted = JSON.stringify({ version: 3, sources: ['/home/jane/src/a.ts'], mappings: '' });
    expect(checkSourceMap('a.js.map', relative, who)).toEqual([]);
    expect(checkSourceMap('a.js.map', absolute, who).join()).toMatch(/absolute path/);
    expect(checkSourceMap('a.js.map', rooted, who).join()).toMatch(/absolute path/);
    expect(checkSourceMap('a.js.map', '{not json', who).join()).toMatch(/not valid JSON/);
    expect(check('apps/ui/dist/assets/a.js', 'x\n//# sourceMappingURL=a.js.map').join()).toMatch(/not in the package/);
    expect(check('apps/ui/dist/assets/a.js', 'x\n//# sourceMappingURL=a.js.map', new Set(['apps/ui/dist/assets/a.js.map']))).toEqual([]);
    const inline = Buffer.from(absolute).toString('base64');
    expect(check('apps/ui/dist/assets/a.js', `x\n//# sourceMappingURL=data:application/json;base64,${inline}`).join()).toMatch(/inline map\).*absolute path/);
  });

  it('binary files are not read as text', () => {
    expect(check('apps/ui/dist/fonts/a.woff2', 'C:\\Users\\jane\\x')).toEqual([]);
  });
});

describe('SEC-5 package allowlist: imports of the bundled daemon', () => {
  it('finds only specifiers that are neither node: built-ins nor files beside the entry', () => {
    const source = [
      'import fs from "node:fs";', 'import { a } from "./chunk-ABCDEFGH.mjs";', 'import left from "left-pad";',
      'export { b } from "@scope/pkg";', 'import "side-effect";', 'const x = await import("dyn-dep");', 'const y = __require("legacy");',
      'const text = "this comes from \'nowhere\' and imports from \'prose\'";',
    ].join('\n');
    expect(foreignImports(source)).toEqual(['@scope/pkg', 'dyn-dep', 'left-pad', 'legacy', 'side-effect']);
  });
});

describe('SEC-5 zero runtime dependencies', () => {
  interface Manifest { name: string; private?: boolean; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: object; peerDependencies?: object }
  const read = (path: string) => JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')) as Manifest;
  const folders = [...readdirSync(join(root, 'packages')).map((n) => `packages/${n}`), 'apps/daemon'];
  const manifests = new Map(folders.filter((f) => existsSync(join(root, f, 'package.json'))).map((f) => [f, read(f)]));
  const byName = new Map([...manifests].map(([folder, m]) => [m.name, folder]));

  // Everything the daemon reaches through `workspace:*`: the code that is bundled into the one published file set.
  function closure(): string[] {
    const seen = new Set<string>(); const queue = ['apps/daemon'];
    while (queue.length) {
      const folder = queue.pop()!;
      if (seen.has(folder)) continue;
      seen.add(folder);
      for (const name of Object.keys(manifests.get(folder)!.dependencies ?? {})) {
        const next = byName.get(name);
        if (next) queue.push(next);
      }
    }
    return [...seen].sort();
  }

  it('the daemon reaches the workspace packages and each lists only workspace links', () => {
    const reached = closure();
    expect(reached.length).toBeGreaterThanOrEqual(10);
    for (const folder of reached) {
      const m = manifests.get(folder)!;
      for (const [name, spec] of Object.entries(m.dependencies ?? {})) {
        expect(spec, `${folder} depends on ${name}`).toBe('workspace:*');
        expect(name.startsWith('@drishya/'), `${folder} depends on ${name}`).toBe(true);
      }
      expect(m.optionalDependencies, `${folder} optionalDependencies`).toBeUndefined();
      expect(m.peerDependencies, `${folder} peerDependencies`).toBeUndefined();
    }
  });

  it('no package the daemon reaches declares an install script', () => {
    for (const folder of closure()) {
      const scripts = Object.keys(manifests.get(folder)!.scripts ?? {});
      expect(scripts.filter((s) => /^(?:pre|post)?(?:install|prepare|publish|pack)$/.test(s)), folder).toEqual([]);
    }
  });

  it('the lockfile agrees: those packages resolve to links inside the workspace and nothing from the registry', () => {
    const lock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8').replace(/\r\n/g, '\n');
    const importers = lock.slice(lock.indexOf('\nimporters:'), lock.indexOf('\npackages:'));
    for (const folder of closure()) {
      if (importers.includes(`\n  ${folder}: {}`)) continue; // no dependencies of any kind
      const start = importers.indexOf(`\n  ${folder}:\n`);
      expect(start, `${folder} in the lockfile`).toBeGreaterThan(-1);
      const next = importers.indexOf('\n\n  ', start + 1);
      const section = importers.slice(start, next === -1 ? undefined : next);
      const versions = [...section.matchAll(/^\s{8}version: (.+)$/gm)].map((m) => m[1]!);
      for (const version of versions) expect(version, `${folder} lockfile entry`).toMatch(/^link:\.\.\//);
    }
  });

  it('the published manifest is generated with no dependencies and the build writes nothing else into it', () => {
    const builder = readFileSync(join(root, 'scripts/build-package.ts'), 'utf8');
    expect(builder).not.toMatch(/\bdependencies\s*:/);
    expect(builder).not.toMatch(/\bscripts\s*:/);
    expect(builder).toMatch(/provenance:\s*true/);
  });

  it('the built daemon (when built) imports only node: built-ins and its own chunks', () => {
    const dir = join(root, 'dist/package/apps/daemon/src');
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
      expect(foreignImports(readFileSync(join(dir, file), 'utf8')), file).toEqual([]);
    }
  });
});

describe('SEC-5 the real built package', () => {
  const dir = resolve(root, 'dist/package');
  it.skipIf(!existsSync(join(dir, 'package.json')))('passes the allowlist (package:verify builds it first)', () => {
    const nodeDir = resolve(process.execPath, '..');
    const npmCli = [join(nodeDir, 'node_modules/npm/bin/npm-cli.js'), join(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js')].find(existsSync)!;
    const listing = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8' })) as { files: { path: string }[] }[];
    expect(checkPackage(dir, listing[0]!.files.map((f) => f.path), localIdentity(root))).toEqual([]);
  });
});

describe('SEC-5 outbound-traffic recorder (the walk of the built package)', () => {
  it('records a loopback connect, a connect beyond loopback, a name lookup and a started program', async () => {
    const { createServer } = await import('node:net');
    const { mkdtempSync, readFileSync: read, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { pathToFileURL } = await import('node:url');
    const { spawnSync } = await import('node:child_process');
    const { outboundProblems } = await import('../../scripts/lib/package-contents.ts');
    const dir = mkdtempSync(join(tmpdir(), 'drishya-recorder-'));
    const log = join(dir, 'log');
    const listener = createServer((socket) => socket.end());
    await new Promise<void>((done) => listener.listen(0, '127.0.0.1', done));
    const port = (listener.address() as { port: number }).port;
    const script = [
      "const net = require('node:net'); const cp = require('node:child_process');",
      `net.connect(${port}, '127.0.0.1').on('error', () => {});`,
      // 192.0.2.0/24 is documentation space: never routed, so this attempt cannot reach anyone.
      "net.connect({ host: '192.0.2.1', port: 9 }).on('error', () => {});",
      "require('node:dns').lookup('example.invalid', () => {});",
      "cp.spawnSync(process.execPath, ['-e', '0']);",
      'setTimeout(() => process.exit(0), 300);',
    ].join(' ');
    try {
      const run = spawnSync(process.execPath, ['--import', pathToFileURL(join(root, 'scripts/lib/net-recorder.mjs')).href, '-e', script], {
        env: { ...process.env, DRISHYA_NET_LOG: log }, timeout: 15_000, encoding: 'utf8',
      });
      expect(run.status, run.stderr).toBe(0);
      const seen = outboundProblems(read(log, 'utf8'));
      expect(seen.problems).toContain('tcp 192.0.2.1:9');
      expect(seen.problems).toContain('dns example.invalid');
      expect(seen.problems.join()).not.toMatch(/127\.0\.0\.1/);
      expect(seen.programs).toContain('node.exe'.replace('.exe', process.platform === 'win32' ? '.exe' : ''));
    } finally {
      listener.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts only loopback, name lookups of localhost and local sockets', async () => {
    const { outboundProblems } = await import('../../scripts/lib/package-contents.ts');
    const lines = [
      { kind: 'tcp', target: '127.0.0.1:7878' }, { kind: 'tcp', target: 'localhost:80' }, { kind: 'tcp', target: '::1:80' },
      { kind: 'tcp', target: 'ipc:\\\\.\\pipe\\x' }, { kind: 'dns', target: 'localhost' }, { kind: 'program', target: 'git' },
    ].map((e) => JSON.stringify(e)).join('\n');
    expect(outboundProblems(lines).problems).toEqual([]);
    expect(outboundProblems(JSON.stringify({ kind: 'tcp', target: '203.0.113.9:443' })).problems).toEqual(['tcp 203.0.113.9:443']);
    expect(outboundProblems(JSON.stringify({ kind: 'dns', target: 'registry.npmjs.org' })).problems).toEqual(['dns registry.npmjs.org']);
    expect(outboundProblems(JSON.stringify({ kind: 'udp', target: '8.8.8.8:53' })).problems).toEqual(['udp 8.8.8.8:53']);
  });
});
