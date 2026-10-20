import type {TurnLedger} from '../../../../packages/scene/src/turns.ts';
/** Linear size between a readable four-pixel minimum and a twenty-pixel cap. */
export function promptRailMark(ledger?:TurnLedger) {
 return {ratio:ledger?Math.min(20,Math.max(4,ledger.operations/2))/24:1/3,failed:!!ledger&&(ledger.failed>0||ledger.tests.failed>0),edited:!!ledger&&ledger.edits.files>0};
}
