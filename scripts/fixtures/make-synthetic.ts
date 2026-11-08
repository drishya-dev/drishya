// Generates the synthetic demo fixtures: a small repository and two agent sessions working on
// it, written in each harness's real journal format. Every byte is invented; nothing here comes
// from a real session. Run: node scripts/fixtures/make-synthetic.ts
//
// The story: free orders (100% discount) are rejected at checkout. Claude Code finds the falsy
// guard, delegates a test search to a subagent, fixes the guard and reruns the suite; Codex then
// reviews the change, adds a test and flags the same pattern in payments.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffTexts } from '../../packages/projection/src/patch.ts';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const out = join(root, 'fixtures/synthetic');
const CWD = '/home/dev/shop';
const abs = (p: string) => `${CWD}/${p}`;

// ─── the repository ──────────────────────────────────────────────────────────────────────

const GUARD_BEFORE = `import type { Cart } from '../cart/types.ts';

export type CheckoutBlock = 'empty-cart' | 'missing-total';

/** Decides whether a cart may proceed to payment. */
export function checkoutBlock(cart: Cart): CheckoutBlock | undefined {
  if (cart.items.length === 0) return 'empty-cart';
  if (!cart.total) return 'missing-total';
  return undefined;
}

export function canCheckout(cart: Cart): boolean {
  return checkoutBlock(cart) === undefined;
}
`;
const GUARD_OLD_LINE = `  if (!cart.total) return 'missing-total';`;
const GUARD_NEW_LINES = `  // A total of 0 is a valid, fully discounted order; only a missing total blocks.
  if (cart.total == null) return 'missing-total';`;
const GUARD_AFTER = GUARD_BEFORE.replace(GUARD_OLD_LINE, GUARD_NEW_LINES);

const CHECKOUT_TEST_BEFORE = `import { describe, expect, it } from 'vitest';
import { canCheckout, checkoutBlock } from '../src/checkout/guard.ts';

const item = { sku: 'tee', price: 20, quantity: 1 };

describe('canCheckout', () => {
  it('blocks an empty cart', () => {
    expect(checkoutBlock({ id: 'c1', items: [] })).toBe('empty-cart');
  });

  it('allows a priced cart', () => {
    expect(canCheckout({ id: 'c2', items: [item], total: 20 })).toBe(true);
  });

  it('allows a free order', () => {
    expect(canCheckout({ id: 'c3', items: [item], total: 0, discountCode: 'LAUNCH100' })).toBe(true);
  });
});
`;
const ADDED_TEST = `
  it('still blocks a cart whose total is missing', () => {
    expect(checkoutBlock({ id: 'c4', items: [item], total: null })).toBe('missing-total');
  });`;
const CHECKOUT_TEST_AFTER = CHECKOUT_TEST_BEFORE.replace(
  `toBe(true);\n  });\n});\n`,
  `toBe(true);\n  });\n${ADDED_TEST}\n});\n`,
);

const DISCOUNT = `import type { Cart } from './types.ts';

const CODES: Record<string, number> = { WELCOME10: 0.1, FRIENDS: 0.25, LAUNCH100: 1 };

/** Fraction of the subtotal removed by a discount code. 1 means the order is free. */
export function discountRate(code: string | undefined): number {
  if (!code) return 0;
  return CODES[code.toUpperCase()] ?? 0;
}

export function applyDiscount(subtotal: number, cart: Cart): number {
  const rate = discountRate(cart.discountCode);
  return Math.max(0, Math.round(subtotal * (1 - rate) * 100) / 100);
}
`;

const CART_TEST = `import { describe, expect, it } from 'vitest';
import { computeTotal } from '../src/cart/total.ts';

describe('computeTotal', () => {
  it('sums line items', () => {
    expect(computeTotal({ id: 'a', items: [{ sku: 'x', price: 5, quantity: 2 }] })).toBe(10);
  });

  it('is zero for a fully discounted order', () => {
    expect(computeTotal({ id: 'b', items: [{ sku: 'x', price: 5, quantity: 1 }], discountCode: 'LAUNCH100' })).toBe(0);
  });

  it('is null for an empty cart', () => {
    expect(computeTotal({ id: 'c', items: [] })).toBeNull();
  });
});
`;

const CHARGE = `export interface Receipt {
  orderId: string;
  amount: number;
  captured: boolean;
}

export async function charge(orderId: string, amount: number): Promise<Receipt> {
  if (!amount) throw new Error('amount required');
  // Free orders are recorded without contacting the payment provider.
  return { orderId, amount, captured: amount > 0 };
}
`;

