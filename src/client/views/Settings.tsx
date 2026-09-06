import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOut } from '../lib/auth';
import { api, downloadExport } from '../lib/api';
import { accountDeleteCopy, profileSaveCopy, trustLoadCopy } from '../lib/copy';
import { DEFAULT_REFLECTION_PREFERENCES, reflectionPreferencesSchema, type DeskPayload, type ReflectionPreferences } from '../../shared/schemas';
import ReflectionControls from '../components/ReflectionControls';

// Account, reflection preferences, and data controls in one place (moved off
// the top bar and out of the Trust Center so those surfaces stay focused).
export default function Settings({ user }: { user: User }) {
  const [desk, setDesk] = useState<DeskPayload | null>(null);
  const [deskError, setDeskError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameNote, setNameNote] = useState('');

  const [preferences, setPreferences] = useState<ReflectionPreferences>(DEFAULT_REFLECTION_PREFERENCES);
  const [savedPreferences, setSavedPreferences] = useState<ReflectionPreferences>(DEFAULT_REFLECTION_PREFERENCES);
  const [weeklyLetters, setWeeklyLetters] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsNote, setSettingsNote] = useState('');
  const [settingsAttempt, setSettingsAttempt] = useState(0);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<DeskPayload>('/api/desk').then((data) => {
      if (!active) return;
      setDesk(data);
      setDisplayName(data.profile.displayName ?? user.displayName ?? '');
    }).catch((e) => { if (active) setDeskError(trustLoadCopy(e)); });
    return () => { active = false; };
  }, [user.uid]);

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

  async function saveName() {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setNameBusy(true); setNameNote('');
    try {
      await api.post('/api/profile', { displayName: trimmed });
      setNameNote('Saved.');
    } catch (e) {
      setNameNote(profileSaveCopy(e));
    } finally {
      setNameBusy(false);
    }
  }

  async function rememberPreferences() {
    setSettingsBusy(true); setSettingsNote('');
    try {
      await api.post('/api/profile', { reflectionPreferences: preferences, weeklyLetters });
      setSavedPreferences(preferences);
      setSettingsNote('Preferences saved. You can still change depth for each reflection.');
    } catch { setSettingsNote('Preferences were not saved. Try again.'); }
    finally { setSettingsBusy(false); }
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    try {
      await api.del('/api/account');
      await signOut();
    } catch (e) {
      setDeleteError(accountDeleteCopy(e));
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <h2 className="page-title">Settings</h2>
      <p className="page-sub">Your account, how reflections work for you, and your data.</p>

      {deskError && (
        <div className="save-error" role="alert">
          <span>{deskError}</span>
        </div>
      )}

      <div className="trust-section">
        <h3>Account</h3>
        <label>
          Display name
          <input
            type="text"
            value={displayName}
            maxLength={60}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={!desk}
          />
        </label>
        <p>
          <button className="btn-quiet" disabled={nameBusy || !desk || !displayName.trim()} onClick={saveName}>
            {nameBusy ? 'Saving…' : 'Save'}
          </button>
        </p>
        {nameNote && <p role="status">{nameNote}</p>}
        <label>
          Email
          <input type="text" value={user.email ?? ''} readOnly disabled />
        </label>
        <p className="composer-hint">Your email comes from your Google account. Change it there and sign in again.</p>
      </div>

      <div className="trust-section">
        <h3>Reflection preferences</h3>
        {settingsReady && <>
          <ReflectionControls value={preferences} onChange={setPreferences} disabled={settingsBusy} />
          <label><input type="checkbox" checked={preferences.autoReflect} onChange={(e) => setPreferences({ ...preferences, autoReflect: e.target.checked })} /> Reflect automatically after I save a new entry</label>
          <p className="composer-hint">Off by default. When enabled, the saved entry is sent for AI reflection after it finishes syncing.</p>
          <label><input type="checkbox" checked={weeklyLetters} onChange={(e) => setWeeklyLetters(e.target.checked)} /> Receive weekly letters based on my recent writing</label>
          <p className="composer-hint">Weekly letters use recent entries, replies, and correspondence memory. Turning this off does not cancel work already started.</p>
          <button className="btn-quiet" disabled={settingsBusy} onClick={rememberPreferences}>{settingsBusy ? 'Saving preferences…' : 'Remember preferences'}</button>
        </>}
        {settingsReady && settingsNote && <p role="status">{settingsNote}</p>}
        {!settingsReady && settingsNote && (
          <div className="save-error" role="alert">
            <span>{settingsNote}</span>
            <button className="btn-quiet" onClick={() => setSettingsAttempt((attempt) => attempt + 1)}>Retry preferences</button>
          </div>
        )}
      </div>

      <div className="trust-section">
        <h3>Your data</h3>
        <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-quiet" onClick={() => downloadExport()}>Export my data</button>
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete account</button>
        </p>
      </div>

      {deleteError && <div className="save-error">{deleteError}</div>}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => !deleteBusy && setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete everything?</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: 14.5 }}>
              Your notebook, letters, replies, and memory are all erased — a full cascade delete — and the
              account itself is removed. This cannot be undone. Consider exporting first.
            </p>
            <label>
              Type <strong>delete</strong> to confirm
              <input
                type="text"
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
                disabled={deleteBusy}
              />
            </label>
            <div className="actions">
              <button className="btn-quiet" onClick={() => { setConfirmDelete(false); setDeleteTyped(''); }} disabled={deleteBusy}>Keep my words</button>
              <button className="btn-danger" onClick={deleteAccount} disabled={deleteBusy || deleteTyped.trim().toLowerCase() !== 'delete'}>
                {deleteBusy ? 'Erasing…' : 'Delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
