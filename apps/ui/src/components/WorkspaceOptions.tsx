import type {ReactNode} from 'react';

/** Secondary actions stay beside their owner, outside the ordinary reading path. */
export function WorkspaceOptions({label,children}:{label:string;children:ReactNode}){
 return <details className="desk-options" onKeyDown={event=>{
  if(event.key!=='Escape'||!event.currentTarget.open)return;
  event.preventDefault();event.stopPropagation();
  document.documentElement.removeAttribute('data-ui-press');
  event.currentTarget.removeAttribute('data-pointer-menu');event.currentTarget.open=false;
  event.currentTarget.querySelector<HTMLElement>(':scope>summary')?.focus({preventScroll:true});
 }} onClick={event=>{
  const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if(!target||target.disabled)return;
  const menu=event.currentTarget;menu.open=false;
  if(menu.contains(document.activeElement))menu.querySelector<HTMLElement>(':scope>summary')?.focus({preventScroll:true});
 }}><summary className="btn ghost" aria-label={label} title={label}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg><span>Actions</span></summary><div className="desk-options-body">{children}</div></details>;
}
