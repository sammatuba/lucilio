import { Router, type Response, type NextFunction } from 'express';
import { entryCreateSchema, profileUpdateSchema, type ReplyDoc } from '../../shared/schemas.js';
import { protectedRoute, type AuthedRequest, type RouteDeps } from '../middleware.js';
import * as store from '../store.js';
import { deps as pipelineDeps, newCycleDoc, runCycle } from '../pipeline.js';

// POST /api/notebook/entries — server-side entry creation (the client may also
// write directly via the SDK for offline persistence; both paths are owner-gated).
export function notebookRouter(deps: RouteDeps): Router {
  const r = Router();

  r.post(
    '/notebook/entries',
    protectedRoute(deps, entryCreateSchema),
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const uid = req.auth!.uid;
        const { bodyMd } = req.body;
        const entry = await store.addEntry(uid, bodyMd);
        res.status(201).json({ id: entry.id, createdAt: entry.createdAt });
      } catch (e) {
        next(e);
      }
    },
  );

  return r;
}

// POST /api/profile/onboard — called once after the first entry: ensures
// profile + correspondents exist, then starts the welcome cycle. Mounted on
// the compose tier: onboarding fires a 3-correspondent welcome cycle.
export function onboardRouter(deps: RouteDeps): Router {
  const r = Router();

  r.post(
    '/profile/onboard',
    protectedRoute(deps, profileUpdateSchema),
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        const uid = req.auth!.uid;
        const tz = req.body.tz || 'UTC';
        await store.ensureProfile(uid, tz);
        await store.ensureCorrespondents(uid);
        await store.updateProfile(uid, {
          onboarded: true,
          reflectionPreferences: req.body.reflectionPreferences,
          weeklyLetters: req.body.weeklyLetters,
        });
        if (req.body.welcomeLetters === false) {
          res.json({ ok: true, welcomeStarted: false });
          return;
        }
        const entries = await store.listEntries(uid, { limit: 1 });
        if (entries.length > 0) {
          // Claim the welcome cycle BEFORE responding (roadmap M1-1): the Desk's
          // very next fetch sees "composing", so the first thirty seconds read
          // as "your first letters are being written", never as an empty desk.
          const claim = await store.claimCycle(uid, newCycleDoc('welcome', 'welcome'));
          if (claim.status === 'delivered') {
            res.json({ ok: true, welcomeStarted: false, note: 'your welcome letters have already arrived' });
            return;
          }
          // Welcome cycle runs async (it resumes the claim); letters arrive on
          // the Desk when done.
          setImmediate(() => {
            runCycle(uid, { kind: 'welcome', cycleId: 'welcome' }).catch((e) =>
              // eslint-disable-next-line no-console
              console.error('[welcome-cycle] failed:', e),
            );
          });
          res.json({ ok: true, welcomeStarted: true });
        } else {
          res.json({ ok: true, welcomeStarted: false, note: 'write your first entry to begin the correspondence' });
        }
      } catch (e) {
        next(e);
      }
    },
  );

  return r;
}

export function profileRouter(deps: RouteDeps): Router {
  const r = Router();

  r.post(
    '/profile',
    protectedRoute(deps, profileUpdateSchema),
    async (req: AuthedRequest, res: Response, next: NextFunction) => {
      try {
        await store.updateProfile(req.auth!.uid, req.body);
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );

  return r;
}

// Reply intent extraction is async and fault-tolerant: a failed classification
// never blocks the saved reply (the reply itself is the durable artifact).
export async function ingestReply(uid: string, letterId: string, bodyMd: string): Promise<{ replyId: string }> {
  const letter = await store.getLetter(uid, letterId);
  if (!letter) throw Object.assign(new Error('letter not found'), { status: 404 });
  if (letter.reflection) throw Object.assign(new Error('Continue an entry reflection in your Notebook'), { status: 409 });
  if (letter.status === 'final') throw Object.assign(new Error('correspondence concluded'), { status: 409 });

  const replyId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const reply: ReplyDoc = {
    id: replyId,
    letterId,
    cid: letter.cid,
    bodyMd,
    intents: ['respond'],
    processed: false,
    createdAt: new Date().toISOString(),
  };
  await store.addReply(uid, reply);
  if (letter.status === 'sealed' || letter.status === 'opened') {
    await store.updateLetterStatus(uid, letterId, 'replied');
  }

  setImmediate(() => {
    (async () => {
      try {
        const d = pipelineDeps();
        const out = await d.extractIntents(reply);
        await store.addReply(uid, { ...reply, intents: out.intents, topics: out.topics });
        if (out.intents.includes('distress_flag')) {
          await store.updateProfile(uid, { crisisNotice: true });
        }
        if (out.intents.includes('conclude')) {
          await runCycle(uid, { kind: 'concluding', cycleId: `concl-${letter.cid}`, only: letter.cid });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[reply-intents] extraction failed (reply kept):', e);
      }
    })();
  });
  return { replyId };
}
