// TEST-3: the browser suite in two passes, the parallel project on several workers, then the timing-sensitive specs alone.
// Extra arguments (spec names, --grep, --repeat-each) go to both passes. Exit status is non-zero if either pass fails.
import { spawnSync } from 'node:child_process';

const extra = process.argv.slice(2);
const pass = (args: string[]) => spawnSync('pnpm', ['exec', 'playwright', 'test', '--pass-with-no-tests', ...args, ...extra], { stdio: 'inherit', shell: true }).status ?? 1;
const parallel = pass(['--project=parallel', `--workers=${process.env.DRISHYA_WORKERS || '4'}`]);
const serial = pass(['--project=serial', '--workers=1']);
process.exit(parallel || serial ? 1 : 0);
