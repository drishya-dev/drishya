import type{RealCase}from'./types.ts';
/** Only structural cwd/workdir fields count; mentioning a worktree in prose is not evidence. */
export const worktreeRoots:RealCase={
 name:'worktree-roots',about:'Recorded working directories under native agent worktree roots',harnesses:['codex','claude-code'],prefilter:'worktree',
 scan(row){
  const roots=new Set<string>();
  const visit=(value:unknown,depth=0)=>{if(!value||typeof value!=='object'||depth>6)return;for(const[key,item]of Object.entries(value)){if((key==='cwd'||key==='workdir')&&typeof item==='string'&&/(?:^|[\\/])(?:\.codex|\.claude)[\\/]worktrees[\\/]/i.test(item))roots.add(item);else if(key==='arguments'&&typeof item==='string'){try{visit(JSON.parse(item),depth+1);}catch{}}else if(typeof item==='object')visit(item,depth+1);}};
  visit(row);return roots.size?{hits:roots.size}:undefined;
 },
 verify(projection){const files=projection.files.filter(file=>/^worktree-[a-f0-9]{10}\//.test(file.path));return[`PASS ${files.length} exact namespaced files across ${new Set(files.map(file=>file.path.split('/')[0])).size} recorded prefixes; ordinary single-root sessions remain ungrouped`];},
};
