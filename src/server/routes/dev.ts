// DEV-ONLY sign-in for emulator testing. Mounted ONLY when FIREBASE_EMULATORS
// is on, so it never exists in a production build. It mints a custom token for
// a named demo user — the federated Google flow is the only real sign-in.
import { Router, type NextFunction, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { config } from '../env.js';
import { adminAuth } from '../firebase.js';

export function devRouter(): Router | null {
  if (!config.useEmulators) return null;
  const r = Router();

  r.post('/dev/signin', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = String(req.body?.name ?? 'Demo Reader').slice(0, 60);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.') || 'demo.reader';
      const email = `${slug}@lucilio.emulator.local`;
      let uid: string;
      try {
        uid = (await adminAuth.getUserByEmail(email)).uid;
      } catch {
        uid = (await adminAuth.createUser({ email, displayName: name, uid: `demo-${randomBytes(4).toString('hex')}` })).uid;
      }
      const customToken = await adminAuth.createCustomToken(uid, { demo: true });
      res.json({ customToken, uid, displayName: name });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
