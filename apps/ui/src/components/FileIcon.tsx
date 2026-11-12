import './file-icon.css';

export type FolderMarkKind =
  | 'git'
  | 'github'
  | 'agent'
  | 'src'
  | 'docs'
  | 'tests'
  | 'scripts'
  | 'dist'
  | 'modules'
  | 'assets'
  | 'fixtures';

export type FileFormatKind =
  | 'folder'
  | 'ts' | 'dts' | 'tsx'
  | 'js' | 'jsx'
  | 'md' | 'json' | 'yml' | 'toml'
  | 'css' | 'scss' | 'html' | 'xml' | 'vue' | 'svelte'
  | 'svg' | 'image'
  | 'py' | 'ipynb' | 'go' | 'rs' | 'java' | 'kt' | 'c' | 'cpp' | 'cs' | 'rb' | 'php' | 'swift' | 'dart' | 'lua' | 'zig' | 'ex' | 'scala' | 'r'
  | 'sh' | 'ps1' | 'sql' | 'graphql' | 'prisma'
  | 'docker' | 'make' | 'env' | 'git' | 'license' | 'lock' | 'manifest' | 'config' | 'test'
  | 'diff' | 'csv' | 'pdf' | 'archive' | 'txt';

export interface FileIconSpec {
  format: FileFormatKind;
  folderMark?: FolderMarkKind;
}

const FOLDER_MARKS: Record<string, FolderMarkKind> = {
  '.git': 'git',
  '.github': 'github',
  '.claude': 'agent',
  '.codex': 'agent',
  '.agents': 'agent',
  src: 'src',
  app: 'src',
  apps: 'src',
  packages: 'src',
  lib: 'src',
  docs: 'docs',
  doc: 'docs',
  documentation: 'docs',
  test: 'tests',
  tests: 'tests',
  __tests__: 'tests',
  e2e: 'tests',
  spec: 'tests',
  specs: 'tests',
  scripts: 'scripts',
  bin: 'scripts',
  tools: 'scripts',
  dist: 'dist',
  build: 'dist',
  out: 'dist',
  '.next': 'dist',
  target: 'dist',
  coverage: 'dist',
  node_modules: 'modules',
  vendor: 'modules',
  '.pnpm': 'modules',
  '.yarn': 'modules',
  public: 'assets',
  assets: 'assets',
  static: 'assets',
  media: 'assets',
  images: 'assets',
  icons: 'assets',
  fixtures: 'fixtures',
  __fixtures__: 'fixtures',
  mocks: 'fixtures',
};

const EXACT_FILES: Record<string, FileFormatKind> = {
  dockerfile: 'docker',
  containerfile: 'docker',
  makefile: 'make',
  'cmakelists.txt': 'make',
  justfile: 'make',
  procfile: 'make',
  gemfile: 'manifest',
  'package.json': 'manifest',
  'cargo.toml': 'manifest',
  'pyproject.toml': 'manifest',
  'go.mod': 'manifest',
  'composer.json': 'manifest',
  'pom.xml': 'manifest',
  'build.gradle': 'manifest',
  'build.gradle.kts': 'manifest',
  'pubspec.yaml': 'manifest',
  'package-lock.json': 'lock',
  'pnpm-lock.yaml': 'lock',
  'yarn.lock': 'lock',
  'bun.lock': 'lock',
  'bun.lockb': 'lock',
  'cargo.lock': 'lock',
  'poetry.lock': 'lock',
  'gemfile.lock': 'lock',
  'composer.lock': 'lock',
  'go.sum': 'lock',
  'uv.lock': 'lock',
  'flake.lock': 'lock',
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.gitkeep': 'git',
  '.git-blame-ignore-revs': 'git',
  '.editorconfig': 'config',
  '.npmrc': 'config',
  '.nvmrc': 'config',
  '.node-version': 'config',
  '.prettierignore': 'config',
  '.eslintignore': 'config',
  '.dockerignore': 'docker',
  'biome.json': 'config',
  'biome.jsonc': 'config',
  'turbo.json': 'config',
  'jsconfig.json': 'config',
  'tsconfig.json': 'config',
};

