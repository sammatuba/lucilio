import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  ATLAS_KIND_LABELS,
  atlasIndexPayloadSchema,
  plateRoman,
  type AtlasIndexPayload,
} from '../../shared/atlas';

// The Atlas index: a table of contents, the way a book of maps shows itself —
// not a feed. Everything is listed in plate order with no algorithmic
// ordering, no recommendations, and no notification ever attached to it.
export default function Atlas() {
  const [payload, setPayload] = useState<AtlasIndexPayload | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setPayload(null);
    setState('loading');
    api.get<unknown>('/api/atlas')
      .then((data) => {
        if (!active) return;
        const parsed = atlasIndexPayloadSchema.safeParse(data);
        if (parsed.success) {
          setPayload(parsed.data);
          setState('ready');
        } else {
          setState('error');
        }
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state === 'loading') {
    return <p className="empty-note" role="status" aria-live="polite">Opening the Atlas</p>;
  }
  if (state === 'error') {
    return (
      <div className="atlas-state" role="alert">
        <p className="empty-note">The Atlas could not be opened right now.</p>
        <button className="btn-quiet" type="button" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </button>
      </div>
    );
  }
  if (!payload) return <p className="empty-note">Opening the Atlas…</p>;

  const { pack, plates } = payload;
  return (
    <>
      <h2 className="page-title">The Atlas</h2>
      <p className="page-sub">
        A small library of places, ideas, works, and lives — plates to read slowly. There is no feed here
        and no recommendation: open the table of contents and choose.
      </p>
      <p className="atlas-packline">
        Edition {plateRoman({ number: pack.editionNumber })} — “{pack.edition}” · {pack.plateCount} plates ·
        sources listed on every plate · pack {pack.version}
      </p>
      <ol className="atlas-ledger">
        {plates.map((p) => (
          <li key={p.id}>
            <Link to={`/atlas/${p.id}`} className="atlas-ledger-row">
              <span className="atlas-plate-no">Plate {plateRoman({ number: p.number })}</span>
              <span className="atlas-kind">{ATLAS_KIND_LABELS[p.kind]}</span>
              <span className="atlas-main">
                <span className="atlas-title">{p.title}</span>
                <span className="atlas-standfirst">{p.standfirst}</span>
              </span>
              <span className="atlas-place">{p.placeLine}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="atlas-packline atlas-packline-fine">{pack.provenance}</p>
    </>
  );
}
