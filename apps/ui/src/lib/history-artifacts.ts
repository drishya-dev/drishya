import { createContext } from 'react';
import type { Artifact } from '@drishya/contracts';

/** Evidence descriptors travel with the rendered history, including a deferred page. */
export const HistoryArtifacts = createContext<ReadonlyMap<string, Artifact> | undefined>(undefined);
