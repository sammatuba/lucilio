// Lucilio unified server: static client build + /api + /internal on one port.
// One deploy, one service account, one label (spec §3).
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import helmet from 'helmet';
import { loadEnvLocal, config } from './env.js';
import { adminAuthVerifier, appCheckVerifier } from './firebase.js';
import type { RouteDeps } from './middleware.js';
import { notebookRouter, onboardRouter, profileRouter } from './routes/user.js';
import { deskRouter, trustRouter } from './routes/desk.js';
import { correspondentsRouter, concludeRouter, lettersRouter, replyRouter, requestLetterRouter } from './routes/letters.js';
import { accountRouter } from './routes/account.js';
import { internalRouter } from './routes/internal.js';
import { devRouter } from './routes/dev.js';
import { reflectionSettingsRouter, reflectionsRouter } from './routes/reflections.js';
import { atlasRouter } from './routes/atlas.js';

loadEnvLocal();

const deps: RouteDeps = {
  auth: adminAuthVerifier,
  appCheck: appCheckVerifier,
  enforceAppCheck: config.enforceAppCheck,
  rateLimit: { windowMs: 60_000, max: 60, scope: 'api (per minute)' },
};

const composeDeps: RouteDeps = {
  ...deps,
  rateLimit: { windowMs: 60_000, max: 6, scope: 'compose endpoints (per minute)' },
};

export function buildApp(): express.Express {
  const app = express();

  // Security headers. Full CSP in production; skipped in emulator dev because
  // the Vite dev server needs websocket + inline eval.
  app.use(
    helmet({
      contentSecurityPolicy:
        config.useEmulators === false
          ? {
              useDefaults: true,
              directives: {
                'default-src': ["'self'"],
                'script-src': ["'self'", 'https://apis.google.com', 'https://accounts.google.com', 'https://www.gstatic.com'],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'blob:', 'data:', 'https://lh3.googleusercontent.com', 'https://www.gstatic.com'],
                'connect-src': [
                  "'self'",
                  'https://*.googleapis.com',
                  'https://*.firebaseio.com',
                  'wss://*.firebaseio.com',
                  'https://*.firebaseapp.com',
                  'https://firebaseinstallations.googleapis.com',
                  'https://firebaselogging.googleapis.com',
                ],
                'frame-src': ["'self'", 'https://accounts.google.com', 'https://*.firebaseapp.com', 'https://content-identitytoolkit.googleapis.com'],
                'object-src': ["'none'"],
                'base-uri': ["'self'"],
                'frame-ancestors': ["'none'"],
              },
            }
          : false,
    }),
  );

  // Body parsing is mounted BEFORE any route (constitution).
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'lucilio', release: process.env.RELEASE_ID ?? 'local', mockGemini: config.mockGemini, time: new Date().toISOString() });
  });

  app.use('/api', notebookRouter(deps));
  app.use('/api', profileRouter(deps));
  app.use('/api', deskRouter(deps));
  app.use('/api', trustRouter(deps));
  // Compose-tier limits apply to every endpoint that triggers model calls
  // (request, reply, conclude, onboard); reads stay on the normal tier.
  app.use('/api', lettersRouter(deps));
  app.use('/api', replyRouter(composeDeps));
  app.use('/api', requestLetterRouter(composeDeps));
  app.use('/api', onboardRouter(composeDeps));
  app.use('/api', correspondentsRouter(deps));
  app.use('/api', concludeRouter(composeDeps));
  app.use('/api', accountRouter(deps));
  app.use('/api', reflectionSettingsRouter(deps));
  app.use('/api', reflectionsRouter(composeDeps));
  app.use('/api', atlasRouter(deps));

  const dev = devRouter();
  if (dev) app.use(dev);

  app.use('/internal', internalRouter());

  // Clean JSON errors for malformed payloads and unknown API paths — never a crash.
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!err) {
      next();
      return;
    }
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = (err as { status?: number }).status;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    const type = (err as { type?: string }).type;
    if (type === 'entity.parse.failed' || type === 'entity.too.large') {
      res.status(400).json({ error: type === 'entity.too.large' ? 'payload too large' : 'malformed JSON' });
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[unhandled]', err);
    res.status(500).json({ error: 'internal error' });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));
  app.use('/internal', (_req, res) => res.status(404).json({ error: 'not found' }));

  // Static client build + SPA fallback (Express 5: middleware, not a '*' route).
  // index.html must never be cached: each deploy orphans the previous asset
  // hashes, so a stale HTML points at files the new revision no longer serves.
  const clientDist = resolve(process.cwd(), 'dist/client');
  if (existsSync(resolve(clientDist, 'index.html'))) {
    app.use(
      express.static(clientDist, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
          else if (filePath.includes(`${sep}assets${sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          // Brand assets are meant to be embedded elsewhere (the blog, social
          // previews). Helmet's default CORP of same-origin makes browsers
          // block them cross-site; relax it for these public files only.
          if (/[\\/](social-banner\.jpg|lockup\.svg|mark\.svg|primary-mark\.jpg|wordmark\.jpg|lockup-mark-wordmark\.jpg)$/.test(filePath)) {
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/internal/')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(resolve(clientDist, 'index.html'));
    });
  }

  return app;
}

const isDirectRun = process.env.VITEST === undefined;
if (isDirectRun) {
  const app = buildApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[lucilio] server on http://localhost:${config.port} (mockGemini=${config.mockGemini}, emulators=${config.useEmulators})`);
  });
}
