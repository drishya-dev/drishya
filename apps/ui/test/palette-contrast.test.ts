import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const surfaces = ['--bg', '--s1', '--s2', '--s3'];
const textInks = ['--t1', '--t2', '--t3', '--t4', '--text-primary', '--text-secondary', '--text-muted', '--text-chrome'];
const syntaxInks = ['--syntax-keyword', '--syntax-string', '--syntax-function', '--syntax-number', '--syntax-type', '--syntax-property'];
const semanticInks = ['--source', '--external', '--edited', '--pass', '--fail', '--focus'];
const agentInks = ['--agent-claude-ink', '--agent-codex-ink', '--agent-violet-ink', '--agent-gold-ink', '--agent-blue-ink', '--agent-rose-ink'];
const diffInks = ['--diff-added', '--diff-removed'];

function channels(hex: string) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
}

function luminance(rgb: number[]) {
  const linear = rgb.map((value) => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return linear[0]! * .2126 + linear[1]! * .7152 + linear[2]! * .0722;
}

function contrast(foreground: number[], background: number[]) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
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

it('keeps readable Modern text and semantic colours on the base and elevated palette surfaces', () => {
  expect(contrast(channels('#000000'), channels('#ffffff'))).toBe(21);
  expect(contrast(channels('#ffffff'), channels('#ffffff'))).toBe(1);

  const presets = readFileSync(new URL('../src/modern/theme-presets.css', import.meta.url), 'utf8');
  const contract = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
  const shared = declarations(/\[data-theme\]\[data-palette\]\s*\{([^}]+)\}/.exec(contract)?.[1] ?? '');
  const light = declarations(/\[data-theme=light\]\[data-palette\]\s*\{([^}]+)\}/.exec(contract)?.[1] ?? '');
  const inks = [...textInks, ...syntaxInks, ...semanticInks, ...agentInks, ...diffInks];
  const failures: string[] = [];
  const palettes: string[] = [];

  for (const [, palette, body] of presets.matchAll(/\[data-palette=(\w+)\]\s*\{([^}]+)\}/g)) {
    const preset = declarations(body!);
    if (!preset['--bg']) continue;
    palettes.push(palette!);
    const tokens = { ...preset, ...shared, ...(/color-scheme:\s*light\s*;/.test(body!) ? light : {}) };
    for (const background of surfaces) {
      const surface = channels(ink(tokens, background));
      for (const foreground of inks) {
        const ratio = contrast(channels(ink(tokens, foreground)), surface);
        if (ratio < 4.5) failures.push(`${palette}: ${foreground} on ${background} = ${ratio.toFixed(3)}`);
      }
      for (const foreground of diffInks) {
        const wash = `${foreground}-wash`;
        const mix = /^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, transparent\)$/.exec(tokens[wash] ?? '');
        expect(mix?.[1], `${palette}: ${wash} ink`).toBe(foreground);
        const opacity = Number(mix?.[2]) / 100;
        expect(opacity, `${palette}: ${wash} opacity`).toBeGreaterThan(0);
        expect(opacity, `${palette}: ${wash} opacity`).toBeLessThan(1);
        const diff = channels(ink(tokens, foreground));
        const composite = surface.map((channel, index) => diff[index]! * opacity + channel * (1 - opacity));
        for (const role of ['--text-primary', foreground]) {
          const ratio = contrast(channels(ink(tokens, role)), composite);
          if (ratio < 4.5) failures.push(`${palette}: ${role} on ${wash} over ${background} = ${ratio.toFixed(3)}`);
        }
      }
    }
    expect(ink(tokens, '--syntax-type'), palette).not.toBe(ink(tokens, '--syntax-keyword'));
    expect(ink(tokens, '--syntax-property'), palette).not.toBe(ink(tokens, '--syntax-function'));
  }

  expect(palettes).toEqual(['jet', 'paper', 'midnight', 'mocha', 'tokyo', 'nord', 'gruvbox']);
  expect(failures).toEqual([]);
});
