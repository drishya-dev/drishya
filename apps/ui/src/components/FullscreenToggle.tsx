import { useEffect, useState, useRef } from 'react';
import './fullscreen-toggle.css';

/**
 * EMBED-2b: Single quiet Enter full screen / Exit full screen control.
 * Calls the document Fullscreen API, observes fullscreenchange, and triggers
 * paired enter/exit transitions while preserving reading scroll anchor.
 */
export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  const [failed, setFailed] = useState(false);
  const exitingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      const root = document.documentElement;
      const viewer = document.querySelector('.viewer');
      if (active) {
        if (exitingTimer.current) clearTimeout(exitingTimer.current);
        root.dataset.fullscreen = 'true';
        viewer?.setAttribute('data-fullscreen', 'active');
        window.dispatchEvent(new Event('drishya-reading-layout'));
      } else {
        root.removeAttribute('data-fullscreen');
        viewer?.setAttribute('data-fullscreen', 'exiting');
        exitingTimer.current = setTimeout(() => {
          viewer?.removeAttribute('data-fullscreen');
          window.dispatchEvent(new Event('drishya-reading-layout'));
        }, 180);
      }
    };

    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (exitingTimer.current) clearTimeout(exitingTimer.current);
    };
  }, []);

  const toggle = async () => {
    setFailed(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
          setFailed(true);
          return;
        }
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div className="fullscreen-fallback-wrap">
        <button
          type="button"
          className="btn ghost embed-fullscreen-toggle embed-fallback"
          title="Fullscreen unavailable in this frame. Open in an independent window via drishya embed."
          aria-label="Fullscreen unavailable: open in window"
          onClick={() => alert('Fullscreen is not permitted by this host. Run drishya embed from your terminal or app to open in a separate window.')}
        >
          <svg className="fullscreen-glyph" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="fullscreen-toggle-label">Open in window</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`btn ghost embed-fullscreen-toggle${isFullscreen ? ' is-fullscreen' : ''}`}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      title={isFullscreen ? 'Exit full screen (Esc)' : 'Enter full screen'}
      aria-pressed={isFullscreen}
      onClick={toggle}
    >
      <svg className="fullscreen-glyph" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
        {isFullscreen ? (
          <path d="M4 10h6V4m10 6h-6V4m-10 10h6v6m10-6h-6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M15 3h6v6m-6 12h6v-6M9 3H3v6m6 12H3v-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <span className="fullscreen-toggle-label">{isFullscreen ? 'Exit' : 'Full screen'}</span>
    </button>
  );
}
