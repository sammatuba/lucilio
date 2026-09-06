import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { CorrespondentDoc, ReplyDoc, VolumeLetter } from '../../shared/schemas';
import { CORRESPONDENT_CARDS } from '../../shared/constants';

interface Volume {
  correspondent: CorrespondentDoc;
  letters: VolumeLetter[];
}

export default function StudyThread() {
  const { cid } = useParams();
  const [volume, setVolume] = useState<Volume | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Volume>(`/api/correspondents/${cid}/thread`)
      .then(setVolume)
      .catch((e) => setError(e instanceof Error ? e.message : 'could not open the volume'));
  }, [cid]);

  if (error) return <div className="save-error">{error}</div>;
  if (!volume) return <p className="empty-note">Opening the volume…</p>;

  const card = CORRESPONDENT_CARDS[volume.correspondent.cid];
  const concluded = volume.correspondent.status === 'concluded';

  return (
    <>
      <h2 className="page-title">{card?.name ?? cid}</h2>
      <p className="page-sub">
        {concluded ? 'A bound volume — read-only, kept whole.' : card?.title} ·{' '}
        <Link to="/correspondents">back to Correspondents</Link>
      </p>

      <div className="entry-list">
        {volume.letters.map((l) => (
          <div key={l.id}>
            <div className="thread-item">
              <div className="head">
                <span>
                  LETTER ·{' '}
                  {new Date(l.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}{' '}
                  · {l.genre}
                  {l.status === 'sealed' && ' · still sealed'}
                </span>
                <Link to={`/letter/${l.id}`}>read as letter</Link>
              </div>
              <div className="body">
                {l.status === 'sealed' ? (
                  <em>Still sealed — it opens once, on the letter page.</em>
                ) : (
                  <>
                    <em>{l.salutation}</em>
                    {'\n\n'}
                    {l.bodyMd}
                  </>
                )}
              </div>
            </div>
            {(l.replies ?? []).map((r) => (
              <div className="thread-item reply" key={r.id}>
                <div className="head">
                  <span>
                    YOUR REPLY ·{' '}
                    {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="body">{r.bodyMd}</div>
              </div>
            ))}
          </div>
        ))}
        {volume.letters.length === 0 && (
          <p className="empty-note">No letters yet in this volume. They arrive on the post.</p>
        )}
      </div>
    </>
  );
}
