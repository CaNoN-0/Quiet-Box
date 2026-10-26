import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { adminAuth } from './src/server/firebaseAdmin.ts';
import { FirestoreQuietboxRepository } from './src/server/repository.ts';
import { HybridCloudObjectStorage } from './src/server/storage.ts';
import { createQuietboxApiRouter } from './src/server/app.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  const repository = new FirestoreQuietboxRepository();
  const storage = new HybridCloudObjectStorage();

  const apiRouter = createQuietboxApiRouter({
    repository,
    storage,
    verifyToken: async (bearerToken: string) => {
      const decoded = await adminAuth.verifyIdToken(bearerToken);
      return {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: Boolean(decoded.email_verified),
        displayName: decoded.name,
      };
    },
    deleteAuthAccount: async (uid: string) => {
      try {
        await adminAuth.deleteUser(uid);
      } catch (err) {
        console.warn('Firebase Auth user record already removed or managed externally:', err);
      }
    },
  });

  app.use('/api', apiRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quietbox server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Quietbox startup error:', err);
  process.exit(1);
});
