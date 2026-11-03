import './original-toggle.css';

/** One way to the recorded original, the same everywhere (Yash, 3 Nov): the formatted reading is the default and the original replaces it in place, never beside it. */
export function OriginalToggle({original, onToggle}: {original: boolean; onToggle: () => void}) {
  return <button type="button" className="original-toggle" aria-pressed={original} title={original ? 'Back to the formatted reading' : 'Show what was recorded, unformatted'} onClick={event => {event.stopPropagation(); onToggle();}}>Original</button>;
}

/** The caption above a formatted material: what it is, and the one switch to its original. */
export function ReadingCaption({label, original, onToggle, title}: {label: string; original: boolean; onToggle: () => void; title?: string}) {
  return <div className="structured-output-controls reading-caption"><span title={title}>{label}</span><OriginalToggle original={original} onToggle={onToggle}/></div>;
}
