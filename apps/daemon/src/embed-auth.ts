// Launch credentials never leave this in-memory owner except via the private launcher channel.
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();
export class EmbedCodes {
  private readonly codes = new Map<string, {recordingId: string; expires: number}>();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) {this.now = now;}
  mint(recordingId: string): string {
    const code = randomBytes(32).toString('base64url');
    for (const [key, entry] of this.codes) if (entry.expires <= this.now()) this.codes.delete(key);
    while (this.codes.size >= 32) this.codes.delete(this.codes.keys().next().value!);
    this.codes.set(digest(code).toString('hex'), {recordingId, expires: this.now() + 60_000});
    return code;
  }
  consume(code: string, recordingId: string): boolean {
    if (!/^[A-Za-z0-9_-]{43}$/.test(code)) return false;
    const supplied = digest(code);
    // Compare fixed-length digests; never compare raw credentials or log failed input.
    for (const [key, entry] of this.codes) {
      if (!timingSafeEqual(supplied, Buffer.from(key, 'hex'))) continue;
      if (entry.expires <= this.now()) {this.codes.delete(key); return false;}
      if (entry.recordingId !== recordingId) return false;
      this.codes.delete(key); // synchronous: two exchanges cannot both consume it
      return true;
    }
    return false;
  }
  clear(): void {this.codes.clear();}
}
