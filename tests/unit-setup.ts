import {afterAll} from 'vitest';
import {useSyntheticHarnessHomes} from '../scripts/synthetic-harness-homes.ts';

// Before adapter imports: synthetic tests must not scan the developer's native
// sessions. Root afterAll runs after each file's fixture teardown.
const dispose=useSyntheticHarnessHomes();
afterAll(dispose);
