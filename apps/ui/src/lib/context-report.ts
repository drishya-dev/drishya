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
  if (!heading || !/^\s*\|?\s*Category\s*\|\s*(?:Usage|Tokens|Size)\b/im.test(text)) return;
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
      else { current = []; sections.push({ title: title || 'Recorded table', rows: current }); }
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