const WORKSPACE: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'shop', private: true, type: 'module', scripts: { test: 'vitest run' }, devDependencies: { vitest: '^4.1.12' } }, null, 2) + '\n',
  'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', strict: true, allowImportingTsExtensions: true, noEmit: true } }, null, 2) + '\n',
  'README.md': '# shop\n\nA tiny storefront used as Drishya\'s synthetic demo repository. Every file is invented.\n',
  'src/cart/types.ts': `export interface LineItem {
  sku: string;
  price: number;
  quantity: number;
}

export interface Cart {
  id: string;
  items: LineItem[];
  total?: number | null;
  discountCode?: string;
}
`,
  'src/cart/discount.ts': DISCOUNT,
  'src/cart/total.ts': `import type { Cart } from './types.ts';
import { applyDiscount } from './discount.ts';

export function subtotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** The amount to charge. Zero for a fully discounted order; null when the cart is empty. */
export function computeTotal(cart: Cart): number | null {
  if (cart.items.length === 0) return null;
  return applyDiscount(subtotal(cart), cart);
}
`,
  'src/checkout/guard.ts': GUARD_AFTER,
  'src/checkout/index.ts': `import type { Cart } from '../cart/types.ts';
import { computeTotal } from '../cart/total.ts';
import { charge } from '../payments/charge.ts';
import { checkoutBlock } from './guard.ts';

export async function checkout(cart: Cart) {
  const priced = { ...cart, total: computeTotal(cart) };
  const block = checkoutBlock(priced);
  if (block) return { ok: false as const, reason: block };
  const receipt = await charge(priced.id, priced.total ?? 0);
  return { ok: true as const, receipt };
}
`,
  'src/payments/charge.ts': CHARGE,
  'src/payments/refund.ts': `import type { Receipt } from './charge.ts';

export function refundable(receipt: Receipt): boolean {
  return receipt.captured && receipt.amount > 0;
}
`,
  'src/api/routes.ts': `import type { Cart } from '../cart/types.ts';
import { checkout } from '../checkout/index.ts';

export async function postCheckout(body: { cart: Cart }) {
  const result = await checkout(body.cart);
  return result.ok ? { status: 200, body: result.receipt } : { status: 422, body: { error: result.reason } };
}
`,
  'src/api/server.ts': `import { postCheckout } from './routes.ts';

export const routes = { 'POST /checkout': postCheckout };
`,
  'test/checkout.test.ts': CHECKOUT_TEST_AFTER,
  'test/cart.test.ts': CART_TEST,
};

// ─── helpers ─────────────────────────────────────────────────────────────────────────────

let clock = Date.parse('2026-09-21T10:00:00.000Z');
const at = (sec: number) => new Date((clock += sec * 1000)).toISOString();
let uid = 0;
const uuid = () => `00000000-0000-4000-8000-${(++uid).toString(16).padStart(12, '0')}`;
let tid = 0;
const toolId = () => `toolu_synthetic${(++tid).toString().padStart(4, '0')}`;
const numbered = (text: string, start = 1) =>
  text.replace(/\n$/, '').split('\n').map((l, i) => `${String(start + i).padStart(6)}\t${l}`).join('\n');
const lineCount = (text: string) => text.replace(/\n$/, '').split('\n').length;

const SESSION = 'c0ffee00-0000-4000-8000-000000000001';
const common = (extra: Record<string, unknown> = {}) => ({
  cwd: CWD,
  sessionId: SESSION,
  version: '2.1.0',
  gitBranch: 'fix/free-orders',
  userType: 'external',
  entrypoint: 'cli',
  isSidechain: false,
  ...extra,
});

function claudeWriter(sidechain?: string) {
  const lines: string[] = [];
  let parent: string | null = null;
  const base = () => (sidechain ? common({ isSidechain: true, agentId: sidechain }) : common());
  const push = (rec: Record<string, unknown>) => {
    lines.push(JSON.stringify(rec));
  };
  const api = {
    lines,
    user(text: string, t: number) {
      const id = uuid();
      push({ ...base(), parentUuid: parent, type: 'user', message: { role: 'user', content: text }, uuid: id, timestamp: at(t) });
      parent = id;
    },
    thinking(text: string, t: number) {
      const id = uuid();
      push({ ...base(), parentUuid: parent, type: 'assistant', message: { id: `msg_${id.slice(-6)}`, type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'thinking', thinking: text, signature: 'synthetic' }], stop_reason: null }, uuid: id, timestamp: at(t) });
      parent = id;
    },
    text(text: string, t: number) {
      const id = uuid();
      push({ ...base(), parentUuid: parent, type: 'assistant', message: { id: `msg_${id.slice(-6)}`, type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text }], stop_reason: 'end_turn' }, uuid: id, timestamp: at(t) });
      parent = id;
    },
    /** One assistant message with one or more tool calls (parallel when more than one). */
    calls(calls: { name: string; input: Record<string, unknown> }[], t: number): string[] {
      const ids = calls.map(() => toolId());
      const id = uuid();
      push({
        ...base(),
        parentUuid: parent,
        type: 'assistant',
        message: { id: `msg_${id.slice(-6)}`, type: 'message', role: 'assistant', model: 'claude-opus-5', content: calls.map((c, i) => ({ type: 'tool_use', id: ids[i], name: c.name, input: c.input })), stop_reason: 'tool_use' },
        uuid: id,
        timestamp: at(t),
      });
      parent = id;
      return ids;
    },
    result(toolUseId: string, content: unknown, toolUseResult: unknown, t: number, isError = false) {
      const id = uuid();
      push({ ...base(), parentUuid: parent, type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }] }, uuid: id, timestamp: at(t), toolUseResult });
      parent = id;
    },
    raw(rec: Record<string, unknown>) {
      push(rec);
    },
  };
  return api;
}

