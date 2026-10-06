import { readFileSync } from 'node:fs';
import type { ReplayBundle } from '@drishya/contracts';
import { asOfProjection } from '@drishya/scene';
import { describe, expect, it } from 'vitest';
import { fileEvidence } from '../src/lib/file-evidence.ts';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
describe('file evidence choices', () => {
  it('does not promote an earlier read to the before-state of an edit', () => {
    const edit = bundle.projection.operations.find((op) => op.detail.kind === 'edit')!;
    if (edit.detail.kind !== 'edit') throw new Error('fixture edit missing');
    const choices = fileEvidence({ ...edit, artifactIds: [] }, edit.detail.path);
    expect(choices.map((item) => item.label)).toEqual(['Captured patch']);
    expect(choices[0]!.artifactId).toBeUndefined();
    expect(fileEvidence(edit, 'unrelated.ts')).toEqual([]);
  });
  it('keeps pending read results out of the evidence picker at replay start', () => {
    const p = bundle.projection;
    const read = p.operations.find((op) => op.detail.kind === 'read' && op.detail.excerptArtifactId)!;
    if (read.detail.kind !== 'read') throw new Error('fixture read missing');
    const path = read.detail.path;
    const start = p.timeline.findIndex((entry) => entry.type === 'op-start' && entry.operationId === read.id) + 1;
    const end = p.timeline.findIndex((entry) => entry.type === 'op-end' && entry.operationId === read.id) + 1;
    expect(fileEvidence(asOfProjection(p, start).operations.find((op) => op.id === read.id)!, path)).toEqual([]);
    expect(fileEvidence(asOfProjection(p, end).operations.find((op) => op.id === read.id)!, path)[0]!.artifactId).toBe(read.detail.excerptArtifactId);
  });
  it('keeps state reference labels provisional until the artifact reader supplies provenance', () => {
    const edit = bundle.projection.operations.find((op) => op.detail.kind === 'edit')!;
    if (edit.detail.kind !== 'edit') throw new Error('fixture edit missing');
    const choices = fileEvidence({ ...edit, artifactIds: ['snapshot_before', 'derived_after'] }, edit.detail.path);
    expect(choices.map((item) => item.label)).toEqual(['Captured patch', 'Before-state reference', 'After-state reference']);
  });
});
