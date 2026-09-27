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
  'package.json': JSON.stringify({ name: 'shop', private: true, type: 'module', scripts: { test: 'vitest run' }, devDependencies: { vitest: '^3.2.0' } }, null, 2) + '\n',
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

// ─── write ───────────────────────────────────────────────────────────────────────────────

rmSync(out, { recursive: true, force: true });
const write = (p: string, s: string) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, s);
};
for (const [p, s] of Object.entries(WORKSPACE)) write(join(out, 'workspace/shop', p), s);
write(join(out, 'claude/checkout-fix.jsonl'), main.lines.join('\n') + '\n');
write(join(out, 'claude/checkout-fix/subagents/agent-explore01.jsonl'), sub.lines.join('\n') + '\n');
write(join(out, 'codex/rollout-checkout-review.jsonl'), codex.join('\n') + '\n');
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
| \`workspace/shop/\` | The repository both sessions work in, in its final state |

The sessions record \`cwd\` as \`${CWD}\`; importers map the repository with \`--workspace fixtures/synthetic/workspace/shop\`.
`,
);
console.log(`Wrote synthetic fixtures to ${out}`);
