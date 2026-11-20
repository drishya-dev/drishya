// Redaction runs in the ingest path, before anything is persisted, indexed or shown
// (AGENTS.md constraint 3). Pattern detection is best effort — it is never a guarantee.

import type { RedactionNote } from '@drishya/contracts';
import { captureImage } from './image.ts';
export * from './image.ts';

// p2: object keys, fields beside a dropped base64 payload and the branch name are redacted, and
// matching runs before truncation. Data stored under p1 may hold secrets in those places.
// p3: protected-file scopes omit every string except paths and short labels, and shell commands
// or patches that name a protected file make their output protected. p2 data may hold such content.
// p4: added PyPI, GitLab, Docker Hub, DigitalOcean, SendGrid, Twilio (contextual), Shopify,
// Azure storage AccountKey, Databricks, Linear, Notion and Discord bot token rules; older stores scrub on open.
// p5: a string that is a JSON document (a tool argument recorded as JSON text inside JSON) is redacted value by value, because
// an escaped newline glued to a token defeated every word-boundary rule. p4 data may hold such tokens.
// p6: a structured field whose name says it holds a secret (`password`, `apiKey`, `access-token`, …) has its value redacted
// whatever the value looks like, at any depth. Pattern rules only see text; the name is evidence they never had. p5 data may hold such values.
export const PRIVACY_POLICY_VERSION = 'p6';

/** Longest single string kept verbatim; beyond this the tail is cut with a marker. */
export const MAX_STRING_BYTES = 4 * 1024 * 1024;

/**
 * How much of an oversized string is matched before it is cut. Matching must see past the cut so
 * a secret straddling it is caught whole; a multiple of the limit keeps work bounded on huge input.
 */
const REDACT_WINDOW_FACTOR = 4;

interface Rule {
  id: string;
  pattern: RegExp;
  /** Necessary condition only; failing it must imply the full pattern cannot match. */
  possible?: (text: string) => boolean;
  /** Which capture group holds the secret. 0 = whole match. */
  group?: number;
  /** Extra check on the candidate secret, to avoid redacting placeholders and hashes. */
  accept?: (secret: string, ctx: { text: string; offset: number; match: string }) => boolean;
}

const PLACEHOLDER = /^(x+|\*+|\.+|<[^>]*>|\$\{[^}]*\}|\{\{[^}]*\}\}|your[-_ ]?.*|changeme|example.*|test|dummy|placeholder|redacted|none|null|undefined|true|false|process\.env\..*|os\.environ.*)$/i;

