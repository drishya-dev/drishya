/** Render only the captured preview. React escapes every value; no remote HTML or execution. */
export function StructuredResult({ text }: { text: string }) {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return <pre className="output result-prose">{text}</pre>; }
  const scalar = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const rows = Array.isArray(value) ? value : record(value) && Array.isArray(value.items) ? value.items : undefined;
  if (rows?.length && rows.every(record)) {
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => rows.every((row) => !Object.hasOwn(row, key) || scalar(row[key]))).slice(0, 4);
    if (keys.length) return <div className="structured-result" onClick={(e) => e.stopPropagation()}><table><thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row, i) => <tr key={i}>{keys.map((key) => <td key={key}>{Object.hasOwn(row, key) ? String(row[key]) : <span className="muted">not present</span>}</td>)}</tr>)}</tbody></table><div className="material-context">{rows.length} records in captured preview · up to 8 rows and 4 fields shown</div><OriginalPreview text={text} /></div>;
  }
  if (record(value) && Object.keys(value).length <= 6 && Object.values(value).every(scalar)) return <><dl className="result-fields">{Object.entries(value).map(([key, v]) => <div key={key}><dt>{key}</dt><dd>{String(v)}</dd></div>)}</dl><OriginalPreview text={text} /></>;
  return <pre className="output">{text}</pre>;
}

function OriginalPreview({ text }: { text: string }) {
  return <details className="result-original"><summary>Original captured preview</summary><pre className="output">{text}</pre></details>;
}
