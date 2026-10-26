import React from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter, TopNav } from '../components/Layout';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFC]">
      <TopNav />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-14">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 space-y-6 text-slate-700 leading-relaxed">
          <div>
            <p className="text-xs text-slate-500">Last updated: October 2026</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Privacy Policy
            </h1>
          </div>

          <p className="text-sm">
            Quietbox is built so registered users can receive honest notes and images in a calm, private inbox without asking senders to create accounts or provide personal contact details. Below is a transparent explanation of what data is stored, what technical controls exist, and how deletion works.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              1. Information Collected from Account Owners
            </h2>
            <p className="text-sm">
              When you register for a Quietbox account, we store your authentication credentials (managed via Firebase Authentication), your display name, and the public page settings you configure (page name, username slug, optional description, and optional avatar). Your email address is never displayed on your public page or exposed in public API responses.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              2. Information Collected from Anonymous Senders
            </h2>
            <p className="text-sm">
              Quietbox does not ask anonymous senders for their name, email address, phone number, or social media handle, and we never display sender identity to the message recipient.
            </p>
            <p className="text-sm">
              <strong>Honest Technical Disclosure:</strong> Like any web service, Quietbox cannot promise absolute cryptographic network anonymity against infrastructure-level abuse. To protect recipients from automated spam and denial-of-service floods, our server temporarily evaluates request IP addresses in volatile server memory for sliding-window rate limiting (retained in memory for 10 to 15 minutes) and standard cloud hosting infrastructure (such as Google Cloud Run / Firebase) may retain routine operational HTTP access logs for security and abuse prevention in accordance with standard cloud retention windows (typically up to 30 days). Sender IP addresses are never written into message records or shared with page owners.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              3. Image Sanitization &amp; Private Storage
            </h2>
            <p className="text-sm">
              Uploaded images (JPG, PNG, WebP) are inspected on the server by file signature, decoded, stripped of camera EXIF and GPS location metadata, and re-encoded into clean WebP objects under randomized filenames. Message attachments are stored privately and are only viewable by the authenticated recipient via short-lived signed URLs.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              4. Message &amp; Account Deletion
            </h2>
            <p className="text-sm">
              When a recipient deletes a message, both the database record and any associated private storage object are permanently deleted. When an account owner deletes their account from Settings, their profile, anonymous page, username claim, inbox messages, and stored images are permanently purged.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFC]">
      <TopNav />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-14">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 space-y-6 text-slate-700 leading-relaxed">
          <div>
            <p className="text-xs text-slate-500">Effective: October 2026</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Terms of Service
            </h1>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">1. Acceptable Use</h2>
            <p className="text-sm">
              Quietbox is designed for constructive feedback, candid thoughts, and personal notes. You agree not to use Quietbox to send threats, harassment, non-consensual intimate imagery, malware, impersonation pages, illegal material, or automated spam.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">2. Recipient Controls</h2>
            <p className="text-sm">
              Every Quietbox page owner can pause anonymous submissions, disable their public page, or delete individual messages at any time. Visitors can report abusive or impersonating pages directly from any public page.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">3. One-Way Communication</h2>
            <p className="text-sm">
              Submissions on Quietbox are strictly one-way. Sending a message does not create a conversation thread, and senders cannot view, edit, or retrieve messages after submission.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">4. Service Availability &amp; Safety Enforcement</h2>
            <p className="text-sm">
              We enforce server-side upload limits, file signature verification, and rate limits to protect users. Pages or submissions that violate these terms or endanger user safety may be disabled or removed.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFC]">
      <TopNav />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center">
          <p className="font-mono text-xs font-medium text-violet-700">404</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            The page you are looking for does not exist or may have moved.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              to="/"
              className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 transition-colors"
            >
              Back to Quietbox
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
