import { useState } from 'react';
import type { DeskPayload } from '../../shared/schemas';
import { CORRESPONDENT_CARDS } from '../../shared/constants';
import { api } from '../lib/api';
import { requestLetterCopy } from '../lib/copy';

// Shared between the Desk aside and the Correspondents cards: request a
// letter from a correspondent, once per day, with the same disabled state,
// label variants, and in-voice error copy in both places.
export default function RequestLetterButton({
  cid,
  desk,
  refresh,
  className,
  style,
}: {
  cid: 'director' | 'future_self' | 'foreign';
  desk: DeskPayload;
  refresh: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const card = CORRESPONDENT_CARDS[cid];
  const undelivered = desk.undelivered ?? [];
  const usedToday = !!desk.requestUsedToday[cid];

  async function requestLetter() {
    setNote(null);
    setBusy(true);
    try {
      await api.post('/api/letters/request', { cid });
      refresh();
    } catch (e) {
      setNote(requestLetterCopy(e, card.name));
    } finally {
      setBusy(false);
    }
  }

  const label = usedToday
    ? `${card.name} — asked today`
    : undelivered.some((u) => u.cid === cid && u.kind === 'requested')
      ? `Ask ${card.name} again`
      : `Ask ${card.name} to write`;

  return (
    <>
      <button className={className ?? 'btn-quiet'} style={style} disabled={usedToday || busy} onClick={requestLetter}>
        {label}
      </button>
      {note && (
        <p className="composer-hint" role="status" aria-live="polite" style={{ margin: '8px 0', color: 'var(--ink-soft)' }}>
          {note}
        </p>
      )}
    </>
  );
}
