import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  LIMITS,
  normalizeUsername,
  sanitizeText,
  validateUsername,
  VALID_ID_REGEX,
} from '../shared/validation.ts';
import {
  ImageValidationError,
  validateAndReencodeImage,
} from './imageSecurity.ts';
import {
  createRateLimitMiddleware,
  SlidingWindowRateLimiter,
} from './rateLimit.ts';
import {
  DuplicateUsernameError,
  QuietboxRepository,
} from './repository.ts';
import {
  ObjectStorageService,
  verifySignedLocalToken,
} from './storage.ts';

export interface VerifiedCaller {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}

export type TokenVerifier = (bearerToken: string) => Promise<VerifiedCaller>;
export type AuthAccountDeleter = (uid: string) => Promise<void>;

export interface CreateApiAppOptions {
  repository: QuietboxRepository;
  storage: ObjectStorageService;
  verifyToken: TokenVerifier;
  deleteAuthAccount: AuthAccountDeleter;
  maxUploadBytes?: number;
  submissionLimiter?: SlidingWindowRateLimiter;
  uploadLimiter?: SlidingWindowRateLimiter;
  reportLimiter?: SlidingWindowRateLimiter;
}

interface AuthenticatedRequest extends Request {
  caller?: VerifiedCaller;
}

export function createQuietboxApiRouter(options: CreateApiAppOptions): express.Router {
  const router = express.Router();
  const maxUploadMb = Number(process.env.MAX_UPLOAD_SIZE_MB || '5');
  const maxUploadBytes =
    options.maxUploadBytes ?? Math.max(1, Math.min(15, maxUploadMb)) * 1024 * 1024;

  const submissionLimiter =
    options.submissionLimiter ?? new SlidingWindowRateLimiter(10 * 60 * 1000, 12);
  const uploadLimiter =
    options.uploadLimiter ?? new SlidingWindowRateLimiter(10 * 60 * 1000, 10);
  const reportLimiter =
    options.reportLimiter ?? new SlidingWindowRateLimiter(15 * 60 * 1000, 6);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxUploadBytes,
      files: 1,
      fields: 8,
    },
  });

  // Security headers for API responses
  router.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Missing session token.' });
      return;
    }

    try {
      const caller = await options.verifyToken(token);
      req.caller = caller;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }
  };

  const singleUploadMiddleware = (fieldName: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      upload.single(fieldName)(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const mb = Math.round((maxUploadBytes / (1024 * 1024)) * 10) / 10;
            res.status(413).json({ error: `Uploaded image exceeds the ${mb} MB maximum size limit.` });
            return;
          }
          res.status(400).json({ error: 'Invalid multipart upload payload.' });
          return;
        }
        if (err) {
          res.status(400).json({ error: 'Unable to parse uploaded file.' });
          return;
        }
        next();
      });
    };
  };

  function resolveAvatarPublicUrl(avatarPath: string): string {
    if (!avatarPath) return '';
    if (avatarPath.startsWith('/src/assets/') || avatarPath.startsWith('https://')) {
      return avatarPath;
    }
    return `/api/public/avatars/${encodeURIComponent(avatarPath)}`;
  }

  // ===========================================================================
  // 1. Authenticated Account & Profile Routes
  // ===========================================================================
  router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const caller = req.caller!;
      const fallbackName = caller.displayName || caller.email?.split('@')[0] || 'Quietbox Member';
      const profile = await options.repository.getOrCreateProfile(
        caller.uid,
        sanitizeText(fallbackName, LIMITS.DISPLAY_NAME_MAX) || 'Quietbox Member'
      );
      const page = await options.repository.getPageByOwner(caller.uid);

      res.json({
        profile: {
          id: profile.id,
          displayName: profile.displayName,
          avatarUrl: resolveAvatarPublicUrl(profile.avatarUrl),
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
          emailVerified: caller.emailVerified,
        },
        page: page
          ? {
              id: page.id,
              pageName: page.pageName,
              username: page.username,
              description: page.description,
              avatarUrl: resolveAvatarPublicUrl(page.avatarPath),
              isActive: page.isActive,
              allowSubmissions: page.allowSubmissions,
              createdAt: page.createdAt,
              updatedAt: page.updatedAt,
            }
          : null,
      });
    } catch (err) {
      console.error('GET /api/me error:', err);
      res.status(500).json({ error: 'Unable to load your account profile right now.' });
    }
  });

  router.patch('/me/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const caller = req.caller!;
      const displayName = sanitizeText(req.body?.displayName, LIMITS.DISPLAY_NAME_MAX);
      if (!displayName) {
        res.status(400).json({ error: 'Display name cannot be empty.' });
        return;
      }
      const updated = await options.repository.updateProfile(caller.uid, { displayName });
      res.json({
        profile: {
          id: updated.id,
          displayName: updated.displayName,
          avatarUrl: resolveAvatarPublicUrl(updated.avatarUrl),
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (err) {
      console.error('PATCH /api/me/profile error:', err);
      res.status(500).json({ error: 'Unable to update profile settings.' });
    }
  });

  router.delete('/me/account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const caller = req.caller!;
      if (req.body?.confirmText !== 'DELETE') {
        res.status(400).json({ error: 'Please type DELETE to confirm permanent account deletion.' });
        return;
      }

      const { storagePathsToDelete } = await options.repository.deleteAllUserData(caller.uid);
      await Promise.allSettled(
        storagePathsToDelete.map((objectKey) => options.storage.deleteObject(objectKey))
      );
      await options.deleteAuthAccount(caller.uid);

      res.json({ deleted: true });
    } catch (err) {
      console.error('DELETE /api/me/account error:', err);
      res.status(500).json({ error: 'Unable to complete account deletion. Please try again.' });
    }
  });

  // ===========================================================================
  // 2. Username Availability & Anonymous Page Management
  // ===========================================================================
  router.get('/pages/check-username', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const raw = typeof req.query.username === 'string' ? req.query.username : '';
      const validation = validateUsername(raw);
      if (!validation.valid) {
        res.json({
          available: false,
          normalized: validation.normalized,
          reason: validation.error,
        });
        return;
      }

      // Optionally exclude current user's own username if authenticated
      let callerUid: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const verified = await options.verifyToken(authHeader.slice(7).trim());
          callerUid = verified.uid;
        } catch {
          // Ignore invalid optional token on availability check
        }
      }

      const available = await options.repository.isUsernameAvailable(
        validation.normalized,
        callerUid
      );
      res.json({
        available,
        normalized: validation.normalized,
        reason: available ? undefined : 'That username is already taken.',
      });
    } catch (err) {
      console.error('GET /api/pages/check-username error:', err);
      res.status(500).json({ error: 'Unable to check username availability right now.' });
    }
  });

  router.post(
    '/me/page',
    requireAuth,
    createRateLimitMiddleware(uploadLimiter, 'Too many page updates. Please wait a moment.'),
    singleUploadMiddleware('avatar'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const caller = req.caller!;
        const pageName = sanitizeText(req.body?.pageName, LIMITS.PAGE_NAME_MAX);
        const description = sanitizeText(req.body?.description, LIMITS.DESCRIPTION_MAX);
        const usernameValidation = validateUsername(String(req.body?.username || ''));

        if (!pageName) {
          res.status(400).json({ error: 'Page name is required.' });
          return;
        }

        if (!usernameValidation.valid) {
          res.status(400).json({ error: usernameValidation.error });
          return;
        }

        const isActive =
          req.body?.isActive !== undefined
            ? String(req.body.isActive) === 'true'
            : undefined;
        const allowSubmissions =
          req.body?.allowSubmissions !== undefined
            ? String(req.body.allowSubmissions) === 'true'
            : undefined;
        const removeAvatar = String(req.body?.removeAvatar || 'false') === 'true';

        let uploadedAvatarKey: string | undefined;
        if (req.file) {
          const processed = await validateAndReencodeImage(req.file.buffer, {
            maxBytes: Math.min(maxUploadBytes, 3 * 1024 * 1024),
            maxDimension: LIMITS.AVATAR_MAX_DIMENSIONS,
            prefix: 'avatars',
          });
          await options.storage.putObject(
            processed.randomObjectKey,
            processed.buffer,
            processed.mimeType
          );
          uploadedAvatarKey = processed.randomObjectKey;
        } else if (removeAvatar) {
          uploadedAvatarKey = '';
        }

        await options.repository.getOrCreateProfile(caller.uid, pageName);

        const { page, previousAvatarPath } = await options.repository.upsertPage(caller.uid, {
          pageName,
          username: usernameValidation.normalized,
          description,
          avatarPath: uploadedAvatarKey,
          isActive,
          allowSubmissions,
        });

        if (previousAvatarPath) {
          await options.storage.deleteObject(previousAvatarPath);
        }

        res.json({
          page: {
            id: page.id,
            pageName: page.pageName,
            username: page.username,
            description: page.description,
            avatarUrl: resolveAvatarPublicUrl(page.avatarPath),
            isActive: page.isActive,
            allowSubmissions: page.allowSubmissions,
            createdAt: page.createdAt,
            updatedAt: page.updatedAt,
          },
        });
      } catch (err) {
        if (err instanceof DuplicateUsernameError) {
          res.status(409).json({ error: err.message });
          return;
        }
        if (err instanceof ImageValidationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        console.error('POST /api/me/page error:', err);
        res.status(500).json({ error: 'Unable to save your anonymous page settings.' });
      }
    }
  );

  // ===========================================================================
  // 3. Private Recipient Inbox Routes (Strictly Isolated by Verified Token UID)
  // ===========================================================================
  router.get('/me/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const caller = req.caller!;
      const rawLimit = Number(req.query.limit || '20');
      const limit = Math.max(1, Math.min(50, Number.isFinite(rawLimit) ? rawLimit : 20));
      const cursorId = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const result = await options.repository.listMessagesForRecipient(caller.uid, {
        limit,
        cursorId,
        search,
      });

      const hydratedMessages = await Promise.all(
        result.messages.map(async (m) => {
          let signedImageUrl: string | null = null;
          if (m.imageStoragePath) {
            signedImageUrl = await options.storage.getSignedReadUrl(m.imageStoragePath, 300);
          }
          return {
            id: m.id,
            messageText: m.messageText,
            hasImage: m.hasImage,
            signedImageUrl,
            isRead: m.isRead,
            createdAt: m.createdAt,
          };
        })
      );

      res.json({
        messages: hydratedMessages,
        nextCursor: result.nextCursor,
        unreadCount: result.unreadCount,
        totalCount: result.totalCount,
      });
    } catch (err) {
      console.error('GET /api/me/messages error:', err);
      res.status(500).json({ error: 'Unable to load your private inbox.' });
    }
  });

  router.patch(
    '/me/messages/:messageId/read',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const caller = req.caller!;
        const messageId = String(req.params.messageId || '');
        if (!VALID_ID_REGEX.test(messageId)) {
          res.status(400).json({ error: 'Invalid message identifier.' });
          return;
        }
        const isRead = Boolean(req.body?.isRead ?? true);
        const updated = await options.repository.markMessageRead(caller.uid, messageId, isRead);
        if (!updated) {
          res.status(404).json({ error: 'Message not found in your inbox.' });
          return;
        }
        res.json({ id: updated.id, isRead: updated.isRead });
      } catch (err) {
        console.error('PATCH /api/me/messages/:id/read error:', err);
        res.status(500).json({ error: 'Unable to update message read status.' });
      }
    }
  );

  router.get(
    '/me/messages/:messageId/attachment-url',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const caller = req.caller!;
        const messageId = String(req.params.messageId || '');
        if (!VALID_ID_REGEX.test(messageId)) {
          res.status(400).json({ error: 'Invalid message identifier.' });
          return;
        }
        const msg = await options.repository.getMessageById(messageId);
        if (!msg || msg.recipientUserId !== caller.uid || !msg.imageStoragePath) {
          res.status(404).json({ error: 'Attachment not found.' });
          return;
        }
        const signedImageUrl = await options.storage.getSignedReadUrl(msg.imageStoragePath, 300);
        res.json({ signedImageUrl, expiresInSeconds: 300 });
      } catch (err) {
        console.error('GET attachment-url error:', err);
        res.status(500).json({ error: 'Unable to issue attachment access link.' });
      }
    }
  );

  router.delete(
    '/me/messages/:messageId',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const caller = req.caller!;
        const messageId = String(req.params.messageId || '');
        if (!VALID_ID_REGEX.test(messageId)) {
          res.status(400).json({ error: 'Invalid message identifier.' });
          return;
        }

        const { deleted, imageStoragePath } = await options.repository.deleteMessage(
          caller.uid,
          messageId
        );
        if (!deleted) {
          res.status(404).json({ error: 'Message not found in your inbox.' });
          return;
        }

        if (imageStoragePath) {
          await options.storage.deleteObject(imageStoragePath);
        }

        res.json({ deleted: true, id: messageId });
      } catch (err) {
        console.error('DELETE /api/me/messages/:id error:', err);
        res.status(500).json({ error: 'Unable to delete message.' });
      }
    }
  );

  // ===========================================================================
  // 4. Public Anonymous Page & Submission Routes (Zero Private Leakage)
  // ===========================================================================
  router.get('/public/pages/:username', async (req: Request, res: Response) => {
    try {
      const normalized = normalizeUsername(String(req.params.username || ''));
      if (!normalized || normalized.length > LIMITS.USERNAME_MAX) {
        res.status(404).json({ error: 'This Quietbox page could not be found.' });
        return;
      }

      const page = await options.repository.getPublicPageByUsername(normalized);
      if (!page || !page.isActive) {
        res.status(404).json({ error: 'This Quietbox page is unavailable or does not exist.' });
        return;
      }

      // Strictly expose ONLY public presentation fields — never ownerId, email, or inbox stats
      res.json({
        page: {
          pageName: page.pageName,
          username: page.username,
          description: page.description,
          avatarUrl: resolveAvatarPublicUrl(page.avatarPath),
          allowSubmissions: page.allowSubmissions,
        },
      });
    } catch (err) {
      console.error('GET /api/public/pages/:username error:', err);
      res.status(500).json({ error: 'Unable to load this page right now.' });
    }
  });

  router.post(
    '/public/pages/:username/messages',
    createRateLimitMiddleware(
      submissionLimiter,
      'You are sending messages too quickly. Please wait a few minutes and try again.'
    ),
    singleUploadMiddleware('image'),
    async (req: Request, res: Response) => {
      try {
        // Basic anti-bot honeypot field check (if filled by automated scrapers, silently reject)
        const honeypot = typeof req.body?.website_url_confirm === 'string' ? req.body.website_url_confirm.trim() : '';
        if (honeypot.length > 0) {
          res.status(400).json({ error: 'Submission rejected by spam protection.' });
          return;
        }

        const normalized = normalizeUsername(String(req.params.username || ''));
        const page = await options.repository.getPublicPageByUsername(normalized);

        if (!page || !page.isActive) {
          res.status(404).json({ error: 'This Quietbox page is not active.' });
          return;
        }

        if (!page.allowSubmissions) {
          res.status(403).json({
            error: 'The owner of this Quietbox has paused new anonymous messages.',
          });
          return;
        }

        const rawText = typeof req.body?.messageText === 'string' ? req.body.messageText : '';
        if (rawText.trim().length > LIMITS.MESSAGE_TEXT_MAX) {
          res.status(400).json({
            error: `Message text cannot exceed ${LIMITS.MESSAGE_TEXT_MAX} characters.`,
          });
          return;
        }

        const cleanText = sanitizeText(rawText, LIMITS.MESSAGE_TEXT_MAX);
        const hasFile = Boolean(req.file);

        if (!cleanText && !hasFile) {
          res.status(400).json({
            error: 'Please write a message or attach an image before sending.',
          });
          return;
        }

        let imageStoragePath = '';
        if (req.file) {
          const uploadLimitResult = uploadLimiter.consume(`upload_${req.ip || 'anon'}`);
          if (!uploadLimitResult.allowed) {
            res.status(429).json({
              error: 'Image upload rate limit reached. Please try again shortly.',
            });
            return;
          }

          const validated = await validateAndReencodeImage(req.file.buffer, {
            maxBytes: maxUploadBytes,
            maxDimension: LIMITS.MAX_IMAGE_DIMENSIONS,
            prefix: 'attachments',
          });
          await options.storage.putObject(
            validated.randomObjectKey,
            validated.buffer,
            validated.mimeType
          );
          imageStoragePath = validated.randomObjectKey;
        }

        // Derive recipientUserId strictly from the verified database page record — NEVER from client input!
        await options.repository.createMessage({
          recipientUserId: page.ownerId,
          anonymousPageId: page.id,
          messageText: cleanText,
          imageStoragePath,
        });

        // Return zero internal IDs or recipient data to prevent sender enumeration
        res.status(201).json({
          submitted: true,
          message: 'Message sent successfully.',
        });
      } catch (err) {
        if (err instanceof ImageValidationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        console.error('POST /api/public/pages/:username/messages error:', err);
        res.status(500).json({ error: 'Unable to send your message right now. Please try again.' });
      }
    }
  );

  router.post(
    '/public/pages/:username/report',
    createRateLimitMiddleware(
      reportLimiter,
      'Too many reports submitted recently. Please try again later.'
    ),
    async (req: Request, res: Response) => {
      try {
        const normalized = normalizeUsername(String(req.params.username || ''));
        const page = await options.repository.getPublicPageByUsername(normalized);
        if (!page) {
          res.status(404).json({ error: 'Page not found.' });
          return;
        }

        const reason = sanitizeText(req.body?.reason, LIMITS.ABUSE_REASON_MAX);
        const details = sanitizeText(req.body?.details, LIMITS.ABUSE_DETAILS_MAX);

        if (reason.length < 3) {
          res.status(400).json({ error: 'Please select a valid report reason.' });
          return;
        }

        await options.repository.createAbuseReport({
          targetPageId: page.id,
          targetUsername: page.username,
          reason,
          details,
        });

        res.status(201).json({ reported: true });
      } catch (err) {
        console.error('POST /api/public/pages/:username/report error:', err);
        res.status(500).json({ error: 'Unable to submit report right now.' });
      }
    }
  );

  // ===========================================================================
  // 5. Controlled Media Streaming (Public Avatars & Short-Lived Signed Attachments)
  // ===========================================================================
  router.get('/public/avatars/:encodedKey', async (req: Request, res: Response) => {
    try {
      const objectKey = decodeURIComponent(String(req.params.encodedKey || ''));
      if (!/^avatars\/[a-zA-Z0-9_-]+\.webp$/.test(objectKey)) {
        res.status(404).end();
        return;
      }
      const buffer = await options.storage.readObjectBuffer(objectKey);
      if (!buffer) {
        res.status(404).end();
        return;
      }
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buffer);
    } catch {
      res.status(404).end();
    }
  });

  router.get('/media/signed/:token', async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || '');
      const objectKey = verifySignedLocalToken(token);
      if (!objectKey) {
        res.status(403).json({ error: 'Attachment link has expired or is invalid.' });
        return;
      }

      const buffer = await options.storage.readObjectBuffer(objectKey);
      if (!buffer) {
        res.status(404).json({ error: 'Attachment no longer exists.' });
        return;
      }

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.send(buffer);
    } catch {
      res.status(403).json({ error: 'Unable to serve attachment.' });
    }
  });

  // ===========================================================================
  // 6. Dedicated Media Processing & Rate-Limit Guard Routes (Client Firestore SDK)
  // ===========================================================================
  router.post(
    '/uploads/avatar',
    requireAuth,
    createRateLimitMiddleware(uploadLimiter, 'Too many avatar uploads. Please wait a moment.'),
    singleUploadMiddleware('avatar'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No avatar image file provided.' });
          return;
        }
        const processed = await validateAndReencodeImage(req.file.buffer, {
          maxBytes: Math.min(maxUploadBytes, 3 * 1024 * 1024),
          maxDimension: LIMITS.AVATAR_MAX_DIMENSIONS,
          prefix: 'avatars',
        });
        await options.storage.putObject(
          processed.randomObjectKey,
          processed.buffer,
          processed.mimeType
        );
        res.status(201).json({
          avatarPath: processed.randomObjectKey,
          avatarUrl: resolveAvatarPublicUrl(processed.randomObjectKey),
        });
      } catch (err) {
        if (err instanceof ImageValidationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        console.error('POST /api/uploads/avatar error:', err);
        res.status(500).json({ error: 'Unable to process avatar image.' });
      }
    }
  );

  router.post(
    '/uploads/attachment',
    createRateLimitMiddleware(
      submissionLimiter,
      'You are sending messages too quickly. Please wait a few minutes and try again.'
    ),
    singleUploadMiddleware('image'),
    async (req: Request, res: Response) => {
      try {
        const honeypot =
          typeof req.body?.website_url_confirm === 'string'
            ? req.body.website_url_confirm.trim()
            : '';
        if (honeypot.length > 0) {
          res.status(400).json({ error: 'Submission rejected by spam protection.' });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: 'No image attachment provided.' });
          return;
        }

        const uploadLimitResult = uploadLimiter.consume(`upload_${req.ip || 'anon'}`);
        if (!uploadLimitResult.allowed) {
          res.status(429).json({
            error: 'Image upload rate limit reached. Please try again shortly.',
          });
          return;
        }

        const validated = await validateAndReencodeImage(req.file.buffer, {
          maxBytes: maxUploadBytes,
          maxDimension: LIMITS.MAX_IMAGE_DIMENSIONS,
          prefix: 'attachments',
        });
        await options.storage.putObject(
          validated.randomObjectKey,
          validated.buffer,
          validated.mimeType
        );

        res.status(201).json({
          imageStoragePath: validated.randomObjectKey,
        });
      } catch (err) {
        if (err instanceof ImageValidationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        console.error('POST /api/uploads/attachment error:', err);
        res.status(500).json({ error: 'Unable to process attached image right now.' });
      }
    }
  );

  router.post(
    '/public/submission-guard',
    createRateLimitMiddleware(
      submissionLimiter,
      'You are sending messages too quickly. Please wait a few minutes and try again.'
    ),
    (req: Request, res: Response) => {
      const honeypot =
        typeof req.body?.website_url_confirm === 'string'
          ? req.body.website_url_confirm.trim()
          : '';
      if (honeypot.length > 0) {
        res.status(400).json({ error: 'Submission rejected by spam protection.' });
        return;
      }
      res.json({ ok: true });
    }
  );

  router.post(
    '/me/attachments/sign',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const rawKeys: unknown[] = Array.isArray(req.body?.objectKeys) ? req.body.objectKeys : [];
        const safeKeys = rawKeys
          .filter((k: unknown): k is string => typeof k === 'string' && /^attachments\/[a-zA-Z0-9_-]+\.webp$/.test(k))
          .slice(0, 50);

        const urls: Record<string, string> = {};
        await Promise.all(
          safeKeys.map(async (key: string) => {
            urls[key] = await options.storage.getSignedReadUrl(key, 300);
          })
        );

        res.json({ urls, expiresInSeconds: 300 });
      } catch (err) {
        console.error('POST /api/me/attachments/sign error:', err);
        res.status(500).json({ error: 'Unable to issue signed attachment URLs.' });
      }
    }
  );

  router.post(
    '/me/storage-cleanup',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const rawKeys: unknown[] = Array.isArray(req.body?.objectKeys) ? req.body.objectKeys : [];
        const safeKeys = rawKeys
          .filter(
            (k: unknown): k is string =>
              typeof k === 'string' && /^(attachments|avatars)\/[a-zA-Z0-9_-]+\.webp$/.test(k)
          )
          .slice(0, 200);

        await Promise.allSettled(safeKeys.map((key: string) => options.storage.deleteObject(key)));
        res.json({ cleaned: safeKeys.length });
      } catch {
        res.json({ cleaned: 0 });
      }
    }
  );

  return router;
}
