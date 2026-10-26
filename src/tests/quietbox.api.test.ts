import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { createQuietboxApiRouter } from '../server/app';
import { InMemoryQuietboxRepository } from '../server/repository';
import { InMemoryObjectStorage } from '../server/storage';
import { SlidingWindowRateLimiter } from '../server/rateLimit';

describe('Quietbox Complete End-to-End API & Security Suite', () => {
  let app: express.Express;
  let repository: InMemoryQuietboxRepository;
  let storage: InMemoryObjectStorage;

  const TOKENS: Record<string, { uid: string; email: string; emailVerified: boolean; displayName: string }> = {
    token_user_a: {
      uid: 'user_a_uid',
      email: 'alice@example.com',
      emailVerified: true,
      displayName: 'Alice',
    },
    token_user_b: {
      uid: 'user_b_uid',
      email: 'bob@example.com',
      emailVerified: true,
      displayName: 'Bob',
    },
  };

  let deletedAuthUids: string[] = [];

  async function generateValidPngBuffer(): Promise<Buffer> {
    return sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 109, g: 40, b: 217 },
      },
    })
      .png()
      .toBuffer();
  }

  beforeEach(() => {
    repository = new InMemoryQuietboxRepository();
    storage = new InMemoryObjectStorage();
    deletedAuthUids = [];

    app = express();
    app.use(express.json());
    app.use(
      '/api',
      createQuietboxApiRouter({
        repository,
        storage,
        maxUploadBytes: 1024 * 1024, // 1 MB test limit
        submissionLimiter: new SlidingWindowRateLimiter(60_000, 10),
        uploadLimiter: new SlidingWindowRateLimiter(60_000, 10),
        reportLimiter: new SlidingWindowRateLimiter(60_000, 5),
        verifyToken: async (token) => {
          const match = TOKENS[token];
          if (!match) {
            throw new Error('Invalid token');
          }
          return match;
        },
        deleteAuthAccount: async (uid) => {
          deletedAuthUids.push(uid);
        },
      })
    );
  });

  it('rejects unauthenticated requests to private dashboard and inbox endpoints', async () => {
    const meRes = await request(app).get('/api/me');
    expect(meRes.status).toBe(401);

    const inboxRes = await request(app).get('/api/me/messages');
    expect(inboxRes.status).toBe(401);
  });

  it('creates an anonymous page, enforces unique usernames, and exposes public route without private email', async () => {
    // User A creates page /u/alicebox
    const createRes = await request(app)
      .post('/api/me/page')
      .set('Authorization', 'Bearer token_user_a')
      .field('pageName', 'Alice Quietbox')
      .field('username', 'alicebox')
      .field('description', 'Send candid thoughts');

    expect(createRes.status).toBe(200);
    expect(createRes.body.page.username).toBe('alicebox');

    // User B tries to claim the exact same username -> 409 Conflict
    const dupRes = await request(app)
      .post('/api/me/page')
      .set('Authorization', 'Bearer token_user_b')
      .field('pageName', 'Imposter Box')
      .field('username', 'alicebox')
      .field('description', 'Trying to take alicebox');

    expect(dupRes.status).toBe(409);

    // Availability endpoint reports unavailable for User B, available for owner User A
    const checkOther = await request(app)
      .get('/api/pages/check-username?username=alicebox')
      .set('Authorization', 'Bearer token_user_b');
    expect(checkOther.body.available).toBe(false);

    const checkOwner = await request(app)
      .get('/api/pages/check-username?username=alicebox')
      .set('Authorization', 'Bearer token_user_a');
    expect(checkOwner.body.available).toBe(true);

    // Public visitor fetches /u/alicebox (no auth token, works across browsers/devices)
    const pubRes = await request(app).get('/api/public/pages/alicebox');
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.page.pageName).toBe('Alice Quietbox');
    expect(pubRes.body.page.email).toBeUndefined();
    expect(pubRes.body.page.ownerId).toBeUndefined();
  });

  it('guarantees strict inbox isolation: User A cannot view, mark read, or delete User B messages or attachments', async () => {
    // User B creates page /u/bobnotes
    await request(app)
      .post('/api/me/page')
      .set('Authorization', 'Bearer token_user_b')
      .field('pageName', 'Bob Notes')
      .field('username', 'bobnotes')
      .field('description', '');

    // Anonymous visitor submits text + valid PNG image to /u/bobnotes
    const pngBuffer = await generateValidPngBuffer();
    const submitRes = await request(app)
      .post('/api/public/pages/bobnotes/messages')
      .field('messageText', 'Secret message strictly for Bob')
      .attach('image', pngBuffer, { filename: 'photo.png', contentType: 'image/png' });

    expect(submitRes.status).toBe(201);
    // Sender response never leaks internal message ID or storage path
    expect(submitRes.body.id).toBeUndefined();

    // User B fetches their private inbox -> sees 1 unread message + signed attachment URL
    const bobInbox = await request(app)
      .get('/api/me/messages')
      .set('Authorization', 'Bearer token_user_b');

    expect(bobInbox.status).toBe(200);
    expect(bobInbox.body.messages).toHaveLength(1);
    expect(bobInbox.body.unreadCount).toBe(1);
    const bobMsg = bobInbox.body.messages[0];
    expect(bobMsg.messageText).toBe('Secret message strictly for Bob');
    expect(bobMsg.hasImage).toBe(true);
    expect(bobMsg.signedImageUrl).toMatch(/^\/api\/media\/signed\//);

    // User A fetches their inbox -> completely empty (0 messages)
    const aliceInbox = await request(app)
      .get('/api/me/messages')
      .set('Authorization', 'Bearer token_user_a');

    expect(aliceInbox.status).toBe(200);
    expect(aliceInbox.body.messages).toHaveLength(0);

    // User A attempts to request User B's attachment signed URL by guessing/knowing messageId -> 404
    const hijackAttachment = await request(app)
      .get(`/api/me/messages/${bobMsg.id}/attachment-url`)
      .set('Authorization', 'Bearer token_user_a');
    expect(hijackAttachment.status).toBe(404);

    // User A attempts to delete User B's message -> 404, message remains intact in Bob's inbox
    const hijackDelete = await request(app)
      .delete(`/api/me/messages/${bobMsg.id}`)
      .set('Authorization', 'Bearer token_user_a');
    expect(hijackDelete.status).toBe(404);

    // Anonymous sender attempts to read messages without auth -> 401
    const anonScrape = await request(app).get('/api/me/messages');
    expect(anonScrape.status).toBe(401);

    // Bob's signed attachment URL serves clean re-encoded WebP bytes
    const mediaRes = await request(app).get(bobMsg.signedImageUrl);
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers['content-type']).toContain('image/webp');
  });

  it('rejects submissions when page is disabled or allowSubmissions is paused', async () => {
    await request(app)
      .post('/api/me/page')
      .set('Authorization', 'Bearer token_user_a')
      .field('pageName', 'Alice Box')
      .field('username', 'alicepaused')
      .field('description', '')
      .field('isActive', 'true')
      .field('allowSubmissions', 'false');

    const pausedAttempt = await request(app)
      .post('/api/public/pages/alicepaused/messages')
      .field('messageText', 'Trying while paused');
    expect(pausedAttempt.status).toBe(403);

    // Disable entire page
    await request(app)
      .post('/api/me/page')
      .set('Authorization', 'Bearer token_user_a')
      .field('pageName', 'Alice Box')
      .field('username', 'alicepaused')
      .field('description', '')
      .field('isActive', 'false')
      .field('allowSubmissions', 'false');

    const disabledView = await request(app).get('/api/public/pages/alicepaused');
    expect(disabledView.status).toBe(404);

    const disabledAttempt = await request(app)
      .post('/api/public/pages/alicepaused/messages')
      .field('messageText', 'Trying while disabled');
    expect(disabledAttempt.status).toBe(404);
  });

  it('rejects disguised executable files and oversized uploads on the server', async () => {
    await request(app)
      .post('/api/me/page')
      .set('Authorization', 'Bearer token_user_a')
      .field('pageName', 'Alice Box')
      .field('username', 'alicesecure')
      .field('description', '');

    // 1. Executable / script disguised with image/png Content-Type and .png filename
    const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00<!DOCTYPE html><script>alert(1)</script>');
    const disguisedRes = await request(app)
      .post('/api/public/pages/alicesecure/messages')
      .field('messageText', 'Malicious payload')
      .attach('image', fakeExeBuffer, { filename: 'exploit.png', contentType: 'image/png' });

    expect(disguisedRes.status).toBe(415);

    // 2. Oversized upload (> 1 MB configured test limit)
    const oversizedBuffer = Buffer.alloc(1024 * 1024 + 50_000, 0xff);
    const oversizedRes = await request(app)
      .post('/api/public/pages/alicesecure/messages')
      .field('messageText', 'Huge file')
      .attach('image', oversizedBuffer, { filename: 'huge.jpg', contentType: 'image/jpeg' });

    expect(oversizedRes.status).toBe(413);
  });

  it('deletes message and purges underlying private storage attachment, and supports full account deletion', async () => {
    await request(app)
      .post('/api/me/page')
      .set('Authorization', 'Bearer token_user_a')
      .field('pageName', 'Alice Box')
      .field('username', 'alicedel')
      .field('description', '');

    const pngBuffer = await generateValidPngBuffer();
    await request(app)
      .post('/api/public/pages/alicedel/messages')
      .attach('image', pngBuffer, { filename: 'onlyimage.png', contentType: 'image/png' });

    const inboxBefore = await request(app)
      .get('/api/me/messages')
      .set('Authorization', 'Bearer token_user_a');
    expect(inboxBefore.body.messages).toHaveLength(1);
    const msg = inboxBefore.body.messages[0];

    // Delete message
    const delRes = await request(app)
      .delete(`/api/me/messages/${msg.id}`)
      .set('Authorization', 'Bearer token_user_a');
    expect(delRes.status).toBe(200);

    // Signed URL now returns 404 because storage object was deleted
    const afterMediaRes = await request(app).get(msg.signedImageUrl);
    expect(afterMediaRes.status).toBe(404);

    // Delete entire account with confirmation
    const accDelRes = await request(app)
      .delete('/api/me/account')
      .set('Authorization', 'Bearer token_user_a')
      .send({ confirmText: 'DELETE' });
    expect(accDelRes.status).toBe(200);
    expect(deletedAuthUids).toContain('user_a_uid');

    // Username is freed and public page returns 404
    const pubAfter = await request(app).get('/api/public/pages/alicedel');
    expect(pubAfter.status).toBe(404);
  });
});
