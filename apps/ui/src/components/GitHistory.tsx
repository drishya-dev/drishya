import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../state.ts';
import { useReadingWorkspace } from './SessionWorkspace.tsx';
import { useWorkspaceState } from '../lib/workspace-memory-react.ts';
import { gitHistoryStore } from '../lib/git-history-cache.ts';
import { workspaceApi } from '../api.ts';
import { GitAccess, grantGit } from './GitAccess.tsx';
import { ReadingDialog } from './ProductShell.tsx';
import { ReadingResize } from './ReadingResize.tsx';
import './git-history.css';
import './git-history-typography.css';

const GitHistoryReader = lazy(() => import('./GitHistoryReader.tsx').then(m => ({ default: m.GitHistoryReader })));

export const openGitHistory = () => window.dispatchEvent(new Event('drishya-git-history'));

const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])';
let atlasModalRoots = 0;

export function GitHistory() {
  const checkoutId = useApp(s => s.checkoutId);
  const [open, setOpen] = useState(false), id = useApp(s => s.recordingId), source = useApp(s => s.source), mode = useApp(s => s.mode), changesOpen = useApp(s => s.compareOpen);
  useEffect(() => {
    const show = () => {
      const state = useApp.getState();
      if (state.source?.kind !== 'daemon' || !state.recordingId || state.recordingId.includes('+') || state.mode !== 'history') return;
      const next: Partial<typeof state> = {};
      if (state.developerWorkspace) next.developerWorkspace = false;
      if (state.compareOpen) next.compareOpen = false;
      if (state.currentFile !== undefined) next.currentFile = undefined;
      if (state.filePanel !== undefined) next.filePanel = undefined;
      if (state.selectedOp !== undefined) next.selectedOp = undefined;
      if (state.follow) next.follow = false;
      if (!state.held) next.held = true;
      if (Object.keys(next).length) state.set(next);
      setOpen(true);
    };
    window.addEventListener('drishya-git-history', show);
    return () => window.removeEventListener('drishya-git-history', show);
  }, []);
  useEffect(() => setOpen(false), [id, source, mode]);
  // Changes and Git graph are two windows over the same place; opening one puts the other away.
  useEffect(() => { if (changesOpen) setOpen(false); }, [changesOpen]);
  return open && id ? (
    <GitHistoryDialog
      key={`${id}:${checkoutId ?? 'main'}`}
      id={id}
      close={() => {
        setOpen(false);
        requestAnimationFrame(() =>
          document.querySelector<HTMLButtonElement>('button.git-open[aria-label="Git"]')?.focus({ preventScroll: true })
        );
      }}
    />
  ) : null;
}

function GitHistoryDialog({ id, close }: { id: string; close: () => void }) {
  const source = useApp(s => s.source), checkoutId = useApp(s => s.checkoutId);
  const targetId = checkoutId ?? id;
  const { workspace, approve } = useReadingWorkspace();
  const [width, setWidth] = useWorkspaceState('git/historyWidth', 1180);
  const cacheScope = source ?? 'default', cacheKey = `${id}:${checkoutId ?? 'main'}`;
  const snapshot = gitHistoryStore.get(cacheScope, cacheKey);
  const [approved, setApproved] = useState<boolean | undefined>(() => snapshot?.approved ? true : undefined);
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState('');
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (approved !== undefined) return;
    let active = true;
    void workspaceApi.gitStatus(targetId).then(status => {
      if (active) setApproved(status.approved);
    }).catch(err => {
      if (active) setError(err.message);
    });
    return () => { active = false; };
  }, [targetId, approved]);

  const consent = async () => {
    setGranting(true);
    setError('');
    try {
      await grantGit(targetId, !!workspace?.approved, approve);
      setApproved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGranting(false);
    }
  };

  useEffect(() => {
    const dialog = anchorRef.current?.closest('dialog');
    if (!dialog) return;
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;
    const root = document.getElementById('root');
    if (++atlasModalRoots === 1 && root) {
      root.setAttribute('aria-hidden', 'true');
      root.inert = true;
    }
    let active = true;
    queueMicrotask(() => {
      if (active && dialog.isConnected && !dialog.contains(document.activeElement))
        (dialog.querySelector<HTMLElement>('[data-dialog-focus]') ?? dialog).focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); dialog.focus({ preventScroll: true }); return; }
      const first = items[0]!, last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus({ preventScroll: true });
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (dialog.open && !dialog.inert && event.target instanceof Node && !dialog.contains(event.target)
        && !document.querySelector('dialog:modal')) {
        dialog.focus({ preventScroll: true });
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', keepFocus);
    return () => {
      active = false;
      dialog.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', keepFocus);
      dialog.removeAttribute('aria-modal');
      dialog.removeAttribute('tabindex');
      if (--atlasModalRoots === 0 && root) {
        root.removeAttribute('aria-hidden');
        root.inert = false;
      }
    };
  }, []);

  const needsGrant = approved === false || (approved === true && !workspace?.approved);

  return (
    <>
      {createPortal(<div className="atlas-scrim" aria-hidden="true" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); }} />, document.body)}
      <ReadingDialog
        title="Git graph"
        windowId="Git history"
        modeless
        floating
        resetWindow={() => setWidth(1180)}
        close={close}
        className="git-atlas"
        style={{ width: `min(${width}px,calc(100vw - 28px))` }}
        resizeControl={<ReadingResize value={width} minimum={700} maximum={1800} change={setWidth} reset={() => setWidth(1180)} label="Resize Git graph reading space" fromRight />}
      >
        <span ref={anchorRef} hidden />
        {error && <p className="atlas-error" role="alert">{error}<button className="btn ghost" onClick={() => { setError(''); setApproved(undefined); }}>Retry history</button></p>}
        {needsGrant ? (
          workspace?.root ? (
            <GitAccess workspaceApproved={!!workspace.approved} busy={granting} disabled={granting} grant={() => void consent()} />
          ) : (
            <section className="atlas-access"><p>This session did not record a workspace, so there is no repository to read.</p></section>
          )
        ) : (
          <Suspense fallback={<p className="atlas-empty" role="status">Reading local history…</p>}>
            <GitHistoryReader id={id} close={close} />
          </Suspense>
        )}
      </ReadingDialog>
    </>
  );
}
