import { useNativeCliStubs } from './native-cli-stubs.ts';

// SHIP-16: runs once, before any worker starts, so every spec's daemon sees the same ready native CLIs. See native-cli-stubs.ts.
export default function globalSetup() {
  return useNativeCliStubs();
}
