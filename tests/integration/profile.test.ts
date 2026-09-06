// POST /api/profile — displayName: persists a valid name and shows up on the
// desk payload's profile; rejects a 61-char name with a clean 400.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { buildApp } from '../../src/server/index.js';
import { adminAuth } from '../../src/server/firebase.js';
import * as store from '../../src/server/store.js';
import { mintIdToken } from './helpers.js';

const UID = 'profile-test-user';
let baseUrl = '';
let server: Server;
let token = '';

function authed(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
}

beforeAll(async () => {
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

describe('POST /api/profile — displayName', () => {
  it('persists a valid display name and it appears on the desk payload', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({ displayName: 'Lucilio Reader' }),
    });
    expect(res.status).toBe(200);

    const deskRes = await fetch(`${baseUrl}/api/desk`, { headers: authed() });
    expect(deskRes.status).toBe(200);
    const desk = (await deskRes.json()) as { profile: { displayName?: string } };
    expect(desk.profile.displayName).toBe('Lucilio Reader');
  });

  it('rejects a 61-character display name with a clean 400', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({ displayName: 'a'.repeat(61) }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error?: string }).error).toBeTruthy();
  });
});
