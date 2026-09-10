import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { DeskPayload } from '../../shared/schemas';
import { CORRESPONDENT_CARDS } from '../../shared/constants';
import { Seal, sealLetter } from './icons';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// Extracted from the old Desk: composing notices, undelivered notices, the
// sealed-envelope list, and the last 3 opened/recent letters. Polls gently
// while something is composing. Renders nothing when there is truly nothing
// to show — the Notebook home should not carry an empty tray.
export default function WaitingTray({ desk, refresh }: { desk: DeskPayload | null; refresh: () => void }) {
  const composing = desk?.composing ?? [];
  useEffect(() => {
    if (composing.length === 0) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [composing.length, refresh]);

  if (!desk) return null;

  const waiting = desk.waitingLetters;
  const undelivered = desk.undelivered ?? [];
  const recent = desk.recentLetters.filter((l) => l.status !== 'sealed').slice(0, 3);

  if (composing.length === 0 && undelivered.length === 0 && waiting.length === 0 && recent.length === 0) {
    return null;
  }

  const heading = waiting.length > 0 || composing.length > 0 || undelivered.length > 0 ? 'Waiting for you' : 'Recent letters';

  return (
    <div className="waiting-tray">
      <h3 className="page-title" style={{ fontSize: 20 }}>{heading}</h3>

      {(composing.length > 0 || waiting.length > 0) && undelivered.length === 0 && (
        <p className="tray-note">
          Nothing is required of you here — this part arrives on its own. Sealed letters wait until you
          open them.
        </p>
      )}

      {composing.length > 0 && (
        <div className="composing-note" style={{ marginBottom: 18 }}>
          {composing.map((c) => (
            <div key={c.cycleId}>
              {c.reflection
                ? 'Your reflection is being prepared. It will appear here as soon as it is ready.'
                : c.kind === 'welcome'
                  ? 'Your first letters are being written. Your correspondents are reading your first entry — this takes a few minutes, and the letters arrive here together.'
                  : c.kind === 'concluding'
                    ? 'A final letter is being written…'
                    : 'Your response is being prepared and checked. It will appear here as soon as it is ready.'}
            </div>
          ))}
        </div>
      )}

      {undelivered.length > 0 && (
        <div className="save-error" style={{ marginBottom: 18 }}>
          {undelivered.map((u) => (
            <div key={`${u.cycleId}-${u.cid}`}>
              {u.kind === 'welcome'
                ? `${CORRESPONDENT_CARDS[u.cid]?.name ?? u.cid}'s welcome letter did not come through on ${formatWhen(u.at)}.`
                : u.kind === 'concluding'
                  ? `${CORRESPONDENT_CARDS[u.cid]?.name ?? u.cid}'s final letter did not come through on ${formatWhen(u.at)}. Concluding again will ask for it once more.`
                  : `${CORRESPONDENT_CARDS[u.cid]?.name ?? u.cid}'s letter did not come through on ${formatWhen(u.at)}.`}
              {u.kind !== 'concluding' && ' Nothing you wrote was lost — you may ask for it again below.'}
            </div>
          ))}
        </div>
      )}

      <div className="envelope-list">
        {waiting.map((l) => (
          <Link className="envelope" to={`/letter/${l.id}`} key={l.id}>
            <span className="seal-dot">
              <Seal letter={sealLetter(l.cid)} size={28} />
            </span>
            <span className="meta">
              <span className="from">{l.reflection ? 'Lucilio reflection' : CORRESPONDENT_CARDS[l.cid]?.name ?? l.cid}</span>
              <span className="when" style={{ display: 'block' }}>{formatWhen(l.createdAt)}</span>
            </span>
            <span className="status">sealed</span>
          </Link>
        ))}
        {recent.map((l) => (
          <Link className="envelope opened" to={`/letter/${l.id}`} key={l.id}>
            <span className="seal-dot">
              <Seal letter={sealLetter(l.cid)} size={28} style={{ opacity: 0.45 }} />
            </span>
            <span className="meta">
              <span className="from">{l.reflection ? 'Lucilio reflection' : CORRESPONDENT_CARDS[l.cid]?.name ?? l.cid}</span>
              <span className="when" style={{ display: 'block' }}>{formatWhen(l.createdAt)}</span>
            </span>
            <span className="status">{l.status === 'final' ? 'final' : l.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
