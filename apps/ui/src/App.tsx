import { useEffect } from 'react';
import { dwellFor } from '@drishya/scene';
import { bundleSource, daemon, loadBundle, signIn } from './api.ts';
import { ProductShell } from './components/ProductShell.tsx';
import { Home } from './components/Home.tsx';
import { Viewer } from './components/Viewer.tsx';
import { needsReload } from './lib/sync.ts';
import { setMotion, useApp } from './state.ts';

const DEMO_URL = `${import.meta.env.BASE_URL}demo/bundle.json`;

/** Deep links: #/r/<id>, ?at=<step|end>, ?motion=0, ?bundle=<url>, ?demo. */
function params() {
  const q = new URLSearchParams(location.search);
  const at = q.get('at');
  return {
    at: at === 'end' ? ('end' as const) : at ? Number(at) : undefined,
    bundle: q.get('bundle') ?? (q.has('demo') ? DEMO_URL : undefined),
    motion: q.get('motion'),
    recording: /^#\/r\/(.+)$/.exec(location.hash)?.[1],
  };
}

async function openBundle(url: string) {
  const at = params().at;
  const bundle = await loadBundle(url);
  const source = bundleSource(bundle);
  useApp.setState({ source, config: await source.config() });
  await useApp.getState().openRecording(bundle.recording.id, at === undefined ? undefined : { at });
}

