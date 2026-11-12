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

// SEC-2: synthetic token fixtures built at runtime so no literal token shape is committed.
const PYPI = 'py' + 'pi-' + 'AgE' + rnd(80);
const GL_PAT = 'gl' + 'pat-' + rnd(20);
const GL_DEPLOY = 'gl' + 'dt-' + rnd(20);
const DOCKER = 'dc' + 'kr_pat_' + rnd(27);
const DO = 'do' + 'p_v1_' + '0123456789abcdef'.repeat(4);
const SG = 'S' + 'G.' + rnd(22) + '.' + rnd(43);
const TWILIO_HEX = 'SK' + '0123456789abcdef0123456789abcdef';
const SHOPIFY_AT = 'sh' + 'pat_' + 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const SHOPIFY_SS = 'sh' + 'pss_' + 'f0e1d2c3b4a5968778695a4b3c2d1e0f';
const AZURE_KEY = rnd(64) + '==';
const DATABRICKS = 'da' + 'pi' + 'a1b2c3d4e5f60718293a4b5c6d7e8f90-2';
const LINEAR = 'lin_' + 'api_' + rnd(40);
const NOTION_SECRET = 'sec' + 'ret_' + rnd(43);
const NOTION_NTN = 'nt' + 'n_' + rnd(46);
const DISCORD = Buffer.from('123456789012345678', 'ascii').toString('base64url') + '.' + rnd(6) + '.' + rnd(32);

describe('SEC-2 token formats and near-misses', () => {
  it.each([
    ['pypi-token', `poetry config pypi-token.pypi ${PYPI}`, PYPI],
    ['pypi-token', `https://__token__:${PYPI}@test.pypi.org/legacy/`, PYPI],
    ['gitlab-token', `git clone https://oauth2:${GL_PAT}@gitlab.example/repo`, GL_PAT],
    ['gitlab-token', `DEPLOY=${GL_DEPLOY}`, GL_DEPLOY],
    ['docker-token', `echo ${DOCKER} | docker login --password-stdin`, DOCKER],
    ['digitalocean-token', `DIGITALOCEAN_ACCESS_TOKEN=${DO}`, DO],
    ['sendgrid-key', `SENDGRID_API_KEY=${SG}`, SG],
    ['twilio-key', `TWILIO_API_KEY=${TWILIO_HEX}`, TWILIO_HEX],
    ['twilio-key', `curl -u ${TWILIO_HEX}:secret https://api.twilio.com/2010`, TWILIO_HEX],
    ['shopify-token', `SHOPIFY_TOKEN="${SHOPIFY_AT}"`, SHOPIFY_AT],
    ['shopify-token', `SHOPIFY_SECRET="${SHOPIFY_SS}"`, SHOPIFY_SS],
    ['databricks-token', `DATABRICKS_TOKEN=${DATABRICKS}`, DATABRICKS],
    ['linear-token', `LINEAR_API_KEY=${LINEAR}`, LINEAR],
    ['notion-token', `NOTION_TOKEN=${NOTION_SECRET}`, NOTION_SECRET],
    ['notion-token', `NOTION_KEY=${NOTION_NTN}`, NOTION_NTN],
    ['discord-token', `DISCORD_BOT_TOKEN="${DISCORD}"`, DISCORD],
  ])('redacts %s cleanly', (rule, input, token) => {
    const r = redactText(input);
    expect(r.text).toContain(`[REDACTED:${rule}]`);
    expect(r.text).not.toContain(token);
  });

  it('redacts Azure storage AccountKey values inside connection strings', () => {
    const conn = `DefaultEndpointsProtocol=https;AccountName=demo;AccountKey=${AZURE_KEY};EndpointSuffix=core.windows.net`;
    const r = redactText(conn);
    expect(r.text).toBe('DefaultEndpointsProtocol=https;AccountName=demo;AccountKey=[REDACTED:azure-storage-key];EndpointSuffix=core.windows.net');
    expect(r.text).not.toContain(AZURE_KEY);
  });

  it.each([
    'pypi-short123',
    'pypi-release-github-action-workflow-publish',
    'pypi-' + 'a'.repeat(48),
    'gl' + 'pat-short',
    'gl' + 'pat-your_example_token_placeholder',
    'dc' + 'kr_pat_short',
    'dc' + 'kr_pat_' + 'x'.repeat(27),
    'do' + 'p_v1_short',
    'do' + 'p_v1_' + '0'.repeat(64),
    'S' + 'G.onlyonepart.short',
    'S' + 'G.' + 'a'.repeat(20) + '.' + 'b'.repeat(20),
    // Bare SK + 32 hex without Twilio / key context stays intact
    'const digest = "' + TWILIO_HEX + '";',
    'sh' + 'pat_short123',
    'sh' + 'pat_' + '0'.repeat(32),
    'DefaultEndpointsProtocol=https;AccountKey=your_account_key_here',
    'AccountKey=short',
    'da' + 'pi123456',
    'da' + 'pi_' + 'a'.repeat(32),
    'lin_' + 'api_short',
    'sec' + 'ret_configuration_value_provider_factory_impl',
    'sec' + 'ret_OnlyCamelCaseLettersWithoutDigitsInCodeName',
    'nt' + 'n_short123',
    // Three-part dotted identifier whose first segment is not a base64 Discord snowflake stays intact
    'moduleIdentifierNameLongEnough.abcdef.propertyChainNameThatExceedsTwentySevenChars',
  ])('keeps near-miss unredacted: %s', (nearMiss) => {
    expect(redactText(nearMiss)).toEqual({ text: nearMiss, hits: [] });
  });
});

describe('necessary-condition redaction fast paths', () => {
  it.each(['password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'api-key', 'apikey', 'access_key', 'access-key', 'accesskey', 'private_key', 'private-key', 'privatekey', 'client_secret', 'client-secret', 'clientsecret', 'auth'])('preserves assignment detection for %s within identifiers and mixed case', key => {
    const value = rnd(40);
    const assignment = 'PREFIX_' + key.toUpperCase() + '_SUFFIX="' + value + '"';
    const input = 'Invented harmless output.\n'.repeat(300) + assignment + '\nAfter';
    const result = redactText(input);
    expect(result.text).not.toContain(value);
    expect(result.text).toContain('[REDACTED:secret-assignment]');
    expect(result.hits).toContainEqual({ rule: 'secret-assignment', count: 1 });
  });
  it('preserves URL credentials after a long prefix and other token replacements', () => {
    const value = rnd(32);
    const input = GH + '\n' + 'Invented harmless output.\n'.repeat(300) + 'Custom+Proto://user:' + value + '@host/path';
    const result = redactText(input);
    expect(result.text).not.toContain(value);
    expect(result.text).not.toContain(GH);
    expect(result.hits).toEqual([{ rule: 'github-token', count: 1 }, { rule: 'url-credentials', count: 1 }]);
  });
  it('retains harmless long material byte for byte', () => {
    const input = 'Invented operation: alpha beta gamma delta.\n'.repeat(3000);
    expect(redactText(input)).toEqual({ text: input, hits: [] });
  });
});
