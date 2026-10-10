import { spawn } from 'node:child_process';
import { redactText } from '@drishya/privacy';
import { HttpError } from './app.ts';

import type { TurnOptions, NativeSettings } from './native-types.ts';
export type { TurnOptions, NativeSettings, NativeUsage } from './native-types.ts';
const clean = (v: unknown): string | undefined => typeof v === 'string' && v.length <= 256 ? redactText(v).text : undefined;
export function turnOptions(value: unknown): TurnOptions {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['model', 'effort'].includes(k))) throw new HttpError(400, 'only model and effort can be selected here; native permission policy remains protected');
  const options = value as TurnOptions;
  if (options.model !== undefined && (typeof options.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/.test(options.model))) throw new HttpError(400, 'invalid model selection');
  if (options.effort !== undefined && !['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(options.effort)) throw new HttpError(400, 'invalid effort selection');
  return { ...(options.model ? { model: options.model } : {}), ...(options.effort ? { effort: options.effort } : {}) };
}
export function nativeModels(values: unknown, claude = false): NativeSettings['models'] {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 200).flatMap(v => {
    const id = clean(claude ? v?.value : v?.model);
    if (!id || v.hidden) return [];
    const efforts = claude ? v.supportedEffortLevels : v.supportedReasoningEfforts?.map((e: any) => e.reasoningEffort);
    return [{ id, name: clean(v.displayName) ?? id, efforts: Array.isArray(efforts) ? efforts.filter((e: unknown): e is string => typeof e === 'string' && e.length < 20).slice(0, 12) : [], ...(Array.isArray(v.inputModalities) ? { images: v.inputModalities.includes('image') } : {}) }];
  });
}

/** Explicit capability probe: no user prompt, no thread resume, no config writes. */
export async function inspectNative(bin: string, name: 'claude' | 'codex', cwd: string, launch: typeof spawn = spawn): Promise<NativeSettings> {
  const args = name === 'codex' ? ['app-server', '--listen', 'stdio://'] : ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'manual', '--permission-prompts', 'host'];
  const child = launch(bin, args, { cwd, shell: false, windowsHide: true, stdio: 'pipe', env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' } });
  let sequence = 0, buffer = '';
  const requests = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  let rejectClaude: ((e: Error) => void) | undefined;
  let resolveClaude: ((v: any) => void) | undefined;
  const fail = (error: Error) => { for (const r of requests.values()) r.reject(error); requests.clear(); rejectClaude?.(error); };
  const timer = setTimeout(() => { fail(new Error('native settings probe timed out; check CLI sign-in and account access')); child.kill(); }, 15_000);
  child.stderr!.resume();
  child.on('error', fail); child.on('close', () => fail(new Error('native settings connection closed; check CLI sign-in and account access')));
  child.stdout!.setEncoding('utf8');
  child.stdout!.on('data', (chunk: string) => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 2 * 1024 * 1024) { fail(new Error('native settings frame too large')); child.kill(); return; }
    let end: number;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      try {
        const v = JSON.parse(line);
        if (name === 'claude' && v.type === 'control_response' && v.response?.request_id === 'inspect') {
          v.response.subtype === 'success' ? resolveClaude?.(v.response.response) : rejectClaude?.(new Error(redactText(String(v.response.error ?? 'native initialization failed')).text));
        } else if (!v.method && v.id !== undefined) {
          const r = requests.get(v.id); requests.delete(v.id);
          if (r) v.error ? r.reject(new Error(redactText(String(v.error.message)).text)) : r.resolve(v.result);
        }
      } catch { /* Native diagnostics are not capability data. */ }
    }
  });
  const write = (v: unknown) => child.stdin!.write(JSON.stringify(v) + '\n');
  const rpc = (method: string, params: unknown): Promise<any> => new Promise((resolve, reject) => { const id = ++sequence; requests.set(id, { resolve, reject }); write({ id, method, params }); });
  try {
    if (name === 'claude') {
      const ready = new Promise<any>((resolve, reject) => { resolveClaude = resolve; rejectClaude = reject; });
      write({ type: 'control_request', request_id: 'inspect', request: { subtype: 'initialize', hooks: null } });
      const value = await ready;
      return { scope: 'workspace-config', models: nativeModels(value?.models, true), commands: (value?.commands ?? []).map((v: any) => clean(v?.name)).filter((v: unknown): v is string => typeof v === 'string').slice(0, 100) };
    }
    await rpc('initialize', { clientInfo: { name: 'drishya', version: '0.1.0' }, capabilities: { experimentalApi: false } });
    write({ method: 'initialized' });
    const config = await rpc('config/read', { cwd, includeLayers: false });
    const models: NativeSettings['models'] = []; let cursor: string | undefined;
    for (let page = 0; page < 4; page++) {
      const catalog = await rpc('model/list', { limit: 50, includeHidden: false, cursor });
      models.push(...nativeModels(catalog.data)); cursor = catalog.nextCursor; if (!cursor) break;
    }
    return { scope: 'workspace-config', model: clean(config.config?.model), effort: clean(config.config?.model_reasoning_effort), permission: clean(config.config?.approval_policy), sandbox: clean(config.config?.sandbox_mode), models, commands: ['compact'] };
  } finally {
    clearTimeout(timer); child.stdin!.end(); child.kill();
  }
}
