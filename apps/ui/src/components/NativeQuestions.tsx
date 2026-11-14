import { useId, useState } from 'react';
import type { NativeInputRequest } from '../../../daemon/src/native-input-types.ts';
import { recordQuestionReceipt, recordQuestionStop } from '../lib/ask-question.ts';
import { useApp } from '../state.ts';

export function NativeQuestions({
  request,
  busy,
  answer,
  stop,
}: {
  request: NativeInputRequest;
  busy: boolean;
  answer: (answers: Record<string, { options: string[]; text?: string }>) => Promise<void> | void;
  stop: () => Promise<void> | void;
}) {
  const name = useId();
  const recordingId = useApp((s) => s.recordingId);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { options: string[]; text?: string }>>({});

  const complete = request.questions.every(
    (q) => !!answers[q.id]?.options.length || !!answers[q.id]?.text?.trim()
  );

  const isBusy = busy || submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || isBusy) return;
    setSubmitting(true);
    try {
      if (recordingId) recordQuestionReceipt(recordingId, request.id, answers);
      await answer(answers);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStop = async () => {
    if (isBusy) return;
    setSubmitting(true);
    try {
      if (recordingId) recordQuestionStop(recordingId, request.id);
      await stop();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="native-questions"
      aria-label="Agent needs your input"
      onSubmit={handleSubmit}
    >
      <header>
        <strong>Answer requested</strong>
        <span>The connected agent is waiting</span>
      </header>
      <div className="native-question-list">
        {request.questions.map((q) => (
          <fieldset key={q.id} disabled={isBusy}>
            <legend>{q.question}</legend>
            {q.options.map((option) => (
              <label className="native-answer-option" key={option.id}>
                <input
                  type={q.multiple ? 'checkbox' : 'radio'}
                  name={`${name}/${q.id}`}
                  checked={answers[q.id]?.options.includes(option.id) ?? false}
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
                <span>
                  {option.label}
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
            {q.allowText && (
              <label className="native-answer-text">
                {q.options.length
                  ? q.multiple
                    ? 'Add your own answer (optional)'
                    : 'Or write your answer'
                  : 'Your answer'}
                <textarea
                  rows={2}
                  maxLength={4000}
                  aria-label={`Answer: ${q.question}`}
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
      </div>
      <footer>
        <button
          type="button"
          className="btn ghost"
          disabled={isBusy}
          onClick={handleStop}
        >
          Stop turn
        </button>
        <button className="btn" disabled={isBusy || !complete}>
          {submitting ? 'Sending…' : 'Send answer'}
        </button>
      </footer>
    </form>
  );
}