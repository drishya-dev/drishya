import { createContext, useContext, useState, type ReactNode } from 'react';

export interface Presentation { motion: boolean; hoverReading: boolean; backdrop: boolean; compact: boolean }
export const defaultPresentation: Presentation = { motion: true, hoverReading: true, backdrop: true, compact: false };
const key = 'drishya.modern.presentation.v1';
export function readPresentation(): Presentation {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    return Object.fromEntries(Object.entries(defaultPresentation).map(([name, fallback]) => [name, typeof saved?.[name] === 'boolean' ? saved[name] : fallback])) as unknown as Presentation;
  } catch { return { ...defaultPresentation }; }
}
const Context = createContext({ preferences: defaultPresentation, update: (_name: keyof Presentation, _value: boolean) => {} });
export function PresentationProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPresentation);
  const update = (name: keyof Presentation, value: boolean) => setPreferences(previous => {
    const next = { ...previous, [name]: value };
    // Only presentation switches, never session content or native permissions.
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Still works for this visit when browser storage is unavailable. */ }
    return next;
  });
  return <Context.Provider value={{ preferences, update }}>{children}</Context.Provider>;
}
export const usePresentation = () => useContext(Context);

export function PresentationSettings() {
  const { preferences, update } = usePresentation();
  const options: [keyof Presentation, string, string][] = [
    ['motion', 'Material motion', 'Show arrivals and transitions. Your system’s reduced-motion preference always takes priority.'],
    ['hoverReading', 'Enlarge on header hover', 'Rest on an action’s heading to read more. Click still opens the evidence reader.'],
    ['backdrop', 'Repository backdrop', 'Keep the bounded repository drawing behind captured work. Turn off for a quieter stage.'],
    ['compact', 'Compact spacing', 'Bring passages closer while keeping code and prose at their readable font size.'],
  ];
  return <section className="md-presentation-settings"><div><h2>Make room for your way of working.</h2></div><p>Presentation changes immediately. Capture and native execution stay independent.</p>{options.map(([name, label, description]) => <label className="md-preference" key={name}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" role="switch" checked={preferences[name]} onChange={event => update(name, event.target.checked)} /><i aria-hidden="true" /></label>)}</section>;
}
