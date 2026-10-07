#!/usr/bin/env node
// drishya — local replay and live view for coding agents, with opt-in native continuation.
// The warning filter must be installed before node:sqlite loads, so everything else is
// imported dynamically after it.
import './quiet.ts';

const { main } = await import('./commands.ts');
main().catch((e) => {
  console.error(`drishya: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
