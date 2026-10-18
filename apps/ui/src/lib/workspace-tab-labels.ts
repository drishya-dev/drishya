/** Add only enough parent context to distinguish files sharing a basename. */
export function workspaceTabLabels(paths:string[]):Map<string,string>{
 const labels=new Map<string,string>(),parts=new Map(paths.map(path=>[path,path.replaceAll('\\','/').split('/')]));
 for(const path of paths){
  const segments=parts.get(path)!,name=segments.at(-1)??path;
  const peers=paths.filter(other=>other!==path&&parts.get(other)!.at(-1)===name);
  if(!peers.length||segments.length===1){labels.set(path,name);continue;}
  let count=1;
  while(count<segments.length-1&&peers.some(other=>parts.get(other)!.slice(-count-1).join('/')===segments.slice(-count-1).join('/')))count++;
  labels.set(path,`${name} · ${segments.slice(-count-1,-1).join('/')}`);
 }
 return labels;
}
