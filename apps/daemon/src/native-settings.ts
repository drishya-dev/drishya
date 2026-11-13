import { spawn } from 'node:child_process';
import { redactText } from '@drishya/privacy';
import { HttpError } from './app.ts';

import type { TurnOptions, NativeSettings, NativePermission } from './native-types.ts';
export type { TurnOptions, NativeSettings, NativeUsage, NativePermission } from './native-types.ts';
const clean = (v: unknown): string | undefined => typeof v === 'string' && v.length <= 256 ? redactText(v).text : undefined;
export function turnOptions(value: unknown): TurnOptions {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['model', 'effort', 'permission'].includes(k))) throw new HttpError(400, 'only model, effort and a native permission mode can be selected here');
  const options = value as TurnOptions;
  if (options.model !== undefined && (typeof options.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/.test(options.model))) throw new HttpError(400, 'invalid model selection');
  if (options.effort !== undefined && !['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(options.effort)) throw new HttpError(400, 'invalid effort selection');
  if (options.permission !== undefined && (typeof options.permission !== 'string' || !/^:?[a-zA-Z][a-zA-Z-]{0,39}$/.test(options.permission))) throw new HttpError(400, 'invalid permission mode');
  return { ...(options.model ? { model: options.model } : {}), ...(options.effort ? { effort: options.effort } : {}), ...(options.permission ? { permission: options.permission } : {}) };
}

/**
 * UI-43. Claude Code reports its current mode but not the list, so the list is the CLI's own `--permission-mode` choices that
 * the person can pick in Claude Code itself. `default` keeps Drishya's launch exactly as before (`manual`, every request asked here).
 */
export const CLAUDE_PERMISSION_MODES = ['default', 'acceptEdits', 'plan', 'bypassPermissions'] as const;
/** Codex's own permission profiles (`permissionProfile/list`) and the sandbox each one selects through `thread/resume`. */
export const CODEX_PERMISSION_SANDBOX: Record<string, 'read-only' | 'workspace-write' | 'danger-full-access'> = { ':read-only': 'read-only', ':workspace': 'workspace-write', ':danger-full-access': 'danger-full-access' };
const claudePermissions = (): NativePermission[] => CLAUDE_PERMISSION_MODES.map(id => ({ id, allowed: true }));

/**
 * The chosen mode must be one the harness offers and allows. The harness still enforces its own policy (managed settings,
 * requirements, safe mode); this only refuses what Drishya could not pass through faithfully.
 */
export function permissionFor(name: 'claude' | 'codex', permission: string | undefined, settings: NativeSettings | undefined): string | undefined {
  if (!permission) return undefined;
  const supported = name === 'claude' ? (CLAUDE_PERMISSION_MODES as readonly string[]).includes(permission) : Object.hasOwn(CODEX_PERMISSION_SANDBOX, permission);
  if (!supported) throw new HttpError(400, `${name === 'claude' ? 'Claude Code' : 'Codex'} does not offer this permission mode here`);
  if (settings?.permissions?.some(p => p.id === permission && !p.allowed)) throw new HttpError(400, 'this permission mode is not allowed by the harness requirements');
  return permission;
}

export function nativeModels(values: unknown, claude = false): NativeSettings['models'] {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 200).flatMap(v => {
    const id = clean(claude ? v?.value : v?.model);
    if (!id || v.hidden) return [];
    const efforts = claude ? v.supportedEffortLevels : v.supportedReasoningEfforts?.map((e: any) => e.reasoningEffort);
    const description = clean(v.description);
    return [{ id, name: clean(v.displayName) ?? id, ...(description ? { description } : {}), efforts: Array.isArray(efforts) ? efforts.filter((e: unknown): e is string => typeof e === 'string' && e.length < 20).slice(0, 12) : [], ...(Array.isArray(v.inputModalities) ? { images: v.inputModalities.includes('image') } : {}) }];
  });
}

/** Only the profiles Drishya can select through the supported protocol; the harness's `allowed` flag is kept as reported. */
export function nativePermissions(values: unknown[]): NativePermission[] {
  return values.slice(0, 20).flatMap((v: any) => {
    if (!v || typeof v.id !== 'string' || !Object.hasOwn(CODEX_PERMISSION_SANDBOX, v.id)) return [];
    const description = clean(v.description);
    return [{ id: v.id, allowed: v.allowed !== false, ...(description ? { description } : {}) }];
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
      return { scope: 'workspace-config', permission: clean(value?.current_permission_mode), permissions: claudePermissions(), models: nativeModels(value?.models, true), commands: (value?.commands ?? []).map((v: any) => clean(v?.name)).filter((v: unknown): v is string => typeof v === 'string').slice(0, 100) };
    }
    await rpc('initialize', { clientInfo: { name: 'drishya', version: '0.1.0' }, capabilities: { experimentalApi: false } });
    write({ method: 'initialized' });
    const config = await rpc('config/read', { cwd, includeLayers: false });
    const models: NativeSettings['models'] = []; let cursor: string | undefined;
    for (let page = 0; page < 4; page++) {
      const catalog = await rpc('model/list', { limit: 50, includeHidden: false, cursor });
      models.push(...nativeModels(catalog.data)); cursor = catalog.nextCursor; if (!cursor) break;
    }
    // Older Codex builds have no profile list; their protocol's own three sandbox modes are the same choices.
    const profiles = await rpc('permissionProfile/list', { cwd }).catch(() => undefined);
    const permissions = Array.isArray(profiles?.data) ? nativePermissions(profiles.data) : Object.keys(CODEX_PERMISSION_SANDBOX).map(id => ({ id, allowed: true }));
    return { scope: 'workspace-config', permissions, model: clean(config.config?.model), effort: clean(config.config?.model_reasoning_effort), permission: clean(config.config?.approval_policy), sandbox: clean(config.config?.sandbox_mode), models, commands: ['compact'] };
  } finally {
    clearTimeout(timer); child.stdin!.end(); child.kill();
  }
}
