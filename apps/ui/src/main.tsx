import {installStageGeometry} from './lib/stage-geometry.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ScreenBoundary } from './components/ScreenBoundary.tsx';
import { ModernApp } from './modern/entry.tsx';
import {versionURL} from './lib/ui-version.ts';

const canonical=versionURL(location.href,'modern');
if(canonical!==location.href)history.replaceState(history.state,'',canonical);
document.documentElement.dataset.uiVersion = 'modern';
document.documentElement.dataset.uiSkin = 'modern';
document.documentElement.dataset.inputModality ??= 'pointer';
installStageGeometry();
const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
createRoot(document.getElementById('root')!).render(<StrictMode><ScreenBoundary><ModernApp token={token} /></ScreenBoundary></StrictMode>);
