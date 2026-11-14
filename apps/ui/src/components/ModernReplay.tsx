import {useEffect,useRef} from 'react'; import {pluralWord} from '../lib/plural.ts';
import type {Marker,Scene} from '@drishya/scene';
import {useApp} from '../state.ts';
import './modern-replay.css';

/** Replay is an explicit view of captured order; it never starts a native harness turn. */
export function ReplayEntry(){
 const available=useApp(s=>(s.historyPage?.scene.total??s.projection?.timeline.length??0)>0);
 return <button className="btn ghost" disabled={!available} onClick={event=>{
  event.currentTarget.closest('details.workspace-menu')?.removeAttribute('open');
  const app=useApp.getState();app.set({replayDiagnostics:true});if(app.mode==='history')app.togglePlay();
 }}>Replay this session</button>;
}

export function ModernReplayTransport({scene,markers}:{scene:Scene;markers:readonly Marker[]}){
 const playing=useApp(s=>s.playing),speed=useApp(s=>s.speed);
 const play=useRef<HTMLButtonElement>(null);
 useEffect(()=>{play.current?.focus({preventScroll:true});},[]);
 const total=Math.max(1,scene.total),position=Math.max(0,Math.min(scene.step,scene.total));
 // One SVG path retains all supplied turn ticks without a DOM node per marker.
 const turns=markers.filter(marker=>marker.type==='turn').map(marker=>`M${marker.step/total*1000} 0v6`).join('');
 return <footer className="transport modern-replay-transport" aria-label="Replay controls">
  <div className="modern-replay-row">
   <span className="modern-replay-caption" title="Event order; playback is paced for reading, not original execution time.">Replay</span>
   <div className="t-controls modern-replay-buttons" role="group" aria-label="Playback">
    <button className="icon-btn" aria-label="Step back" title="Step back (←)" disabled={!position} onClick={()=>useApp.getState().stepBy(-1)}>‹</button>
    <button ref={play} className="play" aria-label={playing?'Pause':'Play'} title="Play / pause (Space)" disabled={!scene.total} onClick={()=>useApp.getState().togglePlay()}>{playing?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>}</button>
    <button className="icon-btn" aria-label="Step forward" title="Step forward (→)" disabled={position>=scene.total} onClick={()=>useApp.getState().stepBy(1)}>›</button>
    <select className="speed" value={speed} aria-label="Replay speed" onChange={event=>useApp.getState().set({speed:Number(event.target.value)})}>{[.5,1,1.5,2,4].map(value=><option key={value} value={value}>{value}×</option>)}</select>
   </div>
   <div className="modern-replay-jumps" role="group" aria-label="Jump to outcome">
    <button className="icon-btn" aria-label="Next edit" title="Next edit (E)" onClick={()=>useApp.getState().jump('edit')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h10M4 10h7M4 15h5m7-5 4 4-7 7H9v-4Z"/></svg></button>
    <button className="icon-btn" aria-label="Next failure" title="Next failure (F)" onClick={()=>useApp.getState().jump('fail')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 10 18H2Zm0 6v5m0 3v1"/></svg></button>
   </div>
   <button className="icon-btn modern-replay-exit" aria-label="Exit replay" title="Back to live history" onClick={()=>{const app=useApp.getState();app.set({replayDiagnostics:false});app.showHistory();}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5-7 7 7 7M2 12h20"/></svg></button>
  </div>
  <div className="modern-replay-position">
   <div className="modern-replay-scrubber"><svg viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden="true"><path d={turns}/></svg><input type="range" min={0} max={total} step={1} value={position} disabled={!scene.total} aria-label="Timeline" aria-valuemin={0} aria-valuemax={scene.total} aria-valuenow={position} aria-valuetext={`${position} of ${scene.total} ${pluralWord(scene.total,'step')}`} onChange={event=>useApp.getState().seek(Number(event.target.value),{hold:true})}/></div>
   <output aria-label="Replay position">{position.toLocaleString()} / {scene.total.toLocaleString()}</output>
  </div>
 </footer>;
}
