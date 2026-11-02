import {capturedTestCases,type CapturedTestCase} from './captured-test-cases.ts';
export type OutcomeState = 'passed' | 'failed' | 'skipped' | 'cancelled' | 'errors' | 'unknown' | 'deselected' | 'xfailed' | 'xpassed';
export type OutcomeCounts = Record<OutcomeState, number>;
export interface CapturedOutcome { runner: string; output: number; counts: OutcomeCounts; suites?: string; unit: 'tests' | 'suites'; tap?: string; cases?:CapturedTestCase[]; observedOnly?:boolean; warnings?:number }
export interface OutcomeReport { runs: CapturedOutcome[]; notes: string[] }
const empty = (): OutcomeCounts => ({ passed: 0, failed: 0, skipped: 0, cancelled: 0, errors: 0, unknown: 0, deselected: 0, xfailed: 0, xpassed: 0 });
const states: Record<string, OutcomeState> = { passed: 'passed', pass: 'passed', failed: 'failed', fail: 'failed', skipped: 'skipped', skip: 'skipped', todo: 'skipped', ignored: 'skipped', cancelled: 'cancelled', canceled: 'cancelled', errors: 'errors', error: 'errors', xfailed: 'xfailed', xpassed: 'xpassed', deselected: 'deselected' };

/** Presentation-only facts from already redacted result previews. Never parses commands,
 * changes an operation's kind, executes wrappers or alters stored evidence. */
