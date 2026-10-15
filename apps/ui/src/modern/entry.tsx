import { PresentationProvider } from './presentation';
import { FreshApp } from '../fresh/FreshApp';
import './modern.css';
export function ModernApp({ token }: { token: string }) { return <PresentationProvider><FreshApp token={token} appearance="modern" /></PresentationProvider>; }
import './palette.css';
import './reading.css';

import './workflow.css';