const readResult = (path: string, text: string) => ({ type: 'text', file: { filePath: abs(path), content: text.replace(/\n$/, ''), numLines: lineCount(text), startLine: 1, totalLines: lineCount(text) } });

const FAILING_RUN = `
> shop@ test
> vitest run


 RUN  v3.2.0 ${CWD}

 ✓ test/cart.test.ts (3 tests) 2ms
 ❯ test/checkout.test.ts (3 tests | 1 failed) 5ms
   ✓ canCheckout > blocks an empty cart 1ms
   ✓ canCheckout > allows a priced cart 0ms
   × canCheckout > allows a free order 3ms
     → expected false to be true // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/checkout.test.ts > canCheckout > allows a free order
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ test/checkout.test.ts:16:87
     14|
     15|   it('allows a free order', () => {
     16|     expect(canCheckout({ id: 'c3', items: [item], total: 0, discountCode: 'LAUNCH100' })).toBe(true);
       |                                                                                       ^
     17|   });
     18| });

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 5 passed (6)
   Start at  10:01:12
   Duration  412ms
`;

const PASSING_RUN = (n: number) => `
> shop@ test
> vitest run


 RUN  v3.2.0 ${CWD}

 ✓ test/cart.test.ts (3 tests) 2ms
 ✓ test/checkout.test.ts (${n - 3} tests) 2ms

 Test Files  2 passed (2)
      Tests  ${n} passed (${n})
   Start at  10:02:05
   Duration  388ms
`;

// ─── Claude Code session ─────────────────────────────────────────────────────────────────

const main = claudeWriter();
const sub = claudeWriter('explore01');

main.raw({ type: 'custom-title', customTitle: 'Free orders reach checkout', sessionId: SESSION });
main.user("Free orders don't reach checkout — a cart with the LAUNCH100 code (100% off) is rejected with missing-total, and the free-order test in test/checkout.test.ts fails. Find out why and fix it.", 0);
main.thinking("The rejection reason is 'missing-total', so the checkout guard is what decides this. I'll read the guard first, then look at where the total is computed.", 3);
let [id] = main.calls([{ name: 'Read', input: { file_path: abs('src/checkout/guard.ts') } }], 1);
main.result(id!, numbered(GUARD_BEFORE), readResult('src/checkout/guard.ts', GUARD_BEFORE), 1);

[id] = main.calls([{ name: 'Grep', input: { pattern: 'total', path: abs('src'), output_mode: 'content', '-n': true } }], 3);
const grepOut = [
  `${abs('src/cart/types.ts')}:10:  total?: number | null;`,
  `${abs('src/cart/total.ts')}:8:/** The amount to charge. Zero for a fully discounted order; null when the cart is empty. */`,
  `${abs('src/cart/total.ts')}:9:export function computeTotal(cart: Cart): number | null {`,
  `${abs('src/checkout/guard.ts')}:8:  if (!cart.total) return 'missing-total';`,
  `${abs('src/checkout/index.ts')}:7:  const priced = { ...cart, total: computeTotal(cart) };`,
  `${abs('src/checkout/index.ts')}:10:  const receipt = await charge(priced.id, priced.total ?? 0);`,
].join('\n');
main.result(id!, grepOut, { mode: 'content', numFiles: 4, filenames: [], content: grepOut, numLines: 6 }, 1);

[id] = main.calls([{ name: 'mcp__context7__get-library-docs', input: { context7CompatibleLibraryID: '/microsoft/typescript', topic: 'truthiness narrowing and nullish checks', tokens: 2000 } }], 4);
const docs = [
  { type: 'text', text: 'TypeScript handbook — Narrowing (excerpt, synthetic)\n\nTruthiness checks treat these values as falsy: 0, NaN, "" (empty string), 0n, null and undefined. A check such as `if (!value)` therefore rejects a legitimate 0.\n\nTo test only for a missing value, compare against null with loose equality: `value == null` is true for both null and undefined and false for 0.' },
];
main.result(id!, docs, docs, 3);

main.text("Found it. The guard rejects any **falsy** total: `!cart.total` is true for `0`, so a fully discounted order — whose total is correctly `0` — is reported as `missing-total`. The check should only reject a total that is actually absent (`null` or `undefined`). Before changing it I'll confirm how the total is produced and which tests cover zero totals.", 5);

