// Deliberately share the complete working product instead of forking its capture,
// history, hover, graph, approval and attachment behavior into a second implementation.
import { App } from '../classic-entry';
import './surroundings.css';
export function ModernApp({ token: _token }: { token: string }) { return <App />; }
import './settings.css';
import './workspace-chrome.css';
import './recovered-surfaces.css';

import './theme-presets.css';
import './hud.css';

import './quiet-scrollbars.css';

import './interaction-polish.css';

import './reading-windows.css';
import './finishing.css';
// MOTION-1: last, so its gated motion is not overridden by an earlier sheet.
import './motion.css';
