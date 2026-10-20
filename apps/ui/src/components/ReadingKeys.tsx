import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Projection } from '@drishya/contracts';
import { readingTarget, type ReadingQuery, type ReadingTarget } from '../../../../packages/scene/src/reading-target.ts';
import { useApp } from '../state.ts';
import { ReadingDialog } from './ProductShell.tsx';
import './reading-keys.css';

export const READING_SHORTCUTS = [
  ['j / k', 'Next / previous operation'], ['n / p', 'Next / previous edit'], ['f', 'Next failure'],
  ['t / T', 'Next / previous turn'], ['g / G', 'First / last operation'], ['e', 'Expand / collapse focused operation'],
  ['o', 'Open its file in peek'], ['y', 'Copy selected text or the focused material'],
  ['c / C', 'Fold other finished turns / unfold all'], ['?', 'Show this guide'],
] as const;
const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),.cm-editor,[role=textbox]');

/** Keyboard reading is immediate. It moves one real material, without opening the inspector. */
export function ReadingKeys(props: {
  root: RefObject<HTMLDivElement | null>; projection: Projection; focused?: string;
  focus: (id?: string) => void; navigate: (target: ReadingTarget) => Promise<void>; fold: (collapse: boolean) => void;
}) {
  const id = useApp(s => s.recordingId), source = useApp(s => s.source);
  const [help, setHelp] = useState(false), [notice, setNotice] = useState('');
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    let alive = true, epoch = 0, queued = 0;
    let cursor: ReadingTarget | undefined, chain = Promise.resolve();
    const card = (key?: string) => [...(latest.current.root.current?.querySelectorAll<HTMLElement>('article[data-op-id]') ?? [])].find(node => node.dataset.opId === key);
    const valid = () => alive && useApp.getState().recordingId === id && useApp.getState().source === source;
    const openHelp = () => { epoch++; setHelp(true); };
    const focusMaterial = (key?: string) => {
      const root = latest.current.root.current;
      root?.querySelectorAll('[data-reading-focus]').forEach(node => node.removeAttribute('data-reading-focus'));
      const node = card(key);
      if (node) { node.dataset.readingFocus = ''; node.focus({ preventScroll: true }); }
    };
    const pointer = (event: PointerEvent) => {
      epoch++;
      const node = event.target instanceof Element ? event.target.closest<HTMLElement>('article[data-op-id]') : null;
      if (node?.dataset.opId === latest.current.focused) return;
      cursor = undefined; latest.current.focus(undefined); focusMaterial();
    };
    const focusInput = (event: FocusEvent) => { if (typing(event.target)) epoch++; };
    const key = (event: KeyboardEvent) => {
      const state = useApp.getState();
      if (!valid() || document.documentElement.dataset.uiVersion !== 'modern' || state.screen !== 'viewer' || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      if (document.querySelector('dialog[open], [popover]:popover-open') || state.developerWorkspace || state.explore || state.searchOpen || state.settingsOpen) return;
      if (event.target instanceof Element && event.target.closest('button,a,summary,[role=slider],[role=menu]')) return;
      const k = event.key;
      if (k === '?') { event.preventDefault(); event.stopImmediatePropagation(); openHelp(); return; }
      // Replay retains its explicit transport shortcuts; reading keys never seek its clock.
      if (state.mode !== 'history' || !['j','k','n','p','f','t','T','g','G','e','o','y','c','C','Escape'].includes(k)) return;
      if (k === 'Escape' && !latest.current.focused) return;
      event.preventDefault(); event.stopImmediatePropagation();
      document.documentElement.removeAttribute('data-ui-press');
      if (k === 'Escape') { epoch++; cursor = undefined; latest.current.focus(undefined); focusMaterial(); latest.current.root.current?.focus({ preventScroll: true }); return; }
      if (k === 'c' || k === 'C') { epoch++; state.set({ follow: false }); latest.current.fold(k === 'c'); setNotice(k === 'c' ? 'Other finished turns folded' : 'Turns unfolded'); return; }
      if (['e','o','y'].includes(k)) {
        const focused = latest.current.focused ?? (event.target instanceof Element ? event.target.closest<HTMLElement>('article[data-op-id]')?.dataset.opId : undefined);
        if (!focused) { setNotice('Focus an operation with j or k first'); return; }
        const node = card(focused), op = state.projection?.operations.find(item => item.id === focused);
        if (k === 'e') { state.set({ expandedOp: state.expandedOp === focused ? undefined : focused, follow: false }); return; }
        if (k === 'o') {
          const path = op?.paths.find(ref => ref.role !== 'search-hit')?.path ?? op?.paths[0]?.path;
          if (!path) { setNotice('No captured file path for this operation'); return; }
          state.set({ follow: false }); window.dispatchEvent(new CustomEvent('drishya-preview-file', { detail: { path } })); return;
        }
        const selection = document.getSelection();
        if (node && selection?.toString() && selection.anchorNode && selection.focusNode && node.contains(selection.anchorNode) && node.contains(selection.focusNode)) {
          void navigator.clipboard.writeText(selection.toString()).then(() => setNotice('Copied selected text'), () => setNotice('Copy unavailable; select the text to copy')); return;
        }
        const copy = [...(node?.querySelectorAll<HTMLButtonElement>('button[aria-label^="Copy"]') ?? [])].find(button => !button.disabled && button.getClientRects().length);
        if (copy) { copy.click(); return; }
        const preview = node?.querySelector<HTMLElement>('.op-expanded, .op-body')?.innerText;
        if (!preview) { setNotice('No captured material to copy'); return; }
        void navigator.clipboard.writeText(preview).then(() => setNotice('Copied card preview'), () => setNotice('Copy unavailable; select the text to copy')); return;
      }
      if (queued >= 20 || event.repeat && queued > 1) return;
      const requestEpoch = epoch; queued++;
      chain = chain.then(async () => {
        try {
          if (!valid() || requestEpoch !== epoch) return;
          const current = useApp.getState(), root = latest.current.root.current;
          const bounds = root?.getBoundingClientRect();
          const visible = [...(root?.querySelectorAll<HTMLElement>('article[data-op-id]') ?? [])].find(node => { const r = node.getBoundingClientRect(); return bounds && r.bottom > bounds.top + 100 && r.top < bounds.bottom; });
          const from = cursor ? cursor.id : latest.current.focused ?? visible?.dataset.opId;
          const query: ReadingQuery = {
            kind: k === 'n' || k === 'p' ? 'edit' : k === 'f' ? 'failure' : k === 't' || k === 'T' ? 'turn' : 'operation',
            direction: ['k','p','T'].includes(k) ? -1 : 1, from,
            at: cursor?.step, edge: k === 'g' ? 'first' : k === 'G' ? 'last' : undefined,
            agent: current.filter?.agentId, tool: current.filter?.tool, server: current.filter?.server, operationKind: current.filter?.kind,
          };
          current.set({ follow: false });
          const target = source?.readingTarget && id ? await source.readingTarget(id, query) : readingTarget(latest.current.projection, query);
          if (!valid() || requestEpoch !== epoch) return;
          if (!target) { setNotice('No further matching captured work'); return; }
          cursor = target;
          await latest.current.navigate(target);
          if (!valid() || requestEpoch !== epoch) return;
          focusMaterial(target.id);
          setNotice(target.type === 'turn' ? 'Turn prompt' : card(target.id)?.getAttribute('aria-label') ?? 'Captured operation');
        } catch (error) { if (valid()) setNotice(`Reading navigation failed: ${(error as Error).message}`); }
        finally { queued--; }
      });
    };
    window.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('focusin', focusInput);
    window.addEventListener('drishya-reading-help', openHelp);
    return () => { alive = false; epoch++; focusMaterial(); window.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', pointer, true); document.removeEventListener('focusin', focusInput); window.removeEventListener('drishya-reading-help', openHelp); };
  }, [id, source]);
  return <><span className="reading-key-notice" role="status" aria-live="polite">{notice}</span>{help && <ReadingDialog title="Reading shortcuts" className="reading-shortcuts" close={() => setHelp(false)}><p>Navigate captured work without opening the inspector. Reading keys detach Follow; capture continues.</p><dl>{READING_SHORTCUTS.map(([keys, action]) => <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{action}</dd></div>)}</dl><p className="muted small">Disabled in inputs, editors, menus and readers. Replay keeps its transport controls. Copy uses a selection or the material’s existing copy action; otherwise it copies the card preview.</p></ReadingDialog>}</>;
}
