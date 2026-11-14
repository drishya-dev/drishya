// LIVE-7: tells viewers that a harness has started (or is still starting) a session journal, so Home
// can list it within about a second instead of waiting for its slow full discovery scan.
//
// This only looks at file names and, for journals still small, their size. It opens nothing, parses
// nothing and writes nothing, so it can never affect capture (constraint 10) or touch a harness file
// (constraint 2). Nothing here needs a viewer: the daemon starts it only while one is connected.

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { claudeHome } from '@drishya/adapter-claude';
import { codexHome } from '@drishya/adapter-codex';

export interface WatchRoot {
  dir: string;
  /** Directory levels below `dir` that may hold journals (0: only `dir` itself). */
  depth: number;
  match: (name: string) => boolean;
}

/** Where the built-in adapters keep session journals; the same places their discovery reads. */
export function defaultWatchRoots(): WatchRoot[] {
  return [
    { dir: join(claudeHome(), 'projects'), depth: 1, match: (n) => n.endsWith('.jsonl') },
    { dir: join(codexHome(), 'sessions'), depth: 4, match: (n) => n.startsWith('rollout-') && n.endsWith('.jsonl') },
  ];
}

/** A journal this small is still being created: its growth changes what discovery can show (a title appears with the first prompt). */
export const EARLY_BYTES = 64 * 1024;

export class SourceWatch {
  private readonly roots: WatchRoot[];
  private readonly onChange: () => void;
  private readonly intervalMs: number;
  private readonly settled = new Set<string>();
  private timer: NodeJS.Timeout | undefined;
  private last: string | undefined;
  private running = false;

  constructor(roots: WatchRoot[], onChange: () => void, intervalMs = 1000) {
    this.roots = roots;
    this.onChange = onChange;
    this.intervalMs = intervalMs;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    this.timer.unref();
    void this.poll(true);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One look at the roots; calls `onChange` when journals appeared, vanished or (while small) grew. */
  async poll(baseline = false): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    try {
      const parts: string[] = [];
      for (const root of this.roots) await this.walk(root, root.dir, root.depth, parts);
      parts.sort();
      const key = parts.join('\n');
      const changed = this.last !== undefined && key !== this.last;
      this.last = key;
      if (changed && !baseline) this.onChange();
      return changed;
    } finally {
      this.running = false;
    }
  }

  private async walk(root: WatchRoot, dir: string, depth: number, out: string[]): Promise<void> {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const path = join(dir, e.name);
      if (e.isDirectory()) {
        if (depth > 0) await this.walk(root, path, depth - 1, out);
      } else if (root.match(e.name)) {
        if (this.settled.has(path)) { out.push(path); continue; }
        const size = (await stat(path).catch(() => undefined))?.size ?? 0;
        if (size >= EARLY_BYTES) { this.settled.add(path); out.push(path); } else out.push(`${path}:${size}`);
      }
    }
  }
}
