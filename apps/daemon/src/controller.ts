// Opt-in supported harness clients. Passive capture never calls this module.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { redactText, sanitize } from '@drishya/privacy';
import { App, HttpError } from './app.ts';
import { WorkspaceAccess } from './workspace.ts';
import { executable } from './native-executable.ts';
export { executable } from './native-executable.ts';

type RecordValue = Record<string, any>;
export interface ControllerState {
  submittedPrompt?: string;
  afterSequence?: number;
  phase?: 'waiting' | 'thinking' | 'responding' | 'tool';
  preview?: { id: string; role: 'response' | 'reasoning'; exposure?: 'summary' | 'full'; text: string };
  usage?: { input: number; output: number; cached: number; costUsd?: number };
  runId?: string;
  state: 'idle' | 'connecting' | 'running' | 'approval' | 'completed' | 'failed' | 'stopped';
  harness: string;
  available: boolean;
  output: string;
  error?: string;
  tools: string[];
  inventory: 'unknown' | 'runtime';
  approvals: { id: string; name: string; detail: string }[];
  promptRedacted?: boolean;
}
interface Run {
  state: ControllerState;
  child: ChildProcessWithoutNullStreams;
  pending: Map<string, { wireId: string | number; method: string; input?: unknown }>;
  requests: Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>;
  timer: NodeJS.Timeout;
  shutdown?: NodeJS.Timeout;
  prompt?: string;
  claudeSessionState?: string;
  claudeTasks: Set<string>;
  claudeResult: boolean;
  turnId?: string;
  threadId: string;
  sequence: number;
  blocks: Map<string, { role: 'response' | 'reasoning'; exposure?: 'summary' | 'full'; text: string }>;
}

export class HarnessController {
  private runs = new Map<string, Run>();
  private starting = new Set<string>();
  private app: App;
  private workspaces: WorkspaceAccess;
  private options: { launch?: typeof spawn; resolveExecutable?: typeof executable; timeoutMs?: number };
  constructor(app: App, workspaces: WorkspaceAccess,
    options: { launch?: typeof spawn; resolveExecutable?: typeof executable; timeoutMs?: number } = {}) {
    this.app = app; this.workspaces = workspaces; this.options = options;
  }

  status(id: string): ControllerState {
    const rec = this.app.recording(id);
    const name = rec.harness === 'claude-code' ? 'claude' : rec.harness === 'codex' ? 'codex' : undefined;
    return this.runs.get(id)?.state ?? { state: 'idle', harness: rec.harness, available: !!name && !!(this.options.resolveExecutable ?? executable)(name), output: '', tools: [], inventory: 'unknown', approvals: [] };
  }