const EXT_MAP: Record<string, FileFormatKind> = {
  ts: 'ts', mts: 'ts', cts: 'ts',
  tsx: 'tsx',
  js: 'js', mjs: 'js', cjs: 'js',
  jsx: 'jsx',
  md: 'md', mdx: 'md', markdown: 'md', rst: 'md', adoc: 'md',
  json: 'json', jsonc: 'json', json5: 'json', jsonl: 'json', ndjson: 'json',
  yml: 'yml', yaml: 'yml',
  toml: 'toml',
  ini: 'config', conf: 'config', cfg: 'config', properties: 'config',
  css: 'css', pcss: 'css',
  scss: 'scss', sass: 'scss', less: 'scss',
  html: 'html', htm: 'html', astro: 'html',
  xml: 'xml', plist: 'xml', xhtml: 'xml', xsl: 'xml',
  vue: 'vue',
  svelte: 'svelte',
  svg: 'svg',
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', ico: 'image', avif: 'image', bmp: 'image',
  py: 'py', pyw: 'py', pyi: 'py', pyx: 'py',
  ipynb: 'ipynb',
  go: 'go',
  rs: 'rs',
  java: 'java', jar: 'java',
  kt: 'kt', kts: 'kt',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp',
  cs: 'cs', csx: 'cs',
  rb: 'rb', erb: 'rb', rake: 'rb',
  php: 'php',
  swift: 'swift',
  dart: 'dart',
  lua: 'lua',
  zig: 'zig',
  ex: 'ex', exs: 'ex',
  scala: 'scala', sc: 'scala',
  r: 'r',
  sh: 'sh', bash: 'sh', zsh: 'sh', fish: 'sh', ksh: 'sh',
  ps1: 'ps1', psm1: 'ps1', psd1: 'ps1', bat: 'ps1', cmd: 'ps1',
  sql: 'sql', sqlite: 'sql', db: 'sql', ddl: 'sql',
  graphql: 'graphql', gql: 'graphql',
  prisma: 'prisma',
  dockerfile: 'docker',
  diff: 'diff', patch: 'diff',
  csv: 'csv', tsv: 'csv',
  pdf: 'pdf',
  pem: 'env', key: 'env', crt: 'env', cer: 'env',
  lock: 'lock',
  zip: 'archive', tar: 'archive', gz: 'archive', tgz: 'archive', bz2: 'archive', xz: 'archive', '7z': 'archive', wasm: 'archive',
  txt: 'txt', log: 'txt',
};

/** Maps a repository path (or folder name) to its icon format and optional folder mark. */
export function resolveFileIcon(path: string, folder = false): FileIconSpec {
  const clean = path.replace(/[\\/]+$/, '');
  const name = clean.split(/[\\/]/).at(-1)?.toLowerCase() ?? '';
  if (folder) {
    return { format: 'folder', folderMark: FOLDER_MARKS[name] };
  }
  if (!name) return { format: 'txt' };
  if (name === '.env' || name.startsWith('.env.')) return { format: 'env' };
  if (name.startsWith('.git')) return { format: 'git' };
  if (name === 'license' || name.startsWith('license.') || name === 'copying' || name.startsWith('copying.') || name === 'notice' || name.startsWith('notice.')) return { format: 'license' };
  if (name === 'dockerfile' || name.startsWith('dockerfile.') || name.endsWith('.dockerfile') || name.startsWith('docker-compose.') || name === 'compose.yml' || name === 'compose.yaml') return { format: 'docker' };
  const exact = EXACT_FILES[name];
  if (exact) return { format: exact };
  if (/^(tsconfig\.[^.]+|vite\.config|vitest\.config|playwright\.config|eslint\.config|prettier\.config|rollup\.config|webpack\.config|babel\.config|next\.config|astro\.config|svelte\.config|tailwind\.config)\.[^.]+$/.test(name) || /^\.(eslintrc|prettierrc)(\.|$)/.test(name)) {
    return { format: 'config' };
  }
  if (/\.(test|spec)\.[^.]+$/.test(name) || /_test\.(go|rs|py)$/.test(name) || /^test_[^.]+\.py$/.test(name)) {
    return { format: 'test' };
  }
  if (/\.d\.(ts|mts|cts)$/.test(name)) return { format: 'dts' };
  const ext = name.includes('.') ? name.split('.').at(-1) ?? '' : '';
  return { format: EXT_MAP[ext] ?? 'txt' };
}

