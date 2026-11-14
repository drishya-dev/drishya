import {useState} from 'react';
import {Highlighted} from '../lib/highlight.tsx';
import {commandDisplay} from '../lib/command-display.ts';
import {useApp} from '../state.ts';
import {ReadingCaption} from './OriginalToggle.tsx';
import {LineClamp} from '../lib/line-clamp.tsx';

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
  const lines=body.slice(wrapper?.length??0).split('\n');
  // One block per command line, so a wrapped line hangs under its own start and a heredoc keeps its structure.
  const code=<code>{lines.map((line,n)=><span className="cmd-line" key={n}>{n===0&&home&&<span className="command-cd" title={home[0].trim()}>cd workspace &amp;&amp; </span>}{n===0&&wrapper&&<span className="command-wrapper">{wrapper}</span>}<Highlighted line={line} lang={wrapper?'typescript':'shell'} breaks/>{'\n'}</span>)}</code>;
  return <div className="command-request">{formatted.decoded&&<ReadingCaption label={raw?'Request':'Command'} title={raw?undefined:'The command argument, decoded from the request'} original={raw} onToggle={()=>{setRaw(!raw);setCopied(false);}}/>}<div className="cmd command-material"><span aria-hidden="true">$</span>{compact?<LineClamp lines={4} className="cmd-clamp">{code}</LineClamp>:code}<button type="button" aria-label={raw?'Copy request':'Copy command'} title={copied?'Copied':'Copy'} onClick={e=>{e.stopPropagation();void navigator.clipboard.writeText(shown).then(()=>setCopied(true)).catch(()=>setCopied(false));}}>{copied?'✓':'⧉'}</button></div></div>;
}
