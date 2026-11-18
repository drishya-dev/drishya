/**
 * EMBED: Drishya opened for one session in a harness app's side pane (`drishya embed`, `/drishya`, `drishya.open_view`).
 * The pane opens `/?embed=1&recording=<id>#launch=<one-use code>`. The code is read here once, before anything else runs,
 * and the address bar becomes `/?embed=1#/r/<id>` at once, so the credential never reaches history, the DOM, storage,
 * logs or React state. See docs/review/embed-1-in-app.md §1 and §3.
 */
export const EMBED_MIN_WIDTH = 360;

const RECORDING = /^rec_[a-f0-9]{8,64}$/;
const CODE = /^[A-Za-z0-9_-]{43}$/;

let pending: { code: string; recordingId: string } | undefined;

export function isEmbedded(search: string = location.search): boolean {
  return new URLSearchParams(search).get('embed') === '1';
}

/** Takes the launch code out of the address bar. Runs once, first thing in main.tsx. */
export function takeEmbedLaunch(): void {
  if (!isEmbedded()) return;
  document.documentElement.dataset.embed = '1';
  const query = new URLSearchParams(location.search);
  const recordingId = query.get('recording') ?? '';
  const code = new URLSearchParams(location.hash.slice(1)).get('launch') ?? '';
  if (!query.has('recording') && !/(^#|&)launch=/.test(location.hash)) return;
  // Clean the address whether or not the values are valid: a malformed link still must not stay visible.
  const route = RECORDING.test(recordingId) ? `#/r/${encodeURIComponent(recordingId)}` : '';
  history.replaceState(null, '', `${location.pathname}?embed=1${route}`);
  if (RECORDING.test(recordingId) && CODE.test(code)) pending = { code, recordingId };
}

/** The pending one-use exchange, handed out once. */
export function consumeEmbedLaunch(): { code: string; recordingId: string } | undefined {
  const launch = pending;
  pending = undefined;
  return launch;
}

/** The recording an embed pane shows; it never shows Home or another session. */
export function embeddedRecording(): string | undefined {
  const id = /^#\/r\/([^/?]+)/.exec(location.hash)?.[1];
  return id && RECORDING.test(decodeURIComponent(id)) ? decodeURIComponent(id) : undefined;
}
