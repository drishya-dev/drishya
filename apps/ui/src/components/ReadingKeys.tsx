import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Projection } from '@drishya/contracts';
import { readingTarget, type ReadingQuery, type ReadingTarget } from '../../../../packages/scene/src/reading-target.ts';
import { useApp } from '../state.ts';
import './reading-keys.css';

export const READING_SHORTCUTS = [
  ['j / k', 'Next / previous operation'], ['n / p', 'Next / previous edit'], ['f', 'Next failure'],
  ['t / T', 'Next / previous turn'], ['g / G', 'First / last operation'], ['e', 'Expand / collapse focused operation'],
  ['o', 'Open its file in peek'], ['y', 'Copy selected text or the focused material'],
  ['c / C', 'Fold other finished turns / unfold all'], ['?', 'Show this guide'],
] as const;
const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),.cm-editor,[role=textbox]');

/** Keyboard reading is immediate. It moves one real material, without opening the inspector. */
/** Selected text first, then the card's own copy control, then what the card shows. */
export function copyCardMaterial(node: Element | null | undefined, notify: (message: string) => void) {
  const selection = document.getSelection();
  if (node && selection?.toString() && selection.anchorNode && selection.focusNode && node.contains(selection.anchorNode) && node.contains(selection.focusNode)) {
    void navigator.clipboard.writeText(selection.toString()).then(() => notify('Copied selected text'), () => notify('Copy unavailable; select the text to copy')); return;
  }
  const copy = [...(node?.querySelectorAll<HTMLButtonElement>('button[aria-label^="Copy"]') ?? [])].find(button => !button.disabled && button.getClientRects().length);
  if (copy) { copy.click(); return; }
  const preview = node?.querySelector<HTMLElement>('.op-expanded, .op-body')?.innerText;
  if (!preview) { notify('No material to copy'); return; }
  void navigator.clipboard.writeText(preview).then(() => notify('Copied card preview'), () => notify('Copy unavailable; select the text to copy'));
}
export function ReadingKeys(props: {
  root: RefObject<HTMLDivElement | null>; projection: Projection; focused?: string;
  focus: (id?: string) => void; navigate: (target: ReadingTarget) => Promise<void>; fold: (collapse: boolean) => void;
}) {
  const id = useApp(s => s.recordingId), source = useApp(s => s.source);
  const [notice, setNotice] = useState('');
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    let alive = true, epoch = 0, queued = 0;
    let cursor: ReadingTarget | undefined, chain = Promise.resolve();
    const card = (key?: string) => [...(latest.current.root.current?.querySelectorAll<HTMLElement>('article[data-op-id]') ?? [])].find(node => node.dataset.opId === key);
    const valid = () => alive && useApp.getState().recordingId === id && useApp.getState().source === source;
    const readingValid = () => valid() && useApp.getState().screen === 'viewer' && useApp.getState().mode === 'history' && !useApp.getState().developerWorkspace && !useApp.getState().explore;
    const openHelp = () => { epoch++; window.dispatchEvent(new Event('drishya-reading-help')); };
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
    // A pending reading request must yield to deliberate interaction, including
    // a button focused before its response or two-frame navigation completes.
    const focusInput = (event: FocusEvent) => { if (typing(event.target) || event.target instanceof Element && event.target.closest('button,a,summary,[role=slider],[role=menu]')) epoch++; };
    const key = (event: KeyboardEvent) => {
      const state = useApp.getState();
      if (!valid() || document.documentElement.dataset.uiVersion !== 'modern' || state.screen !== 'viewer' || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      if (document.querySelector('dialog[open], [popover]:popover-open') || state.developerWorkspace || state.explore || state.searchOpen || state.settingsOpen) return;
      if (event.target instanceof Element && event.target.closest('button,a,summary,[role=slider],[role=menu]')) return;
      const k = event.key;
      if (k === '?') { document.documentElement.removeAttribute('data-ui-press'); event.preventDefault(); event.stopImmediatePropagation(); openHelp(); return; }
      // Replay retains its explicit transport shortcuts; reading keys never seek its clock.
      if (state.mode !== 'history' || !['j','k','n','p','f','t','T','g','G','e','o','y','c','C','Escape'].includes(k)) return;
      if (k === 'Escape' && !latest.current.focused && !queued) return;
      event.preventDefault(); event.stopImmediatePropagation();
      document.documentElement.removeAttribute('data-ui-press');
      if (k === 'Escape') { epoch++; cursor = undefined; latest.current.focus(undefined); focusMaterial(); latest.current.root.current?.focus({ preventScroll: true }); return; }
      if (k === 'c' || k === 'C') { epoch++; state.set({ follow: false }); latest.current.fold(k === 'c'); setNotice(k === 'c' ? 'Other finished turns folded' : 'Turns unfolded'); return; }
      if (['e','o','y'].includes(k)) {
        epoch++;
        const focused = latest.current.focused ?? (event.target instanceof Element ? event.target.closest<HTMLElement>('article[data-op-id]')?.dataset.opId : undefined);
        if (!focused) { setNotice('Focus an operation with j or k first'); return; }
        const node = card(focused), op = state.projection?.operations.find(item => item.id === focused);
        if (k === 'e') { state.set({ expandedOp: state.expandedOp === focused ? undefined : focused, follow: false }); return; }
        if (k === 'o') {
          const path = op?.paths.find(ref => ref.role !== 'search-hit')?.path ?? op?.paths[0]?.path;
          if (!path) { setNotice('No file path for this operation'); return; }
          state.set({ follow: false }); window.dispatchEvent(new CustomEvent('drishya-preview-file', { detail: { path } })); return;
        }
        copyCardMaterial(node, setNotice); return;
      }
      if (queued >= 20 || event.repeat && queued > 1) return;
      const requestEpoch = epoch; queued++;
      chain = chain.then(async () => {
        try {
          if (!readingValid() || requestEpoch !== epoch || document.querySelector('dialog[open]')) return;
          const current = useApp.getState(), root = latest.current.root.current;
          const bounds = root?.getBoundingClientRect();
          const visible = [...(root?.querySelectorAll<HTMLElement>('article[data-op-id]') ?? [])].find(node => { const r = node.getBoundingClientRect(); return bounds && r.bottom > bounds.top + 100 && r.top < bounds.bottom; });
          const from = cursor ? cursor.id : latest.current.focused ?? visible?.dataset.opId;
          const query: ReadingQuery = {
            kind: k === 'n' || k === 'p' ? 'edit' : k === 'f' ? 'failure' : k === 't' || k === 'T' ? 'turn' : 'operation',
            direction: ['k','p','T'].includes(k) ? -1 : 1, from,
            at: cursor?.step, turnFrom: cursor?.turnKey, edge: k === 'g' ? 'first' : k === 'G' ? 'last' : undefined,
            agent: current.filter?.agentId, tool: current.filter?.tool, server: current.filter?.server, operationKind: current.filter?.kind,
          };
          current.set({ follow: false });
          const target = source?.readingTarget && id ? await source.readingTarget(id, query) : readingTarget(latest.current.projection, query);
          if (!readingValid() || requestEpoch !== epoch || document.querySelector('dialog[open]')) return;
          if (!target) { setNotice('No further matching work'); return; }
          cursor = target;
          if (target.type === 'operation') useApp.setState({ trailAt: target.id });
          await latest.current.navigate(target);
          if (!readingValid() || requestEpoch !== epoch || document.querySelector('dialog[open]')) return;
          focusMaterial(target.id);
          setNotice(target.type === 'turn' ? 'Turn prompt' : card(target.id)?.getAttribute('aria-label') ?? 'Operation');
        } catch (error) { if (valid()) setNotice(`Reading navigation failed: ${(error as Error).message}`); }
        finally { queued--; }
      });
    };
    // TOOLS-1: the tool trail asks the reader to move to one use of the chosen tool.
    const goTo = (event: Event) => {
      const target = (event as CustomEvent<ReadingTarget | undefined>).detail;
      if (!target || target.type !== 'operation' || !target.id || !readingValid()) return;
      epoch++;
      chain = chain.then(async () => {
        try {
          if (!readingValid()) return;
          useApp.getState().set({ follow: false });
          cursor = target;
          useApp.setState({ trailAt: target.id });
          await latest.current.navigate(target);
          if (!readingValid()) return;
          focusMaterial(target.id);
          setNotice(card(target.id)?.getAttribute('aria-label') ?? 'Operation');
        } catch (error) { if (valid()) setNotice(`Reading navigation failed: ${(error as Error).message}`); }
      });
    };
    window.addEventListener('drishya-reading-navigate', goTo);
    window.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('focusin', focusInput);
    return () => { alive = false; epoch++; focusMaterial(); window.removeEventListener('drishya-reading-navigate', goTo); window.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', pointer, true); document.removeEventListener('focusin', focusInput); };
  }, [id, source]);
  return <span className="reading-key-notice" role="status" aria-live="polite">{notice}</span>;
}
