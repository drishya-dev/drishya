import type { Operation } from '@drishya/contracts';
import { askQuestions, questionAcceptance } from '../lib/ask-question.ts';
import './question-card.css';

/** A question the agent put to the person, with its options and, once answered, which was chosen. Captured text only. */
export function QuestionCard({ op }: { op: Operation }) {
  const detail = op.detail.kind === 'other' ? op.detail : undefined;
  const questions = askQuestions(detail?.input, detail?.resultPreview);
  if (!questions.length) return null;
  const waiting = op.status === 'running';
  const accepted = questionAcceptance(detail?.resultPreview);
  return <div className="question-card" role="group" aria-label="Question to you">
    {questions.map((item,index) => <section key={`${item.id??item.question}/${index}`} className="question">
      {item.header && <small className="question-header">{item.header}{item.multiSelect ? ' · choose any' : ''}</small>}
      <p className="question-text">{item.question}</p>
      <ul className="question-options">{item.options.map((option) => <li key={option.label} data-chosen={item.chosen.includes(option.label) || undefined}>
        <span className="question-mark" aria-hidden="true" /><span className="question-label">{option.label}{item.chosen.includes(option.label) && <span className="sr-only"> (chosen)</span>}</span>
        {option.description && <span className="question-description">{option.description}</span>}
      </li>)}</ul>
      {item.typed && <p className="question-typed"><small>{!item.options.length ? 'Answer' : item.chosen.length ? 'Also wrote' : 'Wrote'}</small> {item.typed}</p>}
    </section>)}
    {questions.some((item) => !item.options.length) && <small className="question-state">No offered options were recorded.</small>}
    <small className="question-state">{waiting ? 'Waiting for your answer' : questions.some((item) => item.answer) ? 'Question and answer' : accepted === true ? 'Codex recorded the question as accepted; the answer is not part of this record' : accepted === false ? 'Codex recorded the question as not accepted' : 'No answer was recorded'}</small>
  </div>;
}
