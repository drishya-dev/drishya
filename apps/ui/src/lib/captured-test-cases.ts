import type {OutcomeState} from './captured-outcomes.ts';
export interface CapturedTestCase {runner:string;state:OutcomeState;name:string;index?:number;line:number;context:string}
/** Explicit reporter rows only. Positions are output-line addresses, never invented runner indices. */
export function capturedTestCases(text:string):CapturedTestCase[] {
 const lines=text.slice(0,65536).split('\n'),cases:CapturedTestCase[]=[];
 const tap=/^TAP version \d+\s*$/m.test(text),nested=tap&&/^\s+(?:not )?ok\s+\d+\b/m.test(text);
 for(let line=0;line<lines.length&&cases.length<240;line++){
  const value=lines[line]!;let runner='',state:OutcomeState='unknown',name='',index:number|undefined,match:RegExpExecArray|null;
  if(tap&&!nested&&(match=/^(not ok|ok)\s+(\d+)\s*-?\s+(.+)$/.exec(value))){runner='TAP';state=/#\s*(SKIP|TODO)\b/i.test(match[3]!)?'skipped':match[1]==='ok'?'passed':'failed';index=Number(match[2]);name=match[3]!;}
  else if(!tap&&(match=/^\s*(ok|✓|✘|×|x|-)\s+(\d+)\s+(.+?)(?:\s+\([\d.ms]+\))?\s*$/.exec(value))&&(match[3]!.includes('›')||/^\s*Running \d+ tests? using \d+ workers?/m.test(text))){runner='Playwright';state=match[1]==='-'?'skipped':['ok','✓'].includes(match[1]!)?'passed':'failed';index=Number(match[2]);name=match[3]!;}
  else if((match=/^\s{3,}([✓✔√×✕✘])\s+(.+?)(?:\s+\(?[\d.]+\s*ms\)?)\s*$/.exec(value))&&!/\(\d+ tests?\)/.test(value)){runner='Jest/Vitest';state=['✓','✔','√'].includes(match[1]!)?'passed':'failed';name=match[2]!;}
  else if((match=/^(\S+::.+?)\s+(PASSED|FAILED|SKIPPED|ERROR|XFAIL|XPASS)(?:\s+\[\s*\d+%\])?\s*$/.exec(value))){runner='pytest';state=({PASSED:'passed',FAILED:'failed',SKIPPED:'skipped',ERROR:'errors',XFAIL:'xfailed',XPASS:'xpassed'} as const)[match[2] as 'PASSED']!;name=match[1]!;}
  else if((match=/^test (.+?) \.\.\. (ok|FAILED|ignored)\s*$/.exec(value))){runner='Cargo';state=match[2]==='ok'?'passed':match[2]==='ignored'?'skipped':'failed';name=match[1]!;}
  if(runner&&name)cases.push({runner,state,name:name.slice(0,300),index:index!==undefined&&Number.isSafeInteger(index)&&index>0?index:undefined,line:line+1,context:lines.slice(Math.max(0,line-1),Math.min(lines.length,line+9)).join('\n').slice(0,6000)});
 }
 return cases;
}
