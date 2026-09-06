import { Router, type NextFunction, type Response } from 'express';
import { createHash } from 'node:crypto';
import { DEFAULT_REFLECTION_PREFERENCES, emptyBodySchema, reflectionPreferencesSchema, reflectionRequestSchema } from '../../shared/schemas.js';
import { protectedRoute, type AuthedRequest, type RouteDeps } from '../middleware.js';
import * as store from '../store.js';
import { newCycleDoc, runCycle } from '../pipeline.js';

export function reflectionSettingsRouter(deps: RouteDeps): Router {
  const r = Router();
  r.get('/reflections/:id', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      if (!/^reflection-[a-f0-9]{24}$/.test(id)) { res.status(404).json({ error: 'Reflection not found' }); return; }
      const cycle = await store.getCycle(req.auth!.uid, id);
      if (!cycle?.reflection) { res.status(404).json({ error: 'Reflection not found' }); return; }
      res.json({ state: cycle.state, cycleId: id, ...(cycle.state === 'delivered' ? { letterId: `${id}-director` } : {}) });
    } catch (e) { next(e); }
  });
  r.get('/reflection-preferences', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const profile = await store.getProfile(req.auth!.uid);
      const parsed = reflectionPreferencesSchema.safeParse(profile?.reflectionPreferences);
      res.json({ preferences: parsed.success ? parsed.data : DEFAULT_REFLECTION_PREFERENCES, weeklyLetters: profile?.weeklyLetters ?? true });
    } catch (e) { next(e); }
  });
  return r;
}

export function reflectionsRouter(deps: RouteDeps): Router {
  const r = Router();
  r.post('/reflections', protectedRoute(deps, reflectionRequestSchema), async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const uid = req.auth!.uid;
      const selection = reflectionRequestSchema.parse(req.body);
      const entries = await store.getEntriesByIds(uid, [selection.entryId]);
      if (entries.length !== 1) { res.status(404).json({ error: 'This entry is not available yet. Wait for it to sync, then try again.' }); return; }
      // Same entry and settings resolve to the same reflection, including
      // retries after network failure. Settings are persisted for recovery.
      const digest = createHash('sha256').update(JSON.stringify(selection)).digest('hex').slice(0, 24);
      const cycleId = `reflection-${digest}`;
      const letterId = `${cycleId}-director`;
      const claim = await store.claimCycle(uid, { ...newCycleDoc(cycleId, 'requested'), reflection: selection });
      if (claim.status === 'delivered') { res.json({ state: 'delivered', letterId }); return; }
      if (claim.status === 'composing') { res.status(202).json({ state: 'composing', cycleId }); return; }
      // Keep the HTTP request active during generation: this path does not
      // depend on CPU remaining available after sending a response.
      const result = await runCycle(uid, { kind: 'requested', cycleId, only: 'director' });
      if (!result.delivered.includes('director')) {
        res.status(503).json({ error: 'The reflection could not be completed. Your entry is saved; you can try again.' }); return;
      }
      res.json({ state: 'delivered', letterId });
    } catch (e) { next(e); }
  });
  return r;
}
