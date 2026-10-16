import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {ToolInput} from '../src/components/ToolInput.tsx';
it('shows genuine multiline strings and nested arguments as text, preserving literal escapes',()=>{const value={script:'first\nsecond',nested:{pattern:'\\n',path:'C:\\new\\repo'}};const html=renderToStaticMarkup(createElement(ToolInput,{value}));expect(html).toContain('first\nsecond');expect(html).toContain('>\\n<');expect(html).toContain('C:\\new\\repo');});
it('decodes complete argument objects once, and escapes markup without executing it',()=>{const html=renderToStaticMarkup(createElement(ToolInput,{value:JSON.stringify({code:'<script>\nnever execute'})}));expect(html).toContain('&lt;script&gt;\nnever execute');expect(html).not.toContain('<script>');});
