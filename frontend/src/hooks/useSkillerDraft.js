import { useEffect, useRef, useState } from 'react';
import { skiller, skillerError } from '../services/skiller';

export default function useSkillerDraft(userId) {
  const sessionRef = useRef(null), mounted = useRef(true);
  const [editor, setEditor] = useState({ code: '', language: 'python', status: 'Saved', conflict: false, error: '' });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(sessionRef.current?.timer); }; }, []);
  const update = (session, patch) => { if (mounted.current && session === sessionRef.current) setEditor((current) => ({ ...current, ...patch })); };
  function cache(session) {
    try { sessionStorage.setItem(session.key, JSON.stringify({ codes: session.codes, language: session.language, code: session.code, revision: session.revision, dirty: session.dirty })); } catch {}
  }
  function queueSave(session) {
    clearTimeout(session.timer);
    const snapshot = { code: session.code, language: session.language, version: session.version };
    session.chain = session.chain.catch(() => {}).then(async () => {
      if (snapshot.version <= session.savedVersion) return;
      update(session, { status: 'Saving…', error: '' });
      try {
        const saved = await skiller.draft(session.id, { code: snapshot.code, language: snapshot.language, revision: session.revision });
        session.revision = saved.draftRevision; session.savedVersion = snapshot.version; session.dirty = session.version !== snapshot.version;
        cache(session); update(session, { status: session.dirty ? 'Unsaved changes' : 'Saved to your account' });
      } catch (error) {
        session.conflict = error.response?.status === 409;
        update(session, { status: 'Not saved', conflict: session.conflict, error: skillerError(error) });
        throw error;
      }
    });
    return session.chain;
  }
  function schedule(session) { clearTimeout(session.timer); session.timer = setTimeout(() => { queueSave(session).catch(() => {}); }, 1200); }
  function reset(attempt, restoreLocal = false) {
    clearTimeout(sessionRef.current?.timer);
    const key = `skiller-editor:${userId}:${attempt.id}`;
    let cached;
    try { cached = JSON.parse(sessionStorage.getItem(key)); } catch {}
    const canRestore = restoreLocal && attempt.state === 'coding' && !attempt.processing && cached?.dirty && cached.revision === attempt.draftRevision && typeof cached.code === 'string' && ['python', 'javascript', 'cpp', 'java'].includes(cached.language);
    const language = canRestore ? cached.language : attempt.language;
    const code = canRestore ? cached.code : attempt.code;
    const session = { id: attempt.id, key, language, code, revision: attempt.draftRevision, codes: { ...(cached?.codes || {}), [attempt.language]: attempt.code, [language]: code }, dirty: !!canRestore, version: canRestore ? 1 : 0, savedVersion: 0, chain: Promise.resolve(), timer: null, conflict: false };
    sessionRef.current = session;
    setEditor({ language, code, conflict: false, error: '', status: canRestore ? 'Restored unsaved draft' : 'Saved to your account' });
    cache(session); if (canRestore) schedule(session);
  }
  function change(code, language = sessionRef.current?.language) {
    const session = sessionRef.current; if (!session || session.conflict) return;
    session.code = code; session.language = language; session.codes[language] = code; session.version++; session.dirty = true;
    cache(session); update(session, { code, language, status: 'Unsaved changes', error: '' }); schedule(session);
  }
  async function flush() {
    const session = sessionRef.current; if (!session) return;
    if (session.conflict) throw new Error('Reload the saved draft before continuing. Your local copy has been kept in this browser.');
    clearTimeout(session.timer);
    if (session.dirty) await queueSave(session); else await session.chain;
    return { code: session.code, language: session.language, revision: session.revision };
  }
  function changeLanguage(language, starterCode) {
    const session = sessionRef.current; if (!session) return;
    change(session.codes[language] ?? starterCode ?? '', language);
  }
  return { ...editor, reset, change, changeLanguage, flush };
}
