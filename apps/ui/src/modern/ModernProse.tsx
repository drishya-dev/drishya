import type { ReactNode } from 'react';
import { CodeTokens } from '../fresh/CodeTokens';

/** A bounded, text-only Markdown view. HTML and remote images never execute or load. */
function inline(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|!?\[[^\]\n]*\]\([^\)\n]+\))/g);
  return tokens.map((token, i) => {
    if (token.startsWith('`')) return <code key={i}>{token.slice(1, -1)}</code>;
    if (token.startsWith('**')) return <strong key={i}>{token.slice(2, -2)}</strong>;
    const link = /^(!?)\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
    if (link && !link[1] && /^https?:\/\//i.test(link[3]!)) return <a key={i} href={link[3]} target="_blank" rel="noopener noreferrer">{link[2]}</a>;
    // Local paths remain selectable evidence, and remote image references remain text.
    return token;
  });
}
export function ModernProse({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3); const code: string[] = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) code.push(lines[i++]!);
      if (i < lines.length) i++;
      blocks.push(<div className="md-prose-code" key={i}>{language && <span>{language}</span>}<pre><CodeTokens text={code.join('\n')} /></pre></div>); continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { blocks.push(<h3 key={i}>{inline(heading[2]!)}</h3>); i++; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = []; const ordered = /^\s*\d+\./.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, ''));
      const List = ordered ? 'ol' : 'ul'; blocks.push(<List key={i}>{items.map((item, n) => <li key={n}>{inline(item)}</li>)}</List>); continue;
    }
    if (!line.trim()) { i++; continue; }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|\s*```|\s*([-*]|\d+\.)\s+)/.test(lines[i]!)) paragraph.push(lines[i++]!);
    blocks.push(<p key={i}>{inline(paragraph.join('\n'))}</p>);
  }
  return <div className="md-prose-content">{blocks}</div>;
}
