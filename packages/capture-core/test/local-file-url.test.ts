import {expect,it} from 'vitest';
import {localFileUrlPath} from '../src/local-file-url.ts';

it('decodes explicit drive and POSIX file URLs independently of the host platform',()=>{
  expect(localFileUrlPath('file:///C:/Synthetic%20Project/src')).toBe('C:\\Synthetic Project\\src');
  expect(localFileUrlPath('file://localhost/C:/Synthetic/src')).toBe('C:\\Synthetic\\src');
  expect(localFileUrlPath('file:///tmp/synthetic%20project')).toBe('/tmp/synthetic project');
});
it('does not guess ordinary paths or accept ambiguous remote and encoded locations',()=>{
  for(const value of ['C:\\Synthetic','./src','https://example.invalid/src','file://remote.invalid/share/src','file:///tmp/a?query=1','file:///tmp/a#fragment','file:///tmp/%00','file:///tmp/a%2Fb','file:///C:/a%5Cb'])expect(localFileUrlPath(value),value).toBeUndefined();
});
