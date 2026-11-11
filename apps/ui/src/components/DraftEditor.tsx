import { useId, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { Annotation, Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';
import { WORKSPACE_DRAFT_BYTES } from '../lib/workspace-drafts.ts';
import './draft-editor.css';

export interface DraftEditorHandle { focus: () => void }

function language(path:string) {
  const ext=path.split('.').at(-1)?.toLowerCase();
  if(['js','jsx','mjs','cjs','ts','tsx','mts','cts'].includes(ext??'')) return javascript({typescript:['ts','tsx','mts','cts'].includes(ext!),jsx:ext==='jsx'||ext==='tsx'});
  if(ext==='py')return python();
  if(ext==='json')return json();
  if(ext==='md'||ext==='mdx')return markdown();
  return [];
}
const syncedDraft = Annotation.define<boolean>();
const colors=HighlightStyle.define([
  {tag:tags.keyword,color:'var(--syntax-keyword,var(--external))'},
  {tag:tags.typeName,color:'var(--syntax-type,var(--source))'},
  {tag:[tags.string,tags.special(tags.string)],color:'var(--syntax-string,var(--pass))'},
  {tag:tags.function(tags.variableName),color:'var(--syntax-function,var(--source))'},
  {tag:tags.propertyName,color:'var(--syntax-property,var(--source))'},
  {tag:[tags.number,tags.bool,tags.null],color:'var(--syntax-number,var(--edited))'},
  {tag:tags.comment,color:'var(--t3)'},
]);

/** One editable DOM, memory-only. Keep its selection and undo history while comparing. */
export default function DraftEditor({path,text,change,error,hidden,ref}: {
  path:string; text:string; change:(text:string)=>void; error:(message:string)=>void;
  hidden:boolean; ref:Ref<DraftEditorHandle>;
}) {
  const keys=useId();
  const host=useRef<HTMLDivElement>(null),view=useRef<EditorView>(null);
  const callbacks=useRef({change,error});callbacks.current={change,error};
  const latestText=useRef(text);
  const [position,setPosition]=useState({line:1,column:1}),[wrap,setWrap]=useState(false);
  const wrapping=useRef(new Compartment());
  // A uniform CRLF/CR file must not be normalized by editing a single character.
  // Mixed endings keep CR characters as data by splitting only on LF.
  const breaks=text.match(/\r\n|\r|\n/g),mixed=!!breaks?.some(value=>value!==breaks[0]);
  const separator=useRef(mixed?'\n':breaks?.[0]??'\n');
  const leading=text.match(/^[ \t]+(?=\S)/m)?.[0];
  const indent=useRef(leading?.includes('\t')?'\t':leading&&leading.length<=8?leading:'  ');
  useImperativeHandle(ref,()=>({focus:()=>{if(host.current?.closest('.desk-pane.active'))view.current?.focus();}}),[]);
  useLayoutEffect(()=>{
    const initial=text;
    const editor=new EditorView({parent:host.current!,state:EditorState.create({doc:initial,extensions:[
      EditorState.lineSeparator.of(separator.current),EditorState.tabSize.of(2),indentUnit.of(indent.current),
      lineNumbers(),highlightActiveLineGutter(),highlightActiveLine(),drawSelection(),history(),bracketMatching(),indentOnInput(),
      keymap.of([{key:'Escape',run:view=>{view.setTabFocusMode(2000);return true;},preventDefault:true,stopPropagation:true},indentWithTab,...defaultKeymap,...historyKeymap]),language(path),syntaxHighlighting(colors),
      wrapping.current.of([]),EditorView.contentAttributes.of({'aria-label':`Local draft for ${path}`,'aria-describedby':keys,spellcheck:'false'}),
      EditorState.transactionFilter.of(transaction=>{
        if(transaction.docChanged && new TextEncoder().encode(transaction.newDoc.sliceString(0,transaction.newDoc.length,separator.current)).byteLength>WORKSPACE_DRAFT_BYTES) {
          queueMicrotask(()=>callbacks.current.error('Local drafts support up to 256 KiB of UTF-8 text. This change was not applied.'));
          return [];
        }
        return transaction;
      }),
      EditorView.updateListener.of(update=>{
        if(update.docChanged) {
          const value=update.state.sliceDoc();latestText.current=value;
          if(update.transactions.some(transaction=>transaction.docChanged&&!transaction.annotation(syncedDraft)))callbacks.current.change(value);
        }
        if(update.selectionSet||update.docChanged) {
          const head=update.state.selection.main.head,line=update.state.doc.lineAt(head);
          setPosition({line:line.number,column:head-line.from+1});
        }
      }),
    ]})});
    view.current=editor;
    if(!hidden&&host.current?.closest('.desk-pane.active'))editor.focus();
    return ()=>{view.current=null;editor.destroy();};
    // Keep the real editor mounted; shared draft updates below map into its existing state.
  },[path]);
  // Another pane or explicit recovery can update this same retained draft. Map one
  // minimal change into this view rather than remounting or replacing its selection/undo.
  useLayoutEffect(()=>{
    const editor=view.current;if(!editor||latestText.current===text)return;
    const next=editor.state.toText(text);if(editor.state.doc.eq(next)){latestText.current=text;return;}
    const before=editor.state.doc.toString(),after=next.toString();let from=0,endBefore=before.length,endAfter=after.length;
    while(from<endBefore&&from<endAfter&&before[from]===after[from])from++;
    while(endBefore>from&&endAfter>from&&before[endBefore-1]===after[endAfter-1]){endBefore--;endAfter--;}
    editor.dispatch({changes:{from,to:endBefore,insert:next.slice(from,endAfter)},annotations:[syncedDraft.of(true),Transaction.addToHistory.of(false)]});
  },[text,path]);
  useLayoutEffect(()=>{if(!hidden)view.current?.requestMeasure();},[hidden]);
  return <div className="draft-code-editor" hidden={hidden}>
    <div className="draft-editor-host" ref={host}/>
    <footer className="draft-editor-status"><span>Ln {position.line}, Col {position.column}</span><span>{mixed?'Mixed endings':separator.current==='\r\n'?'CRLF':separator.current==='\r'?'CR':'LF'} · {indent.current==='\t'?'Tabs':`${indent.current.length} spaces`}</span><span id={keys}>Tab indents · Esc then Tab leaves</span><button className="btn ghost" aria-pressed={wrap} onClick={()=>{const next=!wrap;setWrap(next);view.current?.dispatch({effects:wrapping.current.reconfigure(next?EditorView.lineWrapping:[])});}}>Wrap</button></footer>
  </div>;
}
