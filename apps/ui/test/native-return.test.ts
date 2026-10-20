import { expect,it } from 'vitest';
import type { DataSource } from '../src/api.ts';
import { useApp } from '../src/state.ts';
import { hasNativeReading,rememberNativeReading,returnToNativeReading,beginInvestigation,investigation,markInvestigationPrepared,acceptInvestigation,clearInvestigation,investigationReference } from '../src/lib/native-return.ts';
import type {Operation} from '@drishya/contracts';
import type {ControllerStatus} from '../src/api.ts';
it('returns only to the same source/session and retains precise evidence metadata',async()=>{
  const previous=useApp.getState(),source={} as DataSource;
  try {
    useApp.setState({source,recordingId:'one',mode:'history',developerWorkspace:false,selectedOp:'read-1',filePanel:'a.ts',filePanelLine:27,explore:false});
    rememberNativeReading(source,'one');expect(hasNativeReading(source,'one')).toBe(true);
    useApp.setState({recordingId:'other',selectedOp:undefined,filePanel:undefined,filePanelLine:undefined});
    await returnToNativeReading(source,'one');expect(useApp.getState().selectedOp).toBeUndefined();
    useApp.setState({recordingId:'one'});await returnToNativeReading(source,'one');
    expect(useApp.getState()).toMatchObject({selectedOp:'read-1',filePanel:'a.ts',filePanelLine:27,follow:false});
    useApp.setState({developerWorkspace:true});rememberNativeReading(source,'one');useApp.setState({developerWorkspace:false});
    await returnToNativeReading(source,'one');expect(useApp.getState().developerWorkspace).toBe(true);
    expect(hasNativeReading({} as DataSource,'one')).toBe(false);
  } finally {useApp.setState(previous);}
});
it('keeps the original evidence through draft preparation and records only explicit native acceptance',async()=>{
  const previous=useApp.getState(),source={} as DataSource;
  const op={id:'original',startSequence:7,title:'Captured read',paths:[{path:'a.ts'}]} as Operation;
  const status={runId:'exact-run',afterSequence:40} as ControllerStatus;
  try{
    useApp.setState({source,recordingId:'one',mode:'history',selectedOp:op.id,developerWorkspace:false,historyPage:undefined,projection:{...previous.projection!,timeline:[{type:'op-start',id:'start',operationId:op.id,sequence:7,agentId:'agent'}]}});
    beginInvestigation(source,'one',op);acceptInvestigation(source,'one',status,'unrelated prompt');expect(investigation(source,'one')?.runId).toBeUndefined();
    useApp.setState({developerWorkspace:true,selectedOp:undefined});rememberNativeReading(source,'one');markInvestigationPrepared(source,'one');
    expect(investigation(source,'one')).toMatchObject({prepared:true,sequence:7});
    acceptInvestigation(source,'one',status,'unrelated prompt');expect(investigation(source,'one')?.runId).toBeUndefined();
    const prompt=investigationReference(investigation(source,'one')!);
    acceptInvestigation(source,'one',status,prompt);acceptInvestigation(source,'one',{...status,runId:'another-run',afterSequence:80},prompt);
    expect(investigation(source,'one')).toMatchObject({runId:'exact-run',afterSequence:40});await returnToNativeReading(source,'one');expect(useApp.getState()).toMatchObject({selectedOp:'original',developerWorkspace:false});
    expect(investigation({},'one')).toBeUndefined();clearInvestigation(source,'one');expect(investigation(source,'one')).toBeUndefined();
  }finally{useApp.setState(previous);}
});
