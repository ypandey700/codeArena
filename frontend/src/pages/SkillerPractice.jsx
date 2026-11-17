import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleAlert, Code2, Home, Lightbulb, LoaderCircle, Play, RotateCcw, Send, SkipForward } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { skiller, skillerError, requestId, TOPIC_LABELS } from '../services/skiller';
import useSkillerDraft from '../hooks/useSkillerDraft';
import SkillerDialog from '../components/SkillerDialog';
import './Skiller.css';

const LANGUAGES = [{ key: 'python', name: 'Python', file: 'solution.py' }, { key: 'javascript', name: 'JavaScript', file: 'solution.js' }, { key: 'cpp', name: 'C++', file: 'solution.cpp' }, { key: 'java', name: 'Java', file: 'Main.java' }];
const value = (item) => item == null ? 'Not provided' : item === '' ? '(empty)' : String(item);
const statusLabel = (status) => ({ accepted: 'All tests passed', wrong_answer: 'Some tests failed', compile_error: 'Compilation error', runtime_error: 'Runtime error', time_limit: 'Time limit exceeded' }[status] || status?.replaceAll('_', ' ') || 'Evaluation complete');
function IO({ label, content }) { return <div className="sk-io"><span>{label}</span><pre>{value(content)}</pre></div>; }

