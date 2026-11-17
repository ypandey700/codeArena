import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, CircleAlert, ExternalLink, Link2, LoaderCircle, RotateCcw, Sparkles, Sprout, Target } from 'lucide-react';
import { skiller, skillerError, TOPIC_LABELS, TOPIC_STATES } from '../services/skiller';
import './ProfileSkiller.css';

const PROVIDERS = [
  { id: 'leetcode', name: 'LeetCode', example: 'https://leetcode.com/u/yourname/', copy: 'Public topic counts help tailor your starting questions.' },
  { id: 'gfg', name: 'GeeksforGeeks', example: 'https://www.geeksforgeeks.org/user/yourname/', copy: 'Save your profile link. Topic import is not available for this platform yet.' },
  { id: 'codechef', name: 'CodeChef', example: 'https://www.codechef.com/users/yourname', copy: 'Save your profile link. Topic import is not available for this platform yet.' },
];
const date = (value) => { const parsed = value && new Date(value); return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };

function ProfileLinkForm({ provider, link, busy, onSave, onRemove }) {
  const [url, setUrl] = useState(link?.url || ''), [error, setError] = useState('');
  useEffect(() => { setUrl(link?.url || ''); setError(''); }, [link?.url]);
  const status = !link ? 'Not linked' : link.status === 'imported' ? 'Topic data imported' : link.status === 'unavailable' ? 'Import unavailable' : 'Link saved';
  async function change(remove = false) {
    setError('');
    try { if (remove) await onRemove(provider.id); else await onSave(provider.id, url.trim()); }
    catch (failure) { setError(skillerError(failure)); }
  }
  return <form className="ps-link-card" onSubmit={(event) => { event.preventDefault(); change(); }}>
    <div className="ps-link-heading"><h3>{provider.name}</h3><span className={`ps-link-status${link?.status === 'imported' ? ' is-imported' : ''}`}>{status}</span></div>
    <p>{provider.copy}</p>
    <label htmlFor={`ps-link-${provider.id}`}>{provider.name} profile URL</label>
    <input id={`ps-link-${provider.id}`} type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={provider.example} required maxLength={300} disabled={!!busy} autoComplete="url" />
    <div className="ps-link-actions"><button type="submit" className="pp-button" disabled={!!busy}>{busy === provider.id ? <LoaderCircle size={12} className="pp-spin" aria-hidden="true" /> : <Link2 size={12} aria-hidden="true" />}{link ? provider.id === 'leetcode' ? 'Save & refresh' : 'Update link' : 'Save profile'}</button>{link && <><a href={link.url} target="_blank" rel="noreferrer" className="pp-text-button">View<ExternalLink size={11} aria-hidden="true" /></a><button type="button" className="pp-text-button" disabled={!!busy} onClick={() => change(true)}>Remove</button></>}</div>
    {error ? <p className="ps-error" role="alert">{error}</p> : link?.message && ['imported', 'unavailable'].includes(link.status) && <p className="ps-link-message" role="status">{link.message}</p>}
  </form>;
}

