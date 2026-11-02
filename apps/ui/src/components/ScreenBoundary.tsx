import {Component,type ReactNode} from 'react';
import {useApp} from '../state.ts';
/** Keep an unexpected presentation failure recoverable; capture is owned by the daemon. */
export class ScreenBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  private navigate=()=>{
    if(!this.state.failed)return;
    // Boot is asynchronous; never remount a failed reader from retained state.
    useApp.setState({screen:'loading',playing:false});
    this.setState({failed:false});
  };
  componentDidMount(){window.addEventListener('hashchange',this.navigate);}
  componentWillUnmount(){window.removeEventListener('hashchange',this.navigate);}
  render(){return this.state.failed?<main className="center notice" role="alert"><h2>This view could not be displayed</h2><p>Reload to restore saved reading locations, or return to your sessions.</p><div><button className="btn" onClick={()=>location.reload()}>Reload view</button><button className="btn ghost" onClick={()=>{location.hash='';location.reload();}}>All sessions</button></div></main>:this.props.children;}
}
