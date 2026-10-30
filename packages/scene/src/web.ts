import type {WebResult} from '@drishya/contracts';

export interface WebMaterial { results: WebResult[]; text: string; original: string; listRecorded: boolean }
export interface WebResultPage {
  results: WebResult[]; total: number; matched: number; start: number; hasMore: boolean;
  text: string; original: string; originalComplete: boolean;
  query?: string; url?: string; time?: string;
  availability: 'captured' | 'missing' | 'removed';
}
export interface WebResultOptions { start?: number; count?: number; resultId?: string; q?: string }

/** Result fields stay literal, including URLs the presentation must keep inert. */
function results(value: unknown): WebResult[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: WebResult[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || typeof entry.url !== 'string') return undefined;
    const row: WebResult = {url: entry.url};
    for (const key of ['title','domain','snippet'] as const) if (typeof entry[key] === 'string') row[key] = entry[key];
    rows.push(row);
  }
  return rows;
}

/** Locate a complete JSON array without treating quoted brackets as delimiters. */
function arrayEnd(text: string, start: number): number | undefined {
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '[') depth++;
    else if (char === ']' && --depth === 0) return i + 1;
  }
  return undefined;
}

/** Parse only explicit, complete result lists, never links inferred from prose. */
export function webMaterial(text: string, seeds: WebResult[] = []): WebMaterial {
  const original = text;
  const links = /(?:^|\n)[\t ]*(Links\s*:\s*)(?=\[)/g;
  const collected: WebResult[] = [], spans: {start:number;end:number}[] = [];
  for (const match of text.matchAll(links)) {
    const start = match.index + match[0].length, end = arrayEnd(text,start);
    if (end === undefined) continue;
    try {
      const parsed = results(JSON.parse(text.slice(start,end)));
      if (parsed) {
        const label = start - match[1]!.length;
        collected.push(...parsed);spans.push({start:label,end});
      }
    } catch { /* An incomplete or unsupported list remains literal captured text. */ }
  }
  if (spans.length) {
    let prose='',from=0;
    for (const span of spans) { prose+=text.slice(from,span.start);from=span.end; }
    return {results:collected,text:prose+text.slice(from),original,listRecorded:true};
  }
  try {
    const value: unknown = JSON.parse(text);
    const parsed = results(Array.isArray(value) ? value : value && typeof value === 'object' && 'results' in value ? value.results : undefined);
    if (parsed) {
      // A structured payload may carry its own literal prose alongside its results.
      const prose = !Array.isArray(value) && value && typeof value === 'object' && 'text' in value && typeof value.text === 'string' ? value.text : Array.isArray(value) ? '' : text;
      return {results:parsed,text:prose,original,listRecorded:true};
    }
  } catch { /* Ordinary text is not a structured result list. */ }
  return {results:results(seeds) ?? [],text,original,listRecorded:seeds.length > 0};
}
