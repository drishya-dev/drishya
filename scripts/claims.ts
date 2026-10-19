// Lists open TASKS items in priority order and marks the ones claimed in STATUS.md.
//   node scripts/claims.ts            open items, claimed ones marked
//   node scripts/claims.ts P0         only that priority
//   node scripts/claims.ts --free     only unclaimed items
// Read-only: it edits nothing. Claims are added by hand (see AGENTS.md, "Claiming and state").
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const docs = (name: string) => readFileSync(fileURLToPath(new URL(`../docs/${name}`, import.meta.url)), 'utf8').replaceAll('\r', '');
const tasks = docs('TASKS.md'), status = docs('STATUS.md');

const done = new Set([...tasks.matchAll(/^- \[x\] \*\*([A-Z]+-\d+[a-z]?) /gm)].map(m => m[1]!));

// "### P0 — now" style headings give each priority table its label; rows are "| # | ID | Item | Tags |".
const items: { priority: string; id: string; title: string; tags: string }[] = [];
let priority = '';
for (const line of tasks.split('\n')) {
  const heading = /^### (P\d)\b/.exec(line);
  if (heading) { priority = heading[1]!; continue; }
  if (/^## /.test(line) && !/^## 1\./.test(line)) priority = '';
  // Rows are "| ☑ | 3 | ID | item | tags |" (P0-P2) or "| ☐ | ID | item | tags |" (P3); the mark is optional.
  const row = /^\| (?:[☑☐] \| )?\w+ \| ([A-Z]+-\d+[a-z]?) \| (.+?) \| (.*?) \|$/.exec(line) ?? /^\| (?:[☑☐] \| )?([A-Z]+-\d+[a-z]?) \| (.+?) \| (.*?) \|$/.exec(line);
  if (priority && row) items.push({ priority, id: row[1]!, title: row[2]!, tags: row[3]!.replace(/`/g, '') });
}

// The Claimed table: | ID | Who | Branch | Since | Files |
const claims = new Map<string, string>();
const section = /### Claimed([\s\S]*?)\n---/.exec(status)?.[1] ?? '';
for (const line of section.split('\n')) {
  const cells = line.split('|').map(c => c.trim());
  const ids = (cells[1] ?? '').match(/[A-Z]+-\d+[a-z]?/g);
  if (ids && cells[2]) for (const id of ids) claims.set(id, `${cells[2]}${cells[4] ? `, since ${cells[4]}` : ''}`);
}

const args = process.argv.slice(2);
const only = args.find(a => /^P\d$/.test(a)), freeOnly = args.includes('--free');
let shown = 0;
for (const item of items) {
  if (done.has(item.id) || (only && item.priority !== only)) continue;
  const claim = claims.get(item.id);
  if (freeOnly && claim) continue;
  console.log(`${item.priority}  ${item.id.padEnd(10)} ${claim ? `[CLAIMED: ${claim}]`.padEnd(40) : 'free'.padEnd(40)} ${item.title}  (${item.tags})`);
  shown++;
}
for (const id of claims.keys()) if (!items.some(i => i.id === id)) console.log(`note: STATUS claims ${id}, which is not in the TASKS priority list`);
if (!shown) console.log('Nothing matches.');
