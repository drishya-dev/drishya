import {describe,expect,it} from 'vitest';
import {resolveUISkin,resolveUIVersion,selectedUIVersion,selectedUISkin,versionChoiceEnabled,versionURL} from '../src/lib/ui-version.ts';
describe('Release 1 Modern-only presentation',()=>{
  it('ignores every previous URL, preference and developer switch',()=>{
    for(const name of ['classic','legacy','canvas','clarity','fresh','studio','modern','unknown',''])for(const saved of [name,null,undefined]){
      const query=`?experience=${name}&versions=all`;
      expect(resolveUIVersion(query,saved,true)).toBe('modern');
      expect(resolveUISkin(query,saved)).toBe('modern');
      expect(versionChoiceEnabled(query)).toBe(false);
    }
    expect(selectedUIVersion()).toBe('modern');expect(selectedUISkin()).toBe('modern');
  });
  it('retains the session, token and query while retiring presentation-specific subviews',()=>{
    const url=new URL(versionURL('http://127.0.0.1:8894/?demo&motion=0&versions=1&experience=clarity#/r/recording/settings','classic'));
    expect(url.port).toBe('8894');expect(url.hash).toBe('#/r/recording');
    expect(new URL(versionURL('http://localhost/#token=synthetic-auth','clarity')).hash).toBe('#token=synthetic-auth');
    expect(new URL(versionURL('http://localhost/#/settings','classic')).hash).toBe('#/');
    expect(url.searchParams.has('demo')).toBe(true);expect(url.searchParams.get('motion')).toBe('0');
    expect(url.searchParams.has('experience')).toBe(false);expect(url.searchParams.has('versions')).toBe(false);
  });
});
