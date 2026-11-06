/** GFM table cells: only unescaped pipes delimit cells, including inside code. */
export function tableCells(line: string): string[] | undefined {
  const cells: string[] = []; let cell = '', pipes = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '\\') { cell += '\\\\'; i++; }
    else if (line[i] === '\\' && line[i + 1] === '|') { cell += '|'; i++; }
    else if (line[i] === '|') { cells.push(cell.trim()); cell = ''; pipes++; }
    else cell += line[i];
  }
  if (!pipes) return;
  cells.push(cell.trim());
  if (line.trimStart().startsWith('|')) cells.shift();
  if (/\|\s*$/.test(line) && !/\\\|\s*$/.test(line)) cells.pop();
  return cells;
}

export function tableHeader(lines: string[], start: number) {
  const cells = tableCells(lines[start] ?? ''), rules = tableCells(lines[start + 1] ?? '');
  if (!cells?.length || !rules || rules.length !== cells.length || !rules.every(rule => /^:?-{3,}:?$/.test(rule))) return;
  return { cells, align: rules.map(rule => rule.startsWith(':') ? rule.endsWith(':') ? 'center' as const : 'left' as const : rule.endsWith(':') ? 'right' as const : undefined) };
}
