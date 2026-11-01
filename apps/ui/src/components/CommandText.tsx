import {useState} from 'react';
import {Highlighted} from '../lib/highlight.tsx';
import {commandDisplay} from '../lib/command-display.ts';
import {useApp} from '../state.ts';

const folder=(path:string)=>path.replace(/^["']|["']$/g,'').replace(/\\/g,'/').replace(/^\/([a-z])\//i,'$1:/').replace(/\/+$/,'').toLowerCase();
/** A shortened preview leads with the command, not with the session's own folder. The copy and the expanded reading stay exact. */
export function CommandText({text,compact=false}:{text:string;compact?:boolean}) {
  const root=useApp(s=>s.recording?.workspaceRoot);
  const [copied,setCopied]=useState(false);
  const [raw,setRaw]=useState(false);
  const formatted=commandDisplay(text), shown=raw?text:formatted.text;
  const cd=compact&&root?/^cd\s+("[^"]+"|'[^']+'|\S+)\s*&&\s*/.exec(shown):null,home=cd&&folder(cd[1]!)===folder(root!)?cd:null;
  const body=home?shown.slice(home[0].length):shown;
  const wrapper=/^(\s*(?:const\s+\w+\s*=\s*)?(?:text\()?await\s+tools\.[\w.]+\()/.exec(body)?.[0];
  return <div className="command-request">{formatted.decoded&&<div className="structured-output-controls"><span>{raw?'Captured request':'Command argument · decoded'}</span><button aria-pressed={raw} onClick={e=>{e.stopPropagation();setRaw(!raw);setCopied(false);}}>{raw?'Show command':'Show raw request'}</button></div>}<div className="cmd command-material"><span aria-hidden="true">$</span><code>{home&&<span className="command-cd" title={home[0].trim()}>cd workspace &amp;&amp; </span>}{wrapper&&<span className="command-wrapper">{wrapper}</span>}{body.slice(wrapper?.length??0).split('\n').map((line,n)=><span key={n}><Highlighted line={line} lang={wrapper?'typescript':'shell'}/>{'\n'}</span>)}</code><button type="button" aria-label={raw?'Copy captured request':'Copy command'} title={copied?'Copied':'Copy'} onClick={e=>{e.stopPropagation();void navigator.clipboard.writeText(shown).then(()=>setCopied(true)).catch(()=>setCopied(false));}}>{copied?'✓':'⧉'}</button></div></div>;
}
