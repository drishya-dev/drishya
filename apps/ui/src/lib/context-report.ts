/** Only captured local-command stdout can be a context report. Ordinary prompts stay ordinary. */
export interface ContextReportRow { label: string; value: string; percent?: number }
export interface ContextReport { rows: ContextReportRow[]; heading: string; raw: string; clipped: boolean }
export function contextReport(captured: string): ContextReport | undefined {
  const match = /^\s*<local-command-stdout>([\s\S]*?)<\/local-command-stdout>\s*$/.exec(captured);
  if (!match) return;
  const text = match[1]!.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
  // A command name mentioned in prose is not evidence. Require the report's own heading and table.
  const heading = text.match(/^\s*#{0,6}\s*(Context (?:Usage|Window)|Context)\s*$/im)?.[1];
  if (!heading || !/^\s*\|?\s*Category\s*\|\s*(?:Usage|Tokens|Size)\b/im.test(text)) return;
  const rows: ContextReportRow[] = [];
  let inTable = false, clipped = text.length > 262144;
  for (const line of text.slice(0, 262144).split('\n')) {
    if (/^\s*\|?\s*Category\s*\|/i.test(line)) { inTable = true; continue; }
    if (!inTable || !line.includes('|')) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (cells.length < 2 || cells.every(c => /^[:\s-]*$/.test(c))) continue;
    if (rows.length === 48) { clipped = true; continue; }
    const originalLabel = cells[0]!, originalValue = cells.slice(1).join(' · ');
    if (originalLabel.length > 256 || originalValue.length > 512) clipped = true;
    const label = originalLabel.length > 256 ? `${originalLabel.slice(0, 256)}…` : originalLabel;
    const value = originalValue.length > 512 ? `${originalValue.slice(0, 512)}…` : originalValue;
    if (!label) continue;
    const percentText = value.match(/(?:^|[\s·(])(\d+(?:\.\d+)?)\s*%/);
    const percent = percentText ? Number(percentText[1]) : undefined;
    rows.push({ label, value, ...(percent !== undefined && percent >= 0 && percent <= 100 ? { percent } : {}) });
  }
  return { heading, rows, raw: captured, clipped };
}
