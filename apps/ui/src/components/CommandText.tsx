import {useState} from 'react';
import {Highlighted} from '../lib/highlight.tsx';
import {commandDisplay} from '../lib/command-display.ts';
export function CommandText({text}:{text:string}) {
  const [copied,setCopied]=useState(false);
  const [raw,setRaw]=useState(false);
  const formatted=commandDisplay(text), shown=raw?text:formatted.text;
  const wrapper=/^(\s*(?:const\s+\w+\s*=\s*)?(?:text\()?await\s+tools\.[\w.]+\()/.exec(shown)?.[0];
  return <div className="command-request">{formatted.decoded&&<div className="structured-output-controls"><span>{raw?'Captured request':'Command argument · decoded JSON'}</span><button aria-pressed={raw} onClick={e=>{e.stopPropagation();setRaw(!raw);setCopied(false);}}>{raw?'Show command':'Show raw request'}</button></div>}<div className="cmd command-material"><span aria-hidden="true">$</span><code>{wrapper&&<span className="command-wrapper">{wrapper}</span>}{shown.slice(wrapper?.length??0).split('\n').map((line,n)=><span key={n}><Highlighted line={line} lang={wrapper?'typescript':'shell'}/>{'\n'}</span>)}</code><button type="button" aria-label={raw?'Copy captured request':'Copy command'} title={copied?'Copied':'Copy'} onClick={e=>{e.stopPropagation();void navigator.clipboard.writeText(shown).then(()=>setCopied(true)).catch(()=>setCopied(false));}}>{copied?'✓':'⧉'}</button></div></div>;
}
