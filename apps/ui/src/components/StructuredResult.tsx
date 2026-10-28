import {CapturedResultViews} from './CapturedResultViews.tsx';
import {useMemo} from 'react';
import {CapturedOutcomes} from './CapturedOutcomes.tsx';
import { toolOutputText } from '../lib/tool-output.ts';
import { ToolOutput } from './ToolOutput.tsx';
import {dataLabel,isDataRecord,parseCapturedJson} from '../lib/structured-data.ts';
/** Render only the captured preview. React escapes every value; no remote HTML or execution. */
export function StructuredResult({text}:{text:string}){const decoded=useMemo(()=>toolOutputText(text).decoded,[text]);return <><CapturedOutcomes output={text}/><div className="result-readings"><CapturedResultViews text={text} fallback={<ResultBody text={text} decoded={decoded}/>}/></div></>;}
function ResultBody({ text,decoded }: { text: string;decoded:boolean }) {
  if(decoded) return <ToolOutput text={text} inspect={false}/>;
  let value: unknown;
  try { value = parseCapturedJson(text); } catch { return <pre className="output result-prose">{text}</pre>; }
  const scalar = (v: unknown) => !Array.isArray(v)&&!isDataRecord(v);
  const record = isDataRecord;
  const rows = Array.isArray(value) ? value : record(value) && Array.isArray(value.items) ? value.items : undefined;
  if (rows?.length && rows.every(record)) {
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => rows.every((row) => !Object.hasOwn(row, key) || scalar(row[key]))).slice(0, 4);
    if (keys.length) return <div className="structured-result" onClick={(e) => e.stopPropagation()}><table><thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row, i) => <tr key={i}>{keys.map((key) => <td key={key}>{Object.hasOwn(row, key) ? dataLabel(row[key]) : <span className="muted">not present</span>}</td>)}</tr>)}</tbody></table><div className="material-context">{rows.length} records in captured preview · up to 8 rows and 4 fields shown</div><OriginalPreview text={text} /></div>;
  }
  if (record(value) && Object.keys(value).length <= 6 && Object.values(value).every(scalar)) return <><dl className="result-fields">{Object.entries(value).map(([key, v]) => <div key={key}><dt>{key}</dt><dd>{dataLabel(v)}</dd></div>)}</dl><OriginalPreview text={text} /></>;
  return <pre className="output">{text}</pre>;
}

function OriginalPreview({ text }: { text: string }) {
  return <details className="result-original"><summary>Original captured preview</summary><pre className="output">{text}</pre></details>;
}
