import { expect,it } from 'vitest';
import type { DataSource } from '../src/api.ts';
import { useApp } from '../src/state.ts';
import { hasNativeReading,rememberNativeReading,returnToNativeReading } from '../src/lib/native-return.ts';
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