const [taskId, readId] = main.calls(
  [
    { name: 'Task', input: { subagent_type: 'Explore', description: 'Find tests covering totals', prompt: 'Find every test that exercises cart totals or the checkout guard, and report which of them cover a zero total.' } },
    { name: 'Read', input: { file_path: abs('src/cart/discount.ts') } },
  ],
  3,
);
main.result(readId!, numbered(DISCOUNT), readResult('src/cart/discount.ts', DISCOUNT), 1);

// The subagent works in parallel, in its own journal.
sub.user('Find every test that exercises cart totals or the checkout guard, and report which of them cover a zero total.', 1);
let [sid] = sub.calls([{ name: 'Glob', input: { pattern: 'test/**/*.test.ts', path: CWD } }], 2);
sub.result(sid!, `${abs('test/cart.test.ts')}\n${abs('test/checkout.test.ts')}`, { filenames: [abs('test/cart.test.ts'), abs('test/checkout.test.ts')], durationMs: 9, numFiles: 2, truncated: false }, 1);
[sid] = sub.calls([{ name: 'Read', input: { file_path: abs('test/checkout.test.ts') } }], 2);
sub.result(sid!, numbered(CHECKOUT_TEST_BEFORE), readResult('test/checkout.test.ts', CHECKOUT_TEST_BEFORE), 1);
[sid] = sub.calls([{ name: 'Read', input: { file_path: abs('test/cart.test.ts') } }], 2);
sub.result(sid!, numbered(CART_TEST), readResult('test/cart.test.ts', CART_TEST), 1);
const report = 'Two test files cover totals.\n\n- `test/cart.test.ts` — `computeTotal` returns 0 for a LAUNCH100 cart ("is zero for a fully discounted order"). This passes.\n- `test/checkout.test.ts` — "allows a free order" passes a cart with `total: 0` to `canCheckout` and expects `true`. This is the only test of the guard with a zero total.\n\nNo test covers a cart whose total is missing (`null`).';
sub.text(report, 4);

main.result(taskId!, [{ type: 'text', text: report }], { status: 'completed', prompt: 'Find every test that exercises cart totals or the checkout guard, and report which of them cover a zero total.', agentId: 'explore01', content: [{ type: 'text', text: report }], totalDurationMs: 14200, totalTokens: 8812, totalToolUseCount: 3 }, 1);

main.thinking('discountRate returns 1 for LAUNCH100, so computeTotal correctly yields 0 — the total is right and the guard is wrong. Run the suite first to see the failure as it is.', 3);
[id] = main.calls([{ name: 'Bash', input: { command: 'npm test', description: 'Run the test suite' } }], 2);
main.result(id!, `Exit code 1\n${FAILING_RUN}`, `Error: Exit code 1\n${FAILING_RUN}`, 4, true);

[id] = main.calls([{ name: 'Edit', input: { file_path: abs('src/checkout/guard.ts'), old_string: GUARD_OLD_LINE, new_string: GUARD_NEW_LINES } }], 6);
main.result(id!, `The file ${abs('src/checkout/guard.ts')} has been updated successfully.`, { filePath: abs('src/checkout/guard.ts'), oldString: GUARD_OLD_LINE, newString: GUARD_NEW_LINES, originalFile: GUARD_BEFORE, structuredPatch: diffTexts(GUARD_BEFORE, GUARD_AFTER, 3), userModified: false, replaceAll: false }, 1);

[id] = main.calls([{ name: 'Bash', input: { command: 'npm test', description: 'Rerun the test suite' } }], 3);
main.result(id!, PASSING_RUN(6), { stdout: PASSING_RUN(6), stderr: '', interrupted: false, isImage: false }, 3);

[id] = main.calls([{ name: 'mcp__github__search_code', input: { q: '"if (!amount)" repo:acme/shop' } }], 3);
const gh = [{ type: 'text', text: JSON.stringify({ total_count: 1, items: [{ path: 'src/payments/charge.ts', repository: 'acme/shop', text_matches: [{ fragment: "  if (!amount) throw new Error('amount required');" }] }] }, null, 2) }];
main.result(id!, gh, gh, 2);

main.text("Fixed. `checkoutBlock` now blocks only a **missing** total (`cart.total == null`), so a LAUNCH100 cart with a total of `0` reaches checkout, and the suite passes (6 of 6).\n\nOne thing I did not change: `charge()` in `src/payments/charge.ts` uses the same `!amount` check and will throw for a free order once it gets there. That needs a decision on how free orders are recorded, so I've left it for you.", 4);

// ─── Codex review ────────────────────────────────────────────────────────────────────────