export function capturedOutcomes(raw: string, context: {runner?: 'TAP'|'Playwright'} = {}): OutcomeReport {
  const runs: CapturedOutcome[] = [], notes: string[] = [], outputs: string[] = [];
  if (raw.length > 131_072) notes.push('Parsing limited to the first 128 KiB of preview.');
  const input = raw.slice(0, 131_072);
  let visited = 0;
  const walk = (value: unknown, depth: number, textAllowed = false): void => {
    if (++visited > 256 || depth > 6 || outputs.length >= 8) { if (!notes.includes('Additional wrapped content remains in raw output.')) notes.push('Additional wrapped content remains in raw output.'); return; }
    if (typeof value === 'string' && textAllowed) {
      const text = value.trim();
      if (/^[\[{]/.test(text)) { try { walk(JSON.parse(text), depth + 1); return; } catch { /* Partial JSON remains readable raw evidence. */ } }
      outputs.push(value.slice(0, 65_536));
    } else if (Array.isArray(value)) for (const child of value) walk(child, depth + 1, textAllowed);
    else if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      if (typeof object.output === 'string') walk(object.output, depth + 1, true);
      else if(typeof object.stdout==='string'||typeof object.stderr==='string'){for(const key of ['stdout','stderr'])if(typeof object[key]==='string')walk(object[key],depth+1,true);}
      else if (object.type === 'text' && typeof object.text === 'string') walk(object.text, depth + 1, true);
      else for (const key of ['value', 'result', 'results', 'content']) if (key in object) walk(object[key], depth + 1, key === 'content');
    }
  };
  try { walk(JSON.parse(input), 0, true); }
  catch {
    // functions.exec may print one JSON tool result per line, with ordinary text around it.
    for (const line of input.split('\n')) if (/^\s*[\[{]/.test(line)) { try { walk(JSON.parse(line), 0); } catch { /* Not an envelope. */ } }
    if (!outputs.length && !/^\s*[\[{]\s*(?:"|[\[{]|$)/.test(input)) outputs.push(input);
  }
  const add = (runner: string, output: number, counts: OutcomeCounts, total: number | undefined, unit: CapturedOutcome['unit'], suites?: string, tap?: string) => {
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!Object.values(counts).every(n => Number.isSafeInteger(n) && n >= 0) || (total !== undefined && (!Number.isSafeInteger(total) || total < sum))) { notes.push('Contradictory summary retained as raw output.'); return; }
    if (total !== undefined) counts.unknown += total - sum;
    if (runs.length < 8) {const run:CapturedOutcome={ runner, output, counts, unit, suites, tap };runs.push(run);return run;}
    else if (!notes.includes('Additional summaries remain in raw output.')) notes.push('Additional summaries remain in raw output.');
  };
  outputs.forEach((rawOutput, index) => {
    const text = rawOutput.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');
    const caseRows=capturedTestCases(text);
    let suites: string | undefined;
    for (const line of text.split('\n')) {
      const suite = /^\s*(Test Files|Test Suites:)\s+(.+?)\s*$/i.exec(line);
      if (suite) { suites = suite[2]!.slice(0, 160); continue; }
      const summary = /^\s*Tests(:?)\s+(.+?)\s*(?:\((\d+)\)|(\d+) total)\s*$/i.exec(line);
      if (summary) {
        const counts = empty(); let matched = false, duplicate = false;
        const seen = new Set<string>();
        for (const match of summary[2]!.matchAll(/(\d+)\s+(passed|failed|skipped|todo|cancelled|canceled)\b/g)) { if (seen.has(match[2]!)) duplicate = true; seen.add(match[2]!); counts[states[match[2]!]!] += Number(match[1]); matched = true; }
        const remainder = summary[2]!.replace(/\d+\s+(passed|failed|skipped|todo|cancelled|canceled)\b/g, '').replace(/[\s|,]/g, '');
        if (remainder || /-\d/.test(summary[2]!)) notes.push('Unsupported summary counters retained as raw output.');
        else if (duplicate) notes.push('Repeated outcome counters retained as raw output.');
        else if (matched) add(summary[1] ? 'Jest' : 'Vitest', index + 1, counts, Number(summary[3] ?? summary[4]), 'tests', suites);
        suites = undefined;
        continue;
      }
      const pytest = /^\s*(?:=+\s*)?((?:\d+\s+(?:passed|failed|skipped|errors?|xfailed|xpassed|deselected|warnings?)[, ]*)+)\s+in\s+[\d.]+s\b.*$/i.exec(line);
      if (pytest) {
        const counts = empty(), seen = new Set<OutcomeState>(); let duplicate = false;
        for (const match of pytest[1]!.matchAll(/(\d+)\s+(passed|failed|skipped|errors?|xfailed|xpassed|deselected)\b/gi)) {
          const state = states[match[2]!.toLowerCase()]!;
          if (seen.has(state)) duplicate = true;
          seen.add(state); counts[state] += Number(match[1]);
        }
        const warningRows=[...pytest[1]!.matchAll(/(\d+)\s+warnings?\b/gi)];if(warningRows.length>1)duplicate=true;
        if (duplicate) notes.push('Repeated outcome counters retained as raw output.');
        else {const run=add('pytest', index + 1, counts, undefined, 'tests');if(run&&warningRows[0])run.warnings=Number(warningRows[0][1]);}
      }
      const cargo = /^\s*test result: \w+\.\s+(\d+) passed;\s+(\d+) failed;\s+(\d+) ignored;/.exec(line);
      if (cargo) add('Cargo', index + 1, { ...empty(), passed: Number(cargo[1]), failed: Number(cargo[2]), skipped: Number(cargo[3]) }, undefined, 'tests');
    }
    if(context.runner==='Playwright'||/^\s*Running \d+ tests? using \d+ workers?/m.test(text)||caseRows.some(item=>item.runner==='Playwright')){
      const counts=empty();let summary=false,duplicate=false;const seen=new Set<OutcomeState>();
      for(const line of text.split('\n')){const match=/^\s*(\d+) (passed|failed|skipped|interrupted|did not run)(?: \([^)]*\))?\s*$/.exec(line);if(!match)continue;
        const state=match[2]==='did not run'?'unknown':match[2]==='interrupted'?'cancelled':match[2] as OutcomeState;
        if(seen.has(state))duplicate=true;seen.add(state);counts[state]=Number(match[1]);summary=true;
      }
      if(summary&&!duplicate)add('Playwright',index+1,counts,undefined,'tests');
    }
    // TAP/node:test totals are distinct from suite lines; avoid inferring cases from nested ok lines.
    if (context.runner==='TAP'||/^TAP version \d+\s*$/m.test(text)) {
      const counts = empty(), seen = new Set<string>(); let total: number | undefined;
      for (const line of text.split('\n')) {
        const m = /^# (tests|pass|fail|skipped|todo|cancelled|suites) (\d+)\s*$/.exec(line);
        if (!m) continue;
        // A repeated counter is not evidence of additional tests, even when its
        // accumulated value happens to fit the reported total.
        if (seen.has(m[1]!)) { notes.push('Repeated TAP totals retained as raw output.'); return; }
        seen.add(m[1]!);
        if (m[1] === 'tests') total = Number(m[2]);
        else if (m[1] === 'suites') { if (m[2] !== '0') suites = `${m[2]} suites reported`; }
        else counts[states[m[1]!]!] += Number(m[2]);
      }
      if (total !== undefined) add('TAP', index + 1, counts, total, 'tests', suites, text);
    }
    const cases=caseRows,outputRuns=runs.filter(run=>run.output===index+1);
    for(const run of outputRuns){
      const matches=(item:CapturedTestCase)=>item.runner===run.runner||item.runner==='Jest/Vitest'&&['Jest','Vitest'].includes(run.runner);
      const siblings=outputRuns.filter(other=>other.runner===run.runner||['Jest','Vitest'].includes(other.runner)&&['Jest','Vitest'].includes(run.runner));
      const selected=cases.filter(matches);
      if(siblings.length===1&&selected.length&&Object.keys(run.counts).every(state=>selected.filter(item=>item.state===state).length<=run.counts[state as OutcomeState]))run.cases=selected;
    }
    if(!outputRuns.length&&cases.length){
      for(const runner of [...new Set(cases.map(item=>item.runner))]){
        const selected=cases.filter(item=>item.runner===runner),counts=empty();for(const item of selected)counts[item.state]++;
        if(runs.length<8)runs.push({runner,output:index+1,counts,unit:'tests',cases:selected,observedOnly:true});
      }
    }
    if (suites && !runs.some(run => run.output === index + 1)) notes.push(`Only suite totals reported in output ${index + 1}; no test counts inferred.`);
  });
  return { runs, notes: [...new Set(notes)].slice(0, 8) };
}
