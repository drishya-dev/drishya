/** Journal data only; none of these commands is executed. */
export function reviewJournal(root: string) {
    const timestamp = '2026-10-18T00:00:00Z';
    const rows: unknown[] = [{ timestamp, type: 'session_meta', payload: { id: 'review-tools', cwd: root } }, { timestamp, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Review the captured changes and checks' }] } }];
    for (let i = 0; i < 4; i++)
        rows.push({ timestamp, type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: `failed-${i}`, arguments: JSON.stringify({ cmd: 'pnpm test -- repeated-case', workdir: root }) } }, { timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: `failed-${i}`, output: 'Exit code: 1\nWall time: 0.25 seconds\nOutput:\nFAIL repeated-case synthetic output' } });
    for (const [id, cmd, output] of [['force', 'git push origin main --force', 'Exit code: 1\nOutput:\nsynthetic force output'], ['long', 'echo ' + 'a'.repeat(5000) + ' COMPLETE_END', 'Exit code: 0\nOutput:\ncomplete'], ['unknown', 'echo unknown', 'tool output without exposed exit']])
        rows.push({ timestamp, type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: id, arguments: JSON.stringify({ cmd, workdir: root }) } }, { timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: id, output } });
    rows.push({ timestamp, type: 'response_item', payload: { type: 'function_call', name: 'apply_patch', call_id: 'lock', arguments: '*** Begin Patch\n*** Add File: pnpm-lock.yaml\n+lockfileVersion: 9\n*** End Patch' } }, { timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: 'lock', output: 'Success. Updated the following files:\nA pnpm-lock.yaml' } });
    return rows.map(row => JSON.stringify(row)).join('\n') + '\n';
}
