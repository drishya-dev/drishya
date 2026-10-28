// TEST-3: run what a change can break, not the whole gate. Tier 1 and 2 of AGENTS.md "Definition of done".
//   node scripts/check-affected.ts [--base origin/main] [--dry] [--all]
// Changed files = everything differing from the merge-base with --base (commits, working tree, untracked). Runs the typecheck, the unit
// tests that import a changed file (`vitest related`), and the browser specs that name a changed file or component. Files that every
// screen depends on (History, the reducer, the scene composer, the daemon entry points, shared CSS, test config) run the whole browser
// suite on the parallel runner instead. Docs-only changes run nothing. --dry prints the plan.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { base: { type: 'string' }, dry: { type: 'boolean' }, all: { type: 'boolean' } } });
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').map((l) => l.trim()).filter(Boolean);
const base = values.base ?? 'origin/main';
const mergeBase = git('merge-base', base, 'HEAD')[0]!;
const changed = [...new Set([...git('diff', '--name-only', mergeBase), ...git('ls-files', '-o', '--exclude-standard')])];
const code = changed.filter((f) => !f.startsWith('docs/') && !f.endsWith('.md'));
if (!code.length) { console.log(`docs only (${changed.length} files): nothing to run`); process.exit(0); }

const wide = /^(apps\/ui\/src\/(App|main|store|api)\.|apps\/ui\/src\/(modern|styles?)\/.*\.css$|apps\/ui\/src\/components\/(History|ProductShell|Viewer)\.tsx$|packages\/projection\/src\/reduce\.ts$|packages\/scene\/src\/index\.ts$|packages\/contracts\/src\/index\.ts$|apps\/daemon\/src\/(server|app|history-worker)\.ts$|playwright\.config\.ts$|package\.json$|pnpm-lock\.yaml$)/;
const wideHit = code.filter((f) => wide.test(f));
const touchesUi = code.some((f) => /^(apps\/ui\/|apps\/daemon\/|packages\/(scene|projection|contracts|adapter-[a-z-]+)\/|tests\/browser\/)/.test(f));
const unitTargets = code.filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('tests/browser/') && !f.startsWith('scripts/'));
const fullUnits = code.some((f) => /^(package\.json|pnpm-lock\.yaml|tsconfig.*|vitest\.config.*)$/.test(f));

const specs = readdirSync('tests/browser').filter((f) => f.endsWith('.spec.ts'));
const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const generic = new Set(['index', 'api', 'types', 'store', 'utils', 'util', 'app', 'main', 'styles', 'style', 'test', 'tests']);
const mapped = new Set<string>(code.filter((f) => f.startsWith('tests/browser/') && f.endsWith('.spec.ts')).map((f) => basename(f)));
for (const file of code.filter((f) => !f.startsWith('tests/') && !f.startsWith('scripts/'))) {
  const name = basename(file, extname(file));
  if (generic.has(name.toLowerCase())) continue;
  const dashed = kebab(name);
  for (const spec of specs) {
    const body = readFileSync(join('tests/browser', spec), 'utf8');
    if (spec.includes(dashed) || body.includes(name) || body.includes(`/${dashed}`)) mapped.add(spec);
  }
}

const whole = values.all || wideHit.length > 0;
const plan = [
  `changed: ${changed.length} files (${code.length} code), base ${base}`,
  'typecheck: both projects',
  `units: ${fullUnits ? 'all (build or lock file changed)' : unitTargets.length ? `related to ${unitTargets.length} changed files` : 'none related'}`,
  `browser: ${!touchesUi ? 'not affected' : whole ? `whole suite (${values.all ? '--all' : `wide files: ${wideHit.slice(0, 3).join(', ')}${wideHit.length > 3 ? ', …' : ''}`})` : mapped.size ? `${mapped.size} specs: ${[...mapped].join(' ')}` : 'no spec names these files; run the specs for the screen you changed, or --all'}`,
];
console.log(plan.map((l) => `  ${l}`).join('\n'));
if (values.dry) process.exit(0);

const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { stdio: 'inherit', shell: true }).status ?? 1;
let failed = 0;
const step = (label: string, status: number) => { console.log(`${status ? 'FAIL' : 'ok  '} ${label}`); failed ||= status; };
step('typecheck', run('pnpm', ['typecheck']));
if (fullUnits) step('units (all)', run('pnpm', ['test']));
else if (unitTargets.length) step('units (related)', run('pnpm', ['exec', 'vitest', 'related', '--run', '--passWithNoTests', ...unitTargets]));
if (touchesUi && (whole || mapped.size)) {
  step('ui build', run('pnpm', ['ui:build']));
  step('browser', run('node', ['scripts/test-browser.ts', ...(whole ? [] : [...mapped])]));
}
process.exit(failed ? 1 : 0);
