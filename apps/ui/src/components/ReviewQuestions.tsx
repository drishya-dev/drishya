import { useEffect, useState } from 'react';
import type { Operation } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { readQuestions, saveQuestion, type ReviewQuestion } from '../lib/review-questions.ts';
import { ReadingDialog } from './ProductShell.tsx';
import {prepareCorrection} from './InvestigationActions.tsx';
import {operationObservation} from '../../../../packages/scene/src/operation-observations.ts';

function useQuestions() {
  const id = useApp(s => s.recordingId), kind = useApp(s => s.source?.kind);
  const key = `drishya-review-questions-v1:${kind}:${id}`;
  const read = () => { try { return readQuestions(localStorage.getItem(key) ?? '[]'); } catch { return []; } };
  const [state, setState] = useState(() => ({ key, items: read() }));
  const [error, setError] = useState('');
  const items = state.key === key ? state.items : read();
  if (state.key !== key) setState({ key, items });
  useEffect(() => {
    const refresh = () => setState({ key, items: read() });
    window.addEventListener('drishya-review-questions', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('drishya-review-questions', refresh); window.removeEventListener('storage', refresh); };
  }, [key]);
  const update = (question: ReviewQuestion) => {
    try { const next = saveQuestion(read(), question); localStorage.setItem(key, JSON.stringify(next)); setError(''); setState({ key, items: next }); window.dispatchEvent(new Event('drishya-review-questions')); }
    catch (error) { setError(error instanceof Error && error.message.startsWith('Question limit') ? error.message : 'Could not save questions in this browser. Copy your text before closing.'); }
  };
  const remove = (id: string) => {
    try { const next = read().filter(item => item.id !== id || item.status !== 'resolved'); localStorage.setItem(key, JSON.stringify(next)); setState({ key, items: next }); setError(''); window.dispatchEvent(new Event('drishya-review-questions')); }
    catch { setError('Could not remove the saved question.'); }
  };
  return { items, update, remove, error };
}

export function ReviewQuestionEditor({ op }: { op: Operation }) {
  const mode = useApp(s => s.mode);
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId);
  const projection=useApp(s=>s.projection),sequence=operationObservation(projection,op.id);
  const [prepareError,setPrepareError]=useState('');
  const { items, update, error } = useQuestions();
  const existing = items.find(item => item.operationId === op.id && item.status === 'open');
  const [text, setText] = useState(existing?.question ?? ''), [owner, setOwner] = useState(existing?.owner ?? ''), [saved, setSaved] = useState(false);
  if (mode === 'replay') return null;
  return <details className="review-question-editor"><summary>Leave a review question</summary>
    <p>Your note · anchored to this captured action, separate from agent output.</p>
    <textarea aria-label="Review question" maxLength={2000} placeholder="What still needs checking or a decision?" value={text} onChange={e => { setText(e.target.value); setSaved(false); }} />
    <input aria-label="Question owner" maxLength={80} placeholder="Owner (optional)" value={owner} onChange={e => { setOwner(e.target.value); setSaved(false); }} />
    <button className="btn" disabled={!text.trim()||sequence===undefined} onClick={() => {
      const now = new Date().toISOString();
      update({ id: existing?.id ?? crypto.randomUUID(), operationId: op.id, title: op.title, sequence: sequence!, sequenceBasis:'captured-observation', question: text, owner, status: 'open', createdAt: existing?.createdAt ?? now, updatedAt: now }); setSaved(true);
    }}>Save question</button>{source?.kind==='daemon'&&id&&!id.includes('+')&&<button className="btn ghost" disabled={!text.trim()} onClick={()=>{try{prepareCorrection(op,text);setPrepareError('');}catch(error){setPrepareError((error as Error).message);}}}>Prepare question with harness</button>}<span role="status">{prepareError || error || (saved ? 'Saved locally · view in Review questions' : '')}</span>
  </details>;
}

