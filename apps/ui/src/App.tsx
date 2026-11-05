import {LibrarySearch} from './components/LibrarySearch.tsx';
import { useEffect } from 'react';
import { dwellFor } from '@drishya/scene';
import { bundleSource, daemon, loadBundle, signIn } from './api.ts';
import { ProductShell } from './components/ProductShell.tsx';
import { Home } from './components/Home.tsx';
import { Viewer } from './components/Viewer.tsx';
import { liveRefresh, needsReload } from './lib/sync.ts';
import { growingSample } from './lib/sample-source.ts';
import { setMotion, useApp } from './state.ts';
import { localPreviewId } from './lib/local-preview.ts';
import { WorkspaceNavigation } from './components/WorkspaceNavigation.tsx';
import { restoreWorkingLocations, useWorkingRecovery } from './lib/working-recovery.ts';
import { workspaceMemory } from './lib/workspace-memory.ts';

const DEMO_URL = `${import.meta.env.BASE_URL}demo/bundle.json`;

/** Deep links: #/r/<id>, ?at=<step|end>, ?motion=0, ?bundle=<url>, ?demo. */
function params() {
  const q = new URLSearchParams(location.search);
  const at = q.get('at');
  return {
    at: at === 'end' ? ('end' as const) : at ? Number(at) : undefined,
    bundle: q.get('bundle') ?? (q.has('demo') && q.get('demo') !== 'local' ? DEMO_URL : undefined),
    motion: q.get('motion'),
    recording: /^#\/r\/(.+)$/.exec(location.hash)?.[1],
  };
}

async function openBundle(url: string, growing = false) {
  const at = params().at;
  const bundle = await loadBundle(url);
  const source = growing && url === DEMO_URL ? growingSample(bundle) : bundleSource(bundle);
  if (url === DEMO_URL && !growing) source.sample = 'recorded';
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
        if (p.bundle) return await openBundle(p.bundle, new URLSearchParams(location.search).get('demo') === 'live');
        const auth = await signIn();
        if (auth === 'ok') {
          const recordings = await daemon.recordings();
          const saved=await restoreWorkingLocations().catch(()=>undefined);
          if(saved)workspaceMemory(daemon).restore(saved);
          useApp.setState({ source: daemon, config: await daemon.config(), screen: 'home', recordings, resumeRecordingId:saved?.last&&recordings.some(r=>r.id===saved.last)?saved.last:undefined,recoveryState:saved?'saved':'unavailable' });
          const preview = new URLSearchParams(location.search).get('demo') === 'local' ? localPreviewId() : undefined;
          const id = p.recording ? decodeURIComponent(p.recording) : recordings.some(r => r.id === preview) ? preview : undefined;
          if (id) await useApp.getState().openRecording(id, p.at === undefined ? undefined : { at: p.at });
          return;
        }
        if (auth === 'signed-out') return useApp.setState({ screen: 'signed-out' });
        if (new URLSearchParams(location.search).get('demo') === 'local') return useApp.setState({ screen: 'no-daemon' });
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
      if (id && s.source?.kind === 'daemon') {
        // Home keeps the loaded recording. Browser Back must still restore its viewer.
        if (decodeURIComponent(id) !== s.recordingId || !s.projection) void s.openRecording(decodeURIComponent(id));
        else if (s.screen !== 'viewer') s.set({ screen: 'viewer' });
      }
      if (!id && s.source?.kind === 'daemon' && s.screen === 'viewer') s.set({ screen: 'home', playing: false });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  usePlayback();
  useWorkingRecovery();
  useKeyboard();
  useLiveUpdates();

  const render = () => {
    if (screen === 'loading') return <div className="center muted">Starting…</div>;
    if (screen === 'signed-out')
      return (
        <div className="center notice">
          <h2>Open Drishya from its launch link</h2>
          <p className="muted">This page needs the launch link printed by <code>drishya serve</code>. It keeps other websites from reading your sessions.</p><button className="btn" onClick={() => location.assign(`${location.pathname}?demo`)}>Open sample workspace</button>
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
        <p className="muted">Your sessions remain in the local store.</p>
        <div className="recovery-actions">
          <button className="btn primary" onClick={() => location.reload()}>Retry connection</button>
          <button className="btn" onClick={() => location.assign(location.pathname)}>Open local workspace</button>
          <button className="btn" onClick={() => openBundle(DEMO_URL).catch((e) => useApp.setState({ error: e.message }))}>Open synthetic demo</button>
        </div>
      </div>
    );
    if (screen === 'home') return <Home openDemo={(growing = false) => openBundle(DEMO_URL, growing).catch((e) => useApp.setState({ screen: 'error', error: e.message }))} />;
    return <Viewer />;
  };
  return <ProductShell>{render()}<LibrarySearch/><ConnectionNotice /><WorkspaceNavigation /></ProductShell>;
}

