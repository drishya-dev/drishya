import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readVerifiedFile } from '../../scripts/lib/read-verified-file.ts';

const tempRoot = realpathSync(tmpdir());
let scratch: string;
beforeEach(() => { scratch = realpathSync(mkdtempSync(join(tempRoot, 'drishya-sec4-inputs-'))); });
afterEach(() => {
  if (dirname(scratch) !== tempRoot) throw new Error('Unexpected scratch directory');
  rmSync(scratch, { recursive: true, force: true });
});

it('reads the exact bytes of a synthetic local input at its size limit', () => {
  const file = join(scratch, 'frame.dat');
  const bytes = Buffer.from([0, 27, 128, 255]);
  writeFileSync(file, bytes);
  expect(readVerifiedFile(file, bytes.length)).toEqual(bytes);
  expect(readVerifiedFile(file)).toEqual(bytes);
});

it('stops when a regular local input exceeds its declared limit', () => {
  const file = join(scratch, 'capture.json');
  writeFileSync(file, '{"complete":true}');
  expect(() => readVerifiedFile(file, 8)).toThrow('byte limit');
});
