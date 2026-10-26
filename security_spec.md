# Quietbox Security Specification (Phase 0 TDD)

## 1. Data Invariants & Master Source of Truth

1. **Identity Isolation (`profiles/{userId}`)**:
   - Only a verified authenticated user whose `request.auth.uid == userId` can read, create, update, or delete their own profile.
   - `ownerId` must equal `userId` and `request.auth.uid`, and is immutable after creation.
   - Zero PII (`email`, `phone`, `ip`) is stored in public documents.

2. **Anonymous Page Ownership (`anonymous_pages/{pageId}` & `usernames/{username}`)**:
   - Every `anonymous_pages` document is owned strictly by `ownerId == request.auth.uid`.
   - Public visitors can `get` an `anonymous_pages/{pageId}` document ONLY when `resource.data.isActive == true`. Public `list` is strictly forbidden unless `resource.data.ownerId == request.auth.uid`.
   - Username uniqueness is enforced via `usernames/{username}` where `{username}` matches `^[a-z0-9_\-]{3,30}$`. Creating or changing a username requires an atomic `existsAfter` guarantee linking `usernames/{username}` and `anonymous_pages/{pageId}`.

3. **Private Inbox Isolation (`messages/{messageId}`)**:
   - Anonymous submissions are processed and validated through the trusted server API (`/api/public/pages/:username/messages`) using Firebase Admin SDK (which enforces magic-byte image inspection, rate limiting, and recipient derivation from the target page), AND hardened in Firestore rules so even direct SDK calls cannot spoof recipients or read anyone's messages.
   - No anonymous visitor or non-recipient user can EVER `get` or `list` any document in `messages`.
   - Only a verified user where `resource.data.recipientUserId == request.auth.uid` can `get`, `list`, `update` (strictly `isRead` toggle only), or `delete` their own received messages.
   - Users can NEVER modify `recipientUserId`, `anonymousPageId`, `messageText`, `imageStoragePath`, or `createdAt` on an existing message.

4. **Write-Only Abuse Reports (`abuse_reports/{reportId}`)**:
   - Nobody can read, list, update, or delete `abuse_reports` from client SDKs (`allow read, update, delete: if false;`).
   - Creation requires referencing an existing `anonymous_pages/{targetPageId}` document with bounded reason and details strings and `createdAt == request.time`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Cross-User Inbox Snooping (`messages` list/get)**:
   - User A (`uid: "user_a"`) queries `messages` where `recipientUserId == "user_b"`. -> `PERMISSION_DENIED`
2. **Anonymous Sender Message Scraping (`messages` get)**:
   - Unauthenticated sender attempts to read `/messages/msg_123` right after submitting it. -> `PERMISSION_DENIED`
3. **Shadow Field Injection on Profile (`profiles` create)**:
   - User A creates `/profiles/user_a` with `{ ownerId: "user_a", displayName: "Alice", avatarUrl: "", isAdmin: true, createdAt: SERVER_TIME, updatedAt: SERVER_TIME }`. -> `PERMISSION_DENIED` (`hasOnly` blocks `isAdmin`).
4. **Unverified Email Spoofing (`profiles` create)**:
   - Authenticated user with `email_verified: false` attempts to write `/profiles/user_unverified`. -> `PERMISSION_DENIED`.
5. **Recipient Reassignment Hijack (`messages` update)**:
   - User A updates `/messages/msg_owned_by_b` or `/messages/msg_owned_by_a` changing `recipientUserId` to `"user_a"` or mutating `messageText`. -> `PERMISSION_DENIED`.
6. **Value Poisoning on Whitelisted Key (`messages` update)**:
   - User A updates `isRead` on `/messages/msg_owned_by_a` with `"yes_string"` instead of `boolean`. -> `PERMISSION_DENIED` (`isValidMessage` blocks non-boolean).
7. **Submission to Disabled Page (`messages` create)**:
   - Direct client SDK attempts to create `/messages/msg_spam` targeting `anonymousPageId: "page_disabled"` where `allowSubmissions == false` or `isActive == false`. -> `PERMISSION_DENIED`.
8. **Recipient Mismatch Spoof (`messages` create)**:
   - Direct client SDK creates `/messages/msg_spoof` with `anonymousPageId: "page_b"` (owned by `user_b`) while setting `recipientUserId: "user_a"` so `user_a` can read submissions meant for `user_b`. -> `PERMISSION_DENIED` (`get()` checks target page `ownerId == incoming().recipientUserId`).
9. **Denial-of-Wallet Oversized Payload (`messages` create)**:
   - Payload injects a 10,000-character `messageText` or 500-character `messageId`. -> `PERMISSION_DENIED`.
10. **Orphaned Username Claim (`usernames` create)**:
    - User A claims `/usernames/coolslug` pointing to `pageId: "nonexistent_page"` without creating `/anonymous_pages/nonexistent_page` in the same batch. -> `PERMISSION_DENIED` (`existsAfter` check fails).
11. **Timestamp Forgery (`anonymous_pages` create/update)**:
    - User A sets `createdAt` to a past timestamp `2020-01-01T00:00:00Z` instead of `request.time`. -> `PERMISSION_DENIED`.
12. **PII / Profile Enumeration (`profiles` get/list)**:
    - Authenticated User A attempts `get(/profiles/user_b)` or `list(/profiles)`. -> `PERMISSION_DENIED`.

---

## 3. Red Team Audit Matrix

| Collection | Identity Spoofing | Shadow Update (`hasOnly`) | Value Poisoning (`isValid*`) | Query Trust (`allow list`) | PII Isolation | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `profiles` | Blocked (`ownerId == uid == userId`) | Blocked (`affectedKeys().hasOnly`) | Blocked (`isValidProfile`) | `list` denied (`if false`) | Owner-only `get` | PASS |
| `anonymous_pages` | Blocked (`ownerId == uid`) | Blocked (`affectedKeys().hasOnly`) | Blocked (`isValidAnonymousPage`) | Restricted (`ownerId == uid`) | Public fields only when `isActive` | PASS |
| `usernames` | Blocked (`ownerId == uid`) | Updates denied (`if false`) | Blocked (`isValidUsernameClaim`) | `list` denied (`if false`) | Maps slug -> pageId only | PASS |
| `messages` | Derived via `get(page).ownerId` | Only `['isRead']` mutable | Blocked (`isValidMessage`) | Restricted (`recipientUserId == uid`) | Zero sender PII; owner-only read | PASS |
| `abuse_reports` | Write-only (`read: if false`) | Updates denied (`if false`) | Blocked (`isValidAbuseReport`) | `list` denied (`if false`) | Write-only server triage | PASS |
