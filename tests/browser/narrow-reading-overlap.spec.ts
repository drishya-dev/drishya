import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Observation } from '../../packages/contracts/src/index.ts';
import { PRIVACY_POLICY_VERSION } from '../../packages/privacy/src/index.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, app: App, server: RunningServer;
const ids = new Map<string, string>();

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ui49-'));
  app = new App(join(dir, 'store'));

  for (const harness of ['claude-code', 'codex'] as const) {
    const id = `ui49-narrow-${harness}`;
    const sourceId = `source-${harness}`;
    const journal = join(dir, `${harness}.jsonl`);
    writeFileSync(journal, '');
    app.store.upsertRecording({
      id,
      adapterId: harness,
      harness,
      sourcePath: journal,
      title: `UI-49 Narrow ${harness}`,
      workspaceRoot: dir,
    });

    let sequence = 0;
    const rows: Omit<Observation, 'receivedSequence'>[] = [];
    const add = (kind: Observation['kind'], agentId: string, payload: Observation['payload'], operationId?: string) =>
      rows.push({
        id: `${id}-${sequence++}`,
        recordingId: id,
        source: { adapterId: harness, adapterVersion: 'synthetic', sourceId, generation: 0, byteOffset: sequence, part: 0 },
        observedAt: '2026-11-14T10:00:00Z',
        workspaceRoot: dir,
        agentId,
        operationId,
        kind,
        payload,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        redactions: [],
        availability: 'complete',
      });

    add('session.meta', 'main', { harness });
    add('tools.snapshot', 'main', { source: 'prompt_snapshot', tools: [{ name: 'Read' }, { name: 'Search' }, { name: 'Bash' }] });

    for (let n = 0; n < 8; n++) {
      add('message.user', 'main', { text: `Turn ${n}: checking that header and footer veils never cover reading content.` });
      add('tool.call', 'main', { tool: 'Read', input: { file_path: join(dir, `${n}.ts`) }, intent: { kind: 'read', path: join(dir, `${n}.ts`) } }, `read-${n}`);
      add('tool.result', 'main', { output: `File contents for turn ${n}:\n` + `export const value_${n}_line_${n} = ${n * 100};\n`.repeat(8), isError: false }, `read-${n}`);
      add('message.agent', 'main', { text: `Completed step ${n}. Content remains fully visible between top and bottom chrome.` });
    }

    app.store.appendObservations(id, sourceId, { offset: sequence, generation: 0, fingerprint: 'synthetic' }, rows);
    ids.set(harness, id);
  }

  server = await startServer({ app, port: 0 });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});

test.beforeEach(async ({ page }) => {
  await page.route('**/v1/working-locations', r => r.request().method() === 'GET' ? r.fulfill({ json: { version: 1, sessions: [] } }) : r.continue());
  await page.route('**/controller', r => r.fulfill({ json: { harness: 'codex', available: true, output: '', tools: ['Read', 'Search', 'Bash'], inventory: 'runtime', approvals: [], state: 'idle' } }));
});

async function openSession(page: Page, harness: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(server.launchUrl);
  await expect(page.locator('.home, .mh-home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.get(harness)}`);
  await expect(page.locator('.history article.op, .history .passage-slot').first()).toBeVisible();
  await page.waitForTimeout(400);
}

async function measureOverlaps(page: Page, state: 'bottom' | 'top' | 'mid') {
  return page.evaluate((currentState) => {
    const viewer = document.querySelector<HTMLElement>('.viewer');
    const column = viewer?.querySelector<HTMLElement>('.history-inner');
    if (!viewer || !column) return { textOverlaps: 0, controlOverlaps: 0, veilOverlaps: 0 };

    const vr = viewer.getBoundingClientRect();
    const edgeTop = parseFloat(viewer.style.getPropertyValue('--reading-edge-top')) || 0;
    const edgeBottom = parseFloat(viewer.style.getPropertyValue('--reading-edge-bottom')) || 0;

    const capsules = [...viewer.querySelectorAll<HTMLElement>(
      '.modern-session-header :is(.modern-identity, .studio-session, .studio-actions, .session-connection), ' +
      '.workspace-leading, .workspace-secondary, .catalog-toggle, .modern-native-composer, .follow-pill, .history-transport > .btn'
    )]
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(c => c.r.width > 0 && c.r.height > 0);

    const visibleTop = vr.top + edgeTop;
    const visibleBottom = vr.bottom - edgeBottom;

    // Check text nodes
    const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node: Node | null;
    let textOverlaps = 0;
    let veilOverlaps = 0;

    while ((node = walker.nextNode())) {
      const str = node.textContent?.trim();
      if (!str) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.bottom < vr.top || r.top > vr.bottom) continue;

        if (currentState === 'bottom') {
          if (r.bottom > visibleBottom) veilOverlaps++;
          for (const cap of capsules.filter(c => c.r.top >= vr.bottom * 0.5)) {
            if (r.right > cap.r.left + 0.5 && r.left < cap.r.right - 0.5 && r.bottom > cap.r.top + 0.5 && r.top < cap.r.bottom - 0.5) {
              textOverlaps++;
            }
          }
        } else if (currentState === 'top') {
          if (r.top < visibleTop) veilOverlaps++;
          for (const cap of capsules.filter(c => c.r.bottom <= vr.height * 0.5)) {
            if (r.right > cap.r.left + 0.5 && r.left < cap.r.right - 0.5 && r.bottom > cap.r.top + 0.5 && r.top < cap.r.bottom - 0.5) {
              textOverlaps++;
            }
          }
        } else {
          const cTop = Math.max(r.top, visibleTop);
          const cBottom = Math.min(r.bottom, visibleBottom);
          if (cBottom > cTop + 0.5) {
            for (const cap of capsules) {
              if (r.right > cap.r.left + 0.5 && r.left < cap.r.right - 0.5 && cBottom > cap.r.top + 0.5 && cTop < cap.r.bottom - 0.5) {
                textOverlaps++;
              }
            }
          }
        }
      }
    }

    // Check card controls (buttons, links, summaries)
    const cardControls = [...column.querySelectorAll<HTMLElement>('button, a, summary, [role=button]')].map(el => ({ el, r: el.getBoundingClientRect() }));
    let controlOverlaps = 0;
    for (const cc of cardControls) {
      if (cc.r.width <= 0 || cc.r.height <= 0) continue;
      if (cc.r.bottom < vr.top || cc.r.top > vr.bottom) continue;

      if (currentState === 'bottom') {
        for (const cap of capsules.filter(c => c.r.top >= vr.bottom * 0.5)) {
          if (cc.r.right > cap.r.left + 0.5 && cc.r.left < cap.r.right - 0.5 && cc.r.bottom > cap.r.top + 0.5 && cc.r.top < cap.r.bottom - 0.5) {
            controlOverlaps++;
          }
        }
      } else if (currentState === 'top') {
        for (const cap of capsules.filter(c => c.r.bottom <= vr.height * 0.5)) {
          if (cc.r.right > cap.r.left + 0.5 && cc.r.left < cap.r.right - 0.5 && cc.r.bottom > cap.r.top + 0.5 && cc.r.top < cap.r.bottom - 0.5) {
            controlOverlaps++;
          }
        }
      } else {
        const cTop = Math.max(cc.r.top, visibleTop);
        const cBottom = Math.min(cc.r.bottom, visibleBottom);
        if (cBottom > cTop + 0.5) {
          for (const cap of capsules) {
            if (cc.r.right > cap.r.left + 0.5 && cc.r.left < cap.r.right - 0.5 && cBottom > cap.r.top + 0.5 && cTop < cap.r.bottom - 0.5) {
              controlOverlaps++;
            }
          }
        }
      }
    }

    return { textOverlaps, controlOverlaps, veilOverlaps, edgeTop, edgeBottom };
  }, state);
}

