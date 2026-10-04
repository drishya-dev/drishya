import { useEffect, useState, type ReactNode } from 'react';
import type { Artifact, ArtifactSlice, Hunk, Provenance } from '@drishya/contracts';
import { Highlighted, langOf } from '../lib/highlight.tsx';
import { useApp } from '../state.ts';

// ─── artifacts: fetched lazily, cached by bytes ───────────────────────────────────────────

const cache = new Map<string, Promise<ArtifactSlice>>();
let cachedBytes = 0;
const MAX_CACHE = 48 * 1024 * 1024;

export interface ArtifactView {
  text?: string;
  error?: string;
  /** Why there is no content to show: never captured, or no longer stored. Never "empty". */
  unavailable?: string;
  /** Set when only part of the captured content is shown, e.g. "lines 1–20,000 of 54,321". */
  partial?: string;
}

/** What a slice means to a reader: content, an honest unavailable reason, and any cut. */
export function viewOf(s: ArtifactSlice): ArtifactView {
  if (!s.available) return { unavailable: s.reason === 'no-longer-stored' ? 'Captured, but no longer stored (deleted or past retention).' : 'Not captured by the harness.' };
  const end = s.start + s.returnedLines;
  const partial = s.hasMore || s.truncated ? `Showing lines ${(s.start + 1).toLocaleString()}–${end.toLocaleString()} of ${s.totalLines.toLocaleString()}${s.truncated ? ' (cut at the response size limit)' : ''}` : undefined;
  return { text: s.text, partial };
}

export function useArtifact(artifactId: string | undefined): ArtifactView {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const [state, setState] = useState<ArtifactView>({});
  useEffect(() => {
    if (!artifactId || !source || !recordingId) return;
    const key = `${recordingId}/${artifactId}`;
    let p = cache.get(key);
    if (!p) {
      if (cachedBytes > MAX_CACHE) {
        cache.clear();
        cachedBytes = 0;
      }
      p = source.artifact(recordingId, artifactId).then(
        (s) => {
          cachedBytes += s.text.length;
          return s;
        },
        (e) => {
          cache.delete(key); // a failure is not cached: opening it again retries
          throw e;
        },
      );
      cache.set(key, p);
    }
    let live = true;
    p.then((s) => live && setState(viewOf(s))).catch((e) => live && setState({ error: String(e.message ?? e) }));
    return () => {
      live = false;
    };
  }, [artifactId, source, recordingId]);
  return artifactId ? state : {};
}

// ─── code ────────────────────────────────────────────────────────────────────────────────

export function CodeView({ text, startLine = 1, path, maxLines, highlightLines }: { text: string; startLine?: number; path?: string; maxLines?: number; highlightLines?: Set<number> }) {
  const lang = langOf(path);
  const all = text.replace(/\n$/, '').split('\n');
  const lines = maxLines ? all.slice(0, maxLines) : all;
  return (
    <div className="code" role="region" aria-label={path ? `Content of ${path}` : 'Code'}>
      {lines.map((l, i) => (
        <div key={i} className={`ln${highlightLines?.has(startLine + i) ? ' ln-hi' : ''}`}>
          <span className="ln-no">{startLine + i}</span>
          <span className="ln-tx">
            <Highlighted line={l} lang={lang} />
          </span>
        </div>
      ))}
      {maxLines && all.length > maxLines && <div className="ln-more">{all.length - maxLines} more lines</div>}
    </div>
  );
}

export function DiffView({ hunks, path, maxLines }: { hunks: Hunk[]; path?: string; maxLines?: number }) {
  const lang = langOf(path);
  let shown = 0;
  const hidden = hunks.reduce((s, h) => s + h.lines.length, 0) - (maxLines ?? Infinity);
  return (
    <div className="code diff" role="region" aria-label={path ? `Changes to ${path}` : 'Changes'}>
      {hunks.map((h, hi) => {
        let o = h.oldStart;
        let n = h.newStart;
        return (
          <div key={hi} className="hunk">
            {h.oldStart > 0 && <div className="hunk-head">@@ −{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@</div>}
            {h.lines.map((l, i) => {
              if (maxLines && shown >= maxLines) return null;
              shown++;
              const t = l[0];
              const cls = t === '+' ? 'add' : t === '-' ? 'del' : 'ctx';
              const oldNo = t === '+' ? '' : h.oldStart ? o++ : '';
              const newNo = t === '-' ? '' : h.newStart ? n++ : '';
              return (
                <div key={i} className={`ln ${cls}`}>
                  <span className="ln-no">{oldNo}</span>
                  <span className="ln-no">{newNo}</span>
                  <span className="ln-sign">{t === ' ' ? '' : t === '-' ? '−' : t}</span>
                  <span className="ln-tx">
                    <Highlighted line={l.slice(1)} lang={lang} />
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      {maxLines && hidden > 0 && <div className="ln-more">{hidden} more lines</div>}
    </div>
  );
}

export function Output({ text, maxLines }: { text: string; maxLines?: number }) {
  const all = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\n$/, '').split('\n');
  const lines = maxLines ? all.slice(-maxLines) : all;
  return (
    <pre className="output">
      {maxLines && all.length > maxLines && <span className="ln-more">…{all.length - maxLines} earlier lines{'\n'}</span>}
      {lines.map((l, i) => (
        <span key={i} className={/\b(FAIL|Error|failed|×|✗)\b/.test(l) ? 'out-bad' : /\b(PASS|passed|✓)\b/.test(l) ? 'out-good' : undefined}>
          {l}
          {'\n'}
        </span>
      ))}
    </pre>
  );
}

// ─── provenance ──────────────────────────────────────────────────────────────────────────

export function ProvenanceBadge({ p, artifact }: { p?: Provenance; artifact?: Artifact }) {
  const prov = artifact?.provenance ?? p;
  if (!prov) return null;
  const label = prov.kind === 'captured' ? 'Captured' : prov.kind === 'derived' ? 'Derived' : 'Generated';
  const title =
    prov.kind === 'captured'
      ? 'The harness recorded these exact bytes (after redaction).'
      : prov.kind === 'derived'
        ? `Computed by Drishya from captured evidence — rule ${prov.rule}.`
        : `Written by a model (${prov.generator}). Not something the agent said.`;
  return (
    <span className={`prov prov-${prov.kind}`} title={title}>
      {label}
      {prov.kind === 'derived' && <span className="prov-rule"> · {prov.rule}</span>}
      {artifact?.redacted && <span className="prov-rule"> · redacted</span>}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function timeOf(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function relTime(iso?: string) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
