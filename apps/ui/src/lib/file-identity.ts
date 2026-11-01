/** A file is known by its name. Its folder is secondary, and the end of the folder is the part that differs. */
export function fileName(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).at(-1) || path;
}

export function fileFolder(path: string, depth = 3): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  parts.pop();
  const tail = parts.slice(-depth).join('/');
  return parts.length > depth ? `…/${tail}` : tail;
}
