// Frozen aa299561c3e23bba77029e77e5385176985ac2f9 reference. Do not update with production rules.
// Full ordered redactText implementation, retained solely for byte-for-byte differential tests.
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


export interface RedactResult {
  text: string;
  hits: { rule: string; count: number }[];
}

export function legacyRedactText(input: string): RedactResult {
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

