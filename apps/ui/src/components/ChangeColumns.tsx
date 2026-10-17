import type { Hunk } from '@drishya/contracts';
import { splitDiffRows } from '../lib/split-diff.ts';
import { Highlighted, langOf } from '../lib/highlight.tsx';

export function ChangeColumns({ hunks, path, skipLines, maxLines, scope = 'captured' }: { hunks: Hunk[]; path?: string; skipLines: number; maxLines: number; scope?: 'captured' | 'current-git' | 'local-draft' }) {
  const rows = splitDiffRows(hunks, skipLines, maxLines);
  const lang = langOf(path);
  return <div className="change-columns" role="region" aria-label={scope === 'captured' ? 'Captured patch side by side' : scope === 'local-draft' ? 'Local draft side by side' : 'Current Git patch side by side'}>
    <div className="change-column-labels"><span>{scope === 'local-draft' ? 'Draft base' : 'Before patch'}</span><span>{scope === 'local-draft' ? 'Local draft' : 'After patch'}</span></div>
    <div className="change-column-scroll">
      {rows.map((row, i) => <div className="change-row" key={i}>
        {(['before', 'after'] as const).map((side) => <div className={`change-cell ${row[side]?.kind ?? 'empty'}`} key={side}>
          <span className="ln-no">{row[side]?.number ?? ''}</span>
          <span className="change-text">{row[side] && <Highlighted line={row[side].text} lang={lang} />}</span>
        </div>)}
      </div>)}
    </div>
    <div className="material-context">{scope === 'captured' ? 'Captured patch only' : scope === 'local-draft' ? 'Local draft comparison only' : 'Current Git patch only'} · columns aligned by patch order</div>
  </div>;
}
