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
  const command = wrappedCommand(raw);
  if (command !== undefined) return { text: command, decoded: true };
  return { text: raw, decoded: false };
}

/** Decode only a complete, single literal call. A prefix match could hide later work. */
function wrappedCommand(raw: string): string | undefined {
  const source = raw.replace(/^\s*\/\/ @exec:[^\r\n]*\r?\n/, '');
  const prefix = /^\s*(?:(text)\(\s*(\()?\s*)?await\s+tools\.exec_command\(\s*\{/s.exec(source);
  if (!prefix) return;
  let rest = source.slice(prefix[0].length);
  let command: string | undefined;
  const keys = new Set<string>();
  while (true) {
    // Other fields must also be literals: no callbacks, computed properties or code execution.
    const field = /^\s*([A-Za-z_$][\w$]*|"(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)\s*([,}])/s.exec(rest);
    if (!field) return;
    let key: string, value: unknown;
    try {
      key = field[1]!.startsWith('"') ? JSON.parse(field[1]!) : field[1]!;
      value = JSON.parse(field[2]!);
    } catch { return; }
    if (keys.has(key)) return;
    keys.add(key);
    if (key === 'cmd') {
      if (typeof value !== 'string') return;
      command = value;
    }
    rest = rest.slice(field[0].length);
    if (field[3] === '}' || /^\s*}/.test(rest)) {
      if (field[3] !== '}') rest = rest.replace(/^\s*}/, '');
      break;
    }
  }
  const suffix = prefix[2] ? /^\s*\)\s*\)\s*(?:\.output\s*)?\)\s*;?\s*$/
    : prefix[1] ? /^\s*\)\s*\)\s*;?\s*$/ : /^\s*\)\s*;?\s*$/;
  if (suffix.test(rest)) return command;
}
