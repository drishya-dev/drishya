import type { Hunk } from '@drishya/contracts';

export interface GitPatchSection { name: 'Staged' | 'Working tree' | 'Commit'; raw: string; hunks: Hunk[]; partial: boolean }
/** Only complete ordinary unified hunks receive line coordinates. Metadata,
 * binary and unsupported/partial patches remain readable in the raw view. */
export function gitPatchSections(patch: string): GitPatchSection[] {
  const sections: GitPatchSection[] = [];
  let section: GitPatchSection | undefined, hunk: Hunk | undefined, invalid = false;
  const flush = () => {
    if (hunk && section) {
      const old = hunk.lines.filter(line => line[0] !== '+').length;
      const next = hunk.lines.filter(line => line[0] !== '-').length;
      if (!invalid && old === hunk.oldLines && next === hunk.newLines) section.hunks.push(hunk);
      else section.partial = true;
    }
    hunk = undefined; invalid = false;
  };
  for (const line of patch.split('\n')) {
    if (line === 'Staged changes' || line === 'Working tree changes' || line === 'Commit changes') {
      flush(); section = { name: line === 'Staged changes' ? 'Staged' : line === 'Commit changes' ? 'Commit' : 'Working tree', raw: '', hunks: [], partial: false }; sections.push(section); continue;
    }
    if (!section) continue;
    section.raw += line + '\n';
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (header) {
      flush(); hunk = { oldStart: Number(header[1]), oldLines: Number(header[2] ?? 1), newStart: Number(header[3]), newLines: Number(header[4] ?? 1), lines: [] };
    } else if (line.startsWith('diff --git ')) flush();
    else if (line.startsWith('@@')) { flush(); section.partial = true; }
    else if (hunk && /^[ +\-]/.test(line)) hunk.lines.push(line);
    else if (hunk && line && !line.startsWith('\\ No newline at end of file')) invalid = true;
  }
  flush(); return sections;
}
