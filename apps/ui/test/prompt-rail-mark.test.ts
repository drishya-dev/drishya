import {expect,it} from 'vitest';
import type {TurnLedger} from '../../../packages/scene/src/turns.ts';
import {promptRailMark} from '../src/lib/prompt-rail-mark.ts';
const turn:TurnLedger={step:0,operations:2,reads:0,searches:0,edits:{files:0,added:0,removed:0},commands:2,tests:{runs:0,passed:0,failed:0},web:0,mcp:0,delegations:0,failed:0,open:0};
it('sizes captured operation counts monotonically within a readable minimum and cap',()=>{
 const ratios=[0,2,12,80,10000].map(operations=>promptRailMark({...turn,operations}).ratio);
 expect(ratios).toEqual([...ratios].sort((a,b)=>a-b));expect(ratios[0]).toBe(4/24);expect(ratios.at(-1)).toBe(20/24);
});
it('marks captured operation failures or failing test outcomes, with independent patch evidence',()=>{
 expect(promptRailMark({...turn,failed:1}).failed).toBe(true);
 expect(promptRailMark({...turn,tests:{runs:1,passed:1,failed:1}}).failed).toBe(true);
 expect(promptRailMark({...turn,edits:{files:1,added:1,removed:0}}).edited).toBe(true);
 expect(promptRailMark(turn)).toMatchObject({failed:false,edited:false});
});
it('does not manufacture counts or outcome marks while a ledger is unavailable',()=>{expect(promptRailMark()).toEqual({ratio:1/3,failed:false,edited:false});});
