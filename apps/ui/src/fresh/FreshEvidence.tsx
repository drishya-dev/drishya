import { useEffect, useState } from 'react';
import type { Operation } from '@drishya/contracts';
import { redactText } from '../../../../packages/privacy/src/index.ts';
import type { VerificationTrail } from '../../../../packages/scene/src/verification.ts';
import type { FreshApi } from './api.ts';
import './evidence.css';

interface Question { id: string; operationId: string; text: string; resolved: boolean; createdAt: string }
const storageKey = (id: string) => `drishya-fresh-questions-v1:${id}`;
function readQuestions(id: string): Question[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(id)) ?? '[]');
    return Array.isArray(value) ? value.filter((q): q is Question => !!q && typeof q.id === 'string' && typeof q.operationId === 'string' && typeof q.text === 'string' && q.text.length <= 2000 && typeof q.resolved === 'boolean' && typeof q.createdAt === 'string').slice(-100) : [];
  } catch { return []; }
}

/** Local reviewer annotations stay separate from captured agent material. */
export function FreshEvidence({ api, recordingId, operation, onOperation, replay = false }: {
  api: FreshApi; recordingId: string; operation?: Operation; onOperation: (id: string) => void; replay?: boolean;
}) {
  const [trail, setTrail] = useState<VerificationTrail>();
  const [questions, setQuestions] = useState(() => readQuestions(recordingId));
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const change = operation?.kind === 'edit' || operation?.kind === 'write';
  useEffect(() => { setQuestions(readQuestions(recordingId)); setDraft(''); }, [recordingId]);
  useEffect(() => {
    setTrail(undefined); setError(undefined);
    if (!change || !operation || replay) { setLoading(false); return; }
    let active = true; setLoading(true);
    void api.request<VerificationTrail>(`recordings/${encodeURIComponent(recordingId)}/verification/${encodeURIComponent(operation.id)}`)
      .then(value => { if (active) setTrail(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Verification could not be read.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, recordingId, operation?.id, change, replay, reload]);
  const save = (next: Question[]) => {
    try { localStorage.setItem(storageKey(recordingId), JSON.stringify(next)); setQuestions(next); setError(undefined); return true; }
    catch { setError('This browser could not save the review note. Copy it before leaving.'); return false; }
  };
  const submit = () => {
    if (!operation || !draft.trim()) return;
    const text = redactText(draft.trim()).text.slice(0, 2000);
    if (questions.length >= 100) { setError('This recording has 100 local questions. Existing questions remain available.'); return; }
    if (save([...questions, { id: crypto.randomUUID(), operationId: operation.id, text, resolved: false, createdAt: new Date().toISOString() }])) setDraft('');
  };
  if (!operation) return null;
  const linked = questions.filter(question => question.operationId === operation.id);
  const unresolved = questions.filter(question => !question.resolved);
  return <div className="fr-evidence-support">
    {change && <section aria-label="Recorded verification" className="fr-evidence-verification">
      <h3>Verification trail</h3>
      {replay ? <p>Full-recording verification is available in live history; replay keeps later evidence hidden.</p> : loading ? <p role="status">Reading recorded checks…</p> : trail ? <>
        <p className={`fr-evidence-verdict verdict-${trail.verdict}`}>{trail.verdict === 'no-check-recorded' ? 'No later test run captured' : trail.verdict === 'changed-after-last-check' ? 'Files changed after the last recorded check' : 'Test results were recorded after this change'}</p>
        <p className="fr-evidence-qualification">Recorded order, not proof of coverage.</p>
        {trail.checks.map(check => <button type="button" key={check.operationId} onClick={() => onOperation(check.operationId)} className="fr-evidence-link"><span className={`fr-evidence-outcome status-${check.status}`}>{check.status === 'ok' ? '✓' : check.status === 'error' ? '!' : '?'}</span><span><strong>{check.title}</strong><small>{check.detail ?? `Recorded ${check.status}`}{check.namesChangedFile ? ' · names a changed file' : ''}</small></span><span aria-hidden="true">↗</span></button>)}
        {trail.totalChecks > trail.checks.length && <p>{trail.checks.length} earliest checks shown of {trail.totalChecks}. The last check is available below.</p>}
        {trail.lastCheck && !trail.checks.some(check => check.operationId === trail.lastCheck!.operationId) && <button className="fr-evidence-link" onClick={() => onOperation(trail.lastCheck!.operationId)}>Last recorded check: {trail.lastCheck.title} ↗</button>}
        {!!trail.laterChanges.length && <details><summary>Later changes to these files · {trail.laterChanges.length}</summary>{trail.laterChanges.map(item => <button className="fr-evidence-link" key={item.operationId} onClick={() => onOperation(item.operationId)}>{item.title}<span aria-hidden="true">↗</span></button>)}</details>}
      </> : <button className="fr-evidence-retry" onClick={() => setReload(n => n + 1)}>Retry verification</button>}
    </section>}
    <section aria-label="Local review questions" className="fr-evidence-questions">
      <h3>Your review</h3><p>Questions anchored to this captured action. Stored only in this browser.</p>
      {linked.map(question => <div className={`fr-evidence-question ${question.resolved ? 'is-resolved' : ''}`} key={question.id}><p>{question.text}</p><button onClick={() => save(questions.map(q => q.id === question.id ? { ...q, resolved: !q.resolved } : q))}>{question.resolved ? 'Reopen' : 'Mark resolved'}</button></div>)}
      <form onSubmit={event => { event.preventDefault(); submit(); }}><label htmlFor="fresh-review-question">Ask a question about this action</label><textarea id="fresh-review-question" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="What would you want to verify here?" /><button disabled={!draft.trim()} type="submit">Save question <span aria-hidden="true">↗</span></button></form>
      {unresolved.some(question => question.operationId !== operation.id) && <details><summary>Open questions elsewhere · {unresolved.filter(q => q.operationId !== operation.id).length}</summary>{unresolved.filter(q => q.operationId !== operation.id).map(question => <button className="fr-evidence-link" key={question.id} onClick={() => onOperation(question.operationId)}>{question.text}<span aria-hidden="true">↗</span></button>)}</details>}
    </section>
    {error && <p role="alert" className="fr-evidence-error">{error}</p>}
  </div>;
}
