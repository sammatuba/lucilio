import { Router, type Response, type NextFunction } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DeskPayload, TrustPayload } from '../../shared/schemas.js';
import { emptyBodySchema } from '../../shared/schemas.js';
import { listRateLimitUsage, protectedRoute, type AuthedRequest, type RouteDeps } from '../middleware.js';
import * as store from '../store.js';
import { MODEL_LADDER } from '../gemini.js';
import { PERSONA_VERSION } from '../personas/index.js';
import { ATLAS_PACK } from '../atlas/pack.js';
import { config } from '../env.js';

// ---- User-local date helpers (post day is Sunday in the USER's timezone) ----

export function datePartsInTz(date: Date, tz: string): { y: number; m: number; d: number; weekday: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      y: Number(get('year')),
      m: Number(get('month')),
      d: Number(get('day')),
      weekday: weekdays[get('weekday')] ?? 0,
    };
  } catch {
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), weekday: date.getUTCDay() };
  }
}

export function isoDateInTz(date: Date, tz: string): string {
  const p = datePartsInTz(date, tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function nextPostDay(tz: string, postWeekday = 0): string {
  const now = new Date();
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    if (datePartsInTz(d, tz).weekday === postWeekday) return isoDateInTz(d, tz);
  }
  return isoDateInTz(now, tz);
}

// ---- Desk ----

export function deskRouter(deps: RouteDeps): Router {
  const r = Router();

  r.get('/desk', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const profile = (await store.getProfile(uid)) ?? (await store.ensureProfile(uid, 'UTC'));
      const correspondents = await store.ensureCorrespondents(uid);
      const recent = await store.recentLetters(uid, 30);

      const waitingLetters = recent.filter((l) => l.status === 'sealed');
      const recentPerCid = new Map<string, (typeof recent)[number]>();
      for (const l of recent) if (!recentPerCid.has(l.cid)) recentPerCid.set(l.cid, l);

      const composing = (await store.composingCycles(uid)).map((c) => ({
        cycleId: c.id,
        kind: c.kind,
        startedAt: c.createdAt,
      }));

      const today = isoDateInTz(new Date(), profile.tz);
      const requestUsedToday: DeskPayload['requestUsedToday'] = {};
      for (const c of correspondents) {
        const todays = await store.requestedCyclesToday(uid, c.cid);
        // A failed request does not spend the day's budget: the Desk says the
        // letter did not come through and offers to ask again.
        requestUsedToday[c.cid] = todays.some(
          (cy) => cy.state !== 'failed' && isoDateInTz(new Date(cy.createdAt), profile.tz) === today,
        );
      }

      // Honest failure (roadmap M1-2): a correspondent whose letter did not
      // come through in the last week, unless they have written since.
      const undeliveredCutoff = Date.now() - 7 * 86_400_000;
      const undelivered: DeskPayload['undelivered'] = [];
      for (const cy of await store.recentCycles(uid, 12)) {
        if (cy.state === 'composing') continue;
        const at = cy.updatedAt ?? cy.createdAt;
        if (new Date(at).getTime() < undeliveredCutoff) continue;
        for (const cid of cy.degradedCids ?? []) {
          const superseded = recent.some((l) => l.cid === cid && l.createdAt > at);
          if (!superseded && !undelivered.some((u) => u.cid === cid)) {
            undelivered.push({ cycleId: cy.id, kind: cy.kind, cid, at });
          }
        }
      }

      const payload: DeskPayload = {
        profile: {
          tz: profile.tz,
          postDay: profile.postDay,
          onboarded: profile.onboarded,
          crisisNotice: profile.crisisNotice,
          reflectionPreferences: profile.reflectionPreferences,
          weeklyLetters: profile.weeklyLetters,
          displayName: profile.displayName,
        },
        correspondents,
        waitingLetters,
        recentLetters: [...recentPerCid.values()],
        composing,
        undelivered,
        nextPostDay: nextPostDay(profile.tz),
        requestUsedToday,
      };
      res.json(payload);
    } catch (e) {
      next(e);
    }
  });

  return r;
}

// ---- Trust Center ----

export function trustRouter(deps: RouteDeps): Router {
  const r = Router();

  r.get('/trust', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      let rulesResults: unknown = null;
      const resultsPath = resolve(process.cwd(), 'tests/results/rules-results.json');
      if (existsSync(resultsPath)) {
        try {
          rulesResults = JSON.parse(readFileSync(resultsPath, 'utf8'));
        } catch {
          rulesResults = null;
        }
      }
      // Prefer live-mode evidence (real Gemini compose + judge) over the
      // mock-mode harness artifact when both exist.
      let evalResults: unknown = null;
      for (const name of ['evals/results/eval-results.live.json', 'evals/results/eval-results.json']) {
        const p = resolve(process.cwd(), name);
        if (!existsSync(p)) continue;
        try {
          evalResults = JSON.parse(readFileSync(p, 'utf8'));
          break;
        } catch {
          evalResults = null;
        }
      }
      const correspondents = await store.listCorrespondents(uid);
      const memoryLog: TrustPayload['memoryLog'] = [];
      for (const c of correspondents) {
        const versions = await store.listMemoryVersions(uid, c.cid);
        memoryLog.push({
          cid: c.cid,
          versions: versions.map((v) => ({
            version: v.version,
            createdAt: v.createdAt,
            themes: v.themesObserved.length,
            openThreads: v.openThreads.length,
          })),
        });
      }
      const payload: TrustPayload = {
        rulesResults,
        evalResults,
        modelLadder: MODEL_LADDER,
        appCheckMode: config.useEmulators ? 'off (emulator)' : config.enforceAppCheck ? 'enforce' : 'monitor',
        memoryLog,
        rateLimits: listRateLimitUsage(uid),
        vaultLine:
          'Your writing is stored in Firebase. Content used for AI reflections is sent to Gemini through our server. This is not end-to-end encrypted against the service operator.',
        personasVersion: PERSONA_VERSION,
        atlasPack: {
          version: ATLAS_PACK.version,
          edition: ATLAS_PACK.edition.title,
          plateCount: ATLAS_PACK.plates.length,
          sourceCount: ATLAS_PACK.plates.reduce((sum, p) => sum + p.sources.length, 0),
          imagery: config.mapsApiKey
            ? 'Google Street View Static, proxied through the server (configured)'
            : 'typographic plates (no Street View key configured)',
        },
      };
      res.json(payload);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
