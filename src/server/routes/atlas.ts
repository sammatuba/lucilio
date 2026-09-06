// The Atlas: a frozen content pack (facts from reviewed sources) + a vantage
// image proxy. No Firestore, no model calls — the pack is versioned like the
// personas and the imagery is proxied server-side so no Maps key ever reaches
// the browser and the CSP stays `default-src 'self'` for images.
import { Router, type Response, type NextFunction } from 'express';
import type { AtlasIndexPayload, AtlasPack, AtlasPlate, AtlasPlateSummary } from '../../shared/atlas.js';
import { emptyBodySchema } from '../../shared/schemas.js';
import { protectedRoute, type AuthedRequest, type RouteDeps } from '../middleware.js';
import { ATLAS_PACK, ATLAS_PACK_INDEX } from '../atlas/pack.js';
import { config } from '../env.js';

const STREETVIEW_URL = 'https://maps.googleapis.com/maps/api/streetview';
const STREETVIEW_METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata';

// Street View Static API compliance posture (policies checked 2026-09-06):
// panorama METADATA (pano ids, dates, copyright) is explicitly storable;
// the IMAGE BYTES are not — so images are fetched per request and served with
// `Cache-Control: no-store`, while coverage/metadata results are cached in
// memory for a day. Negative results are cached so a plate without coverage
// never hammers the endpoint. Attribution (Google + contributor copyright)
// flows to the client through the vantage-meta route.
const META_CACHE_TTL_MS = 24 * 86_400_000;

interface VantageMeta {
  ok: boolean;
  copyright?: string;
  date?: string;
}

interface VantageMetaCacheEntry {
  at: number;
  meta: VantageMeta;
}

export function summarizePlates(pack: AtlasPack): AtlasPlateSummary[] {
  return pack.plates.map((p) => ({
    id: p.id,
    number: p.number,
    kind: p.kind,
    title: p.title,
    standfirst: p.standfirst,
    placeLine: p.view.placeLine,
    imagery: p.view.kind,
  }));
}

async function fetchVantageMeta(plate: AtlasPlate): Promise<VantageMeta> {
  const key = config.mapsApiKey;
  if (!key || plate.view.kind !== 'streetview' || plate.view.lat === undefined || plate.view.lng === undefined) {
    return { ok: false };
  }
  const params = new URLSearchParams({
    location: `${plate.view.lat},${plate.view.lng}`,
    heading: String(plate.view.heading ?? 0),
    pitch: String(plate.view.pitch ?? 0),
    fov: String(plate.view.fov ?? 90),
    size: '640x480',
    key,
  });
  try {
    // The metadata endpoint is an unbilled availability check, and its fields
    // (pano id, capture date, copyright) are explicitly storable.
    const metaRes = await fetch(`${STREETVIEW_METADATA_URL}?${params}`, {
      signal: AbortSignal.timeout(5_000),
    });
    const meta = (await metaRes.json()) as { status?: string; copyright?: string; date?: string };
    if (meta.status !== 'OK') return { ok: false };
    return { ok: true, copyright: meta.copyright, date: meta.date };
  } catch {
    // Never cached: the next plate view may simply succeed.
    throw new Error('vantage metadata unavailable');
  }
}

async function fetchVantageImage(plate: AtlasPlate): Promise<Buffer | null> {
  const key = config.mapsApiKey;
  if (!key || plate.view.kind !== 'streetview' || plate.view.lat === undefined || plate.view.lng === undefined) {
    return null;
  }
  const params = new URLSearchParams({
    location: `${plate.view.lat},${plate.view.lng}`,
    heading: String(plate.view.heading ?? 0),
    pitch: String(plate.view.pitch ?? 0),
    fov: String(plate.view.fov ?? 90),
    // size × scale → 1280×840 effective pixels: enough for a scrimmed hero.
    size: '640x420',
    scale: '2',
    key,
  });
  try {
    const imgRes = await fetch(`${STREETVIEW_URL}?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!imgRes.ok) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  } catch {
    return null;
  }
}

// The exact index payload the client validates against atlasIndexPayloadSchema.
// Building it here (not inline in the route) lets the unit suite parse the real
// server payload through the shared schema — the route and the contract cannot
// drift apart silently again.
export function atlasIndexPayload(): AtlasIndexPayload {
  return {
    pack: { ...ATLAS_PACK_INDEX, edition: ATLAS_PACK.edition.title },
    plates: summarizePlates(ATLAS_PACK),
  };
}

export function atlasRouter(deps: RouteDeps): Router {
  const r = Router();
  const metaCache = new Map<string, VantageMetaCacheEntry>();

  async function vantageMeta(plate: AtlasPlate): Promise<VantageMeta> {
    const cached = metaCache.get(plate.id);
    if (cached && Date.now() - cached.at < META_CACHE_TTL_MS) return cached.meta;
    const meta = await fetchVantageMeta(plate);
    metaCache.set(plate.id, { at: Date.now(), meta });
    return meta;
  }

  r.get('/atlas', protectedRoute(deps, emptyBodySchema), (req: AuthedRequest, res: Response) => {
    res.json(atlasIndexPayload());
  });

  r.get('/atlas/plates/:id', protectedRoute(deps, emptyBodySchema), (req: AuthedRequest, res: Response) => {
    const plate = ATLAS_PACK.plates.find((p) => p.id === req.params.id);
    if (!plate) {
      res.status(404).json({ error: 'no such plate' });
      return;
    }
    res.json({
      pack: { version: ATLAS_PACK.version, edition: ATLAS_PACK.edition.title },
      plate,
    });
  });

  // Coverage + attribution metadata (storable per the Street View policies):
  // always a clean 200 with an ok flag, so the client treats "no key" and
  // "no coverage" identically — open the typographic plate.
  r.get('/atlas/plates/:id/vantage-meta', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const plate = ATLAS_PACK.plates.find((p) => p.id === req.params.id);
      if (!plate) {
        res.status(404).json({ error: 'no such plate' });
        return;
      }
      try {
        res.json(await vantageMeta(plate));
      } catch {
        // Transient metadata outage: not an authoritative "no coverage", so
        // the client falls back for now and nothing is cached.
        res.status(503).json({ error: 'vantage metadata temporarily unavailable' });
      }
    } catch (e) {
      next(e);
    }
  });

  // Vantage imagery: fetched fresh per request (no byte caching — the
  // policies allow storing pano metadata, not imagery) and served with
  // no-store. A missing key, no coverage, or an upstream failure is a clean
  // 404 the client treats as "open the typographic plate".
  r.get('/atlas/plates/:id/vantage', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const plate = ATLAS_PACK.plates.find((p) => p.id === req.params.id);
      if (!plate) {
        res.status(404).json({ error: 'no such plate' });
        return;
      }
      let meta: VantageMeta;
      try {
        meta = await vantageMeta(plate);
      } catch {
        // Transient outage upstream: degrade to the typographic plate rather
        // than erroring the page.
        res.status(404).json({ error: 'no coverage for this vantage' });
        return;
      }
      if (!meta.ok) {
        res.status(404).json({ error: 'no coverage for this vantage' });
        return;
      }
      const image = await fetchVantageImage(plate);
      if (!image) {
        res.status(404).json({ error: 'no coverage for this vantage' });
        return;
      }
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.send(image);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
