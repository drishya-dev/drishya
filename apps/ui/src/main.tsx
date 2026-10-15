import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { selectedUIVersion } from './lib/ui-version';

const root = createRoot(document.getElementById('root')!);
// Modern shares Legacy's verified visualization; only its surrounding chrome differs.
document.documentElement.dataset.uiVersion = selectedUIVersion();
if (selectedUIVersion() === 'modern') {
  const { ModernApp } = await import('./modern/entry.tsx');
  const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
  root.render(<StrictMode><ModernApp token={token} /></StrictMode>);
} else {
  // Keep the fallback's original static cascade order within its own entry.
  const { App } = await import('./classic-entry.tsx');
  root.render(<StrictMode><App /></StrictMode>);
}
