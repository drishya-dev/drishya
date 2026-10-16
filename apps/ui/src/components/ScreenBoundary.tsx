import {Component,type ReactNode} from 'react';
/** Keep an unexpected presentation failure recoverable; capture is owned by the daemon. */
export class ScreenBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="center notice" role="alert"><h2>This view could not be displayed</h2><p>Reload to restore saved reading locations, or return to your sessions.</p><div><button className="btn" onClick={()=>location.reload()}>Reload view</button><button className="btn ghost" onClick={()=>{location.hash='';location.reload();}}>All sessions</button></div></main>:this.props.children;}
}