export default function SkillerPractice() {
  const { attemptId } = useParams(), { user } = useAuth(), navigate = useNavigate();
  const draft = useSkillerDraft(user._id);
  const [attempt, setAttempt] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState('');
  const [view, setView] = useState('problem'), [testView, setTestView] = useState('samples'), [sampleIndex, setSampleIndex] = useState(0), [dialog, setDialog] = useState('');
  const [leaving, setLeaving] = useState(false), [exitError, setExitError] = useState('');
  const leavingRef = useRef(false);
  const editorRef = useRef(null), gutterRef = useRef(null), escapeTab = useRef(false), busyRef = useRef(false), idRef = useRef(attemptId), sequence = useRef(0);
  idRef.current = attemptId;
  function adopt(next, restoreLocal = false) {
    setAttempt(next); draft.reset(next, restoreLocal);
    if (next.state === 'complete') { setView('tests'); setTestView('submit'); }
  }
  useEffect(() => {
    const controller = new AbortController(), current = ++sequence.current;
    setLoading(true); setError(''); setAttempt(null); setDialog(''); setView('problem'); setTestView('samples'); setSampleIndex(0); setBusy(''); busyRef.current = false;
    skiller.attempt(attemptId, controller.signal).then((next) => {
      if (current === sequence.current && !controller.signal.aborted) adopt(next, true);
    }).catch((error) => { if (!controller.signal.aborted) setError(skillerError(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attemptId, user._id]);
  useEffect(() => {
    if (!attempt?.processing || busy) return;
    const currentId = attempt.id;
    const timer = setTimeout(async () => {
      try { const next = await skiller.attempt(currentId); if (idRef.current === currentId) adopt(next); }
      catch (error) { if (idRef.current === currentId) setError(skillerError(error)); }
    }, 1500);
    return () => clearTimeout(timer);
  }, [attempt, busy]);

  async function reload() {
    setError('');
    try { adopt(await skiller.attempt(attemptId)); setDialog(''); } catch (error) { setError(skillerError(error)); }
  }
  async function perform(kind) {
    if (busyRef.current || leavingRef.current || attempt?.processing || attempt?.state !== 'coding' || draft.conflict) return;
    busyRef.current = true; setBusy(kind); setError(''); setView('tests'); setTestView(kind === 'run' ? 'run' : 'submit');
    const currentId = attemptId;
    let snapshot;
    try {
      snapshot = await draft.flush();
      const next = await skiller.evaluate(currentId, kind, { ...snapshot, requestId: requestId() });
      if (idRef.current === currentId) adopt(next);
    } catch (error) {
      if (idRef.current === currentId) {
        setError(skillerError(error));
        if (snapshot && error.response?.status !== 409) try {
          const saved = await skiller.attempt(currentId);
          if (saved.code === snapshot.code && saved.language === snapshot.language) adopt(saved);
        } catch {}
      }
    } finally { if (idRef.current === currentId) { busyRef.current = false; setBusy(''); } }
  }
  async function hint() {
    if (busyRef.current || attempt.processing) return;
    const currentId = attemptId;
    busyRef.current = true; setBusy('hint'); setError('');
    try { const next = await skiller.hint(currentId); if (idRef.current === currentId) { setAttempt(next); setView('problem'); } }
    catch (error) { if (idRef.current === currentId) setError(skillerError(error)); }
    finally { if (idRef.current === currentId) { busyRef.current = false; setBusy(''); } }
  }
  async function nextQuestion(skip = false) {
    if (busyRef.current || leavingRef.current || attempt.processing) return;
    const currentId = attemptId;
    let draftSaved = false;
    busyRef.current = true; setBusy('next'); setError('');
    try {
      if (skip) { await draft.flush(); draftSaved = true; await skiller.abandon(currentId); }
      if (idRef.current === currentId) { setDialog(''); navigate('/skiller', { replace: true }); }
    } catch (error) { if (idRef.current === currentId) { setError(skillerError(error)); setDialog(''); if (skip && draftSaved) try { adopt(await skiller.attempt(currentId)); } catch {} } }
    finally { if (idRef.current === currentId) { busyRef.current = false; setBusy(''); } }
  }
  function openExit() { setExitError(''); setDialog('exit'); }
  async function exitPractice() {
    if (leavingRef.current) return;
    leavingRef.current = true; setLeaving(true); setExitError('');
    try {
      if (attempt?.state === 'coding') await draft.flush();
      navigate('/');
    } catch (error) { setExitError(skillerError(error)); }
    finally { leavingRef.current = false; setLeaving(false); }
  }
  const locked = !!busy || leaving || !!attempt?.processing || attempt?.state !== 'coding' || draft.conflict;
  useEffect(() => {
    const keydown = (event) => {
      if (event.target?.closest?.('dialog[open]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); perform('run'); }
      else if (event.altKey && event.key === 'Enter') { event.preventDefault(); perform('submit'); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [attempt, busy, draft.code, draft.language, draft.conflict]);
  function codeKey(event) {
    if (event.key === 'Escape') { escapeTab.current = true; return; }
    if (event.key !== 'Tab' || locked) return;
    if (escapeTab.current) { escapeTab.current = false; return; }
    event.preventDefault(); const editor = event.currentTarget, start = editor.selectionStart, end = editor.selectionEnd;
    if (draft.code.length - (end - start) + 4 > 20000) return;
    draft.change(draft.code.slice(0, start) + '    ' + draft.code.slice(end)); requestAnimationFrame(() => editor.setSelectionRange(start + 4, start + 4));
  }
  if (loading) return <div className="skiller-page sk-loading" role="status"><LoaderCircle className="sk-spin" size={26} aria-hidden="true" /><p>Loading your question…</p><Link to="/" className="sk-text-button"><Home size={13} aria-hidden="true" />Exit to homepage</Link></div>;
  if (!attempt) return <div className="skiller-page sk-loading"><CircleAlert size={28} aria-hidden="true" /><h1>We couldn’t open that question.</h1><p role="alert">{error}</p><Link to="/skiller" className="sk-button">Get a question</Link><Link to="/" className="sk-text-button"><Home size={13} aria-hidden="true" />Exit to homepage</Link></div>;
  const problem = attempt.problem, samples = problem.sampleTestCases, selectedSample = samples[sampleIndex], result = testView === 'run' ? attempt.lastRun : attempt.result;
  const completed = attempt.state === 'complete', canAdvance = completed || attempt.state === 'abandoned';
  const language = LANGUAGES.find((item) => item.key === draft.language) || LANGUAGES[0];

  return <section className={`skiller-workspace arena-page-background${canAdvance ? ' has-solved' : ''}`} data-view={view} aria-label="Skiller practice workspace">
    <header className="sk-workspace-header"><button type="button" className="sk-workspace-home" onClick={openExit} aria-label="Exit Skiller to homepage"><ArrowLeft size={15} aria-hidden="true" /><span>SKILLER</span></button><p>{TOPIC_LABELS[attempt.topic]}<span> / Practice</span></p><div className="sk-workspace-navigation"><span className="sk-workspace-stage"><span />{completed ? 'Question solved' : attempt.state === 'abandoned' ? 'Saved attempt' : 'One question at a time'}</span>{!canAdvance && <button type="button" className="sk-button" disabled={locked} onClick={() => setDialog('skip')}><SkipForward size={13} aria-hidden="true" />Skip</button>}<button type="button" className="sk-button" disabled={leaving} onClick={openExit}><Home size={13} aria-hidden="true" />Exit</button></div></header>
    {(error || draft.error) && <div className="sk-error sk-workspace-error" role="alert"><CircleAlert size={15} aria-hidden="true" /><span>{error || draft.error}</span><button type="button" onClick={() => draft.error ? setDialog('reload') : reload()}>{draft.conflict ? 'Reload saved draft' : 'Refresh saved state'}</button></div>}
    {attempt.processing && !busy && <div className="sk-processing" role="status"><LoaderCircle size={14} className="sk-spin" aria-hidden="true" />Checking your last request…</div>}
    {completed && <div className="sk-solved-notice" role="status"><CheckCircle2 size={15} aria-hidden="true" /><span>Solved. Your progress is saved.</span></div>}
    <nav className="sk-workspace-tabs" aria-label="Practice panels">{[{ key: 'problem', icon: BookOpen, name: 'Question' }, { key: 'code', icon: Code2, name: 'Code' }, { key: 'tests', icon: CheckCircle2, name: 'Tests' }].map(({ key, icon: Icon, name }) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}><Icon size={13} aria-hidden="true" />{name}</button>)}</nav>
    <div className="sk-practice-grid">
      <section className="sk-practice-problem sk-panel">
        <header><p className="sk-eyebrow">YOUR QUESTION</p><h1>{problem.title}</h1><div><span>{problem.difficulty}</span><span>{TOPIC_LABELS[attempt.topic]}</span></div></header>
        <div className="sk-problem-scroll" tabIndex={0} aria-label="Practice problem statement"><h2>What to build</h2><p>{problem.description}</p><h2>Input</h2><p>{problem.inputFormat}</p><h2>Output</h2><p>{problem.outputFormat}</p><h2>Constraints</h2><p>{problem.constraints}</p>{samples.map((sample, index) => <article className="sk-example" key={index}><h2>Example {index + 1}</h2><IO label="Input" content={sample.input} /><IO label="Expected output" content={sample.expectedOutput} /></article>)}{attempt.hints.map((hint, index) => <div className="sk-hint" key={index}><strong><Lightbulb size={12} aria-hidden="true" />Hint {index + 1}</strong><p>{hint}</p></div>)}</div>
        <footer><button type="button" className="sk-text-button" disabled={locked || !attempt.hintsAvailable} onClick={hint}><Lightbulb size={13} aria-hidden="true" />{attempt.hintsAvailable ? `Hint (${attempt.hintsAvailable} left)` : 'All hints revealed'}</button>{!canAdvance && <button type="button" className="sk-text-button sk-mobile-leave" disabled={locked} onClick={() => setDialog('skip')}>Skip question</button>}</footer>
      </section>
      <div className="sk-practice-code-column">
        <section className="sk-code-panel sk-panel">
          <header><h2><Code2 size={14} aria-hidden="true" />Your solution</h2><div><label className="sk-sr-only" htmlFor="sk-language">Coding language</label><select id="sk-language" disabled={locked} value={draft.language} onChange={(event) => draft.changeLanguage(event.target.value, problem.starterCode[event.target.value])}>{LANGUAGES.map((language) => <option key={language.key} value={language.key}>{language.name}</option>)}</select><button type="button" className="sk-icon-button" aria-label="Reset current language code" disabled={locked} onClick={() => setDialog('reset')}><RotateCcw size={13} aria-hidden="true" /></button></div></header>
          <div className="sk-filebar"><span>{language.file}</span><span role="status">{busy ? busy === 'run' ? 'Running samples…' : busy === 'submit' ? 'Checking all tests…' : 'Saving…' : draft.status}</span></div>
          <div className="sk-code-surface"><pre ref={gutterRef} aria-hidden="true">{Array.from({ length: draft.code.split('\n').length }, (_, index) => index + 1).join('\n')}</pre><textarea ref={editorRef} id="sk-code" aria-label={`${language.name} practice code`} value={draft.code} readOnly={locked} onChange={(event) => draft.change(event.target.value)} onKeyDown={codeKey} onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }} spellCheck={false} autoCorrect="off" autoCapitalize="off" maxLength={20000} wrap="off" /></div>
          <footer>Print only the required answer.<span>Esc, then Tab to leave the editor.</span></footer>
        </section>
        <section className="sk-test-panel sk-panel">
          <header><div>{[['samples', 'Samples'], ['run', 'Run results'], ['submit', 'Submission']].map(([key, label]) => <button type="button" key={key} aria-pressed={testView === key} onClick={() => setTestView(key)}>{label}</button>)}</div><span>{attempt.submissions} submissions</span></header>
          <div className="sk-test-scroll" tabIndex={0} aria-label="Practice execution details">{busy === 'run' || busy === 'submit' ? <p className="sk-running" role="status"><LoaderCircle size={18} className="sk-spin" aria-hidden="true" />{busy === 'submit' ? 'Checking sample and hidden tests…' : 'Running sample cases…'}</p> : testView === 'samples' ? <><div className="sk-case-buttons">{samples.map((_, index) => <button key={index} type="button" aria-pressed={sampleIndex === index} onClick={() => setSampleIndex(index)}>Case {index + 1}</button>)}</div><div className="sk-case-values"><IO label="Input" content={selectedSample?.input} /><IO label="Expected output" content={selectedSample?.expectedOutput} /></div></> : result ? <div className="sk-result"><p className={result.status === 'accepted' ? 'sk-good' : 'sk-warm'}><strong>{statusLabel(result.status)}</strong><span>{result.passedCount}/{result.totalCount} passed · {result.executionTimeMs} ms</span></p>{testView === 'submit' && !completed && <p className="sk-test-empty">Run samples to inspect output and debug failures.</p>}{result.error && <pre>{result.error}</pre>}{result.testResults?.map((test, index) => <article key={index}><span>Case {index + 1}<strong className={test.passed ? 'sk-good' : 'sk-warm'}>{test.passed ? 'Passed' : 'Failed'}</strong>{testView === 'submit' && <small>{test.hidden ? 'Hidden test' : 'Sample test'}</small>}</span>{test.output !== undefined && <IO label="Your output" content={test.output} />}{test.expected !== undefined && <IO label="Expected" content={test.expected} />}{test.error && <pre>{test.error}</pre>}</article>)}</div> : <p className="sk-test-empty">{testView === 'run' ? 'Run samples to compare your output with the examples.' : 'Submit your solution to check all tests.'}</p>}</div>
        </section>
        <footer className="sk-practice-actions">
          {canAdvance ? <><span /><div><button type="button" className="sk-button sk-button--primary" disabled={!!busy || attempt.processing} onClick={() => nextQuestion()}>{busy === 'next' ? <LoaderCircle size={13} className="sk-spin" aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}Next question</button></div></> : <><button type="button" className="sk-text-button" onClick={() => setDialog('skip')} disabled={locked}>Skip question</button><div><button type="button" className="sk-button" disabled={locked} onClick={() => perform('run')} aria-keyshortcuts="Control+Enter Meta+Enter"><Play size={13} aria-hidden="true" />Run samples</button><button type="button" className="sk-button sk-button--primary" disabled={locked} onClick={() => perform('submit')} aria-keyshortcuts="Alt+Enter"><Send size={13} aria-hidden="true" />Submit solution</button></div></>}
        </footer>
      </div>
    </div>
    {dialog && <SkillerDialog busy={dialog === 'exit' ? leaving : !!busy} title={{ skip: 'Skip this question?', exit: 'Exit Skiller to the homepage?', reset: 'Reset this language’s code?', reload: 'Reload the saved draft?' }[dialog]} onClose={() => setDialog('')}>
      <div className="sk-confirm-copy"><p>{dialog === 'exit' ? 'We’ll save your code so you can resume this question later. Leaving Skiller does not cost rating points.' : dialog === 'skip' ? 'Your code and attempts will stay saved. This question will be marked as skipped and another question will load. Your rating will not change.' : dialog === 'reset' ? 'This replaces the current language’s code with its starter template.' : 'This replaces your editor with the latest saved version. Copy any unsaved changes you want to keep before continuing.'}</p>{dialog === 'exit' && exitError && <><p className="sk-exit-error" role="alert">{exitError}</p><p>Your latest draft is kept in this browser. Retry saving, or exit with that local copy.</p></>}</div>
      <footer><button type="button" className="sk-button" disabled={dialog === 'exit' ? leaving : !!busy} onClick={() => setDialog('')}>Keep working</button>{dialog === 'exit' && exitError && <button type="button" className="sk-button" disabled={leaving} onClick={() => navigate('/')}>Exit without syncing</button>}<button type="button" className="sk-button sk-button--primary" disabled={dialog === 'exit' ? leaving : !!busy} onClick={() => { if (dialog === 'exit') exitPractice(); else if (dialog === 'skip') nextQuestion(true); else if (dialog === 'reload') reload(); else { draft.change(problem.starterCode[draft.language]); setDialog(''); } }}>{dialog === 'exit' ? leaving ? 'Saving…' : exitError ? 'Retry save & exit' : 'Save & exit' : dialog === 'skip' ? 'Skip question' : dialog === 'reload' ? 'Reload saved draft' : 'Reset code'}</button></footer>
    </SkillerDialog>}
  </section>;
}
