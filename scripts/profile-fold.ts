// Scratch profiler (PERF-4): where a full fold of a stored recording spends its time. Counts and times only.
//   node scripts/profile-fold.ts <data dir>
import { performance } from 'node:perf_hooks';
import { Store } from '../packages/store/src/index.ts';
import { reduce, createReducer } from '../packages/projection/src/index.ts';
import { defaultAdapters } from '../packages/ingest/src/index.ts';
const dir = process.argv[2]!;
const store = new Store(dir, { readOnly: true });
const id = store.listRecordings()[0]!.id;
const adapters = Object.fromEntries(defaultAdapters().map((a) => [a.descriptor.id, a.descriptor]));
const t = (label: string, t0: number) => console.log(label, Math.round(performance.now() - t0), 'ms');
let t0 = performance.now();
const rows = store.db.prepare('SELECT COUNT(*) n, SUM(length(body)) b FROM observations WHERE recording_id=?').get(id) as any;
console.log('observations', rows.n, 'body MB', Math.round(rows.b / 1048576));
t('count', t0);
t0 = performance.now(); let n = 0;
for (const o of store.orderedObservations(id)) n++;
t('ordered read + parse', t0);
t0 = performance.now(); n = 0;
for (const r of store.db.prepare('SELECT body FROM observations WHERE recording_id=? ORDER BY seq').iterate(id) as any) { JSON.parse(r.body); n++; }
t('plain seq read + parse', t0);
t0 = performance.now();
const arr = [...store.orderedObservations(id)];
t('ordered into array', t0);
t0 = performance.now();
const io = { get: (s: string) => store.blobs.get(s), put: (text: string) => ({ sha: 'x', bytes: text.length }) };
const p = reduce(id, arr, io as any, { adapters, live: false, ordered: true, maxProseChars: 4096, maxInputChars: 4096 });
t('reduce (array, put stubbed)', t0);
console.log('ops', p.operations.length, 'timeline', p.timeline.length, 'prose', p.prose.length, 'passages', p.passages.length);
t0 = performance.now();
const js = JSON.stringify(p);
t('stringify projection', t0); console.log('projection MB', Math.round(js.length / 1048576));
