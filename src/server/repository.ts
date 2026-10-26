import crypto from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.ts';

export interface ProfileRecord {
  id: string;
  ownerId: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnonymousPageRecord {
  id: string;
  ownerId: string;
  pageName: string;
  username: string;
  description: string;
  avatarPath: string;
  isActive: boolean;
  allowSubmissions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  recipientUserId: string;
  anonymousPageId: string;
  messageText: string;
  imageStoragePath: string;
  hasImage: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface AbuseReportRecord {
  id: string;
  targetPageId: string;
  targetUsername: string;
  reason: string;
  details: string;
  createdAt: string;
}

export interface QuietboxRepository {
  getOrCreateProfile(uid: string, defaultDisplayName: string): Promise<ProfileRecord>;
  updateProfile(uid: string, data: { displayName: string; avatarUrl?: string }): Promise<ProfileRecord>;

  isUsernameAvailable(username: string, excludeOwnerUid?: string): Promise<boolean>;
  getPageByOwner(uid: string): Promise<AnonymousPageRecord | null>;
  getPublicPageByUsername(username: string): Promise<AnonymousPageRecord | null>;
  upsertPage(
    uid: string,
    input: {
      pageName: string;
      username: string;
      description: string;
      avatarPath?: string;
      isActive?: boolean;
      allowSubmissions?: boolean;
    }
  ): Promise<{ page: AnonymousPageRecord; previousAvatarPath?: string }>;

  createMessage(input: {
    recipientUserId: string;
    anonymousPageId: string;
    messageText: string;
    imageStoragePath: string;
  }): Promise<MessageRecord>;
  listMessagesForRecipient(
    uid: string,
    options: { limit: number; cursorId?: string; search?: string }
  ): Promise<{ messages: MessageRecord[]; nextCursor: string | null; unreadCount: number; totalCount: number }>;
  getMessageById(messageId: string): Promise<MessageRecord | null>;
  markMessageRead(uid: string, messageId: string, isRead: boolean): Promise<MessageRecord | null>;
  deleteMessage(uid: string, messageId: string): Promise<{ deleted: boolean; imageStoragePath?: string }>;

  createAbuseReport(input: {
    targetPageId: string;
    targetUsername: string;
    reason: string;
    details: string;
  }): Promise<AbuseReportRecord>;

  deleteAllUserData(uid: string): Promise<{ storagePathsToDelete: string[] }>;
}

function toIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export class FirestoreQuietboxRepository implements QuietboxRepository {
  public async getOrCreateProfile(uid: string, defaultDisplayName: string): Promise<ProfileRecord> {
    const ref = adminDb.collection('profiles').doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
      const d = snap.data()!;
      return {
        id: uid,
        ownerId: d.ownerId,
        displayName: d.displayName,
        avatarUrl: d.avatarUrl || '',
        createdAt: toIso(d.createdAt),
        updatedAt: toIso(d.updatedAt),
      };
    }

    const now = Timestamp.now();
    const record = {
      ownerId: uid,
      displayName: defaultDisplayName || 'Quietbox Member',
      avatarUrl: '',
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(record);
    return {
      id: uid,
      ownerId: uid,
      displayName: record.displayName,
      avatarUrl: '',
      createdAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    };
  }

  public async updateProfile(
    uid: string,
    data: { displayName: string; avatarUrl?: string }
  ): Promise<ProfileRecord> {
    const ref = adminDb.collection('profiles').doc(uid);
    const snap = await ref.get();
    const now = Timestamp.now();
    if (!snap.exists) {
      const record = {
        ownerId: uid,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl ?? '',
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(record);
      return {
        id: uid,
        ownerId: uid,
        displayName: record.displayName,
        avatarUrl: record.avatarUrl,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      };
    }

    const existing = snap.data()!;
    const avatarUrl = data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl || '';
    await ref.update({
      displayName: data.displayName,
      avatarUrl,
      updatedAt: now,
    });
    return {
      id: uid,
      ownerId: uid,
      displayName: data.displayName,
      avatarUrl,
      createdAt: toIso(existing.createdAt),
      updatedAt: now.toDate().toISOString(),
    };
  }

  public async isUsernameAvailable(username: string, excludeOwnerUid?: string): Promise<boolean> {
    const claimSnap = await adminDb.collection('usernames').doc(username).get();
    if (!claimSnap.exists) return true;
    if (excludeOwnerUid && claimSnap.data()?.ownerId === excludeOwnerUid) {
      return true;
    }
    return false;
  }

  public async getPageByOwner(uid: string): Promise<AnonymousPageRecord | null> {
    const snap = await adminDb
      .collection('anonymous_pages')
      .where('ownerId', '==', uid)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    const d = docSnap.data();
    return {
      id: docSnap.id,
      ownerId: d.ownerId,
      pageName: d.pageName,
      username: d.username,
      description: d.description || '',
      avatarPath: d.avatarPath || '',
      isActive: Boolean(d.isActive),
      allowSubmissions: Boolean(d.allowSubmissions),
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
    };
  }

  public async getPublicPageByUsername(username: string): Promise<AnonymousPageRecord | null> {
    const claimSnap = await adminDb.collection('usernames').doc(username).get();
    if (!claimSnap.exists) return null;
    const pageId = claimSnap.data()?.pageId;
    if (!pageId) return null;
    const pageSnap = await adminDb.collection('anonymous_pages').doc(pageId).get();
    if (!pageSnap.exists) return null;
    const d = pageSnap.data()!;
    return {
      id: pageSnap.id,
      ownerId: d.ownerId,
      pageName: d.pageName,
      username: d.username,
      description: d.description || '',
      avatarPath: d.avatarPath || '',
      isActive: Boolean(d.isActive),
      allowSubmissions: Boolean(d.allowSubmissions),
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
    };
  }

  public async upsertPage(
    uid: string,
    input: {
      pageName: string;
      username: string;
      description: string;
      avatarPath?: string;
      isActive?: boolean;
      allowSubmissions?: boolean;
    }
  ): Promise<{ page: AnonymousPageRecord; previousAvatarPath?: string }> {
    const existingPage = await this.getPageByOwner(uid);

    return await adminDb.runTransaction(async (tx) => {
      const now = Timestamp.now();
      const targetClaimRef = adminDb.collection('usernames').doc(input.username);
      const targetClaimSnap = await tx.get(targetClaimRef);

      if (targetClaimSnap.exists && targetClaimSnap.data()?.ownerId !== uid) {
        throw new DuplicateUsernameError('That username is already taken.');
      }

      if (!existingPage) {
        const pageId = `page_${crypto.randomBytes(10).toString('hex')}`;
        const pageRef = adminDb.collection('anonymous_pages').doc(pageId);
        const docData = {
          ownerId: uid,
          pageName: input.pageName,
          username: input.username,
          description: input.description,
          avatarPath: input.avatarPath ?? '',
          isActive: input.isActive ?? true,
          allowSubmissions: input.allowSubmissions ?? true,
          createdAt: now,
          updatedAt: now,
        };
        tx.set(pageRef, docData);
        tx.set(targetClaimRef, {
          ownerId: uid,
          pageId,
          createdAt: now,
        });
        return {
          page: {
            id: pageId,
            ...docData,
            createdAt: now.toDate().toISOString(),
            updatedAt: now.toDate().toISOString(),
          },
        };
      }

      const pageRef = adminDb.collection('anonymous_pages').doc(existingPage.id);
      const nextAvatarPath =
        input.avatarPath !== undefined ? input.avatarPath : existingPage.avatarPath;
      const previousAvatarPath =
        input.avatarPath !== undefined &&
        existingPage.avatarPath &&
        existingPage.avatarPath !== input.avatarPath
          ? existingPage.avatarPath
          : undefined;

      if (existingPage.username !== input.username) {
        const oldClaimRef = adminDb.collection('usernames').doc(existingPage.username);
        tx.delete(oldClaimRef);
        tx.set(targetClaimRef, {
          ownerId: uid,
          pageId: existingPage.id,
          createdAt: now,
        });
      }

      const updatedFields = {
        pageName: input.pageName,
        username: input.username,
        description: input.description,
        avatarPath: nextAvatarPath,
        isActive: input.isActive !== undefined ? input.isActive : existingPage.isActive,
        allowSubmissions:
          input.allowSubmissions !== undefined ? input.allowSubmissions : existingPage.allowSubmissions,
        updatedAt: now,
      };
      tx.update(pageRef, updatedFields);

      return {
        previousAvatarPath,
        page: {
          id: existingPage.id,
          ownerId: uid,
          ...updatedFields,
          createdAt: existingPage.createdAt,
          updatedAt: now.toDate().toISOString(),
        },
      };
    });
  }

  public async createMessage(input: {
    recipientUserId: string;
    anonymousPageId: string;
    messageText: string;
    imageStoragePath: string;
  }): Promise<MessageRecord> {
    const id = `msg_${crypto.randomBytes(12).toString('hex')}`;
    const now = Timestamp.now();
    const docData = {
      recipientUserId: input.recipientUserId,
      anonymousPageId: input.anonymousPageId,
      messageText: input.messageText,
      imageStoragePath: input.imageStoragePath,
      hasImage: Boolean(input.imageStoragePath),
      isRead: false,
      createdAt: now,
    };
    await adminDb.collection('messages').doc(id).set(docData);
    return {
      id,
      ...docData,
      createdAt: now.toDate().toISOString(),
    };
  }

  public async listMessagesForRecipient(
    uid: string,
    options: { limit: number; cursorId?: string; search?: string }
  ): Promise<{ messages: MessageRecord[]; nextCursor: string | null; unreadCount: number; totalCount: number }> {
    // Query strictly scoped to authenticated recipientUserId
    const snap = await adminDb
      .collection('messages')
      .where('recipientUserId', '==', uid)
      .get();

    const allMessages: MessageRecord[] = snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          recipientUserId: d.recipientUserId,
          anonymousPageId: d.anonymousPageId,
          messageText: d.messageText || '',
          imageStoragePath: d.imageStoragePath || '',
          hasImage: Boolean(d.hasImage || d.imageStoragePath),
          isRead: Boolean(d.isRead),
          createdAt: toIso(d.createdAt),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const unreadCount = allMessages.filter((m) => !m.isRead).length;
    const totalCount = allMessages.length;

    const searchLower = options.search?.trim().toLowerCase() || '';
    const filtered = searchLower
      ? allMessages.filter((m) => m.messageText.toLowerCase().includes(searchLower))
      : allMessages;

    let startIndex = 0;
    if (options.cursorId) {
      const idx = filtered.findIndex((m) => m.id === options.cursorId);
      if (idx >= 0) {
        startIndex = idx + 1;
      }
    }

    const slice = filtered.slice(startIndex, startIndex + options.limit);
    const hasMore = startIndex + options.limit < filtered.length;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;

    return {
      messages: slice,
      nextCursor,
      unreadCount,
      totalCount,
    };
  }

  public async getMessageById(messageId: string): Promise<MessageRecord | null> {
    const snap = await adminDb.collection('messages').doc(messageId).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return {
      id: snap.id,
      recipientUserId: d.recipientUserId,
      anonymousPageId: d.anonymousPageId,
      messageText: d.messageText || '',
      imageStoragePath: d.imageStoragePath || '',
      hasImage: Boolean(d.hasImage || d.imageStoragePath),
      isRead: Boolean(d.isRead),
      createdAt: toIso(d.createdAt),
    };
  }

  public async markMessageRead(uid: string, messageId: string, isRead: boolean): Promise<MessageRecord | null> {
    const ref = adminDb.collection('messages').doc(messageId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.recipientUserId !== uid) {
      return null; // Never reveal existence of another user's message
    }
    await ref.update({ isRead });
    return {
      id: snap.id,
      recipientUserId: d.recipientUserId,
      anonymousPageId: d.anonymousPageId,
      messageText: d.messageText || '',
      imageStoragePath: d.imageStoragePath || '',
      hasImage: Boolean(d.hasImage || d.imageStoragePath),
      isRead,
      createdAt: toIso(d.createdAt),
    };
  }

  public async deleteMessage(
    uid: string,
    messageId: string
  ): Promise<{ deleted: boolean; imageStoragePath?: string }> {
    const ref = adminDb.collection('messages').doc(messageId);
    const snap = await ref.get();
    if (!snap.exists) return { deleted: false };
    const d = snap.data()!;
    if (d.recipientUserId !== uid) {
      return { deleted: false };
    }
    const imageStoragePath = d.imageStoragePath || undefined;
    await ref.delete();
    return { deleted: true, imageStoragePath };
  }

  public async createAbuseReport(input: {
    targetPageId: string;
    targetUsername: string;
    reason: string;
    details: string;
  }): Promise<AbuseReportRecord> {
    const id = `rep_${crypto.randomBytes(10).toString('hex')}`;
    const now = Timestamp.now();
    const docData = {
      targetPageId: input.targetPageId,
      targetUsername: input.targetUsername,
      reason: input.reason,
      details: input.details,
      createdAt: now,
    };
    await adminDb.collection('abuse_reports').doc(id).set(docData);
    return {
      id,
      ...docData,
      createdAt: now.toDate().toISOString(),
    };
  }

  public async deleteAllUserData(uid: string): Promise<{ storagePathsToDelete: string[] }> {
    const storagePathsToDelete: string[] = [];

    const page = await this.getPageByOwner(uid);
    const messagesSnap = await adminDb
      .collection('messages')
      .where('recipientUserId', '==', uid)
      .get();

    const batch = adminDb.batch();

    for (const msgDoc of messagesSnap.docs) {
      const pathVal = msgDoc.data().imageStoragePath;
      if (pathVal) storagePathsToDelete.push(pathVal);
      batch.delete(msgDoc.ref);
    }

    if (page) {
      if (page.avatarPath) storagePathsToDelete.push(page.avatarPath);
      batch.delete(adminDb.collection('anonymous_pages').doc(page.id));
      batch.delete(adminDb.collection('usernames').doc(page.username));
    }

    batch.delete(adminDb.collection('profiles').doc(uid));
    await batch.commit();

    // Ensure FieldValue stays referenced if needed
    void FieldValue;

    return { storagePathsToDelete };
  }
}

export class DuplicateUsernameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateUsernameError';
  }
}

/**
 * Deterministic in-memory repository implementing the exact same transactional
 * contracts and recipient isolation rules for automated API security tests.
 */
export class InMemoryQuietboxRepository implements QuietboxRepository {
  private readonly profiles = new Map<string, ProfileRecord>();
  private readonly pages = new Map<string, AnonymousPageRecord>();
  private readonly usernames = new Map<string, { ownerId: string; pageId: string }>();
  private readonly messages = new Map<string, MessageRecord>();
  private readonly reports = new Map<string, AbuseReportRecord>();