function shannon(s: string): number {
  const f = new Map<string, number>();
  for (const c of s) f.set(c, (f.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of f.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function looksSecret(v: string): boolean {
  const s = v.replace(/^["'`]|["'`,;]$/g, '');
  if (s.length < 8 || PLACEHOLDER.test(s)) return false;
  // Already handled by a more specific rule; do not re-redact our own marker.
  if (s.includes('[REDACTED:')) return false;
  // Code, not a value: calls, and member access like process.env.X or config.apiKey.
  if (/[()]/.test(s)) return false;
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(s)) return false;
  // A value that is a plain identifier or a sentence is far more likely code than a secret.
  if (/^[a-z_][a-z0-9_]*$/i.test(s) && s.length < 20) return false;
  if (/\s/.test(s)) return false;
  return shannon(s) >= 3.0;
}

function looksDiscordBotToken(secret: string): boolean {
  const parts = secret.split('.');
  if (parts.length !== 3) return false;
  const [p1, p2, p3] = parts;
  if (!p1 || !p2 || !p3 || p1.startsWith('eyJ')) return false;
  try {
    const pad = p1.length % 4 ? '='.repeat(4 - (p1.length % 4)) : '';
    const id = atob(p1.replace(/-/g, '+').replace(/_/g, '/') + pad);
    if (!/^\d{17,22}$/.test(id)) return false;
    if (btoa(id).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== p1) return false;
  } catch { return false; }
  return looksSecret(p3);
}

function looksTwilioContext(text: string, offset: number, match: string): boolean {
  const start = Math.max(0, offset - 80);
  const end = Math.min(text.length, offset + match.length + 80);
  const win = text.slice(start, end);
  return /(?:twilio|api[_-]?key|apikey|key[_-]?sid|account[_-]?sid|auth[_-]?token|\bAC[0-9a-f]{32}\b)/i.test(win);
}

// Order matters: specific token formats first, generic assignment last.
const RULES: Rule[] = [
  { id: 'private-key', pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g },
  { id: 'aws-access-key', pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g },
  { id: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b/g },
  { id: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openai-key', pattern: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g },
  { id: 'nvidia-key', pattern: /\bnvapi-[A-Za-z0-9_-]{20,}/g },
  { id: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'slack-token', pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { id: 'stripe-key', pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { id: 'npm-token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { id: 'hf-token', pattern: /\bhf_[A-Za-z0-9]{30,}\b/g },
  { id: 'pypi-token', possible: t => t.includes('pypi-'), pattern: /\bpypi-[A-Za-z0-9_-]{32,}={0,2}(?![A-Za-z0-9_-])/g, accept: (s) => { const b = s.slice(5); return looksSecret(b) && (b.startsWith('AgE') || (/[A-Z]/.test(b) && /[a-z]/.test(b) && /[0-9]/.test(b))); } },
  { id: 'gitlab-token', possible: t => t.includes('glpat-') || t.includes('gldt-'), pattern: /\b(?:glpat|gldt)-[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{2,})*(?![A-Za-z0-9_-])/g, accept: (s) => looksSecret(s.slice(s.indexOf('-') + 1)) },
  { id: 'docker-token', possible: t => t.includes('dckr_pat_'), pattern: /\bdckr_pat_[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/g, accept: (s) => looksSecret(s.slice(9)) },
  { id: 'digitalocean-token', possible: t => t.includes('dop_v1_'), pattern: /\bdop_v1_[0-9a-fA-F]{32,}\b/g, accept: (s) => looksSecret(s.slice(7)) },
  { id: 'sendgrid-key', possible: t => t.includes('SG.'), pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_-])/g, accept: (s) => { const [a, b] = s.slice(3).split('.'); return !!a && !!b && !PLACEHOLDER.test(a) && !PLACEHOLDER.test(b) && shannon(a) >= 2.8 && shannon(b) >= 3.0; } },
  { id: 'twilio-key', possible: t => t.includes('SK'), pattern: /\bSK[0-9a-fA-F]{32}\b/g, accept: (s, ctx) => looksSecret(s) && looksTwilioContext(ctx.text, ctx.offset, ctx.match) },
  { id: 'shopify-token', possible: t => t.includes('shpat_') || t.includes('shpss_'), pattern: /\bshp(?:at|ss)_[0-9a-fA-F]{32,}\b/g, accept: (s) => looksSecret(s.slice(6)) },
  { id: 'azure-storage-key', possible: t => t.includes('=') && /accountkey=/i.test(t), pattern: /\bAccountKey=([A-Za-z0-9+/=]{32,})/gi, group: 1, accept: looksSecret },
  { id: 'databricks-token', possible: t => t.includes('dapi'), pattern: /\bdapi[0-9a-fA-F]{32}(?:-\d+)?\b/g, accept: (s) => looksSecret(s.slice(4)) },
  { id: 'linear-token', possible: t => t.includes('lin_api_'), pattern: /\blin_api_[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g, accept: (s) => looksSecret(s.slice(8)) },
  { id: 'notion-token', possible: t => t.includes('secret_') || t.includes('ntn_'), pattern: /\b(?:secret_[A-Za-z0-9]{40,}|ntn_[A-Za-z0-9]{36,})\b/g, accept: (s) => { const b = s.startsWith('ntn_') ? s.slice(4) : s.slice(7); return looksSecret(b) && /[0-9]/.test(b) && /[A-Za-z]/.test(b); } },
  { id: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { id: 'discord-token', possible: t => t.includes('.'), pattern: /(?<![A-Za-z0-9_.-])[A-Za-z0-9_-]{23,30}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{25,45}(?![A-Za-z0-9_-])/g, accept: looksDiscordBotToken },
  { id: 'bearer', pattern: /\b(?:Bearer|Token)\s+([A-Za-z0-9._~+/=-]{16,})/g, group: 1, accept: looksSecret },
  { id: 'url-credentials', possible: text => text.includes('://'), pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:([^\s@/]{3,})@/gi, group: 1, accept: (s) => !PLACEHOLDER.test(s) && !s.includes('[REDACTED:') },
  {
    id: 'secret-assignment',
    pattern: /password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth/gi,
    group: 2,
    accept: looksSecret,
  },
];

/**
 * p6. Whether an object key names a secret, so the value stored under it is redacted without looking at its shape.
 * Case and separators do not matter (`apiKey`, `api-key`, `API_KEY`); the key is split into words and judged by its last
 * word, so `db_password` and `clientSecret` match while `secret_name`, `token_count` and `author` do not. Passwords match
 * anywhere in the name (`password_confirmation`). Deliberately without a bare `key` or `auth`: `key: "Enter"` and
 * `auth: "oauth"` are ordinary fields.
 */
const SECRET_LAST_WORD = /(?:password|passwd|passphrase|secret|token|apikey|accesskey|privatekey|secretkey|credential|authorization|bearer)$/;
// A plural names a collection (`secrets`, `tokens`) only on its own; after another word it is usually a count (`max_tokens`).
const SECRET_PLURAL = /^(?:password|secret|token|credential|apikey)s$/;
const SECRET_KEY_PREFIX = new Set(['api', 'access', 'private', 'secret', 'signing', 'encryption', 'master', 'ssh', 'session', 'auth', 'client']);
export function isSecretFieldKey(key: string): boolean {
  // A key that is already a redaction marker has been handled; its value is judged on its own.
  if (key.length > 200 || key.includes('[REDACTED:')) return false;
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return false;
  if (words.some((w) => /^(?:password|passwd|passphrase)s?$/.test(w))) return true;
  const last = words[words.length - 1]!;
  if (SECRET_LAST_WORD.test(last) || (words.length === 1 && SECRET_PLURAL.test(last))) return true;
  return last === 'key' && words.length > 1 && SECRET_KEY_PREFIX.has(words[words.length - 2]!);
}

/** A value that names where a secret comes from rather than being one: `${TOKEN}`, `<token>`, `process.env.X`, or our own marker. */
const SECRET_REFERENCE = /^(?:\[REDACTED:[a-z-]+\]|\$\{[^}]*\}|\{\{[^}]*\}\}|<[^>]*>|process\.env\.\w+|os\.environ.*|x{3,}|\*+|\.+|true|false|null|undefined|none)$/i;
export const isSecretReference = (v: string) => v.length === 0 || SECRET_REFERENCE.test(v.trim());
export const SECRET_FIELD_RULE = 'secret-field';
export const SECRET_FIELD_MARKER = `[REDACTED:${SECRET_FIELD_RULE}]`;

/** Paths whose content is never kept, whatever it contains. */
const DENY_PATH = /(^|[\\/])(\.env(\.[^\\/]*)?|\.netrc|\.npmrc|\.pypirc|id_rsa[^\\/]*|id_ed25519[^\\/]*|id_ecdsa[^\\/]*|credentials(\.json)?|secrets?\.(json|ya?ml|toml)|[^\\/]*\.(pem|key|p12|pfx|keystore|jks))$/i;
const ALLOW_PATH = /(^|[\\/])\.env\.(example|sample|template|defaults)$/i;

export function isDeniedPath(path: string): boolean {
  return DENY_PATH.test(path) && !ALLOW_PATH.test(path);
}

/**
 * Whether free text (a shell command, a patch) names a protected file: `cat .env`,
 * `grep KEY config/.env.production`, `*** Update File: deploy/.env`. Shell reads and patches
 * reach protected files without any structured path field, so the path rule alone misses them.
 * Conservative by design: a command that merely lists a protected file also counts.
 */
export function mentionsDeniedPath(text: string): boolean {
  return text.split(/[\s"'`;|&<>()=,]+/).some((t) => t.length > 0 && isDeniedPath(t));
}

export interface RedactResult {
  text: string;
  hits: { rule: string; count: number }[];
}

// Search for the rare keyword first. The old greedy identifier prefix retried the
// alternation at every character of long harmless identifiers (notably shell output).
// The sticky suffix, ASCII boundaries and consumed rejected matches preserve replace's
// exact matching/replacement behavior, including keywords embedded in identifiers.
function replaceAssignments(text: string, keywords: RegExp, replace: (match: string, ...args: unknown[]) => string): string {
  const tail = /["']?\s*[:=]\s*(["'`]?)([^\s"'`,;]{8,})\1/y;
  const word = (at: number) => {
    const c = text.charCodeAt(at);
    return c >= 48 && c <= 57 || c >= 65 && c <= 90 || c === 95 || c >= 97 && c <= 122;
  };
  const segments: { start: number; end: number }[] = [];
  const segment = (at: number) => {
    const known = segments.find(s => at >= s.start && at < s.end);
    if (known) return known;
    let start = at;
    let end = at + 1;
    while (start > 0 && word(start - 1)) start--;
    while (end < text.length && word(end)) end++;
    const found = { start, end };
    segments.push(found);
    if (segments.length > 2) segments.shift();
    return found;
  };
  let suffixAt = -1;
  let suffix: RegExpExecArray | null = null;
  let consumed = 0;
  let copied = 0;
  const parts: string[] = [];
  for (let keyword = keywords.exec(text); keyword; keyword = keywords.exec(text)) {
    const start = segment(keyword.index).start;
    const end = segment(keyword.index + keyword[0].length - 1).end;
    if (start < consumed) continue;
    if (suffixAt !== end) {
      tail.lastIndex = end;
      suffix = tail.exec(text);
      suffixAt = end;
    }
    if (!suffix) continue;
    consumed = end + suffix[0].length;
    keywords.lastIndex = consumed;
    const match = text.slice(start, consumed);
    const replacement = replace(match, suffix[1], suffix[2], start, text);
    if (replacement !== match) {
      parts.push(text.slice(copied, start), replacement);
      copied = consumed;
    }
  }
  if (!parts.length) return text;
  parts.push(text.slice(copied));
  return parts.join('');
}

/**
 * SEC-3 (p5). Some harnesses record a tool argument as JSON text inside a JSON string (Antigravity's MCP `Arguments`, a
 * Codex `output` envelope). Inside that text a newline is the two characters `\n`, so a token that follows one is glued to the
 * letter `n` and every word-boundary rule (`\bAKIA…`, `\bghp_…`, `\bsk-…`) misses it. A string that is a JSON document is
 * therefore redacted value by value, as the harness's own tools would read it, and written back as JSON.
 */
const NESTED_JSON_LIMIT = 4 * 1024 * 1024;
// A JSON document with no escape in it can still hold a field named like a secret, so the gate also looks for such a word.
const SECRET_WORD_HINT = /password|passwd|passphrase|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|credential|authorization|bearer/i;
function redactNested(input: string, plain: RedactResult, depth: number): RedactResult {
  if (depth > 8 || input.length < 8 || input.length > NESTED_JSON_LIMIT) return plain;
  const start = input.search(/\S/);
  if (start < 0 || (input[start] !== '{' && input[start] !== '[')) return plain;
  if (!input.includes('\\') && !SECRET_WORD_HINT.test(input)) return plain;
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch { return plain; }
  if (!parsed || typeof parsed !== 'object') return plain;
  const hits = new Map<string, number>();
  const hit = (rule: string, count: number) => hits.set(rule, (hits.get(rule) ?? 0) + count);
  const walk = (v: unknown, secret: boolean): unknown => {
    if (typeof v === 'string') {
      if (secret && !isSecretReference(v)) { hit(SECRET_FIELD_RULE, 1); return SECRET_FIELD_MARKER; }
      const r = redactNestedAware(v, depth + 1);
      for (const h of r.hits) hit(h.rule, h.count);
      return r.text;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x, secret));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [redactText(k).text, walk(x, secret || isSecretFieldKey(k))]));
    return v;
  };
  const cleaned = walk(parsed, false);
  if (!hits.size) return plain;
  // Keep the document's own layout (indented or compact) so a file that is JSON reads the same after redaction.
  const indent = /^[\[{][ \t]*\r?\n([ \t]+)\S/.exec(input.slice(start))?.[1];
  const final = redactPlain(JSON.stringify(cleaned, null, indent));
  for (const h of final.hits) hit(h.rule, h.count);
  return { text: final.text, hits: [...hits].map(([rule, count]) => ({ rule, count })) };
}
const redactNestedAware = (input: string, depth: number) => redactNested(input, redactPlain(input), depth);

export function redactText(input: string): RedactResult {
  return redactNested(input, redactPlain(input), 0);
}

function redactPlain(input: string): RedactResult {
  let text = input;
  const hits = new Map<string, number>();
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.possible && !rule.possible(text)) continue;
    const replace = (match: string, ...args: unknown[]) => {
      const groups = args.slice(0, -2) as (string | undefined)[];
      const offset = args.at(-2) as number;
      const full = args.at(-1) as string;
      const secret = rule.group ? groups[rule.group - 1] : match;
      if (!secret) return match;
      if (rule.accept && !rule.accept(secret, { text: full, offset, match })) return match;
      hits.set(rule.id, (hits.get(rule.id) ?? 0) + 1);
      const marker = `[REDACTED:${rule.id}]`;
      if (!rule.group) return marker;
      const at = match.lastIndexOf(secret);
      return match.slice(0, at) + marker + match.slice(at + secret.length);
    };
    text = rule.id === 'secret-assignment'
      ? replaceAssignments(text, rule.pattern, replace)
      : text.replace(rule.pattern, replace);
  }
  return { text, hits: [...hits].map(([rule, count]) => ({ rule, count })) };
}

export interface SanitizeOptions {
  maxStringBytes?: number;
  /**
   * Treat every content string as belonging to a protected file. Adapters set this for a tool
   * result whose call targeted a denied path, since the result itself may not name the path.
   */
  denyContent?: boolean;
}

export interface SanitizeResult<T> {
  value: T;
  redactions: RedactionNote[];
  /** True if content was dropped entirely (denied path, image, oversized). */
  omitted: boolean;
}

const PATH_KEYS = new Set(['file_path', 'filePath', 'path', 'notebook_path']);
/**
 * Inside a protected scope, the only strings kept besides paths: short identifier-like labels under
 * these keys (e.g. `kind: "read"`), which the reducer needs to place the operation. Everything else
 * is omitted whatever its field name, because harness result shapes vary and change.
 */
const LABEL_KEYS = new Set(['type', 'kind', 'tool', 'status', 'mode']);
const isLabel = (v: unknown) => typeof v === 'string' && v.length <= 40 && /^[A-Za-z0-9_.:-]*$/.test(v);

/**
 * Deep-sanitizes an arbitrary JSON value: every string is redacted, images are dropped,
 * and content belonging to a denied path (e.g. `.env`) is replaced by an omission marker.
 */
export function sanitize<T>(value: T, opts: SanitizeOptions = {}): SanitizeResult<T> {
  const max = opts.maxStringBytes ?? MAX_STRING_BYTES;
  const redactions: RedactionNote[] = [];
  let omitted = false;

  const walk = (v: unknown, field: string, denied: boolean, secret = false): unknown => {
    if (typeof v === 'string') {
      if (denied) {
        omitted = true;
        return '[OMITTED: content of a protected file]';
      }
      // p6: the key said this value is a secret, so its shape does not matter.
      if (secret && !isSecretReference(v)) {
        redactions.push({ field, rule: SECRET_FIELD_RULE, count: 1 });
        return SECRET_FIELD_MARKER;
      }
      // Redact first, then cut: cutting first can leave a secret's head too short for any rule.
      const r = redactText(v.length > max ? v.slice(0, max * REDACT_WINDOW_FACTOR) : v);
      for (const h of r.hits) redactions.push({ field, rule: h.rule, count: h.count });
      if (v.length <= max) return r.text;
      omitted = true;
      return r.text.slice(0, max) + `\n[TRUNCATED: ${v.length - max} more characters]`;
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${field}[${i}]`, denied, secret));
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      // D7 (revised 21 Oct): an image an adapter captured is kept only if its bytes re-check as an
      // image within the limits, never inside a protected scope, and its data is never text-redacted.
      if (o.kind === 'captured-image') {
        const label = (x: unknown) => typeof x === 'string' && /^image\/[a-z]+$/.test(x) ? x : undefined;
        if (denied || typeof o.data !== 'string') {
          if (denied) omitted = true;
          const size = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
          return { kind: 'captured-image', ...(label(o.mime) ? { mime: o.mime } : {}), ...(size(o.bytes) ? { bytes: o.bytes } : {}), ...(size(o.width) ? { width: o.width } : {}), ...(size(o.height) ? { height: o.height } : {}), omitted: denied ? 'protected' : typeof o.omitted === 'string' && /^[a-z-]{1,20}$/.test(o.omitted) ? o.omitted : 'unrecognised' };
        }
        const kept = captureImage(o.data, { width: o.width, height: o.height });
        if (!kept.data) omitted = true;
        return kept;
      }
      // Other images are never kept: text redaction cannot certify them safe (engineering plan §10).
      if ((o.type === 'image' || o.type === 'base64') && ('source' in o || 'data' in o || 'base64' in o || 'file' in o)) {
        omitted = true;
        return { type: 'image', omitted: true };
      }
      if (typeof o.base64 === 'string') {
        omitted = true;
        // The payload goes; what is kept beside it is walked like anything else.
        const kept = Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'base64' && k !== 'data'));
        return { ...(walk(kept, field, denied, secret) as Record<string, unknown>), omitted: true };
      }
      let childDenied = denied;
      for (const k of PATH_KEYS) {
        const p = o[k];
        if (typeof p === 'string' && isDeniedPath(p)) childDenied = true;
      }
      // A harness record can contain an own `__proto__` key. A plain object's setter would
      // silently drop that captured value (or change the result's prototype).
      const out: Record<string, unknown> = Object.create(null);
      for (const [k, x] of Object.entries(o)) {
        const key = safeKey(k, out);
        const f = field ? `${field}.${key}` : key;
        if (key !== k) for (const h of redactText(k).hits) redactions.push({ field: f, rule: h.rule, count: h.count });
        // Path fields themselves are kept so the user can see *that* a protected file was touched.
        const keep = PATH_KEYS.has(k) || (childDenied && LABEL_KEYS.has(k) && isLabel(x));
        out[key] = walk(x, f, keep ? false : childDenied, secret || (!keep && isSecretFieldKey(k)));
      }
      return out;
    }
    return v;
  };

  const out = walk(value, '', opts.denyContent ?? false) as T;
  return { value: out, redactions: mergeNotes(redactions), omitted };
}

/**
 * An object key with secrets redacted. Two keys can redact to the same text, or collide with a
 * key already present, so a numbered suffix keeps every value instead of silently overwriting one.
 */
function safeKey(key: string, taken: Record<string, unknown>): string {
  const base = redactText(key).text;
  if (base === key && !Object.hasOwn(taken, key)) return key;
  let candidate = base;
  for (let n = 2; Object.hasOwn(taken, candidate); n++) candidate = `${base} #${n}`;
  return candidate;
}

function mergeNotes(notes: RedactionNote[]): RedactionNote[] {
  const m = new Map<string, RedactionNote>();
  for (const n of notes) {
    const k = `${n.field}\u0000${n.rule}`;
    const e = m.get(k);
    if (e) e.count += n.count;
    else m.set(k, { ...n });
  }
  return [...m.values()];
}
