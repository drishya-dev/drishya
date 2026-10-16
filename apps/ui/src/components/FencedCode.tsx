import {useState} from 'react';
import {Highlighted} from '../lib/highlight.tsx';
/** Copy the captured text exactly. Visual wrapping never rewrites commands. */
export function FencedCode({text,language}:{text:string;language:string}) {
  const lines=text.split('\n');
  const prose=/^(text|txt|plaintext)?$/i.test(language);
  const [wrap,setWrap]=useState(prose),[status,setStatus]=useState('');
  const copy=async(oneLine=false)=>{
    try {await navigator.clipboard.writeText(oneLine?text.replace(/\s*\r?\n\s*/g,' '):text);setStatus(oneLine?'Copied as one line':'Copied');}
    catch {setStatus('Select the text to copy');}
  };
  return <section className="fenced-material" aria-label={`${language||'Text'} block`}><header><span>{language||'Text'}</span><span className="fenced-status" role="status">{status}</span><button type="button" aria-pressed={wrap} onClick={()=>setWrap(!wrap)}>Wrap</button><button type="button" onClick={()=>void copy()}>Copy</button>{prose&&text.includes('\n')&&<button type="button" onClick={()=>void copy(true)}>Copy as one line</button>}</header><pre className={`md-code${prose?' md-code-text':''}${wrap?' code-wrap':' code-nowrap'}`} tabIndex={0}>{lines.map((line,n)=><div key={n}><Highlighted line={line} lang={language||undefined}/>{n<lines.length-1?'\n':''}</div>)}</pre></section>;
}
