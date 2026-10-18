/** Shared utility marks stay distinct from the semantic marks on captured materials. */
export function InterfaceGlyph({ name }: { name: 'search' | 'refresh' | 'play' | 'arrow' | 'local' | 'folder' | 'map' }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 4.5 4.5" /></>,
    refresh: <><path d="M19 8a7.5 7.5 0 0 0-13-2L3 9m0-5v5h5M5 16a7.5 7.5 0 0 0 13 2l3-3m0 5v-5h-5" /></>,
    play: <path d="m8 5 11 7-11 7Z" />,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    local: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    map: <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="m7 5 10 0M6 7l5 10m7-10-5 10"/></>,
    folder: <path d="M3 7V5h7l2 3h9v12H3Z"/>,
  };
  return <svg className="interface-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
