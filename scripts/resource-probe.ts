import { Worker } from 'node:worker_threads';

/** RSS is process-wide. A separate sampler still sees peaks while capture blocks its thread. */
export function sampleRss() {
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads');
    let peak = process.memoryUsage().rss;
    const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 20);
    parentPort.on('message', () => { clearInterval(timer); parentPort.postMessage(Math.max(peak, process.memoryUsage().rss)); });
  `, { eval: true });
  return async () => {
    const peak = await new Promise<number>((resolve, reject) => {
      worker.once('message', resolve); worker.once('error', reject); worker.postMessage('finish');
    });
    await worker.terminate();
    return peak / 1048576;
  };
}
