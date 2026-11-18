import type { Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

/** Bounded DOM state for synthetic browser tests. Captured text and input values are omitted. */
export async function installBrowserDiagnostics(page: Page) {
  await page.addInitScript(() => {
    const events: object[] = [];
    const samples: object[] = [];
    const describe = (node: EventTarget | null) => node instanceof HTMLElement ? {
      tag: node.tagName,
      className: node.className,
      ordinal: node.dataset.promptOrdinal,
      connected: node.isConnected,
    } : null;
    const record = (event: object) => {
      events.push({ time: Math.round(performance.now()), ...event });
      if (events.length > 160) events.shift();
    };
    const state = () => {
      const history = document.querySelector<HTMLElement>('.history');
      const rail = document.querySelector<HTMLElement>('.complete-prompt-rail');
      const bounds = history?.getBoundingClientRect();
      const part = bounds && [...history!.querySelectorAll<HTMLElement>('.passage-slot:not([data-folded=hidden]):not([data-unloaded=true]) :is(.turn,.prose,.ops-row,.run-line)')]
        .find(node => node.getBoundingClientRect().bottom > bounds.top + 1);
      return {
        active: describe(document.activeElement),
        history: history && { top: history.scrollTop, height: history.scrollHeight, viewport: history.clientHeight,
          passage: part?.closest<HTMLElement>('[data-passage-id]')?.dataset.passageId,
          kind: part?.className,
          offset: part && bounds ? Math.round(part.getBoundingClientRect().top - bounds.top) : undefined,
          unloaded: history.querySelectorAll('[data-unloaded=true]').length,
        },
        rail: rail && {
          top: rail.scrollTop, height: rail.scrollHeight, viewport: rail.clientHeight,
          ordinals: [...rail.querySelectorAll<HTMLElement>('[data-prompt-ordinal]')].map(node => node.dataset.promptOrdinal),
        },
      };
    };
    Object.assign(window, { __testDiagnostics: { events, samples, state } });
    for (const type of ['focusin', 'focusout', 'keydown', 'keyup']) {
      document.addEventListener(type, event => {
        record({ type, key: event instanceof KeyboardEvent ? event.key : undefined, target: describe(event.target), ...state() });
      }, true);
    }
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options) {
      record({ type: 'focus-call', target: describe(this), stack: new Error().stack?.split('\n').slice(1, 5) });
      originalFocus.call(this, options);
    };
    const observer = new MutationObserver(records => {
      for (const recordEntry of records) {
        for (const node of recordEntry.removedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const removed = [node, ...node.querySelectorAll<HTMLElement>('[data-prompt-ordinal]')]
            .filter(element => element.dataset.promptOrdinal !== undefined)
            .map(element => element.dataset.promptOrdinal);
          if (removed.length) record({ type: 'removed-prompts', ordinals: removed, ...state() });
        }
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

export async function sampleBrowserState(page: Page, stage: string) {
  await page.evaluate(label => {
    const diagnostics = (window as Window & {
      __testDiagnostics?: { samples: object[]; state: () => object };
    }).__testDiagnostics;
    if (diagnostics) {
      diagnostics.samples.push({ stage: label, time: Math.round(performance.now()), ...diagnostics.state() });
      if (diagnostics.samples.length > 40) diagnostics.samples.shift();
    }
  }, stage);
}

export async function attachBrowserDiagnostics(page: Page, info: TestInfo) {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const diagnostics = await page.evaluate(() => {
    const data = (window as Window & {
      __testDiagnostics?: { events: object[]; samples: object[]; state: () => object };
    }).__testDiagnostics;
    return data && { events: data.events, samples: data.samples, final: data.state(), viewport: { width: innerWidth, height: innerHeight } };
  }).catch(() => undefined);
  if (diagnostics) {
    const path = info.outputPath('browser-state.json');
    await writeFile(path, JSON.stringify(diagnostics, null, 2));
    await info.attach('browser-state', { path, contentType: 'application/json' });
  }
}
