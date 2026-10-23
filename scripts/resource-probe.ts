import { Worker } from 'node:worker_threads';

/** RSS is process-wide. A separate sampler still sees peaks while capture blocks its thread. */
export interface RssSample { at: number; rss: number; samplerHeapUsed: number; samplerHeapPhysical: number; samplerExternal: number }

export function sampleRss(onSamples?: (samples: RssSample[]) => void) {
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const getHeapStatistics = workerData.diagnostics ? require('node:v8').getHeapStatistics : undefined;
    const samples = [];
    const sample = () => {
      const rss = process.memoryUsage().rss;
      peak = Math.max(peak, rss);
      if (workerData.diagnostics) { const h = getHeapStatistics(); samples.push({ at: performance.now(), rss, samplerHeapUsed: h.used_heap_size, samplerHeapPhysical: h.total_physical_size, samplerExternal: h.external_memory }); }
    };
    let peak = process.memoryUsage().rss;
    const timer = setInterval(sample, 20);
    parentPort.on('message', () => { clearInterval(timer); sample(); parentPort.postMessage(workerData.diagnostics ? { peak, samples } : peak); });
  `, { eval: true, workerData: { diagnostics: !!onSamples } });
  return async () => {
    const peak = await new Promise<number>((resolve, reject) => {
      worker.once('message', value => { if (onSamples) { onSamples(value.samples); resolve(value.peak); } else resolve(value); }); worker.once('error', reject); worker.postMessage('finish');
    });
    await worker.terminate();
    return peak / 1048576;
  };
}