for (const harness of ['claude-code', 'codex'] as const) {
  for (const width of [600, 720, 900] as const) {
    test(`UI-49: narrow window ${width}px ${harness} chrome never covers text or controls`, async ({ page }) => {
      await openSession(page, harness, width);

      // Verify bottom controls share one row without horizontal collision
      if (width <= 820) {
        const toolsLoc = page.locator('.catalog-toggle');
        const compLoc = page.locator('.modern-native-composer');
        const followLoc = page.locator('.history-transport .follow-pill, .follow-pill').first();

        if (await toolsLoc.isVisible() && await compLoc.isVisible() && await followLoc.isVisible()) {
          const tools = (await toolsLoc.boundingBox())!;
          const composer = (await compLoc.boundingBox())!;
          const follow = (await followLoc.boundingBox())!;
          expect(tools.x + tools.width).toBeLessThanOrEqual(composer.x + 2);
          expect(composer.x + composer.width).toBeLessThanOrEqual(follow.x + 2);
          expect(Math.abs(tools.y - composer.y)).toBeLessThanOrEqual(8);
        }
      }

      // Check at rest (bottom / latest)
      await page.locator('.history').evaluate(async el => {
        for (let i = 0; i < 5; i++) {
          el.scrollTop = el.scrollHeight;
          await new Promise(r => setTimeout(r, 60));
        }
      });
      await page.waitForTimeout(200);
      const bottomReport = await measureOverlaps(page, 'bottom');
      expect(bottomReport.textOverlaps).toBe(0);
      expect(bottomReport.controlOverlaps).toBe(0);
      expect(bottomReport.veilOverlaps).toBe(0);

      // Check scrolled to top
      await page.locator('.history').evaluate(el => { el.scrollTop = 0; });
      await page.waitForTimeout(200);
      const topReport = await measureOverlaps(page, 'top');
      expect(topReport.textOverlaps).toBe(0);
      expect(topReport.controlOverlaps).toBe(0);
      expect(topReport.veilOverlaps).toBe(0);

      // Check mid-history
      await page.locator('.history').evaluate(el => {
        el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * 0.5);
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -50, bubbles: true }));
      });
      await page.waitForTimeout(200);
      const midReport = await measureOverlaps(page, 'mid');
      expect(midReport.textOverlaps).toBe(0);
      expect(midReport.controlOverlaps).toBe(0);
    });

    test(`UI-49: narrow window ${width}px ${harness} with Files panel open`, async ({ page }) => {
      await openSession(page, harness, width);
      const trigger = page.locator('[data-workspace-files-trigger]');
      if (await trigger.isVisible()) {
        await trigger.click();
        await page.waitForTimeout(200);
      }

      // Check bottom
      await page.locator('.history').evaluate(async el => {
        for (let i = 0; i < 5; i++) {
          el.scrollTop = el.scrollHeight;
          await new Promise(r => setTimeout(r, 60));
        }
      });
      await page.waitForTimeout(200);
      const bottomReport = await measureOverlaps(page, 'bottom');
      expect(bottomReport.textOverlaps).toBe(0);
      expect(bottomReport.controlOverlaps).toBe(0);

      // Check top
      await page.locator('.history').evaluate(el => { el.scrollTop = 0; });
      await page.waitForTimeout(200);
      const topReport = await measureOverlaps(page, 'top');
      expect(topReport.textOverlaps).toBe(0);
      expect(topReport.controlOverlaps).toBe(0);
    });
  }
}
