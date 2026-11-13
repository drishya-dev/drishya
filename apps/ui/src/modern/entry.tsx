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
import './composer.css';
import './remember.css';
import './conversation.css';
// SHIP-18: History hierarchy by ink and weight, after the sheets it refines.
import './history-ink.css';
// SHIP-19: Home, shell and overlay hierarchy by ink and weight.
import './shell-ink.css';
// SHIP-20: captured material and current-file readers share the semantic ink roles.
import './reader-ink.css';
// LAYOUT-1: after the sheets whose edge offsets it extends.
import './large-screens.css';
// UI-39: small labels and counts in the mono face; after the sheets whose labels it re-faces.
import './label-face.css';
// UI-39: agent messages set for reading; after the sheets that set the old prose leading and measure.
import './reading-type.css';
// UI-39: buttons are pills; Jet Black's main action is the cream pill. After every sheet that sets a button's radius.
import './pill-buttons.css';
// UI-39: nested surfaces keep a fill and lose their own outline.
import './fewer-outlines.css';
// MOTION-1: last, so its gated motion is not overridden by an earlier sheet.
import './motion.css';
