import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import react from '../ui/node_modules/@vitejs/plugin-react/dist/index.js';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const demo=process.env.DRISHYA_BUILD_PUBLIC_DEMO==='1';
export default {
  root:demo?resolve(repo,'apps/landing/demo'):resolve(repo,'.local/landing-source'),
  base:demo?'/demo/':'/',
  publicDir:false,
  plugins:demo?[react()]:[],
  resolve:{alias:{react:resolve(repo,'apps/ui/node_modules/react'),'react-dom':resolve(repo,'apps/ui/node_modules/react-dom')}},
  build:{
    target:'esnext',
    outDir:resolve(repo,demo?'apps/landing/dist/demo':'apps/landing/dist'),
    emptyOutDir:!demo,
    manifest:true,
    rollupOptions:demo?{}:{input:Object.fromEntries(['index','get-started/index','privacy/index','releases/index','404'].map(path=>[path,resolve(repo,`.local/landing-source/${path}.html`)]))},
  },
};
