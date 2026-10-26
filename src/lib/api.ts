import { deleteUser, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  LIMITS,
  normalizeUsername,
  sanitizeText,
   USERNAME_REGEX,
  VALID_ID_REGEX,
  validateUsername,
} from '../shared/validation';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';

export interface ProfileDTO {
  id: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  emailVerified?: boolean;
}

export interface AnonymousPageDTO {
  id: string;
  pageName: string;
  username: string;
  description: string;
  avatarUrl: string;
  isActive: boolean;
  allowSubmissions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPageDTO {
  pageName: string;
  username: string;
  description: string;
  avatarUrl: string;
  allowSubmissions: boolean;
}

export interface InboxMessageDTO {
  id: string;
  messageText: string;
  hasImage: boolean;
  signedImageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

class DuplicateUsernameConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateUsernameConflictError';
  }
}

function randomSafeId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof (val as { toDate?: unknown }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function resolveAvatarPublicUrl(avatarPath: string): string {
  if (!avatarPath) return '';
  if (
    avatarPath.startsWith('/src/assets/') ||
    avatarPath.startsWith('/hero-backgrounds/') ||
    avatarPath.startsWith('/api/') ||
    avatarPath.startsWith('https://')
  ) {
    return avatarPath;
  }
  return `/api/public/avatars/${encodeURIComponent(avatarPath)}`;
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === 'permission-denied' ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('PERMISSION_DENIED')
  );
}

function wrapFirestoreException(err: unknown, op: OperationType, path: string): never {
  if (isPermissionDeniedError(err)) {
    handleFirestoreError(err, op, path);
  }
  throw err instanceof Error ? err : new Error(String(err));
}

async function getBearerHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await currentUser.getIdToken(forceRefresh);
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function ensureVerifiedCurrentUser(): Promise<User> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }
  if (!currentUser.emailVerified) {
    await currentUser.reload();
    await currentUser.getIdToken(true);
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address first (check your inbox for the verification link, or sign in with Google) before saving changes.'
    );
  }
  return currentUser;
}

async function parseApiJson<T>(res: Response): Promise<T> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response
  }
  if (!res.ok) {
    throw new Error(body?.error || `Request failed with status ${res.status}`);
  }
  return body as T;
}

async function cleanupStorageObjectsBestEffort(objectKeys: string[]): Promise<void> {
  const validKeys = objectKeys.filter(Boolean);
  if (validKeys.length === 0 || !auth.currentUser) return;
  try {
    const headers = await getBearerHeaders();
    await fetch('/api/me/storage-cleanup', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ objectKeys: validKeys }),
    });
  } catch {
    // Best-effort cleanup
  }
}

async function signAttachmentUrlsBatch(objectKeys: string[]): Promise<Record<string, string>> {
  const uniqueKeys = Array.from(new Set(objectKeys.filter(Boolean)));
  if (uniqueKeys.length === 0) return {};
  const headers = await getBearerHeaders();
  const res = await fetch('/api/me/attachments/sign', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ objectKeys: uniqueKeys }),
  });
  const data = await parseApiJson<{ urls: Record<string, string> }>(res);
  return data.urls || {};
}

