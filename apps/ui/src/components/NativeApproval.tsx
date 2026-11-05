import {useState} from 'react';
import {OriginalToggle} from './OriginalToggle.tsx';

/** Only the exact owned native request is actionable; presentation never changes its payload. */
export function NativeApproval({request,busy,decide}:{request:{name:string;detail:string};busy:boolean;decide:(allow:boolean)=>void}) {
  const [raw,setRaw]=useState(false);
  let input:Record<string,unknown>|undefined;
  try {const value=JSON.parse(request.detail);if(value&&typeof value==='object'&&!Array.isArray(value))input=value;}catch{/* Keep unknown native requests readable verbatim. */}
  const command=typeof input?.command==='string'?input.command:undefined;
  const replacement=typeof input?.old_string==='string'&&typeof input.new_string==='string';
  const path=typeof input?.file_path==='string'?input.file_path:undefined;
  const structured=!!command||replacement;
  const missingPatch=request.name==='File change'&&!replacement;
  return <div className="tool-approval"><strong>{request.name} · approval requested</strong>
    {structured&&!raw?<>
      {path&&<small className="approval-path">{path}</small>}
      {command?<pre aria-label="Command awaiting approval">{command}</pre>:<pre aria-label="Proposed replacement"><span className="approval-removed">{String(input!.old_string).split('\n').map(line=>'- '+line).join('\n')}</span>{'\n'}<span className="approval-added">{String(input!.new_string).split('\n').map(line=>'+ '+line).join('\n')}</span></pre>}
      {typeof input?.cwd==='string'&&<small className="approval-path">{input.cwd}</small>}
      {replacement&&<small>Proposed replacement · it has not run</small>}
    </>:<pre aria-label="Native approval request">{request.detail}</pre>}
    {typeof input?.reason==='string'&&<small>{input.reason}</small>}
    {missingPatch&&<small>The native request did not supply a proposed diff. Decline here and review the change in the native harness.</small>}
    <div><button disabled={busy} onClick={()=>decide(false)}>Decline</button><button disabled={busy||missingPatch} onClick={()=>decide(true)}>Allow once</button>{structured&&<OriginalToggle original={raw} onToggle={()=>setRaw(!raw)}/>}</div>
  </div>;
}
