# DATA-8 — fresh reasoning-summary persistence verification

27 October 2026. Documentation and native-session research only. **Fresh Codex CLI and Claude Code interactive CLI persistence verified under the conditions below. Claude headless behavior was checked separately.** No adapter, event schema, projection, controller or UI change.

## Result and evidence boundary

On this machine, fresh Codex CLI sessions with explicit `model_reasoning_summary` values `auto`, `concise` and `detailed` retained readable, exposed summaries in their normal native journals. Two `none` sessions retained encrypted reasoning items with empty summary arrays. This supports a narrow opt-in command in README. It does not establish complete reasoning capture, a summary on every turn, or identical behavior in the desktop app, interactive TUI or a connected App Server turn.

On Claude Code, the interactive `showThinkingSummaries: true` setting retained exposed summary text in a fresh native journal, while the default retained a signature-only block. Headless `-p` sessions retained only signature-only blocks both with and without that setting. Neither enabling thinking nor increasing effort alone establishes readable journal retention. Private reasoning is outside this research: encrypted content is never decoded, and exposed summaries are never described as the complete internal reasoning.

## Sources and installed capabilities

Local native executable help and declarations were checked, without invoking an installer or npm shim. The Codex binary reports **0.164.0-alpha.11.1**; Claude Code reports **2.1.282**. No credentials, tokens or account email printed.

