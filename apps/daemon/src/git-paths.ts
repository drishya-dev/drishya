import {isDeniedPath} from '@drishya/privacy';
export const safeGitPath=(path:string)=>!!path&&!path.startsWith('.local/')&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').some(p=>p==='..'||p==='.git'||p.includes(':'))&&!isDeniedPath(path);
export const gitDiffFlags=['--no-ext-diff','--no-textconv','--no-color','--no-renames','--ignore-submodules=all'];
