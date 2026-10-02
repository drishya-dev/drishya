import { describe, expect, it } from 'vitest';
import { isDeniedPath, redactText, sanitize } from '../src/index.ts';

// Secrets are assembled at runtime so no token-shaped literal is ever committed.
const rnd = (n: number, alphabet = 'aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY') =>
  Array.from({ length: n }, (_, i) => alphabet[(i * 7 + 3) % alphabet.length]).join('');
const GH = 'gh' + 'p_' + rnd(36);
const AWS = 'AK' + 'IA' + 'Q3XZ7WPL4MNB2VCD';
const ANT = 'sk-' + 'ant-' + rnd(40);
const OAI = 'sk-' + 'proj-' + rnd(40);
const NV = 'nv' + 'api-' + rnd(40);
const JWT = 'ey' + 'J' + rnd(20) + '.ey' + 'J' + rnd(20) + '.' + rnd(24);

describe('redactText', () => {
  it.each([
    ['github-token', `export GITHUB_TOKEN=${GH}`],
    ['aws-access-key', `aws_access_key_id = ${AWS}`],
    ['anthropic-key', `key: ${ANT}`],
    ['openai-key', `OPENAI=${OAI}`],
    ['nvidia-key', `NVIDIA_API_KEY="${NV}"`],
    ['jwt', `cookie ${JWT}`],
  ])('removes %s', (rule, input) => {
    const r = redactText(input);
    expect(r.text).toContain(`[REDACTED:${rule}]`);
    for (const s of [GH, AWS, ANT, OAI, NV, JWT]) expect(r.text).not.toContain(s);
  });

  it('removes private key blocks whole', () => {
    const pem = ['-----BEGIN ' + 'RSA PRIVATE KEY-----', rnd(64), rnd(64), '-----END RSA PRIVATE KEY-----'].join('\n');
    const r = redactText(`before\n${pem}\nafter`);
    expect(r.text).toBe('before\n[REDACTED:private-key]\nafter');
  });

  it('removes credentials inside URLs but keeps the host', () => {
    const r = redactText(`postgres://admin:${rnd(16)}@db.internal:5432/app`);
    expect(r.text).toBe('postgres://admin:[REDACTED:url-credentials]@db.internal:5432/app');
  });

  it('redacts high-entropy secret assignments', () => {
    const r = redactText(`const dbPassword = "${rnd(24)}";`);
    expect(r.text).toContain('[REDACTED:secret-assignment]');
  });

  it('keeps ordinary code and placeholders', () => {
    const code = [
      'const token = getToken();',
      'password: process.env.DB_PASSWORD',
      'API_KEY=your-api-key-here',
      'auth = authenticate(user)',
      'commit 3f5e2a9c1b7d4e6f8a0b2c4d6e8f0a1b3c5d7e9f',
      'if (total <= 0) throw new Error("empty cart")',
    ].join('\n');
    expect(redactText(code).text).toBe(code);
  });
});

describe('sanitize', () => {
  it('deep-redacts every string and reports where', () => {
    const r = sanitize({ input: { command: `curl -H "Authorization: Bearer ${rnd(32)}" x` }, list: [GH] });
    expect(JSON.stringify(r.value)).not.toContain(GH);
    expect(r.redactions.map((n) => n.field).sort()).toEqual(['input.command', 'list[0]']);
  });

  it('drops the content of protected files but keeps their path', () => {
    const r = sanitize({ file: { filePath: 'app/.env', content: 'DB=local\nSECRET=x' } });
    expect(r.value.file.filePath).toBe('app/.env');
    expect(r.value.file.content).toMatch(/OMITTED/);
    expect(r.omitted).toBe(true);
  });

  it('keeps example env files', () => {
    expect(isDeniedPath('.env.example')).toBe(false);
    expect(isDeniedPath('config/.env.production')).toBe(true);
    expect(isDeniedPath('C:\\keys\\server.pem')).toBe(true);
    expect(isDeniedPath('src/keyboard.ts')).toBe(false);
  });

  it('never keeps images', () => {
    const r = sanitize({ content: [{ type: 'image', source: { type: 'base64', data: 'iVBORw0KGgo' } }] });
    expect(JSON.stringify(r.value)).not.toContain('iVBOR');
    expect(r.omitted).toBe(true);
  });

  it('denyContent omits content strings for results of protected reads', () => {
    const r = sanitize({ text: 'SECRET=1' }, { denyContent: true });
    expect(r.value.text).toMatch(/OMITTED/);
  });

  it('bounds oversized strings', () => {
    const r = sanitize({ text: 'a'.repeat(100) }, { maxStringBytes: 10 });
    expect(r.value.text.startsWith('a'.repeat(10))).toBe(true);
    expect(r.value.text).toContain('TRUNCATED');
  });
});
