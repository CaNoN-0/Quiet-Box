import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { mapFirebaseAuthError, useAuth } from '../context/AuthContext';
import {
  deleteMyAccount,
  saveMyAnonymousPage,
  updateMyProfile,
} from '../lib/api';
import { LIMITS } from '../shared/validation';
import { ConfirmModal, SiteFooter, TopNav } from '../components/Layout';
import { ShareLinkBar } from '../components/ShareLinkBar';

export function SettingsPage() {
  const {
    user,
    profile,
    page,
    setProfileState,
    setPageState,
    changeAccountPassword,
    reauthenticateForDeletion,
    signOut,
  } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [togglingPage, setTogglingPage] = useState(false);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasPasswordProvider = Boolean(
    user?.providerData.some((p) => p.providerId === 'password')
  );

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileNotice(null);
    setSavingProfile(true);
    try {
      const res = await updateMyProfile(displayName.trim());
      setProfileState(res.profile);
      setProfileNotice('Account display name updated.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleQuickToggle = async (field: 'isActive' | 'allowSubmissions', nextValue: boolean) => {
    if (!page) return;
    setTogglingPage(true);
    setPageNotice(null);
    try {
      const res = await saveMyAnonymousPage({
        pageName: page.pageName,
        username: page.username,
        description: page.description,
        isActive: field === 'isActive' ? nextValue : page.isActive,
        allowSubmissions: field === 'allowSubmissions' ? nextValue : page.allowSubmissions,
      });
      setPageState(res.page);
      setPageNotice('Anonymous page preferences saved.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update page state.');
    } finally {
      setTogglingPage(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      await changeAccountPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordNotice('Your password has been updated.');
    } catch (err) {
      setPasswordError(mapFirebaseAuthError(err).message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleConfirmAccountDeletion = async () => {
    setDeleteError(null);
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE in uppercase to confirm.');
      return;
    }
    setDeletingAccount(true);
    try {
      if (hasPasswordProvider && deletePassword) {
        await reauthenticateForDeletion(deletePassword);
      }
      await deleteMyAccount('DELETE');
      await signOut();
      navigate('/');
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Unable to delete account right now.'
      );
      setDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFC]">
      <TopNav />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your anonymous page controls, share link, account security, and data.
          </p>
        </div>

        {/* 1. Anonymous Page & Share Link Controls */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Anonymous Page Controls</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Edit your page details, change your username slug, or pause submissions.
              </p>
            </div>
            <Link
              to="/page"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              <span>{page ? 'Edit Page & Username' : 'Create Page'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pageNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs font-medium text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{pageNotice}</span>
            </div>
          )}

          {page ? (
            <>
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <label className="flex items-start justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="block text-sm font-medium text-slate-900">
                      Enable Anonymous Submissions
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Turn off anytime to stop new messages without deleting your existing inbox.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={togglingPage}
                    checked={page.allowSubmissions}
                    onChange={(e) => handleQuickToggle('allowSubmissions', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
                  />
                </label>

                <label className="flex items-start justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="block text-sm font-medium text-slate-900">
                      Public Page Visibility
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Keep your <span className="font-mono">/u/{page.username}</span> link publicly reachable.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={togglingPage}
                    checked={page.isActive}
                    onChange={(e) => handleQuickToggle('isActive', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
                  />
                </label>
              </div>

              <div className="pt-2">
                <ShareLinkBar username={page.username} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              You have not created your anonymous page yet. Click <strong>Create Page</strong> above to claim your personal URL.
            </p>
          )}
        </section>

        {/* 2. Profile Information */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Account Profile</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Your private account email ({user?.email || 'Google Account'}) is never shown on your public page.
          </p>

          <form onSubmit={handleSaveProfile} className="mt-5 max-w-md space-y-4">
            {profileError && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}
            {profileNotice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{profileNotice}</span>
              </div>
            )}

            <div>
              <label htmlFor="settings-display-name" className="block text-sm font-medium text-slate-700">
                Account Display Name
              </label>
              <input
                id="settings-display-name"
                type="text"
                required
                maxLength={LIMITS.DISPLAY_NAME_MAX}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </section>

        {/* 3. Account Security & Change Password */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Account Security</h2>
          {hasPasswordProvider ? (
            <form onSubmit={handlePasswordSubmit} className="mt-4 max-w-md space-y-4">
              {passwordError && (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-800">
                  {passwordError}
                </div>
              )}
              {passwordNotice && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900">
                  {passwordNotice}
                </div>
              )}

              <div>
                <label htmlFor="current-pw" className="block text-sm font-medium text-slate-700">
                  Current Password
                </label>
                <input
                  id="current-pw"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
                />
              </div>

              <div>
                <label htmlFor="new-pw" className="block text-sm font-medium text-slate-700">
                  New Password
                </label>
                <input
                  id="new-pw"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {changingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Your account is authenticated securely via Google Sign-In ({user?.email}). Password management and two-factor authentication are handled directly by your Google account.
            </p>
          )}
        </section>

        {/* 4. Danger Zone — Permanent Account Deletion */}
        <section className="rounded-2xl border border-red-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-red-700">Delete Account</h2>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            Permanently delete your Quietbox account, release your username slug, erase every message in your inbox, and purge all stored private image attachments.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmText('');
                setDeletePassword('');
                setDeleteError(null);
                setDeleteModalOpen(true);
              }}
              className="rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              Delete My Account
            </button>
          </div>
        </section>
      </main>

      <ConfirmModal
        open={deleteModalOpen}
        title="Permanently delete your Quietbox account?"
        description="This immediately erases your profile, public page, received messages, and stored image attachments. This action cannot be undone."
        confirmLabel="Permanently Delete Account"
        danger
        loading={deletingAccount}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmAccountDeletion}
      >
        <div className="space-y-3">
          {deleteError && (
            <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {deleteError}
            </p>
          )}
          {hasPasswordProvider && (
            <div>
              <label htmlFor="del-pw" className="block text-xs font-medium text-slate-700">
                Current Password (optional if recently signed in)
              </label>
              <input
                id="del-pw"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none"
              />
            </div>
          )}
          <div>
            <label htmlFor="del-confirm-word" className="block text-xs font-medium text-slate-700">
              Type <span className="font-mono font-bold text-slate-900">DELETE</span> to confirm
            </label>
            <input
              id="del-confirm-word"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>
      </ConfirmModal>

      <SiteFooter />
    </div>
  );
}
