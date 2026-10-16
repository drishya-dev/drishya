import {useState} from 'react';
import {Highlighted} from '../lib/highlight.tsx';
export function CommandText({text}:{text:string}) {
  const [copied,setCopied]=useState(false);
  const wrapper=/^(\s*(?:const\s+\w+\s*=\s*)?(?:text\()?await\s+tools\.[\w.]+\()/.exec(text)?.[0];
  return <div className="cmd command-material"><span aria-hidden="true">$</span><code>{wrapper&&<span className="command-wrapper">{wrapper}</span>}{text.slice(wrapper?.length??0).split('\n').map((line,n)=><span key={n}><Highlighted line={line} lang={wrapper?'typescript':'shell'}/>{'\n'}</span>)}</code><button type="button" aria-label="Copy command" title={copied?'Copied':'Copy command'} onClick={e=>{e.stopPropagation();void navigator.clipboard.writeText(text).then(()=>setCopied(true)).catch(()=>setCopied(false));}}>{copied?'✓':'⧉'}</button></div>;
}