export function ReviewQuestionsEntry() {
  const { items, update, remove, error } = useQuestions();
  const [open, setOpen] = useState(false), [shown, setShown] = useState(20);
  const id = useApp(s => s.recordingId), mode = useApp(s => s.mode);
  const [preview, setPreview] = useState<string>();
  const [copyStatus, setCopyStatus] = useState('');
  const [targetError, setTargetError] = useState(''), [opening, setOpening] = useState<string>();
  useEffect(() => { setPreview(undefined); setCopyStatus(''); }, [items]);
  const unresolved = items.filter(item => item.status === 'open'), resolved = items.filter(item => item.status === 'resolved');
  const openTarget = async (item: ReviewQuestion) => {
    if (useApp.getState().recordingId !== id) return;
    setTargetError(''); setOpening(item.id);
    try {
      const state = useApp.getState();
      if (!state.projection?.operations.some(op => op.id === item.operationId) && state.historyPage) await state.loadHistoryWindow({ selectedOperationId: item.operationId });
      if (useApp.getState().recordingId !== id) return;
      if (!useApp.getState().projection?.operations.some(op => op.id === item.operationId)) { setTargetError('Captured action is unavailable. Your question remains saved.'); return; }
      useApp.getState().select(item.operationId); setOpen(false);
    } catch { setTargetError('Could not open captured action · try again. Your question remains saved.'); }
    finally { setOpening(undefined); }
  };
  const rows = (questions: ReviewQuestion[]) => questions.slice(0, shown).map(item => <article key={item.id} className="review-question-row">
    <button className="question-target" disabled={!!opening} onClick={() => void openTarget(item)}>{opening === item.id ? 'Opening captured action…' : `Captured action · ${item.title} ↗`}</button>
    <p>{item.question}</p><small>{item.owner ? `Owner: ${item.owner}` : 'Unassigned'} · Your review note</small>
    <button className="btn ghost small" onClick={() => update({ ...item, status: item.status === 'open' ? 'resolved' : 'open', updatedAt: new Date().toISOString() })}>{item.status === 'open' ? 'Resolve question' : 'Reopen question'}</button>
    {item.status === 'resolved' && <button className="btn ghost small" onClick={() => remove(item.id)}>Remove resolved question</button>}
  </article>);
  return <><button className="btn ghost" data-review-questions disabled={mode === 'replay'} onClick={() => setOpen(true)}>Review questions{mode !== 'replay' && unresolved.length ? ` · ${unresolved.length}` : ''}</button>
    {open && mode !== 'replay' && <ReadingDialog title="Review questions" close={() => setOpen(false)} className="review-questions-dialog">
      <p className="review-question-scope">Your questions about this session. They stay open until you resolve them.</p>
      {error && <p role="alert">{error}</p>}
      {targetError && <p role="alert">{targetError}</p>}
      <section aria-label="Open review questions">{rows(unresolved)}{!unresolved.length && <p>No open review questions. Leave one from an action's detail.</p>}</section>
      {!!resolved.length && <details className="resolved-questions"><summary>Resolved questions · {resolved.length}</summary>{rows(resolved)}</details>}
      {Math.max(unresolved.length, resolved.length) > shown && <button className="btn" onClick={() => setShown(n => n + 20)}>Show more questions</button>}
      <button className="btn" disabled={!unresolved.length} onClick={() => setPreview(unresolved.map(item => `## ${item.title}\n\n${item.question}\n\nOwner: ${item.owner || 'Unassigned'}\nCaptured action reference: ${item.operationId}\nLocal reviewer note, not agent output or proof of coverage.`).join('\n\n'))}>Preview open questions</button>
      {preview && <section className="question-export"><h3>Review before copying</h3><textarea aria-label="Question handoff preview" value={preview} readOnly /><button className="btn" onClick={() => void navigator.clipboard.writeText(preview).then(() => setCopyStatus('Copied reviewer questions'), () => setCopyStatus('Copy unavailable · select the preview text'))}>Copy questions</button><span role="status">{copyStatus}</span></section>}
      <small className="question-cap">Local browser · up to 100 questions per recording · removal is explicit</small>
    </ReadingDialog>}
  </>;
}
