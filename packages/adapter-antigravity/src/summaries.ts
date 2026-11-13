import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readablePath, conversationId, localPath } from './paths.ts';

export interface Summary {
  id: string;
  title?: string;
  workspaces: string[];
  parentSessionId?: string;
  agentName?: string;
}

export async function summaries(root: string): Promise<Map<string, Summary>> {
  let path: string;
  try { path = await readablePath(root, join(root, 'conversation_summaries.db'), 'index'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map(); throw error; }
  const uri = pathToFileURL(path);
  uri.search = '?mode=ro&immutable=1';
  const db = new DatabaseSync(uri.href, { readOnly: true });
  try {
    const rows = db.prepare('SELECT conversation_id, title, workspace_uris, parent_conversation_id, agent_name FROM conversation_summaries').all();
    const result = new Map<string, Summary>();
    for (const row of rows) {
      if (typeof row.conversation_id !== 'string' || !conversationId(row.conversation_id)) continue;
      let paths: unknown;
      try { paths = JSON.parse(typeof row.workspace_uris === 'string' ? row.workspace_uris : '[]'); } catch { paths = []; }
      result.set(row.conversation_id, {
        id: row.conversation_id,
        title: typeof row.title === 'string' && row.title.trim() ? row.title : undefined,
        workspaces: Array.isArray(paths) ? paths.flatMap(p => typeof p === 'string' && localPath(p) ? [localPath(p)!] : []) : [],
        parentSessionId: typeof row.parent_conversation_id === 'string' ? row.parent_conversation_id : undefined,
        agentName: typeof row.agent_name === 'string' ? row.agent_name : undefined,
      });
    }
    return result;
  } finally { db.close(); }
}
