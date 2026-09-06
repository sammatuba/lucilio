import { Router, type Response, type NextFunction } from 'express';
import {
  emptyBodySchema,
  replyCreateSchema,
  requestLetterSchema,
  type LetterBundle,
  type LetterDoc,
  type ReplyDoc,
  type VolumeLetter,
} from '../../shared/schemas.js';
import { protectedRoute, type AuthedRequest, type RouteDeps } from '../middleware.js';
import * as store from '../store.js';
import { newCycleDoc, runCycle } from '../pipeline.js';
import { ingestReply } from './user.js';
import { isoDateInTz } from './desk.js';

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

function param(v: string | string[] | undefined): string {
  return Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
}

export function lettersRouter(deps: RouteDeps): Router {
  const r = Router();

  // GET /api/letters/:id — full bundle: letter, replies, cited entries.
  r.get('/letters/:id', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const letter = await store.getLetter(uid, param(req.params.id));
      if (!letter) throw httpError(404, 'letter not found');
      const replies = await store.repliesForLetter(uid, letter.id);
      const sourceEntries = await store.getEntriesByIds(
        uid,
        letter.groundingRefs.filter((g) => g.entryId).map((g) => g.entryId!),
      );
      const sourceReplies = await store.getRepliesByIds(
        uid,
        letter.groundingRefs.filter((g) => g.replyId).map((g) => g.replyId!),
      );
      const correspondent = await store.getCorrespondent(uid, letter.cid);
      const bundle: LetterBundle = {
        ...letter,
        replies,
        sourceEntries,
        sourceReplies,
        correspondent: { cid: letter.cid, status: correspondent?.status ?? 'active' },
      };
      res.json(bundle);
    } catch (e) {
      next(e);
    }
  });

  // POST /api/letters/:id/open — sealed → opened (persists).
  r.post('/letters/:id/open', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const letter = await store.getLetter(uid, param(req.params.id));
      if (!letter) throw httpError(404, 'letter not found');
      if (letter.status === 'sealed') await store.updateLetterStatus(uid, letter.id, 'opened');
      res.json({ ok: true, status: letter.status === 'sealed' ? 'opened' : letter.status });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

// POST /api/letters/:id/reply — save reply; intents extracted async. Mounted
// on the compose tier: a reply triggers model work (intent extraction, and
// possibly a concluding cycle), so it must not ride the general read limit.
export function replyRouter(deps: RouteDeps): Router {
  const r = Router();
  r.post('/letters/:id/reply', protectedRoute(deps, replyCreateSchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const { replyId } = await ingestReply(uid, param(req.params.id), req.body.bodyMd);
      res.status(201).json({ replyId });
    } catch (e) {
      next(e);
    }
  });
  return r;
}

// POST /api/letters/request — on-demand letter, 1/day/correspondent.
// Mounted with the stricter compose-tier rate limit; reads stay on the normal
// tier so browsing letters can never 429 a user.
export function requestLetterRouter(deps: RouteDeps): Router {
  const r = Router();
  r.post('/letters/request', protectedRoute(deps, requestLetterSchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const cid = req.body.cid;
      const correspondent = await store.getCorrespondent(uid, cid);
      if (!correspondent) throw httpError(404, 'correspondent not found');
      if (correspondent.status === 'concluded') throw httpError(409, 'this correspondence has concluded');

      const profile = await store.getProfile(uid);
      const tz = profile?.tz ?? 'UTC';
      const today = isoDateInTz(new Date(), tz);
      const cycleId = `req-${cid}-${today}`;
      const entries = await store.listEntries(uid, { limit: 1 });
      if (entries.length === 0) throw httpError(400, 'write a notebook entry first — your correspondent needs something to read');

      // Claim the day's cycle id atomically (one transaction) BEFORE the 202:
      // concurrent duplicate requests yield one cycle and one letter, and the
      // Desk sees "composing" on its very next fetch. A cycle whose letter did
      // not come through may be asked for again — the Desk said so honestly.
      const claim = await store.claimCycle(uid, newCycleDoc(cycleId, 'requested'));
      if (claim.status === 'composing') throw httpError(409, 'your correspondent is already reading — the letter is on its way');
      if (claim.status === 'delivered') throw httpError(429, 'one requested letter per correspondent per day');

      setImmediate(() => {
        runCycle(uid, { kind: 'requested', cycleId, only: cid }).catch((e) =>
          // eslint-disable-next-line no-console
          console.error(`[requested-cycle] ${cid} failed:`, e),
        );
      });
      res.status(202).json({ ok: true, cycleId, note: 'your correspondent is reading your notebook' });
    } catch (e) {
      next(e);
    }
  });
  return r;
}

// GET  /api/correspondents/:cid/thread — the full volume (letters + replies).
export function correspondentsRouter(deps: RouteDeps): Router {
  const r = Router();

  r.get('/correspondents/:cid/thread', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const cid = param(req.params.cid) as 'director' | 'future_self' | 'foreign';
      if (!['director', 'future_self', 'foreign'].includes(cid)) throw httpError(404, 'correspondent not found');
      const correspondent = await store.getCorrespondent(uid, cid);
      if (!correspondent) throw httpError(404, 'correspondent not found');
      // Reflections share the legacy Director cid for URL compatibility, but
      // are archived separately from the correspondence volume.
      const letters = await store.lettersByCid(uid, cid, 60, true);
      const withReplies = await Promise.all(
        letters.map(async (l) => volumeLetter({ ...l, replies: await store.repliesForLetter(uid, l.id) })),
      );
      res.json({ correspondent, letters: withReplies });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

// Roadmap M2-7: a still-sealed letter's text does not travel with the volume —
// the Study shows the seal, not the words. The text is revealed exactly once,
// at the unseal moment on the letter page.
function volumeLetter(l: LetterDoc & { replies: ReplyDoc[] }): VolumeLetter {
  if (l.status !== 'sealed') return { ...l, replies: l.replies };
  const { bodyMd, salutation, groundingRefs, extrapolationNote, exercise, ...rest } = l;
  return rest;
}

// POST /api/correspondents/:cid/conclude — the conclusion ritual (compose-tier).
export function concludeRouter(deps: RouteDeps): Router {
  const r = Router();
  r.post('/correspondents/:cid/conclude', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const cid = param(req.params.cid) as 'director' | 'future_self' | 'foreign';
      if (!['director', 'future_self', 'foreign'].includes(cid)) throw httpError(404, 'correspondent not found');
      const correspondent = await store.getCorrespondent(uid, cid);
      if (!correspondent) throw httpError(404, 'correspondent not found');
      if (correspondent.status === 'concluded') throw httpError(409, 'already concluded');

      // Claim synchronously so the Desk shows the final letter being written
      // at once; a double-click cannot start two concluding cycles.
      const claim = await store.claimCycle(uid, newCycleDoc(`concl-${cid}`, 'concluding'));
      if (claim.status === 'delivered') throw httpError(409, 'already concluded');
      if (claim.status === 'composing') {
        res.status(202).json({ ok: true, note: 'your correspondent is already writing a final letter' });
        return;
      }

      setImmediate(() => {
        runCycle(uid, { kind: 'concluding', cycleId: `concl-${cid}`, only: cid }).catch((e) =>
          // eslint-disable-next-line no-console
          console.error(`[concluding-cycle] ${cid} failed:`, e),
        );
      });
      res.status(202).json({ ok: true, note: 'your correspondent is writing a final letter' });
    } catch (e) {
      next(e);
    }
  });
  return r;
}
