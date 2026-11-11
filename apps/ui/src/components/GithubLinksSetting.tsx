import { useEffect, useState } from 'react';
import { workspaceApi } from '../api.ts';
import { useApp } from '../state.ts';
import { GITHUB_OPTIN_EVENT } from './LinkCard.tsx';

/** LINK-1: the explicit opt-in for GitHub pull request and issue cards. Off by default; on, Drishya asks the person's own `gh` CLI. */
export function GithubLinksSetting() {
  const local = useApp(s => s.source)?.kind === 'daemon';
  const [status, setStatus] = useState<{ enabled: boolean; available?: boolean }>();
  const [error, setError] = useState('');
  useEffect(() => { if (local) workspaceApi.githubStatus().then(setStatus, () => setError('Could not read this setting.')); }, [local]);
  const change = async (enabled: boolean) => {
    setError('');
    try { setStatus(await workspaceApi.githubOptIn(enabled)); window.dispatchEvent(new Event(GITHUB_OPTIN_EVENT)); }
    catch { setError('Could not change this setting.'); }
  };
  return <section><h3>Links</h3>
    <p className="muted small">Web addresses in the agent’s words and in web and browser tool results open in your default browser. A file, commit or branch shows a small card from what Drishya already holds and your repository; a plain address shows only its domain.</p>
    <label className="setting-row"><span>GitHub pull request and issue cards<small>Off by default. When on, hovering a github.com pull request or issue link asks the GitHub CLI you have installed and signed in to (`gh`) for its title, state and size. Drishya holds no token, sends nothing itself and never fetches other addresses.{status?.available === false ?' The GitHub CLI was not found on this computer.' : ''}</small></span>
      <input type="checkbox" aria-label="GitHub pull request and issue cards" checked={!!status?.enabled} disabled={!local || !status} onChange={event => void change(event.target.checked)} /></label>
    {!local && <p className="muted small">Available when Drishya runs on your computer.</p>}
    {error && <p role="alert" className="muted small">{error}</p>}
  </section>;
}