  private write(run: Run, data: unknown) {
    if (run.child.stdin.destroyed || run.child.stdin.writableLength > 256 * 1024) throw new Error('harness input is unavailable');
    run.child.stdin.write(JSON.stringify(data) + '\n');
  }
  private rpc(run: Run, method: string, params: unknown): Promise<any> {
    const id = ++run.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { run.requests.delete(id); reject(new Error(`harness did not answer ${method}`)); }, 60_000);
      run.requests.set(id, { resolve, reject, timer });
      try { this.write(run, { id, method, params }); } catch (e) { clearTimeout(timer); run.requests.delete(id); reject(e); }
    });
  }
  private finish(run: Run, state: ControllerState['state'], error?: string) {
    if (['completed', 'failed', 'stopped'].includes(run.state.state)) return;
    run.state.state = state;
    run.state.error = error ? redactText(error).text.slice(0, 4000) : undefined;
    run.state.approvals = [];
    run.blocks.clear();
    run.pending.clear();
    clearTimeout(run.timer);
    for (const p of run.requests.values()) { clearTimeout(p.timer); p.reject(new Error('harness connection ended')); }
    run.requests.clear();
    run.child.stdin.end();
    // A controller owns only this child, never another terminal or harness process.
    run.shutdown = setTimeout(() => run.child.kill(), 2000);
    run.shutdown.unref();
  }
  private output(run: Run, text: string, replace = false) {
    // Keep raw partial tokens private until the whole bounded buffer has been redacted.
    // Cross-chunk secrets are not exposed. Only complete messages/outcomes call this.
    run.state.output = redactText(replace ? text : run.state.output + text).text.slice(0, 128 * 1024);
  }
  private approval(run: Run, wireId: string | number, method: string, name: string, input: unknown) {
    if (run.pending.size >= 8) throw new Error('too many pending tool approvals');
    const id = randomUUID();
    const safe = sanitize(input).value;
    if (JSON.stringify(safe) !== JSON.stringify(input) || JSON.stringify(safe).length > 16_000) throw new Error('tool approval contains protected, redacted or oversized input; continue in the native harness to review it');
    run.pending.set(id, { wireId, method, input: safe });
    run.state.approvals.push({ id, name: redactText(name).text, detail: JSON.stringify(safe, null, 2).slice(0, 16_000) });
    run.state.state = 'approval';
  }

  async start(id: string, prompt: unknown, exclusive: unknown): Promise<ControllerState> {
    if (this.starting.has(id)) throw new HttpError(409, 'this session is already connecting');
    this.starting.add(id);
    try { return await this.startTurn(id, prompt, exclusive); } finally { this.starting.delete(id); }
  }

  private async startTurn(id: string, prompt: unknown, exclusive: unknown): Promise<ControllerState> {
    if (id.includes('+')) throw new HttpError(400, 'choose one harness session');
    if (typeof prompt !== 'string' || !prompt.trim() || Buffer.byteLength(prompt) > 64 * 1024) throw new HttpError(400, 'prompt must be 1–65536 bytes');
    if (exclusive !== true) throw new HttpError(400, 'confirm this session is idle in its other harness clients');
    const current = this.runs.get(id);
    if (current && ['connecting', 'running', 'approval'].includes(current.state.state)) throw new HttpError(409, 'this session already has a turn running here');
    if (this.starting.size + [...this.runs.values()].filter(r => ['connecting', 'running', 'approval'].includes(r.state.state)).length > 2) throw new HttpError(429, 'at most two harness connections at once');
    const root = await this.workspaces.root(id);
    const rec = this.app.recording(id);
    const name = rec.harness === 'claude-code' ? 'claude' : rec.harness === 'codex' ? 'codex' : undefined;
    const bin = name && (this.options.resolveExecutable ?? executable)(name);
    if (!bin || !rec.sourcePath) throw new HttpError(409, 'supported native harness CLI is not installed or this is an offline recording');
    // Session identity comes from the original, read-only journal, not a guessed recording ID.
    const handle = await open(rec.sourcePath, 'r');
    let sessionId: string | undefined;
    try {
      const buf = Buffer.alloc(256 * 1024);
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
      for (const line of buf.subarray(0, bytesRead).toString('utf8').split('\n')) {
        try { const v = JSON.parse(line); sessionId = rec.harness === 'codex' && v.type === 'session_meta' ? v.payload?.id : rec.harness === 'claude-code' ? v.sessionId ?? v.session_id : undefined; } catch { continue; }
        if (sessionId) break;
      }
    } finally { await handle.close(); }
    if (!sessionId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sessionId)) throw new HttpError(409, 'no resumable native session ID in this journal');
    const safe = redactText(prompt);
    const args = name === 'claude' ? ['-p', '--resume', sessionId, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', 'manual', '--permission-prompts', 'host'] : ['app-server', '--stdio'];
    const child = (this.options.launch ?? spawn)(bin, args, { cwd: root, shell: false, windowsHide: true, stdio: 'pipe', env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_SDK_READS_SESSION_STATE: '1' } }) as ChildProcessWithoutNullStreams;
    const state: ControllerState = { runId: randomUUID(), state: 'connecting', submittedPrompt: safe.text, afterSequence: rec.observationCount - 1, harness: rec.harness, available: true, output: '', tools: [], inventory: 'unknown', approvals: [], promptRedacted: safe.hits.length > 0 };
    const run: Run = { state, child, pending: new Map(), requests: new Map(), blocks: new Map(), claudeTasks: new Set(), claudeResult: false, threadId: sessionId, sequence: 0, timer: setTimeout(() => this.finish(run, 'failed', 'harness turn exceeded the connection time limit'), this.options.timeoutMs ?? 30 * 60_000) };
    // Retain a bounded set of recent connection receipts, no raw journals or auth material.
    for (const [key, old] of this.runs) if (this.runs.size >= 16 && !['connecting', 'running', 'approval'].includes(old.state.state)) this.runs.delete(key);
    this.runs.set(id, run);
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 4 * 1024 * 1024) { this.finish(run, 'failed', 'harness frame exceeds 4 MiB'); return; }
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        try { this.message(run, JSON.parse(line), name!); } catch (e) { this.finish(run, 'failed', (e as Error).message); break; }
      }
    });
    child.stderr.setEncoding('utf8');
    // Native stderr may split secrets across chunks; never publish partial or truncated stderr.
    child.stderr.resume();
    child.on('error', e => this.finish(run, 'failed', e.message));
    child.on('close', code => { clearTimeout(run.shutdown); this.finish(run, 'failed', `harness exited before finishing (code ${code}); check its native sign-in and account access`); clearTimeout(run.shutdown); });
    // Existing journal capture observes the harness's own normal writes. No controller-created
    // journal records, synthetic deltas or changes to the captured event schema.
    this.app.ingest.startLive(id);
    if (name === 'claude') {
      this.write(run, { type: 'control_request', request_id: 'initialize', request: { subtype: 'initialize', hooks: null } });
      // Claude's initialization response is handled before the user message is sent.
      run.prompt = safe.text;
    } else {
      void this.connectCodex(run, root, safe.text).catch(e => this.finish(run, 'failed', e.message));
    }
    return state;
  }

  private async connectCodex(run: Run, root: string, prompt: string) {
    await this.rpc(run, 'initialize', { clientInfo: { name: 'drishya', version: '0.1.0', title: 'Drishya' }, capabilities: { experimentalApi: false } });
    this.write(run, { method: 'initialized' });
    const resumed = await this.rpc(run, 'thread/resume', { threadId: run.threadId, cwd: root, approvalPolicy: 'untrusted', sandbox: 'workspace-write', excludeTurns: true });
    if (resumed.thread?.status?.type === 'active') throw new Error('native thread is already active; finish its other turn first');
    const result = await this.rpc(run, 'turn/start', { threadId: run.threadId, input: [{ type: 'text', text: prompt, text_elements: [] }] });
    run.turnId = result.turn?.id;
    if (run.state.state === 'connecting') run.state.state = 'running';
    // Inventory is the actual resumed thread runtime, not a global guessed MCP configuration.
    try {
      const tools: string[] = []; let cursor: string | undefined;
      for (let page = 0; page < 8; page++) {
        const catalog = await this.rpc(run, 'mcpServerStatus/list', { threadId: run.threadId, limit: 100, cursor });
        for (const server of catalog.data ?? []) for (const tool of Object.keys(server.tools ?? {})) tools.push(`${server.name} / ${tool}`);
        cursor = catalog.nextCursor; if (!cursor) break;
      }
      run.state.tools = sanitize(tools.slice(0, 500)).value;
      run.state.inventory = 'runtime';
    } catch { /* Keep unknown catalog honest; it must not prevent an otherwise valid turn. */ }
  }

  private message(run: Run, v: RecordValue, name: string) {
    if (['completed', 'failed', 'stopped'].includes(run.state.state)) return;
    if (name === 'claude') {
      if (v.type === 'control_response' && v.response?.request_id === 'initialize') {
        if (v.response.subtype !== 'success') throw new Error(v.response.error ?? 'Claude initialization failed');
        const prompt = run.prompt;
        this.write(run, { type: 'user', session_id: run.threadId, message: { role: 'user', content: prompt } });
        delete run.prompt;
        run.state.state = 'running';
      } else if (v.type === 'control_request') {
        if (v.request?.subtype === 'can_use_tool') this.approval(run, v.request_id, 'claude-permission', String(v.request.tool_name), v.request.input);
        else this.write(run, { type: 'control_response', response: { subtype: 'error', request_id: v.request_id, error: 'unsupported controller request' } });
      } else if (v.type === 'system' && v.subtype === 'init') {
        run.state.tools = sanitize((v.tools ?? []).filter((t: unknown) => typeof t === 'string').slice(0, 500)).value;
        run.state.inventory = 'runtime';
      } else if (v.type === 'system' && v.subtype === 'session_state_changed') {
        run.claudeSessionState = v.state;
        if (v.state === 'idle' && run.claudeResult && !run.claudeTasks.size) this.finish(run, 'completed');
      } else if (v.type === 'system' && v.subtype === 'task_started') {
        if (['local_agent', 'local_workflow'].includes(v.task_type)) run.claudeTasks.add(v.task_id);
      } else if (v.type === 'system' && v.subtype === 'task_notification') {
        run.claudeTasks.delete(v.task_id);
        // A finished background task can wake another turn: wait for its result/idle.
      } else if (v.type === 'stream_event' && !v.parent_tool_use_id) {
        const event = v.event;
        const key = `claude:${event?.index ?? 0}`;
        if (event?.type === 'message_start') { run.blocks.clear(); run.state.phase = 'waiting'; }
        if (event?.type === 'content_block_start') {
          const block = event.content_block;
          run.state.phase = block?.type === 'thinking' ? 'thinking' : block?.type === 'tool_use' ? 'tool' : 'responding';
          if (block?.type === 'thinking' || block?.type === 'text') this.block(run, key, block.type === 'thinking' ? 'reasoning' : 'response', block.thinking ?? block.text ?? '', block.type === 'thinking' ? 'full' : undefined);
        }
        if (event?.type === 'content_block_delta') {
          const block = run.blocks.get(key);
          const text = event.delta?.type === 'thinking_delta' ? event.delta.thinking : event.delta?.type === 'text_delta' ? event.delta.text : undefined;
          if (block && typeof text === 'string') this.block(run, key, block.role, text, block.exposure, true);
        }
        if (event?.type === 'content_block_stop') this.publishBlock(run, key);
      } else if (v.type === 'assistant') {
        run.claudeResult = false;
        for (const [index, part] of (v.message?.content ?? []).entries()) {
          if (part.type === 'tool_use') run.state.phase = 'tool';
          if (!v.parent_tool_use_id && (part.type === 'text' || part.type === 'thinking')) {
            const key = `claude:${index}`;
            this.block(run, key, part.type === 'thinking' ? 'reasoning' : 'response', part.thinking ?? part.text ?? '', part.type === 'thinking' ? 'full' : undefined);
            this.publishBlock(run, key);
          }
          if (part.type === 'text') this.output(run, String(part.text) + '\n');
        }
      } else if (v.type === 'result') {
        if (v.usage && [v.usage.input_tokens, v.usage.output_tokens, v.usage.cache_read_input_tokens ?? 0].every(n => Number.isSafeInteger(n) && n >= 0)) run.state.usage = { input: v.usage.input_tokens, output: v.usage.output_tokens, cached: v.usage.cache_read_input_tokens ?? 0, ...(typeof v.total_cost_usd === 'number' && Number.isFinite(v.total_cost_usd) && v.total_cost_usd >= 0 ? { costUsd: v.total_cost_usd } : {}) };
        if (v.result) this.output(run, String(v.result), true);
        run.claudeResult = true;
        if (v.is_error) this.finish(run, 'failed', String(v.result ?? v.errors ?? v.subtype));
        else if ((!run.claudeSessionState || run.claudeSessionState === 'idle') && !run.claudeTasks.size) this.finish(run, 'completed');
      }
      return;
    }
    if (!v.method && v.id !== undefined) {
      const p = run.requests.get(v.id);
      if (p) { clearTimeout(p.timer); run.requests.delete(v.id); v.error ? p.reject(new Error(v.error.message)) : p.resolve(v.result); }
      return;
    }
    if (v.id !== undefined) {
      if (['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(v.method)) this.approval(run, v.id, v.method, v.method.includes('fileChange') ? 'File change' : 'Command execution', v.params);
      else this.write(run, { id: v.id, error: { code: -32601, message: 'Drishya does not support this interactive request; respond in the native harness' } });
      return;
    }
    if (v.params?.threadId && v.params.threadId !== run.threadId) return;
    if (run.turnId && v.params?.turnId && v.params.turnId !== run.turnId) return;
    const item = v.params?.item;
    if (v.method === 'turn/started') run.state.phase = 'waiting';
    if (v.method === 'item/started') run.state.phase = item?.type === 'reasoning' ? 'thinking' : item?.type === 'agentMessage' ? 'responding' : 'tool';
    if (['item/agentMessage/delta', 'item/reasoning/summaryTextDelta', 'item/reasoning/textDelta'].includes(v.method) && typeof v.params?.delta === 'string' && typeof v.params.itemId === 'string') {
      const reasoning = v.method !== 'item/agentMessage/delta';
      run.state.phase = reasoning ? 'thinking' : 'responding';
      const exposure = reasoning ? v.method.includes('summary') ? 'summary' : 'full' : undefined;
      this.block(run, `${v.params.itemId}:${exposure ?? 'response'}:${v.params.summaryIndex ?? v.params.contentIndex ?? 0}`, reasoning ? 'reasoning' : 'response', v.params.delta, exposure, true);
    }
    if (v.method === 'item/completed' && (item?.type === 'reasoning' || item?.type === 'agentMessage')) {
      const summary = (item.summary ?? []).filter((value: unknown) => typeof value === 'string').join('\n\n');
      const content = (item.content ?? []).filter((value: unknown) => typeof value === 'string').join('\n\n');
      const text = item.type === 'agentMessage' ? item.text : summary || content;
      if (typeof text === 'string' && text) {
        this.block(run, String(item.id), item.type === 'reasoning' ? 'reasoning' : 'response', text, item.type === 'reasoning' ? summary ? 'summary' : 'full' : undefined);
        this.publishBlock(run, String(item.id));
      } else for (const key of run.blocks.keys()) if (key.startsWith(`${item.id}:`)) this.publishBlock(run, key);
    }
    if (v.method === 'thread/tokenUsage/updated') {
      const u = v.params?.tokenUsage?.last;
      if (u && [u.inputTokens, u.outputTokens, u.cachedInputTokens].every(n => Number.isSafeInteger(n) && n >= 0)) run.state.usage = { input: u.inputTokens, output: u.outputTokens, cached: u.cachedInputTokens };
    }
    if (v.method === 'turn/started') run.turnId = v.params?.turn?.id;
    if (v.method === 'item/completed' && v.params?.item?.type === 'agentMessage') this.output(run, String(v.params.item.text) + '\n');
    if (v.method === 'turn/completed') this.finish(run, v.params?.turn?.status === 'failed' ? 'failed' : v.params?.turn?.status === 'interrupted' ? 'stopped' : 'completed', v.params?.turn?.error?.message);
    if (v.method === 'error' && !v.params?.willRetry) this.finish(run, 'failed', v.params?.error?.message ?? 'native harness error');
  }

  private block(run: Run, id: string, role: 'response' | 'reasoning', text: string, exposure?: 'summary' | 'full', append = false) {
    if (!run.blocks.has(id) && run.blocks.size >= 16) run.blocks.delete(run.blocks.keys().next().value!);
    const previous = append ? run.blocks.get(id)?.text ?? '' : '';
    // Never expose arbitrary token fragments: a credential may span native deltas.
    // Oversized blocks are omitted whole, rather than truncating before redaction.
    const combined = previous + text;
    run.blocks.set(id, { role, exposure, text: combined.length <= 65_536 && previous !== '\0' ? combined : '\0' });
  }
  private publishBlock(run: Run, id: string) {
    const block = run.blocks.get(id); run.blocks.delete(id);
    if (!block?.text || block.text === '\0') return;
    run.state.preview = { id: redactText(id).text.slice(0, 200), role: block.role, exposure: block.exposure, text: redactText(block.text).text };
  }

  decide(id: string, runId: unknown, approvalId: unknown, allow: unknown) {
    const run = this.runs.get(id);
    if (!run || run.state.runId !== runId || typeof approvalId !== 'string' || typeof allow !== 'boolean') throw new HttpError(409, 'approval is no longer current');
    const request = run.pending.get(approvalId);
    if (!request) throw new HttpError(409, 'approval already answered');
    if (request.method === 'claude-permission') this.write(run, { type: 'control_response', response: { subtype: 'success', request_id: request.wireId, response: allow ? { behavior: 'allow', updatedInput: request.input } : { behavior: 'deny', message: 'Declined in Drishya' } } });
    else this.write(run, { id: request.wireId, result: { decision: allow ? 'accept' : 'decline' } });
    run.pending.delete(approvalId);
    run.state.approvals = run.state.approvals.filter(p => p.id !== approvalId);
    run.state.state = run.pending.size ? 'approval' : 'running';
    return run.state;
  }
  async stop(id: string, runId: unknown) {
    const run = this.runs.get(id);
    if (!run || run.state.runId !== runId) throw new HttpError(409, 'connection is no longer current');
    if (['connecting', 'running', 'approval'].includes(run.state.state)) {
      try {
        if (run.state.harness === 'codex' && run.turnId) {
          await Promise.race([this.rpc(run, 'turn/interrupt', { threadId: run.threadId, turnId: run.turnId }), new Promise(resolve => { const t = setTimeout(resolve, 1500); t.unref(); })]);
        } else if (run.state.harness === 'claude-code') this.write(run, { type: 'control_request', request_id: 'interrupt', request: { subtype: 'interrupt' } });
      } catch { /* EOF and the bounded owned-child fallback still close this connection. */ }
      this.finish(run, 'stopped');
    }
    return run.state;
  }
  async forget(id: string) { const run = this.runs.get(id); if (run) await this.stop(id, run.state.runId); this.runs.delete(id); }
  async close() {
    await Promise.all([...this.runs.entries()].map(async ([id, run]) => {
      if (run.child.exitCode !== null || run.child.signalCode !== null) return;
      const closed = new Promise<void>(resolve => run.child.once('close', () => resolve()));
      await this.stop(id, run.state.runId);
      await closed;
    }));
  }
}
