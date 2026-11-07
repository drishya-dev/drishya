// Clarity starts as an exact replica of Modern (CLARITY-1): the same app, then Clarity's own layer on top.
import { installSegmentedIndicators } from './segmented.ts';
export { ModernApp } from '../modern/entry.tsx';
import './index.css';

// The segmented pill (FINISH-0a) is measured from outside the components, so no Modern component or bundle changes.
installSegmentedIndicators();
