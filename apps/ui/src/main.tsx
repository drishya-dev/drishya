import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { selectedUIVersion, switchUIVersion } from './lib/ui-version';

const root = createRoot(document.getElementById('root')!);
// The independent draft never loads Classic's components or cascading style layers.
if (selectedUIVersion() === 'fresh') {
  const { FreshApp } = await import('./fresh/FreshApp.tsx');
  const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
  root.render(<StrictMode><FreshApp token={token} onExit={() => {
    switchUIVersion('classic');
  }} /></StrictMode>);
} else {
  // Keep the fallback's original static cascade order within its own entry.
  const { App } = await import('./classic-entry.tsx');
  root.render(<StrictMode><App /></StrictMode>);
}
