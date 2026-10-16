// Deliberately share the complete working product instead of forking its capture,
// history, hover, graph, approval and attachment behavior into a second implementation.
import { App } from '../classic-entry';
import './surroundings.css';
export function ModernApp({ token: _token }: { token: string }) { return <App />; }
import './settings.css';
import './workspace-chrome.css';
import './recovered-surfaces.css';
import './hud.css';
