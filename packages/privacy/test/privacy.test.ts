import { describe, expect, it } from 'vitest';
import { isDeniedPath, mentionsDeniedPath, redactText, sanitize } from '../src/index.ts';

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
  it('preserves own prototype-named keys without changing the result prototype', () => {
    const input = JSON.parse('{"__proto__":"captured","constructor":"also captured"}');
    const result = sanitize(input).value;
    expect(JSON.stringify(result)).toContain('"__proto__":"captured"');
    expect(JSON.stringify(result)).toContain('"constructor":"also captured"');
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

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

  // Audit A01: the fields kept beside a dropped base64 payload were returned unsanitized.
  it('sanitizes the fields kept beside a dropped base64 payload', () => {
    const r = sanitize({ result: { base64: 'iVBORw0KGgo', note: `uploaded with ${GH}`, meta: { auth: [ANT] } } });
    const out = JSON.stringify(r.value);
    expect(out).not.toContain('iVBOR');
    expect(out).not.toContain(GH);
    expect(out).not.toContain(ANT);
    expect(r.value.result.note).toContain('[REDACTED:github-token]');
    expect(r.omitted).toBe(true);
  });

  // Audit A01: object keys were never scrubbed, and the original key also leaked into redaction notes.
  it('redacts secrets used as object keys, including in redaction notes', () => {
    const r = sanitize({ headers: { [GH]: true, [`x-${OAI}`]: { nested: NV } } });
    const out = JSON.stringify(r);
    for (const s of [GH, OAI, NV]) expect(out).not.toContain(s);
    expect(Object.keys(r.value.headers)).toContain('[REDACTED:github-token]');
    expect(r.redactions.some((n) => n.field.startsWith('headers.') && n.rule === 'github-token')).toBe(true);
  });

  it('never lets a redacted key overwrite another field', () => {
    const a = 'gh' + 'p_' + rnd(36, 'Zy9Xw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe');
    const r = sanitize({ [GH]: 'first', [a]: 'second', '[REDACTED:github-token]': 'existing' });
    const values = Object.values(r.value as Record<string, string>).sort();
    expect(values).toEqual(['existing', 'first', 'second']);
    expect(JSON.stringify(r)).not.toContain(GH);
    expect(JSON.stringify(r)).not.toContain(a);
  });

  // B0 leftover: inside a protected scope, only paths and short type labels may survive, whatever
  // the field names; content under an unexpected key used to pass through.
  it('omits every string in a protected file scope except paths and short type labels', () => {
    const r = sanitize({ type: 'text', filePath: 'app/.env', data: 'PLAIN=hunter3hunter3', meta: { note: 'hunter3hunter3' }, lines: ['hunter3hunter3'] });
    expect(JSON.stringify(r.value)).not.toContain('hunter3');
    expect(r.value.filePath).toBe('app/.env');
    expect(r.value.type).toBe('text');
  });

  it('denyContent omits strings under unexpected keys too, keeping the outcome kind', () => {
    const r = sanitize({ outcome: { kind: 'shell', body: 'PLAIN=hunter3hunter3', extra: { blob: 'hunter3hunter3' } } }, { denyContent: true });
    expect(JSON.stringify(r.value)).not.toContain('hunter3');
    expect(r.value.outcome.kind).toBe('shell');
  });

  it.each([
    ['cat .env', true],
    ['grep TOKEN config/.env.production | head', true],
    [`source "$HOME/.env" && run`, true],
    ['cp ~/.ssh/id_ed25519 /tmp/k', true],
    ['*** Begin Patch\n*** Update File: deploy/.env\n+X=1\n*** End Patch', true],
    ['cat .env.example', false],
    ['cat src/app.env.ts', false],
    ['sed -n 1,20p src/checkout/guard.ts', false],
  ])('recognises a protected file named in %j → %s', (text, expected) => {
    expect(mentionsDeniedPath(text)).toBe(expected);
  });

  // Truncation used to happen before matching, so a secret straddling the cut kept its head.
  it('redacts a secret that straddles the truncation boundary', () => {
    // The cut leaves "sk-ant-" plus 15 characters: too short for any rule, yet most of the key.
    const head = ANT.slice(0, 22);
    const r = sanitize({ text: 'a'.repeat(95) + ' ' + ANT + ' tail' }, { maxStringBytes: 96 + head.length });
    expect(r.value.text).not.toContain(head);
    expect(r.value.text).toContain('TRUNCATED');
    expect(r.omitted).toBe(true);
  });
});
