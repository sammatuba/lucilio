import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getBlob } from '../lib/api';
import { renderMarkdown } from '../lib/markdown';
import { setPlateSeed } from '../lib/plateSeed';
import { AtlasFrame } from '../components/icons';
import {
  ATLAS_KIND_LABELS,
  atlasPlatePayloadSchema,
  plateRoman,
  type AtlasPlate,
  type AtlasPlatePayload,
} from '../../shared/atlas';

// A plate: the vantage (a Street View establishing shot when imagery is
// configured and coverage exists, a typographic plate when it is not), then
// the essay rising on paper from beneath it — one motion, no modal, no
// "continue reading". Nothing autoplays; the drift is CSS-only and stops dead
// under reduced motion. Attribution carries the imagery's actual copyright
// holder plus Google Maps, per the Street View Static API policies.
export default function AtlasPlate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<AtlasPlatePayload | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [vantageMeta, setVantageMeta] = useState<{ copyright?: string; date?: string } | null>(null);
  const [vantageUrl, setVantageUrl] = useState<string | null>(null);
  const [vantageFailed, setVantageFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setVantageMeta(null);
    setVantageUrl(null);
    setVantageFailed(false);
    setState('loading');
    setPayload(null);
    api.get<unknown>(`/api/atlas/plates/${id}`)
      .then((data) => {
        if (!active) return;
        const parsed = atlasPlatePayloadSchema.safeParse(data);
        if (parsed.success) {
          setPayload(parsed.data);
          setState('ready');
        } else {
          setState('error');
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState((error as { status?: unknown })?.status === 404 ? 'missing' : 'error');
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  useEffect(() => {
    // Coverage + attribution metadata, then the image itself. An <img src>
    // cannot carry the Authorization/App Check headers, so the bytes come
    // through the authenticated fetch client as a blob URL. ok:false and any
    // failure both simply mean the typographic plate — a missing vantage is a
    // quiet state, never an error page.
    let active = true;
    let objectUrl: string | null = null;
    api.get<{ ok: boolean; copyright?: string; date?: string }>(`/api/atlas/plates/${id}/vantage-meta`)
      .then(async (meta) => {
        if (!active) return;
        if (!meta?.ok) return;
        const blob = await getBlob(`/api/atlas/plates/${id}/vantage`);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setVantageMeta({ copyright: meta.copyright, date: meta.date });
        setVantageUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (state === 'missing') {
    return (
      <>
        <p className="empty-note" role="status">No such plate in the Atlas.</p>
        <p>
          <Link to="/atlas" className="btn-quiet">Back to the Atlas</Link>
        </p>
      </>
    );
  }
  if (state === 'loading') {
    return <p className="empty-note" role="status" aria-live="polite">Opening this plate</p>;
  }
  if (state === 'error' || !payload) {
    return (
      <div className="atlas-state" role="alert">
        <p className="empty-note">This plate could not be opened right now.</p>
        <button className="btn-quiet" type="button" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </button>
      </div>
    );
  }

  const { plate, pack } = payload;
  const showImage = plate.view.kind === 'streetview' && vantageUrl !== null && !vantageFailed;

  function writeFromThis(p: AtlasPlate) {
    setPlateSeed({
      plate: `Plate ${plateRoman(p)}`,
      title: p.title,
      quote: p.writeFromQuote,
    });
    navigate('/notebook');
  }

  return (
    <article className="atlas-plate">
      <section className={`atlas-hero ${showImage ? 'with-image' : 'typographic'}`}>
        {showImage && (
          <>
            <img
              className="atlas-vantage"
              src={vantageUrl ?? undefined}
              alt={`Present-day view of ${plate.view.placeLine}`}
              onError={() => setVantageFailed(true)}
            />
            <div className="atlas-frame-wrap">
              <AtlasFrame />
            </div>
          </>
        )}
        <div className="atlas-scrim" aria-hidden="true" />
        <div className="atlas-titlecard">
          <div className="atlas-plate-no">
            Plate {plateRoman(plate)} · {ATLAS_KIND_LABELS[plate.kind]}
          </div>
          <h1>{plate.title}</h1>
          <p className="atlas-standfirst">{plate.standfirst}</p>
        </div>
        <div className="atlas-heroline">
          <span>{plate.view.placeLine}</span>
          {plate.view.coordsLine && <span>{plate.view.coordsLine}</span>}
          {showImage && (
            <span className="atlas-attribution" translate="no">
              © {(vantageMeta?.copyright ?? 'Google').replace(/^©\s*/, '')} · Google Maps
            </span>
          )}
        </div>
      </section>

      <div className="atlas-essay">
        <div className="atlas-essay-grid">
          <div className="atlas-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(plate.bodyMd) }} />
          <aside className="atlas-margin">
            <h4>Margin notes</h4>
            <ul>
              {plate.marginNotes.map((n, i) => (
                <li key={i}>
                  {n.date && <span className="atlas-note-date">{n.date}</span>}
                  <span>{n.fact}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="atlas-question">
          <h4>A question to carry</h4>
          <p>{plate.question}</p>
          <button className="btn-primary" onClick={() => writeFromThis(plate)}>
            Write from this
          </button>
          <p className="composer-hint">
            Opens the Notebook with the plate set down — the rest of the page is yours. What you write is an
            ordinary entry: yours, private, exportable.
          </p>
        </div>

        <div className="atlas-sources">
          <h4>Sources</h4>
          <ul>
            {plate.sources.map((s, i) => (
              <li key={i}>
                <span>{s.title}</span>
                {s.publisher && <span> — {s.publisher}</span>}
                {s.url && (
                  <>
                    {' '}
                    <a href={s.url} rel="noopener noreferrer">{s.url}</a>
                  </>
                )}
                {s.retrievedAt && <span className="atlas-note-date"> · retrieved {s.retrievedAt}</span>}
              </li>
            ))}
          </ul>
          <p className="atlas-provenance">
            {pack.version} · composed from the listed sources and reviewed before this edition shipped. The
            Atlas never invents sources — if a claim here looks wrong, the Trust Center says what was proven
            and what was not.
          </p>
        </div>

        <p className="atlas-back">
          <Link to="/atlas" className="btn-quiet">Back to the Atlas</Link>
        </p>
      </div>
    </article>
  );
}