  public async getOrCreateProfile(uid: string, defaultDisplayName: string): Promise<ProfileRecord> {
    const existing = this.profiles.get(uid);
    if (existing) return existing;
    const now = new Date().toISOString();
    const created: ProfileRecord = {
      id: uid,
      ownerId: uid,
      displayName: defaultDisplayName || 'Quietbox Member',
      avatarUrl: '',
      createdAt: now,
      updatedAt: now,
    };
    this.profiles.set(uid, created);
    return created;
  }

  public async updateProfile(
    uid: string,
    data: { displayName: string; avatarUrl?: string }
  ): Promise<ProfileRecord> {
    const existing = await this.getOrCreateProfile(uid, data.displayName);
    const updated: ProfileRecord = {
      ...existing,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(uid, updated);
    return updated;
  }

  public async isUsernameAvailable(username: string, excludeOwnerUid?: string): Promise<boolean> {
    const claim = this.usernames.get(username);
    if (!claim) return true;
    return Boolean(excludeOwnerUid && claim.ownerId === excludeOwnerUid);
  }

  public async getPageByOwner(uid: string): Promise<AnonymousPageRecord | null> {
    for (const p of this.pages.values()) {
      if (p.ownerId === uid) return p;
    }
    return null;
  }

  public async getPublicPageByUsername(username: string): Promise<AnonymousPageRecord | null> {
    const claim = this.usernames.get(username);
    if (!claim) return null;
    return this.pages.get(claim.pageId) || null;
  }

  public async upsertPage(
    uid: string,
    input: {
      pageName: string;
      username: string;
      description: string;
      avatarPath?: string;
      isActive?: boolean;
      allowSubmissions?: boolean;
    }
  ): Promise<{ page: AnonymousPageRecord; previousAvatarPath?: string }> {
    const claim = this.usernames.get(input.username);
    if (claim && claim.ownerId !== uid) {
      throw new DuplicateUsernameError('That username is already taken.');
    }

    const existing = await this.getPageByOwner(uid);
    const now = new Date().toISOString();

    if (!existing) {
      const id = `page_${crypto.randomBytes(8).toString('hex')}`;
      const created: AnonymousPageRecord = {
        id,
        ownerId: uid,
        pageName: input.pageName,
        username: input.username,
        description: input.description,
        avatarPath: input.avatarPath ?? '',
        isActive: input.isActive ?? true,
        allowSubmissions: input.allowSubmissions ?? true,
        createdAt: now,
        updatedAt: now,
      };
      this.pages.set(id, created);
      this.usernames.set(input.username, { ownerId: uid, pageId: id });
      return { page: created };
    }

    if (existing.username !== input.username) {
      this.usernames.delete(existing.username);
      this.usernames.set(input.username, { ownerId: uid, pageId: existing.id });
    }

    const previousAvatarPath =
      input.avatarPath !== undefined && existing.avatarPath && existing.avatarPath !== input.avatarPath
        ? existing.avatarPath
        : undefined;

    const updated: AnonymousPageRecord = {
      ...existing,
      pageName: input.pageName,
      username: input.username,
      description: input.description,
      avatarPath: input.avatarPath !== undefined ? input.avatarPath : existing.avatarPath,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      allowSubmissions:
        input.allowSubmissions !== undefined ? input.allowSubmissions : existing.allowSubmissions,
      updatedAt: now,
    };
    this.pages.set(existing.id, updated);
    return { page: updated, previousAvatarPath };
  }

  public async createMessage(input: {
    recipientUserId: string;
    anonymousPageId: string;
    messageText: string;
    imageStoragePath: string;
  }): Promise<MessageRecord> {
    const id = `msg_${crypto.randomBytes(10).toString('hex')}`;
    const created: MessageRecord = {
      id,
      recipientUserId: input.recipientUserId,
      anonymousPageId: input.anonymousPageId,
      messageText: input.messageText,
      imageStoragePath: input.imageStoragePath,
      hasImage: Boolean(input.imageStoragePath),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.messages.set(id, created);
    return created;
  }

  public async listMessagesForRecipient(
    uid: string,
    options: { limit: number; cursorId?: string; search?: string }
  ): Promise<{ messages: MessageRecord[]; nextCursor: string | null; unreadCount: number; totalCount: number }> {
    const all = Array.from(this.messages.values())
      .filter((m) => m.recipientUserId === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const unreadCount = all.filter((m) => !m.isRead).length;
    const totalCount = all.length;

    const q = options.search?.trim().toLowerCase() || '';
    const filtered = q ? all.filter((m) => m.messageText.toLowerCase().includes(q)) : all;

    let start = 0;
    if (options.cursorId) {
      const idx = filtered.findIndex((m) => m.id === options.cursorId);
      if (idx >= 0) start = idx + 1;
    }

    const slice = filtered.slice(start, start + options.limit);
    const hasMore = start + options.limit < filtered.length;
    return {
      messages: slice,
      nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      unreadCount,
      totalCount,
    };
  }

  public async getMessageById(messageId: string): Promise<MessageRecord | null> {
    return this.messages.get(messageId) || null;
  }

  public async markMessageRead(uid: string, messageId: string, isRead: boolean): Promise<MessageRecord | null> {
    const msg = this.messages.get(messageId);
    if (!msg || msg.recipientUserId !== uid) return null;
    const updated = { ...msg, isRead };
    this.messages.set(messageId, updated);
    return updated;
  }

  public async deleteMessage(
    uid: string,
    messageId: string
  ): Promise<{ deleted: boolean; imageStoragePath?: string }> {
    const msg = this.messages.get(messageId);
    if (!msg || msg.recipientUserId !== uid) return { deleted: false };
    this.messages.delete(messageId);
    return { deleted: true, imageStoragePath: msg.imageStoragePath || undefined };
  }

  public async createAbuseReport(input: {
    targetPageId: string;
    targetUsername: string;
    reason: string;
    details: string;
  }): Promise<AbuseReportRecord> {
    const id = `rep_${crypto.randomBytes(8).toString('hex')}`;
    const report: AbuseReportRecord = {
      id,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.reports.set(id, report);
    return report;
  }

  public async deleteAllUserData(uid: string): Promise<{ storagePathsToDelete: string[] }> {
    const storagePathsToDelete: string[] = [];
    for (const [id, msg] of this.messages.entries()) {
      if (msg.recipientUserId === uid) {
        if (msg.imageStoragePath) storagePathsToDelete.push(msg.imageStoragePath);
        this.messages.delete(id);
      }
    }
    const page = await this.getPageByOwner(uid);
    if (page) {
      if (page.avatarPath) storagePathsToDelete.push(page.avatarPath);
      this.pages.delete(page.id);
      this.usernames.delete(page.username);
    }
    this.profiles.delete(uid);
    return { storagePathsToDelete };
  }
}
