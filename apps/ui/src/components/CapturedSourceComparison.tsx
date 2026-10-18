import { useEffect, useState } from 'react';
import { workspaceApi } from '../api.ts';
import { useApp } from '../state.ts';
import type { FileEvidence } from '../lib/file-evidence.ts';
import { useSessionWorkspace } from './SessionWorkspace.tsx';
import { SourceComparison } from './SourceComparison.tsx';
/** Compare exact captured bytes to a separately consented current sample. */
export function CapturedSourceComparison({ evidence, path }: {
    evidence: FileEvidence;
    path: string;
}) {
    const source = useApp(s => s.source), id = useApp(s => s.recordingId), mode = useApp(s => s.mode);
    const { workspace } = useSessionWorkspace();
    const [comparison, setComparison] = useState<{
        before: string;
        after: string;
        label: string;
        modifiedAt: string;
    }>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => { setComparison(undefined); setError(''); }, [id, evidence.key]);
    if (source?.kind !== 'daemon' || !id || mode !== 'history' || evidence.patch || !evidence.artifactId)
        return null;
    const compare = async () => {
        setBusy(true);
        setError('');
        const expectedSource = source, expectedId = id, artifactId = evidence.artifactId!;
        try {
            const captured = await source.artifact(id, artifactId, { start: 0, count: 5000 });
            if (!captured.available || captured.hasMore || captured.truncated || captured.totalBytes > 256 * 1024)
                throw new Error('This comparison requires complete stored artifact bytes up to256KiB. Continue reading its available pages.');
            const disk = await workspaceApi.document(id, path);
            let text = disk.text, label = 'Captured whole-file snapshot';
            if(captured.artifact.kind==='snapshot'&&captured.artifact.availability!=='complete')throw new Error('This snapshot is partial. Read its captured bytes without treating it as a whole file.');
            if (captured.artifact.kind !== 'snapshot') {
                const first = captured.artifact.range?.start ?? evidence.startLine;
                if (first === undefined || first < 1)
                    throw new Error('Captured excerpt has no exact file-line range; comparing it with a whole file would be misleading.');
                text = disk.text.split('\n').slice(first - 1, first - 1 + captured.returnedLines).join('\n');
                label = `Captured range ${first}–${first + captured.returnedLines - 1}`;
            }
            if (new TextEncoder().encode(text).length > 256 * 1024)
                throw new Error('Current comparison range exceeds256KiB. Read current source separately.');
            if (useApp.getState().source !== expectedSource || useApp.getState().recordingId !== expectedId)
                return;
            setComparison({ before: captured.text, after: text, label, modifiedAt: disk.modifiedAt });
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    };
    return <section className="captured-source-comparison"><button className="btn ghost" disabled={busy || !workspace?.approved} title={!workspace?.approved ? 'Enable workspace reading before comparing current disk' : ''} onClick={() => void compare()}>{busy ? 'Reading comparison…' : 'Compare captured source with disk'}</button>{!workspace?.approved && <small>Current disk needs workspace reading consent.</small>}{error && <p role="alert">{error}</p>}{comparison && <><p>Current sample: {comparison.modifiedAt}. Excerpts compare the same line positions; moved code is not mapped automatically.</p><button className="btn ghost" onClick={() => setComparison(undefined)}>Close captured/disk comparison</button><SourceComparison before={comparison.before} after={comparison.after} path={path} labels={{ before: comparison.label, after: 'Current disk sample · matching line positions' }} navigationKey={`captured-disk/${evidence.key}/${comparison.modifiedAt}`}/></>}</section>;
}
