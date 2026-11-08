import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { useSurfaceReflow } from '../lib/use-surface-reflow.ts';
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
  const prepareCollapse = useSurfaceReflow(surface, collapsed, id);

  function cancelRecentering() {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    recentering.current?.cancel();
    recentering.current = undefined;
  }

  useLayoutEffect(() => {
    const stage = rail.current?.closest<HTMLElement>('.connected-workspace');
    if (!stage) return;
    stage.toggleAttribute('data-toolbox-minimized', collapsed);
    return () => stage.removeAttribute('data-toolbox-minimized');
  }, [collapsed]);

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

  const { controller } = useSessionWorkspace();
  const filter = useApp(s => s.filter);
  const setFilter = useApp(s => s.setFilter);
  return <div ref={rail} className="toolbox-rail">
    <div
      ref={surface}
      className={'workbench-station modern-tool-station' + (collapsed ? ' toolbox-minimized' : '')}
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
