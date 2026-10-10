// Controller API types, independent of Node runtime and immutable observations.
export interface TurnOptions { model?: string; effort?: string }
export interface NativeUsage {
  input: number; output: number; cached: number; costUsd?: number;
  contextWindow?: number; contextInput?: number; threadTotal?: number; reasoningOutput?: number; cacheCreated?: number;
}
export interface NativeSettings {
  scope: 'workspace-config' | 'connected-session';
  model?: string; effort?: string; permission?: string; sandbox?: string;
  models: { id: string; name: string; efforts: string[]; images?: boolean }[];
  commands: string[];
}
