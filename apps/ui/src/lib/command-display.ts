/** A display projection of known execution arguments; never evaluate captured code. */
export function commandDisplay(raw: string): { text: string; decoded: boolean } {
  if (raw.length > 2 * 1024 * 1024) return { text: raw, decoded: false };
  try {
    const args = JSON.parse(raw);
    if (args && typeof args === 'object' && !Array.isArray(args)) {
      const command = args.cmd ?? args.command;
      if (typeof command === 'string') return { text: command, decoded: true };
    }
  } catch { /* A native wrapper is code, not a JSON document. */ }
  // Only an anchored, known wrapper with its command first is decoded. An
  // arbitrary source literal or Windows path must retain its backslashes.
  const match = /^\s*(?:text\(\s*)?await\s+tools\.exec_command\(\s*\{\s*cmd\s*:\s*("(?:[^"\\]|\\.)*")/s.exec(raw);
  if (match) {
    try { return { text: JSON.parse(match[1]!), decoded: true }; } catch { /* Truncated/invalid escape. */ }
  }
  return { text: raw, decoded: false };
}
