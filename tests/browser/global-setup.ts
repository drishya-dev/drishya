import { useNativeCliStubs } from './native-cli-stubs.ts';
import {useSyntheticHarnessHomes} from '../../scripts/synthetic-harness-homes.ts';

// SHIP-16: runs once, before any worker starts, so every spec's daemon sees the same ready native CLIs. See native-cli-stubs.ts.
export default function globalSetup() {
  const homes=useSyntheticHarnessHomes();
  const previousPath=process.env.PATH;
  const restorePath=()=>{if(previousPath===undefined)delete process.env.PATH;else process.env.PATH=previousPath;};
  try {
    const stubs=useNativeCliStubs();
    return ()=>{try{stubs();}finally{restorePath();homes();}};
  } catch(error) {restorePath();homes();throw error;}
}