function ConnectionNotice() {
  const connection = useApp(s => s.connection), source = useApp(s => s.source), screen = useApp(s => s.screen);
  if (source?.kind !== 'daemon' || !['home', 'viewer'].includes(screen) || connection === 'connected') return null;
  return <aside className="connection-recovery" role="status" aria-label="Local server connection">
    <strong>{connection === 'signed-out' ? 'Server sign-in required' : 'Disconnected · reading cached evidence'}</strong>
    <span>{connection === 'signed-out' ? 'Open the new launch link printed by the server in this browser. Your current reading is kept here.' : 'New work may be missing. This does not mean the agent stopped or that its journal is being watched.'}</span>
    <button className="btn small" onClick={() => useApp.setState(s => ({ connection: 'reconnecting', reconnectAttempt: s.reconnectAttempt + 1 }))}>Retry connection</button>
  </aside>;
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
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      // Native dialogs own their keyboard/escape behavior. Closing one must not
      // also clear the captured reader or map underneath it.
      if (t.closest('dialog[open]') || document.querySelector('dialog[open]:not(.map-reader)')) return;
      const k = e.key;
      if (k === 'Escape') {
        if (s.settingsOpen) s.set({ settingsOpen: false });
        else if (s.searchOpen) s.set({ searchOpen: false });
        else if (s.developerWorkspace) s.set({ developerWorkspace: false });
        else if (s.filePanel) s.set({ filePanel: undefined });
        else if (s.expandedOp) s.set({ expandedOp: undefined });
        else if (s.selectedOp) s.select(undefined);
        else if (s.briefingOpen) s.set({ briefingOpen: false });
        else if (s.explore) s.set({ explore: false });
        else if (s.filter) s.setFilter(undefined);
        return;
      }
      if (s.developerWorkspace) return;
      if (t.closest('input, textarea, select, button, a, summary, [role="slider"], [role="dialog"], .op-expanded') || t.isContentEditable) return;
      if (!document.querySelector('.t-controls') && [' ', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'e', 'E', 'f', 'F'].includes(k)) return;
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
  const attempt = useApp(s => s.reconnectAttempt);
  useEffect(() => {
    if (!source) return;
    let active = true;
    const current = () => active && useApp.getState().source === source;
    const offline = () => { if (current() && source.kind === 'daemon') useApp.setState({ connection: 'reconnecting' }); };
    const online = () => { if (current() && source.kind === 'daemon') useApp.setState(s => ({ reconnectAttempt: s.reconnectAttempt + 1 })); };
    window.addEventListener('offline', offline); window.addEventListener('online', online);
    if (!navigator.onLine) offline();
    let refreshingId: string | undefined;
    const refresh = liveRefresh(async () => {
      refreshingId = useApp.getState().recordingId;
      if (current()) await useApp.getState().reloadProjection();
    }, error => { if (current() && useApp.getState().recordingId === refreshingId) useApp.setState({ error: (error as Error).message, playing: false }); });
    const checkFreshness=async()=>{
      if(!current()||source.kind!=='daemon'||document.visibilityState==='hidden')return;
      try {
        const recordings=await source.recordings();if(!current())return;
        const now=useApp.getState(),revisions=Object.fromEntries(recordings.map(r=>[r.id,r.revision??0]));
        useApp.setState({recordings,recording:recordings.find(r=>r.id===now.recordingId)??now.recording});
        if(now.recordingId&&now.projection&&needsReload(now.recordingId,now.renderedRevisions,revisions))refresh.schedule();
      } catch { /* The existing connection surface owns connectivity errors. */ }
    };
    window.addEventListener('focus',checkFreshness);document.addEventListener('visibilitychange',checkFreshness);
    const unsubscribe = source.subscribe((e) => {
      const s = useApp.getState();
      if (!current()) return;
      if (s.recordingId !== e.recordingId && !s.recordingId?.split('+').includes(e.recordingId)) return;
      if (e.health && !e.added) {
        // A capture-state change carries no new data: refresh the summary, not the projection.
        void s.source?.recordings().then((recordings) => {
          const current = useApp.getState();
          if (!active || current.source !== s.source) return;
          const openId = current.recordingId?.split('+')[0];
          useApp.setState({ recordings, recording: recordings.find((r) => r.id === current.recordingId) ?? recordings.find((r) => r.id === openId) ?? current.recording });
        }).catch(() => undefined);
        return;
      }
      refresh.schedule();
    }, {
      onStatus: (connection) => { if (current()) useApp.setState({ connection: connection === 'connected' && !navigator.onLine ? 'reconnecting' : connection, ...(connection === 'signed-out' ? { playing: false } : {}) }); },
      // After a reconnect, notices sent while the stream was down are lost: compare revisions and
      // reload the open view if it fell behind, even if nothing new arrives later (audit A07).
      onSync: (revisions) => {
        if (!current()) return;
        const s = useApp.getState();
        void source.recordings().then(recordings => {
          if (!current()) return;
          const now = useApp.getState();
          useApp.setState({ recordings, recording: recordings.find(r => r.id === now.recordingId) ?? now.recording });
        }).catch(error => { if (current()) useApp.setState({ error: error.message }); });
        if (s.recordingId && s.projection && needsReload(s.recordingId, s.renderedRevisions, revisions)) refresh.schedule();
      },
    });
    return () => {
      active = false;
      window.removeEventListener('offline', offline); window.removeEventListener('online', online);
      refresh.close();
      window.removeEventListener('focus',checkFreshness);document.removeEventListener('visibilitychange',checkFreshness);
      unsubscribe();
    };
  }, [source, attempt]);
}
