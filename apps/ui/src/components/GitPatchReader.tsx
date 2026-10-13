import { useMemo, useState } from 'react';
import type { GitFile } from '../../../daemon/src/git-types.ts';
import { gitPatchSections } from '../lib/git-patch.ts';
import { DiffReader } from './ArtifactReader.tsx';
import { CodeView } from './common.tsx';

export function GitPatchReader({ file }: { file: GitFile }) {
  const sections = useMemo(() => gitPatchSections(file.patch), [file.patch]);
  const [scope, setScope] = useState(() => sections.some(section => section.name === 'Working tree') ? 'Working tree' : 'Staged');
  const section = sections.find(section => section.name === scope) ?? sections[0];
  const [raw, setRaw] = useState(false), [page, setPage] = useState(0);
  const lines = useMemo(() => file.patch.split('\n'), [file.patch]);
  const structured = !raw && !!section?.hunks.length;
  return <div className="git-patch-reader">
    <nav className="reader-tools" aria-label="Git patch scope">
      {sections.map(item => <button key={item.name} className="btn ghost small" aria-pressed={section === item} onClick={() => { setScope(item.name); setPage(0); }}>{item.name}</button>)}
      <button className="btn ghost small" aria-pressed={raw} onClick={() => { setRaw(value => !value); setPage(0); }}>Raw patch</button>
    </nav>
    {section?.partial && !raw && <p className="material-context">Some patch hunks could not be parsed safely. Raw patch retains the complete loaded output.</p>}
    {structured ? <DiffReader key={section.name} hunks={section.hunks} path={file.path} scope="current-git" navigationKey={`git/${file.fingerprint}/${section.name}`} /> : <>
      <CodeView text={lines.slice(page, page + 120).join('\n')} path={file.path} />
      {lines.length > 120 && <nav className="reader-pages" aria-label="Raw Git patch pages"><button className="btn" disabled={!page} onClick={() => setPage(n => Math.max(0, n - 120))}>Previous patch lines</button><span>{page + 1}–{Math.min(page + 120, lines.length)} of {lines.length}</span><button className="btn" disabled={page + 120 >= lines.length} onClick={() => setPage(n => n + 120)}>Next patch lines</button></nav>}
    </>}
  </div>;
}
