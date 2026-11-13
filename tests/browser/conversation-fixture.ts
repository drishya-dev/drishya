import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A Claude Code journal big enough that the daemon pages its history (over 10,000 observations): `turns` prompts, each answered
 * by two messages with one run of reads between them. Every message names its turn, so a reader can check which ones are shown.
 */
export function writeLongSession(dir: string, session: string, turns = 700, reads = 7): string {
  const source = join(dir, session + '.jsonl'), base = { cwd: dir, sessionId: session };
  const rows: string[] = [];
  let n = 0;
  const at = () => new Date(Date.UTC(2026, 10, 13, 9, 0, 0) + 1000 * n++).toISOString();
  const row = (value: unknown) => rows.push(JSON.stringify(value));
  for (let t = 0; t < turns; t++) {
    row({ ...base, timestamp: at(), type: 'user', uuid: `p${t}`, message: { role: 'user', content: `Prompt ${t}: look at part ${t}` } });
    row({ ...base, timestamp: at(), type: 'assistant', uuid: `a${t}`, message: { id: `ma${t}`, role: 'assistant', content: [{ type: 'text', text: `Message ${t}-a: I will read the files for part ${t}.` }] } });
    for (let r = 0; r < reads; r++) {
      const id = `t${t}-${r}`;
      row({ ...base, timestamp: at(), type: 'assistant', uuid: `c${id}`, message: { id: `mc${id}`, role: 'assistant', content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: join(dir, `f${t}-${r}.ts`) } }] } });
      row({ ...base, timestamp: at(), type: 'user', uuid: `r${id}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: `contents ${t}-${r}` }] } });
    }
    row({ ...base, timestamp: at(), type: 'assistant', uuid: `b${t}`, message: { id: `mb${t}`, role: 'assistant', content: [{ type: 'text', text: `Message ${t}-b: finished part ${t}.` }] } });
  }
  writeFileSync(source, rows.join('\n') + '\n');
  return source;
}
