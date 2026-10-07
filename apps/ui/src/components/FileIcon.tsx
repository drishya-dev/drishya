/** Original compact glyphs; colour identifies file format, not execution state. */
export function FileIcon({ path, folder = false, open = false }: { path: string; folder?: boolean; open?: boolean }) {
  const ext = path.split('.').at(-1)?.toLowerCase();
  const label = folder ? '' : ({ ts: 'TS', tsx: 'TS', js: 'JS', jsx: 'JS', json: '{}', py: 'Py', rs: 'Rs', md: 'M', css: '#', html: '<>', yml: 'Y', yaml: 'Y', sh: '$', ps1: '$', sql: 'DB' } as Record<string, string>)[ext ?? ''] ?? '·';
  return <svg className={`file-format format-${folder ? 'folder' : ext}`} width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">{folder ? <path d={open ? 'M2 5h6l2 2h8l-2 10H2z M2 7V4h6l2 2h6' : 'M2 5h6l2 2h8v10H2z'} fill="none" stroke="currentColor" strokeWidth="1.5" /> : <><path d="M4 2h8l4 4v12H4z M12 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.2" /><text x="10" y="14" textAnchor="middle" fontSize="7" fill="currentColor" fontFamily="monospace" fontWeight="700">{label}</text></>}</svg>;
}
