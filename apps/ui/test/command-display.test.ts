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
it('decodes a whole static call with reordered fields and ordinary output wrappers',()=>{
  const cmd = 'echo "a"\nnode test.js';
  for (const text of [
    `await tools.exec_command({workdir:${JSON.stringify('C:\\new')},cmd:${JSON.stringify(cmd)}});`,
    `text((await tools.exec_command({"cmd":${JSON.stringify(cmd)},max_output_tokens:500,login:false})).output);`,
    `// @exec: {"max_output_tokens":1000}\ntext(await tools.exec_command({cmd:${JSON.stringify(cmd)},}));`,
  ]) expect(commandDisplay(text)).toEqual({text:cmd,decoded:true});
});
it('never hides trailing work, dynamic arguments or incomplete source',()=>{
  for (const text of [
    'text(await tools.exec_command({cmd:"first"})); text(await tools.exec_command({cmd:"second"}));',
    'text(await tools.exec_command({cmd:"first"})); throw Error("failed")',
    'text(await tools.exec_command({cmd:"first",workdir:root}));',
    'text(await tools.exec_command({cmd:"first",env:{KEY:"value"}}));',
    'text(await tools.exec_command({cmd:"first",cmd:"second"}));',
    'text(await tools.exec_command({cmd:"first"',
    'text(await tools.exec_command({cmd:"first"})).output',
    'condition && text(await tools.exec_command({cmd:"first"}));',
    'text(await tools.exec_command({cmd:"first" + suffix}));',
  ]) expect(commandDisplay(text)).toEqual({text,decoded:false});
});
