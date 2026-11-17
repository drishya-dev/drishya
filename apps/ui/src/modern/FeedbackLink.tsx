import './feedback-link.css';

/** FEEDBACK-1: where feedback lives. A plain link that opens GitHub's issue chooser in a new tab;
 * Drishya sends nothing (no telemetry), and the page gets no referrer. See docs/decisions/log.md. */
export const FEEDBACK_URL = 'https://github.com/drishya-dev/drishya/issues/new/choose';

export function FeedbackLink({ children = 'Feedback' }: { children?: string }) {
  return <a className="feedback-link" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
    title="Report a bug or share an idea on GitHub. Opens in a new tab; nothing is sent from Drishya.">
    <span>{children}</span><span className="feedback-arrow" aria-hidden="true">↗</span>
  </a>;
}
