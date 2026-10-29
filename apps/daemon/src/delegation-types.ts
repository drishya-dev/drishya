/** Bounded delegation reading DTOs, separate from captured event contracts. */
export interface DelegationStep {id:string;kind:'spawn'|'action'|'interaction'|'completed'|'result'|'message';label:string;sequence:number;time?:string;operationId?:string;status?:string;text?:string;truncated?:boolean;artifactId?:string}
export interface DelegationThread {
  operationId:string;child?:{id:string;name:string;model?:string;effort?:string;address?:string;recordingId?:string};
  task?:{text:string;truncated:boolean;start:number;total:number;unavailable?:boolean;reason?:'content-limit'|'missing'};steps:DelegationStep[];total:number;start:number;limit:number;
  childActions:number;identity:'captured'|'unresolved';recording:'same-recording'|'separate-recording'|'not-imported'|'unresolved';
}
