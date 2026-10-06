/** Small silhouettes identify material, while the visible title preserves its meaning. */
export function MaterialGlyph({ material }: { material: string }) {
  const paths: Record<string, string> = {
    source: 'M5 2h7l5 5v15H5z M12 2v6h5 M8 12h6 M8 16h6',
    change: 'M7 3v18 M17 3v18 M4 8h6 M14 15h6 M17 12v6',
    terminal: 'M3 4h18v16H3z M6 9l3 3-3 3 M12 15h5',
    verification: 'M4 6l2 2 4-4 M13 6h7 M4 16l2 2 4-4 M13 16h7',
    matches: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
    external: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M8 12h8 M12 8v8',
  };
  return <svg className="material-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[material] ?? 'M4 4h16v16H4z M8 9h8 M8 15h5'} /></svg>;
}
