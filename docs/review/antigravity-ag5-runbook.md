# AG-5 runbook: record the Antigravity cases no local session has

Yash runs these in Antigravity itself (not Drishya), on a throwaway repository with nothing private in it. Each case is
its **own new conversation**, so each recorded session holds one clean case. Codex then maps them (AG-5): id prefixes,
sizes and counts only, never content.

## 1. Set up the throwaway repository (PowerShell)

```powershell
$d = "$HOME\Desktop\ag-cases"; New-Item -ItemType Directory -Force $d | Out-Null; Set-Location $d
git init -q
@'
<!doctype html><meta charset="utf-8"><title>Counter</title>
<h1>Counter</h1><p id="n">0</p><button id="b">Add one</button>
<script>let n=0;document.getElementById('b').onclick=()=>{document.getElementById('n').textContent=++n}</script>
'@ | Set-Content index.html
@'
export const add = (a, b) => a + b;
'@ | Set-Content math.mjs
@'
import assert from 'node:assert'; import { add } from './math.mjs';
assert.equal(add(2, 2), 5, 'add should be right'); console.log('ok');
'@ | Set-Content test.mjs
@'
import readline from 'node:readline';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Continue? (yes/no) ', a => { console.log('answer:', a); rl.close(); });
'@ | Set-Content ask.mjs
@'
import http from 'node:http';
http.createServer((q, r) => r.end('hello')).listen(4317, () => console.log('listening on 4317'));
'@ | Set-Content server.mjs
'{ "name": "ag-cases", "type": "module", "scripts": { "test": "node test.mjs" } }' | Set-Content package.json
git add -A; git commit -qm "throwaway repo for Antigravity cases"
& "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe" $d
```

## 2. Settings in Antigravity, before the runs

- **Terminal commands: ask before running** (the "request review" / always-ask policy), so case 5 records approvals.
- **Plans: request review** (planning mode), so case 3 records a plan review.
- **MCP server:** in Antigravity's MCP settings, open the raw config and add the harmless reference server:

  ```json
  { "mcpServers": { "everything": { "command": "cmd", "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-everything"] } } }
  ```

  Remove it again after case 2 if you do not want it. Drishya never reads or writes this file.

## 3. One new conversation per case (paste the prompt)

| # | Case | Prompt | What you do |
|---|---|---|---|
| 1 | Browser subagent, screenshots, recording | Open index.html in the browser, take a screenshot, click "Add one" three times and confirm the counter shows 3. | Nothing; let it finish. |
| 2 | MCP call | Use the everything MCP server: call its echo tool with "drishya-ag5-mcp", then get-sum with 2 and 3, then get-tiny-image. Use actual MCP calls; do not simulate them in a shell. | Allow the tool if asked. |
| 3 | Plan and plan review | Plan adding a "Reset" button to index.html. Wait for my review before writing code. | Leave one comment on the plan, then approve it. |
| 4 | Question | Before changing anything, ask me which colour the Reset button should be, offering three choices. | Answer it. Then start a second conversation with the same prompt and skip or dismiss the question. |
| 5 | Command approval, approved and denied | Run `npm test`, then run `git clean -n`. | Approve the first, deny the second. |
| 6 | Image and PDF prompt | Attach any screenshot: "What is in this image?" Then, in a new conversation, attach any harmless PDF: "Summarise this PDF in two lines." | Use nothing private. |
| 7 | Input to a running command | Run `node ask.mjs` and answer its question with yes. | Approve if asked. |
| 8 | Background command | Start `node server.mjs` in the background, then fetch http://localhost:4317 and tell me what it returns, then stop the server. | Approve if asked. |
| 9 | Failing test and fix | Run the tests, find why they fail, and fix it. | Approve if asked. |

Approvals, plan review and questions need a click in Antigravity's window, so be at the PC or on a remote desktop
connection to it (for example Chrome Remote Desktop). The other cases run unattended.

## 4. Afterwards

Tell Codex (or Fable) the cases are recorded and roughly when. Codex finds them with `pnpm check:real -- antigravity`
in a scratch home, maps each, adds synthetic reproductions and `check:real` cases, and lists any case that could not
be produced, with the reason. Delete `ag-cases` whenever you like; the recorded sessions stay in Antigravity.

## 14 November: current MCP tool names

The official Everything feature list names `echo`, `get-sum` (not the old `add`) and `get-tiny-image`. Source: https://github.com/modelcontextprotocol/servers/blob/main/src/everything/docs/features.md . Use the client's actual supported MCP registration flow, preserving existing servers and permissions; the user may complete required UI/restart actions. Drishya never reads or edits native MCP configuration or credentials. Install test dependencies only in the throwaway workspace when needed.
