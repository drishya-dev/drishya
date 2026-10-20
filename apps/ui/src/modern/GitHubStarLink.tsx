import './github-star-link.css';

/** UI-3: CSS adaptation of elijahgummer's MIT Uiverse reference; see docs/review/ui-3-home-github.md. */
export function GitHubStarLink() {
  return <a className="home-github-star" href="https://github.com/drishya-dev/drishya"
    target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91Z"/></svg>
    <span>Star on GitHub</span><span className="home-github-arrow" aria-hidden="true">↗</span>
  </a>;
}
