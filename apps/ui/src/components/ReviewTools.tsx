import { useEffect, useRef, useState } from 'react';
import { workspaceApi } from '../api.ts';
import { useApp } from '../state.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { ArtifactReader } from './ArtifactReader.tsx';
import { reviewRules, type CommandContext, type CommandRow, type ReviewFinding, type ReviewIndex, type ReviewPage, type ReviewQuery, type ReviewRule, type RepeatSignal, type TurnSummary } from '../../../../packages/scene/src/review-tools.ts';
import './review-tools.css';
const sections: {
    id: keyof ReviewIndex;
    name: string;
}[] = [{ id: 'commands', name: 'Commands' }, { id: 'findings', name: 'Findings' }, { id: 'repeats', name: 'Repetitions' }, { id: 'turns', name: 'Prompt summaries' }];
/** Occasional worker-backed reading tools. No polling, source persistence or runner. */
export function ReviewTools() {
    const id = useApp(s => s.recordingId), source = useApp(s => s.source), mode = useApp(s => s.mode), revision = useApp(s => id ? s.renderedRevisions[id] : undefined);
    const [open, setOpen] = useState(false), [section, setSection] = useState<keyof ReviewIndex>('commands'), [query, setQuery] = useState<ReviewQuery>({ section: 'commands' });
    const [page, setPage] = useState<ReviewPage>(), [error, setError] = useState(''), [retry, setRetry] = useState(0), [rules, setRules] = useState<ReviewRule[]>([]);
    const [selected, setSelected] = useState<string[]>([]), [detail, setDetail] = useState<(CommandContext & {
        operationId: string;
        outputArtifactId?: string;
        outputPreview?: string;
    })>(), [busy, setBusy] = useState(false);
    const [script, setScript] = useState<{
        text: string;
        warnings: string[];
    }>(), [copied, setCopied] = useState('');
    const request = useRef(0), fileInput = useRef<HTMLInputElement>(null);
    const eligible = source?.kind === 'daemon' && !!id && !id.includes('+') && mode === 'history';
    useEffect(() => { setOpen(false); setPage(undefined); setSelected([]); setDetail(undefined); setScript(undefined); request.current++; }, [id, source, mode]);
    useEffect(() => { const show = (event: Event) => { if (!eligible)
        return; const target = (event as CustomEvent).detail; const next = sections.some(s => s.id === target) ? target : 'commands'; setSection(next); setQuery({ section: next }); setOpen(true); setDetail(undefined); setScript(undefined); }; window.addEventListener('drishya-review-tools', show); return () => window.removeEventListener('drishya-review-tools', show); }, [eligible]);
    useEffect(() => {
        if (!open || !eligible)
            return;
        let active = true;
        setPage(undefined);
        setError('');
        const timer = setTimeout(() => { void workspaceApi.reviewTools(id!, { ...query, section, rules }).then(value => { if (active) {
            if ((query.start ?? 0) >= value.total && value.total) {
                setQuery(q => ({ ...q, start: Math.floor((value.total - 1) / 20) * 20 }));
                return;
            }
            setPage(value);
        } }).catch(e => { if (active)
            setError(e.message); }); }, query.q ? 160 : 0);
        return () => { active = false; clearTimeout(timer); };
    }, [open, eligible, id, section, query, rules, revision, retry]);
    const leave = () => { setOpen(false); request.current++; setBusy(false); };
    const choose = (operationId: string) => { useApp.getState().set({ follow: false, held: true, developerWorkspace: false }); useApp.getState().select(operationId); leave(); };
    const command = async (operationId: string) => { const n = ++request.current; setBusy(true); setError(''); try {
        const result = await workspaceApi.reviewCommand(id!, operationId);
        if (n === request.current) {
            setDetail(result);
            setScript(undefined);
        }
    }
    catch (e) {
        if (n === request.current)
            setError((e as Error).message);
    }
    finally {
        if (n === request.current)
            setBusy(false);
    } };
    const prepareCopy = async () => { const n = ++request.current; setBusy(true); setError(''); try {
        const result = await workspaceApi.reviewScript(id!, selected);
        if (n === request.current) {
            setScript(result);
            setDetail(undefined);
            setCopied('');
        }
    }
    catch (e) {
        if (n === request.current)
            setError((e as Error).message);
    }
    finally {
        if (n === request.current)
            setBusy(false);
    } };
    const loadRules = async (file: File) => { setError(''); try {
        if (file.size > 8192)
            throw new Error('Local rule JSON limit is8 KiB.');
        const validated = reviewRules(JSON.parse(await file.text()));
        setRules(validated);
        setQuery(q => ({ ...q, start: 0 }));
    }
    catch (e) {
        setError((e as Error).message);
    } };
    if (!eligible)
        return null;
    return <><button className="btn ghost" data-review-tools onClick={() => setOpen(true)}>Review tools</button>{open && <ReadingDialog title="Recorded review tools" close={leave} className="review-tools">
    <p className="review-tools-scope">Whole recording · derived indexes of captured, redacted evidence. No safety verdict, quality score or inferred test coverage.</p>
    <nav className="review-tools-tabs" aria-label="Review tool">{sections.map(item => <button key={item.id} className="btn ghost" aria-pressed={section === item.id} onClick={() => { setSection(item.id); setQuery({ section: item.id }); setDetail(undefined); setScript(undefined); setCopied(''); request.current++; setBusy(false); }}>{item.name}</button>)}</nav>
    {error && <p role="alert">{error} <button className="btn ghost" onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
    {script ? <section className="review-script" aria-label="Selected commands for copying"><button className="btn ghost" onClick={() => setScript(undefined)}>Back to commands</button><h3>Review before copying</h3><ul>{script.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul><textarea readOnly aria-label="Complete selected script" value={script.text}/><button className="btn" onClick={() => void navigator.clipboard.writeText(script.text).then(() => setCopied('Copied selected commands')).catch(() => setError('Clipboard unavailable. Select the complete text to copy.'))}>Copy reviewed commands</button><span role="status">{copied}</span></section>
                : detail ? <section className="review-command-detail" aria-label="Captured command detail"><div className="review-tools-actions"><button className="btn ghost" onClick={() => setDetail(undefined)}>Back to commands</button><button className="btn" onClick={() => choose(detail.operationId)}>Open action in history</button></div><p>{detail.complete ? 'Complete captured command' : 'Command preview · incomplete, redacted or beyond the256 KiB reading limit'}</p><pre>{detail.text}</pre><p>Directory: {detail.cwd ?? 'Unknown'} · {detail.cwdBasis}{detail.durationMs !== undefined ? ` · ${detail.durationMs}ms (${detail.durationBasis})` : ' · duration unknown'}</p>{detail.outputArtifactId ? <ArtifactReader id={detail.outputArtifactId} kind="output" provenance navigationSlot="command-review"/> : detail.outputPreview !== undefined ? <><p>Captured output</p><pre>{detail.outputPreview}</pre></> : <p>Output not captured.</p>}</section>
                    : <>
      {section === 'commands' && <><div className="review-tool-filters"><label>Command text or directory<input type="search" maxLength={200} value={query.q ?? ''} onChange={e => setQuery(q => ({ ...q, q: e.target.value, start: 0 }))}/></label><label>Outcome<select aria-label="Outcome" value={query.status ?? ''} onChange={e => setQuery(q => ({ ...q, status: e.target.value as ReviewQuery['status'] || undefined, start: 0 }))}><option value="">All outcomes</option><option value="failed">Failed</option><option value="passed">Passed · captured exit0</option><option value="unknown">Unknown</option></select></label><label>Kind<select aria-label="Kind" value={query.kind ?? ''} onChange={e => setQuery(q => ({ ...q, kind: e.target.value as ReviewQuery['kind'] || undefined, start: 0 }))}><option value="">Shell and test</option><option value="shell">Shell</option><option value="test">Test</option></select></label><label>Exact agent ID<input maxLength={200} value={query.agent ?? ''} onChange={e => setQuery(q => ({ ...q, agent: e.target.value || undefined, start: 0 }))}/></label></div><div className="review-tools-actions"><span>{selected.length} selected · maximum32</span><button className="btn ghost" disabled={!selected.length || busy} onClick={() => void prepareCopy()}>Review selected script</button><button className="btn ghost" disabled={!selected.length} onClick={() => setSelected([])}>Clear selection</button></div></>}
      {section === 'findings' && <div className="review-tools-actions"><span>Built-in rules plus {rules.length} local rules · first match per rule / target</span><input hidden type="file" accept=".json,application/json" ref={fileInput} onChange={e => { const file = e.target.files?.[0]; if (file)
                        void loadRules(file); e.currentTarget.value = ''; }}/><button className="btn ghost" onClick={() => fileInput.current?.click()}>Load local rule JSON</button>{!!rules.length && <button className="btn ghost" onClick={() => setRules([])}>Use built-in rules only</button>}</div>}
      {section === 'turns' && <><label className="review-tools-sort">Sort summaries<select value={query.sort ?? 'recorded'} onChange={e => setQuery(q => ({ ...q, sort: e.target.value as ReviewQuery['sort'], start: 0 }))}><option value="recorded">Recorded prompt order</option><option value="failures">Most failed operations</option></select></label><p className="muted">Assigned by each agent’s latest captured prompt at call start. Late results remain with that call; helpers without their own prompt stay unassigned. Intervals are between captured prompts, not execution durations.</p></>}
      {!page && !error ? <p role="status">Reading the recorded index…</p> : page && <><p className="review-tools-count">{page.total.toLocaleString()} {query.repeatId ? 'occurrences' : sections.find(s => s.id === section)?.name.toLowerCase()} · {page.allCount.toLocaleString()} in this recording · {page.version}</p>
        <div className="review-tools-results" aria-label={`${section} results`}>
          {page.occurrences ? <><button className="btn ghost" onClick={() => setQuery({ section: 'repeats' })}>Back to repetitions</button>{page.occurrences.map(row => <button className="review-tool-item" key={row.operationId} onClick={() => choose(row.operationId)}>{row.title}<small>Open exact captured action</small></button>)}</> :
                                section === 'commands' ? (page.items as CommandRow[]).map(row => <article className="review-tool-item command-ledger-row" key={row.id}><input type="checkbox" aria-label={`Select command ${row.id}`} checked={selected.includes(row.id)} disabled={!row.complete || !selected.includes(row.id) && selected.length >= 32} onChange={e => setSelected(ids => e.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))}/><button disabled={busy} onClick={() => void command(row.id)}><code>{row.preview}</code><small>{row.status}{row.exitCode !== undefined ? ` · exit${row.exitCode}` : ' · exit unknown'} · {row.kind} · {row.agentId}</small><small>{row.cwd ?? 'Directory unknown'} · {row.cwdBasis}{row.durationMs !== undefined ? ` · ${row.durationMs}ms (${row.durationBasis})` : ''} · {row.findings} findings{!row.complete ? ' · copying unavailable' : ''}</small></button></article>) :
                                    section === 'findings' ? (page.items as ReviewFinding[]).map(row => <article className="review-tool-item" key={row.id}><button onClick={() => choose(row.operationId)}><strong>Matched {row.rule}</strong><small>{row.target} · {row.version} · {row.observationIds.join(', ')}</small></button><pre>{row.text.slice(0, row.start)}<mark>{row.text.slice(row.start, row.end)}</mark>{row.text.slice(row.end)}</pre><p>{row.note}</p></article>) :
                                        section === 'repeats' ? (page.items as RepeatSignal[]).map(row => <button className="review-tool-item" key={row.id} onClick={() => setQuery({ section: 'repeats', repeatId: row.id })}><strong>{row.label}</strong><small>Open {row.count} occurrences · counts, not a diagnosis or elapsed inactivity</small></button>) :
                                            (page.items as TurnSummary[]).map(row => <article className="review-tool-item" key={row.id}><button disabled={row.promptStep === undefined} onClick={() => { useApp.getState().set({ follow: false, held: true, promptStep: row.promptStep, developerWorkspace: false }); void useApp.getState().loadHistoryWindow({ promptStep: row.promptStep }); leave(); }}><strong>{row.prompt}</strong><small>{row.agentId || 'No assignable prompt'} · captured prompt excerpt</small></button><p>{row.operations} operations · {row.files} files with write inputs · {row.tests} test runs · {row.failures} failed operations · {row.findings} findings · {row.repeats} repetition signals</p><small>{Object.entries(row.kinds).map(([kind, count]) => `${kind}: ${count}`).join(' · ')}{row.intervalMs !== undefined ? ` · ${row.intervalMs}ms between captured prompts` : ' · interval unknown'}</small>{row.lastFailure && <button className="btn ghost" onClick={() => choose(row.lastFailure!)}>Open last failure</button>}</article>)}
          {!page.total && <p>{section === 'findings' ? 'No rule matched in the captured, redacted evidence. Redaction, missing content and unsupported syntax may hide matches.' : 'None recorded in this scope.'}</p>}
        </div>
        <nav className="reader-pages" aria-label="Review tool pages"><button className="btn ghost" disabled={!page.start} onClick={() => setQuery(q => ({ ...q, start: Math.max(0, (q.start ?? 0) - 20) }))}>Previous results</button><span>{page.total ? `${page.start + 1}–${Math.min(page.total, page.start + 20)} of ${page.total}` : '0 results'} ·20 per page</span><button className="btn ghost" disabled={page.start + 20 >= page.total} onClick={() => setQuery(q => ({ ...q, start: (q.start ?? 0) + 20 }))}>Next results</button></nav>
      </>}
    </>}
  </ReadingDialog>}</>;
}
