import { useMemo } from 'react';
import { OriginalToggle } from './OriginalToggle.tsx';
import type { Hunk } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { patchEvidenceKey, recordedEditsForHunk } from '../lib/hunk-evidence.ts';
import type { GitFile } from '../../../daemon/src/git-types.ts';
import { gitPatchSections } from '../lib/git-patch.ts';
import { DiffReader } from './ArtifactReader.tsx';
import { CodeView } from './common.tsx';
import { useEvidenceState } from './EvidenceNavigation.tsx';
import { RecordedWorkMenu } from './RecordedWorkMenu.tsx';

/** `openRecorded` opens the captured patch of an edit; without it (or without matches) no per-hunk action appears. */
export function GitPatchReader({ file, openRecorded }: { file: GitFile; openRecorded?: (path: string, evidenceKey: string) => void }) {
  const operations = useApp(s => s.projection?.operations);
  const hunkAction = openRecorded && operations ? (hunk: Hunk) => {
    const matches = recordedEditsForHunk(hunk, file.path, operations);
    const latest = matches.at(-1);
    if (!latest) return null;
    if (matches.length > 1) return <RecordedWorkMenu matches={matches} open={key => openRecorded(file.path, key)} />;
    return <button className="btn ghost small hunk-recorded" title="Open the edit that wrote exactly these added lines" onClick={() => openRecorded(file.path, patchEvidenceKey(latest))}>Agent work</button>;
  } : undefined;
  const sections = useMemo(() => gitPatchSections(file.patch), [file.patch]);
  const key = `git/${file.path}/${file.fingerprint}`;
  const [scope, setScope] = useEvidenceState(`${key}/scope`, () => sections.some(section => section.name === 'Working tree') ? 'Working tree' : 'Staged');
  const section = sections.find(section => section.name === scope) ?? sections[0];
  const [raw, setRaw] = useEvidenceState(`${key}/raw`, false), [page, setPage] = useEvidenceState(`${key}/page`, 0);
  const lines = useMemo(() => file.patch.split('\n'), [file.patch]);
  const structured = !raw && !!section?.hunks.length;
  return <div className="git-patch-reader">
    <nav className="reader-tools" aria-label="Git patch scope">
      {sections.map(item => <button key={item.name} className="btn ghost small" aria-pressed={section === item} onClick={() => { setScope(item.name); setPage(0); }}>{item.name}</button>)}
      <OriginalToggle original={raw} onToggle={() => { setRaw(value => !value); setPage(0); }}/>
    </nav>
    {section?.partial && !raw && <p className="material-context">Some patch hunks could not be parsed safely. Raw patch retains the complete loaded output.</p>}
    {structured ? <DiffReader key={section.name} hunks={section.hunks} path={file.path} scope={section.name==='Commit'?'git-commit':'current-git'} navigationKey={`git/${file.fingerprint}/${section.name}`} hunkAction={hunkAction} /> : <>
      <div className="git-raw-scroll" tabIndex={0} role="region" aria-label="Raw patch content"><CodeView text={lines.slice(page, page + 120).join('\n')} startLine={page + 1} path={file.path} /></div>
      {lines.length > 120 && <nav className="reader-pages" aria-label="Raw Git patch pages"><button className="btn" disabled={!page} onClick={() => setPage(n => Math.max(0, n - 120))}>Previous patch lines</button><span>{page + 1}–{Math.min(page + 120, lines.length)} of {lines.length}</span><button className="btn" disabled={page + 120 >= lines.length} onClick={() => setPage(n => n + 120)}>Next patch lines</button></nav>}
    </>}
  </div>;
}
