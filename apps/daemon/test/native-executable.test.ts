import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executable } from '../src/native-executable.ts';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() { const root = mkdtempSync(join(tmpdir(), 'drishya-cli-')); roots.push(root); return root; }
function file(root: string, ...parts: string[]) { const path = join(root, ...parts); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, 'synthetic'); return path; }
test('finds npm native Codex without PATH and never returns a cmd shim', () => {
  const root = fixture(); file(root, 'npm', 'codex.cmd');
  const native = file(root, 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
  expect(executable('codex', { env: { APPDATA: root, PATH: '' }, platform: 'win32', arch: 'x64' })).toBe(native);
  expect(executable('codex', { env: { APPDATA: root, PATH: '' }, platform: 'win32', arch: 'arm64' })).toBeUndefined();
});
test('prefers PATH, then newest desktop native version over legacy root', () => {
  const root = fixture(); const old = file(root, 'OpenAI', 'Codex', 'bin', 'aaaaaaaa', 'codex.exe');
  utimesSync(old, new Date(0), new Date(0));
  const latest = file(root, 'OpenAI', 'Codex', 'bin', 'bbbbbbbb', 'codex.exe');
  file(root, 'OpenAI', 'Codex', 'bin', 'codex.exe');
  const env = { LOCALAPPDATA: root, PATH: '' };
  expect(executable('codex', { env, platform: 'win32', arch: 'x64' })).toBe(latest);
  const direct = file(root, 'path', 'codex.exe');
  expect(executable('codex', { env: { ...env, PATH: join(root, 'path') }, platform: 'win32', arch: 'x64' })).toBe(direct);
});
test('does not resolve directories, unrelated names or shell-only installations', () => {
  const root = fixture(); file(root, 'codex.cmd'); mkdirSync(join(root, 'codex.exe'));
  expect(executable('codex', { env: { PATH: root }, platform: 'win32' })).toBeUndefined();
  expect(executable('other', { env: { APPDATA: root }, platform: 'win32' })).toBeUndefined();
});
