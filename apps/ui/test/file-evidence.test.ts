import { readFileSync } from 'node:fs';
import type { ReplayBundle,Operation } from '@drishya/contracts';
import { asOfProjection } from '@drishya/scene';
import { describe, expect, it } from 'vitest';
import { fileEvidence } from '../src/lib/file-evidence.ts';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
describe('file evidence choices', () => {
  it('keeps search lines independent without inventing surrounding source', () => {
    const search = bundle.projection.operations.find(op => op.detail.kind === 'search')!;
    if (search.detail.kind !== 'search') throw new Error('fixture search missing');
    const hit = search.detail.hits[0]!;
    const choices = fileEvidence(search, hit.path);
    expect(choices[0]!.snippet).toBe(hit.text);
    expect(choices[0]!.startLine).toBe(hit.line);
    expect(choices[0]!.artifactId).toBeUndefined();
    expect(fileEvidence(search, 'unrelated.ts')).toEqual([]);
    const start = bundle.projection.timeline.findIndex(entry => entry.type === 'op-start' && entry.operationId === search.id) + 1;
    expect(fileEvidence(asOfProjection(bundle.projection, start).operations.find(op => op.id === search.id)!, hit.path)).toEqual([]);
  });
  it('does not promote an earlier read to the before-state of an edit', () => {
    const edit = bundle.projection.operations.find((op) => op.detail.kind === 'edit')!;
    if (edit.detail.kind !== 'edit') throw new Error('fixture edit missing');
    const choices = fileEvidence({ ...edit, artifactIds: [] }, edit.detail.path);
    expect(choices.map((item) => item.label)).toEqual(['Patch']);
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
    expect(choices.map((item) => item.label)).toEqual(['Patch', 'Before-state reference', 'After-state reference']);
  });
});

describe('captured command output associated with files',()=>{
 const shell={...bundle.projection.operations[0]!,id:'shell-file',kind:'shell',status:'ok',paths:[{path:'worker/seed.ts',role:'read',basis:'derived'}],artifactIds:[],detail:{kind:'shell',command:'synthetic wrapper read',exitCode:0,outputPreview:'export const sample = 42;'}} as Operation;
 it('keeps short stdout as command evidence without calling it source or a search snippet',()=>{const [value]=fileEvidence(shell,'worker/seed.ts');expect(value).toMatchObject({label:'Command output',commandOutput:'export const sample = 42;'});expect(value?.snippet).toBeUndefined();expect(value?.artifactId).toBeUndefined();expect(fileEvidence(shell,'unrelated.ts')).toEqual([]);});
 it('prefers the stored output artifact for long results, retaining only a fallback preview',()=>{const op={...shell,detail:{...shell.detail,kind:'shell',command:'synthetic wrapper read',outputPreview:'last line',outputArtifactId:'captured-full-output'}} as Operation;expect(fileEvidence(op,'worker/seed.ts')[0]).toMatchObject({artifactId:'captured-full-output',commandOutput:'last line'});});
 it('does not make an output choice for an empty or pending result',()=>{const op={...shell,status:'running',detail:{kind:'shell',command:'synthetic wrapper read'}} as Operation;expect(fileEvidence(op,'worker/seed.ts')).toEqual([]);expect(fileEvidence({...op,status:'ok',detail:{...op.detail,kind:'shell',command:'synthetic wrapper read',outputPreview:''}} as Operation,'worker/seed.ts')).toEqual([]);});
 it('does not attach generic command output to a merely mentioned path',()=>{expect(fileEvidence({...shell,paths:[{path:'worker/seed.ts',role:'mentioned',basis:'derived'}]},'worker/seed.ts')).toEqual([]);});
});
