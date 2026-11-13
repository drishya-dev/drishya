import { workspaceApi } from '../api.ts';
import './git-access.css';

// Git reads need the workspace root too, so the one Git approval carries it and says so.
export const grantGit=async(id:string,workspaceApproved:boolean,approveWorkspace:()=>Promise<unknown>)=>{
  if(!workspaceApproved)await approveWorkspace();
  await workspaceApi.approveGit(id);
};

export function GitAccess({workspaceApproved,busy,disabled,grant}:{workspaceApproved:boolean;busy:boolean;disabled:boolean;grant:()=>void}){
  return <section className="git-access">
    <h3>Read this repository’s Git</h3>
    <p>Local branches, tags, commits and their changes, with staged and unstaged work. This shows deleted files and other branches. Nothing is written to the repository.</p>
    {!workspaceApproved&&<p>Approving also lets Drishya read the files in this workspace.</p>}
    <button className="btn primary" disabled={disabled} onClick={grant}>{busy?'Approving…':'Approve read-only Git'}</button>
  </section>;
}