function FolderBadge({ mark }: { mark: FolderMarkKind }) {
  switch (mark) {
    case 'git':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <rect x="11.2" y="10.2" width="7.8" height="7.8" rx="2" fill="var(--s1, #121212)" stroke="none" />
        <path d="M13.5 11.8v4.8M13.5 13.8l2.8-1.6" fill="none" />
        <circle cx="13.5" cy="11.8" r=".95" fill="currentColor" stroke="none" />
        <circle cx="13.5" cy="16.6" r=".95" fill="currentColor" stroke="none" />
        <circle cx="16.4" cy="12.2" r=".95" fill="currentColor" stroke="none" />
      </g>;
    case 'github':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="15" cy="14.4" r="3.6" fill="var(--s1, #121212)" />
        <path d="M13.7 13.4c.4-.5.9-.5 1.3-.3.4-.2.9-.2 1.3.3.5.7.4 1.8-.3 2.3v1.1m-2-1.1v1.1c-.7-.5-.8-1.6-.3-2.3Z" fill="none" />
      </g>;
    case 'agent':
      return <g className="folder-mark" fill="currentColor">
        <circle cx="15.2" cy="14.4" r="3.6" fill="var(--s1, #121212)" />
        <path d="M15.2 11.4c.25 1.75.7 2.2 2.4 2.4-1.7.2-2.15.65-2.4 2.4-.25-1.75-.7-2.2-2.4-2.4 1.7-.2 2.15-.65 2.4-2.4Z" />
      </g>;
    case 'src':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="11" y="10.8" width="8" height="6.8" rx="1.6" fill="var(--s1, #121212)" stroke="none" />
        <path d="M13.6 12.6 12 14.2l1.6 1.6M16.4 12.6l1.6 1.6-1.6 1.6" />
      </g>;
    case 'docs':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="11.2" y="10.4" width="7.4" height="7.6" rx="1.5" fill="var(--s1, #121212)" />
        <path d="M13.3 12.8h3.2M13.3 14.8h3.2M13.3 16.4h2" />
      </g>;
    case 'tests':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="15" cy="14.4" r="3.5" fill="var(--s1, #121212)" />
        <path d="m13.4 14.5 1.1 1.1 2.2-2.3" />
      </g>;
    case 'scripts':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="11.2" y="10.8" width="7.6" height="6.8" rx="1.5" fill="var(--s1, #121212)" />
        <path d="m12.9 13 1.4 1.2-1.4 1.2M15.4 15.4h1.9" />
      </g>;
    case 'dist':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="11.4" y="10.8" width="7.2" height="6.8" rx="1.4" fill="var(--s1, #121212)" />
        <path d="M11.6 13.4h6.8M14 13.4v1.4h2v-1.4" />
      </g>;
    case 'modules':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M15 10.6 18.2 12.4v3.8L15 18l-3.2-1.8v-3.8Z" fill="var(--s1, #121212)" />
        <path d="M11.8 12.4 15 14.2l3.2-1.8M15 14.2V18" />
      </g>;
    case 'assets':
      return <g className="folder-mark" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="11.2" y="10.8" width="7.4" height="6.8" rx="1.5" fill="var(--s1, #121212)" />
        <circle cx="13.4" cy="13" r=".7" fill="currentColor" stroke="none" />
        <path d="m12.3 16.5 1.8-1.9 1.2 1.1 1-1 1.3 1.8" />
      </g>;
    case 'fixtures':
      return <g className="folder-mark" fill="currentColor">
        <rect x="11.2" y="10.8" width="7.4" height="7.4" rx="1.6" fill="var(--s1, #121212)" stroke="currentColor" strokeWidth="1.15" />
        <circle cx="13.5" cy="13.2" r=".85" />
        <circle cx="16.3" cy="13.2" r=".85" />
        <circle cx="13.5" cy="15.9" r=".85" />
        <circle cx="16.3" cy="15.9" r=".85" />
      </g>;
  }
}

function FileGlyph({ format }: { format: Exclude<FileFormatKind, 'folder'> }) {
  switch (format) {
    case 'ts':
    case 'dts':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="14" height="14" rx="2.6" fill="currentColor" fillOpacity={format === 'dts' ? '.04' : '.1'} strokeDasharray={format === 'dts' ? '2 1.5' : undefined} />
        <path d="M5.6 9.3h3.8M7.5 9.3v4.8" />
        <path d="M13.8 9.8c-.4-.4-.9-.6-1.5-.6-.8 0-1.3.4-1.3 1 0 1.4 3 .8 3 2.5 0 .8-.6 1.4-1.5 1.4-.7 0-1.3-.2-1.8-.7" />
      </g>;
    case 'tsx':
    case 'jsx':
      return <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <ellipse cx="10" cy="10" rx="7.6" ry="2.9" />
        <ellipse cx="10" cy="10" rx="7.6" ry="2.9" transform="rotate(60 10 10)" />
        <ellipse cx="10" cy="10" rx="7.6" ry="2.9" transform="rotate(120 10 10)" />
        <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
      </g>;
    case 'js':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="14" height="14" rx="2.6" fill="currentColor" fillOpacity=".1" />
        <path d="M8.5 9.2v3.6c0 .9-.5 1.4-1.3 1.4-.6 0-1-.2-1.3-.6" />
        <path d="M13.8 9.8c-.4-.4-.9-.6-1.5-.6-.8 0-1.3.4-1.3 1 0 1.4 3 .8 3 2.5 0 .8-.6 1.4-1.5 1.4-.7 0-1.3-.2-1.8-.7" />
      </g>;
    case 'md':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="4.5" width="15" height="11" rx="2" fill="currentColor" fillOpacity=".08" />
        <path d="M5.2 12.4V7.8l1.9 2.3L9 7.8v4.6M13.3 7.8v4.5m0 0-1.5-1.5m1.5 1.5 1.5-1.5" />
      </g>;
    case 'json':
      return <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.6 4.5c-1.4 0-1.8.8-1.8 2v2c0 .9-.6 1.5-1.3 1.5.7 0 1.3.6 1.3 1.5v2c0 1.2.4 2 1.8 2" />
        <path d="M12.4 4.5c1.4 0 1.8.8 1.8 2v2c0 .9.6 1.5 1.3 1.5-.7 0-1.3.6-1.3 1.5v2c0 1.2-.4 2-1.8 2" />
        <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
      </g>;
    case 'yml':
      return <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 5.5v9M5 7h4M8.5 10h6.5M8.5 13h5M5 10h1.5" />
        <circle cx="15" cy="6.2" r="1.1" fill="currentColor" stroke="none" />
      </g>;
    case 'toml':
      return <g fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.8 4.5H4.5v11h2.3M13.2 4.5h2.3v11h-2.3M8 8h4M10 8v5" />
      </g>;
    case 'manifest':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10 2.7 6.5 3.6v7.4L10 17.3l-6.5-3.6V6.3Z" fill="currentColor" fillOpacity=".09" />
        <path d="m3.5 6.3 6.5 3.6 6.5-3.6M10 9.9v7.4M6.8 4.5l6.5 3.6" />
      </g>;
    case 'lock':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.8 8.5V6.7a3.2 3.2 0 1 1 6.4 0v1.8" />
        <rect x="4.8" y="8.5" width="10.4" height="8" rx="2" fill="currentColor" fillOpacity=".1" />
        <circle cx="10" cy="12.3" r="1" fill="currentColor" stroke="none" />
      </g>;
    case 'config':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="2.3" />
        <path d="M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.2 5.2l1.1 1.1M13.7 13.7l1.1 1.1M14.8 5.2l-1.1 1.1M6.3 13.7l-1.1 1.1" />
        <circle cx="10" cy="10" r="5" />
      </g>;
    case 'test':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 3.5h5M8.5 3.5v4.3l-3.7 6.3a1.5 1.5 0 0 0 1.3 2.2h7.8a1.5 1.5 0 0 0 1.3-2.2l-3.7-6.3V3.5" />
        <path d="M6.4 12.2h7.2l1 1.9a.7.7 0 0 1-.6 1H6a.7.7 0 0 1-.6-1Z" fill="currentColor" fillOpacity=".2" stroke="none" />
      </g>;
    case 'env':
      return <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.2" cy="10" r="3" fill="currentColor" fillOpacity=".1" />
        <path d="M10.2 10h6.6M14.2 10v2.4M16.5 10v1.8" />
      </g>;
    case 'git':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10 2.5 7.5 7.5-7.5 7.5L2.5 10Z" fill="currentColor" fillOpacity=".1" />
        <path d="m7.2 7.2 5.6 5.6M7.2 7.2v5.6" />
        <circle cx="7.2" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="7.2" cy="12.8" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12.8" cy="12.8" r="1.2" fill="currentColor" stroke="none" />
      </g>;
    case 'license':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="8.2" r="4.3" fill="currentColor" fillOpacity=".1" />
        <circle cx="10" cy="8.2" r="1.8" />
        <path d="m7.8 11.9-.7 5.1 2.9-1.6 2.9 1.6-.7-5.1" />
      </g>;
    case 'docker':
      return <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.2h12.2c.8 0 1.6-.5 2.1-1.2.4.7.3 1.9-.3 2.7-1.1 1.6-3.1 2.5-6 2.5-4.3 0-7.2-1.8-8-4Z" fill="currentColor" fillOpacity=".1" />
        <path d="M5.5 8.5h2v2.4h-2ZM8.3 8.5h2v2.4h-2ZM11.1 8.5h2v2.4h-2ZM8.3 5.8h2v2.4h-2Z" />
      </g>;
    case 'make':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.2 7.2 7.6 3.8l2.6 2.6-3.4 3.4Z" fill="currentColor" fillOpacity=".12" />
        <path d="m8.9 8.9 6.6 6.6a1.1 1.1 0 0 1-1.6 1.6l-6.6-6.6" />
      </g>;
    case 'css':
    case 'scss':
      return <g fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        <path d="m8 4-1.5 12M13.5 4 12 16M4.5 7.8h11.5M4 12.4h11.5" />
        {format === 'scss' && <circle cx="15.8" cy="15.6" r="1.4" fill="currentColor" stroke="none" />}
      </g>;
    case 'html':
      return <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 6 3 10l4 4M13 6l4 4-4 4M11 4.8 9 15.2" />
      </g>;
    case 'xml':
      return <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5 3.5 10l3 3.5M13.5 6.5l3 3.5-3 3.5M8.8 14.5l2.4-9" />
      </g>;
    case 'vue':
      return <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4.5h3.4L10 10.8 13.6 4.5H17l-7 11.8Z" fill="currentColor" fillOpacity=".1" />
        <path d="M6.4 4.5 10 10.8l3.6-6.3" />
      </g>;
    case 'svelte':
      return <g fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.8 5.2a3.3 3.3 0 0 0-4.6-.5L6.4 6.6a3 3 0 0 0 .5 5.1l2.8 1.2a1.7 1.7 0 0 1 .2 2.9l-1.9 1.2a3.2 3.2 0 0 1-4.2-.8" />
        <path d="M10.4 7.7 7.8 9.4M12.5 10.6l-2.6 1.7" />
      </g>;
    case 'svg':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 14.5C4.5 8.5 15.5 11.5 15.5 5.5" />
        <path d="M4.5 5.5h5M10.5 14.5h5" strokeOpacity=".6" />
        <rect x="3.2" y="13.2" width="2.6" height="2.6" fill="currentColor" fillOpacity=".2" />
        <rect x="14.2" y="4.2" width="2.6" height="2.6" fill="currentColor" fillOpacity=".2" />
        <circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
      </g>;
    case 'image':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="12" rx="2" fill="currentColor" fillOpacity=".07" />
        <circle cx="7.2" cy="7.8" r="1.2" fill="currentColor" stroke="none" />
        <path d="m4.5 14.2 3.8-4 2.5 2.4 1.8-1.9 2.9 3.5" />
      </g>;
    case 'py':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3.2c-2.5 0-2.7 1-2.7 2.2v1.8h4.5v.8H6c-1.5 0-2.5 1-2.5 2.7 0 1.8 1 2.8 2.4 2.8h1.4v-1.9c0-1.4 1.1-2.4 2.5-2.4h3c1.2 0 2-.8 2-2V5.4c0-1.3-.9-2.2-2.7-2.2Z" fill="currentColor" fillOpacity=".12" />
        <path d="M10 16.8c2.5 0 2.7-1 2.7-2.2v-1.8H8.2V12H14c1.5 0 2.5-1 2.5-2.7 0-1.8-1-2.8-2.4-2.8h-1.4v1.9c0 1.4-1.1 2.4-2.5 2.4h-3c-1.2 0-2 .8-2 2v1.8c0 1.3.9 2.2 2.7 2.2Z" />
        <circle cx="8.5" cy="5.2" r=".7" fill="currentColor" stroke="none" />
        <circle cx="11.5" cy="14.8" r=".7" fill="currentColor" stroke="none" />
      </g>;
    case 'ipynb':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4.5" y="3" width="11.5" height="14" rx="1.8" fill="currentColor" fillOpacity=".08" />
        <path d="M3 6.5h2.2M3 10h2.2M3 13.5h2.2" />
        <circle cx="10.4" cy="10" r="2.7" />
      </g>;
    case 'go':
      return <g fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.6 8.3a2.6 2.6 0 1 0-1.1 4.9c1.2 0 1.9-.8 2-1.8H8.6" />
        <circle cx="14.2" cy="10.6" r="2.6" />
        <path d="M3.2 8.2h2.4M2.5 10.6h2" />
      </g>;
    case 'rs':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="5.3" fill="currentColor" fillOpacity=".08" />
        <path d="M10 3v1.6M10 15.4V17M3 10h1.6M15.4 10H17M5 5l1.2 1.2M13.8 13.8 15 15M15 5l-1.2 1.2M6.2 13.8 5 15" />
        <path d="M8.3 12.6V7.4h2.1a1.4 1.4 0 0 1 0 2.8H8.3m1.9 0 1.7 2.4" />
      </g>;
    case 'java':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 9.5h6.5v3.2a3.25 3.25 0 0 1-6.5 0Z" fill="currentColor" fillOpacity=".1" />
        <path d="M13 10h1.6a1.4 1.4 0 0 1 0 2.8H13M5.5 16.5h9M8.5 6.8c-.7-.8.7-1.6 0-2.6M11.2 6.8c-.7-.8.7-1.6 0-2.6" />
      </g>;
    case 'kt':
      return <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 4h11l-6 6 6 6h-11Z" fill="currentColor" fillOpacity=".1" />
        <path d="M4.5 16 10 10" />
      </g>;
    case 'c':
    case 'cpp':
    case 'cs':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2.8 16.2 6.4v7.2L10 17.2 3.8 13.6V6.4Z" fill="currentColor" fillOpacity=".1" />
        <path d="M10.8 8a2.3 2.3 0 1 0 0 4" />
        {format === 'cpp' && <path d="M12.4 10h2.4M13.6 8.8v2.4" />}
        {format === 'cs' && <path d="M12.4 8.2v3.6M14.2 8.2v3.6M11.8 9.4h3M11.8 10.8h3" />}
      </g>;
    case 'rb':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 4.5h9l3 4-7.5 8-7.5-8Z" fill="currentColor" fillOpacity=".1" />
        <path d="M2.5 8.5h15M5.5 4.5l2 4 2.5 8 2.5-8 2-4" />
      </g>;
    case 'php':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="10" cy="10" rx="7.6" ry="4.5" fill="currentColor" fillOpacity=".09" />
        <path d="M6.4 11.7V8.3h1.4a1.1 1.1 0 0 1 0 2.1H6.4M10 11.7V7.4M10 9.6h1.3a1 1 0 0 1 1 1v1.1M14 11.7V8.3h1.3a1.1 1.1 0 0 1 0 2.1H14" />
      </g>;
    case 'swift':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4.5c1.8 3.2 1.2 6.8-1 9l2.4 2c-3 .6-5.5.1-8.4-1.5C5.5 12.6 4 10.5 3.4 8.2c2.2 2 4.8 3.1 7.6 3.5-2.1-1.9-4.1-4.1-5.6-6.2 2.4 1.6 4.8 3.2 7 4.4-1.2-2-2.2-3.9-2.8-5.4 1.8 1.5 3.6 3.2 5 5.2.4-1.7.4-3.4.4-5.2Z" fill="currentColor" fillOpacity=".12" />
      </g>;
    case 'dart':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="m4.5 9.5 4-5 6.8 2.2L16.5 14l-5.3 2.5L4.5 9.5Z" fill="currentColor" fillOpacity=".1" />
        <path d="M8.5 4.5 16.5 14" />
      </g>;
    case 'lua':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35">
        <circle cx="9.6" cy="10.4" r="5" fill="currentColor" fillOpacity=".1" />
        <circle cx="15.8" cy="4.8" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="11.4" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      </g>;
    case 'zig':
      return <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 6.5h9l-7 7h9M3.5 15l1.8-9.5M14.7 14.5l1.8-9.5" />
      </g>;
    case 'ex':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.4 3.2C7.4 6.6 5.5 9.7 5.5 12.6A4.5 4.5 0 0 0 10 17a4.5 4.5 0 0 0 4.5-4.4c0-2.9-1.9-6-4.1-9.4Z" fill="currentColor" fillOpacity=".1" />
      </g>;
    case 'scala':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 6.4 15 4.4v2.8L5 9.2ZM5 10.6l10-2v2.8l-10 2ZM5 14.8l10-2v2.8l-10 2Z" fill="currentColor" fillOpacity=".1" />
      </g>;
    case 'r':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="9.5" cy="9" rx="5.8" ry="4" />
        <path d="M8.5 7v8M8.5 7h3.1a1.7 1.7 0 0 1 0 3.4H8.5m2.3 0 2.6 4.6" />
      </g>;
    case 'sh':
    case 'ps1':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.8" y="4" width="14.4" height="12" rx="2" fill="currentColor" fillOpacity=".09" />
        <path d={format === 'ps1' ? 'm6 7.5 2.5 2.5L6 12.5M10 12.5h3.8M11.6 7.5 13 9' : 'm5.8 7.5 2.6 2.5-2.6 2.5M10 12.5h4'} />
      </g>;
    case 'sql':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="10" cy="5.5" rx="5.5" ry="2.2" fill="currentColor" fillOpacity=".1" />
        <path d="M4.5 5.5v9c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2v-9" />
        <path d="M4.5 10c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2" />
      </g>;
    case 'graphql':
      return <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10 3.5 5.6 3.2v6.6L10 16.5l-5.6-3.2V6.7Z" />
        <path d="m10 3.5 5.6 9.8H4.4Z" />
        <circle cx="10" cy="3.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="15.6" cy="6.7" r="1" fill="currentColor" stroke="none" />
        <circle cx="15.6" cy="13.3" r="1" fill="currentColor" stroke="none" />
        <circle cx="10" cy="16.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="4.4" cy="13.3" r="1" fill="currentColor" stroke="none" />
        <circle cx="4.4" cy="6.7" r="1" fill="currentColor" stroke="none" />
      </g>;
    case 'prisma':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.6 3.2 4.2 13l3.6 3.8 7.8-2.3Z" fill="currentColor" fillOpacity=".1" />
        <path d="M9.6 3.2 7.8 16.8" />
      </g>;
    case 'diff':
      return <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 2.8h7.4l3.6 3.6v10.8h-11Z" fill="currentColor" fillOpacity=".06" />
        <path d="M8.5 7.2v3.6M6.7 9h3.6M6.7 13.8h5.6" />
      </g>;
    case 'csv':
      return <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="4" width="13" height="12" rx="1.6" fill="currentColor" fillOpacity=".07" />
        <path d="M3.5 8h13M3.5 12h13M8.2 4v12M12.2 4v12" />
      </g>;
    case 'pdf':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 2.8h7.4l3.6 3.6v10.8h-11Z" fill="currentColor" fillOpacity=".07" />
        <path d="M11.9 2.8v3.6h3.6" />
        <path d="M7.5 14c1.2-2.6 2-5 1.8-6.4-.2-1-.9-.2-.6.8.5 1.7 3 3.3 4.3 3.4 1 .1.8-1-.3-.8-1.5.2-3.8 1.5-5.2 3Z" />
      </g>;
    case 'archive':
      return <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3.5" width="12" height="13" rx="1.8" fill="currentColor" fillOpacity=".08" />
        <path d="M10 3.5v13M8.5 6h1.5M10 8h1.5M8.5 10h1.5M10 12h1.5" />
      </g>;
    case 'txt':
      return <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 2.8h7.4l3.6 3.6v10.8h-11Z" fill="currentColor" fillOpacity=".06" />
        <path d="M11.9 2.8v3.6h3.6M7 9.5h6M7 12h6M7 14.5h4" />
      </g>;
  }
}

/** Crisp repository file and folder glyphs; muted colour marks language family without outshining evidence. */
export function FileIcon({ path, folder = false, open = false }: { path: string; folder?: boolean; open?: boolean }) {
  const { format, folderMark } = resolveFileIcon(path, folder);
  const classes = ['file-format', `format-${format}`, folderMark ? `folder-${folderMark}` : ''].filter(Boolean).join(' ');
  return (
    <svg className={classes} width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      {format === 'folder' ? (
        <>
          {open ? (
            <>
              <path d="M2.5 5.8A1.4 1.4 0 0 1 3.9 4.4h3.9l1.5 1.7h6.8a1.2 1.2 0 0 1 1.2 1.2v1.3H4.6L2.5 15.6Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.5 15.6 4.4 8.6h13.7l-1.9 7H2.5Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            <path d="M2.5 5.8A1.4 1.4 0 0 1 3.9 4.4h3.9l1.5 1.7h6.8a1.4 1.4 0 0 1 1.4 1.4v7.1A1.4 1.4 0 0 1 16.1 16H3.9a1.4 1.4 0 0 1-1.4-1.4Z" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {folderMark && <FolderBadge mark={folderMark} />}
        </>
      ) : (
        <FileGlyph format={format} />
      )}
    </svg>
  );
}
