// POST /internal/cycles/run — the weekly post-day cycle, invoked by Cloud
// Scheduler with an OIDC ID token (production) or a shared dev token (local).
// Eligibility: profile exists, at least one entry, no scheduled cycle yet for
// the user's LOCAL week (catch-up runs if the post day already passed).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../env.js';
import * as store from '../store.js';
import { resumeStaleCycles, runCycle } from '../pipeline.js';
import { datePartsInTz, isoDateInTz } from './desk.js';
import { adminDb } from '../firebase.js';

const oidcClient = new OAuth2Client();

async function verifyInternal(req: Request, res: Response): Promise<boolean> {
  // Local/dev path: shared token header, honored ONLY against emulators.
  // Production always requires the OIDC path below, so the local token can
  // never trigger the live cycle even if INTERNAL_CYCLE_TOKEN were left unset.
  if (config.useEmulators && req.header('X-Internal-Token') === config.internalCycleToken) return true;

  // Production path: OIDC ID token from Cloud Scheduler.
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing credentials' });
    return false;
  }
  try {
    const ticket = await oidcClient.verifyIdToken({
      idToken: header.slice(7),
      audience: [config.publicUrl, `https://${new URL(config.publicUrl).host}`].filter(Boolean),
    });
    const payload = ticket.getPayload();
    // Fail closed: if no scheduler identity is configured, no token passes —
    // a Google-signed token alone must never be enough to trigger cycles.
    const expected = config.schedulerServiceAccountEmail;
    if (!payload || !expected || payload.email !== expected || !payload.email_verified) {
      res.status(403).json({ error: 'untrusted scheduler identity' });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: 'invalid OIDC token' });
    return false;
  }
}

export function internalRouter(): Router {
  const r = Router();

  r.post('/cycles/run', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await verifyInternal(req, res))) return;

      const usersSnap = await adminListUsers();
      const summary = { users: usersSnap.length, ran: 0, skipped: 0, failed: 0, resumed: 0 };

      for (const uid of usersSnap) {
        try {
          const profile = await store.getProfile(uid);
          if (!profile || !profile.onboarded) {
            summary.skipped++;
            continue;
          }
          // Stuck-cycle sweep (roadmap M1-2): any cycle stranded in
          // `composing` by a scale-down or crash is resumed on every tick,
          // whatever the weekday. Resume is idempotent and never re-delivers.
          const swept = await resumeStaleCycles(uid);
          summary.resumed += swept.resumed.length;
          const tz = profile.tz || 'UTC';
          const now = new Date();
          const parts = datePartsInTz(now, tz);
          // Only run on the user's local post day (Sunday) — or catch up if the
          // job fired late / the user joined after Sunday with entries waiting.
          const entries = await store.listEntries(uid, { limit: 1 });
          const cycleId = scheduledCycleIdForTz(now, tz);
          if (profile.weeklyLetters === false) {
            summary.skipped++;
            continue;
          }
          const existing = await store.getCycle(uid, cycleId);
          if (existing) {
            summary.skipped++;
            continue;
          }
          if (entries.length === 0) {
            summary.skipped++;
            continue;
          }
          if (parts.weekday !== 0) {
            // Mid-week invocation (manual trigger / catch-up): allow only if the
            // user has unmailed entries older than the most recent post day.
            summary.skipped++;
            continue;
          }
          await runCycle(uid, { kind: 'scheduled', cycleId, profileTz: tz });
          summary.ran++;
        } catch (e) {
          summary.failed++;
          // eslint-disable-next-line no-console
          console.error(`[cycles] user ${uid} failed:`, e);
        }
      }
      res.json({ ok: true, summary });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

function scheduledCycleIdForTz(now: Date, tz: string): string {
  // Keyed to the user's LOCAL date so Sunday-in-Tokyo and Sunday-in-Lisbon get
  // distinct, idempotent cycles.
  return `sched-${isoDateInTz(now, tz)}`;
}

async function adminListUsers(): Promise<string[]> {
  // List top-level users/* documents (small app; paginate if it ever grows).
  const snap = await adminDb.collection('users').limit(500).get();
  return snap.docs.map((d) => d.id);
}
