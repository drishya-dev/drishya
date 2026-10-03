import { readFileSync } from 'node:fs';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReplayBundle } from '@drishya/contracts';
import { asOfProjection, compose } from '@drishya/scene';
import { History } from '../src/components/History.tsx';
import { Inspector } from '../src/components/Inspector.tsx';
import { useApp } from '../src/state.ts';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;

describe('historical renderer', () => {
  it('keeps a late MCP result out of the passage and inspector until op-end', () => {
    const p = bundle.projection;
    const op = p.operations.find((o) => o.detail.kind === 'mcp' && o.detail.resultPreview)!;
    const result = (op.detail as { resultPreview: string }).resultPreview;
    const start = p.timeline.findIndex((item) => item.type === 'op-start' && item.operationId === op.id) + 1;
    const end = p.timeline.findIndex((item) => item.type === 'op-end' && item.operationId === op.id) + 1;
    expect(end).toBeGreaterThan(start);
    useApp.setState({ recordingId: bundle.recording.id, mode: 'replay', step: start, follow: true, selectedOp: op.id, inspectorTab: 'detail' });
    const before = asOfProjection(p, start);
    const pending = renderToStaticMarkup(createElement(Fragment, null,
      createElement(History, { scene: compose(p, { step: start }), projection: before }),
      createElement(Inspector, { projection: before }),
    ));
    expect(pending).not.toContain(result.slice(0, 80));
    const after = asOfProjection(p, end);
    const complete = renderToStaticMarkup(createElement(Fragment, null,
      createElement(History, { scene: compose(p, { step: end }), projection: after }),
      createElement(Inspector, { projection: after }),
    ));
    expect(complete).toContain(result.slice(0, 80));
  });
});
