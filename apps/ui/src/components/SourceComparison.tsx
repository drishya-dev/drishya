import { useMemo } from 'react';
import { compareDraft } from '../lib/draft-comparison.ts';
import { DiffReader } from './ArtifactReader.tsx';
export function SourceComparison({ before, after, path, labels, navigationKey }: {
    before: string;
    after: string;
    path: string;
    labels: {
        before: string;
        after: string;
    };
    navigationKey: string;
}) {
    const comparison = useMemo(() => compareDraft(before, after), [before, after]);
    return <section className="source-version-comparison" aria-label="Source version comparison">
    <p>{labels.before} → {labels.after} · derived comparison, not a captured patch or applied edit</p>
    {comparison.kind === 'patch' ? comparison.hunks.length ? <DiffReader hunks={comparison.hunks} path={path} navigationKey={navigationKey} scope="source-comparison" labels={labels}/> : <p role="status">These texts are identical.</p> : <><p>Comparison budget reached. Both complete texts remain readable.</p><div className="desk-comparison-texts"><label>{labels.before}<textarea readOnly value={before} aria-label={labels.before}/></label><label>{labels.after}<textarea readOnly value={after} aria-label={labels.after}/></label></div></>}
  </section>;
}
