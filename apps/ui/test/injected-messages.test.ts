import { describe, expect, it } from 'vitest';
import { injectedLine, injectedMessage, isPersonPrompt } from '../src/lib/injected-messages.ts';

// CONTENT-11: notices Claude Code wrote in the user role are recognised by an exact leading tag, nothing looser.
describe('harness-written user messages', () => {
  it('reads a finished background task with its recorded status, summary and task id', () => {
    const note = injectedMessage('<task-notification>\n<task-id>bfodo1oce</task-id>\n<tool-use-id>toolu_x</tool-use-id>\n<status>completed</status>\n<summary>Background command "Run tests" completed (exit code 0)</summary>\n</task-notification>');
    expect(note).toMatchObject({ kind: 'background-task', label: 'background task completed', detail: 'Background command "Run tests" completed (exit code 0)', hover: 'Task bfodo1oce' });
    expect(injectedLine(note!)).toBe('Claude Code · background task completed: Background command "Run tests" completed (exit code 0)');
  });
  it('still reads a notice whose closing tags were clipped', () => {
    expect(injectedMessage('<task-notification>\n<task-id>b1</task-id>\n<status>failed</status>\n<summary>Background command "x" fail')).toMatchObject({ label: 'background task failed', detail: 'Background command "x" fail' });
  });
  it('reads a slash command echo, its output, an interruption and a reminder', () => {
    expect(injectedMessage('<command-name>/compact</command-name>\n<command-message>compact</command-message>\n<command-args>keep tests</command-args>')).toMatchObject({ kind: 'slash-command', detail: '/compact keep tests' });
    expect(injectedMessage('<local-command-stdout>Compacted</local-command-stdout>')).toMatchObject({ kind: 'command-output', detail: 'Compacted' });
    expect(injectedMessage('[Request interrupted by user for tool use]')).toMatchObject({ kind: 'interrupted', detail: 'Request interrupted by user for tool use' });
    expect(injectedMessage('<system-reminder>\nUse the task tools.\n</system-reminder>')).toMatchObject({ kind: 'reminder', detail: 'Use the task tools.' });
  });
  // CONTENT-20: Claude Code delivers another session's message (origin `peer`) like a queued prompt; the person did not type it.
  it('reads a message another Claude Code session sent in as a notice, not a person prompt', () => {
    const text = '<cross-session-message from="session-a" from-name="planner" from-mode="acceptEdits">\nPlease rebase before you push.\n</cross-session-message>';
    expect(injectedMessage(text)).toMatchObject({ kind: 'cross-session', label: 'message from another session', detail: 'Please rebase before you push.', hover: 'From planner' });
    expect(injectedLine(injectedMessage(text)!)).toBe('Claude Code · message from another session: Please rebase before you push.');
    expect(isPersonPrompt(text)).toBe(false);
    expect(isPersonPrompt('<cross-session-message from="a">clipped preview')).toBe(false);
    expect(isPersonPrompt('Why does <cross-session-message> appear as a prompt?')).toBe(true);
    expect(isPersonPrompt('<cross-session-message')).toBe(true);
  });
  it('leaves typed prompts, mentions of a tag, empty wrappers and unknown wrappers alone', () => {
    expect(injectedMessage('Fix the checkout total')).toBeUndefined();
    expect(injectedMessage('Why does <task-notification> show up as a prompt?')).toBeUndefined();
    expect(injectedMessage('Please read [Request interrupted by user] in the log')).toBeUndefined();
    expect(injectedMessage('<task-notification></task-notification>')).toBeUndefined();
    expect(injectedMessage('<unknown-wrapper>text</unknown-wrapper>')).toBeUndefined();
    expect(injectedMessage('<command-name></command-name>')).toBeUndefined();
  });
});
