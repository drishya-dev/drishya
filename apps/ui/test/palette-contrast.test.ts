import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// Release 1 ships three palettes (SHIP-17; Opus decision, 10 Nov). Floors are measured on every surface, the card ones included.
const surfaces = ['--bg', '--s1', '--s2', '--s3'];
const syntaxInks = ['--syntax-keyword', '--syntax-string', '--syntax-function', '--syntax-number', '--syntax-type', '--syntax-property'];
const pathAndOutcomeInks = ['--source', '--external', '--edited', '--pass', '--fail'];
const agentInks = ['--agent-claude-ink', '--agent-codex-ink', '--agent-violet-ink', '--agent-gold-ink', '--agent-blue-ink', '--agent-rose-ink'];
const diffInks = ['--diff-added', '--diff-removed'];
const SHIPPED = ['jet', 'paper', 'midnight'];

function channels(hex: string) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
}

const linear = (value: number) => {
  const channel = value / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
};

function luminance(rgb: number[]) {
  const l = rgb.map(linear);
  return l[0]! * .2126 + l[1]! * .7152 + l[2]! * .0722;
}

function contrast(foreground: number[], background: number[]) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** OKLab, from sRGB (Ottosson). */
function oklab(rgb: number[]) {
  const [r, g, b] = rgb.map(linear) as [number, number, number];
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s] as const;
}

const chroma = (rgb: number[]) => Math.hypot(oklab(rgb)[1], oklab(rgb)[2]);
const distance = (a: number[], b: number[]) => {
  const x = oklab(a), y = oklab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** Deuteranopia (Machado, Oliveira and Fernandes 2009, severity 1), applied in linear light. */
function deuteranopia(rgb: number[]) {
  const [r, g, b] = rgb.map(linear) as [number, number, number];
  return [
    .367322 * r + .860646 * g - .227968 * b,
    .280085 * r + .672501 * g + .047413 * b,
    -.01182 * r + .04294 * g + .968881 * b,
  ].map((value) => {
    const clamped = Math.min(1, Math.max(0, value));
    return 255 * (clamped <= .0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - .055);
  });
}

function declarations(css: string): Record<string, string> {
  return Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]));
}

function ink(tokens: Record<string, string>, name: string) {
  const declared = tokens[name] ?? '';
  const reference = /^var\((--[\w-]+)\)$/.exec(declared)?.[1];
  const value = reference ? tokens[reference] : declared;
  expect(value, name).toMatch(/^#[\da-f]{6}$/i);
  return value!;
}

it('ships exactly Jet Black, Daylight and Midnight, with ink floors on every surface', () => {
  expect(contrast(channels('#000000'), channels('#ffffff'))).toBe(21);
  expect(contrast(channels('#ffffff'), channels('#ffffff'))).toBe(1);

  const presets = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
  const contract = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
  const shared = declarations(/\[data-theme\]\[data-palette\]\s*\{([^}]+)\}/.exec(contract)?.[1] ?? '');
  const light = declarations(/\[data-theme=light\]\[data-palette\]\s*\{([^}]+)\}/.exec(contract)?.[1] ?? '');
  const failures: string[] = [];
  const palettes: string[] = [];

  for (const [, palette, body] of presets.matchAll(/\[data-palette=(\w+)\]\s*\{([^}]+)\}/g)) {
    const preset = declarations(body!);
    if (!preset['--bg']) continue;
    palettes.push(palette!);
    const isLight = /color-scheme:\s*light\s*;/.test(body!);
    const tokens = { ...preset, ...shared, ...(isLight ? light : {}) };
    if(palette==='midnight')for(const name of surfaces){
      const [r,,b]=channels(ink(tokens,name));
      expect(b!-r!,`Midnight ${name} stays visibly navy rather than neutral graphite`).toBeGreaterThanOrEqual(10);
    }
    // Yash, 11 Nov: the same meaning-ink floor applies to every shipped palette.
    const meaningFloor = 7;

    for (const background of surfaces) {
      const surface = channels(ink(tokens, background));
      const check = (names: string[], floor: number) => {
        for (const name of names) {
          const ratio = contrast(channels(ink(tokens, name)), surface);
          if (ratio < floor) failures.push(`${palette}: ${name} on ${background} = ${ratio.toFixed(2)} (< ${floor})`);
        }
      };
      check(['--text-primary', '--t1'], 13);
      check(['--text-secondary', '--t2'], 7);
      check(['--text-muted', '--t3'], 4.5);
      check(['--text-chrome', '--t4'], 3);
      check([...syntaxInks, ...pathAndOutcomeInks, ...agentInks, ...diffInks], meaningFloor);
      check(['--focus'], 4.5);

      for (const foreground of diffInks) {
        const wash = `${foreground}-wash`;
        const mix = /^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, transparent\)$/.exec(tokens[wash] ?? '');
        expect(mix?.[1], `${palette}: ${wash} ink`).toBe(foreground);
        const opacity = Number(mix?.[2]) / 100;
        expect(opacity, `${palette}: ${wash} opacity`).toBeGreaterThan(0);
        expect(opacity, `${palette}: ${wash} opacity`).toBeLessThan(1);
        const diff = channels(ink(tokens, foreground));
        const composite = surface.map((channel, index) => diff[index]! * opacity + channel * (1 - opacity));
        // Text over a changed line must stay readable: primary ink keeps a 7:1 floor there; the diff ink loses a little against its own wash, so 6:1 on dark.
        for (const [role, floor] of [['--text-primary', 7], [foreground, isLight ? 4.5 : 6]] as const) {
          const ratio = contrast(channels(ink(tokens, role)), composite);
          if (ratio < floor) failures.push(`${palette}: ${role} on ${wash} over ${background} = ${ratio.toFixed(2)} (< ${floor})`);
        }
      }
    }

    {
      for (const name of [...syntaxInks, ...pathAndOutcomeInks, ...agentInks, ...diffInks]) {
        const value = chroma(channels(ink(tokens, name)));
        if (value < .09) failures.push(`${palette}: ${name} OKLCH chroma ${value.toFixed(3)} (< 0.09)`);
      }
    }

    // Syntax inks stay distinguishable side by side; pass and fail stay apart without red-green vision.
    for (const [index, a] of syntaxInks.entries()) {
      for (const b of syntaxInks.slice(index + 1)) {
        const apart = distance(channels(ink(tokens, a)), channels(ink(tokens, b)));
        if (apart < .06) failures.push(`${palette}: ${a} and ${b} are ${apart.toFixed(3)} apart in OKLab (< 0.06)`);
      }
    }
    const seen = distance(deuteranopia(channels(ink(tokens, '--pass'))), deuteranopia(channels(ink(tokens, '--fail'))));
    if (seen < .1) failures.push(`${palette}: pass and fail are ${seen.toFixed(3)} apart under deuteranopia (< 0.1)`);
  }

  expect(palettes).toEqual(SHIPPED);
  expect(failures).toEqual([]);
});
