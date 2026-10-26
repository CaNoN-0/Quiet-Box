import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Quietbox Security Rules Test Suite ("Dirty Dozen" + Isolation Verification)
 * Runs automatically against the Firestore Emulator when FIRESTORE_EMULATOR_HOST is configured,
 * and statically verifies rule invariants when running in headless CI without Java/Emulator.
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');

describe('Quietbox Firestore Security Rules & Invariants', () => {
  it('ensures firestore.rules contains default-deny safety net and strict collection gates', () => {
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    expect(rulesContent).toContain("rules_version = '2';");
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
    expect(rulesContent).toContain('match /profiles/{userId}');
    expect(rulesContent).toContain('match /anonymous_pages/{pageId}');
    expect(rulesContent).toContain('match /usernames/{username}');
    expect(rulesContent).toContain('match /messages/{messageId}');
    expect(rulesContent).toContain('match /abuse_reports/{reportId}');
    expect(rulesContent).toContain("affectedKeys().hasOnly(['isRead'])");
    expect(rulesContent).toContain('request.auth.token.email_verified == true');
  });

  describe.runIf(Boolean(emulatorHost))('Live Firestore Emulator Dirty Dozen Verification', () => {
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
      const [host, portStr] = (emulatorHost || '127.0.0.1:8080').split(':');
      testEnv = await initializeTestEnvironment({
        projectId: 'quietbox-security-test',
        firestore: {
          host,
          port: Number(portStr),
          rules: fs.readFileSync(rulesPath, 'utf8'),
        },
      });
    });

    afterAll(async () => {
      if (testEnv) {
        await testEnv.cleanup();
      }
    });

    beforeEach(async () => {
      await testEnv.clearFirestore();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const adminDb = ctx.firestore();
        const now = Timestamp.now();
        await setDoc(doc(adminDb, 'anonymous_pages', 'page_b'), {
          ownerId: 'user_b',
          pageName: 'User B Quietbox',
          username: 'userb',
          description: 'Send me honest thoughts',
          avatarPath: '',
          isActive: true,
          allowSubmissions: true,
          createdAt: now,
          updatedAt: now,
        });
        await setDoc(doc(adminDb, 'anonymous_pages', 'page_disabled'), {
          ownerId: 'user_b',
          pageName: 'Disabled Box',
          username: 'disabledbox',
          description: '',
          avatarPath: '',
          isActive: true,
          allowSubmissions: false,
          createdAt: now,
          updatedAt: now,
        });
        await setDoc(doc(adminDb, 'messages', 'msg_for_b'), {
          recipientUserId: 'user_b',
          anonymousPageId: 'page_b',
          messageText: 'Private note for User B',
          imageStoragePath: '',
          hasImage: false,
          isRead: false,
          createdAt: now,
        });
        await setDoc(doc(adminDb, 'messages', 'msg_for_a'), {
          recipientUserId: 'user_a',
          anonymousPageId: 'page_a',
          messageText: 'Private note for User A',
          imageStoragePath: '',
          hasImage: false,
          isRead: false,
          createdAt: now,
        });
        await setDoc(doc(adminDb, 'profiles', 'user_b'), {
          ownerId: 'user_b',
          displayName: 'User B',
          avatarUrl: '',
          createdAt: now,
          updatedAt: now,
        });
      });
    });

    it('1. Blocks Cross-User Inbox Snooping (User A reading User B messages)', async () => {
      const userADb = testEnv.authenticatedContext('user_a', { email_verified: true }).firestore();
      await assertFails(getDoc(doc(userADb, 'messages', 'msg_for_b')));
      const q = query(collection(userADb, 'messages'), where('recipientUserId', '==', 'user_b'));
      await assertFails(getDocs(q));
    });

    it('2. Blocks Anonymous Sender Message Scraping', async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonDb, 'messages', 'msg_for_b')));
    });

    it('3. Blocks Shadow Field Injection on Profile creation', async () => {
      const userADb = testEnv.authenticatedContext('user_a', { email_verified: true }).firestore();
      await assertFails(
        setDoc(doc(userADb, 'profiles', 'user_a'), {
          ownerId: 'user_a',
          displayName: 'Alice',
          avatarUrl: '',
          isAdmin: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    it('4. Blocks Unverified Email Spoofing', async () => {
      const unverifiedDb = testEnv.authenticatedContext('user_u', { email_verified: false }).firestore();
      await assertFails(
        setDoc(doc(unverifiedDb, 'profiles', 'user_u'), {
          ownerId: 'user_u',
          displayName: 'Unverified',
          avatarUrl: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    it('5. Blocks Recipient Reassignment Hijack on messages', async () => {
      const userADb = testEnv.authenticatedContext('user_a', { email_verified: true }).firestore();
      await assertFails(
        updateDoc(doc(userADb, 'messages', 'msg_for_a'), {
          recipientUserId: 'user_b',
        })
      );
    });

    it('6. Blocks Value Poisoning on whitelisted isRead field', async () => {
      const userADb = testEnv.authenticatedContext('user_a', { email_verified: true }).firestore();
      await assertFails(
        updateDoc(doc(userADb, 'messages', 'msg_for_a'), {
          isRead: 'yes_poisoned_string',
        })
      );
    });

    it('7. Blocks Submission to Disabled Page', async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        setDoc(doc(anonDb, 'messages', 'msg_spam_1'), {
          recipientUserId: 'user_b',
          anonymousPageId: 'page_disabled',
          messageText: 'Should fail',
          imageStoragePath: '',
          hasImage: false,
          isRead: false,
          createdAt: serverTimestamp(),
        })
      );
    });

    it('8. Blocks Recipient Mismatch Spoof on message creation', async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        setDoc(doc(anonDb, 'messages', 'msg_spoof_1'), {
          recipientUserId: 'user_a', // Spoofed! page_b belongs to user_b
          anonymousPageId: 'page_b',
          messageText: 'Intercepted note',
          imageStoragePath: '',
          hasImage: false,
          isRead: false,
          createdAt: serverTimestamp(),
        })
      );
    });

    it('9. Blocks Denial-of-Wallet Oversized Payload (> 2000 chars)', async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        setDoc(doc(anonDb, 'messages', 'msg_huge'), {
          recipientUserId: 'user_b',
          anonymousPageId: 'page_b',
          messageText: 'x'.repeat(2500),
          imageStoragePath: '',
          hasImage: false,
          isRead: false,
          createdAt: serverTimestamp(),
        })
      );
    });

    it('10. Blocks Orphaned Username Claim without matching page', async () => {
      const userADb = testEnv.authenticatedContext('user_a', { email_verified: true }).firestore();
      await assertFails(
        setDoc(doc(userADb, 'usernames', 'orphan_slug'), {
          ownerId: 'user_a',
          pageId: 'nonexistent_page',
          createdAt: serverTimestamp(),
        })
      );
    });

    it('11. Blocks Timestamp Forgery on page creation', async () => {
      const userADb = testEnv.authenticatedContext('user_a', { email_verified: true }).firestore();
      const batch = writeBatch(userADb);
      const forgedDate = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
      batch.set(doc(userADb, 'anonymous_pages', 'page_forged'), {
        ownerId: 'user_a',
        pageName: 'Forged',
        username: 'forgedslug',
        description: '',
        avatarPath: '',
        isActive: true,
        allowSubmissions: true,
        createdAt: forgedDate,
        updatedAt: forgedDate,
      });
      batch.set(doc(userADb, 'usernames', 'forgedslug'), {
        ownerId: 'user_a',
        pageId: 'page_forged',
        createdAt: forgedDate,
      });
      await assertFails(batch.commit());
    });

    it('12. Blocks PII / Profile Enumeration by another authenticated user', async () => {
      const userADb = testEnv.authenticatedContext('user_a', { email_verified: true }).firestore();
      await assertFails(getDoc(doc(userADb, 'profiles', 'user_b')));
      await assertFails(getDocs(collection(userADb, 'profiles')));
    });

    it('Allows verified recipient to mark own message read and delete own message', async () => {
      const userADb = testEnv.authenticatedContext('user_a', { email_verified: true }).firestore();
      await assertSucceeds(updateDoc(doc(userADb, 'messages', 'msg_for_a'), { isRead: true }));
      await assertSucceeds(deleteDoc(doc(userADb, 'messages', 'msg_for_a')));
    });
  });
});
