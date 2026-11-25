export const ANTIGRAVITY_REQUEST_OPEN = '<USER_REQUEST>';
export const ANTIGRAVITY_REQUEST_RULE = 'antigravity-request-envelope-v1';
const CLOSE = '</USER_REQUEST>';

/** Derive the request only when one complete envelope covers the entire record. */
export function antigravityRequest(text: string): string | undefined {
  if (!text.startsWith(ANTIGRAVITY_REQUEST_OPEN) || !text.endsWith(CLOSE)) return undefined;
  const tokens = /<\/?USER_REQUEST>/g;
  tokens.lastIndex = ANTIGRAVITY_REQUEST_OPEN.length;
  let depth = 1;
  for (let token = tokens.exec(text); token; token = tokens.exec(text)) {
    depth += token[0] === ANTIGRAVITY_REQUEST_OPEN ? 1 : -1;
    if (depth === 0) {
      return tokens.lastIndex === text.length ? text.slice(ANTIGRAVITY_REQUEST_OPEN.length, token.index) : undefined;
    }
  }
  return undefined;
}
