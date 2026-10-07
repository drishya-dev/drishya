/** Small silhouettes identify material, while the visible title preserves its meaning. */
export function MaterialGlyph({ material }: { material: string }) {
  const paths: Record<string, string> = {
    source: 'M5 2h7l5 5v15H5z M12 2v6h5 M8 12h6 M8 16h6',
    change: 'M4 20l4-1L20 7l-3-3L5 16z M14 7l3 3 M4 22h16',
    terminal: 'M5 5l7 7-7 7 M14 19h6',
    verification: 'M4 6l2 2 4-4 M13 6h7 M4 16l2 2 4-4 M13 16h7',
    matches: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
    external: 'M12 2l9 10-9 10L3 12z',
  };
  return <svg className="material-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[material] ?? 'M4 4h16v16H4z M8 9h8 M8 15h5'} /></svg>;
}
