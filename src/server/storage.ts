import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { adminStorage, configuredStorageBucket } from './firebaseAdmin.ts';

export interface ObjectStorageService {
  putObject(objectKey: string, buffer: Buffer, contentType: string): Promise<void>;
  getSignedReadUrl(objectKey: string, expiresInSeconds?: number): Promise<string>;
  readObjectBuffer(objectKey: string): Promise<Buffer | null>;
  deleteObject(objectKey: string): Promise<void>;
}

const SIGNING_SECRET =
  process.env.STORAGE_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');

const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), '.private_storage');

function assertSafeObjectKey(objectKey: string): void {
  if (!/^(attachments|avatars)\/[a-zA-Z0-9_-]+\.webp$/.test(objectKey)) {
    throw new Error('Invalid storage object key.');
  }
}

export function createSignedLocalToken(objectKey: string, expiresAtMs: number): string {
  const payload = `${objectKey}|${expiresAtMs}`;
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`, 'utf8').toString('base64url');
}

export function verifySignedLocalToken(token: string, now = Date.now()): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 3) return null;
    const [objectKey, expiresStr, providedSig] = parts;
    assertSafeObjectKey(objectKey);
    const expiresAtMs = Number(expiresStr);
    if (!Number.isFinite(expiresAtMs) || now > expiresAtMs) {
      return null;
    }
    const expectedSig = crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(`${objectKey}|${expiresStr}`)
      .digest('hex');
    const bufA = Buffer.from(providedSig, 'hex');
    const bufB = Buffer.from(expectedSig, 'hex');
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }
    return objectKey;
  } catch {
    return null;
  }
}

export class HybridCloudObjectStorage implements ObjectStorageService {
  private cloudBucketAvailable: boolean | null = null;

  private async tryCloudPut(objectKey: string, buffer: Buffer, contentType: string): Promise<boolean> {
    if (!configuredStorageBucket || this.cloudBucketAvailable === false) {
      return false;
    }
    try {
      const bucket = adminStorage.bucket(configuredStorageBucket);
      const file = bucket.file(objectKey);
      await file.save(buffer, {
        resumable: false,
        contentType,
        metadata: {
          cacheControl: objectKey.startsWith('avatars/')
            ? 'public, max-age=86400'
            : 'private, no-store',
        },
      });
      this.cloudBucketAvailable = true;
      return true;
    } catch {
      this.cloudBucketAvailable = false;
      return false;
    }
  }

  public async putObject(objectKey: string, buffer: Buffer, contentType: string): Promise<void> {
    assertSafeObjectKey(objectKey);
    const storedInCloud = await this.tryCloudPut(objectKey, buffer, contentType);
    if (storedInCloud) return;

    const targetPath = path.join(LOCAL_STORAGE_ROOT, objectKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, buffer, { mode: 0o600 });
  }

  public async getSignedReadUrl(objectKey: string, expiresInSeconds = 300): Promise<string> {
    assertSafeObjectKey(objectKey);
    if (configuredStorageBucket && this.cloudBucketAvailable === true) {
      try {
        const bucket = adminStorage.bucket(configuredStorageBucket);
        const [url] = await bucket.file(objectKey).getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + expiresInSeconds * 1000,
        });
        return url;
      } catch {
        // Fall through to signed backend stream token if IAM signing isn't available
      }
    }

    const expiresAtMs = Date.now() + expiresInSeconds * 1000;
    const token = createSignedLocalToken(objectKey, expiresAtMs);
    return `/api/media/signed/${encodeURIComponent(token)}`;
  }

  public async readObjectBuffer(objectKey: string): Promise<Buffer | null> {
    assertSafeObjectKey(objectKey);
    if (configuredStorageBucket && this.cloudBucketAvailable !== false) {
      try {
        const bucket = adminStorage.bucket(configuredStorageBucket);
        const [exists] = await bucket.file(objectKey).exists();
        if (exists) {
          const [contents] = await bucket.file(objectKey).download();
          return contents;
        }
      } catch {
        // Fall back to local object directory
      }
    }
    try {
      const targetPath = path.join(LOCAL_STORAGE_ROOT, objectKey);
      return await fs.readFile(targetPath);
    } catch {
      return null;
    }
  }

  public async deleteObject(objectKey: string): Promise<void> {
    if (!objectKey) return;
    assertSafeObjectKey(objectKey);
    if (configuredStorageBucket && this.cloudBucketAvailable !== false) {
      try {
        await adminStorage.bucket(configuredStorageBucket).file(objectKey).delete({ ignoreNotFound: true });
      } catch {
        // Ignore if not in cloud bucket
      }
    }
    try {
      const targetPath = path.join(LOCAL_STORAGE_ROOT, objectKey);
      await fs.unlink(targetPath);
    } catch {
      // Ignore if already deleted
    }
  }
}

export class InMemoryObjectStorage implements ObjectStorageService {
  private readonly objects = new Map<string, Buffer>();

  public async putObject(objectKey: string, buffer: Buffer): Promise<void> {
    assertSafeObjectKey(objectKey);
    this.objects.set(objectKey, Buffer.from(buffer));
  }

  public async getSignedReadUrl(objectKey: string, expiresInSeconds = 300): Promise<string> {
    assertSafeObjectKey(objectKey);
    const token = createSignedLocalToken(objectKey, Date.now() + expiresInSeconds * 1000);
    return `/api/media/signed/${encodeURIComponent(token)}`;
  }

  public async readObjectBuffer(objectKey: string): Promise<Buffer | null> {
    assertSafeObjectKey(objectKey);
    return this.objects.get(objectKey) || null;
  }

  public async deleteObject(objectKey: string): Promise<void> {
    if (!objectKey) return;
    assertSafeObjectKey(objectKey);
    this.objects.delete(objectKey);
  }
}
