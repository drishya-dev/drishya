import { useNativeCliStubs } from './native-cli-stubs.ts';

// SHIP-16: POSIX workers inherit the same ready native CLIs. Windows workers use browser-server.ts.
export default function globalSetup() {
  return useNativeCliStubs();
}
