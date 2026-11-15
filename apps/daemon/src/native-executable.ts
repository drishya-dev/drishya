import { readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, win32 } from 'node:path';

/** Only known native installation locations; no shell shims or recursive disk search. */
export function executable(name: string, options: { env?: NodeJS.ProcessEnv; platform?: string; arch?: string } = {}): string | undefined {
  const env = options.env ?? process.env, platform = options.platform ?? process.platform, arch = options.arch ?? process.arch;
  const windows = platform === 'win32';
  // SEC-3: only absolute PATH entries. A relative one ("." or "bin") would resolve against whatever directory
  // Drishya was started in, which can be a repository that ships its own `claude` or `codex`.
  const dirs = (env.PATH ?? '').split(windows ? ';' : ':').map(dir => dir.replace(/^"|"$/g, '')).filter(dir => dir && (isAbsolute(dir) || win32.isAbsolute(dir)));
  const isFile = (path: string) => { try { return statSync(path).isFile(); } catch { return false; } };
  for (const dir of dirs) { const path = join(dir, name + (windows ? '.exe' : '')); if (isFile(path)) return path; }
  if (!windows || !['codex', 'claude'].includes(name)) return;
  const home = env.USERPROFILE;
  if (name === 'claude') {
    const file = home && join(home, '.local', 'bin', 'claude.exe');
    return file && isFile(file) ? file : undefined;
  }
  const triple = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : arch === 'x64' ? 'x86_64-pc-windows-msvc' : undefined;
  if (!triple) return;
  const npmDirs = [...new Set([...dirs, ...(env.APPDATA ? [join(env.APPDATA, 'npm')] : [])])];
  for (const dir of npmDirs) {
    const pkg = join(dir, 'node_modules', '@openai', 'codex');
    for (const vendor of [join(pkg, 'node_modules', '@openai', `codex-win32-${arch}`, 'vendor'), join(dir, 'node_modules', '@openai', `codex-win32-${arch}`, 'vendor'), join(pkg, 'vendor')]) {
      const file = join(vendor, triple, 'bin', 'codex.exe'); if (isFile(file)) return file;
    }
  }
  if (env.LOCALAPPDATA) {
    const bin = join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try {
      // The desktop updater retains version directories. Prefer the most recently installed native binary.
      const versions = readdirSync(bin, { withFileTypes: true }).filter(entry => entry.isDirectory() && /^[a-f0-9]{8,64}$/i.test(entry.name)).slice(0, 64)
        .map(entry => join(bin, entry.name, 'codex.exe')).filter(isFile).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
      if (versions[0]) return versions[0];
    } catch { /* Not installed here. */ }
    const file = join(bin, 'codex.exe'); if (isFile(file)) return file;
  }
}
