// Keep the existing cascade order; Release 1 has one reachable presentation.
import './modern/layers.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ScreenBoundary } from './components/ScreenBoundary.tsx';
import { ModernApp } from './modern/entry.tsx';

document.documentElement.dataset.uiVersion = 'modern';
document.documentElement.dataset.uiSkin = 'modern';
const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
createRoot(document.getElementById('root')!).render(<StrictMode><ScreenBoundary><ModernApp token={token} /></ScreenBoundary></StrictMode>);
