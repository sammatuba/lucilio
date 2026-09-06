import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { renderMarkdown } from '../lib/markdown';
import type { LetterBundle, ReflectionPreferences, ReflectionResult } from '../../shared/schemas';
import ReflectionControls from './ReflectionControls';

export default function EntryReflection({ entryId, defaults, autoStart = false }: {
  entryId: string; defaults: ReflectionPreferences; autoStart?: boolean;
}) {
  const [preferences, setPreferences] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [letter, setLetter] = useState<LetterBundle | null>(null);
  const [closed, setClosed] = useState(false);
  const [cycleId, setCycleId] = useState<string | null>(null);

  useEffect(() => {
    if (!cycleId) return;
    let active = true;
    let polling = false;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await api.get<ReflectionResult>(`/api/reflections/${cycleId}`);
        if (!active) return;
        if (result.state === 'delivered' && result.letterId) {
          const bundle = await api.get<LetterBundle>(`/api/letters/${result.letterId}`);
          if (!active) return;
          setLetter(bundle); setNote(''); setCycleId(null);
          api.post(`/api/letters/${result.letterId}/open`).catch(() => undefined);
        } else if (result.state === 'failed') {
          setCycleId(null); setNote('The reflection could not be completed. Your entry is saved; try again when you are ready.');
        } else if (Date.now() - started > 180_000) {
          setCycleId(null); setNote('This is taking longer than expected. Your entry is saved. Check again later or look on your Notebook.');
        }
      } catch { if (active) { setCycleId(null); setNote('Could not check the reflection. Your entry is saved; try again.'); } }
      finally { polling = false; }
    }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [cycleId]);

  async function reflect() {
    if (busy || cycleId) return;
    setBusy(true); setNote(''); setClosed(false);
    try {
      const result = await api.post<ReflectionResult>('/api/reflections', { entryId, preferences });
      if (result.state === 'delivered' && result.letterId) {
        const bundle = await api.get<LetterBundle>(`/api/letters/${result.letterId}`);
        setLetter(bundle);
        // Opening is bookkeeping; failure must not hide an available reflection.
        api.post(`/api/letters/${result.letterId}/open`).catch(() => undefined);
      } else {
        setCycleId(result.cycleId ?? null);
        setNote('This reflection is already being prepared. Check again shortly; it will also appear on your Notebook.');
      }
    } catch {
      setNote('The reflection is not available yet. Your entry is saved. Try again to check for a completed reflection or retry.');
    } finally { setBusy(false); }
  }

  // Mount only after the entry save is acknowledged. Auto-start is an explicit
  // preference, never inferred from the content or depth.
  useEffect(() => { if (autoStart) void reflect(); }, []);

  return <section className="entry-reflection" aria-label="Reflect on this entry">
    <ReflectionControls value={preferences} onChange={(value) => { setPreferences(value); setLetter(null); }} disabled={busy || !!cycleId} compact />
    <p className="composer-hint">AI reads this entry only. A reflection does not add to long-term memory.</p>
    <button className="btn-quiet" disabled={busy || !!cycleId} onClick={reflect}>{busy || cycleId ? 'Preparing your reflection…' : 'Reflect on this'}</button>
    {busy && <p role="status">Reading your entry and checking the response. There is no intentional delay.</p>}
    {note && <p role="status">{note}</p>}
    {letter && !closed && <>
      <div className="letter-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(letter.bodyMd) }} />
      <p className="composer-hint">Based on this entry. An AI interpretation that you can disagree with.</p>
      <button className="btn-quiet" onClick={() => setClosed(true)}>Finish for now</button>
      <p className="composer-hint">If something does not fit, you can explore that in your next entry. The reflection remains in your archive.</p>
    </>}
  </section>;
}
