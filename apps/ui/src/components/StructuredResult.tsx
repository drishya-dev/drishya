import {useMemo,useState,type ReactNode} from 'react';
import {ReadingCaption,WithOriginal} from './OriginalToggle.tsx';
import {CapturedResultViews} from './CapturedResultViews.tsx';
import {CapturedOutcomes} from './CapturedOutcomes.tsx';
import { toolOutputText } from '../lib/tool-output.ts';
import { ToolOutput } from './ToolOutput.tsx';
import {dataLabel,isDataRecord,parseCapturedJson,structuredData} from '../lib/structured-data.ts';
/** Render only the captured preview. React escapes every value; no remote HTML or execution. */
export function StructuredResult({text}:{text:string}){
  const formatted=useMemo(()=>toolOutputText(text),[text]);
  const [raw,setRaw]=useState(false);
  const unwrappedJson=useMemo(()=>{
    if(!formatted.decoded||raw)return false;
    try{return parseCapturedJson(formatted.text)!==undefined&&structuredData(formatted.text)!==undefined;}catch{return false;}
  },[formatted.decoded,formatted.text,raw]);
  const viewText=formatted.decoded&&!raw&&unwrappedJson?formatted.text:text;
  const shownText=formatted.decoded&&!raw?formatted.text:text;
  return <>
    <CapturedOutcomes output={formatted.decoded?formatted.text:text}/>
    {formatted.decoded&&(unwrappedJson||raw)&&<div className="structured-tool-output"><ReadingCaption label={raw?'Envelope':'Tool data'} title={raw?undefined:'Unwrapped from the MCP content envelope the tool returned'} original={raw} onToggle={()=>setRaw(value=>!value)}/></div>}
    <div className="result-readings">
      <CapturedResultViews
        text={viewText}
        fallback={<ResultBody text={shownText} decoded={!raw&&formatted.decoded&&!unwrappedJson} envelopeText={text}/>}
        inlineReading={(!raw&&unwrappedJson)||(!formatted.decoded&&structuredLayout(text)===undefined)||(raw&&structuredLayout(text)===undefined)}
      />
    </div>
  </>;
}
/** The compact layouts a result already gets in place: a short record table or a flat field list. Anything else is undefined. */
function structuredLayout(text: string): ReactNode | undefined {
  let value: unknown;
  try { value = parseCapturedJson(text); } catch { return undefined; }
  const scalar = (v: unknown) => !Array.isArray(v)&&!isDataRecord(v);
  const record = isDataRecord;
  const rows = Array.isArray(value) ? value : record(value) && Array.isArray(value.items) ? value.items : undefined;
  if (rows?.length && rows.every(record)) {
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => rows.every((row) => !Object.hasOwn(row, key) || scalar(row[key]))).slice(0, 4);
    if (keys.length) return <WithOriginal text={text}><div className="structured-result" onClick={(e) => e.stopPropagation()}><table><thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row, i) => <tr key={i}>{keys.map((key) => <td key={key}>{Object.hasOwn(row, key) ? dataLabel(row[key]) : <span className="muted">not present</span>}</td>)}</tr>)}</tbody></table><div className="material-context">{rows.length} records in preview · up to 8 rows and 4 fields shown</div></div></WithOriginal>;
  }
  if (record(value) && Object.keys(value).length <= 6 && Object.values(value).every(scalar)) return <WithOriginal text={text}><dl className="result-fields">{Object.entries(value).map(([key, v]) => <div key={key}><dt>{key}</dt><dd>{dataLabel(v)}</dd></div>)}</dl></WithOriginal>;
  return undefined;
}
function ResultBody({ text,decoded,envelopeText }: { text: string;decoded:boolean;envelopeText:string }) {
  if(decoded) return <ToolOutput text={envelopeText} inspect={false}/>;
  try { parseCapturedJson(text); } catch { return <pre className="output result-prose">{text}</pre>; }
  return structuredLayout(text) ?? <pre className="output">{text}</pre>;
}
