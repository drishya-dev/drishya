// SEC-3: the route list, read from the server's own source so a new route cannot be missed.
//
// `apps/daemon/src/server.ts` dispatches with one `if (a === ... && sub === ... && m === 'GET')` per
// route. This reads every such condition and builds the (method, path) it answers. A condition it
// cannot read makes `extractRoutes` throw, which fails the suite: a route can be missed only by
// being written in a shape this parser rejects, and that is a loud failure, not a gap.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface Route {
  method: string;
  /** e.g. `/v1/recordings/{rec}/git/commit`. */
  template: string;
  /** The same path with placeholders filled, ready to request. */
  path(recording: string): string;
  /** The condition text the route was read from (for failure messages only). */
  source: string;
}

const SERVER = fileURLToPath(new URL('../../../apps/daemon/src/server.ts', import.meta.url));

/** The text between a `(` at `open` and its matching `)`. */
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      // Skip a string literal (conditions here use only simple ones).
      const quote = ch;
      for (i++; i < text.length && text[i] !== quote; i++) if (text[i] === '\\') i++;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error('unbalanced condition in server.ts');
}

export function extractRoutes(source = readFileSync(SERVER, 'utf8')): Route[] {
  const found = new Map<string, Route>();
  const add = (route: Route) => found.set(`${route.method} ${route.template}`, route);

  // 1. The gate's own routes in handleRequest.
  const handle = source.slice(source.indexOf('const handleRequest'), source.indexOf('const timings'));
  for (const m of handle.matchAll(/url\.pathname === '(\/v1\/[^']+)'(?:\s*&&\s*req\.method === '([A-Z]+)')?/g)) {
    for (const method of m[2] ? [m[2]] : ['GET']) add({ method, template: m[1]!, path: () => m[1]!, source: m[0] });
  }

  // 2. The dispatcher.
  const start = source.indexOf('const route = async');
  const end = source.indexOf("throw new HttpError(404, 'no such route')", start);
  if (start < 0 || end < 0) throw new Error('route() not found in server.ts: update tests/security/lib/routes.ts');
  const body = source.slice(start, end);
  const recordings = body.search(/if\s*\(\s*a === 'recordings' && id\s*\)\s*\{/);
  const seenConditions = new Set<number>();
  for (const m of body.matchAll(/\bm\s*===\s*'([A-Z]+)'/g)) {
    const before = body.slice(0, m.index);
    const ifAt = [...before.matchAll(/\bif\s*\(/g)].at(-1);
    if (!ifAt) throw new Error(`no condition before ${m[0]}`);
    if (seenConditions.has(ifAt.index!)) continue;
    seenConditions.add(ifAt.index!);
    const condition = balanced(body, ifAt.index! + ifAt[0].length - 1);
    const methods = [...condition.matchAll(/\bm\s*===\s*'([A-Z]+)'/g)].map((x) => x[1]!);
    const literal = (name: string) => new RegExp(`\\b${name}\\s*===\\s*'([^']+)'`).exec(condition)?.[1];
    const insideRecordings = recordings >= 0 && ifAt.index! > recordings;
    let a = literal('a');
    if (!a) {
      if (!insideRecordings) throw new Error(`cannot read route condition: ${condition.slice(0, 120)}`);
      a = 'recordings';
    }
    const idLiteral = literal('id');
    const sub = literal('sub');
    const subId = literal('subId');
    const needsId = !!idLiteral || (!/!id\b/.test(condition) && (insideRecordings || /&&\s*id\b(?!\s*===)/.test(condition)));
    const needsSubId = !!subId || /&&\s*subId\b(?!\s*===)/.test(condition);
    const segments = [a, ...(needsId ? [idLiteral ?? '{rec}'] : []), ...(sub ? [sub] : []), ...(needsSubId ? [subId ?? 'x'] : [])];
    const template = '/v1/' + segments.join('/');
    for (const method of methods) {
      add({ method, template, path: (rec) => template.replace('{rec}', encodeURIComponent(rec)), source: condition.slice(0, 160) });
    }
  }
  const routes = [...found.values()];
  if (routes.length < 60) throw new Error(`only ${routes.length} routes found in server.ts; the parser has drifted`);
  return routes;
}

/** A readable list for failure messages. */
export const describeRoutes = (routes: Route[]) => routes.map((r) => `${r.method} ${r.template}`).join('\n');
