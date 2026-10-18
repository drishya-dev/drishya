/** File identity stays literal: basename first, parent directory second. */
export function mapFileLabel(path: string) {
  const parts = path.replace(/\\/g, '/').split('/');
  return { name: parts.pop() || path, parent: parts.join('/') || 'Repository root' };
}
