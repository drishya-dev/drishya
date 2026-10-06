// Deliberately separate design experiments. Only the committed synthetic bundle is read.
// No harness control, persistence, network service, generated reasoning or invented edges.
const root = document.querySelector('#app');
const direction = document.body.dataset.direction;
const names = { studio: 'Studio', relay: 'Relay', atlas: 'Atlas' };
const descriptions = { studio: 'One chronological stage. Content gets the space it needs.', relay: 'One recording, several agent lanes. Compare ownership at a glance.', atlas: 'The repository is the stage. Bring its recorded work into focus.' };
const escape = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
try {
  const response = await fetch('../demo/bundle.json');
  if (!response.ok) throw new Error('The synthetic bundle could not be loaded.');
  const bundle = await response.json();
  const p = bundle.projection;
  const operations = new Map(p.operations.map((op) => [op.id, op]));
  const prose = new Map(p.prose.map((item) => [item.id, item]));
  const agents = new Map(p.agents.map((agent, i) => [agent.id, { ...agent, color: ['#ddb878', '#91a9e8', '#83c5ad'][i % 3] }]));
  let count = Math.min(2, p.passages.length);
  let path;
  let tool;
  let agentId;
  let follow = true;
  let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let map = true;
  let activeAnimation;
  let lastTrigger;
  const native = new Map();
  const servers = new Map();
  for (const op of p.operations) {
    if (op.origin.type === 'mcp') {
      if (!servers.has(op.origin.server)) servers.set(op.origin.server, new Set());
      servers.get(op.origin.server).add(op.origin.tool);
    } else {
      if (!native.has(op.kind)) native.set(op.kind, new Set());
      native.get(op.kind).add(op.tool);
    }
  }
  root.innerHTML = `<div class="experience">
    <header class="crown"><a class="brand" href="index.html"><i></i>Drishya<span> / ${names[direction]}</span></a><div class="agent-crown" aria-label="Captured agents">${[...agents.values()].map((agent) => `<button data-agent="${escape(agent.id)}" style="--agent:${agent.color}"><i></i>${escape(agent.label)}<small>recorded</small></button>`).join('')}</div><a class="directions" href="index.html">Design directions ↗</a></header>
    <div class="world" aria-label="Recorded repository locations"><svg class="world-map" aria-label="Files-only map; no dependency edges were captured"></svg></div>
    <aside class="context"><div class="eyebrow">REPOSITORY / SHOP</div><h2>Your code,<br>in context.</h2><p class="context-caption">${p.files.length} recorded files<br>Locations, not runtime flow</p><div class="file-index">${p.files.map((file) => { const parts = file.path.split('/'); const name = parts.pop(); return `<button data-file="${escape(file.path)}"><span>${escape(parts.join('/'))}/</span><strong>${escape(name)}</strong><i></i></button>`; }).join('')}</div><p class="context-foot">Select a file to trace its captured work. No current source is read.</p></aside>
    <main class="stage"><div class="intro"><div class="eyebrow">DESIGN PROTOTYPE / SYNTHETIC RECORDING</div><h1>${escape(p.title)}</h1><p>${descriptions[direction]}</p><div class="orientation"><span>↓ Work accumulates</span><span class="selection-note">Captured content · selectable and complete</span><button class="clear" hidden>Clear selection ↗</button></div></div><div class="history" tabindex="0" aria-label="Captured history"></div><button class="return" hidden>Return to latest ↓</button></main>
    <aside class="tools" aria-label="Observed tools"><div class="eyebrow">INSTRUMENTS</div><h2>Tools</h2><p class="tool-caption">Observed in the full synthetic recording.<br>Not the harness's available-tool catalog.</p><div class="native-tools">${[...native].map(([kind, tools]) => `<button class="instrument" data-kind="${escape(kind)}"><span class="instrument-mark">↗</span><span><strong>${escape(kind[0].toUpperCase() + kind.slice(1))}</strong><small>${escape([...tools].join(' · '))}</small></span><em>${p.operations.filter((op) => op.kind === kind && op.origin.type !== 'mcp').length}</em></button>`).join('')}</div><div class="eyebrow server-label">MCP SERVERS</div>${[...servers].map(([server, tools]) => `<section class="server"><h3>${escape(server)}</h3>${[...tools].map((name) => `<button data-tool="${escape(server + ':' + name)}"><span>${escape(name)}</span><b>↗</b></button>`).join('')}</section>`).join('')}</aside>
    <footer><span class="recording-label"><i></i>Synthetic fixture · ${p.timeline.length} recorded steps</span><span class="position"></span><div><button class="map-toggle" aria-pressed="true">Map on</button><button class="motion-toggle" aria-pressed="${motion}">${motion ? 'Motion on' : 'Motion off'}</button><button class="show-all">Show full recording</button><button class="next">Reveal next captured passage ↗</button></div></footer>
    <svg class="relationships" aria-hidden="true"></svg><dialog class="reading"><button class="close-reading" aria-label="Close reading space">Close ×</button><div class="reading-content"></div></dialog>
    <button class="mobile-tools">Tools</button>
  </div>`;
  const history = root.querySelector('.history');
  const stage = root.querySelector('.stage');
  const kinds = { read: 'READ', edit: 'CHANGE', test: 'VERIFY', shell: 'TERMINAL', search: 'SEARCH', mcp: 'MCP', spawn: 'DELEGATE' };
  const code = (text, start = 1, diff = false) => `<div class="code-lines">${String(text).replace(/\n$/, '').split('\n').map((line, i) => {
    const tone = diff && line.startsWith('+') ? 'added' : diff && line.startsWith('-') ? 'removed' : '';
    const tokens = escape(line).replace(/(\/\/.*$|\/\*.*\*\/)/g, '<span class="comment">$1</span>').replace(/\b(import|from|export|type|function|return|if|const|undefined|null|true|false)\b/g, '<span class="keyword">$1</span>');
    return `<div class="code-line ${tone}"><span class="line-number">${diff ? '' : start + i}</span><code>${tokens}</code></div>`;
  }).join('')}</div>`;
  const material = (op) => {
    const d = op.detail;
    if (d.kind === 'read') return `<div class="material-meta">${escape(d.path)}<span>captured lines ${d.startLine}–${d.startLine + d.lineCount - 1}</span></div>${code(bundle.artifactText[d.excerptArtifactId] ?? 'Content unavailable in this fixture.', d.startLine)}`;
    if (d.kind === 'edit') return `<div class="material-meta">${escape(d.path)}<span>captured patch · ${escape(d.reconstruction)}</span></div>${code(d.hunks.flatMap((hunk) => hunk.lines).join('\n'), 1, true)}`;
    if (d.kind === 'search') return `<div class="query">“${escape(d.query)}”</div><div class="search-results">${d.hits.map((hit) => `<button data-file="${escape(hit.path)}"><span>${escape(hit.path)}${hit.line ? `:${hit.line}` : ''}</span>${hit.text ? `<code>${escape(hit.text)}</code>` : ''}</button>`).join('')}</div>`;
    if (d.kind === 'test') {
      const summary = d.summary;
      return `<div class="command">$ ${escape(d.command)}</div>${summary ? `<div class="test-score"><div class="ticks" aria-label="Counts parsed from captured output, not execution order">${Array.from({ length: Math.min(32, summary.passed) }, () => '<i></i>').join('')}${Array.from({ length: Math.min(32, summary.failed) }, () => '<i class="failed"></i>').join('')}</div><strong>${summary.passed} passed <span class="${summary.failed ? 'bad' : ''}">/ ${summary.failed} failed</span></strong><small>Derived from captured output · not coverage</small></div>${summary.failures.map((failure) => `<button class="assertion" data-inspect="${escape(op.id)}"><strong>${escape(failure.name)}</strong><span>${escape(failure.message ?? '')}</span><b>Open captured output ↗</b></button>`).join('')}` : '<p>No result counts captured.</p>'}`;
    }
    if (d.kind === 'mcp') return `<div class="mcp-identity">${escape(d.server)} <span>/ ${escape(d.tool)}</span></div><details open><summary>Captured input</summary><pre>${escape(JSON.stringify(d.input, null, 2))}</pre></details><div class="mcp-result"><span class="material-caption">CAPTURED RESULT</span><pre>${escape(d.resultPreview ?? 'No result captured.')}</pre></div>`;
    if (d.kind === 'shell') return `<div class="command">$ ${escape(d.command)}</div><pre>${escape(d.outputPreview ?? 'No output captured.')}</pre>`;
    if (d.kind === 'spawn') return `<div class="delegate">↗ <strong>${escape(d.agentType)}</strong><p>${escape(d.description)}</p><pre>${escape(d.resultPreview ?? '')}</pre></div>`;
    return `<pre>${escape(JSON.stringify(d, null, 2))}</pre>`;
  };
  const article = (op) => `<article class="operation kind-${escape(op.kind)} ${op.status === 'error' ? 'failed' : ''}" data-op="${escape(op.id)}" style="--agent:${agents.get(op.agentId)?.color}"><header><span class="operation-kind">${kinds[op.kind] ?? escape(op.kind.toUpperCase())}</span><button class="op-title" data-inspect="${escape(op.id)}">${escape(op.title)}</button><span class="operation-state">${op.status === 'error' ? '×' : op.status === 'ok' ? '✓' : '—'}</span></header><div class="material">${material(op)}</div><button class="read-more" data-inspect="${escape(op.id)}">Open reading space ↗</button></article>`;
  const matches = (op) => (!path || op.paths.some((item) => item.path === path)) && (!tool || (op.origin.type === 'mcp' ? `${op.origin.server}:${op.origin.tool}` === tool : op.kind === tool)) && (!agentId || op.agentId === agentId);
  const passage = (ps) => {
    if (agentId && ps.agentId !== agentId) return '';
    const ops = ps.operationIds.map((id) => operations.get(id)).filter(Boolean).filter(matches);
    const words = path || tool ? [] : ps.proseIds.map((id) => prose.get(id)).filter(Boolean);
    if (!ops.length && !words.length) return '';
    const agent = agents.get(ps.agentId);
    return `<section class="passage" data-passage="${escape(ps.id)}" style="--agent:${agent?.color}"><div class="passage-owner"><i></i><strong>${escape(agent?.label)}</strong><span>recorded steps ${ps.firstStep}–${ps.lastStep}</span></div><div class="operations">${ops.map(article).join('')}</div>${words.map((word) => `<div class="prose"><small>${word.role === 'reasoning' ? word.exposure === 'summary' ? 'Captured reasoning summary' : 'Exposed reasoning' : 'Captured response'}</small><p>${escape(word.text)}</p></div>`).join('')}</section>`;
  };
  const update = () => {
    const top = stage.scrollTop;
    const shown = p.passages.slice(0, count);
    if (direction === 'relay') history.innerHTML = `<div class="lanes">${[...agents.values()].map((agent) => `<section class="lane"><h2 style="--agent:${agent.color}"><i></i>${escape(agent.label)}</h2>${shown.filter((ps) => ps.agentId === agent.id).map(passage).join('') || '<p class="empty">No captured work in this portion.</p>'}</section>`).join('')}</div>`;
    else history.innerHTML = shown.map(passage).join('') || '<p class="empty">No matching work in the revealed portion. Show the full recording or clear selection.</p>';
    root.querySelector('.position').textContent = `${count} / ${p.passages.length} captured passages`;
    root.querySelector('.next').disabled = count >= p.passages.length;
    root.querySelector('.show-all').disabled = count >= p.passages.length;
    const filtered = !!(path || tool || agentId);
    root.querySelector('.clear').hidden = !filtered;
    root.querySelector('.selection-note').textContent = path ?? (tool ? `Tool: ${tool}` : agentId ? agents.get(agentId).label : 'Captured content · selectable and complete');
    for (const button of root.querySelectorAll('[data-file], [data-tool], [data-kind], [data-agent]')) {
      const selected = (button.dataset.file && path === button.dataset.file) || (button.dataset.tool && tool === button.dataset.tool) || (button.dataset.kind && tool === button.dataset.kind) || (button.dataset.agent && agentId === button.dataset.agent);
      button.setAttribute('aria-pressed', String(!!selected));
    }
    stage.scrollTop = top;
    root.querySelector('.return').hidden = follow;
  };
  const stopMotion = () => {
    activeAnimation?.cancel();
    root.querySelector('.relationships').replaceChildren();
  };
  const relation = (origin, target, animate = false) => {
    stopMotion();
    if (!origin || !target) return;
    const a = origin.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (!a.width || !b.width || b.top < 70 || b.top > innerHeight - 80 || a.top < 50 || a.bottom > innerHeight - 70) return;
    const svg = root.querySelector('.relationships');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const fromRight = !!origin.closest('.tools');
    const x = fromRight ? a.left : a.right;
    const end = fromRight ? b.right : b.left;
    line.setAttribute('d', `M${x},${a.top + a.height / 2} C${x + (fromRight ? -60 : 60)},${a.top + a.height / 2} ${end + (fromRight ? 60 : -60)},${b.top + 20} ${end},${b.top + 20}`);
    line.style.stroke = getComputedStyle(target).getPropertyValue('--agent') || '#ddb878';
    svg.append(line);
    if (animate && motion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const length = line.getTotalLength();
      activeAnimation = line.animate([{ strokeDasharray: length, strokeDashoffset: length, opacity: .9 }, { strokeDasharray: length, strokeDashoffset: 0, opacity: .35 }], { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  };
  const originFor = (op) => op.origin.type === 'mcp' ? [...root.querySelectorAll('[data-tool]')].find((el) => el.dataset.tool === `${op.origin.server}:${op.origin.tool}`) : root.querySelector(`[data-kind="${op.kind}"]`);
  const reveal = () => {
    follow = false;
    const ps = p.passages[count++];
    update();
    const target = [...history.querySelectorAll('[data-passage]')].find((el) => el.dataset.passage === ps?.id);
    target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    const op = ps?.operationIds.map((id) => operations.get(id)).find(Boolean);
    if (op) requestAnimationFrame(() => relation(originFor(op), [...history.querySelectorAll('[data-op]')].find((el) => el.dataset.op === op.id), true));
  };
  const openReading = (op, trigger) => {
    stopMotion();
    follow = false;
    lastTrigger = trigger;
    const dialog = root.querySelector('.reading');
    dialog.style.setProperty('--agent', agents.get(op.agentId)?.color);
    const immediateBefore = op.artifactIds.find((id) => id.endsWith('_before') && bundle.artifactText[id] !== undefined);
    const earlierRead = op.kind === 'edit' ? p.operations.filter((item) => item.detail.kind === 'read' && item.detail.path === op.detail.path && item.startSequence < op.startSequence).sort((a, b) => b.startSequence - a.startSequence)[0] : undefined;
    const before = immediateBefore ?? earlierRead?.detail.excerptArtifactId;
    const after = op.artifactIds.find((id) => id.endsWith('_after') && bundle.artifactText[id] !== undefined);
    const states = before || after ? `<div class="reader-states"><button data-state="patch" data-state-op="${escape(op.id)}" aria-pressed="true">Captured patch</button>${[before, after].filter(Boolean).map((id) => { const artifact = p.artifacts.find((item) => item.id === id); const earlier = id === before && !immediateBefore; const label = earlier ? 'Earlier captured read' : `${artifact?.provenance.kind === 'derived' ? 'Reconstructed' : 'Captured'} ${id === before ? 'before' : 'after'}`; return `<button data-state="${escape(id)}" data-state-op="${escape(op.id)}" data-earlier-read="${earlier}" aria-pressed="false">${label}</button>`; }).join('')}</div>` : '';
    dialog.querySelector('.reading-content').innerHTML = `<div class="eyebrow">CAPTURED MATERIAL / ${escape(agents.get(op.agentId)?.label)}</div><h2>${escape(op.title)}</h2>${states}<div class="reader-material">${material(op)}</div>${op.detail.outputPreview ? `<details><summary>Full captured output preview</summary><pre>${escape(op.detail.outputPreview)}</pre></details>` : ''}<div class="reader-truth">Synthetic fixture · ${escape(op.classification.kind)} classification · ${op.observationIds.length} observation references. No current file content is substituted.</div>`;
    dialog.showModal();
    root.querySelector('.return').hidden = false;
  };
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.state) {
      const op = operations.get(button.dataset.stateOp);
      const artifact = p.artifacts.find((item) => item.id === button.dataset.state);
      for (const tab of root.querySelectorAll('.reader-states button')) tab.setAttribute('aria-pressed', String(tab === button));
      root.querySelector('.reader-material').innerHTML = button.dataset.state === 'patch' ? material(op) : `<div class="material-meta">${escape(artifact.path)}<span>${escape(artifact.provenance.kind)} snapshot${artifact.provenance.rule ? ` · ${escape(artifact.provenance.rule)}` : ''}${button.dataset.earlierRead === 'true' ? ' · earlier read, not a verified immediate-before state' : ''}</span></div>${code(bundle.artifactText[artifact.id], artifact.range?.start ?? 1)}`;
      return;
    }
    if (button.dataset.inspect) { openReading(operations.get(button.dataset.inspect), button); return; }
    if (button.classList.contains('close-reading')) { root.querySelector('.reading').close(); return; }
    if (button.classList.contains('next')) { reveal(); return; }
    if (button.classList.contains('show-all')) { follow = false; count = p.passages.length; update(); return; }
    if (button.classList.contains('clear')) { path = tool = agentId = undefined; update(); stopMotion(); return; }
    if (button.classList.contains('return')) { count = p.passages.length; path = tool = agentId = undefined; follow = true; update(); stage.scrollTop = stage.scrollHeight; return; }
    if (button.classList.contains('motion-toggle')) { motion = !motion; button.textContent = motion ? 'Motion on' : 'Motion off'; button.setAttribute('aria-pressed', String(motion)); stopMotion(); return; }
    if (button.classList.contains('map-toggle')) { map = !map; root.querySelector('.world').hidden = !map; button.textContent = map ? 'Map on' : 'Map off'; button.setAttribute('aria-pressed', String(map)); stopMotion(); return; }
    if (button.classList.contains('mobile-tools')) { const open = root.querySelector('.experience').classList.toggle('tools-open'); button.textContent = open ? 'Close tools' : 'Tools'; return; }
    if (button.dataset.file) { path = path === button.dataset.file ? undefined : button.dataset.file; tool = agentId = undefined; }
    else if (button.dataset.tool || button.dataset.kind) { const value = button.dataset.tool ?? button.dataset.kind; tool = tool === value ? undefined : value; path = agentId = undefined; }
    else if (button.dataset.agent) { agentId = agentId === button.dataset.agent ? undefined : button.dataset.agent; path = tool = undefined; }
    else return;
    follow = false;
    count = p.passages.length;
    update(); stage.scrollTop = 0; stopMotion();
  });
  history.addEventListener('pointerover', (event) => {
    const target = event.target.closest('[data-op]');
    if (!target || target.contains(event.relatedTarget)) return;
    const op = operations.get(target.dataset.op);
    const file = op.paths.find((item) => item.role !== 'search-hit')?.path;
    const origin = file ? [...root.querySelectorAll('.map-file')].find((el) => el.dataset.file === file) : undefined;
    relation(origin ?? originFor(op), target);
  });
  history.addEventListener('pointerout', (event) => { if (!event.target.closest('[data-op]')?.contains(event.relatedTarget)) stopMotion(); });
  stage.addEventListener('wheel', () => { follow = false; root.querySelector('.return').hidden = false; stopMotion(); }, { passive: true });
  history.addEventListener('pointerdown', () => { follow = false; stopMotion(); });
  document.addEventListener('keydown', (event) => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' '].includes(event.key)) { follow = false; stopMotion(); }
    if (event.key === 'Escape') { root.querySelector('.experience').classList.remove('tools-open'); root.querySelector('.mobile-tools').textContent = 'Tools'; }
  });
  stage.addEventListener('scroll', stopMotion, { passive: true });
  window.addEventListener('resize', stopMotion);
  root.querySelector('.reading').addEventListener('close', () => { if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true }); });
  const svg = root.querySelector('.world-map');
  svg.setAttribute('viewBox', '0 0 1000 700');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = bundle.graph.nodes.map((node) => `<g transform="translate(${80 + node.x * 820},${100 + node.y * 460})"><circle r="4"/></g>`).join('');
  const world = root.querySelector('.world');
  for (const node of bundle.graph.nodes) {
    const button = document.createElement('button');
    button.className = 'map-file'; button.dataset.file = node.path;
    button.textContent = node.path.split('/').pop(); button.title = node.path;
    button.style.left = `${8 + node.x * 82}%`; button.style.top = `${14.3 + node.y * 65.7}%`;
    world.append(button);
  }
  update();
} catch (error) { root.innerHTML = `<p role="alert">${escape(error.message)}</p><a href="index.html">Back to design directions</a>`; }