export function App() {
  const screen = useApp((s) => s.screen);
  const error = useApp((s) => s.error);

  // Boot: a replay bundle if asked for; otherwise the local daemon; otherwise the demo.
  useEffect(() => {
    const p = params();
    if (p.motion === '0') setMotion(false);
    (async () => {
      try {
        if (p.bundle) return await openBundle(p.bundle);
        const auth = await signIn();
        if (auth === 'ok') {
          useApp.setState({ source: daemon, config: await daemon.config(), screen: 'home', recordings: await daemon.recordings() });
          if (p.recording) await useApp.getState().openRecording(decodeURIComponent(p.recording), p.at === undefined ? undefined : { at: p.at });
          return;
        }
        if (auth === 'signed-out') return useApp.setState({ screen: 'signed-out' });
        // No daemon: this is the static hosted demo.
        await openBundle(DEMO_URL).catch(() => useApp.setState({ screen: 'no-daemon' }));
      } catch (e) {
        useApp.setState({ screen: 'error', error: (e as Error).message });
      }
    })();
  }, []);

  // A launch link pasted into an open tab only changes the fragment; sign in again. A
  // recording link opens that recording.
  useEffect(() => {
    const onHash = () => {
      if (/token=/.test(location.hash)) return location.reload();
      const id = params().recording;
      const s = useApp.getState();
      if (id && decodeURIComponent(id) !== s.recordingId && s.source?.kind === 'daemon') void s.openRecording(decodeURIComponent(id));
      if (!id && s.source?.kind === 'daemon' && s.screen === 'viewer') s.set({ screen: 'home', playing: false });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  usePlayback();
  useKeyboard();
  useLiveUpdates();

  const render = () => {
    if (screen === 'loading') return <div className="center muted">Starting…</div>;
    if (screen === 'signed-out')
      return (
        <div className="center notice">
          <h2>Open Drishya from its launch link</h2>
          <p className="muted">This page needs the launch link printed by <code>drishya serve</code>. It keeps other websites from reading your sessions.</p>
        </div>
      );
    if (screen === 'no-daemon')
      return (
        <div className="center notice">
          <h2>Drishya is not running</h2>
          <p className="muted">
            Start it with <code>pnpm serve</code> (or <code>drishya serve</code>) and open the link it prints.
          </p>
          <button className="btn" onClick={() => openBundle(DEMO_URL).catch((e) => useApp.setState({ screen: 'error', error: e.message }))}>
            Open the demo instead
          </button>
        </div>
      );
    if (screen === 'error') return (
      <div className="center notice">
        <h2>Could not open this workspace</h2>
        <p className="bad" role="alert">{error}</p>
        <p className="muted">Your captured recordings remain in the local store.</p>
        <div className="recovery-actions">
          <button className="btn primary" onClick={() => location.reload()}>Retry connection</button>
          <button className="btn" onClick={() => location.assign(location.pathname)}>Open local workspace</button>
          <button className="btn" onClick={() => openBundle(DEMO_URL).catch((e) => useApp.setState({ error: e.message }))}>Open synthetic demo</button>
        </div>
      </div>
    );
    if (screen === 'home') return <Home openDemo={() => openBundle(DEMO_URL).catch((e) => useApp.setState({ screen: 'error', error: e.message }))} />;
    return <Viewer />;
  };
  return <ProductShell>{render()}</ProductShell>;
}

/** The playback clock. The composer never reads time; only this hook does. */
function usePlayback() {
  const playing = useApp((s) => s.playing);
  const step = useApp((s) => s.step);
  const speed = useApp((s) => s.speed);
  const projection = useApp((s) => s.projection);
  const historyPage = useApp((s) => s.historyPage);
  useEffect(() => {
    if (!playing || !projection) return;
    if (historyPage && historyPage.scene.step !== step) return;
    if (step >= (historyPage?.scene.total ?? projection.timeline.length)) {
      const live = useApp.getState().recording?.live;
      if (!live) useApp.setState({ playing: false });
      return;
    }
    // Hold the step currently on screen. Looking ahead charged a long explanation's reading
    // time to the *previous* frame, then advanced past the explanation almost immediately.
    const ms = historyPage ? historyPage.dwell / speed : dwellFor(projection, step, speed);
    const t = setTimeout(() => useApp.getState().seek(step + 1), ms);
    return () => clearTimeout(t);
  }, [playing, step, speed, projection, historyPage]);
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      const t = e.target as HTMLElement;
      if (s.screen !== 'viewer') return;
      const k = e.key;
      if (k === 'Escape') {
        if (s.settingsOpen) s.set({ settingsOpen: false });
        else if (s.searchOpen) s.set({ searchOpen: false });
        else if (s.filePanel) s.set({ filePanel: undefined });
        else if (s.expandedOp) s.set({ expandedOp: undefined });
        else if (s.selectedOp) s.select(undefined);
        else if (s.briefingOpen) s.set({ briefingOpen: false });
        else if (s.explore) s.set({ explore: false });
        else if (s.filter) s.setFilter(undefined);
        return;
      }
      if (t.closest('input, textarea, select, button, a, [role="slider"], [role="dialog"], .op-expanded') || t.isContentEditable) return;
      if (s.mode === 'history' && [' ', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'e', 'E', 'f', 'F'].includes(k)) return;
      if (k === ' ') {
        e.preventDefault();
        s.togglePlay();
      } else if (k === 'ArrowRight') s.stepBy(1);
      else if (k === 'ArrowLeft') s.stepBy(-1);
      else if (k === 'e' || k === 'E') s.jump('edit', e.shiftKey ? -1 : 1);
      else if (k === 'f' || k === 'F') s.jump('fail', e.shiftKey ? -1 : 1);
      else if ((k === 'x' || k === 'X') && s.mapVisible) s.set({ explore: !s.explore });
      else if (k === 'm' || k === 'M') setMotion(!s.motion);
      else if (k === '/') {
        e.preventDefault();
        s.set({ searchOpen: true });
      } else if (k === 'Home') s.seek(0, { hold: true });
      else if (k === 'End') s.seek(s.historyPage?.scene.total ?? s.projection?.timeline.length ?? 0, { hold: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Live: the daemon announces committed observations; the viewer refetches the projection. */
function useLiveUpdates() {
  const source = useApp((s) => s.source);
  useEffect(() => {
    if (!source) return;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = source.subscribe((e) => {
      const s = useApp.getState();
      if (!s.recordingId?.split('+').includes(e.recordingId)) return;
      if (e.health && !e.added) {
        // A capture-state change carries no new data: refresh the summary, not the projection.
        void s.source?.recordings().then((recordings) => {
          const current = useApp.getState();
          if (current.source !== s.source) return;
          const openId = current.recordingId?.split('+')[0];
          useApp.setState({ recordings, recording: recordings.find((r) => r.id === openId) ?? current.recording });
        }).catch(() => undefined);
        return;
      }
      clearTimeout(pending);
      pending = setTimeout(() => void useApp.getState().reloadProjection().catch((error) => useApp.setState({ error: error.message, playing: false })), 150);
    }, {
      onStatus: (connection) => connection === 'signed-out'
        ? useApp.setState({ screen: 'signed-out', source: undefined, playing: false })
        : useApp.setState({ connection }),
      // After a reconnect, notices sent while the stream was down are lost: compare revisions and
      // reload the open view if it fell behind, even if nothing new arrives later (audit A07).
      onSync: (revisions) => {
        const s = useApp.getState();
        if (s.recordingId && s.projection && needsReload(s.recordingId, s.renderedRevisions, revisions)) void s.reloadProjection().catch((error) => useApp.setState({ error: error.message, playing: false }));
      },
    });
    return () => {
      clearTimeout(pending);
      unsubscribe();
    };
  }, [source]);
}
