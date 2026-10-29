import type {GitHistoryPage,GitBranchComparison} from '../../../daemon/src/git-types.ts';
import './git-branches.css';

function Comparison({label,value}:{label:string;value?:GitBranchComparison}) {
  return <span>{label}{value?` · ${value.name}`:''}{value?.basis==='conventional-name'?' (local convention)':''}: {value?.state==='known'?`ahead ${value.ahead} · behind ${value.behind}`:value?.state==='shallow'?'unavailable in shallow history':value?.state==='unrelated'?'no merge-base':value?.state==='unavailable'?'comparison unavailable':'unknown locally'}</span>;
}

/** Selection only changes the read request. Checked-out state always remains explicit. */
export function GitBranchHeader({data,reference,choose,loading}:{data?:GitHistoryPage;reference:string;choose:(id:string)=>void;loading:boolean}) {
  const branches=data?.references.filter(ref=>ref.kind==='branch')??[];
  if(data?.selectedReference&&!branches.some(ref=>ref.id===data.selectedReference!.id))branches.push(data.selectedReference);
  const selected=data?.selectedReference??branches.find(ref=>ref.current);
  return <div className="atlas-branch-control">
    <label><span className="atlas-eyebrow">Read branch</span><select aria-label="Read local Git branch" value={reference} disabled={!data||loading} onChange={event=>choose(event.target.value)}>
      <option value="all">All local history</option>
      {branches.map(ref=><option key={ref.id} value={ref.id}>{ref.name}{ref.current?' · checked out':''}</option>)}
    </select></label>
    {data&&<div className="atlas-branch-facts" aria-label="Local branch details">
      <span>Checked out · {data.branch}</span>
      {selected&&<><span>{selected.upstream?`Upstream · ${selected.upstream} (local state)`:'No upstream configured'}</span>{selected.lastCommit&&<span>Last commit · <time dateTime={selected.lastCommit}>{new Date(selected.lastCommit).toLocaleString()}</time></span>}</>}
      {data.branchComparison&&<><Comparison label="Current" value={data.branchComparison.current}/><Comparison label="Default" value={data.branchComparison.default}/></>}
      {data.referenceTotal>data.references.length&&<span>More refs available in Branches &amp; tags</span>}
    </div>}
  </div>;
}