clock = Date.parse('2026-09-21T10:20:00.000Z');
const codex: string[] = [];
const cx = (type: string, payload: Record<string, unknown>, t: number) => codex.push(JSON.stringify({ timestamp: at(t), type, payload }));
let call = 0;
const shell = (command: string, output: string, exit = 0, t = 2) => {
  const cid = `call_synthetic${++call}`;
  cx('response_item', { type: 'function_call', name: 'shell_command', arguments: JSON.stringify({ command, workdir: CWD }), call_id: cid }, t);
  cx('response_item', { type: 'function_call_output', call_id: cid, output: `Exit code: ${exit}\nWall time: 0.4 seconds\nOutput:\n${output}` }, 1);
};

cx('session_meta', { id: '0199c0de-0000-7000-8000-000000000001', timestamp: '2026-09-21T10:20:00.000Z', cwd: CWD, originator: 'codex_cli_rs', cli_version: '0.50.0', model_provider: 'openai', git: { branch: 'fix/free-orders', commit_hash: '5ab1e0000000000000000000000000000000c0de', repository_url: 'https://example.invalid/acme/shop.git' } }, 0);
cx('turn_context', { cwd: CWD, approval_policy: 'on-request', sandbox_policy: { type: 'workspace-write' }, model: 'gpt-5-codex', effort: 'medium', summary: 'auto' }, 0);
cx('event_msg', { type: 'task_started', turn_id: 'turn-1', model_context_window: 272000 }, 0);
cx('response_item', { type: 'message', role: 'developer', content: [{ type: 'input_text', text: '<permissions instructions>synthetic</permissions instructions>' }] }, 0);
cx('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: `<environment_context>\n  <cwd>${CWD}</cwd>\n</environment_context>` }] }, 0);
cx('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Review the uncommitted change to the checkout guard. Is it correct, and is it tested?' }] }, 1);
cx('response_item', { type: 'reasoning', summary: [{ type: 'summary_text', text: "**Reviewing the guard change**\n\nI'll read the diff, then the guard in context, then run the tests." }], content: null, encrypted_content: 'gAAAAAsynthetic-encrypted-reasoning-is-never-decoded' }, 3);
const diff = ['diff --git a/src/checkout/guard.ts b/src/checkout/guard.ts', '--- a/src/checkout/guard.ts', '+++ b/src/checkout/guard.ts', ...diffTexts(GUARD_BEFORE, GUARD_AFTER, 3)!.flatMap((h) => [`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`, ...h.lines])].join('\n');
shell('git diff', diff + '\n');
shell("sed -n '1,20p' src/checkout/guard.ts", GUARD_AFTER);
cx('response_item', { type: 'reasoning', summary: [{ type: 'summary_text', text: '**Following the zero total past the guard**\n\nThe guard now accepts 0, but checkout passes the total on to charge(). Checking how payments treat it.' }], content: null, encrypted_content: 'gAAAAAsynthetic' }, 4);
shell('rg -n "amount" src/payments', `src/payments/charge.ts:3:  amount: number;\nsrc/payments/charge.ts:7:export async function charge(orderId: string, amount: number): Promise<Receipt> {\nsrc/payments/charge.ts:8:  if (!amount) throw new Error('amount required');\nsrc/payments/charge.ts:10:  return { orderId, amount, captured: amount > 0 };\nsrc/payments/refund.ts:4:  return receipt.captured && receipt.amount > 0;\n`);
const patch = `*** Begin Patch
*** Update File: test/checkout.test.ts
@@
   it('allows a free order', () => {
     expect(canCheckout({ id: 'c3', items: [item], total: 0, discountCode: 'LAUNCH100' })).toBe(true);
   });
+
+  it('still blocks a cart whose total is missing', () => {
+    expect(checkoutBlock({ id: 'c4', items: [item], total: null })).toBe('missing-total');
+  });
 });
*** End Patch`;
cx('response_item', { type: 'custom_tool_call', status: 'completed', call_id: 'call_synthetic_patch', name: 'apply_patch', input: patch }, 5);
cx('response_item', { type: 'custom_tool_call_output', call_id: 'call_synthetic_patch', output: JSON.stringify({ output: 'Success. Updated the following files:\nM test/checkout.test.ts\n', metadata: { exit_code: 0, duration_seconds: 0.0 } }) }, 1);
shell('npm test', PASSING_RUN(7), 0, 2);
cx('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: "The guard change is correct: `== null` rejects only a missing total, so a total of 0 passes, and the free-order test now passes. I added a test that a missing total still blocks checkout (7 of 7 pass).\n\nOne real risk remains: checkout passes the 0 total to `charge()`, which throws on `!amount` — so a free order will clear the guard and then fail at payment. That should be fixed before this ships." }] }, 6);
cx('event_msg', { type: 'task_complete', turn_id: 'turn-1', last_agent_message: 'The guard change is correct…' }, 0);

// ─── usage and cost (DATA-2) ─────────────────────────────────────────────────────────────
// Separate small sessions, so the demo story and its goldens stay unchanged. Shapes follow the
// harnesses' real records (probed for structure only); every number is invented.

const usageAt = (() => { let c = Date.parse('2026-10-20T09:00:00.000Z'); return (sec: number) => new Date((c += sec * 1000)).toISOString(); })();
const codexUsage: string[] = [];
const ux = (type: string, payload: Record<string, unknown>, t: number) => codexUsage.push(JSON.stringify({ timestamp: usageAt(t), type, payload }));
const tokens = (input: number, cached: number, output: number, reasoning: number) => ({ input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: 0, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output });
// Account fields (credits balance, limit id) are present in real records and must never be stored.
const limits = (used: number, secondary: boolean) => ({ limit_id: 'synthetic-limit-id', limit_name: null, individual_limit: null, plan_type: 'plus', primary: { used_percent: used, window_minutes: 300, resets_at: 1792486800 }, secondary: secondary ? { used_percent: 12.5, window_minutes: 10080, resets_at: 1792900000 } : null, credits: { has_credits: true, unlimited: false, balance: '17.25' }, rate_limit_reached_type: null, spend_control_reached: null });
ux('session_meta', { id: '0199c0de-0000-7000-8000-0000000000aa', timestamp: '2026-10-20T09:00:00.000Z', cwd: CWD, originator: 'codex_cli_rs', cli_version: '0.60.0', model_provider: 'openai', git: { branch: 'main' } }, 0);
ux('turn_context', { cwd: CWD, approval_policy: 'on-request', sandbox_policy: { type: 'workspace-write' }, model: 'gpt-5-codex', effort: 'medium', summary: 'auto' }, 0);
ux('event_msg', { type: 'task_started', turn_id: 'turn-u1', model_context_window: 272000 }, 0);
ux('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Run the tests and tell me if anything fails.' }] }, 1);
ux('event_msg', { type: 'token_count', info: null, rate_limits: limits(3.0, true) }, 1);
ux('response_item', { type: 'function_call', name: 'shell_command', arguments: JSON.stringify({ command: 'npm test', workdir: CWD }), call_id: 'call_usage1' }, 2);
ux('event_msg', { type: 'token_count', info: { total_token_usage: tokens(9200, 4100, 310, 120), last_token_usage: tokens(9200, 4100, 310, 120), model_context_window: 272000 }, rate_limits: limits(4.0, true) }, 0);
ux('response_item', { type: 'function_call_output', call_id: 'call_usage1', output: `Exit code: 0\nWall time: 1.2 seconds\nOutput:\n${PASSING_RUN(6)}` }, 2);
ux('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'All 6 tests pass.' }] }, 2);
ux('event_msg', { type: 'token_count', info: { total_token_usage: tokens(18900, 12000, 420, 160), last_token_usage: tokens(9700, 7900, 110, 40), model_context_window: 272000 }, rate_limits: limits(4.5, true) }, 0);
ux('event_msg', { type: 'task_complete', turn_id: 'turn-u1', last_agent_message: 'All 6 tests pass.', duration_ms: 7100, time_to_first_token_ms: 900 }, 0);
ux('event_msg', { type: 'task_started', turn_id: 'turn-u2', model_context_window: 272000 }, 5);
ux('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Thanks, that is all.' }] }, 1);
ux('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'You are welcome.' }] }, 2);
ux('event_msg', { type: 'token_count', info: { total_token_usage: tokens(28800, 21000, 450, 160), last_token_usage: tokens(9900, 9000, 30, 0), model_context_window: 272000 }, rate_limits: limits(5.0, false) }, 0);
ux('event_msg', { type: 'task_complete', turn_id: 'turn-u2', last_agent_message: 'You are welcome.', duration_ms: 2300, time_to_first_token_ms: 700 }, 0);

const claudeUsage: string[] = [];
let usageUid = 0;
const uuidU = () => `00000000-0000-4000-9000-${(++usageUid).toString(16).padStart(12, '0')}`;
const claudeBase = { cwd: CWD, sessionId: 'c0ffee00-0000-4000-8000-0000000000bb', version: '2.1.0', gitBranch: 'main', userType: 'external', entrypoint: 'cli', isSidechain: false };
// Claude repeats the same usage on every line of one message (one line per content block).
const msgUsage = (input: number, cacheRead: number, cacheCreate: number, output: number) => ({ input_tokens: input, cache_creation_input_tokens: cacheCreate, cache_read_input_tokens: cacheRead, output_tokens: output, cache_creation: { ephemeral_5m_input_tokens: cacheCreate, ephemeral_1h_input_tokens: 0 }, server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 }, service_tier: 'standard', speed: 'standard', inference_geo: 'us', iterations: [{ type: 'message', input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheCreate, cache_creation: { ephemeral_5m_input_tokens: cacheCreate, ephemeral_1h_input_tokens: 0 } }] });
let uparent: string | null = null;
const cu = (rec: Record<string, unknown>, t: number) => { const id = uuidU(); claudeUsage.push(JSON.stringify({ ...claudeBase, parentUuid: uparent, ...rec, uuid: id, timestamp: usageAt(t) })); uparent = id; };
const assistantLine = (msgId: string, block: Record<string, unknown>, usage: Record<string, unknown>, stop: string | null, t: number) => cu({ type: 'assistant', message: { id: msgId, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [block], stop_reason: stop, usage } }, t);
// cost-state records carry no timestamp in real journals; they are session-cumulative.
const costState = (usd: number, added: number, removed: number, unknown = false) => claudeUsage.push(JSON.stringify({ type: 'cost-state', totalCostUSD: usd, totalAPIDuration: 4100, totalAPIDurationWithoutRetries: 4100, totalDuration: 9800, totalToolDuration: 1300, totalLinesAdded: added, totalLinesRemoved: removed, hasUnknownModelCost: unknown, startTime: 1792486800000, modelUsage: { 'claude-opus-5-5': { inputTokens: 52, outputTokens: 640, cacheReadInputTokens: 38000, cacheCreationInputTokens: 9100, thinkingTokens: 120, webSearchRequests: 0, costUSD: usd } } }));
cu({ type: 'user', message: { role: 'user', content: 'Run the tests and tell me if anything fails.' } }, 0);
const u1 = msgUsage(12, 18000, 4600, 210);
assistantLine('msg_usage01', { type: 'thinking', thinking: 'I will run the suite.', signature: 'synthetic' }, u1, null, 2);
assistantLine('msg_usage01', { type: 'tool_use', id: 'toolu_usage0001', name: 'Bash', input: { command: 'npm test', description: 'Run the test suite' } }, u1, 'tool_use', 0);
cu({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_usage0001', content: PASSING_RUN(6), is_error: false }] }, toolUseResult: { stdout: PASSING_RUN(6), stderr: '', interrupted: false, isImage: false } }, 2);
costState(0.0412, 0, 0);
const u2 = msgUsage(40, 20000, 4500, 430);
assistantLine('msg_usage02', { type: 'text', text: 'All 6 tests pass.' }, u2, 'end_turn', 2);
costState(0.0871, 3, 1);

// ─── write ───────────────────────────────────────────────────────────────────────────────

function writeTypedItems() {
  const folder = join(out, 'codex-items');
  mkdirSync(folder, { recursive: true });
  const stamp = (n: number) => new Date(Date.UTC(2026, 9, 20, 10, 0, n)).toISOString();
  const record = (type: string, payload: unknown, n = 0) => ({ timestamp: stamp(n), type, payload });
  const meta = record('session_meta', { id: 'synthetic-typed-items', cwd: CWD, cli_version: '0.162.0-alpha.2' });
  const call = (id: string, n: number, source = 'text(await tools.exec_command({cmd:"pnpm test"}));', name = 'exec') => record('response_item', { type: 'function_call', name, call_id: id, arguments: JSON.stringify({ code: source }) }, n);
  const result = (id: string, n: number) => record('response_item', { type: 'function_call_output', call_id: id, output: 'Script completed' }, n);
  const item = (value: unknown, n: number) => record('event_msg', { type: 'item_completed', thread_id: 'synthetic-thread', turn_id: 'synthetic-turn', item: value }, n);
  const command = (id: string, cmd = 'pnpm test', exit = 0) => ({ type: 'CommandExecution', id, command: ['pwsh', '-Command', cmd], cwd: CWD, parsed_cmd: [{ type: 'unknown', cmd }], status: exit ? 'failed' : 'completed', exit_code: exit, duration: { secs: 1, nanos: 250000000 }, aggregated_output: 'Tests  441 passed (441)\n' });
  const writeItems = (name: string, rows: unknown[]) => writeFileSync(join(folder, `${name}.jsonl`), [meta, ...rows].map(row => JSON.stringify(row)).join('\n') + '\n');
  writeItems('one-command', [call('one', 1), item(command('cmd-one'), 2), result('one', 3)]);
  writeItems('three-commands', [call('three', 1), item(command('cmd-a', 'pnpm test'), 2), item(command('cmd-b', 'node --test'), 3), item(command('cmd-c', 'printf synthetic', 2), 4), result('three', 5)]);
  const patch = '*** Begin Patch\n*** Update File: src/a.ts\n@@\n-old\n+new\n*** End Patch';
  writeItems('file-change', [call('patch', 1, `text(await tools.apply_patch(${JSON.stringify(patch)}));`), item({ type: 'FileChange', id: 'file-one', status: 'completed', changes: { 'src/a.ts': { type: 'update', unified_diff: '@@ -1 +1 @@\n-old\n+new', move_path: null } }, stdout: 'Applied', stderr: '' }, 2), result('patch', 3)]);
  const mixedPatch = patch.replace('*** End Patch', '*** Update File: src/b.ts\n@@\n-old\n+new\n*** End Patch');
  writeItems('mixed-patch-command', [call('mixed', 1, `text(await tools.apply_patch(${JSON.stringify(mixedPatch)})); text(await tools.exec_command({cmd:"pnpm test"}));`), item(command('mixed-command'), 2), item({ type: 'FileChange', id: 'mixed-files', status: 'completed', changes: { 'src/a.ts': { type: 'update', unified_diff: '@@ -1 +1 @@\n-old\n+new' }, 'src/b.ts': { type: 'update', unified_diff: '@@ -1 +1 @@\n-old\n+new' } } }, 3), result('mixed', 4)]);
  writeItems('standalone', [item(command('orphan'), 1)]);
  writeItems('ambiguous', [call('left', 1), call('right', 2), item(command('ambiguous'), 3), result('left', 4), result('right', 5)]);
  writeItems('mcp-call', [record('response_item', { type: 'function_call', name: 'mcp__docs__search', call_id: 'mcp-id', arguments: '{"query":"synthetic lookup"}' }, 1), item({ type: 'McpToolCall', id: 'mcp-id', server: 'docs', tool: 'search', arguments: { query: 'synthetic lookup' }, status: 'completed', readOnlyHint: true, duration: { secs: 0, nanos: 500000000 }, result: { content: [{ type: 'text', text: 'Synthetic documentation' }], isError: false } }, 2), result('mcp-id', 3)]);
  writeItems('subagent', [item({ type: 'SubAgentActivity', id: 'agent-item', kind: 'spawn', agent_thread_id: 'child-thread', agent_path: '/root/review', model: 'synthetic-model', reasoning_effort: 'high', agent_nickname: 'Reviewer' }, 1)]);
  writeItems('image-view', [item({ type: 'ImageView', id: 'image-one', path: '/home/dev/shop/preview.png' }, 1)]);
  writeItems('web-search', [item({ type: 'Extension', kind: 'web.search', id: 'web-one', query: 'synthetic docs', results: [{ title: 'Documentation', url: 'https://example.invalid/docs', domain: 'example.invalid', snippet: 'Synthetic result' }] }, 1)]);
  writeItems('image-generation', [item({ type: 'Extension', kind: 'image.generation', id: 'generated-one', savedPath: '/home/dev/shop/generated.png', revisedPrompt: 'Synthetic generated image reference' }, 1)]);
  writeItems('unknown', [item({ type: 'FutureItem', id: 'future', privateContent: 'MUST NOT PERSIST' }, 1)]);
}
if (process.argv.includes('--typed-items-only')) { writeTypedItems(); process.exit(0); }
rmSync(out, { recursive: true, force: true });
writeTypedItems();
const write = (p: string, s: string) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, s);
};
for (const [p, s] of Object.entries(WORKSPACE)) write(join(out, 'workspace/shop', p), s);
write(join(out, 'claude/checkout-fix.jsonl'), main.lines.join('\n') + '\n');
write(join(out, 'claude/checkout-fix/subagents/agent-explore01.jsonl'), sub.lines.join('\n') + '\n');
write(join(out, 'codex/rollout-checkout-review.jsonl'), codex.join('\n') + '\n');
write(join(out, 'usage/codex-rollout-usage.jsonl'), codexUsage.join('\n') + '\n');
write(join(out, 'usage/claude-usage.jsonl'), claudeUsage.join('\n') + '\n');
write(
  join(out, 'README.md'),
  `# Synthetic fixtures

**Every byte here is invented.** Nothing is copied from a real agent session. Generated by
\`node scripts/fixtures/make-synthetic.ts\` — edit the generator, not these files.

| Path | Format |
|---|---|
| \`claude/checkout-fix.jsonl\` | Claude Code transcript (\`~/.claude/projects/<slug>/<session>.jsonl\`) |
| \`claude/checkout-fix/subagents/agent-explore01.jsonl\` | Claude Code subagent transcript |
| \`codex/rollout-checkout-review.jsonl\` | Codex rollout (\`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl\`) |
| \`usage/codex-rollout-usage.jsonl\` | Codex rollout with \`token_count\` usage, rate limits (including account fields that must be dropped) and two turns (DATA-2) |
| \`usage/claude-usage.jsonl\` | Claude Code transcript with per-message \`usage\` repeated across the lines of one message, and \`cost-state\` records without timestamps (DATA-2) |
| \`workspace/shop/\` | The repository both sessions work in, in its final state |

The sessions record \`cwd\` as \`${CWD}\`; importers map the repository with \`--workspace fixtures/synthetic/workspace/shop\`.
`,
);
console.log(`Wrote synthetic fixtures to ${out}`);
