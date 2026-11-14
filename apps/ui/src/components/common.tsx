import { HistoryArtifacts } from '../lib/history-artifacts.ts';
import {outputPathNodes} from './CapturedPath.tsx';
import { memo, useContext, useEffect, useMemo, useState, type ReactNode, type Ref } from 'react';
import type { Artifact, ArtifactSlice, Hunk, Provenance } from '@drishya/contracts';
import { Highlighted, langOf } from '../lib/highlight.tsx';
import { materialCache, type MaterialScope } from '../lib/artifact-cache.ts';
import { isTableShaped } from '../lib/tool-output.ts';
import { useApp } from '../state.ts';
import type { DataSource } from '../api.ts';

// ─── artifacts: fetched lazily, cached by bytes ───────────────────────────────────────────

const sources = new WeakMap<DataSource, number>();
let nextSource = 0;
function sourceId(source: DataSource): number {
  let id = sources.get(source);
  if (!id) { id = ++nextSource; sources.set(source, id); }
  return id;
}

export interface ArtifactView {
  artifact?: Artifact;
  text?: string;
  error?: string;
  /** Why there is no content to show: never captured, or no longer stored. Never "empty". */
  unavailable?: string;
  /** Set when only part of the captured content is shown, e.g. "lines 1–20,000 of 54,321". */
  partial?: string;
  start?: number;
  nextStart?: number;
  hasMore?: boolean;
  totalLines?: number;
}

/** What a slice means to a reader: content, an honest unavailable reason, and any cut. */
export function viewOf(s: ArtifactSlice): ArtifactView {
  if (!s.available) return { artifact: s.artifact, unavailable: s.reason === 'no-longer-stored' ? 'No longer stored (deleted or past retention).' : 'Not recorded by the harness.' };
  const end = s.start + s.returnedLines;
  const partial = s.hasMore || s.truncated ? `Showing lines ${(s.start + 1).toLocaleString()}–${end.toLocaleString()} of ${s.totalLines.toLocaleString()}${s.truncated ? ' (cut at the response size limit)' : ''}` : undefined;
  return { artifact: s.artifact, text: s.text, partial, start: s.start, nextStart: end, hasMore: s.hasMore, totalLines: s.totalLines };
}

export function useArtifact(artifactId: string | undefined, opts: { scope?: MaterialScope; start?: number; count?: number; retry?: number } = {}): ArtifactView {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const history = useContext(HistoryArtifacts);
  const historicalDescriptor = artifactId ? history?.get(artifactId) : undefined;
  const currentDescriptor = useApp(s => !artifactId || historicalDescriptor ? undefined : s.projection?.artifacts.find(a => a.id === artifactId));
  const descriptor = historicalDescriptor ?? currentDescriptor;
  // Immutable blobs are keyed by descriptor bytes below. Subscribing them to
  // every global revision bypassed deferred history with synchronous renders.
  const revision = useApp(s => !artifactId || descriptor?.blob ? undefined : recordingId?.split('+').map(id => s.renderedRevisions[id] ?? 0).join(':'));
  const scope = opts.scope ?? 'reader';
  const start = opts.start ?? 0;
  const count = opts.count ?? (scope === 'preview' ? 12 : 200);
  // Stored blobs are immutable. Unrelated journal appends must not replace a reader
  // with a skeleton and destroy selection/focus. Metadata changes still invalidate;
  // unavailable or unlisted artifacts stay revision-keyed so late content can arrive.
  // observedAtSequence counts steps from the start of the history shown (PERF-4: the recent-first page counts from its own start), so it says nothing about the material.
  const materialVersion = descriptor?.blob ? JSON.stringify({ ...descriptor, observedAtSequence: undefined }) : revision;
  const key = artifactId && recordingId && source ? `${sourceId(source)}/${recordingId}/${materialVersion}/${artifactId}/${scope}/${start}/${count}` : undefined;
  const [state, setState] = useState<{ key: string; view: ArtifactView }>();
  useEffect(() => {
    if (!key || !artifactId || !source || !recordingId) return;
    const p = materialCache.get(key, scope, () => source.artifact(recordingId, artifactId, { start, count }));
    let live = true;
    p.then((s) => live && setState({ key, view: viewOf(s) })).catch((e) => live && setState({ key, view: { error: String(e.message ?? e) } }));
    return () => {
      live = false;
    };
  }, [key, artifactId, source, recordingId, scope, start, count, opts.retry]);
  return key === state?.key ? state?.view ?? {} : {};
}

// ─── code ────────────────────────────────────────────────────────────────────────────────

