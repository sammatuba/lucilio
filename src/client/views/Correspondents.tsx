import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CorrespondentDoc, DeskPayload } from '../../shared/schemas';
import { CORRESPONDENT_IDS } from '../../shared/schemas';
import { CORRESPONDENT_CARDS } from '../../shared/constants';
import { api } from '../lib/api';
import { concludeCopy } from '../lib/copy';
import RequestLetterButton from '../components/RequestLetterButton';
import { Seal, sealLetter } from '../components/icons';

interface ThreadInfo {
  correspondent: CorrespondentDoc;
  count: number;
}

export default function Correspondents({ desk, refresh }: { desk: DeskPayload | null; refresh: () => void }) {
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const infos: ThreadInfo[] = [];
      for (const cid of CORRESPONDENT_IDS) {
        try {
          const t = await api.get<{ correspondent: CorrespondentDoc; letters: unknown[] }>(`/api/correspondents/${cid}/thread`);
          infos.push({ correspondent: t.correspondent, count: t.letters.length });
        } catch {
          /* correspondent not yet provisioned */
        }
      }
      setThreads(infos);
    })();
  }, [desk]);

  async function conclude(cid: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/correspondents/${cid}/conclude`);
      setConfirming(null);
      refresh();
    } catch (e) {
      setError(concludeCopy(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="page-title">Correspondents</h2>
      <p className="page-sub">
        Ask for a letter from your <Link to="/">Notebook</Link>; here you can read each volume or end a correspondence.
      </p>
      <p className="page-sub">
        The people who write to you. Ask any of them for a letter, read what they have written, or end a
        correspondence when it has run its course.
      </p>

      {error && <div className="save-error">{error}</div>}

      <div className="volumes">
        {CORRESPONDENT_IDS.map((cid) => {
          const card = CORRESPONDENT_CARDS[cid];
          const info = threads.find((t) => t.correspondent.cid === cid);
          const concluded = info?.correspondent.status === 'concluded';
          const composingConclude = desk?.composing.some((c) => c.kind === 'concluding');
          return (
            <div className={`volume ${concluded ? 'concluded' : ''}`} key={cid}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Seal letter={sealLetter(cid)} size={32} />
                <span>{card.name}</span>
              </h3>
              <div className="role">{card.title}</div>
              <div className="letter-count">
                {info ? `${info.count} letter${info.count === 1 ? '' : 's'}` : '—'} {concluded && <span className="bound-tag"> · bound</span>}
              </div>
              <div className="row">
                <Link className="btn-quiet" to={`/correspondents/${cid}`}>Open volume</Link>
                {!concluded && desk && <RequestLetterButton cid={cid} desk={desk} refresh={refresh} />}
              </div>
              {!concluded && info && (
                <div className="more-menu">
                  <button
                    type="button"
                    className="btn-quiet more-toggle"
                    aria-expanded={moreOpen === cid}
                    onClick={() => setMoreOpen(moreOpen === cid ? null : cid)}
                  >
                    More ▾
                  </button>
                  {moreOpen === cid && (
                    <div className="more-menu-panel">
                      <button
                        type="button"
                        className="btn-quiet"
                        onClick={() => {
                          setMoreOpen(null);
                          setConfirming(cid);
                        }}
                      >
                        End this correspondence
                      </button>
                    </div>
                  )}
                </div>
              )}
              {composingConclude && !concluded && <span className="composer-hint">final letter being written…</span>}
            </div>
          );
        })}
      </div>

      {confirming && (
        <div className="modal-backdrop" onClick={() => !busy && setConfirming(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Conclude this correspondence?</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: 14.5 }}>
              {CORRESPONDENT_CARDS[confirming as keyof typeof CORRESPONDENT_CARDS].name} will write one final
              letter, and this volume becomes read-only. Your Notebook reflections and your other correspondents
              are not affected.
            </p>
            <div className="actions">
              <button className="btn-quiet" onClick={() => setConfirming(null)} disabled={busy}>Keep writing</button>
              <button className="btn-danger" onClick={() => conclude(confirming)} disabled={busy}>
                {busy ? 'Asking for the final letter…' : 'Conclude'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
