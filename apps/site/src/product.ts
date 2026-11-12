// SITE-1: the first two of the laptop's three screens, the same synthetic session as the agent's own CLI and desktop app
// show it. The third screen is the real Drishya app (demo.html), not a recreation.
import sample from './generated/sample.json';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
type Op = (typeof sample.operations)[number];
const PROMPT = 'A fully discounted order is blocked at checkout. Find why and fix it, and keep the tests passing.';
const tool: Record<string, (o: Op) => string> = {
  read: o => `Read(${o.target})`, search: o => `Search(pattern: ${o.target})`, edit: o => `Update(${o.target})`,
  test: o => `Bash(${o.target})`, shell: o => `Bash(${o.target})`, mcp: o => `${o.target} (MCP)`, spawn: o => `Task(${o.target})`,
};
const result = (o: Op) => o.kind === 'read' ? 'Read the file' : o.kind === 'search' ? 'Found matches' : o.kind === 'edit' ? 'Updated the file' : o.kind === 'spawn' ? 'Sub-agent finished' : o.kind === 'mcp' ? 'Returned a result' : o.outcome === 'failed' ? 'Exit code 1' : 'Done';
const ops = sample.operations.filter(o => o.harness === 'Claude Code');
const closing = 'Fixed. checkoutBlock now blocks only a missing total, so a fully discounted cart with a total of 0 reaches checkout, and the suite passes (6 of 6).';

export function terminalScreen(): string {
  const lines = [`<div class="tl p">&gt; ${esc(PROMPT)}</div>`,
    ...ops.flatMap(o => [`<div class="tl b">● ${esc(tool[o.kind]!(o))}</div>`, `<div class="tl r">  ⎿  ${esc(o.outcome ? (o.outcome === 'failed' ? '5 passed, 1 failed' : '6 passed') : result(o))}</div>`]),
    `<div class="tl t">● ${esc(closing)}</div>`];
  return `<div class="screen term" data-screen="cli"><div class="term-bar"><span class="dot-row"><i></i><i></i><i></i></span>shop — claude</div><div class="term-lines">${lines.join('')}</div></div>`;
}

export function appScreen(): string {
  const rows = ops.map(o => `<div class="ap-tool"><span class="ap-ic">${o.kind === 'edit' ? '✎' : o.kind === 'test' || o.kind === 'shell' ? '›_' : o.kind === 'search' ? '⌕' : '◇'}</span>${esc(tool[o.kind]!(o).replace(/\(.*$/, ''))} <b>${esc(o.target)}</b>${o.outcome ? `<em class="${o.outcome}">${o.outcome}</em>` : ''}<span class="ap-chev">›</span></div>`).join('');
  return `<div class="screen app" data-screen="app">
    <aside class="ap-side"><b>Agent</b><span class="on">Free orders reach checkout</span><span>Refund rounding</span><span>Release notes</span></aside>
    <main class="ap-chat"><div class="ap-user">${esc(PROMPT)}</div><div class="ap-tools"><div class="ap-group">Used ${ops.length} tools</div>${rows}</div><p class="ap-reply">${esc(closing)}</p><div class="ap-input">Reply…</div></main>
  </div>`;
}
