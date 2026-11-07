// First import: declares the cascade layer order before any other stylesheet loads (CLARITY-1).
import './clarity/layers.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ScreenBoundary } from './components/ScreenBoundary.tsx';
import { selectedUISkin, selectedUIVersion } from './lib/ui-version';

const root = createRoot(document.getElementById('root')!);
// Modern shares Legacy's verified visualization; only its surrounding chrome differs.
document.documentElement.dataset.uiVersion = selectedUIVersion();
// Clarity is Modern plus its own layer: data-ui-version stays "modern" so everything Modern does applies on day one.
const skin = selectedUISkin();
if (selectedUIVersion() === 'modern') document.documentElement.dataset.uiSkin = skin;
if (selectedUIVersion() === 'modern') {
  const { ModernApp } = skin === 'clarity' ? await import('./clarity/entry.tsx') : await import('./modern/entry.tsx');
  const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
  root.render(<StrictMode><ScreenBoundary><ModernApp token={token} /></ScreenBoundary></StrictMode>);
} else {
  // Keep the fallback's original static cascade order within its own entry.
  const { App } = await import('./classic-entry.tsx');
  root.render(<StrictMode><ScreenBoundary><App /></ScreenBoundary></StrictMode>);
}