| Source | What it establishes | Limit |
| --- | --- | --- |
| Installed Codex `exec --help` | Per-invocation `-c key=value`; normal session persistence unless `--ephemeral`; read-only sandbox option | CLI declaration, not model behavior |
| Installed Codex generated `ConfigReadResponse` JSON schema | `ReasoningSummary` values `auto`, `concise`, `detailed`, `none` | Generated under ignored `.local/`; schema does not prove persistence |
| Installed Codex bundled model catalog | Configured `gpt-5.6-terra` advertises medium default effort and `default_reasoning_summary: none` | Bundled defaults are not effective per-turn settings |
| [Official Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) | `model_reasoning_summary` selects summary detail; `model_supports_reasoning_summaries` affects reasoning metadata; `hide_agent_reasoning` and `show_raw_agent_reasoning` concern output visibility | No support-forcing or raw-content option was enabled. Display controls are not established storage switches |
| [Official OpenAI reasoning guide](https://developers.openai.com/api/docs/guides/reasoning#reasoning-summaries) | Exposed summaries are opt-in; available summary levels depend on the model; encrypted content is separate | API documentation alone does not prove a Codex journal shape |
| Installed Claude binary's embedded settings declaration and native `--help` | `showThinkingSummaries` exists locally; `--settings` accepts a per-invocation JSON override | Declaration alone is not persistence verification; actual tests are below |
| [Claude settings reference](https://code.claude.com/docs/en/settings-reference#showthinkingsummaries) | `showThinkingSummaries: true` requests visible summaries for interactive sessions; default `false` uses API-redacted blocks | Interactive scope matters; it is not a blanket promise about every CLI output mode |
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

## Fresh Claude procedure and evidence

The initial native status check was signed out, so model tests initially stopped. The builder then signed in locally; the one requested read-only recheck reported **`loggedIn: true`, `authMethod: claude.ai`, `apiProvider: firstParty`**. The agent never opened a sign-in flow or inspected/changed credentials. The authenticated native tests reported **Claude Code 2.1.282 / `claude-opus-5-5`**.

Interactive sessions were launched through the already-installed local Windows PTY library using an argument array, fresh explicit UUIDs and empty isolated workspaces. The same benign combinatorics prompt as the headless control prohibited all tools, browsing, file inspection and subagents. No existing conversation was resumed. Every successful session used `--permission-mode plan`, an empty `--tools` list, empty strict MCP configuration, disabled slash commands and invocation-scoped `disableAllHooks: true` / `autoMemoryEnabled: false` settings. Nonessential traffic, telemetry, error reporting, auto-updates, marketplace auto-install and auto-memory were disabled through supported invocation [environment variables](https://code.claude.com/docs/en/env-vars). The probe did not directly edit any native configuration file.

Native interactive startup required consent for the repository's external `CLAUDE.md` import; an outside-repository temporary workspace instead required workspace trust. A `--safe-mode` attempt still presented the import consent. **None of these prompts was answered; none reached a model turn or wrote the requested session journal.** The first two attempts timed out around 101 seconds; the safe-mode attempt stopped at the detected prompt after about five seconds. They are excluded from the successful-session counts.

The successful isolation used the supported invocation-only [`claudeMdExcludes` setting](https://code.claude.com/docs/en/settings-reference#claudemdexcludes) to exclude the exact, unrelated repository-root `CLAUDE.md` for this no-tools task. This avoided requesting the external import. Managed policy memory cannot be excluded by that setting; the existing permission policy was not weakened. The workspace was a fresh empty ignored directory beneath the already trusted checkout. The successful runs did **not** use safe mode, bypass permissions or answer any approval/consent prompt. Each reached a recorded `end_turn` and then exited its own fresh process.

The opt-in added `showThinkingSummaries: true` to the invocation's JSON settings; controls left it unset. The standalone user-facing command is:

```bash
claude --settings '{"showThinkingSummaries":true}'
```

Headless controls used separate empty OS-temporary workspaces and the same isolation settings, `--print --verbose --output-format stream-json`. They succeeded with zero error results. This is a separate surface, not a substitute for the interactive test.

| Surface / requested setting | Session ID prefix | Journal bytes | Records | Thinking blocks | Signature-only blocks | Nonempty thinking blocks | Thinking characters |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Headless, unset | `99b38b42-1977-4324` | 26,405 | 17 | 1 | 1 | 0 | 0 |
| Headless, `true` | `4802d78e-fa77-4ca4` | 26,233 | 17 | 1 | 1 | 0 | 0 |
| Interactive, unset | `efca7305-c6dc-4142` | 73,280 | 24 | 1 | 1 | 0 | 0 |
| Interactive, `true` | `02b798e4-d5b6-4549` | 74,519 | 25 | 1 | 0 | 1 | 501 |
| Interactive, unset, repeat | `e420428e-ea51-4030` | 73,587 | 24 | 1 | 1 | 0 | 0 |
| Interactive, `true`, repeat | `bdcdb372-2b7d-48b9` | 73,447 | 24 | 1 | 0 | 1 | 519 |

Total: **6 successful Claude sessions, 347,471 bytes, 131 records, 6 thinking blocks, 4 signature-only blocks, 2 nonempty blocks / 1,020 thinking characters**. The readable material was in a native assistant message's `content` block with `type: thinking` and a nonempty `thinking` string. Its text and signature are deliberately omitted. All successful journals had **zero tool-use blocks, zero malformed records and zero `redacted_thinking` blocks**; the absent-text form was a `thinking` block with a signature. Permission metadata remained `plan`. A signature-only block is not an absence of model reasoning. Existing historical samples from review 123 and TASKS' 21 October survey remain observational context, not fresh controls.

## Limits and validation

The tested commands opt in to summaries the harness exposes; no setting recovers old missing text or guarantees a summary on every future turn. Longer `detailed` output, private reasoning access, all-model/provider support and saved-config mutation were not tested or claimed. The Claude interactive test establishes **journal retention**; the Ctrl+O expansion gesture and Drishya rendering of these fresh sessions were not exercised. The headless result specifically prevents recommending this setting as a general `-p` persistence solution.

Also unmeasured: other models/accounts/providers, Codex desktop/TUI model turns, connected App Server model turns, hooks and long sessions. No Drishya rendering behavior changed, so fixture/browser/full-suite reruns would not validate this documentation-only research and were not run. README links, journal prefix/size consistency and document diff were checked. Root coordination owns TASKS/STATUS updates; this report does not open a parallel work queue.