interface InternalPageDoc {
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

async function queryOwnedPage(uid: string): Promise<InternalPageDoc | null> {
  try {
    const q = query(collection(db, 'anonymous_pages'), where('ownerId', '==', uid), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    const d = docSnap.data();
    return {
      id: docSnap.id,
      ownerId: String(d.ownerId || uid),
      pageName: String(d.pageName || ''),
      username: String(d.username || ''),
      description: String(d.description || ''),
      avatarPath: String(d.avatarPath || ''),
      isActive: Boolean(d.isActive),
      allowSubmissions: Boolean(d.allowSubmissions),
      createdAt: toIsoString(d.createdAt),
      updatedAt: toIsoString(d.updatedAt),
    };
  } catch (err) {
    wrapFirestoreException(err, OperationType.LIST, 'anonymous_pages');
  }
}

export async function fetchMyAccount(): Promise<{
  profile: ProfileDTO;
  page: AnonymousPageDTO | null;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to view your account.');
  }

  const uid = currentUser.uid;
  const fallbackName =
    sanitizeText(
      currentUser.displayName || currentUser.email?.split('@')[0] || 'Quietbox Member',
      LIMITS.DISPLAY_NAME_MAX
    ) || 'Quietbox Member';

  const profilePath = `profiles/${uid}`;
  let profileDto: ProfileDTO;

  try {
    const profileRef = doc(db, 'profiles', uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      const d = profileSnap.data();
      profileDto = {
        id: uid,
        displayName: String(d.displayName || fallbackName),
        avatarUrl: resolveAvatarPublicUrl(String(d.avatarUrl || '')),
        createdAt: toIsoString(d.createdAt),
        updatedAt: toIsoString(d.updatedAt),
        emailVerified: currentUser.emailVerified,
      };
    } else if (currentUser.emailVerified) {
      const nowIso = new Date().toISOString();
      try {
        await setDoc(profileRef, {
          ownerId: uid,
          displayName: fallbackName,
          avatarUrl: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (createErr) {
        wrapFirestoreException(createErr, OperationType.CREATE, profilePath);
      }
      profileDto = {
        id: uid,
        displayName: fallbackName,
        avatarUrl: '',
        createdAt: nowIso,
        updatedAt: nowIso,
        emailVerified: true,
      };
    } else {
      const nowIso = new Date().toISOString();
      profileDto = {
        id: uid,
        displayName: fallbackName,
        avatarUrl: '',
        createdAt: nowIso,
        updatedAt: nowIso,
        emailVerified: false,
      };
    }
  } catch (err) {
    wrapFirestoreException(err, OperationType.GET, profilePath);
  }

  const ownedPage = await queryOwnedPage(uid);

  return {
    profile: profileDto,
    page: ownedPage
      ? {
          id: ownedPage.id,
          pageName: ownedPage.pageName,
          username: ownedPage.username,
          description: ownedPage.description,
          avatarUrl: resolveAvatarPublicUrl(ownedPage.avatarPath),
          isActive: ownedPage.isActive,
          allowSubmissions: ownedPage.allowSubmissions,
          createdAt: ownedPage.createdAt,
          updatedAt: ownedPage.updatedAt,
        }
      : null,
  };
}

export async function updateMyProfile(displayNameInput: string): Promise<{ profile: ProfileDTO }> {
  const currentUser = await ensureVerifiedCurrentUser();
  const uid = currentUser.uid;
  const displayName = sanitizeText(displayNameInput, LIMITS.DISPLAY_NAME_MAX);
  if (!displayName) {
    throw new Error('Display name cannot be empty.');
  }

  const profilePath = `profiles/${uid}`;
  const profileRef = doc(db, 'profiles', uid);
  const nowIso = new Date().toISOString();

  try {
    const snap = await getDoc(profileRef);
    if (!snap.exists()) {
      await setDoc(profileRef, {
        ownerId: uid,
        displayName,
        avatarUrl: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        profile: {
          id: uid,
          displayName,
          avatarUrl: '',
          createdAt: nowIso,
          updatedAt: nowIso,
          emailVerified: true,
        },
      };
    }

    const existing = snap.data();
    await updateDoc(profileRef, {
      displayName,
      updatedAt: serverTimestamp(),
    });
    return {
      profile: {
        id: uid,
        displayName,
        avatarUrl: resolveAvatarPublicUrl(String(existing.avatarUrl || '')),
        createdAt: toIsoString(existing.createdAt),
        updatedAt: nowIso,
        emailVerified: true,
      },
    };
  } catch (err) {
    wrapFirestoreException(err, OperationType.WRITE, profilePath);
  }
}

export async function checkUsernameAvailability(username: string): Promise<{
  available: boolean;
  normalized: string;
  reason?: string;
}> {
  const validation = validateUsername(username);
  if (!validation.valid) {
    return {
      available: false,
      normalized: validation.normalized,
      reason: validation.error,
    };
  }

  const claimPath = `usernames/${validation.normalized}`;
  try {
    const claimSnap = await getDoc(doc(db, 'usernames', validation.normalized));
    if (!claimSnap.exists()) {
      return {
        available: true,
        normalized: validation.normalized,
      };
    }

    const currentUid = auth.currentUser?.uid;
    if (currentUid && claimSnap.data()?.ownerId === currentUid) {
      return {
        available: true,
        normalized: validation.normalized,
      };
    }

    return {
      available: false,
      normalized: validation.normalized,
      reason: 'That username is already taken.',
    };
  } catch (err) {
    wrapFirestoreException(err, OperationType.GET, claimPath);
  }
}

export async function saveMyAnonymousPage(input: {
  pageName: string;
  username: string;
  description: string;
  avatarFile?: File | null;
  removeAvatar?: boolean;
  isActive?: boolean;
  allowSubmissions?: boolean;
}): Promise<{ page: AnonymousPageDTO }> {
  const currentUser = await ensureVerifiedCurrentUser();
  const uid = currentUser.uid;

  const pageName = sanitizeText(input.pageName, LIMITS.PAGE_NAME_MAX);
  const description = sanitizeText(input.description, LIMITS.DESCRIPTION_MAX);
  const usernameValidation = validateUsername(input.username);

  if (!pageName) {
    throw new Error('Page name is required.');
  }
  if (!usernameValidation.valid) {
    throw new Error(usernameValidation.error || 'Please choose a valid username.');
  }

  const normalizedUsername = usernameValidation.normalized;

  let uploadedAvatarKey: string | undefined;
  if (input.avatarFile) {
    const headers = await getBearerHeaders();
    const formData = new FormData();
    formData.append('avatar', input.avatarFile);
    const uploadRes = await fetch('/api/uploads/avatar', {
      method: 'POST',
      headers,
      body: formData,
    });
    const uploaded = await parseApiJson<{ avatarPath: string; avatarUrl: string }>(uploadRes);
    uploadedAvatarKey = uploaded.avatarPath;
  } else if (input.removeAvatar) {
    uploadedAvatarKey = '';
  }

  // Ensure user's profile document exists
  const profileRef = doc(db, 'profiles', uid);
  try {
    const profSnap = await getDoc(profileRef);
    if (!profSnap.exists()) {
      await setDoc(profileRef, {
        ownerId: uid,
        displayName: pageName,
        avatarUrl: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    wrapFirestoreException(err, OperationType.WRITE, `profiles/${uid}`);
  }

  const existingPage = await queryOwnedPage(uid);
  const nowIso = new Date().toISOString();

  try {
    const txResult = await runTransaction(db, async (tx) => {
      const targetClaimRef = doc(db, 'usernames', normalizedUsername);
      const targetClaimSnap = await tx.get(targetClaimRef);

      if (targetClaimSnap.exists() && targetClaimSnap.data()?.ownerId !== uid) {
        throw new DuplicateUsernameConflictError('That username is already taken.');
      }

      if (!existingPage) {
        const pageId = randomSafeId('page');
        const pageRef = doc(db, 'anonymous_pages', pageId);
        const avatarPath = uploadedAvatarKey ?? '';
        const isActive = input.isActive ?? true;
        const allowSubmissions = input.allowSubmissions ?? true;

        tx.set(pageRef, {
          ownerId: uid,
          pageName,
          username: normalizedUsername,
          description,
          avatarPath,
          isActive,
          allowSubmissions,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(targetClaimRef, {
          ownerId: uid,
          pageId,
          createdAt: serverTimestamp(),
        });

        return {
          previousAvatarPath: undefined as string | undefined,
          page: {
            id: pageId,
            pageName,
            username: normalizedUsername,
            description,
            avatarUrl: resolveAvatarPublicUrl(avatarPath),
            isActive,
            allowSubmissions,
            createdAt: nowIso,
            updatedAt: nowIso,
          } satisfies AnonymousPageDTO,
        };
      }

      const pageRef = doc(db, 'anonymous_pages', existingPage.id);
      const nextAvatarPath =
        uploadedAvatarKey !== undefined ? uploadedAvatarKey : existingPage.avatarPath;
      const previousAvatarPath =
        uploadedAvatarKey !== undefined &&
        existingPage.avatarPath &&
        existingPage.avatarPath !== uploadedAvatarKey
          ? existingPage.avatarPath
          : undefined;

      const nextIsActive = input.isActive !== undefined ? input.isActive : existingPage.isActive;
      const nextAllowSubmissions =
        input.allowSubmissions !== undefined
          ? input.allowSubmissions
          : existingPage.allowSubmissions;

      if (existingPage.username !== normalizedUsername) {
        const oldClaimRef = doc(db, 'usernames', existingPage.username);
        tx.delete(oldClaimRef);
        tx.set(targetClaimRef, {
          ownerId: uid,
          pageId: existingPage.id,
          createdAt: serverTimestamp(),
        });
      }

      tx.update(pageRef, {
        pageName,
        username: normalizedUsername,
        description,
        avatarPath: nextAvatarPath,
        isActive: nextIsActive,
        allowSubmissions: nextAllowSubmissions,
        updatedAt: serverTimestamp(),
      });

      return {
        previousAvatarPath,
        page: {
          id: existingPage.id,
          pageName,
          username: normalizedUsername,
          description,
          avatarUrl: resolveAvatarPublicUrl(nextAvatarPath),
          isActive: nextIsActive,
          allowSubmissions: nextAllowSubmissions,
          createdAt: existingPage.createdAt,
          updatedAt: nowIso,
        } satisfies AnonymousPageDTO,
      };
    });

    if (txResult.previousAvatarPath) {
      await cleanupStorageObjectsBestEffort([txResult.previousAvatarPath]);
    }

    return { page: txResult.page };
  } catch (err) {
    if (err instanceof DuplicateUsernameConflictError) {
      if (uploadedAvatarKey) {
        await cleanupStorageObjectsBestEffort([uploadedAvatarKey]);
      }
      throw new Error(err.message);
    }
    wrapFirestoreException(
      err,
      existingPage ? OperationType.UPDATE : OperationType.CREATE,
      existingPage ? `anonymous_pages/${existingPage.id}` : 'anonymous_pages'
    );
  }
}

export async function fetchMyMessages(options: {
  limit?: number;
  cursor?: string;
  search?: string;
}): Promise<{
  messages: InboxMessageDTO[];
  nextCursor: string | null;
  unreadCount: number;
  totalCount: number;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to access your inbox.');
  }

  if (!currentUser.emailVerified) {
    await currentUser.reload();
    await currentUser.getIdToken(true);
    if (!currentUser.emailVerified) {
      return {
        messages: [],
        nextCursor: null,
        unreadCount: 0,
        totalCount: 0,
      };
    }
  }

  const pageSize = Math.max(1, Math.min(50, options.limit ?? 20));

  try {
    const q = query(
      collection(db, 'messages'),
      where('recipientUserId', '==', currentUser.uid)
    );
    const snap = await getDocs(q);

    const allMessages = snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        const imageStoragePath = String(d.imageStoragePath || '');
        return {
          id: docSnap.id,
          messageText: String(d.messageText || ''),
          imageStoragePath,
          hasImage: Boolean(d.hasImage || imageStoragePath),
          isRead: Boolean(d.isRead),
          createdAt: toIsoString(d.createdAt),
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
    if (options.cursor) {
      const idx = filtered.findIndex((m) => m.id === options.cursor);
      if (idx >= 0) {
        startIndex = idx + 1;
      }
    }

    const slice = filtered.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < filtered.length;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;

    const attachmentKeys = slice
      .map((m) => m.imageStoragePath)
      .filter((p) => p.length > 0);
    const signedUrlMap = await signAttachmentUrlsBatch(attachmentKeys);

    const hydratedMessages: InboxMessageDTO[] = slice.map((m) => ({
      id: m.id,
      messageText: m.messageText,
      hasImage: m.hasImage,
      signedImageUrl: m.imageStoragePath ? signedUrlMap[m.imageStoragePath] ?? null : null,
      isRead: m.isRead,
      createdAt: m.createdAt,
    }));

    return {
      messages: hydratedMessages,
      nextCursor,
      unreadCount,
      totalCount,
    };
  } catch (err) {
    wrapFirestoreException(err, OperationType.LIST, 'messages');
  }
}

export async function toggleMessageRead(
  messageId: string,
  isRead: boolean
): Promise<{ id: string; isRead: boolean }> {
  await ensureVerifiedCurrentUser();
  if (!VALID_ID_REGEX.test(messageId)) {
    throw new Error('Invalid message identifier.');
  }
  const msgPath = `messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'messages', messageId), {
      isRead: Boolean(isRead),
    });
    return { id: messageId, isRead: Boolean(isRead) };
  } catch (err) {
    wrapFirestoreException(err, OperationType.UPDATE, msgPath);
  }
}

export async function refreshSignedAttachmentUrl(
  messageId: string
): Promise<{ signedImageUrl: string; expiresInSeconds: number }> {
  const currentUser = await ensureVerifiedCurrentUser();
  if (!VALID_ID_REGEX.test(messageId)) {
    throw new Error('Invalid message identifier.');
  }

  const msgPath = `messages/${messageId}`;
  let imageStoragePath = '';
  try {
    const snap = await getDoc(doc(db, 'messages', messageId));
    if (!snap.exists() || snap.data()?.recipientUserId !== currentUser.uid) {
      throw new Error('Attachment not found.');
    }
    imageStoragePath = String(snap.data()?.imageStoragePath || '');
  } catch (err) {
    wrapFirestoreException(err, OperationType.GET, msgPath);
  }

  if (!imageStoragePath) {
    throw new Error('Attachment not found.');
  }

  const signedMap = await signAttachmentUrlsBatch([imageStoragePath]);
  const signedImageUrl = signedMap[imageStoragePath];
  if (!signedImageUrl) {
    throw new Error('Unable to refresh attachment URL.');
  }

  return { signedImageUrl, expiresInSeconds: 300 };
}

export async function deleteMyMessage(
  messageId: string
): Promise<{ deleted: boolean; id: string }> {
  const currentUser = await ensureVerifiedCurrentUser();
  if (!VALID_ID_REGEX.test(messageId)) {
    throw new Error('Invalid message identifier.');
  }

  const msgPath = `messages/${messageId}`;
  const msgRef = doc(db, 'messages', messageId);

  try {
    const snap = await getDoc(msgRef);
    if (!snap.exists() || snap.data()?.recipientUserId !== currentUser.uid) {
      throw new Error('Message not found in your inbox.');
    }
    const imageStoragePath = String(snap.data()?.imageStoragePath || '');
    await deleteDoc(msgRef);

    if (imageStoragePath) {
      await cleanupStorageObjectsBestEffort([imageStoragePath]);
    }

    return { deleted: true, id: messageId };
  } catch (err) {
    wrapFirestoreException(err, OperationType.DELETE, msgPath);
  }
}

export async function deleteMyAccount(confirmText: string): Promise<{ deleted: boolean }> {
  if (confirmText !== 'DELETE') {
    throw new Error('Please type DELETE to confirm permanent account deletion.');
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to delete your account.');
  }

  await currentUser.reload();
  await currentUser.getIdToken(true);

  const uid = currentUser.uid;
  const storageKeysToClean: string[] = [];

  if (currentUser.emailVerified) {
    try {
      const msgQuery = query(
        collection(db, 'messages'),
        where('recipientUserId', '==', uid)
      );
      const msgSnap = await getDocs(msgQuery);
      const msgDocs = msgSnap.docs;

      // Delete messages in chunks well under Firestore's 500-operation batch limit
      for (let i = 0; i < msgDocs.length; i += 400) {
        const chunk = msgDocs.slice(i, i + 400);
        const msgBatch = writeBatch(db);
        for (const m of chunk) {
          const imgKey = String(m.data()?.imageStoragePath || '');
          if (imgKey) storageKeysToClean.push(imgKey);
          msgBatch.delete(m.ref);
        }
        await msgBatch.commit();
      }

      const ownedPage = await queryOwnedPage(uid);
      const profileRef = doc(db, 'profiles', uid);
      const profileSnap = await getDoc(profileRef);

      const accountBatch = writeBatch(db);
      let hasAccountOps = false;

      if (ownedPage) {
        if (ownedPage.avatarPath) {
          storageKeysToClean.push(ownedPage.avatarPath);
        }
        accountBatch.delete(doc(db, 'anonymous_pages', ownedPage.id));
        accountBatch.delete(doc(db, 'usernames', ownedPage.username));
        hasAccountOps = true;
      }

      if (profileSnap.exists()) {
        accountBatch.delete(profileRef);
        hasAccountOps = true;
      }

      if (hasAccountOps) {
        await accountBatch.commit();
      }
    } catch (err) {
      wrapFirestoreException(err, OperationType.DELETE, `profiles/${uid}`);
    }

    if (storageKeysToClean.length > 0) {
      await cleanupStorageObjectsBestEffort(storageKeysToClean);
    }
  }

  await deleteUser(currentUser);
  return { deleted: true };
}

async function resolvePublicPageTarget(usernameInput: string): Promise<{
  pageId: string;
  ownerId: string;
  pageName: string;
  username: string;
  description: string;
  avatarPath: string;
  isActive: boolean;
  allowSubmissions: boolean;
}> {
  const normalized = normalizeUsername(usernameInput);
  if (!normalized || !USERNAME_REGEX.test(normalized)) {
    throw new Error('This Quietbox page could not be found.');
  }

  const claimSnap = await getDoc(doc(db, 'usernames', normalized));
  if (!claimSnap.exists()) {
    throw new Error('This Quietbox page is unavailable or does not exist.');
  }

  const pageId = String(claimSnap.data()?.pageId || '');
  if (!pageId || !VALID_ID_REGEX.test(pageId)) {
    throw new Error('This Quietbox page is unavailable or does not exist.');
  }

  try {
    const pageSnap = await getDoc(doc(db, 'anonymous_pages', pageId));
    if (!pageSnap.exists()) {
      throw new Error('This Quietbox page is unavailable or does not exist.');
    }
    const d = pageSnap.data();
    if (!d.isActive) {
      throw new Error('This Quietbox page is unavailable or does not exist.');
    }
    return {
      pageId: pageSnap.id,
      ownerId: String(d.ownerId || ''),
      pageName: String(d.pageName || ''),
      username: String(d.username || normalized),
      description: String(d.description || ''),
      avatarPath: String(d.avatarPath || ''),
      isActive: Boolean(d.isActive),
      allowSubmissions: Boolean(d.allowSubmissions),
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      // Inactive pages deny unauthenticated reads by design in firestore.rules
      throw new Error('This Quietbox page is unavailable or does not exist.');
    }
    throw err instanceof Error ? err : new Error('Unable to load this page right now.');
  }
}

export async function fetchPublicPage(username: string): Promise<{ page: PublicPageDTO }> {
  const target = await resolvePublicPageTarget(username);
  return {
    page: {
      pageName: target.pageName,
      username: target.username,
      description: target.description,
      avatarUrl: resolveAvatarPublicUrl(target.avatarPath),
      allowSubmissions: target.allowSubmissions,
    },
  };
}

export async function submitAnonymousMessage(
  username: string,
  payload: { messageText: string; imageFile?: File | null; honeypot?: string }
): Promise<{ submitted: boolean; message: string }> {
  if (payload.honeypot && payload.honeypot.trim().length > 0) {
    throw new Error('Submission rejected by spam protection.');
  }

  const target = await resolvePublicPageTarget(username);
  if (!target.allowSubmissions) {
    throw new Error('The owner of this Quietbox has paused new anonymous messages.');
  }

  const rawText = payload.messageText || '';
  if (rawText.trim().length > LIMITS.MESSAGE_TEXT_MAX) {
    throw new Error(`Message text cannot exceed ${LIMITS.MESSAGE_TEXT_MAX} characters.`);
  }

  const cleanText = sanitizeText(rawText, LIMITS.MESSAGE_TEXT_MAX);
  const hasFile = Boolean(payload.imageFile);

  if (!cleanText && !hasFile) {
    throw new Error('Please write a message or attach an image before sending.');
  }

  let imageStoragePath = '';
  if (payload.imageFile) {
    const formData = new FormData();
    if (payload.honeypot) {
      formData.append('website_url_confirm', payload.honeypot);
    }
    formData.append('image', payload.imageFile);
    const uploadRes = await fetch('/api/uploads/attachment', {
      method: 'POST',
      body: formData,
    });
    const uploaded = await parseApiJson<{ imageStoragePath: string }>(uploadRes);
    imageStoragePath = uploaded.imageStoragePath;
  } else {
    const guardRes = await fetch('/api/public/submission-guard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_url_confirm: payload.honeypot || '' }),
    });
    await parseApiJson(guardRes);
  }

  const messageId = randomSafeId('msg');
  try {
    await setDoc(doc(db, 'messages', messageId), {
      recipientUserId: target.ownerId,
      anonymousPageId: target.pageId,
      messageText: cleanText,
      imageStoragePath,
      hasImage: Boolean(imageStoragePath),
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    wrapFirestoreException(err, OperationType.CREATE, `messages/${messageId}`);
  }

  return {
    submitted: true,
    message: 'Message sent successfully.',
  };
}

export async function submitPageAbuseReport(
  username: string,
  payload: { reason: string; details: string }
): Promise<{ reported: boolean }> {
  const normalized = normalizeUsername(username);
  if (!normalized || !USERNAME_REGEX.test(normalized)) {
    throw new Error('Page not found.');
  }

  const claimSnap = await getDoc(doc(db, 'usernames', normalized));
  if (!claimSnap.exists()) {
    throw new Error('Page not found.');
  }
  const targetPageId = String(claimSnap.data()?.pageId || '');
  if (!targetPageId || !VALID_ID_REGEX.test(targetPageId)) {
    throw new Error('Page not found.');
  }

  const reason = sanitizeText(payload.reason, LIMITS.ABUSE_REASON_MAX);
  const details = sanitizeText(payload.details, LIMITS.ABUSE_DETAILS_MAX);

  if (reason.length < 3) {
    throw new Error('Please select a valid report reason.');
  }

  const reportId = randomSafeId('rep');
  try {
    await setDoc(doc(db, 'abuse_reports', reportId), {
      targetPageId,
      targetUsername: normalized,
      reason,
      details,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    wrapFirestoreException(err, OperationType.CREATE, `abuse_reports/${reportId}`);
  }

  return { reported: true };
}