function PracticeHistory() {
  const [history, setHistory] = useState(null), [page, setPage] = useState(1), [revision, setRevision] = useState(0), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    skiller.history(page, controller.signal).then((next) => { if (!controller.signal.aborted) setHistory(next); }).catch((failure) => { if (!controller.signal.aborted) setError(skillerError(failure)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, revision]);
  if (loading) return <p className="ps-state" role="status"><LoaderCircle size={17} className="pp-spin" aria-hidden="true" />Loading your practice history…</p>;
  if (error) return <div className="ps-state"><p className="ps-error" role="alert">{error}</p><button type="button" className="pp-button" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>;
  if (!history?.attempts.length) return <div className="ps-state"><Target size={24} aria-hidden="true" /><p>Your journey starts with your first question. Solved, skipped, and saved attempts will appear here.</p><Link to="/skiller" className="pp-button pp-button--primary">Start practising<ArrowRight size={12} aria-hidden="true" /></Link></div>;
  return <>
    <p className="ps-history-caption">Newest first. Select a question to review your code.</p>
    <ol className="ps-history">{history.attempts.map((attempt) => <li key={attempt.id}><span className={`ps-history-mark is-${attempt.state}`} aria-hidden="true">{attempt.state === 'complete' ? <CheckCircle2 size={16} /> : <span />}</span><div><Link to={`/skiller/practice/${attempt.id}`}>{attempt.title}<ArrowRight size={11} aria-hidden="true" /></Link><p>{TOPIC_LABELS[attempt.topic] || attempt.topic} · {attempt.difficulty} · {attempt.submissions} {attempt.submissions === 1 ? 'submission' : 'submissions'}</p></div><span className="ps-history-detail"><strong>{attempt.state === 'complete' ? 'Solved' : attempt.state === 'abandoned' ? 'Skipped' : 'In progress'}</strong><time dateTime={attempt.startedAt}>{date(attempt.startedAt)}</time></span></li>)}</ol>
    <nav className="ps-pagination" aria-label="Skiller practice history pages"><button type="button" className="pp-button" disabled={history.page <= 1} onClick={() => setPage(history.page - 1)}><ArrowLeft size={12} aria-hidden="true" />Previous</button><span>Page {history.page} of {history.pages} · {history.total} attempts</span><button type="button" className="pp-button" disabled={history.page >= history.pages} onClick={() => setPage(history.page + 1)}>Next<ArrowRight size={12} aria-hidden="true" /></button></nav>
  </>;
}

export default function ProfileSkiller() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0), [linkBusy, setLinkBusy] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false), [providerId, setProviderId] = useState('leetcode');
  const profilesRef = useRef(null);
  const mounted = useRef(false), mutating = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    skiller.dashboard(controller.signal).then((next) => { if (!controller.signal.aborted) setData(next); }).catch((failure) => { if (!controller.signal.aborted) setError(skillerError(failure)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  async function saveLink(provider, url, remove = false) {
    if (mutating.current) return;
    mutating.current = true; setLinkBusy(provider);
    try {
      const next = remove ? await skiller.unlink(provider) : await skiller.link(provider, url);
      if (mounted.current) setData(next.dashboard || next);
    } finally { mutating.current = false; if (mounted.current) setLinkBusy(''); }
  }
  const priority = { 'needs-practice': 0, improving: 1, strong: 2, unassessed: 3 };
  const topics = [...(data?.topics || [])].sort((a, b) => priority[a.status] - priority[b.status] || (a.score ?? 0) - (b.score ?? 0));
  const weak = topics.filter((topic) => topic.status === 'needs-practice');
  const focus = weak[0] || topics.find((topic) => topic.status === 'unassessed') || topics.find((topic) => topic.status === 'improving') || topics[0];
  const practiceUrl = data?.activeAttempt ? `/skiller/practice/${data.activeAttempt}` : focus ? `/skiller?topic=${encodeURIComponent(focus.id)}` : '/skiller';
  const provider = PROVIDERS.find((item) => item.id === providerId);
  function openProfiles() {
    profilesRef.current.open = true;
    requestAnimationFrame(() => { profilesRef.current.querySelector('button')?.focus({ preventScroll: true }); profilesRef.current.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
  }

  return <section className="ps-journey" aria-labelledby="ps-journey-title">
    <header className="ps-heading"><div className="ps-heading-title"><span className="ps-sprout" aria-hidden="true"><Sprout size={22} strokeWidth={1.5} /></span><div><h2 id="ps-journey-title">Your Skiller journey</h2><p>One question. One step forward.</p></div></div><Link to={practiceUrl} className="pp-button pp-button--primary">{data?.activeAttempt ? 'Continue practice' : 'Start practice'}<ArrowRight size={14} aria-hidden="true" /></Link></header>
    {loading ? <p className="ps-state" role="status"><LoaderCircle size={18} className="pp-spin" aria-hidden="true" />Loading your progress…</p> : error ? <div className="ps-state"><p className="ps-error" role="alert"><CircleAlert size={15} aria-hidden="true" />{error}</p><button type="button" className="pp-button" onClick={() => setRevision((value) => value + 1)}><RotateCcw size={12} aria-hidden="true" />Try again</button></div> : data && <>
      <div className="ps-overview"><div className="ps-next-focus"><span className="ps-focus-icon" aria-hidden="true"><Target size={19} strokeWidth={1.5} /></span><div><span>Next focus</span><strong>{focus ? TOPIC_LABELS[focus.id] || focus.name : 'Your first question'}</strong><p>{data.activeAttempt ? 'Finish your saved question, then take the next step.' : weak.length ? 'A little practice here will help.' : data.stats.uniqueSolved ? 'Keep your progress moving.' : 'Let’s find your starting point.'}</p></div></div><dl className="ps-stats"><div><dd>{data.stats.uniqueSolved ?? 0}</dd><dt><CheckCircle2 size={12} aria-hidden="true" />Solved</dt></div><div><dd>{weak.length}</dd><dt><Target size={12} aria-hidden="true" />To practise</dt></div><div><dd>{data.stats.strongTopics ?? 0}</dd><dt><Sparkles size={12} aria-hidden="true" />Strong topics</dt></div></dl></div>
      <div className="ps-details">
        <details className="ps-disclosure ps-topic-details" name="skiller-journey"><summary><span><Target size={16} aria-hidden="true" />Topic progress</span><small>{weak.length ? `${weak.length} need practice` : '6 topics'}</small><ChevronDown size={15} aria-hidden="true" /></summary><div className="ps-detail-body">
          <div className="ps-topics">{topics.map((topic) => <article className={`ps-topic is-${topic.status}`} key={topic.id}><div className="ps-topic-label"><h3>{TOPIC_LABELS[topic.id] || topic.name}</h3><p>{TOPIC_STATES[topic.status]}<span> · {topic.uniqueSolved} solved</span></p></div><div className="ps-topic-strength">{Number.isFinite(topic.score) ? <><div className="ps-topic-meter" role="meter" aria-label={`${TOPIC_LABELS[topic.id] || topic.name} strength`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={topic.score}><span style={{ width: `${Math.max(0, Math.min(100, topic.score))}%` }} /></div><strong>{topic.score}<small>/100</small></strong></> : <span className="ps-unassessed">Not assessed yet</span>}</div>{!data.activeAttempt && <Link className="ps-topic-practice" to={`/skiller?topic=${encodeURIComponent(topic.id)}`} aria-label={`Practise ${TOPIC_LABELS[topic.id] || topic.name}`}><ArrowRight size={15} aria-hidden="true" /></Link>}</article>)}</div>
          <p className="ps-footnote">Scores reflect your practice, hints and retries. Imported topic counts are a starting estimate.{data.activeAttempt && ' Resume or skip your saved question before picking another topic.'}</p>
        </div></details>
        <details className="ps-disclosure ps-history-details" name="skiller-journey" onToggle={(event) => setHistoryOpen(event.currentTarget.open)}><summary><span><RotateCcw size={16} aria-hidden="true" />Practice history</span><small>{data.stats.attempts ?? 0} attempts</small><ChevronDown size={15} aria-hidden="true" /></summary><div className="ps-detail-body"><p className="ps-detail-note">{data.stats.submissions ?? 0} submissions · {data.stats.sampleRuns ?? 0} sample runs</p>{historyOpen && <PracticeHistory />}</div></details>
        <details ref={profilesRef} className="ps-disclosure ps-profile-details" name="skiller-journey"><summary><span><Link2 size={16} aria-hidden="true" />Coding profiles</span><small>{data.links?.length || 0}/3 added</small><ChevronDown size={15} aria-hidden="true" /></summary><div className="ps-detail-body"><nav className="ps-provider-picker" aria-label="Choose coding platform">{PROVIDERS.map((item) => <button type="button" key={item.id} aria-pressed={providerId === item.id} disabled={!!linkBusy} onClick={() => setProviderId(item.id)}>{item.name}{data.links?.some((link) => link.provider === item.id) && <CheckCircle2 size={11} aria-label="Linked" />}</button>)}</nav><ProfileLinkForm key={provider.id} provider={provider} link={data.links?.find((link) => link.provider === provider.id)} busy={linkBusy} onSave={saveLink} onRemove={(id) => saveLink(id, '', true)} /></div></details>
      </div>
      {!data.links?.length && <button type="button" className="ps-connect-nudge" onClick={openProfiles}>Already code elsewhere?<span>Add your profiles<ArrowRight size={12} aria-hidden="true" /></span></button>}
    </>}
  </section>;
}
