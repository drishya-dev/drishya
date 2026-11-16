import { useState } from 'react';
import { useReveal } from '../lib/reveal.ts';
import type { Notice } from '@drishya/contracts';
import './notice-line.css';

/**
 * DATA-6: Claude Code noticed a file changed on disk outside its own edit tools. That can be the
 * person, another program, or a command the agent ran; the notice never says which, so neither do we.
 */
export function NoticeLine({ notice }: { notice: Notice }) {
  const [open, setOpen] = useState(false);
  // A protected file (e.g. .env) keeps only an omission marker; there is nothing to show.
  const snippet = notice.snippet?.startsWith('[OMITTED') ? undefined : notice.snippet;
  const reveal = useReveal<HTMLPreElement>(open && !!snippet);
  return <div className="notice-line" data-notice-id={notice.id}>
    <button type="button" className="notice-line-head" aria-expanded={open} disabled={!snippet} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      title="Claude Code noticed this file changed on disk outside its own edits: by you, another program, or a command it ran. It does not record which.">
      <span className="notice-line-path">{notice.path}</span>
      <span>changed outside Claude Code’s edits{notice.repeats ? ` · noticed ${notice.repeats + 1} times` : ''}</span>
      {snippet && <span className="notice-line-more">{open ? 'hide' : 'show what changed'}</span>}
    </button>
    {reveal.shown && snippet && <pre ref={reveal.ref} className="notice-line-snippet">{snippet}{notice.truncated ? '\n…' : ''}</pre>}
  </div>;
}
