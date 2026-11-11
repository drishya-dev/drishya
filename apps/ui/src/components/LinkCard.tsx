import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { workspaceApi } from '../api.ts';
import { useApp } from '../state.ts';
import { githubTarget, hostOf, type LinkKind } from '../lib/link-kinds.ts';
import './link-card.css';

// LINK-1: the small card that says what a link is. It opens on hover or keyboard focus after a short delay and closes with a short
// fade. Files come from the evidence index the prose already uses, commits and branches from read-only local Git (when the
// person has approved Git inspection), GitHub items only through the person's own `gh` after an opt-in in Settings, and any other
// address shows only its domain and full text. Nothing is fetched for a plain URL, and nothing at all until the card opens.

export interface FileFacts { path: string; folder: boolean; captured: boolean; line?: number }
export type LinkTarget =
  | { kind: 'url' | 'github'; value: string }
  | { kind: 'commit' | 'branch'; value: string }
  | { kind: 'file'; value: string; file: FileFacts };

interface CardBody { heading: string; title?: string; facts?: string[]; stat?: string; note?: string }
type CardState = { phase: 'loading' } | { phase: 'ready'; body: CardBody } | { phase: 'none' };

const OPEN_HOVER = 320, OPEN_FOCUS = 120, CLOSE_DELAY = 140, CLOSE_FADE = 140;
const cache = new Map<string, CardBody | null>();
export const GITHUB_OPTIN_EVENT = 'drishya-github-optin';

const date = (iso?: string) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : undefined; };
const stat = (add?: number, del?: number, files?: number) => add === undefined && del === undefined ? undefined : `+${add ?? 0} −${del ?? 0}${files !== undefined ? ` · ${files} ${files === 1 ? 'file' : 'files'}` : ''}`;

function fileBody(file: FileFacts): CardBody {
  const parts = file.path.split('/').filter(Boolean), name = parts.at(-1) ?? file.path, folder = parts.slice(0, -1).join('/');
  return { heading: file.folder ? 'Folder' : 'File', title: name, facts: [...(folder ? [folder] : []), file.captured ? 'Captured in this session' : 'In the current index'], ...(file.line ? { stat: `Line ${file.line}` } : {}) };
}

async function load(target: LinkTarget, recording: string | undefined, local: boolean): Promise<CardBody | null> {
  if (target.kind === 'file') return fileBody(target.file);
  if (target.kind === 'url') return { heading: hostOf(target.value) || 'Link', title: target.value };
  if (target.kind === 'github') {
    const github = githubTarget(target.value)!;
    const label = `${github.owner}/${github.repo}#${github.number}`, heading = `${github.kind === 'pull' ? 'Pull request' : 'Issue'} · ${label}`;
    if (!local) return { heading, title: target.value, note: 'GitHub details are available when Drishya runs on your computer.' };
    const status = await workspaceApi.githubStatus();
    if (!status.enabled) return { heading, title: target.value, note: 'GitHub details are off. Turn them on in Settings → Links; they come from your own signed-in GitHub CLI.' };
    const reply = await workspaceApi.githubItem(target.value);
    if (reply.status === 'ready') {
      const item = reply.item, state = item.merged ? 'Merged' : item.draft ? 'Draft' : item.state === 'open' ? 'Open' : item.state === 'closed' ? 'Closed' : item.state;
      return { heading: `${item.kind === 'pull' ? 'Pull request' : 'Issue'} · ${label}`, title: item.title, facts: [state, ...(item.author ? [`by ${item.author}`] : [])], ...(item.kind === 'pull' ? { stat: stat(item.additions, item.deletions, item.changedFiles) } : {}) };
    }
    const note: Record<string, string> = {
      disabled: 'GitHub details are off. Turn them on in Settings → Links.',
      'gh-missing': 'The GitHub CLI (gh) was not found on this computer.',
      'gh-unauthenticated': 'Sign in with `gh auth login` to see this item here.',
      'not-found': 'GitHub could not find this item, or your account cannot see it.',
      failed: 'The GitHub CLI could not read this item right now.',
    };
    return { heading, title: target.value, note: note[reply.status] };
  }
  // Commit or branch: read-only Git for this session's repository.
  if (!local || !recording) return null;
  try {
    const ref = await workspaceApi.gitRef(recording, target.value);
    if (!ref.found) return null;
    const short = ref.hash!.slice(0, 10);
    return ref.kind === 'commit'
      ? { heading: `Commit · ${short}`, title: ref.subject, facts: [ref.author ?? '', date(ref.date) ?? ''].filter(Boolean), stat: stat(ref.additions, ref.deletions, ref.files) }
      : { heading: `Branch · ${ref.name}`, title: ref.subject, facts: [`Tip ${short}`, ref.author ?? '', date(ref.date) ?? ''].filter(Boolean) };
  } catch (error) {
    if (/approve/i.test(String((error as Error).message))) return { heading: target.kind === 'commit' ? `Commit · ${target.value.slice(0, 10)}` : `Branch · ${target.value}`, note: 'Approve read-only Git inspection in Git review to see this here.' };
    return null;
  }
}

/** False inside captured documents (Markdown `document` mode): addresses there are shown, not linked. */
export const LinksOpen = createContext(true);

/** A web address that opens in the person's default browser. GitHub pull requests and issues get their own card. */
export function ExternalLink({ url, children, bare = false }: { url: string; children: ReactNode; bare?: boolean }) {
  // Captured documents stay inert: their text is evidence, not the agent talking to the person.
  if (!useContext(LinksOpen)) return bare ? <>{children}</> : <span className="md-link" title={url}>{children}</span>;
  return <LinkCard target={{ kind: githubTarget(url) ? 'github' : 'url', value: url }}>
    <a className="md-link md-url" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={event => event.stopPropagation()}>{children}</a>
  </LinkCard>;
}

