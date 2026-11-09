import type {Chapter} from './sample-model.ts';
import {validateChapterPayload} from './sample-model.ts';
import type {SampleController, SampleSnapshot} from './sample-controller.ts';
import {createSampleController} from './sample-controller.ts';
import type {MotionRuntime} from './motion-runtime.ts';
import {motionAllowed} from './landing-motion.ts';

const escape = (s: string) =>
  s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));

function formatLines(text: string): string {
  return text
    .split('\n')
    .map((line, i) => {
      const cls = line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : '';
      const highlighted = escape(line).replace(
        /\b(import|from|export|type|function|if|return|const|undefined|null)\b/g,
        '<span class="keyword">$1</span>'
      );
      return `<span class="code-line ${cls}"><span class="line-number" aria-hidden="true">${i + 1}</span><span>${highlighted || ' '}</span></span>`;
    })
    .join('');
}

export function initLivingSample(
  runtime: MotionRuntime,
  controller: SampleController,
  chapters: readonly Chapter[]
): () => void {
  const section = document.getElementById('session');
  const stage = document.getElementById('chapter-material');
  const controls = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter-key]'));
  const range = document.getElementById('sample-range') as HTMLInputElement | null;
  const playBtn = document.getElementById('play-sample') as HTMLButtonElement | null;
  const replayBtn = document.getElementById('replay-sample') as HTMLButtonElement | null;
  const repeatCheck = document.getElementById('repeat-sample') as HTMLInputElement | null;
  const counter = document.getElementById('chapter-counter');
  const fullLink = document.getElementById('full-replay') as HTMLAnchorElement | null;
  const announcement = document.getElementById('sample-announcement');

  if (!section || !stage || chapters.length !== 4) {
    return () => {};
  }

  if (playBtn) playBtn.hidden = false;

  let activeIndex = -1;

  function updateUrl(key: string): void {
    const url = new URL(location.href);
    url.searchParams.set('moment', key);
    url.hash = 'session';
    history.replaceState({moment: key}, '', url);
  }

  function render(snapshot: SampleSnapshot): void {
    const {index, playing, repeat} = snapshot;
    const c = chapters[index]!;
    const isNewChapter = index !== activeIndex;
    activeIndex = index;

    if (isNewChapter) {
      stage!.getAnimations().forEach(a => a.cancel());
      const kind = c.kind;
      const symbol = kind === 'test' ? '&gt;_' : '{ }';
      const resultClass = c.key === 'failure' ? 'failed' : c.key === 'retest' ? 'passed' : '';

      stage!.innerHTML = `
        <div class="evidence-heading">
          <span class="file-symbol" aria-hidden="true">${symbol}</span>
          <span>${escape(c.path ?? c.command ?? '')}</span>
          <span class="result ${resultClass}">${escape(c.status)}</span>
        </div>
        <div class="provenance">${escape(c.provenance)}</div>
        <pre class="material" tabindex="0" aria-label="${escape(c.title)} material"><code>${formatLines(c.text)}</code></pre>
      `;

      if (motionAllowed() && !document.hidden) {
        stage!.animate(
          [
            {transform: 'translateY(6px)', opacity: 0.95},
            {transform: 'translateY(0)', opacity: 1},
          ],
          {duration: 180, easing: 'cubic-bezier(.22,1,.36,1)'}
        );
      }

      controls.forEach((control, i) => {
        if (i === index) {
          control.setAttribute('aria-current', 'step');
          control.classList.add('active');
        } else {
          control.removeAttribute('aria-current');
          control.classList.remove('active');
        }
      });

      if (counter) {
        counter.textContent = `${index + 1} of 4`;
      }
      if (range) {
        range.value = String(index + 1);
        range.setAttribute('aria-valuetext', c.title);
      }
      if (fullLink) {
        fullLink.href = `/demo/?demo&at=${c.step}${motionAllowed() ? '' : '&motion=0'}`;
      }
    }

    if (playBtn) {
      if (playing) {
        playBtn.textContent = 'Pause sample ⏸';
      } else if (index === 3 && !repeat) {
        playBtn.textContent = 'Replay sample ↺';
      } else {
        playBtn.textContent = 'Play sample ▷';
      }
      playBtn.setAttribute('aria-pressed', String(playing));
    }
    if (repeatCheck) {
      repeatCheck.checked = repeat;
    }

    if (announcement) {
      if (playing) {
        announcement.textContent = `Playing step ${index + 1} of 4. ${c.title}.`;
      } else {
        announcement.textContent = `${index + 1} of 4. ${c.title}. ${c.status}.`;
      }
    }
  }

  // Bind selector clicks
  const cleanupListeners: Array<() => void> = [];

  controls.forEach((control, i) => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
      controller.select(i, event.detail === 0 ? 'keyboard' : 'pointer');
      updateUrl(chapters[i]!.key);
    };
    control.addEventListener('click', handler);
    cleanupListeners.push(() => control.removeEventListener('click', handler));
  });

  if (range) {
    const onRangeInput = () => {
      const idx = Number(range.value) - 1;
      controller.select(idx, 'range');
      updateUrl(chapters[idx]!.key);
    };
    range.addEventListener('input', onRangeInput);
    cleanupListeners.push(() => range.removeEventListener('input', onRangeInput));

    const onRangeKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const current = controller.snapshot().index;
        const target =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
            ? 3
            : e.key === 'ArrowRight' || e.key === 'ArrowUp'
            ? Math.min(3, current + 1)
            : Math.max(0, current - 1);
        controller.select(target, 'keyboard');
        updateUrl(chapters[target]!.key);
      }
    };
    range.addEventListener('keydown', onRangeKey);
    cleanupListeners.push(() => range.removeEventListener('keydown', onRangeKey));
  }

  if (playBtn) {
    const onPlay = () => {
      if (controller.snapshot().playing) {
        controller.pause();
      } else {
        controller.play();
      }
    };
    playBtn.addEventListener('click', onPlay);
    cleanupListeners.push(() => playBtn.removeEventListener('click', onPlay));
  }

  if (replayBtn) {
    const onReplay = () => {
      controller.replay();
    };
    replayBtn.addEventListener('click', onReplay);
    cleanupListeners.push(() => replayBtn.removeEventListener('click', onReplay));
  }

  if (repeatCheck) {
    const onRepeat = () => {
      controller.setRepeat(repeatCheck.checked);
    };
    repeatCheck.addEventListener('change', onRepeat);
    cleanupListeners.push(() => repeatCheck.removeEventListener('change', onRepeat));
  }

  // Visibility observation: pause when <20% of section visible or <50% of toolbar visible
  const observer = new IntersectionObserver(
    entries => {
      const isVisible = entries.some(e => e.isIntersecting);
      controller.setVisible(isVisible);
    },
    {threshold: [0.2, 0.5]}
  );
  observer.observe(section);
  const toolbar = section.querySelector('.stage-toolbar');
  if (toolbar) observer.observe(toolbar);

  // Global events
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && controller.snapshot().playing) {
      controller.pause();
    }
  };
  document.addEventListener('keydown', onKeyDown);
  cleanupListeners.push(() => document.removeEventListener('keydown', onKeyDown));

  const onPopState = () => {
    const moment = new URLSearchParams(location.search).get('moment');
    const idx = chapters.findIndex(c => c.key === moment);
    controller.restore(idx >= 0 ? idx : 0, 'manual');
  };
  addEventListener('popstate', onPopState);
  cleanupListeners.push(() => removeEventListener('popstate', onPopState));

  const onPageHide = () => {
    controller.pause();
  };
  addEventListener('pagehide', onPageHide);
  cleanupListeners.push(() => removeEventListener('pagehide', onPageHide));

  const unsubscribeController = controller.subscribe(render);

  // Initial render
  const initialMoment = new URLSearchParams(location.search).get('moment');
  const initialIdx = chapters.findIndex(c => c.key === initialMoment);
  if (initialIdx > 0) {
    controller.restore(initialIdx, 'manual');
  } else {
    render(controller.snapshot());
  }

  return () => {
    unsubscribeController();
    observer.disconnect();
    cleanupListeners.forEach(c => c());
    controller.dispose();
  };
}

export async function loadAndInitLivingSample(runtime: MotionRuntime): Promise<(() => void) | undefined> {
  const section = document.getElementById('session');
  const errorEl = document.getElementById('sample-error');
  const retryBtn = document.getElementById('retry-sample');

  if (!section) return undefined;

  async function attempt(): Promise<(() => void) | undefined> {
    try {
      if (errorEl) errorEl.hidden = true;
      const res = await fetch('/chapters.json');
      if (!res.ok) throw new Error('Sample unavailable');
      const text = await res.text();
      const data = JSON.parse(text);
      const chapters = validateChapterPayload(data, text.length);
      const controller = createSampleController(chapters, runtime);
      return initLivingSample(runtime, controller, chapters);
    } catch (err) {
      if (errorEl) {
        errorEl.hidden = false;
      }
      const playBtn = document.getElementById('play-sample');
      if (playBtn) playBtn.hidden = true;
      return undefined;
    }
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      void attempt();
    });
  }

  return attempt();
}
