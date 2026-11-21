import {expect,it} from 'vitest';
import {resolveThemePreference,parseThemePreference} from '../src/lib/theme-preference.ts';
it('preserves saved themes and the Jet Black default, including system changes and review candidates',()=>{
 expect(parseThemePreference(null)).toBe('dark');expect(parseThemePreference('unknown')).toBe('dark');
 expect(parseThemePreference('tokyo')).toBe('light');expect(parseThemePreference('mocha')).toBe('dark');
 expect(resolveThemePreference('system',true)).toEqual({scheme:'light',palette:'paper'});
 expect(resolveThemePreference('system',false)).toEqual({scheme:'dark',palette:'jet'});
 for(const id of ['neutral','chalk','slate','aubergine'] as const){expect(parseThemePreference(id)).toBe(id);expect(resolveThemePreference(id,false)).toEqual({scheme:id==='chalk'?'light':'dark',palette:id});}
});
