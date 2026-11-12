// SITE-1: Drishya's Modern screen recreated in the site's DOM so it can animate (arrivals, cursor, zoom).
// Layout, chrome and the kinds of content follow the real product (scripts/site-footage.ts frames are the reference);
// the content itself is a crafted showcase session on a SkeletonGraph-like Python repository.

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const kw = (line: string) => esc(line)
  .replace(/(#.*)$/, '<span class="c">$1</span>')
  .replace(/\b(def|return|if|for|in|import|from|class|not|None|True|False|and|or|lambda|sorted|key|reverse)\b/g, '<span class="k">$1</span>')
  .replace(/(&#39;[^&]*&#39;|&quot;[^&]*&quot;)/g, '<span class="s">$1</span>');
const code = (lines: string[], start = 1, marks: Record<number, 'add' | 'del'> = {}) =>
  `<pre class="dr-code">${lines.map((l, i) => `<span class="dr-ln ${marks[i] ?? ''}"><i>${marks[i] === 'add' ? '+' : marks[i] === 'del' ? '−' : start + i}</i>${kw(l) || ' '}</span>`).join('')}</pre>`;

const ICON: Record<string, string> = {
  read: '<svg viewBox="0 0 20 20"><path d="M4 3h8l4 4v10H4z"/><path d="M12 3v4h4"/></svg>',
  search: '<svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5"/><path d="m13 13 4 4"/></svg>',
  test: '<svg viewBox="0 0 20 20"><path d="M3 5h3M3 10h3M3 15h3M9 5h8M9 10h8M9 15h8"/></svg>',
  edit: '<svg viewBox="0 0 20 20"><path d="m4 16 1-4 8-8 3 3-8 8z"/></svg>',
  mcp: '<svg viewBox="0 0 20 20"><path d="m10 3 7 7-7 7-7-7z"/></svg>',
};
const check = '<svg class="dr-ok" viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"/></svg>';
const cross = '<svg class="dr-bad" viewBox="0 0 20 20"><path d="m6 6 8 8M14 6l-8 8"/></svg>';

function card(kind: string, title: string, sub: string, body: string, opts: { fail?: boolean; id?: string } = {}) {
  return `<article class="dr-card${opts.fail ? ' fail' : ''}" data-dr-card="${opts.id ?? ''}"><header><span class="dr-ic ${kind}">${ICON[kind]}</span><div><b>${esc(title)}</b><small>${esc(sub)}</small></div>${opts.fail ? cross : check}</header><div class="dr-body">${body}</div></article>`;
}

const PAGERANK = ['def rank_symbols(graph, seeds):', '    scores = personalized_pagerank(graph, seeds)', '    # Callees inherit rank from every caller,', '    # so helpers outrank the entry points.', '    return sorted(scores, key=scores.get,', '                  reverse=True)'];
const DIFF = ['def rank_symbols(graph, seeds):', '    scores = personalized_pagerank(graph, seeds)', '    return sorted(scores, key=scores.get, reverse=True)', '    for sym in scores:', '        scores[sym] += CALLER_BONUS * graph.in_calls(sym)', '    return sorted(scores, key=scores.get, reverse=True)'];

export function productScreen(): string {
  const tree = [
    ['d', 0, 'docs', ''], ['d', 0, 'eval', ''], ['d', 0, 'src', '', 'open'], ['d', 1, 'skeletongraph', '', 'open'], ['d', 2, 'graph', '', 'open'],
    ['f', 3, 'bm25.py', 'R'], ['f', 3, 'dependency.py', 'R'], ['f', 3, 'pagerank.py', 'E', 'hot'], ['f', 2, 'engine.py', 'R'], ['f', 2, 'config.py', ''],
    ['d', 0, 'tests', '', 'open'], ['f', 1, 'test_ranking.py', 'E'], ['f', 0, 'README.md', ''], ['f', 0, 'pyproject.toml', ''],
  ] as const;
  const treeHTML = tree.map(([t, depth, name, mark, flag]) => `<li class="${t === 'd' ? 'dir' : 'file'} ${flag ?? ''}" style="--d:${depth}" ${name === 'pagerank.py' ? 'data-dr-file' : ''}>${t === 'd' ? '<em>›</em><span class="dr-folder"></span>' : '<span class="dr-py"></span>'}${name}${mark ? `<b class="m-${mark}">${mark}</b>` : ''}</li>`).join('');

  const row1 = [
    card('read', 'pagerank.py', 'Read · src/skeletongraph/graph', code(PAGERANK, 41), { id: 'r1' }),
    card('search', '“def rank_symbols”', 'Search · 3 matches', `<ul class="dr-hits"><li>graph/pagerank.py<i>41</i></li><li>engine.py<i>118</i></li><li>tests/test_ranking.py<i>12</i></li></ul>`, { id: 'r2' }),
    card('mcp', 'find_symbol', 'skeletongraph · MCP', `<ul class="dr-hits"><li>rank_symbols<i>0.93</i></li><li>search_entry<i>0.71</i></li><li>personalized_pagerank<i>0.64</i></li></ul>`, { id: 'r3' }),
  ].join('');
  const row2 = [
    card('test', 'pytest tests/test_ranking.py', 'Test', `<div class="dr-term">$ pytest tests/test_ranking.py<br><span class="bad">FAILED</span> test_callers_rank_first<br>  assert ranked[0] == 'search_entry'<br><span class="bad">1 failed</span>, 11 passed</div>`, { id: 'r4', fail: true }),
    card('edit', 'pagerank.py', 'Edit · +2 −1', code(DIFF, 41, { 2: 'del', 3: 'add', 4: 'add' }), { id: 'r5' }),
    card('test', 'pytest tests/test_ranking.py', 'Test', `<div class="dr-term">$ pytest tests/test_ranking.py<br><span class="ok">12 passed</span> in 0.84s<br><span class="dr-bars">${'<i></i>'.repeat(12)}</span></div>`, { id: 'r6' }),
  ].join('');

  const toolbox = [['read', 'Read', 14], ['search', 'Search', 9], ['edit', 'Edit', 3], ['shell', 'Shell', 6], ['test', 'Test', 2]]
    .map(([k, n, v]) => `<li><i class="t-${k}"></i>${n}<b>${v}</b></li>`).join('');

  return `
  <div class="dr-screen" data-dr-screen>
    <div class="dr-camera" data-dr-camera>
      <div class="dr-dots"></div>
      <header class="dr-head"><div class="dr-capsule"><span class="dr-avatar"></span><div><b>Rank callers above callees</b><small>● skeletongraph <span>⑂ fix/rank-callers</span> Claude Code</small></div></div>
        <div class="dr-actions"><span data-dr-open="changes">Changes</span><i></i><i data-dr-open="graph"></i><i></i><i></i><i></i></div></header>
      <div class="dr-tabs"><span class="on">Files</span><span>Repository</span></div>
      <aside class="dr-files"><div class="dr-files-head">skeletongraph <em>‹</em></div><div class="dr-find">Find files…</div><ul>${treeHTML}</ul></aside>
      <main class="dr-history">
        <p class="dr-prompt">Search returns helpers before the functions that call them. Rank callers first and keep the tests green.</p>
        <div class="dr-passage">${row1}</div>
        <div class="dr-passage">${row2}</div>
        <p class="dr-prose" data-dr-prose>Callers now rank above the functions they call, so <code>search_entry</code> comes first. <code>test_ranking.py</code> passes, 12 of 12.</p>
      </main>
      <aside class="dr-toolbox"><div class="dr-tb-head">Toolbox</div><ul>${toolbox}</ul><div class="dr-tb-mcp"><i></i>skeletongraph<span>MCP ›</span></div><div class="dr-tb-mcp"><i></i>Agents<span>1 ›</span></div></aside>
      <div class="dr-composer">Ask your agent…</div><div class="dr-follow"><i></i>Follow latest</div>

      <section class="dr-peek" data-dr-layer="peek">
        <header><span class="dr-py"></span><b>pagerank.py</b><small>src/skeletongraph/graph</small></header>
        <div class="dr-peek-tabs"><span>Source</span><span class="on">History</span></div>
        <ol class="dr-history-list">
          <li class="now"><b>This session</b><span>Edit · +2 −1 · Claude Code</span><em>Rank callers first</em></li>
          <li><b>3 Nov</b><span>Edit · +18 −4 · Codex</span><em>Damp scores for test files</em></li>
          <li><b>28 Oct</b><span>Read · Claude Code</span><em>Profile slow searches</em></li>
          <li><b>21 Oct</b><span>Created · Claude Code</span><em>Personalized PageRank over the call graph</em></li>
        </ol>
      </section>

      <section class="dr-window dr-workspace" data-dr-layer="workspace">
        <header><b>Workspace</b><small>skeletongraph · Current files</small><span>Back to agent</span></header>
        <div class="dr-ws-tabs"><span class="on">pagerank.py</span><span>engine.py</span><span>test_ranking.py</span></div>
        <div class="dr-ws-body">${code(['from .dependency import CallGraph', '', 'CALLER_BONUS = 0.15', '', ...PAGERANK.slice(0, 2), '    for sym in scores:', '        scores[sym] += CALLER_BONUS * graph.in_calls(sym)', '    return sorted(scores, key=scores.get, reverse=True)'], 36)}
          <aside><b>Earlier changes</b><p><i class="t-edit"></i>Lines 42–43 · this session</p><p><i class="t-edit"></i>Lines 12–30 · 3 Nov · Codex</p></aside></div>
      </section>

      <section class="dr-window dr-changes" data-dr-layer="changes">
        <header><b>Changes</b><nav><span>Uncommitted</span><span>This session</span><span class="on">Branch</span><span>Pull request</span></nav><span>Back to agent</span></header>
        <div class="dr-ch-line"><b>main</b> ← <b>fix/rank-callers</b><span>2 ahead · 1 behind</span></div>
        <div class="dr-ch-body"><ul>
          <li class="g">Changed on both <i>1</i></li><li class="f">engine.py<small>src/skeletongraph · Codex 1 edit</small><em>+4 −1</em></li>
          <li class="g">Only on fix/rank-callers <i>2</i></li><li class="f on">pagerank.py<small>graph · Claude Code 1 edit</small><em>+2 −1</em></li><li class="f">test_ranking.py<small>tests · Claude Code 1 edit</small><em>+9</em></li></ul>
          <div>${code(DIFF, 41, { 2: 'del', 3: 'add', 4: 'add' })}</div></div>
      </section>

      <section class="dr-window dr-graph" data-dr-layer="graph">
        <header><b>Git graph</b><small>All local history · 4 branches</small><span>×</span></header>
        <div class="dr-graph-body"><svg viewBox="0 0 520 250" aria-hidden="true">
          <path class="l0" d="M40 30V230"/><path class="l1" d="M40 70C40 90 110 90 110 110V150"/><path class="l2" d="M40 150C40 170 180 170 180 190V210"/><path class="l3" d="M110 130C110 140 250 140 250 150"/>
          <g class="n0"><circle cx="40" cy="30" r="6"/><circle cx="40" cy="70" r="6"/><circle cx="40" cy="110" r="6"/><circle cx="40" cy="150" r="6"/><circle cx="40" cy="230" r="6"/></g>
          <g class="n1"><circle cx="110" cy="110" r="6"/><circle cx="110" cy="150" r="7"/></g><g class="n2"><circle cx="180" cy="210" r="6"/></g><g class="n3"><circle cx="250" cy="150" r="6"/></g>
        </svg><ul>
          <li><code>a41c9e2</code>Rank callers above callees<span class="b1">fix/rank-callers</span><em>Claude Code</em></li>
          <li><code>7d02b1f</code>Damp scores for test files<span class="b3">feature/bm25-weights</span><em>Codex</em></li>
          <li><code>e93f004</code>Cache parsed trees between runs<span class="b0">main</span><em></em></li>
          <li><code>51aa7c3</code>Release 0.4.2<span class="b2">release/0.4</span><em></em></li>
        </ul></div>
      </section>

      <div class="dr-cursor" data-dr-cursor><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.5L10 19z"/></svg></div>
    </div>
  </div>`;
}

export function terminalScreen(): string {
  const lines = [
    ['p', '> Search returns helpers before the functions that call them. Rank callers first and keep the tests green.'],
    ['b', '● Read(src/skeletongraph/graph/pagerank.py)'], ['r', '  ⎿  Read 84 lines'],
    ['b', '● Search(pattern: "def rank_symbols")'], ['r', '  ⎿  Found 3 files'],
    ['b', '● skeletongraph - find_symbol (MCP)'], ['r', '  ⎿  rank_symbols, search_entry, personalized_pagerank'],
    ['b', '● Bash(pytest tests/test_ranking.py)'], ['r', '  ⎿  1 failed, 11 passed'],
    ['b', '● Update(src/skeletongraph/graph/pagerank.py)'], ['r', '  ⎿  Updated with 2 additions and 1 removal'],
    ['b', '● Bash(pytest tests/test_ranking.py)'], ['r', '  ⎿  12 passed in 0.84s'],
    ['t', '● Callers now rank above the functions they call, so search_entry comes first. The ranking tests pass, 12 of 12.'],
  ];
  return `<div class="term" data-term><div class="term-bar"><span class="dot-row"><i></i><i></i><i></i></span>skeletongraph — claude</div><div class="term-lines">${lines.map(([k, t]) => `<div class="tl ${k}">${esc(t!)}</div>`).join('')}</div></div>`;
}