export function CodeView({ text, startLine = 1, path, maxLines, highlightLines, activeLine, scrollRef }: { text: string; startLine?: number; path?: string; maxLines?: number; highlightLines?: Set<number>; activeLine?: number; scrollRef?: Ref<HTMLDivElement> }) {
  const lang = langOf(path);
  const all = text.replace(/\n$/, '').split('\n');
  const lines = maxLines ? all.slice(0, maxLines) : all;
  return (
    <div ref={scrollRef} tabIndex={scrollRef ? 0 : undefined} className="code" role="region" aria-label={path ? `Content of ${path}` : 'Code'}>
      {lines.map((l, i) => (
        <div key={i} data-source-line={startLine + i} aria-current={activeLine === startLine + i ? 'location' : undefined} className={`ln${highlightLines?.has(startLine + i) ? ' ln-hi' : ''}${activeLine === startLine + i ? ' ln-current' : ''}`}>
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

export function DiffView({ hunks, path, maxLines, skipLines = 0, showRemaining = true, activeOffset }: { hunks: Hunk[]; path?: string; maxLines?: number; skipLines?: number; showRemaining?: boolean; activeOffset?: number }) {
  const lang = langOf(path);
  let lineIndex = 0;
  const total = hunks.reduce((s, h) => s + h.lines.length, 0);
  const end = skipLines + (maxLines ?? Infinity);
  return (
    <div className="code diff" role="region" aria-label={path ? `Changes to ${path}` : 'Changes'}>
      {hunks.map((h, hi) => {
        let o = h.oldStart;
        let n = h.newStart;
        const hunkStart = lineIndex;
        const hunkVisible = hunkStart < end && hunkStart + h.lines.length > skipLines;
        if (!hunkVisible) {
          lineIndex += h.lines.length;
          return null;
        }
        return (
          <div key={hi} className="hunk">
            {hunkVisible && (h.oldStart > 0 || h.newStart > 0) && <div className="hunk-head">@@ −{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@</div>}
            {h.lines.map((l, i) => {
              const t = l[0];
              const cls = t === '+' ? 'add' : t === '-' ? 'del' : 'ctx';
              const oldNo = t === '+' ? '' : h.oldStart ? o++ : '';
              const newNo = t === '-' ? '' : h.newStart ? n++ : '';
              const visible = lineIndex >= skipLines && lineIndex < end;
              lineIndex++;
              if (!visible) return null;
              return (
                <div key={i} className={`ln ${cls}${lineIndex - 1 === activeOffset ? ' patch-match' : ''}`}>
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
      {showRemaining && maxLines && total > end && <div className="ln-more">{total - end} more lines</div>}
    </div>
  );
}

// Memoised (LIVE-7): a live update re-renders the whole history, and without this every mounted
// output card rescanned each of its lines for file locations on every update (about 90 ms per update on a
// 1,700-observation Codex session). Props are the text and a line cap, so equal props are the same pixels.
export const Output = memo(function Output({ text, maxLines }: { text: string; maxLines?: number }) {
  const root=useApp(s=>s.recording?.workspaceRoot);
  const all = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\n$/, '').split('\n');
  const lines = maxLines ? all.slice(-maxLines) : all;
  const pathBudget={remaining:64,characters:131072};
  const table = useMemo(() => isTableShaped(text), [text]);
  return (
    <pre className={`output${table ? ' output-scroll' : ''}`} tabIndex={table ? 0 : undefined} role={table ? 'region' : undefined} aria-label={table ? 'Command output table' : undefined}>
      {maxLines && all.length > maxLines && <span className="ln-more">…{all.length - maxLines} earlier lines{'\n'}</span>}
      {lines.map((l, i) => (
        <span key={i} className={/\b(FAIL|Error|failed|×|✗)\b/.test(l) ? 'out-bad' : /\b(PASS|passed|✓)\b/.test(l) ? 'out-good' : undefined}>
          {outputPathNodes(l,root,pathBudget)}
          {'\n'}
        </span>
      ))}
    </pre>
  );
});

// ─── provenance ──────────────────────────────────────────────────────────────────────────

const DERIVED_RULE_MEANING: Record<string, string> = {
  'claude-desktop-update-plan-v1': 'Compared with the previous plan',
  'claude-task-result-v1': 'Tasks matched across tool updates',
  'claude-exit-plan-mode-v1': 'Plan proposal from the session',
  'claude-native-plan-file-v1': 'Plan file written by the agent',
  'codex-literal-plan-v1': 'Checklist captured from output',
  'codex-proposed-plan-v1': 'Proposed plan from output',
  'codex-literal-patch-v1': 'Patch extracted from script',
  'apply-hunks-verified-v1': 'Verified by applying patch',
  'apply-edit-verified-v1': 'Verified against earlier file content',
  'shell-read-output-v1': 'Read inferred from shell command',
  'shell-classify-v1': 'Command classified from shell call',
  'captured-structured-json-v1': 'Structured tool output',
};

export function ProvenanceBadge({ p, artifact }: { p?: Provenance; artifact?: Artifact }) {
  const prov = artifact?.provenance ?? p;
  if (!prov) return null;
  const label = prov.kind === 'captured' ? 'Captured' : prov.kind === 'derived' ? 'Derived' : 'Generated';
  const derivedMeaning = prov.kind === 'derived' ? (DERIVED_RULE_MEANING[prov.rule] ?? prov.rule) : undefined;
  const title =
    prov.kind === 'captured'
      ? 'The harness recorded these exact bytes (after redaction).'
      : prov.kind === 'derived'
        ? `Computed by Drishya from the session — rule ${prov.rule}.`
        : `Written by a model (${prov.generator}). Not something the agent said.`;
  return (
    <span className={`prov prov-${prov.kind}`} title={title}>
      {label}
      {derivedMeaning && <span className="prov-rule"> · {derivedMeaning}</span>}
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

/** Calendar labels belong to presentation, never the deterministic scene composer. */
export function calendarTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, now)) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

/** The exact captured time is disclosed in place, including keyboard focus. */
export function CapturedTime({ iso }: { iso: string }) {
  return <time className="captured-time" dateTime={iso} tabIndex={0} aria-label={new Date(iso).toLocaleString()}><span>{calendarTime(iso)}</span><span className="captured-clock"> · {timeOf(iso)}</span></time>;
}
