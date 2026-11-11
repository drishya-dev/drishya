/** Normalize design lengths once at the CSS boundary, without changing selectors or media-query breakpoints.
 * A rem is 16 design pixels. Hairlines stay physical; quoted content and URLs are never CSS lengths.
 */
export function interfaceCssLengths(value: string): string {
  // Quoted/resource tokens win before length tokens. The already-scaled branch
  // makes a repeated PostCSS visit idempotent, including inline reading allowances.
  return value.replace(
    /url\((?:[^()"'\\]|\\.|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')*\)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\*[\s\S]*?\*\/|(calc\(\s*var\(\s*--reading-width\s*,\s*-?(?:\d*\.)?\d+px\s*\)\s*\*\s*var\(\s*--ui-scale\s*,\s*1\s*\)\s*\))|(var\(\s*--reading-width\s*,\s*-?(?:\d*\.)?\d+px\s*\))|(?<![\w.-])(-?(?:\d+(?:\.\d*)?|\.\d+))px\b/gi,
    (token, scaled: string | undefined, dynamic: string | undefined, number: string | undefined) => {
      if (scaled) return token;
      if (dynamic) return `calc(${dynamic} * var(--ui-scale, 1))`;
      return number === undefined || Math.abs(Number(number)) <= 1 ? token : `${Number(number) / 16}rem`;
    },
  );
}
