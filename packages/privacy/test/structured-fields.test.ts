import { describe, expect, it } from 'vitest';
import { SECRET_FIELD_MARKER, isSecretFieldKey, redactText, sanitize } from '../src/index.ts';

// Dummy values only. None of them matches a pattern rule: they are short, low-entropy or words, which is
// exactly why the field name has to decide.
const DUMMY = 'hunter2-dummy';

describe('keys that name a secret', () => {
  it.each(['password', 'Password', 'db_password', 'passwd', 'passphrase', 'password_confirmation', 'token', 'access_token', 'accessToken', 'ACCESS-TOKEN', 'bearer_token', 'secret', 'client_secret', 'clientSecret', 'api_key', 'apiKey', 'api-key', 'API_KEY', 'x-api-key', 'OPENAI_API_KEY', 'APIKey', 'apikey', 'private_key', 'privateKey', 'secret_key', 'AWS_SECRET_ACCESS_KEY', 'access_key', 'authorization', 'Authorization', 'credentials', 'tokens', 'githubtoken'])('%s', (key) => {
    expect(isSecretFieldKey(key)).toBe(true);
  });

  it.each(['key', 'auth', 'author', 'authors', 'authority', 'secret_name', 'secret_arn', 'token_count', 'token_type', 'tokenizer', 'max_tokens', 'input_tokens', 'keyboard', 'file_path', 'command', 'description', 'private_key_path', 'monkey', 'turkey', 'pwd', 'cwd', 'query', 'tool_use_id', 'sessionId', 'cache_key', 'primary_key', ''])('%s is an ordinary field', (key) => {
    expect(isSecretFieldKey(key)).toBe(false);
  });
});

describe('a secret-named field is redacted whatever its value looks like', () => {
  it('redacts a plain string under each spelling of the key, with the marker the rules use', () => {
    const keys = ['password', 'apiKey', 'api-key', 'API_KEY', 'access_token', 'Client_Secret', 'passphrase', 'Authorization'];
    const out = sanitize(Object.fromEntries(keys.map((k) => [k, DUMMY])));
    expect(JSON.stringify(out.value)).not.toContain(DUMMY);
    for (const k of keys) expect((out.value as Record<string, string>)[k]).toBe(SECRET_FIELD_MARKER);
    expect(out.redactions).toHaveLength(keys.length);
    expect(out.redactions[0]).toEqual({ field: 'password', rule: 'secret-field', count: 1 });
  });

  it('reaches nested objects and arrays, and everything under a secret-named container', () => {
    const out = sanitize({
      input: { config: { db: { password: DUMMY }, list: [{ token: DUMMY }, { name: 'ok' }] } },
      secrets: [DUMMY, { inner: DUMMY }],
      credentials: { user: 'alice', pass: DUMMY },
    });
    const text = JSON.stringify(out.value);
    expect(text).not.toContain(DUMMY);
    expect(text).toContain('"name":"ok"');
    expect(text).toContain('"user":"[REDACTED:secret-field]"');
    expect(out.redactions.map((r) => r.field).sort()).toEqual(['credentials.pass', 'credentials.user', 'input.config.db.password', 'input.config.list[0].token', 'secrets[0]', 'secrets[1].inner']);
  });

  it('redacts a value in JSON text, with or without an escape in it', () => {
    for (const text of [JSON.stringify({ password: DUMMY, note: 'a\nb' }), JSON.stringify({ args: { api_key: DUMMY } }), `[{"token": "${DUMMY}"}]`]) {
      const r = redactText(text);
      expect(r.text).not.toContain(DUMMY);
      expect(r.hits.map((h) => h.rule)).toContain('secret-field');
      expect(() => JSON.parse(r.text)).not.toThrow();
    }
    const pretty = redactText(JSON.stringify({ name: 'x', password: DUMMY }, null, 2));
    expect(pretty.text).toBe(JSON.stringify({ name: 'x', password: SECRET_FIELD_MARKER }, null, 2));
  });

  it('redacts JSON text inside JSON text', () => {
    const inner = JSON.stringify({ Arguments: JSON.stringify({ secret: DUMMY }) });
    const out = sanitize({ tool: { input: inner } });
    expect(JSON.stringify(out.value)).not.toContain(DUMMY);
  });
});

describe('ordinary fields are left alone', () => {
  it('keeps values of fields that only resemble the names', () => {
    const value = {
      author: 'alice', secret_name: 'prod-db', token_count: 12, token_type: 'bearer-ish', max_tokens: 4096, input_tokens: 5, key: 'Enter', auth: 'basic',
      command: 'npm test', file_path: 'src/a.ts', pwd: '/home/me', cache_key: 'v1', private_key_path: '~/.ssh/id_x.pub',
    };
    const out = sanitize(value);
    expect(out.value).toEqual(value);
    expect(out.redactions).toEqual([]);
  });

  it('keeps numbers, booleans, null and empty values under a secret-named key, and references to a secret', () => {
    const value = { password: '', token: null, secret: false, api_key: 1, access_token: '${GITHUB_TOKEN}', apiKey: '<your key>', client_secret: 'process.env.CLIENT_SECRET', credentials: { note: '[REDACTED:github-token]' } };
    const out = sanitize(value);
    expect(out.value).toEqual(value);
    expect(out.redactions).toEqual([]);
  });

  it('leaves JSON text without a secret-named field byte for byte', () => {
    for (const text of [JSON.stringify({ a: 'plain', token_count: 3 }, null, 2), '{"author": "alice", "tokenizer": "bpe"}', '{"password": ""}']) expect(redactText(text).text).toBe(text);
  });
});
