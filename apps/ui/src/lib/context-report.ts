/** Only captured local-command stdout can be a context report. Ordinary prompts stay ordinary. */
export interface ContextReportRow { label: string; value: string; percent?: number }
/** Another table the harness printed in the same report (its Skills, MCP tools, Memory files), kept apart from the categories. */
export interface ContextReportSection { title: string; rows: ContextReportRow[] }
export interface ContextReport { rows: ContextReportRow[]; sections: ContextReportSection[]; heading: string; raw: string; clipped: boolean }
const CATEGORY_ROWS = 48, SECTION_ROWS = 100, SECTIONS = 8;
export function contextReport(captured: string): ContextReport | undefined {
  const match = /^\s*<local-command-stdout>([\s\S]*?)<\/local-command-stdout>\s*$/.exec(captured);
  if (!match) return;
  const text = match[1]!.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
  // A command name mentioned in prose is not evidence. Require the report's own heading and table.
  const heading = text.match(/^\s*#{0,6}\s*(Context (?:Usage|Window)|Context)\s*$/im)?.[1];
  if (!heading || !/^\s*\|?\s*Category\s*\|\s*(?:Usage|Tokens|Size)\b/im.test(text)) return interactiveReport(text, captured);
  const rows: ContextReportRow[] = [], sections: ContextReportSection[] = [];
  let clipped = text.length > 262144, title = '', table: 'none' | 'categories' | 'section' = 'none', header = false, current: ContextReportRow[] = rows, categories = false;
  const cap = () => current === rows ? CATEGORY_ROWS : SECTION_ROWS;
  for (const line of text.slice(0, 262144).split('\n')) {
    if (!line.includes('|')) {
      // A table ends at the first line that is not a row; the last heading before the next table names it.
      table = 'none'; header = false;
      const named = line.trim().replace(/^#{1,6}\s*/, '').replace(/^\*\*(.*)\*\*:?$/, '$1').trim();
      if (named) title = named;
      continue;
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (table === 'none') {
      // The first line of a table is its header: the report's own category table once, any other table is a section.
      table = !categories && /^Category$/i.test(cells[0] ?? '') ? 'categories' : 'section';
      header = true;
      if (table === 'categories') { categories = true; current = rows; }
      else if (sections.length === SECTIONS) { clipped = true; current = []; }
      else { current = []; sections.push({ title: title || 'Table', rows: current }); }
      continue;
    }
    if (header && cells.every(c => /^[:\s-]*$/.test(c))) { header = false; continue; }
    header = false;
    if (cells.length < 2 || cells.every(c => /^[:\s-]*$/.test(c))) continue;
    if (current.length === cap()) { clipped = true; continue; }
    const originalLabel = cells[0]!, originalValue = cells.slice(1).join(' · ');
    if (originalLabel.length > 256 || originalValue.length > 512) clipped = true;
    const label = originalLabel.length > 256 ? `${originalLabel.slice(0, 256)}…` : originalLabel;
    const value = originalValue.length > 512 ? `${originalValue.slice(0, 512)}…` : originalValue;
    if (!label) continue;
    const percentText = value.match(/(?:^|[\s·(])(\d+(?:\.\d+)?)\s*%/);
    const percent = percentText ? Number(percentText[1]) : undefined;
    current.push({ label, value, ...(table === 'categories' && percent !== undefined && percent >= 0 && percent <= 100 ? { percent } : {}) });
  }
  return { heading, rows, sections: sections.filter(s => s.rows.length), raw: captured, clipped };
}

// The interactive `/context` prints a colour grid whose legend carries one line per category ("Messages: 266.9k tokens (26.7%)"),
// then one "Title · /command" block per kind with "└" detail lines. Same evidence as the table form: nothing is added or computed.
const LEGEND = /[⛀-⛃⛶⛝]\s+([^:()⛀-⛃⛶⛝]{1,80}?):\s+([0-9][0-9.,]*[kKmMbB]?)(\s+tokens)?\s*\((\d+(?:\.\d+)?)%\)\s*$/;
function interactiveReport(text: string, captured: string): ContextReport | undefined {
  if (!/^\s*Context Usage\b/.test(text)) return;
  const rows: ContextReportRow[] = [], sections: ContextReportSection[] = [];
  let clipped = text.length > 262144, section: ContextReportSection | undefined;
  for (const line of text.slice(0, 262144).split('\n')) {
    const legend = LEGEND.exec(line);
    if (legend) {
      if (rows.length === CATEGORY_ROWS) { clipped = true; continue; }
      const percent = Number(legend[4]);
      rows.push({ label: legend[1]!.trim(), value: `${legend[2]}${legend[3] ?? ''} · ${legend[4]}%`, ...(percent <= 100 ? { percent } : {}) });
      continue;
    }
    const detail = /^\s*└\s*(.+?)\s*$/.exec(line);
    if (detail && section) {
      if (section.rows.length === SECTION_ROWS) { clipped = true; continue; }
      const [label, ...rest] = detail[1]!.split(' · ');
      section.rows.push({ label: label!.slice(0, 256), value: rest.join(' · ').slice(0, 512) });
      continue;
    }
    const title = /^(\S[^└]{0,160}?\s·\s\/[\w-]+.*)$/.exec(line.trim())?.[1];
    if (title) { section = { title, rows: [] }; if (sections.length === SECTIONS) { clipped = true; section = undefined; } else sections.push(section); }
  }
  // A report is the harness's own category list; fewer than two recorded categories is not one.
  if (rows.length < 2) return;
  return { heading: 'Context Usage', rows, sections: sections.filter(item => item.rows.length), raw: captured, clipped };
}
