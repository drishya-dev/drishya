// AUDIT-1 (5 Nov): a disabled Send says what it waits for. Connection comes first: while the daemon is
// unreachable, the workspace and controller facts below it may be stale, so naming them would mislead.
export type SendWaitState = { unavailable: boolean; approved: boolean; cliAvailable: boolean; overLimit: boolean; sending: boolean; attaching: boolean; hasPrompt: boolean };
export function sendWaitReason(state: SendWaitState): string {
  return state.unavailable ? 'Connection to the Drishya daemon is unavailable'
    : state.sending ? 'Sending the prompt…'
    : !state.approved ? 'Enable this workspace in Connection & permissions to send'
    : !state.cliAvailable ? 'Sending is not available for this session'
    : state.overLimit ? 'The prompt is over its size limit'
    : state.attaching ? 'Waiting for the files to attach'
    : !state.hasPrompt ? 'Write a prompt to send'
    : 'Send prompt';
}
