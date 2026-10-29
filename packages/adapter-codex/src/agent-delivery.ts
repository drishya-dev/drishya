/** A routing wrapper is recognised only inside a native typed agent_message, never in user prose. */
export function agentDelivery(p: Record<string, any>, text: string) {
  if (p.type !== 'agent_message' || typeof p.author !== 'string' || typeof p.recipient !== 'string') return;
  const match = /^Message Type: (MESSAGE|FINAL_ANSWER|NEW_TASK)\r?\nTask name: ([^\r\n]+)\r?\nSender: ([^\r\n]+)\r?\nPayload:(?:\r?\n| ?)([\s\S]*)$/.exec(text);
  if (!match || match[2] !== p.recipient || match[3] !== p.author) return;
  const encrypted = Array.isArray(p.content) && p.content.some((part: any) => part?.type === 'encrypted_content');
  return {
    text: match[4]!,
    delivery: {
      type: match[1]!, sender: p.author, recipient: p.recipient,
      ...(typeof p.id === 'string' && p.id ? { nativeId: p.id } : {}),
      state: match[4]!.trim() ? encrypted ? 'partial' : 'complete' : encrypted ? 'encrypted' : 'empty',
    },
  };
}
