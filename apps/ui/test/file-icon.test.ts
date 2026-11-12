import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileIcon, resolveFileIcon } from '../src/components/FileIcon.tsx';

describe('repository file and folder icons (FILES-17)', () => {
  const icon = (path: string, folder = false, open = false) =>
    renderToStaticMarkup(createElement(FileIcon, { path, folder, open }));

  it('recognizes module/header aliases and common language extensions', () => {
    expect(icon('source.mts')).toContain('format-ts');
    expect(icon('source.cts')).toContain('format-ts');
    expect(icon('types.d.ts')).toContain('format-dts');
    expect(icon('Component.tsx')).toContain('format-tsx');
    expect(icon('script.cjs')).toContain('format-js');
    expect(icon('script.mjs')).toContain('format-js');
    expect(icon('App.jsx')).toContain('format-jsx');
    expect(icon('header.hpp')).toContain('format-cpp');
    expect(icon('impl.cc')).toContain('format-cpp');
    expect(icon('main.c')).toContain('format-c');
    expect(icon('Program.cs')).toContain('format-cs');
    expect(icon('model.swift')).toContain('format-swift');
    expect(icon('worker.go')).toContain('format-go');
    expect(icon('lib.rs')).toContain('format-rs');
    expect(icon('app.py')).toContain('format-py');
    expect(icon('notebook.ipynb')).toContain('format-ipynb');
    expect(icon('Service.java')).toContain('format-java');
    expect(icon('Screen.kt')).toContain('format-kt');
    expect(icon('Gem.rb')).toContain('format-rb');
    expect(icon('index.php')).toContain('format-php');
    expect(icon('main.dart')).toContain('format-dart');
    expect(icon('init.lua')).toContain('format-lua');
    expect(icon('build.zig')).toContain('format-zig');
    expect(icon('app.ex')).toContain('format-ex');
    expect(icon('Main.scala')).toContain('format-scala');
    expect(icon('stats.r')).toContain('format-r');
  });

  it('recognizes docs, data, web, shell, config, test, secret, lock and manifest files', () => {
    const cases: [string, string][] = [
      ['README.md', 'format-md'],
      ['guide.mdx', 'format-md'],
      ['settings.json', 'format-json'],
      ['tsconfig.base.json', 'format-config'],
      ['vite.config.ts', 'format-config'],
      ['playwright.config.ts', 'format-config'],
      ['vitest.config.mts', 'format-config'],
      ['package.json', 'format-manifest'],
      ['Cargo.toml', 'format-manifest'],
      ['pyproject.toml', 'format-manifest'],
      ['go.mod', 'format-manifest'],
      ['pnpm-lock.yaml', 'format-lock'],
      ['package-lock.json', 'format-lock'],
      ['Cargo.lock', 'format-lock'],
      ['workflow.yml', 'format-yml'],
      ['values.yaml', 'format-yml'],
      ['config.toml', 'format-toml'],
      ['theme.css', 'format-css'],
      ['theme.scss', 'format-scss'],
      ['index.html', 'format-html'],
      ['pom.xml', 'format-manifest'],
      ['feed.xml', 'format-xml'],
      ['App.vue', 'format-vue'],
      ['Card.svelte', 'format-svelte'],
      ['logo.svg', 'format-svg'],
      ['preview.png', 'format-image'],
      ['photo.webp', 'format-image'],
      ['run.sh', 'format-sh'],
      ['setup.ps1', 'format-ps1'],
      ['schema.sql', 'format-sql'],
      ['schema.graphql', 'format-graphql'],
      ['schema.prisma', 'format-prisma'],
      ['Dockerfile', 'format-docker'],
      ['docker-compose.yml', 'format-docker'],
      ['Makefile', 'format-make'],
      ['.env', 'format-env'],
      ['.env.local', 'format-env'],
      ['.gitignore', 'format-git'],
      ['.gitattributes', 'format-git'],
      ['LICENSE', 'format-license'],
      ['file.spec.ts', 'format-test'],
      ['unit.test.tsx', 'format-test'],
      ['math_test.go', 'format-test'],
      ['test_api.py', 'format-test'],
      ['changes.patch', 'format-diff'],
      ['rows.csv', 'format-csv'],
      ['manual.pdf', 'format-pdf'],
      ['bundle.zip', 'format-archive'],
      ['notes.txt', 'format-txt'],
    ];
    for (const [path, expectedClass] of cases) {
      expect(icon(path), path).toContain(expectedClass);
    }
  });

  it('adds calm corner marks for well-known folders open and closed while keeping generic folders plain', () => {
    const marked = [
      ['.git', 'git'],
      ['.github', 'github'],
      ['.claude', 'agent'],
      ['.codex', 'agent'],
      ['.agents', 'agent'],
      ['apps', 'src'],
      ['src', 'src'],
      ['packages', 'src'],
      ['docs', 'docs'],
      ['tests', 'tests'],
      ['scripts', 'scripts'],
      ['dist', 'dist'],
      ['node_modules', 'modules'],
      ['public', 'assets'],
      ['fixtures', 'fixtures'],
    ] as const;

    for (const [folderPath, expectedMark] of marked) {
      expect(resolveFileIcon(folderPath, true)).toEqual({ format: 'folder', folderMark: expectedMark });
      const closedMarkup = icon(`repo/${folderPath}`, true, false);
      const openMarkup = icon(`repo/${folderPath}`, true, true);
      expect(closedMarkup).toContain(`folder-${expectedMark}`);
      expect(closedMarkup).toContain('class="folder-mark"');
      expect(openMarkup).toContain(`folder-${expectedMark}`);
      expect(openMarkup).not.toEqual(closedMarkup);
    }

    expect(resolveFileIcon('misc-folder', true)).toEqual({ format: 'folder', folderMark: undefined });
    expect(icon('misc-folder', true, false)).not.toContain('class="folder-mark"');
  });

  it('keeps fixed 18x18 intrinsic dimensions so row heights never change', () => {
    const markup = icon('apps/ui/src/components/FileIcon.tsx');
    expect(markup).toContain('width="18"');
    expect(markup).toContain('height="18"');
    expect(markup).toContain('viewBox="0 0 20 20"');
  });
});
