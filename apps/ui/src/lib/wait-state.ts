import {useEffect,useState} from 'react';

export type WaitState = 'hidden' | 'placeholder' | 'long';

/** Each wait has its own timers, cancelled as soon as it completes or is replaced. */
export function scheduleWait(change:(state:WaitState)=>void):()=>void {
 const placeholder=setTimeout(()=>change('placeholder'),400);
 const long=setTimeout(()=>change('long'),2000);
 return ()=>{clearTimeout(placeholder);clearTimeout(long);};
}

export function useWaitState(waiting:boolean,key:unknown=waiting):WaitState {
 const [value,setValue]=useState<{key:unknown;state:WaitState}>({key,state:'hidden'});
 useEffect(()=>{
  if(!waiting){setValue({key,state:'hidden'});return;}
  setValue({key,state:'hidden'});
  return scheduleWait(state=>setValue({key,state}));
 },[waiting,key]);
 return waiting&&Object.is(value.key,key)?value.state:'hidden';
}
