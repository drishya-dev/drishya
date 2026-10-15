// A lexical colour aid, never a parser or a source transformation.
const parts = /\/\/.*$|#.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|import|from|export|default|async|await|class|interface|type|extends|if|else|for|while|try|catch|throw|new|def|in|with|as|None|True|False|true|false|null|undefined|public|private|readonly)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\s*\()/g;
export interface CodeToken { text: string; kind: 'plain' | 'comment' | 'string' | 'keyword' | 'number' | 'call' }
export function tokenizeFreshCode(text: string): CodeToken[] {
  const tokens: CodeToken[] = []; let cursor = 0;
  for (const match of text.matchAll(parts)) {
    const index = match.index, word = match[0];
    if (index > cursor) tokens.push({ text: text.slice(cursor, index), kind: 'plain' });
    const kind = /^(?:\/\/|#|\/\*)/.test(word) ? 'comment' : /^["'`]/.test(word) ? 'string' : /^\d/.test(word) ? 'number' : /^[A-Za-z_$][\w$]*$/.test(word) && /^\s*\(/.test(text.slice(index + word.length)) ? 'call' : 'keyword';
    tokens.push({ text: word, kind }); cursor = index + word.length;
  }
  if (cursor < text.length) tokens.push({ text: text.slice(cursor), kind: 'plain' });
  return tokens;
}
export function CodeTokens({ text }: { text: string }) {
  return <>{tokenizeFreshCode(text).map((token, index) => token.kind === 'plain' ? token.text : <span className={`fr-syntax-${token.kind}`} key={index}>{token.text}</span>)}</>;
}
