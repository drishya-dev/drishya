import {expect,it} from 'vitest';
import {commandDisplay} from '../src/lib/command-display.ts';
it('decodes known command arguments once while retaining literal script escapes',()=>{
  const cmd = '@\'\nprint("\\n")\n\'@';
  expect(commandDisplay(JSON.stringify({cmd,workdir:'C:\\new'}))).toEqual({text:cmd,decoded:true});
  expect(commandDisplay(`text(await tools.exec_command({cmd:${JSON.stringify(cmd)},max_output_tokens:500}));`)).toEqual({text:cmd,decoded:true});
});
it('leaves unrelated code, paths and invalid/truncated arguments untouched',()=>{
  for(const text of ['C:\\new\\test', 'print("\\n")', 'const x={cmd:"a\\nb"}', 'text(await tools.exec_command({cmd:"bad\\q"}))']) expect(commandDisplay(text)).toEqual({text,decoded:false});
});
