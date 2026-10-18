import { useMemo } from 'react';
import type { WorkspaceDraft } from '../lib/workspace-drafts.ts';
import { compareDraft } from '../lib/draft-comparison.ts';
import { DiffReader } from './ArtifactReader.tsx';

export function DraftComparison({ draft, path, revision, baseLabel }: { draft: WorkspaceDraft; path: string; revision: number; baseLabel?:string }) {
  const comparison = useMemo(() => compareDraft(draft.base, draft.text), [draft.base, draft.text]);
  return <section className="desk-draft-comparison" aria-label={`Draft comparison for ${path}`}>
    <div className="desk-comparison-context"><span>{baseLabel??(draft.creation ? 'Empty base · new file draft' : 'Base from when this draft opened')}<small>Local comparison · not applied to disk</small></span>
      {comparison.kind === 'patch' && <span className="desk-comparison-counts"><span className="good">+{comparison.added}</span><span className="bad">−{comparison.removed}</span></span>}
    </div>
    {comparison.kind === 'patch' ? comparison.hunks.length ? <DiffReader key={revision} navigationKey={`local-draft/${path}/${revision}`} hunks={comparison.hunks} path={path} scope="local-draft" /> : <p className="desk-comparison-empty" role="status">No changes from the draft’s base.</p> : <>
      <p className="desk-comparison-note" role="status">Large comparison · complete texts shown instead of computing an expensive patch.</p>
      <div className="desk-comparison-texts"><label>Draft base<textarea readOnly spellCheck={false} aria-label={`Draft base for ${path}`} value={draft.base}/></label><label>Local draft<textarea readOnly spellCheck={false} aria-label={`Compared draft for ${path}`} value={draft.text}/></label></div>
    </>}
  </section>;
}
