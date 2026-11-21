import { useId, useState } from 'react';
import type { Operation } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { useSessionWorkspace } from './SessionWorkspace.tsx';
import { workspaceApi } from '../api.ts';
import type { NativeInputRequest } from '../../../daemon/src/native-input-types.ts';
import {
  askQuestions,
  questionAcceptance,
  getQuestionReceipt,
  recordQuestionReceipt,
  isQuestionStopped,
  recordQuestionStop,
} from '../lib/ask-question.ts';
import './question-card.css';

interface QuestionCardProps {
  op: Operation;
  liveRequest?: NativeInputRequest;
  onAnswer?: (answers: Record<string, { options: string[]; text?: string }>) => Promise<void>;
  onStop?: () => Promise<void>;
}

/**
 * A question the agent put to the person.
 * In a Drishya-driven session: interactive controls, sending/sent states, reaches harness.
 * In a CLI-started session: read-only form with "Answer in Claude Code/Codex", never controls that look clickable.
 * After answering: shows chosen options/free text with "Sent by Drishya" receipt distinct from captured answer.
 */
export function QuestionCard({ op, liveRequest, onAnswer, onStop }: QuestionCardProps) {
  const formId = useId();
  const recordingId = useApp((s) => s.recordingId);
  const recording = useApp((s) => s.recording);
  const { controller, submitting: turnSubmitting } = useSessionWorkspace();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [answers, setAnswers] = useState<Record<string, { options: string[]; text?: string }>>({});

  const detail = op.detail.kind === 'other' ? op.detail : undefined;
  const questions = askQuestions(detail?.input, detail?.resultPreview, op.tool);
  if (!questions.length) return null;

  const harnessName = recording?.harness ?? controller?.harness ?? (op.tool === 'AskUserQuestion' ? 'claude-code' : (op.tool === 'request_user_input' || op.tool === 'request_user_input_async') ? 'codex' : undefined);
  const harnessLabel = harnessName === 'claude-code' ? 'Claude Code' : harnessName === 'codex' ? 'Codex' : harnessName === 'antigravity' || op.tool === 'ask_question' ? 'Antigravity' : 'the native client';

  const passiveNative = op.tool === 'ask_question' || harnessName === 'antigravity';
  const isDriven = !passiveNative && Boolean(
    liveRequest ||
    (controller?.runId && (controller?.state === 'approval' || controller?.state === 'running'))
  );

  const matchingRequest: NativeInputRequest | undefined = (!passiveNative ? liveRequest : undefined) ?? (
    isDriven
      ? controller?.inputRequests?.find((req) => {
          if (controller.inputRequests?.length === 1) return true;
          return req.questions.some((q) => questions.some((cq) => cq.question === q.question));
        })
      : undefined
  );

  const receipt = passiveNative ? undefined : getQuestionReceipt(recordingId, op.id) ?? (matchingRequest ? getQuestionReceipt(recordingId, matchingRequest.id) : undefined);
  const stopped = !passiveNative && (isQuestionStopped(recordingId, op.id) || (matchingRequest ? isQuestionStopped(recordingId, matchingRequest.id) : false) || controller?.state === 'stopped');

  // Deliberate stop state
  if (stopped && op.status === 'running') {
    return (
      <div className="question-card" role="group" aria-label="Question to you">
        {questions.map((item, index) => (
          <section key={`${item.id ?? item.question}/${index}`} className="question">
            {item.header && <small className="question-header">{item.header}</small>}
            <p className="question-text">{item.question}</p>
            <ul className="question-options">
              {item.options.map((option) => (
                <li key={option.label}>
                  <span className="question-label">{option.label}</span>
                  {option.description && <span className="question-description">{option.description}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <small className="question-state">Stopped by you</small>
      </div>
    );
  }

  const waiting = op.status === 'running' && !receipt && !stopped;
  const accepted = questionAcceptance(detail?.resultPreview);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchingRequest || submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      if (onAnswer) {
        await onAnswer(answers);
      } else if (recordingId && controller?.runId) {
        await workspaceApi.answer(recordingId, controller.runId, matchingRequest.id, answers);
      }
      recordQuestionReceipt(recordingId ?? '', op.id, answers, questions);
      recordQuestionReceipt(recordingId ?? '', matchingRequest.id, answers, questions);
    } catch (err) {
      setError((err as Error).message || 'Failed to send answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      if (onStop) {
        await onStop();
      } else if (recordingId && controller?.runId) {
        await workspaceApi.stop(recordingId, controller.runId);
      }
      recordQuestionStop(recordingId ?? '', op.id);
      if (matchingRequest) recordQuestionStop(recordingId ?? '', matchingRequest.id);
    } catch (err) {
      setError((err as Error).message || 'Failed to stop turn');
    } finally {
      setSubmitting(false);
    }
  };

  // Case 1: Driven session with active matching question request -> Interactive Form
  if (waiting && matchingRequest) {
    const isComplete = matchingRequest.questions.every(
      (q) => !!answers[q.id]?.options.length || !!answers[q.id]?.text?.trim()
    );

    return (
      <form
        className="question-card question-interactive"
        aria-label="Agent needs your input"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="question-card-header">
          <span className="question-status-beacon" aria-hidden="true" />
          <div className="question-card-title-group">
            <div className="question-card-title-row">
              <strong className="question-card-title">Question to you</strong>
              <span className="question-card-badge">Choice required</span>
            </div>
            <span className="question-card-sub">The connected agent is waiting for your choice</span>
          </div>
        </header>

        {matchingRequest.questions.map((q) => (
          <fieldset key={q.id} className="question-fieldset" aria-label={q.question} disabled={submitting}>
            {q.header && <small className="question-header">{q.header}{q.multiple ? ' · choose any' : ''}</small>}
            <p className="question-text">{q.question}</p>

            <div className="question-options-interactive" role={q.multiple ? 'group' : 'radiogroup'} aria-label={q.question}>
              {q.options.map((option) => {
                const checked = answers[q.id]?.options.includes(option.id) ?? false;
                return (
                  <label
                    key={option.id}
                    className={`question-option-label${checked ? ' is-checked' : ''}`}
                  >
                    <input
                      type={q.multiple ? 'checkbox' : 'radio'}
                      name={`${formId}/${q.id}`}
                      value={option.id}
                      checked={checked}
                      disabled={submitting}
                      onChange={(e) =>
                        setAnswers((old) => ({
                          ...old,
                          [q.id]: {
                            options: q.multiple
                              ? e.target.checked
                                ? [...(old[q.id]?.options ?? []), option.id]
                                : (old[q.id]?.options ?? []).filter((id) => id !== option.id)
                              : [option.id],
                            text: q.multiple ? old[q.id]?.text ?? '' : '',
                          },
                        }))
                      }
                    />
                    <span className="question-option-text">
                      <span className="question-label">{option.label}</span>
                      {option.description && (
                        <span className="question-description">{option.description}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            {q.allowText && (
              <label className="question-text-answer">
                <span>
                  {q.options.length
                    ? q.multiple
                      ? 'Add your own answer (optional)'
                      : 'Or write your answer'
                    : 'Your answer'}
                </span>
                <textarea
                  rows={2}
                  maxLength={4000}
                  className="question-textarea"
                  aria-label={`Answer: ${q.question}`}
                  placeholder="Type your answer…"
                  disabled={submitting}
                  value={answers[q.id]?.text ?? ''}
                  onChange={(e) =>
                    setAnswers((old) => ({
                      ...old,
                      [q.id]: {
                        options: q.multiple ? old[q.id]?.options ?? [] : [],
                        text: e.target.value,
                      },
                    }))
                  }
                />
              </label>
            )}
          </fieldset>
        ))}

        {error && <p className="bad small" role="alert">{error}</p>}

        <footer className="question-form-actions">
          <button
            type="button"
            className="btn ghost small"
            disabled={submitting}
            onClick={handleStop}
          >
            Stop turn
          </button>
          <button
            type="submit"
            className="btn small"
            disabled={submitting || !isComplete}
          >
            {submitting ? 'Sending…' : 'Send answer'}
          </button>
        </footer>
      </form>
    );
  }

  // Case 2: Waiting in CLI session (observer mode) -> Read-only options, no clickable controls
  if (waiting && !matchingRequest) {
    return (
      <div className="question-card question-card-readonly" role="group" aria-label="Question to you">
        <div className="question-terminal-banner" role="status">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="12" height="10" rx="2" />
            <path d="m5 7 2 1.5-2 1.5M9 10h2" />
          </svg>
          <span>This question is waiting in your {harnessLabel} terminal. Answer it there.</span>
        </div>
        {questions.map((item, index) => (
          <section key={`${item.id ?? item.question}/${index}`} className="question">
            {item.header && <small className="question-header">{item.header}{item.multiSelect ? ' · choose any' : ''}</small>}
            <p className="question-text">{item.question}</p>
            <ul className="question-options question-options-readonly">
              {item.options.map((option) => (
                <li key={option.label} className="question-option-readonly">
                  <span className="question-label">{option.label}</span>
                  {option.description && <span className="question-description">{option.description}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {questions.some((item) => !item.options.length) && (
          <small className="question-state">No offered options were recorded.</small>
        )}
        <div className="question-answer-elsewhere" role="note">
          <span className="question-answer-elsewhere-badge">Answer in {harnessLabel}</span>
        </div>
        <small className="question-state">Waiting for your answer in {harnessLabel}</small>
      </div>
    );
  }

  // Case 3: Answered (or sent by Drishya)
  return (
    <div className="question-card" role="group" aria-label="Question to you">
      {questions.map((item, index) => {
        const chosenOptions = item.chosen.length ? item.chosen : (receipt?.chosen ?? []);
        const typedText = item.typed ?? receipt?.typed;
        return (
          <section key={`${item.id ?? item.question}/${index}`} className="question">
            {item.header && <small className="question-header">{item.header}{item.multiSelect ? ' · choose any' : ''}</small>}
            <p className="question-text">{item.question}</p>
            <ul className="question-options">
              {item.options.map((option) => {
                const isChosen = chosenOptions.includes(option.label);
                return (
                  <li key={option.label} data-chosen={isChosen || undefined}>
                    <span className="question-mark" aria-hidden="true" />
                    <span className="question-label">
                      {option.label}
                      {isChosen && <span className="sr-only"> (chosen)</span>}
                    </span>
                    {option.description && <span className="question-description">{option.description}</span>}
                  </li>
                );
              })}
            </ul>
            {item.skipped && questions.length > 1 && <small className="question-state">Skipped</small>}
            {typedText && (
              <p className="question-typed">
                <small>{item.native ? 'Recorded answer' : !item.options.length ? 'Answer' : chosenOptions.length ? 'Also wrote' : 'Wrote'}</small> {typedText}
              </p>
            )}
          </section>
        );
      })}
      {questions.some((item) => !item.options.length) && (
        <small className="question-state">No offered options were recorded.</small>
      )}
      <div className="question-card-footer">
        {receipt && <span className="question-receipt-badge">Sent by Drishya</span>}
        <small className="question-state">
          {op.status === 'running'
            ? 'Waiting for agent to resume'
            : questions.some((item) => item.answer) || receipt
            ? 'Question and answer'
            : questions.some((item) => item.skipped)
            ? 'Question skipped'
            : questions.some((item) => item.native)
            ? 'Answer not identified in this capture'
            : accepted === true
            ? 'Codex recorded the question as accepted; the answer is not part of this record'
            : accepted === false
            ? 'Codex recorded the question as not accepted'
            : 'No answer was recorded'}
        </small>
      </div>
    </div>
  );
}