import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailability, saveMyAnonymousPage } from '../lib/api';
import { LIMITS, normalizeUsername, validateUsername } from '../shared/validation';
import { ResilientAvatar, SiteFooter, TopNav } from '../components/Layout';
import { ShareLinkBar } from '../components/ShareLinkBar';

export function ManagePage() {
  const { user, profile, page, setPageState, resendVerificationEmail, reloadUserVerification } = useAuth();
  const [verificationMsg, setVerificationMsg] = useState<string | null>(null);

  const [pageName, setPageName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [allowSubmissions, setAllowSubmissions] = useState(true);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{
    checked: boolean;
    available: boolean;
    message: string;
  }>({ checked: false, available: false, message: '' });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (page) {
      setPageName(page.pageName);
      setUsername(page.username);
      setDescription(page.description);
      setIsActive(page.isActive);
      setAllowSubmissions(page.allowSubmissions);
      setAvatarPreview(page.avatarUrl || '');
    } else if (profile || user) {
      const baseName = profile?.displayName || user?.displayName || 'My Quietbox';
      setPageName(baseName);
    }
  }, [page, profile, user]);

  // Live debounced username availability check
  useEffect(() => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      setSlugStatus({ checked: false, available: false, message: '' });
      return;
    }

    const localCheck = validateUsername(normalized);
    if (!localCheck.valid) {
      setSlugStatus({
        checked: true,
        available: false,
        message: localCheck.error || 'Invalid username format.',
      });
      return;
    }

    if (page && page.username === normalized) {
      setSlugStatus({
        checked: true,
        available: true,
        message: 'This is your current username.',
      });
      return;
    }

    let cancelled = false;
    setCheckingSlug(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(normalized);
        if (!cancelled) {
          setSlugStatus({
            checked: true,
            available: res.available,
            message: res.available
              ? `Available: /u/${res.normalized}`
              : res.reason || 'Username is already taken.',
          });
        }
      } catch {
        if (!cancelled) {
          setSlugStatus({ checked: false, available: false, message: '' });
        }
      } finally {
        if (!cancelled) setCheckingSlug(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, page]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Profile picture must be a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Profile picture must be 3 MB or smaller.');
      return;
    }
    setError(null);
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleClearAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setRemoveAvatar(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(null);

    const check = validateUsername(username);
    if (!check.valid) {
      setError(check.error || 'Please choose a valid username.');
      return;
    }

    setSaving(true);
    try {
      const res = await saveMyAnonymousPage({
        pageName: pageName.trim(),
        username: check.normalized,
        description: description.trim(),
        avatarFile,
        removeAvatar,
        isActive,
        allowSubmissions,
      });
      setPageState(res.page);
      setAvatarFile(null);
      setRemoveAvatar(false);
      setAvatarPreview(res.page.avatarUrl || '');
      setSavedNotice(
        page
          ? 'Your anonymous page changes have been saved.'
          : 'Your anonymous page is live! Copy and share your personal link below.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save page.');
    } finally {
      setSaving(false);
    }
  };

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://quietbox.app';
  const previewSlug = normalizeUsername(username) || 'your-username';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFC]">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {page ? 'Edit Your Anonymous Page' : 'Create Your Anonymous Page'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Customize how visitors see your Quietbox link and control when messages are accepted.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
          >
            Back to Inbox
          </Link>
        </div>

        {user && !user.emailVerified && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-amber-950">
              <p className="font-semibold">Verify your email to publish your Quietbox page</p>
              <p className="mt-0.5 text-amber-900">
                Click the verification link sent to <span className="font-medium">{user.email}</span>, then click Refresh Status below.
              </p>
              {verificationMsg && (
                <p className="mt-1.5 text-xs font-medium text-amber-950">{verificationMsg}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resendVerificationEmail();
                    setVerificationMsg('Verification email sent. Check your inbox and spam folder.');
                  } catch (err) {
                    setVerificationMsg(err instanceof Error ? err.message : 'Unable to send email right now.');
                  }
                }}
                className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await reloadUserVerification();
                  setVerificationMsg(
                    ok
                      ? 'Email verified! You can now save your page.'
                      : 'Still waiting for verification. Click the link in your email first.'
                  );
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-800 rounded-lg hover:bg-amber-900 transition-colors cursor-pointer whitespace-nowrap"
              >
                Refresh Status
              </button>
            </div>
          </div>
        )}

        {savedNotice && page && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-medium">{savedNotice}</span>
            </div>
            <ShareLinkBar username={page.username} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left Column: Page Creation / Edit Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6"
          >
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Profile Picture Upload */}
            <div>
              <span className="block text-sm font-medium text-slate-700">
                Optional Profile Picture
              </span>
              <div className="mt-3 flex items-center gap-4">
                <ResilientAvatar
                  src={avatarPreview}
                  name={pageName || 'Q'}
                  sizeClass="w-16 h-16 text-xl"
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap">
                    <ImagePlus className="w-4 h-4 text-violet-700" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarChange}
                      className="sr-only"
                    />
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleClearAvatar}
                      className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG, or WebP up to 3 MB. Automatically cropped and stripped of metadata.
              </p>
            </div>

            {/* Page Name */}
            <div>
              <label htmlFor="page-name" className="block text-sm font-medium text-slate-700">
                Page Name
              </label>
              <input
                id="page-name"
                type="text"
                required
                maxLength={LIMITS.PAGE_NAME_MAX}
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                placeholder="e.g. Maya's Quietbox"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
              />
            </div>

            {/* Unique Username / Slug */}
            <div>
              <label htmlFor="page-username" className="block text-sm font-medium text-slate-700">
                Unique Username (URL Slug)
              </label>
              <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white focus-within:border-violet-600 focus-within:ring-2 focus-within:ring-violet-600/20 overflow-hidden">
                <span className="inline-flex items-center bg-slate-50 px-3.5 text-xs font-mono text-slate-500 border-r border-slate-200 select-none">
                  /u/
                </span>
                <input
                  id="page-username"
                  type="text"
                  required
                  minLength={LIMITS.USERNAME_MIN}
                  maxLength={LIMITS.USERNAME_MAX}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="yourname"
                  className="w-full px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                {checkingSlug ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking availability...</span>
                  </span>
                ) : slugStatus.checked ? (
                  <span
                    className={
                      slugStatus.available ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'
                    }
                  >
                    {slugStatus.message}
                  </span>
                ) : (
                  <span className="text-slate-500">
                    3–30 lowercase letters, numbers, hyphens, or underscores.
                  </span>
                )}
              </div>
            </div>

            {/* Optional Description */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="page-desc" className="block text-sm font-medium text-slate-700">
                  Short Prompt or Description (Optional)
                </label>
                <span className="text-xs text-slate-400 tabular-nums">
                  {description.length}/{LIMITS.DESCRIPTION_MAX}
                </span>
              </div>
              <textarea
                id="page-desc"
                rows={3}
                maxLength={LIMITS.DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ask me anything anonymously, share honest feedback, or drop a photo..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
              />
            </div>

            {/* Page Visibility & Submission Controls */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <span className="block text-sm font-medium text-slate-900">
                    Page Active &amp; Publicly Visible
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    When disabled, opening your link shows a page unavailable screen.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
                />
              </label>

              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <span className="block text-sm font-medium text-slate-900">
                    Allow New Anonymous Submissions
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Pause incoming messages temporarily while keeping your page visible.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allowSubmissions}
                  onChange={(e) => setAllowSubmissions(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
                />
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || (slugStatus.checked && !slugStatus.available)}
                className="w-full rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {saving
                  ? 'Saving Page...'
                  : page
                    ? 'Save Page Changes'
                    : 'Publish My Anonymous Page'}
              </button>
            </div>
          </form>

          {/* Right Column: Live Public Page Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="font-semibold text-slate-700">Live Public Page Preview</span>
              <span className="font-mono truncate max-w-[220px]">
                {origin}/u/{previewSlug}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
              {!isActive ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-slate-900">Page Currently Disabled</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Visitors will not see your page while Page Active is turned off.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3.5">
                    <ResilientAvatar
                      src={avatarPreview}
                      name={pageName || 'Quietbox'}
                      sizeClass="w-12 h-12 text-base"
                    />
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-900 truncate">
                        {pageName.trim() || 'Your Page Name'}
                      </h2>
                      <p className="text-xs font-mono text-slate-500 truncate">/u/{previewSlug}</p>
                    </div>
                  </div>

                  {description.trim() && (
                    <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                      {description.trim()}
                    </p>
                  )}

                  {allowSubmissions ? (
                    <div className="mt-5 space-y-3 pointer-events-none select-none opacity-85">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-400 h-24">
                        Write an anonymous message...
                      </div>
                      <div className="rounded-xl border border-dashed border-slate-200 px-3.5 py-2.5 text-xs text-slate-500 text-center">
                        Attach an image (optional)
                      </div>
                      <div className="rounded-xl bg-violet-700 py-2.5 text-center text-xs font-semibold text-white">
                        Send Anonymously
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 text-center">
                      New anonymous submissions are currently paused by the page owner.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
