# DATA-8 — fresh reasoning-summary persistence verification

27 October 2026. Documentation and native-session research only. **Codex CLI verified under the conditions below; Claude Code's fresh model test is blocked by absent authentication. DATA-8 remains open for that check.** No adapter, event schema, projection, controller or UI change.

## Result and evidence boundary

On this machine, fresh Codex CLI sessions with explicit `model_reasoning_summary` values `auto`, `concise` and `detailed` retained readable, exposed summaries in their normal native journals. Two `none` sessions retained encrypted reasoning items with empty summary arrays. This supports a narrow opt-in command in README. It does not establish complete reasoning capture, a summary on every turn, or identical behavior in the desktop app, interactive TUI or a connected App Server turn.

Claude Code has a directly relevant setting, `showThinkingSummaries`; it should be tested before recommending it as a verified persistence solution. Neither enabling thinking nor increasing effort alone establishes readable journal retention. Private reasoning is outside this research: encrypted content is never decoded, and exposed summaries are never described as the complete internal reasoning.

## Sources and installed capabilities

Local native executable help and declarations were checked, without invoking an installer or npm shim. The Codex binary reports **0.164.0-alpha.11.1**; Claude Code reports **2.1.282**. No credentials, tokens or account email printed.

| Source | What it establishes | Limit |
| --- | --- | --- |
| Installed Codex `exec --help` | Per-invocation `-c key=value`; normal session persistence unless `--ephemeral`; read-only sandbox option | CLI declaration, not model behavior |
| Installed Codex generated `ConfigReadResponse` JSON schema | `ReasoningSummary` values `auto`, `concise`, `detailed`, `none` | Generated under ignored `.local/`; schema does not prove persistence |
| Installed Codex bundled model catalog | Configured `gpt-5.6-terra` advertises medium default effort and `default_reasoning_summary: none` | Bundled defaults are not effective per-turn settings |
| [Official Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) | `model_reasoning_summary` selects summary detail; `model_supports_reasoning_summaries` affects reasoning metadata; `hide_agent_reasoning` and `show_raw_agent_reasoning` concern output visibility | No support-forcing or raw-content option was enabled. Display controls are not established storage switches |
| [Official OpenAI reasoning guide](https://developers.openai.com/api/docs/guides/reasoning#reasoning-summaries) | Exposed summaries are opt-in; available summary levels depend on the model; encrypted content is separate | API documentation alone does not prove a Codex journal shape |
| Installed Claude binary's embedded settings declaration and native `--help` | `showThinkingSummaries` exists locally; `--settings` accepts a per-invocation JSON override | No fresh Claude model turn reached; presence is not persistence verification |
| [Claude settings reference](https://code.claude.com/docs/en/settings-reference#showthinkingsummaries) | `showThinkingSummaries: true` requests visible summaries for interactive sessions; default `false` uses API-redacted blocks | Documentation, not a local authenticated result |
| [Claude model configuration](https://code.claude.com/docs/en/model-config#extended-thinking) | Thinking generation controls differ from summary visibility; Ctrl+O expands available material | Interactive display does not prove text was written to the journal |

The Claude settings reference was fetched as its official Markdown page because the browser retrieval of the full HTML exceeded its size limit. Both the setting's documentation and the installed embedded declaration were checked. No third-party documentation was used. Official pages were fetched on the test date; later version/model changes require retesting.

## Fresh Codex procedure

The native binary was spawned directly with Node argument arrays (`shell` disabled, hidden Windows process). A benign, identical finite combinatorics prompt asked for a count and a brief check, explicitly prohibiting tools, browsing, file inspection and subagents. Each invocation created a **new** session in its own empty, ignored `.local/data8-probe/workspace-*` directory. No existing working session was resumed or interrupted.

The test inherited the normal user configuration, then supplied only invocation-scoped overrides. Saved configuration, credentials and journals were never directly edited. Native Codex owned its normal session writes. MCP servers were disabled for these invocations; web search was disabled. Analytics and all three OTel exporters were disabled. No hook, exporter, extra external service or Drishya capture was added.

The executed argument structure was:

```text
codex --no-daemon -a on-request exec --json --skip-git-repo-check
  -s read-only -C <fresh empty workspace>
  -c model_reasoning_summary="<none|auto|concise|detailed>"
  -c analytics.enabled=false
  -c otel.exporter="none" -c otel.trace_exporter="none"
  -c otel.metrics_exporter="none" -c web_search="disabled"
  -c mcp_servers.<configured-name>.enabled=false
  <same benign no-tools prompt>
```

The MCP override was repeated for each configured server. The command is a description of argument-array execution, not a multiline command to paste verbatim. The model was the configured `gpt-5.6-terra`; effort was `medium`. Native `exec` recorded approval policy `never` despite the global `-a on-request`, and recorded sandbox `read-only`. No approval occurred, was answered, or was bypassed. Every run completed successfully with **zero tool calls**, zero observed authentication/unsupported-setting/rate-limit failures, and no malformed journal records. `--ephemeral`, resume/fork, bypass flags, policy/rules suppression and credential/config edits were not used.

A separate native App Server **read-only `config/read` request**, without starting or resuming a thread, confirmed that the invocation's effective `model_reasoning_summary` was `detailed`, model `gpt-5.6-terra`, effort `medium`, `hide_agent_reasoning: false`, and zero enabled MCP servers. This verifies configuration recognition only; it is not a connected App Server model-turn test.

## Actual persisted evidence

Exact fresh thread IDs from native CLI events were matched to native journal filenames internally. Only prefixes, sizes and counts are reported. Journals were read without mutation; no prompt, response, summary text, encrypted value or journal line was printed or committed. Local scripts, captured CLI output and generated schemas remain ignored under `.local/`.

| Requested summary / extra override | Session ID prefix | Journal bytes | Records | Reasoning items | Nonempty summary items | Summary characters | CLI JSON reasoning items |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `detailed` | `01a17bf6-5861-7b42` | 207,248 | 20 | 1 | 1 | 37 | 1 |
| `none` | `01a17bf6-b6c8-7eb1` | 207,132 | 20 | 1 | 0 | 0 | 0 |
| `auto` | `01a17bf6-e510-7ca3` | 207,187 | 20 | 1 | 1 | 41 | 1 |
| `concise` | `01a17bf6-fdc7-7fa0` | 211,702 | 20 | 1 | 1 | 33 | 1 |
| `detailed`, `hide_agent_reasoning=true` | `01a17bf8-15ab-7431` | 211,621 | 20 | 1 | 1 | 44 | 1 |
| `none`, repeat | `01a17bf8-3dc8-7a23` | 207,284 | 20 | 1 | 0 | 0 | 0 |
| `detailed`, repeat | `01a17bf8-54b5-76f2` | 212,018 | 20 | 1 | 1 | 49 | 1 |

Total: **7 sessions, 1,464,192 bytes, 140 records, 7 encrypted reasoning items, 5 nonempty summary blocks, 204 summary characters**. No reasoning item contained readable raw `content` text. Each nonempty summary was in `response_item` → `type: reasoning` → `summary` → `type: summary_text`; the exact text is deliberately omitted. The CLI's completed reasoning-item text lengths matched these summary lengths. There were zero separate reasoning `event_msg` records in these journals.

Two cautions are material:

1. **All seven `turn_context.summary` fields said `none`, including the five sessions that actually retained summaries.** Configuration recognition was separately verified as above. Historical grouping by this one metadata field cannot establish whether the opt-in worked; count the captured summary blocks and retain the invoked conditions. This helps explain why the earlier observational DATA-8 counts could not isolate the setting, without claiming a root cause for native behavior.
2. **`hide_agent_reasoning=true` did not remove the journal summary or the completed reasoning item from `exec --json` in this tested version.** The documentation describes output suppression; this observed JSON mode behavior is narrower and differs from a blanket reading of that description. No TUI/plain-output test was made. Do not use this flag as a privacy or persistence control on the basis of this research.

There was one preliminary harness launch that failed configuration validation before a session/model turn: the local probe initially targeted a nested MCP environment table instead of its server table. The argument generation was corrected; that failed launch is excluded from the seven successful sessions. It changed no saved configuration.

## Claude dependency and remaining acceptance

Native `claude auth status` returned **`loggedIn: false`, `authMethod: none`, `apiProvider: firstParty`**. The dependent model test stopped there. No sign-in flow was opened, no credential inspected or changed, and no model call or new Claude journal is claimed. Existing historical journals from review 123 and TASKS' 21 October survey are observational context, not substitutes for this missing test.

Once the builder has authenticated Claude Code normally, use fresh isolated **interactive** sessions to compare the default with the supported per-session candidate:

```bash
claude --settings '{"showThinkingSummaries":true}'
```

Use the same benign no-tools prompt, preserve the user's permission policy, and compare the native journal's actual nonempty `thinking` text with signature-only / `redacted_thinking` counts. Record version/model, effective setting, session prefixes, bytes and counts only. Check the corresponding interactive expansion separately. A headless `-p` test alone would not establish the documented interactive-default redaction behavior. Do not claim older journals gain missing text, that `alwaysThinkingEnabled` is a persistence option, or that unavailable summaries can be reconstructed.

Also unmeasured: other models/accounts/providers, saved-config edits, desktop/TUI Codex model turns, connected App Server model turns, hooks, long sessions, and any display/adapter changes. No Drishya rendering behavior changed, so fixture/browser/full-suite reruns would not validate this documentation-only research and were not run. README links and document diff were checked. Root coordination retains the Claude acceptance dependency in TASKS/STATUS; this report does not open a parallel work queue.
