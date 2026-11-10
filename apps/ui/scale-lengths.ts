/** Normalize design lengths once at the CSS boundary, without changing selectors or media-query breakpoints.
 * A rem is 16 design pixels. Hairlines stay physical; quoted content and URLs are never CSS lengths.
 */
export function interfaceCssLengths(value: string): string {
  const dynamic: string[] = [];
  // History's measured reading allowance is an inline design-pixel value. It is
  // not a DOM rectangle: scale it once, while the surrounding max/min lengths use rem.
  const prepared = value.replace(/var\(\s*--reading-width\s*,\s*-?(?:\d*\.)?\d+px\s*\)/g, token => {
    const index = dynamic.push(`calc(${token} * var(--ui-scale, 1))`) - 1;
    return `__DRISHYA_DESIGN_LENGTH_${index}__`;
  });
  const result = prepared.replace(
    /url\((?:[^()"'\\]|\\.|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')*\)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\*[\s\S]*?\*\/|(?<![\w.-])(-?(?:\d+(?:\.\d*)?|\.\d+))px\b/gi,
    (token, number: string | undefined) => number === undefined || Math.abs(Number(number)) <= 1 ? token : `${Number(number) / 16}rem`,
  );
  return result.replace(/__DRISHYA_DESIGN_LENGTH_(\d+)__/g, (_, index: string) => dynamic[Number(index)]!);
}
