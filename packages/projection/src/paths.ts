/** Workspace-relative, forward-slash paths. Case-insensitive comparison for Windows roots. */
export function isWindowsPath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\');
}

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

export function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === '/') end--;
  return path.slice(0, end);
}

export function relativize(path: string, root: string | undefined): string {
  if (!path) return path;
  const p = toPosix(path);
  if (!root) return p.replace(/^\.\//, '');
  const r = trimTrailingSlashes(toPosix(root));
  const ci = isWindowsPath(root) || isWindowsPath(path);
  const pc = ci ? p.toLowerCase() : p;
  const rc = ci ? r.toLowerCase() : r;
  if (pc === rc) return '.';
  if (pc.startsWith(rc + '/')) return p.slice(r.length + 1);
  if (!isWindowsPath(p) && !p.startsWith('/')) return p.replace(/^\.\//, '');
  return p;
}

/** True if a path (already relativized) lies inside the workspace. */
export function inWorkspace(rel: string): boolean {
  return !!rel && rel !== '.' && !rel.startsWith('/') && !isWindowsPath(rel) && !rel.startsWith('../');
}
