// Redaction runs in the ingest path, before anything is persisted, indexed or shown
// (AGENTS.md constraint 3). Pattern detection is best effort — it is never a guarantee.

import type { RedactionNote } from '@drishya/contracts';
import { captureImage } from './image.ts';
export * from './image.ts';

// p2: object keys, fields beside a dropped base64 payload and the branch name are redacted, and
// matching runs before truncation. Data stored under p1 may hold secrets in those places.
// p3: protected-file scopes omit every string except paths and short labels, and shell commands
// or patches that name a protected file make their output protected. p2 data may hold such content.
export const PRIVACY_POLICY_VERSION = 'p3';

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
  accept?: (secret: string) => boolean;
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
  { id: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { id: 'bearer', pattern: /\b(?:Bearer|Token)\s+([A-Za-z0-9._~+/=-]{16,})/g, group: 1, accept: looksSecret },
  { id: 'url-credentials', possible: text => text.includes('://'), pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:([^\s@/]{3,})@/gi, group: 1, accept: (s) => !PLACEHOLDER.test(s) },
  {
    id: 'secret-assignment',
    pattern: /\b[A-Za-z0-9_]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth)[A-Za-z0-9_]*["']?\s*[:=]\s*(["'`]?)([^\s"'`,;]{8,})\1/gi,
    group: 2,
    accept: looksSecret,
  },
];

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

export function redactText(input: string): RedactResult {
  let text = input;
  const hits = new Map<string, number>();
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.possible && !rule.possible(text)) continue;
    text = text.replace(rule.pattern, (match: string, ...args: unknown[]) => {
      const groups = args.slice(0, -2) as (string | undefined)[];
      const secret = rule.group ? groups[rule.group - 1] : match;
      if (!secret) return match;
      if (rule.accept && !rule.accept(secret)) return match;
      hits.set(rule.id, (hits.get(rule.id) ?? 0) + 1);
      const marker = `[REDACTED:${rule.id}]`;
      if (!rule.group) return marker;
      const at = match.lastIndexOf(secret);
      return match.slice(0, at) + marker + match.slice(at + secret.length);
    });
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

  const walk = (v: unknown, field: string, denied: boolean): unknown => {
    if (typeof v === 'string') {
      if (denied) {
        omitted = true;
        return '[OMITTED: content of a protected file]';
      }
      // Redact first, then cut: cutting first can leave a secret's head too short for any rule.
      const r = redactText(v.length > max ? v.slice(0, max * REDACT_WINDOW_FACTOR) : v);
      for (const h of r.hits) redactions.push({ field, rule: h.rule, count: h.count });
      if (v.length <= max) return r.text;
      omitted = true;
      return r.text.slice(0, max) + `\n[TRUNCATED: ${v.length - max} more characters]`;
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${field}[${i}]`, denied));
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
        return { ...(walk(kept, field, denied) as Record<string, unknown>), omitted: true };
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
        out[key] = walk(x, f, keep ? false : childDenied);
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
