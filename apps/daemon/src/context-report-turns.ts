/** The newest captured local-command outputs that could be Claude Code's `/context` report, for a reader that holds only a window of the history.
 *  The report itself is parsed by the UI (apps/ui/src/lib/context-report.ts); this only finds candidate captures, newest first. */
const MAX = 3, MAX_CHARS = 262_144;
export function contextReportCandidates(timeline: ReadonlyArray<{ type: string; prompt?: string; time?: string }>): { time?: string; prompt: string }[] {
  const found: { time?: string; prompt: string }[] = [];
  for (let i = timeline.length - 1; i >= 0 && found.length < MAX; i--) {
    const item = timeline[i]!, prompt = item.prompt;
    if (item.type !== 'turn' || !prompt || prompt.length > MAX_CHARS * 2 || !/^\s*<local-command-stdout>/.test(prompt) || !/Context Usage|Context Window|\bCategory\b/.test(prompt)) continue;
    found.push({ ...(item.time ? { time: item.time } : {}), prompt });
  }
  return found;
}
