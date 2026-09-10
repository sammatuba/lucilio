import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveEntry, type SaveOutcome } from '../lib/entrySave';
import { entrySaveCopy, snapshotCopy } from '../lib/copy';
import { DEFAULT_REFLECTION_PREFERENCES, reflectionPreferencesSchema, type EntryDoc, type ReflectionPreferences } from '../../shared/schemas';
import { api } from '../lib/api';
import { takePlateSeed } from '../lib/plateSeed';
import { getNotebookDraft, setNotebookDraft } from '../lib/notebookDraft';
import type { PlateSeed } from '../lib/plateSeed';
import ReflectionControls from '../components/ReflectionControls';
import EntryReflection from '../components/EntryReflection';
import WaitingTray from '../components/WaitingTray';
import CorrespondentsAside from '../components/CorrespondentsAside';
import NotebookGuide from '../components/NotebookGuide';
import type { DeskPayload } from '../../shared/schemas';

// US-2: write any time; the write is verified BEFORE the composer clears; on
// failure an error banner offers Retry Save — an entry is never silently lost.
// Offline persistence (initialized in lib/firebase) queues writes offline, and
// a slow or hung ack degrades to a truthful queued state, never an eternal
// "Sealing…" (roadmap M1-6).
export default function Notebook({ user, desk, refresh }: { user: User; desk: DeskPayload | null; refresh: () => void }) {
  const [draft, setDraft] = useState(() => getNotebookDraft(user.uid));
  const [entries, setEntries] = useState<EntryDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  const [syncNote, setSyncNote] = useState(false);
  const [preferences, setPreferences] = useState<ReflectionPreferences>(DEFAULT_REFLECTION_PREFERENCES);
  const [savedPreferences, setSavedPreferences] = useState<ReflectionPreferences>(DEFAULT_REFLECTION_PREFERENCES);
  const [weeklyLetters, setWeeklyLetters] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsNote, setSettingsNote] = useState('');
  const [settingsAttempt, setSettingsAttempt] = useState(0);
  const [reflecting, setReflecting] = useState<Record<string, { preferences: ReflectionPreferences; autoStart: boolean }>>({});
  const [plateSeed, setPlateSeed] = useState<PlateSeed | null>(null);
  // The last entry whose save was acknowledged. It carries the "Saved just
  // now" tag and a single primary next action so the reader always knows that
  // the write landed and what the useful next move is.
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNotebookDraft(user.uid, draft);
  }, [draft, user.uid]);

  useEffect(() => {
    // "Write from this" (Atlas → Notebook): an empty composer can be seeded
    // directly. If writing already exists, leave it alone and ask how the
    // reader wants to combine the two pieces (§2.8).
    const seed = takePlateSeed();
    if (!seed) return;
    const seeded = `> “${seed.quote}”\n— ${seed.plate}, ${seed.title}\n\n`;
    if (draft.trim()) setPlateSeed(seed);
    else setDraft(seeded);
  }, []);

  function plateText(seed: PlateSeed): string {
    return `> “${seed.quote}”\n— ${seed.plate}, ${seed.title}\n\n`;
  }

  function appendPlateSeed() {
    if (!plateSeed) return;
    const seeded = plateText(plateSeed);
    setDraft((current) => {
      const separator = current.trim() ? (current.endsWith('\n') ? '\n' : '\n\n') : '';
      return `${current}${separator}${seeded}`;
    });
    setPlateSeed(null);
  }

  function replaceWithPlateSeed() {
    if (!plateSeed) return;
    setDraft(plateText(plateSeed));
    setPlateSeed(null);
  }

  useEffect(() => {
    let active = true;
    setSettingsNote('');
    api.get<{ preferences: ReflectionPreferences; weeklyLetters: boolean }>('/api/reflection-preferences').then((data) => {
      if (!active) return;
      const parsed = reflectionPreferencesSchema.parse(data.preferences ?? {});
      setPreferences(parsed); setSavedPreferences(parsed); setWeeklyLetters(data.weeklyLetters ?? false); setSettingsReady(true);
    }).catch(() => { if (active) setSettingsNote('Preferences could not be loaded. Reload to try again; saving entries is still available.'); });
    return () => { active = false; };
  }, [user.uid, settingsAttempt]);

  async function rememberPreferences() {
    setSettingsBusy(true); setSettingsNote('');
    try {
      await api.post('/api/profile', { reflectionPreferences: preferences, weeklyLetters });
      setSavedPreferences(preferences);
      setSettingsNote('Preferences saved. You can still change depth for each reflection.');
    } catch { setSettingsNote('Preferences were not saved. Try again.'); }
    finally { setSettingsBusy(false); }
  }

  useEffect(() => {
    const q = query(collection(db, `users/${user.uid}/notebook`), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => d.data() as EntryDoc));
        setSyncNote(snap.metadata.hasPendingWrites);
      },
      (e) => setError(snapshotCopy(e)),
    );
  }, [user.uid]);

  async function save(text: string) {
    if (!text.trim() || saving || queued) return;
    setSaving(true);
    setError(null);
    setQueued(false);
    setSaveNote('');
    setSavedEntryId(null);
    const body = text.trim();
    const { entryId, outcome, final } = saveEntry(user, body);
    // Acknowledged write: confirm it landed, mark the entry as new, and either
    // auto-start the saved preference or point at the one useful next action.
    const confirmSaved = () => {
      if (entryId) {
        setSavedEntryId(entryId);
        setSaveNote('Saved. Your entry is in your notebook below — invite a reflection whenever you want one.');
        if (settingsReady && savedPreferences.autoReflect) {
          setReflecting((current) => ({ ...current, [entryId]: { preferences: savedPreferences, autoStart: true } }));
        }
      }
    };
    let landed: SaveOutcome;
    try {
      landed = await outcome;
    } catch (e) {
      setPendingDraft(body); // keep the words; offer Retry
      setError(entrySaveCopy(e));
      setSaving(false);
      return;
    }
    if (landed === 'saved') {
      confirmSaved();
      setDraft((current) => (current === text ? '' : current));
      setPendingDraft(null);
      setSaving(false);
      return;
    }
    // Slow ack: say so truthfully; the words stay in the composer until the
    // write lands locally (then clear) or fails late (then Retry Save).
    setQueued(true);
    setSaving(false);
    final.then(() => {
      confirmSaved();
      setQueued(false);
      setDraft((d) => (d === text ? '' : d));
      setPendingDraft(null);
    }).catch((e: unknown) => {
      setQueued(false);
      setPendingDraft(body);
      setError(entrySaveCopy(e));
    });
  }

  function inviteReflection(entryId: string) {
    setReflecting((current) => ({ ...current, [entryId]: { preferences, autoStart: false } }));
  }

  const usedBytes = new TextEncoder().encode(draft).length;
  const tooLong = usedBytes > 10 * 1024;
  const wordCount = draft.trim() ? draft.trim().split(/\s+/u).length : 0;

  return (
    <div className="desk-grid">
      <div>
        <h2 className="page-title">Notebook</h2>
        <p className="page-sub">
          Write a moment in your own words, then save it. Nothing is sent to the AI until you invite a
          reflection.
          {syncNote && ' (some entries are still syncing from offline)'}
        </p>

        <NotebookGuide defaultOpen={entries.length === 0} />

        <details className="journal-preferences">
          <summary>Your reflection preferences</summary>
          {settingsReady && <>
            <ReflectionControls value={preferences} onChange={setPreferences} disabled={settingsBusy} />
            <label><input type="checkbox" checked={preferences.autoReflect} onChange={(e) => setPreferences({ ...preferences, autoReflect: e.target.checked })} /> Reflect automatically after I save a new entry</label>
            <p className="composer-hint">Off by default. When enabled, the saved entry is sent for AI reflection after it finishes syncing.</p>
            <label><input type="checkbox" checked={weeklyLetters} onChange={(e) => setWeeklyLetters(e.target.checked)} /> Receive weekly letters based on my recent writing</label>
            <p className="composer-hint">Weekly letters use recent entries, replies, and correspondence memory. Turning this off does not cancel work already started.</p>
            <button className="btn-quiet" disabled={settingsBusy} onClick={rememberPreferences}>{settingsBusy ? 'Saving preferences…' : 'Remember preferences'}</button>
          </>}
          {settingsReady && settingsNote && <p role="status">{settingsNote}</p>}
        </details>

        {!settingsReady && settingsNote && (
          <div className="save-error" role="alert">
            <span>{settingsNote}</span>
            <button className="btn-quiet" onClick={() => setSettingsAttempt((attempt) => attempt + 1)}>Retry preferences</button>
          </div>
        )}

        {error && (
          <div className="save-error" role="alert">
            <span>{error}</span>
            <button className="btn-quiet" onClick={() => save(pendingDraft ?? draft)}>Retry Save</button>
          </div>
        )}

        {plateSeed && (
          <div className="save-error" role="status">
            <span>There is already a draft here. How should I add this Atlas passage?</span>
            <button className="btn-quiet" onClick={appendPlateSeed}>Append to draft</button>
            <button className="btn-quiet" onClick={replaceWithPlateSeed}>Replace draft</button>
            <button className="btn-quiet" onClick={() => setPlateSeed(null)}>Keep my draft</button>
          </div>
        )}

        {queued && !error && (
          <p className="save-status is-queued" role="status" aria-live="polite">
            Still sending — kept on this device; it will sync when the connection returns. You can keep
            writing while it waits.
          </p>
        )}

        <div className="composer">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setSaveNote(''); }}
            placeholder="Today, or this week — whatever is true. Plain text or markdown."
          />
          <div className="composer-bar">
            <span className="composer-hint">
              {tooLong ? `${wordCount} words · shorten this entry a little` : `${wordCount} ${wordCount === 1 ? 'word' : 'words'} · ${usedBytes > 8 * 1024 ? 'nearing the entry limit' : 'room to keep writing'}`}
            </span>
            <button className="btn-primary" disabled={saving || queued || !draft.trim() || tooLong} onClick={() => save(draft)}>
              {saving ? 'Saving…' : queued ? 'Waiting to sync…' : 'Save entry'}
            </button>
          </div>
        </div>

        {saveNote && (
          <p className="save-status" aria-live="polite">
            {saveNote}
          </p>
        )}

        <WaitingTray desk={desk} refresh={refresh} />

        <div className="entry-list">
          {entries.length === 0 && (
            <div className="entry-empty">
              <p className="entry-empty-lead">No entries yet.</p>
              <p className="composer-hint">
                The composer above is always open. One sentence is enough to begin.
              </p>
              <button className="btn-quiet" onClick={() => composerRef.current?.focus()}>
                Write your first entry
              </button>
            </div>
          )}
          {entries.map((e) => {
            const isNew = e.id === savedEntryId;
            return (
              <div className={`entry-item${isNew ? ' is-new' : ''}`} key={e.id}>
                <div className="when">
                  {new Date(e.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {isNew && <span className="entry-badge">Saved just now</span>}
                </div>
                <div className="body">{e.bodyMd}</div>
                {settingsReady && (reflecting[e.id]
                  ? <EntryReflection entryId={e.id} defaults={reflecting[e.id]!.preferences} autoStart={reflecting[e.id]!.autoStart} />
                  : isNew
                    ? (
                      <div className="entry-next">
                        <p className="entry-next-lead">Would you like an AI reflection on this entry?</p>
                        <button className="btn-primary" onClick={() => inviteReflection(e.id)}>
                          Invite a reflection on this entry
                        </button>
                        <p className="composer-hint">It reads only this entry, and you can disagree with it.</p>
                      </div>
                    )
                    : <button className="btn-quiet" disabled={syncNote} onClick={() => inviteReflection(e.id)}>Reflect on this</button>)}
              </div>
            );
          })}
        </div>
      </div>

      <CorrespondentsAside desk={desk} refresh={refresh} />
    </div>
  );
}
