import { Router, type Response, type NextFunction } from 'express';
import { emptyBodySchema } from '../../shared/schemas.js';
import { protectedRoute, type AuthedRequest, type RouteDeps } from '../middleware.js';
import * as store from '../store.js';
import { adminAuth, adminDb } from '../firebase.js';

// GET /api/export — the user's entire subtree as one JSON download.
// DELETE /api/account — cascade delete of all data + the auth record.
export function accountRouter(deps: RouteDeps): Router {
  const r = Router();

  r.get('/export', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const data = await store.exportSubtree(uid);
      const exportId = `exp-${Date.now().toString(36)}`;
      await adminDb.doc(`users/${uid}/exports/${exportId}`).set({
        createdAt: new Date().toISOString(),
        collections: Object.keys(data),
      });
      res
        .setHeader('Content-Disposition', `attachment; filename="lucilio-export-${new Date().toISOString().slice(0, 10)}.json"`)
        .json(data);
    } catch (e) {
      next(e);
    }
  });

  r.delete('/account', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      await store.cascadeDelete(uid);
      let authDeleted = true;
      try {
        await adminAuth.deleteUser(uid);
      } catch (e) {
        // Auth record deletion is best-effort (emulators may lag); data is gone.
        authDeleted = false;
        console.warn(`[account] auth deletion failed for ${uid}:`, e);
      }
      res.json({ ok: true, deleted: true, authDeleted });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
