# Quietbox — Calm, Private Anonymous Messaging

Quietbox is a full-stack anonymous messaging platform where users create personal anonymous pages (`/u/username`), share their links across social platforms, and receive text and sanitized image submissions inside an isolated private inbox.

---

## Architecture & Stack Choice

- **Frontend**: React 19, TypeScript, Vite, React Router, Tailwind CSS v4.
- **Backend & Security**: Express (`server.ts`) API server enforcing Firebase ID token verification, sliding-window rate limits, honeypot anti-spam checks, magic-byte file signature inspection, `sharp` image decoding/EXIF stripping/WebP re-encoding, and short-lived signed attachment URLs.
- **Authentication & Persistent Database**:
  - **Live Runtime**: Provisioned on **Firebase Authentication + Cloud Firestore Enterprise + Cloud Storage** (`firebase-applet-config.json` & `firestore.rules`) because managed PostgreSQL provisioning in this environment required an external billing project. Every private isolation requirement is enforced both on the Express server and via zero-trust Attribute-Based Access Control in `firestore.rules`.
  - **PostgreSQL / Supabase Portability**: A complete SQL migration and Row Level Security policy file is included at `supabase/migrations/001_initial_schema.sql` for teams deploying against Supabase PostgreSQL + Supabase Storage.

---

## Project Structure

```text
/
├── server.ts                                 # Express + Vite full-stack server entry point (Port 3000)
├── firebase-blueprint.json                   # Data entity & collection schema blueprint
├── firestore.rules                           # Zero-trust Firestore security rules
├── firestore.rules.test.ts                   # Dirty Dozen security rules & emulator test suite
├── security_spec.md                          # Security invariants & Red Team audit report
├── supabase/migrations/001_initial_schema.sql# Equivalent PostgreSQL schema, indexes, buckets & RLS
├── src/
│   ├── shared/validation.ts                  # Shared slug, length, and input sanitization rules
│   ├── server/
│   │   ├── app.ts                            # API routes (auth, pages, inbox, public submit, reports)
│   │   ├── firebaseAdmin.ts                  # Admin SDK initialization (zero client secrets)
│   │   ├── imageSecurity.ts                  # Magic-byte inspection + Sharp EXIF strip & WebP encode
│   │   ├── rateLimit.ts                      # Sliding-window IP rate limiter
│   │   ├── repository.ts                     # Transactional persistence & strict recipient scoping
│   │   └── storage.ts                        # Private object storage & HMAC/v4 short-lived signed URLs
│   ├── lib/
│   │   ├── firebase.ts                       # Client Firebase Auth/Firestore SDK initialization
│   │   └── api.ts                            # Typed API client with in-memory Bearer ID tokens
│   ├── context/AuthContext.tsx               # Session persistence, Email/Google auth, verification
│   ├── components/
│   │   ├── Layout.tsx                        # 3-zone header, footer, resilient avatars, modals
│   │   └── ShareLinkBar.tsx                  # Copy Link + WhatsApp, X, Telegram, Facebook sharing
│   ├── pages/
│   │   ├── LandingPage.tsx                   # Public product landing page
│   │   ├── AuthPages.tsx                     # Sign Up, Sign In, and Password Reset pages
│   │   ├── DashboardPage.tsx                 # Private Inbox + First-time empty state
│   │   ├── ManagePage.tsx                    # Create & edit anonymous page + live preview
│   │   ├── PublicSubmitPage.tsx              # Public /u/:username anonymous submission & report page
│   │   ├── SettingsPage.tsx                  # Page toggles, profile, password, and account deletion
│   │   └── LegalAndNotFoundPages.tsx         # Privacy Policy, Terms of Service, and 404 page
│   └── tests/quietbox.api.test.ts            # Multi-user isolation, upload security & E2E API tests
└── .env.example                              # Environment variable template (no secrets)
```

---

## Local Development & Verification Commands

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Copy environment template**
   ```bash
   cp .env.example .env
   ```

3. **Start the full-stack development server (Port 3000)**
   ```bash
   npm run dev
   ```

4. **Run TypeScript type-checking & Firestore rules lint**
   ```bash
   npm run lint
   npm run lint:rules
   ```

5. **Run automated security & API test suite**
   ```bash
   npm test
   ```

6. **Build for production**
   ```bash
   npm run build
   npm start
   ```

---

## Enabling Email/Password Sign-In & Redirect URLs

Google Sign-In works immediately out of the box. To also enable Email/Password registration, email verification links, and password reset emails in your Firebase project (`gen-lang-client-0767193528`):

1. Open [Firebase Console → Authentication → Sign-in method](https://console.firebase.google.com/project/gen-lang-client-0767193528/authentication/providers).
2. Click **Add new provider** → **Email/Password**, toggle **Enable**, and click **Save**.
3. Under **Authentication → Settings → Authorized domains**, ensure your production domain (e.g., your `.run.app` or `.vercel.app` domain) is listed so email verification and password reset links redirect cleanly.

---

## Deploying to Cloud Run or Vercel

1. **Environment Variables**:
   In Vercel (**Project Settings → Environment Variables**) or Cloud Run, configure:
   - `APP_URL`: Your production HTTPS origin (e.g., `https://quietbox.yourdomain.com`)
   - `MAX_UPLOAD_SIZE_MB`: `5`
   - `STORAGE_SIGNING_SECRET`: A 32-byte random hex string (`openssl rand -hex 32`)
   - *(If running outside Google Cloud with Firebase Admin)*: `GOOGLE_APPLICATION_CREDENTIALS_JSON` or Workload Identity Federation.
   - *(If using the Supabase PostgreSQL adapter)*: Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.

2. **Security Rules Review**:
   Before sharing your deployment broadly, review `firestore.rules` and `security_spec.md` and run `npm test` + `npm run lint:rules` on every schema update.
