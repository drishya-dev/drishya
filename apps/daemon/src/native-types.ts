// Controller API types, independent of Node runtime and immutable observations.
/** `permission` is a mode the harness itself offers (UI-43); Drishya passes it through the harness's own protocol, nothing more. */
export interface TurnOptions { model?: string; effort?: string; permission?: string }
/** A permission mode as the harness reports it; `allowed` is false when the harness's own requirements refuse it. */
export interface NativePermission { id: string; allowed: boolean; description?: string }
export interface NativeUsage {
  input: number; output: number; cached: number; costUsd?: number;
  contextWindow?: number; contextInput?: number; threadTotal?: number; reasoningOutput?: number; cacheCreated?: number;
}
export interface NativeSettings {
  scope: 'workspace-config' | 'connected-session';
  model?: string; effort?: string; permission?: string; sandbox?: string;
  /** `description` is the harness's own text; Claude Code starts it with the model's version ("Opus 5.5 · …"). */
  models: { id: string; name: string; description?: string; efforts: string[]; images?: boolean }[];
  permissions?: NativePermission[];
  commands: string[];
}
