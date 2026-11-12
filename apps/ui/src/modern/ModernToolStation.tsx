import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { useCallback, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { useSurfaceReflow } from '../lib/use-surface-reflow.ts';
import { scrollEdgeCue } from '../lib/scroll-edge-cue.ts';
import { useWorkspaceState } from '../lib/workspace-memory-react.ts';
import { ModernTools } from './ModernTools';
import { useApp } from '../state';
import { focusAgent, focusKind, focusMcp } from '../lib/compound-focus';
import { useSessionWorkspace } from '../components/SessionWorkspace';
import './toolbox-dock.css';

export function ModernToolStation({ projection, scene, agents }: {
  projection: Projection; scene: Scene; agents: ReactNode;
}) {
  const [collapsed, setCollapsed] = useWorkspaceState('toolbox/collapsed', false);
  const surface = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const frame = useRef<number | undefined>(undefined);
  const recentering = useRef<Animation | undefined>(undefined);
  const id = useApp(s => s.recordingId);
  const motion = useApp(s => s.motion);
  const lowResource = useApp(s => s.lowResource);

  // Center the Toolbox on the viewport's Y axis according to its rendered height,
  // clamped cleanly inside the safe rail clearances above bottom controls and below the header.
  const syncCenter = useCallback(() => {
    const node = surface.current, bounds = rail.current;
    if (!node || !bounds) return;
    const railRect = bounds.getBoundingClientRect();
    const boxHeight = node.offsetHeight;
    if (!railRect.height || !boxHeight) return;
    const free = Math.max(0, railRect.height - boxHeight);
    const ideal = innerHeight / 2 - boxHeight / 2 - railRect.top;
    const next = `${Math.round(Math.max(0, Math.min(free, ideal)) * 2) / 2}px`;
    if (node.style.getPropertyValue('--toolbox-center-top') !== next) {
      node.style.setProperty('--toolbox-center-top', next);
    }
  }, []);

  useLayoutEffect(() => {
    syncCenter();
  });

  const prepareCollapse = useSurfaceReflow(surface, collapsed, id);
  const { controller } = useSessionWorkspace();
  const filter = useApp(s => s.filter);
  const setFilter = useApp(s => s.setFilter);

  function cancelRecentering() {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    recentering.current?.cancel();
    recentering.current = undefined;
  }

  const syncScrollCue = useCallback(() => {
    const node = surface.current;
    if (!node || collapsed) {
      node?.removeAttribute('data-scroll-top');
      node?.removeAttribute('data-scroll-bottom');
      return;
    }
    const cue = scrollEdgeCue({ scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight });
    if (cue.top) node.setAttribute('data-scroll-top', '1');
    else node.removeAttribute('data-scroll-top');
    if (cue.bottom) node.setAttribute('data-scroll-bottom', '1');
    else node.removeAttribute('data-scroll-bottom');
  }, [collapsed]);

  useLayoutEffect(() => {
    const stage = rail.current?.closest<HTMLElement>('.connected-workspace');
    if (!stage) return;
    stage.toggleAttribute('data-toolbox-minimized', collapsed);
    return () => stage.removeAttribute('data-toolbox-minimized');
  }, [collapsed]);

  useLayoutEffect(() => {
    const node = surface.current, bounds = rail.current;
    if (!node) return;
    const panel = node.querySelector('.modern-toolbox');
    const stage = bounds?.closest('.connected-workspace');
    const sync = () => { syncCenter(); syncScrollCue(); };
    const observer = new ResizeObserver(sync);
    const onToggle = () => { sync(); requestAnimationFrame(sync); };
    observer.observe(node);
    if (bounds) observer.observe(bounds);
    if (panel) observer.observe(panel);
    node.addEventListener('toggle', onToggle, true);
    window.addEventListener('resize', sync);
    const classes = stage ? new MutationObserver(sync) : undefined;
    classes?.observe(stage!, { attributes: true, attributeFilter: ['class'] });
    sync();
    return () => {
      observer.disconnect();
      classes?.disconnect();
      window.removeEventListener('resize', sync);
      node.removeEventListener('toggle', onToggle, true);
    };
  }, [syncCenter, syncScrollCue, projection, scene, filter]);

  useLayoutEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new ResizeObserver(cancelRecentering);
    if (rail.current) observer.observe(rail.current);
    preference.addEventListener('change', cancelRecentering);
    document.addEventListener('visibilitychange', cancelRecentering);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', cancelRecentering);
      document.removeEventListener('visibilitychange', cancelRecentering);
      cancelRecentering();
    };
  }, [id, motion, lowResource]);

  function prepareDisclosure(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;
    const summary = target?.closest('summary');
    const details = summary?.parentElement;
    const node = surface.current;
    if (!(details instanceof HTMLDetailsElement) || !node || !summary) return;
    if (target?.closest('button, a, input, select, textarea')) return;
    if (event.detail === 0 || !motion || lowResource || document.hidden ||
        matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancelRecentering();
      return;
    }

    const before = node.getBoundingClientRect().top;
    const wasOpen = details.open;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (!node.isConnected || !details.isConnected || details.open === wasOpen || !node.checkVisibility()) return;
      recentering.current?.cancel();
      syncCenter();
      const bounds = rail.current?.getBoundingClientRect();
      if (!bounds) return;
      const after = node.getBoundingClientRect();
      // Keep the translated dock inside the rail even when the open group fills it.
      const offset = Math.max(bounds.top - after.top, Math.min(bounds.bottom - after.bottom, before - after.top));
      if (Math.abs(offset) < 0.5) return;
      const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() || 'cubic-bezier(.16, 1, .3, 1)';
      recentering.current = node.animate(
        [{ transform: 'translateY(' + offset + 'px)' }, { transform: 'none' }],
        { duration: 180, easing },
      );
    });
  }

  return <div ref={rail} className="toolbox-rail">
    <div
      ref={surface}
      className={'workbench-station modern-tool-station' + (collapsed ? ' toolbox-minimized' : '')}
      onScroll={syncScrollCue}
      onClickCapture={prepareDisclosure}
      onKeyDownCapture={event => {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') cancelRecentering();
      }}
    >
      <button className="toolbox-collapse" aria-label={collapsed ? 'Expand toolbox' : 'Minimize toolbox'}
        aria-expanded={!collapsed} onClick={() => {
          cancelRecentering();
          prepareCollapse();
          setCollapsed(!collapsed);
        }}>
        {collapsed ? <span data-surface-label="">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M8 7V4h8v3M3 7h18v13H3ZM3 12h18M10 10v4h4v-4" />
          </svg>
          {filter && <span className="toolbox-filter-dot" title="Focus filter active">•</span>}
        </span> : '−'}
      </button>
      <ModernTools page={{ projection, scene }} native={controller} filter={filter} agents={agents}
        onClear={() => setFilter(undefined)} onFilter={next => {
          if (next.agentId) setFilter(focusAgent(filter, next.agentId));
          else if (next.server) setFilter(focusMcp(filter, next.server, next.tool));
          else if (next.kind) setFilter(focusKind(filter, next.kind));
        }} />
    </div>
  </div>;
}
