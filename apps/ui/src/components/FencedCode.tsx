import { useEffect, useRef, useState } from 'react';
import { Highlighted } from '../lib/highlight.tsx';
import './FencedCode.css';

const KNOWN_LANGUAGES = new Set([
  'typescript', 'ts', 'tsx',
  'javascript', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts',
  'python', 'py',
  'shell', 'sh', 'bash', 'zsh', 'powershell', 'ps1', 'pwsh',
  'yaml', 'yml',
  'toml',
  'ruby', 'rb',
  'markdown', 'md', 'mdx',
  'json', 'jsonc',
  'diff', 'patch',
]);

const LABELS: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  sh: 'shell',
  ps1: 'powershell',
  pwsh: 'powershell',
  yml: 'yaml',
  rb: 'ruby',
  md: 'markdown',
  jsonc: 'json',
  patch: 'diff',
};

const DIFF_META_LINE = /^(?:diff\s+--git\s|index\s+[0-9a-f]+\.\.|(?:new|deleted)\s+file\s+mode\s|rename\s+(?:from|to)\s|similarity\s+index\s|(?:---|\+\+\+)\s+\S)/;

function diffLineClass(line: string): string | undefined {
  if (DIFF_META_LINE.test(line)) return 'fenced-diff-meta';
  if (line.startsWith('@@')) return 'fenced-diff-hunk';
  if (line.startsWith('+')) return 'fenced-diff-add';
  if (line.startsWith('-')) return 'fenced-diff-del';
  return undefined;
}

/** Copy the captured text exactly. Visual wrapping never rewrites commands. */
export function FencedCode({ text, language }: { text: string; language: string }) {
  const lines = text.split('\n');
  const raw = language.trim();
  const normalized = raw.toLowerCase();
  const prose = /^(text|txt|plaintext)?$/.test(normalized);
  const highlighted = KNOWN_LANGUAGES.has(normalized) ? normalized : undefined;
  const isDiff = highlighted === 'diff' || highlighted === 'patch';
  const label = LABELS[normalized] ?? (raw || 'Text');

  const [wrap, setWrap] = useState(prose);
  const [confirm, setConfirm] = useState<'copied' | 'one-line' | 'failed' | ''>('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    setWrap(prose);
  }, [prose]);

  useEffect(() => {
    setConfirm('');
    window.clearTimeout(timer.current);
  }, [text, language]);

  const copy = async (oneLine = false) => {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(oneLine ? text.replace(/\s*\r?\n\s*/g, ' ') : text);
      setConfirm(oneLine ? 'one-line' : 'copied');
      timer.current = window.setTimeout(() => setConfirm(''), 1800);
    } catch {
      setConfirm('failed');
      timer.current = window.setTimeout(() => setConfirm(''), 3000);
    }
  };

  const copied = confirm === 'copied';
  const copiedOneLine = confirm === 'one-line';
  const statusText = copied
    ? 'Copied'
    : copiedOneLine
      ? 'Copied as one line'
      : confirm === 'failed'
        ? 'Select the text to copy'
        : '';

  return (
    <section
      className="fenced-material"
      aria-label={`${label} block`}
      data-copy-status={confirm || undefined}
    >
      <header className="fenced-header">
        <span className="fenced-language">{label}</span>
        <span
          className={`fenced-status${confirm === 'failed' ? ' is-error' : ' sr-only'}`}
          role="status"
          aria-live="polite"
        >
          {statusText}
        </span>
        <span className="fenced-actions">
          <button type="button" aria-pressed={wrap} onClick={() => setWrap(value => !value)}>
            Wrap
          </button>
          {prose && text.includes('\n') && (
            <button
              type="button"
              data-copied={copiedOneLine ? 'true' : undefined}
              onClick={() => void copy(true)}
            >
              {copiedOneLine ? 'Copied as one line' : 'Copy as one line'}
            </button>
          )}
          <button
            type="button"
            className="fenced-copy-btn"
            data-copied={copied ? 'true' : undefined}
            onClick={() => void copy()}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </header>
      <pre
        className={`md-code${prose ? ' md-code-text' : ''}${wrap ? ' code-wrap' : ' code-nowrap'}${isDiff ? ' md-code-diff' : ''}`}
        tabIndex={0}
      >
        {lines.map((line, n) => (
          <div key={n} className={isDiff ? diffLineClass(line) : undefined}>
            {highlighted ? <Highlighted line={line} lang={highlighted} /> : line}
            {n < lines.length - 1 ? '\n' : ''}
          </div>
        ))}
      </pre>
    </section>
  );
}
