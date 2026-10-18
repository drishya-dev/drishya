import type { Operation, Projection } from '@drishya/contracts';
export const REVIEW_VERSION = 'review-1';
export const COMMAND_LIMIT = 256 * 1024;
export interface CommandContext {
    text: string;
    complete: boolean;
    exitCode?: number;
    cwd?: string;
    cwdBasis: 'captured' | 'session root' | 'unknown';
    cwdScope?: string;
    durationMs?: number;
    durationBasis: 'captured' | 'derived interval' | 'unknown';
}
export interface CommandRow extends Omit<CommandContext, 'text'> {
    id: string;
    agentId: string;
    kind: 'shell' | 'test';
    preview: string;
    status: 'passed' | 'failed' | 'unknown';
    exitCode?: number;
    outputArtifactId?: string;
    observationIds: string[];
    sequence: number;
    findings: number;
}
export interface ReviewRule {
    id: string;
    target: 'command' | 'path' | 'patch';
    pattern: string;
    mode: 'literal' | 'glob';
}
export interface ReviewFinding {
    id: string;
    operationId: string;
    observationIds: string[];
    rule: string;
    version: string;
    target: ReviewRule['target'];
    text: string;
    start: number;
    end: number;
    note: string;
}
export interface RepeatSignal {
    id: string;
    label: string;
    count: number;
    operationIds: string[];
    turnId?: string;
}
export interface TurnSummary {
    id: string;
    agentId: string;
    prompt: string;
    promptStep?: number;
    observationIds: string[];
    operations: number;
    kinds: Record<string, number>;
    files: number;
    tests: number;
    failures: number;
    lastFailure?: string;
    findings: number;
    repeats: number;
    intervalMs?: number;
}
export interface ReviewIndex {
    commands: CommandRow[];
    findings: ReviewFinding[];
    repeats: RepeatSignal[];
    turns: TurnSummary[];
}
export interface ReviewQuery {
    section: keyof ReviewIndex;
    start?: number;
    count?: number;
    status?: CommandRow['status'];
    kind?: 'shell' | 'test';
    agent?: string;
    q?: string;
    sort?: 'recorded' | 'failures';
    rules?: ReviewRule[];
    repeatId?: string;
}
export interface ReviewPage {
    section: keyof ReviewIndex;
    total: number;
    allCount: number;
    start: number;
    items: (CommandRow | ReviewFinding | RepeatSignal | TurnSummary)[];
    version: string;
    revision: string;
    occurrences?: {
        operationId: string;
        title: string;
    }[];
}
/** Imported JSON is data only: bounded literal/glob patterns, never executable regex. */
export function reviewRules(input: unknown): ReviewRule[] {
    if (!Array.isArray(input) || input.length > 32 || JSON.stringify(input).length > 8192)
        throw new Error('Use a JSON array of up to 32 rules and 8 KiB.');
    const ids = new Set<string>();
    return input.map(value => {
        if (!value || typeof value !== 'object' || Object.keys(value).some(key => !['id', 'target', 'pattern', 'mode'].includes(key)) || typeof value.id !== 'string' || !/^[a-z0-9-]{1,48}$/.test(value.id) || ids.has(value.id) || !['command', 'path', 'patch'].includes(value.target) || !['literal', 'glob'].includes(value.mode) || typeof value.pattern !== 'string' || !value.pattern || value.pattern.length > 160 || /[\r\n\0]/.test(value.pattern))
            throw new Error('Invalid review rule: unique id, target, mode and a 1–160 character pattern are required.');
        ids.add(value.id);
        return { id: value.id, target: value.target, pattern: value.pattern, mode: value.mode };
    });
}
function glob(text: string, pattern: string) {
    let i = 0, j = 0, star = -1, mark = 0;
    while (i < text.length) {
        if (pattern[j] === '?' || pattern[j] === text[i]) {
            i++;
            j++;
        }
        else if (pattern[j] === '*') {
            star = j++;
            mark = i;
        }
        else if (star >= 0) {
            j = star + 1;
            i = ++mark;
        }
        else
            return false;
    }
    while (pattern[j] === '*')
        j++;
    return j === pattern.length;
}
/** Per-agent prompt boundaries are timeline indices; late results stay with their call. */
export function buildReviewIndex(projection: Projection, inspect: (op: Operation) => CommandContext, fingerprint: (text: string) => string, rules: ReviewRule[] = [], options = { cutoff: projection.timeline.length, repeatMinimum: 3 }): ReviewIndex {
    const commands: CommandRow[] = [], findings: ReviewFinding[] = [], repeats: RepeatSignal[] = [], turns: TurnSummary[] = [];
    const proseById = new Map(projection.prose.map(item => [item.id, item]));
    const byAgent = new Map<string, TurnSummary[]>(), assignment = new Map<string, TurnSummary>(), files = new Map<string, Set<string>>();
    projection.timeline.forEach((item, index) => {
        if (item.type !== 'turn' || index >= options.cutoff)
            return;
        const turn: TurnSummary = { id: item.id, agentId: item.agentId, prompt: item.prompt?.slice(0, 1000) ?? 'Prompt text unavailable', promptStep: index + 1, observationIds: proseById.get(item.id)?.observationIds ?? [], operations: 0, kinds: {}, files: 0, tests: 0, failures: 0, findings: 0, repeats: 0 };
        const prior = byAgent.get(item.agentId) ?? [], before = prior.at(-1);
        if (before) {
            const earlier = projection.timeline[(before.promptStep ?? 1) - 1]?.time;
            const duration = Date.parse(item.time ?? '') - Date.parse(earlier ?? '');
            if (Number.isFinite(duration) && duration >= 0)
                before.intervalMs = duration;
        }
        prior.push(turn);
        byAgent.set(item.agentId, prior);
        turns.push(turn);
    });
    const unassigned: TurnSummary = { id: 'unassigned', agentId: '', prompt: 'Unassigned · no earlier prompt captured for this agent', observationIds: [], operations: 0, kinds: {}, files: 0, tests: 0, failures: 0, findings: 0, repeats: 0 };
    const commandGroups = new Map<string, {
        label: string;
        ids: string[];
    }>(), writeGroups = new Map<string, {
        path: string;
        ids: string[];
        turn: TurnSummary;
    }>();
    const addFinding = (op: Operation, rule: string, target: ReviewRule['target'], text: string, start: number, end: number, note: string) => {
        const before = Math.max(0, start - 100), after = Math.min(text.length, end + 100);
        findings.push({ id: `${op.id}/${rule}/${target}/${fingerprint(`${text}/${start}/${end}`)}`, operationId: op.id, observationIds: op.observationIds, rule, version: rule.startsWith('local-') ? `${REVIEW_VERSION}/${fingerprint(JSON.stringify(rules.find(item => `local-${item.id}` === rule)))}` : REVIEW_VERSION, target, text: text.slice(before, after), start: start - before, end: end - before, note });
    };
    for (const op of projection.operations) {
        if (op.startSequence >= options.cutoff)
            continue;
        const candidates = byAgent.get(op.agentId) ?? [];
        // Binary search avoids scanning every earlier prompt for every operation.
        let lo = 0, hi = candidates.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if ((candidates[mid]!.promptStep ?? 1) - 1 <= op.startSequence)
                lo = mid + 1;
            else
                hi = mid;
        }
        const turn = candidates[lo - 1] ?? unassigned;
        assignment.set(op.id, turn);
        turn.operations++;
        turn.kinds[op.kind] = (turn.kinds[op.kind] ?? 0) + 1;
        if (op.kind === 'test')
            turn.tests++;
        if (op.status === 'error') {
            turn.failures++;
            turn.lastFailure = op.id;
        }
        const changed = files.get(turn.id) ?? new Set<string>();
        for (const path of op.paths.filter(p => p.role === 'write')) {
            changed.add(path.path);
            if (turn !== unassigned) {
                const key = JSON.stringify([turn.id, op.agentId, path.path]), group = writeGroups.get(key) ?? { path: path.path, ids: [], turn };
                group.ids.push(op.id);
                writeGroups.set(key, group);
            }
            for (const [rule, pattern] of [['ci-path', /(^|\/)(\.github\/workflows|\.gitlab-ci|azure-pipelines)/i], ['lockfile', /(^|\/)([^/]*lock[^/]*|npm-shrinkwrap\.json)$/i], ['auth-path', /(^|\/)(auth[^/]*|[^/]*secret[^/]*|\.env[^/]*)(\/|$)/i], ['migration-path', /(^|\/)migrations?(\/|$)/i]] as const) {
                const hit = pattern.exec(path.path);
                if (hit)
                    addFinding(op, rule, 'path', path.path, hit.index, hit.index + hit[0].length, 'Captured write target; not proof of a completed disk change.');
            }
        }
        files.set(turn.id, changed);
        let command: CommandContext | undefined;
        if (op.detail.kind === 'shell' || op.detail.kind === 'test') {
            command = inspect(op);
            const exit = command.exitCode;
            const status = typeof exit === 'number' ? (exit === 0 ? 'passed' : 'failed') : op.status === 'error' ? 'failed' : 'unknown';
            commands.push({ id: op.id, agentId: op.agentId, kind: op.detail.kind, preview: command.text.slice(0, 1000), complete: command.complete, cwd: command.cwd, cwdBasis: command.cwdBasis, cwdScope: command.cwdScope, durationMs: command.durationMs, durationBasis: command.durationBasis, status, exitCode: typeof exit === 'number' ? exit : undefined, outputArtifactId: op.detail.outputArtifactId, observationIds: op.observationIds, sequence: op.startSequence, findings: 0 });
            for (const [rule, pattern] of [['force-push', /\bgit\s+push\b[^\r\n]*(?:--force(?:-with-lease)?\b|\s-f(?:\s|$))/i], ['hard-reset', /\bgit\s+reset\s+--hard\b/i], ['recursive-delete', /\b(?:rm\s+-(?:[a-z]*r[a-z]*)\b|Remove-Item\b[^\r\n]*-Recurse\b|rmdir\s+\/s\b)/i], ['package-publish', /\b(?:npm|pnpm|yarn)\s+publish\b/i]] as const) {
                const hit = pattern.exec(command.text);
                if (hit)
                    addFinding(op, rule, 'command', command.text, hit.index, hit.index + Math.min(hit[0].length, 300), 'Literal command-text match; quoting, aliases or wrappers may change its meaning.');
            }
            if (command.complete && status === 'failed') {
                const key = JSON.stringify([op.agentId, command.cwdBasis, command.cwd ?? '', command.cwdScope ?? '', fingerprint(command.text)]), group = commandGroups.get(key) ?? { label: command.text.slice(0, 120), ids: [] };
                group.ids.push(op.id);
                commandGroups.set(key, group);
            }
        }
        const patches = op.detail.kind === 'edit' ? op.detail.hunks.flatMap(h => h.lines).filter(line => /^[+-]/.test(line)).join('\n') : '';
        const skip = /\.(?:skip|only)\b|\bxit\b|\bit\.todo\b|@pytest\.mark\.skip\b/.exec(patches);
        if (skip)
            addFinding(op, 'test-marker', 'patch', patches, skip.index, skip.index + skip[0].length, 'Added/removed patch text matched a test marker; not an assertion about test execution.');
        for (const rule of rules) {
            const texts = rule.target === 'command' ? [command?.text ?? ''] : rule.target === 'path' ? op.paths.map(path => path.path) : [patches];
            for (const text of texts) {
                if (!text)
                    continue;
                const start = rule.mode === 'literal' ? text.indexOf(rule.pattern) : glob(text, `*${rule.pattern}*`) ? 0 : -1;
                if (start >= 0)
                    addFinding(op, `local-${rule.id}`, rule.target, text, start, Math.min(text.length, start + (rule.mode === 'literal' ? rule.pattern.length : 200)), 'Local rule over captured redacted text. Glob ranges show context, not an exact token match.');
            }
        }
    }
    for (const [key, group] of commandGroups)
        if (group.ids.length >= Math.max(2, options.repeatMinimum))
            repeats.push({ id: `command/${fingerprint(key)}`, label: `Same captured command failed ${group.ids.length} times: ${group.label}`, count: group.ids.length, operationIds: group.ids });
    for (const [key, group] of writeGroups)
        if (group.ids.length >= Math.max(2, options.repeatMinimum))
            repeats.push({ id: `write/${fingerprint(key)}`, label: `${group.path} targeted by ${group.ids.length} write operations in one prompt interval`, count: group.ids.length, operationIds: group.ids, turnId: group.turn.id });
    const findingCounts = new Map<string, number>();
    for (const hit of findings) {
        findingCounts.set(hit.operationId, (findingCounts.get(hit.operationId) ?? 0) + 1);
        const turn = assignment.get(hit.operationId);
        if (turn)
            turn.findings++;
    }
    for (const row of commands)
        row.findings = findingCounts.get(row.id) ?? 0;
    for (const signal of repeats) {
        const seen = new Set<string>();
        for (const id of signal.operationIds) {
            const turn = assignment.get(id);
            if (turn && !seen.has(turn.id)) {
                turn.repeats++;
                seen.add(turn.id);
            }
        }
    }
    for (const turn of turns)
        turn.files = files.get(turn.id)?.size ?? 0;
    if (unassigned.operations) {
        unassigned.files = files.get(unassigned.id)?.size ?? 0;
        turns.push(unassigned);
    }
    return { commands, findings, repeats, turns };
}
export function pageReview(index: ReviewIndex, query: ReviewQuery, revision: string): ReviewPage {
    const all = index[query.section];
    let items: (CommandRow | ReviewFinding | RepeatSignal | TurnSummary)[] = all;
    if (query.section === 'commands')
        items = index.commands.filter(row => (!query.status || row.status === query.status) && (!query.kind || row.kind === query.kind) && (!query.agent || row.agentId === query.agent) && (!query.q || `${row.preview} ${row.cwd ?? ''}`.toLowerCase().includes(query.q.toLowerCase())));
    if (query.section === 'turns' && query.sort === 'failures')
        items = [...items].sort((a, b) => (b as TurnSummary).failures - (a as TurnSummary).failures);
    const start = Math.max(0, query.start ?? 0), count = Math.max(1, Math.min(40, query.count ?? 20));
    return { section: query.section, total: items.length, allCount: all.length, start, items: items.slice(start, start + count).map(item => 'operationIds' in item ? { ...item, operationIds: [] } : item), version: REVIEW_VERSION, revision };
}
