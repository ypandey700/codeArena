import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CircleAlert, Home, LoaderCircle, Search, Target } from 'lucide-react';
import { skiller, skillerError, TOPIC_LABELS } from '../services/skiller';
import './Skiller.css';

const SELECTION_DELAY_MS = 5000;
const STEPS = ['Reviewing your practice', 'Checking your weak topics', 'Picking your next question'];

export default function Skiller() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTopic = searchParams.get('topic');
  const topic = Object.hasOwn(TOPIC_LABELS, requestedTopic) ? requestedTopic : undefined;
  const [error, setError] = useState(''), [retry, setRetry] = useState(0), [stage, setStage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timers = [];
    setError(''); setStage(0);
    const transition = new Promise((resolve) => { timers.push(setTimeout(resolve, SELECTION_DELAY_MS)); });
    timers.push(setTimeout(() => setStage(1), 1600), setTimeout(() => setStage(2), 3300));
    Promise.all([skiller.next(topic, controller.signal), transition]).then(([attempt]) => {
      if (!controller.signal.aborted) navigate(`/skiller/practice/${attempt.id}`, { replace: true });
    }).catch((error) => {
      timers.forEach(clearTimeout);
      if (!controller.signal.aborted) setError(skillerError(error));
    });
    return () => { controller.abort(); timers.forEach(clearTimeout); };
  }, [navigate, retry, topic]);

  return <div className="skiller-page arena-page-background sk-selection-screen">
    {error ? <section className="sk-selection-card sk-selection-error">
      <CircleAlert size={26} aria-hidden="true" />
      <p role="alert">{error}</p>
      <button type="button" className="sk-button sk-button--primary" onClick={() => setRetry((value) => value + 1)}>Try again</button>
      <Link to="/" className="sk-text-button"><Home size={13} aria-hidden="true" />Exit to homepage</Link>
    </section> : <section key={retry} className="sk-selection-card" style={{ '--sk-selection-duration': `${SELECTION_DELAY_MS}ms` }} aria-labelledby="sk-selection-title">
      <div className="sk-selection-visual" aria-hidden="true"><span /><span /><Target size={33} strokeWidth={1.2} /><Search size={16} className="sk-selection-search" /></div>
      <p className="sk-eyebrow">SKILLER / YOUR NEXT CHALLENGE</p>
      <h1 id="sk-selection-title">Finding your next question.</h1>
      <p className="sk-selection-description">A little focus. A question picked for your progress.</p>
      <p className="sk-selection-status" role="status" aria-live="polite" aria-atomic="true">{STEPS[stage]}…</p>
      <ol className="sk-selection-steps" aria-label="Question selection">{STEPS.map((step, index) => <li key={step} className={index < stage ? 'is-done' : index === stage ? 'is-active' : ''} aria-current={index === stage ? 'step' : undefined}>
        <span aria-hidden="true">{index < stage ? <Check size={13} /> : index === stage ? <LoaderCircle size={13} className="sk-spin" /> : <span className="sk-selection-dot" />}</span><span>{step}</span>
      </li>)}</ol>
      <div className="sk-selection-track" aria-hidden="true"><span /></div>
      <Link to="/" className="sk-selection-back">Exit to homepage</Link>
    </section>}
  </div>;
}
