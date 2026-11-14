import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, beforeEach } from 'vitest';
import type { Operation } from '@drishya/contracts';
import { QuestionCard } from '../src/components/QuestionCard.tsx';
import { useApp } from '../src/state.ts';
import {
  clearQuestionReceipts,
  recordQuestionReceipt,
  recordQuestionStop,
} from '../src/lib/ask-question.ts';

const baseOp: Operation = {
  id: 'op-q1',
  tool: 'AskUserQuestion',
  status: 'running',
  artifactIds: [],
  classification: { kind: 'derived' },
  detail: {
    kind: 'other',
    input: {
      questions: [
        {
          id: 'q0',
          header: 'Approach',
          question: 'Which approach should I take?',
          multiSelect: false,
          options: [
            { label: 'Small patch', description: 'Modify existing code' },
            { label: 'Rewrite', description: 'Start fresh' },
          ],
        },
      ],
    },
  },
};

describe('QuestionCard component states', () => {
  beforeEach(() => {
    clearQuestionReceipts();
    useApp.setState({
      recordingId: 'rec-test-1',
      recording: { id: 'rec-test-1', harness: 'claude-code', title: 'Test', startedAt: '2026-10-18T00:00:00Z', endedAt: '2026-10-18T00:05:00Z', count: 1 } as any,
    });
  });

  it('renders a read-only list with Answer in Claude Code for CLI sessions', () => {
    const html = renderToStaticMarkup(createElement(QuestionCard, { op: baseOp }));
    expect(html).toContain('Which approach should I take?');
    expect(html).toContain('Small patch');
    expect(html).toContain('Rewrite');
    expect(html).toContain('Answer in Claude Code');
    expect(html).toContain('Waiting for your answer in Claude Code');
    // Readonly state MUST NOT have clickable bullet circles
    expect(html).not.toContain('question-mark');
    expect(html).toContain('question-card-readonly');
  });

  it('renders Answer in Codex when harness is codex', () => {
    const codexOp: Operation = {
      ...baseOp,
      id: 'op-codex-1',
      tool: 'request_user_input',
    };
    const html = renderToStaticMarkup(createElement(QuestionCard, { op: codexOp }));
    expect(html).toContain('Answer in Codex');
    expect(html).toContain('Waiting for your answer in Codex');
  });

  it('renders interactive form when a live input request is present in a driven session', () => {
    const liveRequest = {
      id: 'req-1',
      questions: [
        {
          id: 'q0',
          header: 'Approach',
          question: 'Which approach should I take?',
          multiple: false,
          allowText: true,
          options: [
            { id: 'o0', label: 'Small patch', description: 'Modify existing code' },
            { id: 'o1', label: 'Rewrite', description: 'Start fresh' },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(createElement(QuestionCard, { op: baseOp, liveRequest }));
    expect(html).toContain('Agent needs your input');
    expect(html).toContain('type="radio"');
    expect(html).toContain('Small patch');
    expect(html).toContain('Rewrite');
    expect(html).toContain('Send answer');
    expect(html).toContain('Stop turn');
    expect(html).toContain('Or write your answer');
  });

  it('renders multi-select checkboxes when multiple is true', () => {
    const liveRequest = {
      id: 'req-2',
      questions: [
        {
          id: 'q0',
          header: 'Options',
          question: 'Select components',
          multiple: true,
          allowText: false,
          options: [
            { id: 'o0', label: 'A', description: '' },
            { id: 'o1', label: 'B', description: '' },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(createElement(QuestionCard, { op: baseOp, liveRequest }));
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('choose any');
  });

  it('renders Stopped by you when deliberate stop is recorded', () => {
    recordQuestionStop('rec-test-1', 'op-q1');
    const html = renderToStaticMarkup(createElement(QuestionCard, { op: baseOp }));
    expect(html).toContain('Stopped by you');
    expect(html).not.toContain('Waiting for your answer');
  });

  it('renders answered state with Sent by Drishya receipt when answered via Drishya', () => {
    recordQuestionReceipt(
      'rec-test-1',
      'op-q1',
      { q0: { options: ['Small patch'] } },
      [{ question: 'Which approach should I take?', multiSelect: false, options: [{ label: 'Small patch' }], chosen: [] }]
    );
    const completedOp: Operation = {
      ...baseOp,
      status: 'ok',
      detail: {
        kind: 'other',
        input: baseOp.detail.kind === 'other' ? baseOp.detail.input : undefined,
        resultPreview: 'The user answered: "Which approach should I take?"="Small patch"',
      },
    };
    const html = renderToStaticMarkup(createElement(QuestionCard, { op: completedOp }));
    expect(html).toContain('Sent by Drishya');
    expect(html).toContain('data-chosen="true"');
    expect(html).toContain('question-mark');
  });

  it('renders answered state without Sent by Drishya when answered in native client', () => {
    const completedOp: Operation = {
      ...baseOp,
      status: 'ok',
      detail: {
        kind: 'other',
        input: baseOp.detail.kind === 'other' ? baseOp.detail.input : undefined,
        resultPreview: 'The user answered: "Which approach should I take?"="Small patch"',
      },
    };
    const html = renderToStaticMarkup(createElement(QuestionCard, { op: completedOp }));
    expect(html).not.toContain('Sent by Drishya');
    expect(html).toContain('data-chosen="true"');
    expect(html).toContain('Question and answer');
  });
});