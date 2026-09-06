// Atlas vantage coverage check (curation-time tool, run before an edition
// ships). For every street-view plate in the pack it asks the Street View
// Static METADATA endpoint — an unbilled availability check — whether the
// curated coordinates + heading actually have imagery, and (with --image)
// fetches one real image to prove the billed call works too.
//
//   npm run atlas:check            # coverage per plate
//   npm run atlas:check -- --image # also fetch one image per plate
//   npm run atlas:check -- --probe 41.0431,14.0017
//                                  # spiral-probe nearby Street View coverage
//                                  # for a coordinate pair and report the
//                                  # nearest covered panoramas with bearings —
//                                  # curation-time re-vantaging, unbilled.
import { loadEnvLocal, config } from '../src/server/env.js';
import { ATLAS_PACK } from '../src/server/atlas/pack.js';

loadEnvLocal();

const key = config.mapsApiKey;
if (!key) {
  console.error('[atlas] GOOGLE_MAPS_API_KEY is not set — nothing to check. (Typographic plates remain the no-key fallback.)');
  process.exit(1);
}

const probeIdx = process.argv.indexOf('--probe');
if (probeIdx !== -1) {
  await probe(process.argv[probeIdx + 1]);
  process.exit(0);
}

async function probe(spec: string | undefined): Promise<void> {
  if (!spec || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(spec)) {
    console.error('usage: npm run atlas:check -- --probe lat,lng');
    process.exit(1);
  }
  const [lat0, lng0] = spec.split(',').map(Number) as [number, number];
  // Rings of metadata probes around the target, out to ~450 m (0.004° lat).
  const ring: Array<[number, number]> = [[0, 0]];
  for (let r = 1; r <= 4; r++) {
    for (let a = 0; a < 8; a++) {
      const angle = (a * Math.PI) / 4;
      ring.push([r * 0.001 * Math.sin(angle), r * 0.001 * Math.cos(angle)]);
    }
  }
  const hits: { lat: number; lng: number; distM: number; date?: string; copyright?: string; bearing: number }[] = [];
  const batches: (typeof ring)[] = [];
  for (let i = 0; i < ring.length; i += 10) batches.push(ring.slice(i, i + 10));

  for (const batch of batches) {
    await Promise.all(
      batch.map(async ([dLat, dLng]) => {
        const lat = lat0 + dLat;
        const lng = lng0 + dLng;
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&source=outdoor&key=${key}`,
            { signal: AbortSignal.timeout(8_000) },
          );
          const meta = (await res.json()) as {
            status?: string;
            date?: string;
            copyright?: string;
            location?: { lat?: number; lng?: number };
          };
          const loc = meta.location;
          if (meta.status !== 'OK' || !loc || loc.lat === undefined || loc.lng === undefined) return;
          // Deduplicate panoramas that several probes snap to.
          const plat = loc.lat;
          const plng = loc.lng;
          if (hits.some((h) => Math.abs(h.lat - plat) < 1e-6 && Math.abs(h.lng - plng) < 1e-6)) return;
          hits.push({
            lat: plat,
            lng: plng,
            distM: Math.hypot((plat - lat0) * 111_320, (plng - lng0) * 111_320 * Math.cos((lat0 * Math.PI) / 180)),
            date: meta.date,
            copyright: meta.copyright,
            bearing: bearingTo(plat, plng, lat0, lng0),
          });
        } catch {
          // probe point failed; keep going
        }
      }),
    );
  }

  if (hits.length === 0) {
    console.error(`[probe] no Street View coverage found within ~450 m of ${lat0},${lng0} — this vantage needs a satellite/typographic fallback.`);
    return;
  }
  hits.sort((a, b) => a.distM - b.distM);
  console.log(`[probe] nearest covered panoramas to ${lat0},${lng0} (bearing = heading that looks AT the target):`);
  for (const h of hits.slice(0, 5)) {
    console.log(
      `  · location: ${h.lat.toFixed(6)},${h.lng.toFixed(6)}  heading: ${Math.round(h.bearing)}  dist: ${Math.round(h.distM)} m${h.date ? `  imagery: ${h.date}` : ''}  © ${h.copyright ?? 'Google'}`,
    );
  }
}

function bearingTo(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const alsoImage = process.argv.includes('--image');
const plates = ATLAS_PACK.plates.filter((p) => p.view.kind === 'streetview');
let failures = 0;

for (const plate of plates) {
  const { lat, lng, heading = 0, pitch = 0, fov = 90 } = plate.view;
  const base = new URLSearchParams({
    location: `${lat},${lng}`,
    heading: String(heading),
    pitch: String(pitch),
    fov: String(fov),
    key,
  });

  try {
    const metaRes = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${base}&size=640x480`, {
      signal: AbortSignal.timeout(8_000),
    });
    const meta = (await metaRes.json()) as {
      status?: string;
      copyright?: string;
      date?: string;
      location?: { lat?: number; lng?: number };
      error_message?: string;
    };

    if (meta.status !== 'OK') {
      failures += 1;
      console.error(`✗ Plate ${plate.number} "${plate.title}" — metadata status: ${meta.status ?? 'unknown'}${meta.error_message ? ` — ${meta.error_message}` : ' (no coverage; re-curate the vantage)'}`);
      continue;
    }

    let imageNote = '';
    if (alsoImage) {
      const imgRes = await fetch(`https://maps.googleapis.com/maps/api/streetview?${base}&size=640x420&scale=2`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!imgRes.ok) {
        failures += 1;
        console.error(`✗ Plate ${plate.number} "${plate.title}" — image fetch failed: HTTP ${imgRes.status}`);
        continue;
      }
      const bytes = (await imgRes.arrayBuffer()).byteLength;
      imageNote = ` · image ${Math.round(bytes / 1024)} KB`;
      if (bytes < 5_000) imageNote += ' (suspiciously small — inspect manually)';
    }

    const snapped = meta.date ? `, imagery dated ${meta.date}` : '';
    console.log(`✓ Plate ${plate.number} "${plate.title}" — coverage OK${imageNote}${snapped} · © ${meta.copyright ?? 'Google'}`);
  } catch (e) {
    failures += 1;
    console.error(`✗ Plate ${plate.number} "${plate.title}" — request failed: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(failures === 0 ? `\n[atlas] ${plates.length}/${plates.length} vantages covered.` : `\n[atlas] ${failures} of ${plates.length} vantages need re-curation.`);
process.exit(failures === 0 ? 0 : 1);
