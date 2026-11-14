import type { RealCase } from './types.ts';
import { decodeArgs, isPlanArtifact } from '../../packages/adapter-antigravity/src/tools.ts';

export const antigravityMedia: RealCase = {
  name: 'antigravity-media', about: 'Antigravity captured images, recorded thinking and native plan-artifact documents',
  harnesses: ['antigravity'], prefilter: '',
  scan(row) {
    const images = Array.isArray(row.media) ? row.media.filter(media => media && typeof media === 'object' && (!media.mime_type || /^image\/(?:png|jpeg|gif|webp)$/i.test(media.mime_type))).length : 0;
    const artifacts = (Array.isArray(row.tool_calls) ? row.tool_calls : []).filter(call => call && typeof call === 'object' && isPlanArtifact(decodeArgs(call.args))).length;
    return images || artifacts ? { hits: images + artifacts, only: artifacts } : undefined;
  },
  verify(projection, expected) {
    const plans = projection.operations.filter(op => op.detail.kind === 'plan' && op.detail.document?.source === 'native-call');
    const images = projection.operations.reduce((n, op) => n + (op.images?.length ?? 0), 0) + projection.timeline.reduce((n, item) => n + (item.type === 'turn' ? item.images?.length ?? 0 : 0), 0);
    const bad = plans.filter(op => op.paths.length || op.kind === 'edit' || op.kind === 'write');
    return [...(plans.length !== expected.only ? [`FAIL artifact cards ${plans.length}/${expected.only}`] : []), ...(images < expected.hits - expected.only ? [`FAIL image references ${images}/${expected.hits - expected.only}`] : []), `${images} image references; ${plans.length} artifact plan cards; ${projection.prose.filter(p => p.role === 'reasoning').length} recorded thinking passages`, bad.length ? `FAIL ${bad.length} artifacts became repository writes` : 'PASS native artifacts remain outside repository writes'];
  },
};
