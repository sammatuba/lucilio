import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { withDraftLock } from '../lib/draftLock';
import { api } from '../lib/api';
import { auth } from '../lib/firebase';
import { clearReceipt, isCurrentReceipt, readReceipt, writeReceipt, type OnboardingReceipt } from '../lib/onboardingReceipt';
import { downloadWriting, inquiryRequest } from '../lib/inquiryDraft';
import { confirmEntry, saveEntry } from '../lib/entrySave';
import { DEFAULT_REFLECTION_PREFERENCES } from '../../shared/schemas';
import ReflectionControls from '../components/ReflectionControls';

export default function Onboarding({ user, onDone }: { user: User; onDone: () => void }) {
  return <OnboardingForm key={user.uid} user={user} onDone={onDone} />;
}

function OnboardingForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [initial] = useState(() => {
    try { return { receipt: readReceipt(user.uid), unreadable: false }; }
    catch { return { receipt: null, unreadable: true }; }
  });
  const [receipt, setReceipt] = useState(initial.receipt);
  const [step, setStep] = useState<0 | 1>(initial.receipt ? 1 : 0);
  const [entry, setEntry] = useState(initial.receipt?.status === 'draft' ? initial.receipt.bodyMd : '');
  const [conflict, setConflict] = useState(false);
  const [preferences, setPreferences] = useState(initial.receipt?.preferences ?? DEFAULT_REFLECTION_PREFERENCES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const navigate = useNavigate();
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const current = () => active.current && auth.currentUser === user;

  // Serialize the short read-and-reserve step between tabs. Never hold the
  // lock across an offline Firestore write or a profile request.
  async function reserveEntry() {
    function reserve() {
      if (!current()) return null;
      const existing = readReceipt(user.uid);
      if (existing && !(existing.status === 'draft' && receipt?.status === 'draft'
        && existing.entryId === receipt.entryId && existing.bodyMd === receipt.bodyMd)) {
        setConflict(true);
        return null;
      }
      const operation: OnboardingReceipt = {
        entryId: existing?.entryId ?? crypto.randomUUID(), status: 'pending', preferences, bodyMd: entry,
      };
      writeReceipt(user.uid, operation);
      setReceipt(operation);
      return operation;
    }
    return withDraftLock(`lucilio-first-entry:${user.uid}`, reserve);
  }

  function editEntry(value: string) {
    setEntry(value);
    if (receipt?.status !== 'draft' || !current()) return;
    try {
      const stored = readReceipt(user.uid);
      if (stored?.status !== 'draft' || stored.entryId !== receipt.entryId || stored.bodyMd !== receipt.bodyMd) {
        setConflict(true);
        return;
      }
      const next = { ...receipt, bodyMd: value };
      writeReceipt(user.uid, next);
      setReceipt(next);
    } catch { setError('Copy your changes before leaving. The browser could not update your recovered draft.'); }
  }

  function resumeEarlierEntry() {
    if (!current()) return;
    try {
      const earlier = readReceipt(user.uid);
      if (!earlier) {
        setConflict(false);
        setReceipt(null);
        setError('The earlier receipt has been cleared. Keep a copy of your text and check your Notebook before saving.');
        return;
      }
      setEntry(earlier.status === 'draft' ? earlier.bodyMd : '');
      setReceipt(earlier);
      setPreferences(earlier.preferences);
      setConflict(false);
      setError(null);
    } catch { setError('The earlier receipt could not be opened. Your text is still here.'); }
  }

  async function finish(readFirst = false) {
    const writing = !readFirst && (!receipt || receipt.status === 'draft');
    if (pending.current || !current() || (writing && (!entry.trim() || conflict))) return;
    pending.current = true;
    setBusy(true); setError(null); setNote('');
    let stage: 'receipt' | 'entry' | 'profile' = 'receipt';
    try {
      let operation: OnboardingReceipt | null = null;
      if (!readFirst) {
        if (writing) {
          operation = await reserveEntry();
          if (!operation || !current()) return;
          stage = 'entry';
          const { outcome, final } = saveEntry(user, entry.trim(), operation.entryId);
          if (await outcome === 'queued' && current()) setNote('Your entry is still syncing. You can return here to check its save.');
          await final;
        } else {
          operation = readReceipt(user.uid);
          if (!operation || operation.entryId !== receipt?.entryId || operation.status === 'draft') {
            setError('The receipt changed in another tab. Reload to open the current first-entry draft.');
            return;
          }
          if (operation.status === 'pending') {
            stage = 'entry';
            setNote('Checking whether your first entry reached your Notebook…');
            const exists = await inquiryRequest(confirmEntry(user.uid, operation.entryId));
            if (!current() || !isCurrentReceipt(user.uid, operation)) return;
            if (!exists) {
              const recovered = { ...operation, status: 'draft' as const, bodyMd: operation.bodyMd ?? entry };
              writeReceipt(user.uid, recovered);
              setReceipt(recovered);
              setEntry(recovered.bodyMd);
              setError('Your Notebook has no saved entry from this attempt. Review your first entry and save it again.');
              return;
            }
          }
        }
        if (operation.status === 'pending') {
          if (auth.currentUser !== user || !isCurrentReceipt(user.uid, operation)) return;
          // The acknowledgement outlives this view. Drop the local private
          // text even after navigation, without recreating a discarded receipt.
          operation = { entryId: operation.entryId, preferences: operation.preferences, status: 'saved' };
          writeReceipt(user.uid, operation);
        }
        if (!current()) return;
        setReceipt(operation);
        setEntry('');
      }
      stage = 'profile';
      setNote('');
      await inquiryRequest(api.post('/api/profile/onboard', {
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboarded: true, reflectionPreferences: operation?.preferences ?? preferences, weeklyLetters: false, welcomeLetters: false,
      }));
      if (!current()) return;
      if (operation) {
        try {
          if (isCurrentReceipt(user.uid, operation)) clearReceipt(user.uid);
        } catch {
          window.alert('Your entry and profile are saved. This browser could not clear the local receipt. You can clear this site’s data in browser settings.');
        }
      }
      onDone();
      navigate(readFirst ? '/' : '/notebook');
    } catch {
      if (current()) setError(stage === 'profile'
        ? 'We could not confirm your profile setup. Try opening your practice again.'
        : stage === 'entry' ? 'We could not confirm the entry save. Check its status before trying another save.'
          : 'This browser could not keep your save receipt. Copy your words before leaving and retry when browser storage is available.');
    } finally {
      pending.current = false;
      if (current()) { setBusy(false); setNote(''); }
    }
  }

  return <div className="onboard">
    {step === 0 ? <>
      <p className="onboard-step">Read first. Follow your own question.</p>
      <h2>The practice</h2>
      <p>Practice is where you start or return to a question. In Explore, browse essays, the Philosophy Map, and Atlas. Open Notebook whenever you want to write freely.</p>
      <p>Plan for two–three hours across a week, without deadlines. Your question can change direction; no school or research topic decides where you must go.</p>
      <button className="btn-primary" disabled={busy} onClick={() => void finish(true)}>{busy ? 'Opening your practice…' : 'Open my practice — read first'}</button>
      {error && <p className="save-error" role="alert">{error}</p>}
      <details className="journal-preferences"><summary>Optional Notebook reflection preferences</summary><ReflectionControls value={preferences} onChange={setPreferences} disabled={busy} /></details>
      <details className="journal-preferences">
        <summary>Why Lucilio?</summary>
        <p>Lucilio takes inspiration from Seneca’s philosophical letters to Lucilius: explorations of friendship, uncertainty, ambition, and how to live. Here, your own experiences begin the inquiry. You do not need to know philosophy to begin.</p>
        <a href="https://iep.utm.edu/seneca/" target="_blank" rel="noopener noreferrer">Read about Seneca and the letters</a>
      </details>
      <p className="composer-hint">Reflections are generated by AI, not a person. Your writing is stored in your account; an entry you choose to reflect on is sent through our server to Gemini. AI interpretations can be wrong.</p>
      <p className="composer-hint">Readings are a curated introduction, not a complete history of philosophy. Inquiry writing stays private from AI unless you deliberately take it to the Notebook and invite a response.</p>
      {initial.unreadable && <p role="alert">Your first-entry receipt could not be read. Open your practice and check your Notebook for an earlier save.</p>}
      <button className="btn-quiet" disabled={busy || initial.unreadable} onClick={() => setStep(1)}>Begin with writing instead</button>
    </> : receipt && receipt.status !== 'draft' ? <>
      <h2>{receipt.status === 'saved' ? 'Your first entry is saved' : 'Your first entry'}</h2>
      <p>{receipt.status === 'saved' ? 'Your entry is in your Notebook. Finish setting up your profile to open it.'
        : 'Check the save in your Notebook before continuing.'}</p>
      {receipt.status === 'pending' && receipt.bodyMd && <details>
        <summary>View your pending entry</summary>
        <textarea readOnly aria-label="Pending first entry" value={receipt.bodyMd} />
      </details>}
      <button className="btn-primary" disabled={busy} onClick={() => void finish()}>
        {busy ? 'Finishing setup…' : receipt.status === 'saved' ? 'Finish setup and open my journal' : 'Check entry and continue'}
      </button>
      {note && <p role="status">{note}</p>}
      {error && <p className="save-error" role="alert">{error}</p>}
    </> : <>
      <p className="onboard-step">Step 2 of 2 · Your first entry</p>
      <h2>Write a first entry</h2>
      <p>A moment from today, something you are carrying, or a question you have not resolved. One sentence is enough.</p>
      <div className="composer">
        <textarea autoFocus aria-label="Your first entry" value={entry} disabled={busy}
          onChange={(e) => editEntry(e.target.value)} placeholder="Today I have been thinking about…" />
        <div className="composer-bar">
          <span className="composer-hint">Saving does not request an AI response. You can reflect afterward.</span>
          <button className="btn-primary" onClick={() => void finish()} disabled={busy || conflict || !entry.trim() || new TextEncoder().encode(entry).length > 10 * 1024}>
            {busy ? 'Saving…' : 'Save entry and open my journal'}
          </button>
        </div>
      </div>
      <p className="composer-hint">
        What happens next: your journal opens with this entry saved. Nothing is sent to the AI until
        you invite a reflection, and correspondents will not write unless you ask them.
      </p>
      {conflict && <div role="alert">
        <p>Another tab started a first entry. Your text is still in this editor. Keep a copy before opening the earlier entry.</p>
        <button type="button" onClick={() => downloadWriting(entry, 'first-entry.md')}>Download this text</button>
        <button type="button" onClick={resumeEarlierEntry}>Discard this editor’s text and open the earlier entry</button>
      </div>}
      {!receipt && !conflict && <button className="btn-quiet" disabled={busy} onClick={() => setStep(0)}>Back to reflection depth</button>}
      {new TextEncoder().encode(entry).length > 10 * 1024 && <p role="alert">Please shorten your entry to 10 KB or less.</p>}
      {note && <p role="status">{note}</p>}
      {error && <div className="save-error" role="alert">{error}</div>}
    </>}
  </div>;
}
