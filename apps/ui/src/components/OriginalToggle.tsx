import {createContext, useContext, useState, type ReactNode} from 'react';
import './original-toggle.css';

/** One way to the recorded original, the same everywhere (Yash, 3 Nov): the formatted reading is the default and the original replaces it in place, never beside it. */
export function OriginalToggle({original, onToggle}: {original: boolean; onToggle: () => void}) {
  return <button type="button" className="original-toggle" aria-pressed={original} title={original ? 'Back to the formatted reading' : 'Show what was recorded, unformatted'} onClick={event => {event.stopPropagation(); onToggle();}}>Original</button>;
}

/** The caption above a formatted material: what it is, and the one switch to its original. */
export function ReadingCaption({label, original, onToggle, title}: {label: string; original: boolean; onToggle: () => void; title?: string}) {
  return <div className="structured-output-controls reading-caption"><span title={title}>{label}</span><OriginalToggle original={original} onToggle={onToggle}/></div>;
}

/** A formatted reading with its recorded text one switch away, in the same place: never both on screen. */
export const OriginalOwned = createContext(false);
export function WithOriginal({text, children}: {text: string; children: ReactNode}) {
  const [original, setOriginal] = useState(false), owned = useContext(OriginalOwned);
  if (owned) return <>{children}</>;
  return <div className="with-original" onClick={event => event.stopPropagation()}>{original ? <pre className="output original-text" tabIndex={0}>{text}</pre> : children}<OriginalToggle original={original} onToggle={() => setOriginal(value => !value)}/></div>;
}
