import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Inbox,
  MailCheck,
  Maximize2,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  deleteMyMessage,
  fetchMyMessages,
  InboxMessageDTO,
  refreshSignedAttachmentUrl,
  toggleMessageRead,
} from '../lib/api';
import { ConfirmModal, SiteFooter, TopNav } from '../components/Layout';
import { ShareLinkBar } from '../components/ShareLinkBar';

function formatMessageTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function DashboardPage() {
  const {
    user,
    page,
    accountError,
    resendVerificationEmail,
    reloadUserVerification,
  } = useAuth();

  const [messages, setMessages] = useState<InboxMessageDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [lightboxImage, setLightboxImage] = useState<{ url: string; id: string } | null>(null);
  const [verificationStatusMsg, setVerificationStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadInbox = useCallback(
    async (reset = true, cursor?: string) => {
      if (!user) return;
      try {
        if (reset) {
          setLoadingInbox(true);
        } else {
          setLoadingMore(true);
        }
        setInboxError(null);
        const res = await fetchMyMessages({
          limit: 15,
          cursor: reset ? undefined : cursor,
          search: debouncedSearch || undefined,
        });
        setMessages((prev) => (reset ? res.messages : [...prev, ...res.messages]));
        setNextCursor(res.nextCursor);
        setUnreadCount(res.unreadCount);
        setTotalCount(res.totalCount);
      } catch (err) {
        setInboxError(err instanceof Error ? err.message : 'Unable to load messages.');
      } finally {
        setLoadingInbox(false);
        setLoadingMore(false);
      }
    },
    [user, debouncedSearch]
  );

  useEffect(() => {
    if (page) {
      loadInbox(true);
    } else {
      setLoadingInbox(false);
    }
  }, [page, loadInbox]);

  const handleToggleRead = async (msg: InboxMessageDTO) => {
    const nextRead = !msg.isRead;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isRead: nextRead } : m))
    );
    setUnreadCount((c) => Math.max(0, c + (nextRead ? -1 : 1)));
    try {
      await toggleMessageRead(msg.id, nextRead);
    } catch {
      // Revert optimistic toggle if network fails
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isRead: msg.isRead } : m))
      );
      setUnreadCount((c) => Math.max(0, c + (nextRead ? 1 : -1)));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const targetMsg = messages.find((m) => m.id === deleteTargetId);
      await deleteMyMessage(deleteTargetId);
      setMessages((prev) => prev.filter((m) => m.id !== deleteTargetId));
      setTotalCount((c) => Math.max(0, c - 1));
      if (targetMsg && !targetMsg.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setDeleteTargetId(null);
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'Failed to delete message.');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenImage = async (msg: InboxMessageDTO) => {
    if (!msg.signedImageUrl) return;
    setLightboxImage({ url: msg.signedImageUrl, id: msg.id });
    if (!msg.isRead) {
      await handleToggleRead(msg);
    }
  };

  const handleRefreshExpiredAttachment = async (messageId: string) => {
    try {
      const { signedImageUrl } = await refreshSignedAttachmentUrl(messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, signedImageUrl } : m))
      );
      if (lightboxImage?.id === messageId) {
        setLightboxImage({ url: signedImageUrl, id: messageId });
      }
    } catch {
      // Attachment was deleted or inaccessible
    }
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail();
      setVerificationStatusMsg('Verification email sent. Check your inbox and click Refresh Status.');
    } catch (err) {
      setVerificationStatusMsg(
        err instanceof Error ? err.message : 'Could not send verification email right now.'
      );
    }
  };

  const handleCheckVerification = async () => {
    const verified = await reloadUserVerification();
    setVerificationStatusMsg(
      verified
        ? 'Your email address is now verified.'
        : 'Email not verified yet. Please click the link sent to your email.'
    );
  };

  const displayedMessages =
    filterMode === 'unread' ? messages.filter((m) => !m.isRead) : messages;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFC]">
      <TopNav />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 space-y-8">
        {/* Email Verification Notice (for unverified email/password accounts) */}
        {user && !user.emailVerified && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-amber-950">
              <p className="font-semibold">Verify your email address</p>
              <p className="mt-0.5 text-amber-900">
                We sent a verification link to <span className="font-medium">{user.email}</span>. Verify your email to keep your account recoverable.
              </p>
              {verificationStatusMsg && (
                <p className="mt-1.5 text-xs font-medium text-amber-950">{verificationStatusMsg}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResendVerification}
                className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={handleCheckVerification}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-800 rounded-lg hover:bg-amber-900 transition-colors cursor-pointer whitespace-nowrap"
              >
                Refresh Status
              </button>
            </div>
          </div>
        )}

        {accountError && (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{accountError}</span>
          </div>
        )}

        {/* FIRST-TIME DASHBOARD EXPERIENCE (No Page Created Yet) */}
        {!page ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-16 sm:px-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 border border-violet-100">
              <Inbox className="w-6 h-6" />
            </div>
            <h1 className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Your inbox is waiting.
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-base text-slate-600 leading-relaxed">
              Create your own anonymous page, share your link with friends and followers, and receive messages without knowing who sent them.
            </p>
            <div className="mt-8">
              <Link
                to="/page"
                className="inline-flex items-center justify-center rounded-xl bg-violet-700 px-6 py-3.5 text-sm font-semibold text-white hover:bg-violet-800 transition-colors whitespace-nowrap"
              >
                Create My Anonymous Page
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Page Header & Status */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                  <span>{page.isActive ? 'Public page active' : 'Public page hidden'}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {page.allowSubmissions ? 'Accepting submissions' : 'Submissions paused'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{totalCount} total</span>
                  {unreadCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-violet-700">{unreadCount} unread</span>
                    </>
                  )}
                </div>
                <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {page.pageName}
                </h1>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => loadInbox(true)}
                  disabled={loadingInbox}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingInbox ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <Link
                  to="/page"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Settings className="w-4 h-4" />
                  <span>Edit Page</span>
                </Link>
              </div>
            </div>

            {/* Shareable Link Box */}
            <ShareLinkBar username={page.username} />

            {/* Inbox Search & Segmented Filter Controls */}
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages in your inbox..."
                    aria-label="Search messages"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
                  />
                </div>

                {/* Interactive Filter Controls */}
                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      filterMode === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('unread')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      filterMode === 'unread'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>
              </div>

              {inboxError && (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{inboxError}</span>
                </div>
              )}

              {/* Loading Skeletons */}
              {loadingInbox ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse"
                    >
                      <div className="h-3.5 w-44 rounded bg-slate-200" />
                      <div className="mt-4 h-4 w-3/4 rounded bg-slate-100" />
                      <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : displayedMessages.length === 0 ? (
                /* Empty Inbox State */
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
                  <Inbox className="w-8 h-8 text-slate-400 mx-auto" />
                  <h2 className="mt-3 text-lg font-semibold text-slate-900">
                    {debouncedSearch
                      ? 'No messages match your search'
                      : filterMode === 'unread'
                        ? 'You are all caught up'
                        : 'No anonymous messages yet'}
                  </h2>
                  <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
                    {debouncedSearch
                      ? 'Try searching for a different word or clear your search filter.'
                      : 'Copy your Quietbox link above and share it with friends or followers to receive your first anonymous note.'}
                  </p>
                </div>
              ) : (
                /* Populated Message Cards */
                <div className="space-y-4">
                  {displayedMessages.map((msg) => (
                    <article
                      key={msg.id}
                      className={`rounded-2xl border bg-white p-6 transition-colors ${
                        msg.isRead ? 'border-slate-200' : 'border-violet-300 bg-violet-50/15'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Unboxed Metadata with typographic separators */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                          <span className="font-semibold text-slate-800">Anonymous Sender</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={msg.createdAt}>{formatMessageTimestamp(msg.createdAt)}</time>
                          {!msg.isRead && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-violet-700">Unread</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleRead(msg)}
                            title={msg.isRead ? 'Mark as unread' : 'Mark as read'}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {msg.isRead ? (
                              <>
                                <MailCheck className="w-3.5 h-3.5" />
                                <span>Mark Unread</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 text-violet-700" />
                                <span className="text-violet-700 font-semibold">Mark Read</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(msg.id)}
                            title="Delete message permanently"
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      {msg.messageText && (
                        <p className="mt-4 whitespace-pre-wrap text-base text-slate-800 leading-relaxed">
                          {msg.messageText}
                        </p>
                      )}

                      {msg.hasImage && msg.signedImageUrl && (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => handleOpenImage(msg)}
                            className="group relative inline-block overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 cursor-pointer"
                          >
                            <img
                              src={msg.signedImageUrl}
                              alt="Anonymous message attachment"
                              referrerPolicy="no-referrer"
                              onError={() => handleRefreshExpiredAttachment(msg.id)}
                              className="max-h-72 w-auto object-contain transition-transform duration-150 group-hover:scale-[1.01]"
                            />
                            <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-lg bg-slate-900/75 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
                              <Maximize2 className="w-3 h-3" />
                              <span>View Full Image</span>
                            </span>
                          </button>
                        </div>
                      )}
                    </article>
                  ))}

                  {nextCursor && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        disabled={loadingMore}
                        onClick={() => loadInbox(false, nextCursor)}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {loadingMore ? 'Loading More...' : 'Load Older Messages'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        open={Boolean(deleteTargetId)}
        title="Delete this message?"
        description="This message and any attached private image will be permanently deleted from your Quietbox. This cannot be undone."
        confirmLabel="Delete Message"
        danger
        loading={deleting}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Fullscreen Private Attachment Viewer */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Close image viewer"
              className="absolute -top-11 right-0 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
            <img
              src={lightboxImage.url}
              alt="Full size anonymous attachment"
              referrerPolicy="no-referrer"
              className="max-h-[85vh] w-auto rounded-xl object-contain bg-slate-900"
            />
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