/** Wraps a link (or a focusable code token) and shows its card on hover or focus. Captured documents get no cards. */
export function LinkCard(props: { target: LinkTarget; children: ReactNode; focusable?: boolean }) {
  return useContext(LinksOpen) ? <OpenLinkCard {...props} /> : <>{props.children}</>;
}
function OpenLinkCard({ target, children, focusable = false }: { target: LinkTarget; children: ReactNode; focusable?: boolean }) {
  const id = useId(), anchor = useRef<HTMLSpanElement>(null);
  const recording = useApp(s => s.recordingId), source = useApp(s => s.source);
  const local = source?.kind === 'daemon';
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const [state, setState] = useState<CardState>({ phase: 'loading' });
  const [place, setPlace] = useState<{ left: number; top: number; above: boolean }>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef(0);
  const key = `${target.kind}|${target.kind === 'commit' || target.kind === 'branch' ? recording : ''}|${target.value}`;

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = undefined; } };
  const focused = () => !!anchor.current?.contains(document.activeElement);
  const position = () => {
    const el=anchor.current;if(!el)return;
    const r=el.getBoundingClientRect(),width=Math.min(340,window.innerWidth-16);
    const above=r.bottom+190>window.innerHeight&&r.top>190;
    setPlace({left:Math.max(8,Math.min(r.left,window.innerWidth-width-8)),top:above?r.top-6:r.bottom+6,above});
  };
  const close = useCallback((delay = CLOSE_DELAY) => {
    clear();
    timer.current = setTimeout(() => { request.current++; setPhase(p => p === 'open' ? 'closing' : p); timer.current = setTimeout(() => setPhase('closed'), CLOSE_FADE); }, delay);
  }, []);
  const open = useCallback((delay: number) => {
    clear();
    const ticket=++request.current;
    timer.current = setTimeout(async () => {
      const el = anchor.current; if (!el) return;
      position();
      const cached = cache.get(key);
      if (cached === null) return;            // known not to be a commit or branch: stay a plain token
      setPhase('open');
      if (cached) { setState({ phase: 'ready', body: cached }); return; }
      setState({ phase: 'loading' });
      let body: CardBody | null = null;
      try { body = await load(target, recording, local); } catch { body = { heading: hostOf(target.value) || 'Link', title: target.value, note: 'Details are unavailable right now.' }; }
      if(ticket!==request.current||!anchor.current?.isConnected)return;
      if (body === null) { cache.set(key, null); setPhase('closed'); return; }
      // A note means "not yet": Git approval is pending, or the lookup failed. Ask again next time.
      if (target.kind !== 'github' && !body.note) cache.set(key, body);
      setState({ phase: 'ready', body });
    }, delay);
  }, [key, target, recording, local]);

  useEffect(() => () => {request.current++;clear();}, []);
  useEffect(() => {request.current++;clear();setPhase('closed');},[key]);
  useEffect(() => {
    if (phase === 'closed') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { request.current++; clear(); setPhase('closing'); timer.current = setTimeout(() => setPhase('closed'), CLOSE_FADE); } };
    const scroll = () => {
      const r=anchor.current?.getBoundingClientRect();
      // Focus can scroll its token into view after the delayed lookup starts.
      // Keep the keyboard description attached; pointer-only cards still close.
      if(phase==='open'&&focused()&&r&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth){clear();position();return;}
      request.current++;clear();setPhase('closed');
    };
    document.addEventListener('keydown', escape); window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('keydown', escape); window.removeEventListener('scroll', scroll, true); };
  }, [phase]);
  useEffect(() => {
    // A changed GitHub opt-in must not leave an old answer on screen.
    const reset = () => { for (const k of [...cache.keys()]) if (k.startsWith('github|')) cache.delete(k); };
    window.addEventListener(GITHUB_OPTIN_EVENT, reset); return () => window.removeEventListener(GITHUB_OPTIN_EVENT, reset);
  }, []);

  const shown = phase !== 'closed' && place;
  return <span ref={anchor} className="link-card-anchor" data-link-kind={target.kind} {...(focusable ? { tabIndex: 0 } : {})} {...(phase === 'open' ? { 'aria-describedby': id } : {})}
    onPointerEnter={event => { if (event.pointerType !== 'touch') open(OPEN_HOVER); }}
    onPointerLeave={() => { if(focused())return; if (phase === 'closed') clear(); else close(); }}
    onFocus={() => open(OPEN_FOCUS)}
    onBlur={() => { if (phase === 'closed') clear(); else close(0); }}>
    {children}
    {shown && createPortal(
      <div id={id} role="tooltip" className="link-card" data-phase={phase} data-above={place.above || undefined} style={{ left: place.left, top: place.top }}
        onPointerEnter={() => { clear(); setPhase('open'); }} onPointerLeave={() => {if(!focused())close();}}>
        {state.phase === 'loading' ? <p className="link-card-note">Looking up…</p> : state.phase === 'ready' ? <>
          <small className="link-card-heading">{state.body.heading}</small>
          {state.body.title && <strong className="link-card-title">{state.body.title}</strong>}
          {!!state.body.facts?.length && <span className="link-card-facts">{state.body.facts.map((fact, i) => <span key={i}>{fact}</span>)}</span>}
          {state.body.stat && <span className="link-card-stat">{state.body.stat}</span>}
          {state.body.note && <p className="link-card-note">{state.body.note}</p>}
        </> : null}
      </div>, document.body)}
  </span>;
}
