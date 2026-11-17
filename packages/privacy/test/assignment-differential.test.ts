import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { compareRedaction, compareValue } from './redact-differential.ts';
import { generateLargeJournal } from '../../../scripts/make-large-journal.ts';
import { PRIVACY_POLICY_VERSION } from '../src/index.ts';

const keywords = ['password','passwd','pwd','secret','token','apikey','api_key','api-key','accesskey','access_key','access-key','privatekey','private_key','private-key','clientsecret','client_secret','client-secret','auth'];
const secret = 'aB3dE5fG7hJ9kL2mN4pQ6rS8';
test('keyword-first assignments preserve old full redaction output and hit order', () => {
  expect(PRIVACY_POLICY_VERSION).toBe('p6');
  for (const k of keywords) for (const key of [k,k.toUpperCase(),'before_'+k+'_after','x-'+k,'token_'+k]) {
    for (const op of [':','=']) for (const quote of ['', '"', "'", String.fromCharCode(96)]) {
      for (const value of [secret,'placeholder','abcdefgh','process.env.KEY',secret+'=token='+secret]) {
        compareRedaction(key+'" '+op+' '+quote+value+quote+'; '+key+op+secret);
      }
    }
  }
  for (const input of [
    'token_api-key='+secret, 'SECRET_API-KEY_FOO='+secret, 'foo-bar_token='+secret,
    'api-key-token='+secret, 'AUTH=password='+secret, 'token=password='+secret+' token='+secret,
    'étoken='+secret, '中auth='+secret, '_auth='+secret, '1auth='+secret,
    'token="'+secret+'"auth='+secret, 'token='+secret+'auth='+secret,
    'password\n : \n'+secret, 'token="'+secret+"'", 'token='+secret+',auth='+secret,
    'harmless_identifier_'.repeat(256), 'token'.repeat(300)+'-client-secret='+secret,
    'https://synthetic:'+secret+'@example.invalid token='+secret,
    'sk-'+'proj-'+secret+' token='+secret,
  ]) compareRedaction(input);
  let seed=1729;
  const choose=(xs:string[])=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return xs[seed%xs.length]!;};
  for(let n=0;n<5000;n++) {
    let input='';
    for(let i=0;i<20;i++) input+=choose([...keywords,'abc','_', '-', ' ', ':', '=', '\n', '"', "'", secret, 'example', 'é']);
    compareRedaction(input);
  }
});

test('all committed fixture bytes and JSON strings/keys preserve old output', () => {
  const files=execFileSync('git',['ls-files','-z','fixtures'],{encoding:'utf8'}).split('\0').filter(Boolean);
  expect(files.length).toBeGreaterThan(0);
  for(const file of files) {
    const text=readFileSync(file,'utf8'); compareRedaction(text);
    try { compareValue(JSON.parse(text)); } catch(error) {
      if(!(error instanceof SyntaxError)) throw error;
      for(const line of text.split('\n').filter(Boolean)) {
        try { compareValue(JSON.parse(line)); } catch(error) { if(!(error instanceof SyntaxError)) throw error; }
      }
    }
  }
},30000);

test('deterministic invented rollout mix preserves raw records and every nested string',()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-redact-diff-'));
  try {
    const file=join(dir,'invented.jsonl');generateLargeJournal(file,2);
    for(const line of readFileSync(file,'utf8').split('\n').filter(Boolean)) {compareRedaction(line);compareValue(JSON.parse(line));}
  } finally {if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe temporary path');rmSync(dir,{recursive:true,force:true});}
},30000);
