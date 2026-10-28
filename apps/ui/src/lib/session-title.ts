/** A Home row title a person can scan: no continuation boilerplate and no bare links. Display only; the capture is unchanged. */
const CONTINUED=/^\s*this session is being continued from a previous conversation[^.]*\.?\s*/i;
export function cleanSessionTitle(title: string): string {
  const content = title.replace(CONTINUED, '');
  if (!content.trim()) return title.trim() ? 'Continued session' : 'Untitled session';
  const text = content.replace(/\bhttps?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 'Untitled session';
  return text.length > 160 ? `${text.slice(0, 159)}…` : text;
}
