// Atlas routes against the REAL middleware chain (buildApp + emulator-minted
// tokens): the pack is world content but it is still behind the same gate —
// no token, no Atlas. The vantage proxy must fail as a clean 404 (typographic
// fallback) when no Maps key is configured — never a crash, never an HTML error.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { buildApp } from '../../src/server/index.js';
import { adminAuth } from '../../src/server/firebase.js';
import * as store from '../../src/server/store.js';
import { mintIdToken } from './helpers.js';

const UID = 'atlas-test-user';
let baseUrl = '';
let server: Server;
let token = '';

function authed(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  // Deterministic: the vantage proxy must be exercised in its no-key state.
  delete process.env.GOOGLE_MAPS_API_KEY;
  token = await mintIdToken(UID);
  const app = buildApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}, 30_000);

afterAll(async () => {
  server?.close();
  await store.cascadeDelete(UID).catch(() => undefined);
  await adminAuth.deleteUser(UID).catch(() => undefined);
});

describe('Atlas authentication gate', () => {
  it('rejects a request with no ID token', async () => {
    const res = await fetch(`${baseUrl}/api/atlas`);
    expect(res.status).toBe(401);
  });

  it('rejects a garbage ID token', async () => {
    const res = await fetch(`${baseUrl}/api/atlas/plates/liternum`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status).toBe(401);
  });
});

describe('Atlas content (authenticated)', () => {
  it('serves the index with pack provenance and plate summaries (no essay bodies)', async () => {
    const res = await fetch(`${baseUrl}/api/atlas`, { headers: authed() });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      pack: { version: string; plateCount: number; sourceCount: number };
      plates: { id: string; title: string; bodyMd?: string }[];
    };
    expect(data.pack.version).toMatch(/^atlas-v\d+/);
    expect(data.pack.plateCount).toBeGreaterThanOrEqual(1);
    expect(data.plates.length).toBe(data.pack.plateCount);
    expect(data.plates[0]!.title).toBeTruthy();
    expect(data.plates[0]!.bodyMd).toBeUndefined();
    // The response must satisfy the CLIENT's zod contract, not merely these
    // spot checks (regression: a missing pack.editionNumber passed the spot
    // checks and broke the Atlas for every signed-in user in production).
    const { atlasIndexPayloadSchema } = await import('../../src/shared/atlas.js');
    expect(atlasIndexPayloadSchema.safeParse(data).success).toBe(true);
  });

  it('serves a full plate with essay, sources, and vantage', async () => {
    const res = await fetch(`${baseUrl}/api/atlas/plates/liternum`, { headers: authed() });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      plate: { id: string; bodyMd: string; sources: unknown[]; marginNotes: unknown[]; view: { kind: string } };
    };
    expect(data.plate.id).toBe('liternum');
    expect(data.plate.bodyMd.length).toBeGreaterThan(1000);
    expect(data.plate.sources.length).toBeGreaterThanOrEqual(1);
    expect(data.plate.marginNotes.length).toBeGreaterThanOrEqual(3);
    expect(data.plate.view.kind).toBe('streetview');
  });

  it('404s cleanly for an unknown plate', async () => {
    const res = await fetch(`${baseUrl}/api/atlas/plates/atlantis`, { headers: authed() });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error?: string }).error).toBeTruthy();
  });

  it('vantage proxy without a Maps key: clean 404, JSON, never HTML', async () => {
    const res = await fetch(`${baseUrl}/api/atlas/plates/liternum/vantage`, { headers: authed() });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect((body as { error?: string }).error).toBeTruthy();
  });

  it('vantage metadata without a Maps key: a quiet ok:false, not an error', async () => {
    const res = await fetch(`${baseUrl}/api/atlas/plates/liternum/vantage-meta`, { headers: authed() });
    expect(res.status).toBe(200);
    expect((await res.json()) as { ok: boolean }).toEqual({ ok: false });
  });

  it('vantage metadata for an unknown plate: 404', async () => {
    const res = await fetch(`${baseUrl}/api/atlas/plates/atlantis/vantage-meta`, { headers: authed() });
    expect(res.status).toBe(404);
  });
});
