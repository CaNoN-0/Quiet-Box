import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Flag,
  ImagePlus,
  Send,
  Trash2,
} from 'lucide-react';
import {
  fetchPublicPage,
  PublicPageDTO,
  submitAnonymousMessage,
  submitPageAbuseReport,
} from '../lib/api';
import { LIMITS } from '../shared/validation';
import { QuietboxMark, ResilientAvatar, SiteFooter } from '../components/Layout';

export function PublicSubmitPage() {
  const { username = '' } = useParams<{ username: string }>();

  const [page, setPage] = useState<PublicPageDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  const [messageText, setMessageText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [honeypot, setHoneypot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Impersonation or fake profile');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFoundError(null);

    fetchPublicPage(username)
      .then((res) => {
        if (active) setPage(res.page);
      })
      .catch((err) => {
        if (active) {
          setNotFoundError(
            err instanceof Error ? err.message : 'This Quietbox page could not be found.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [username]);

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSubmitError('Only JPG, PNG, and WebP images are supported.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Attached image must be 5 MB or smaller.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!messageText.trim() && !imageFile) {
      setSubmitError('Please write a message, attach an image, or both.');
      return;
    }

    setSubmitting(true);
    try {
      await submitAnonymousMessage(username, {
        messageText,
        imageFile,
        honeypot,
      });
      setSubmittedSuccess(true);
      setMessageText('');
      handleClearImage();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to send message right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAnother = () => {
    setSubmittedSuccess(false);
    setSubmitError(null);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError(null);
    setReporting(true);
    try {
      await submitPageAbuseReport(username, {
        reason: reportReason,
        details: reportDetails,
      });
      setReportSuccess(true);
      setReportDetails('');
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : 'Unable to submit report right now.'
      );
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFC]">
      {/* Minimal Public Top Bar adhering to 3-zone contract */}
      <header className="w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-8 px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <QuietboxMark className="w-5 h-5" />
            <span>Quietbox</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/privacy" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Terms
            </Link>
          </nav>

          <Link
            to="/signup"
            className="px-3.5 py-2 text-xs font-semibold text-violet-800 bg-violet-50 border border-violet-200/80 rounded-lg hover:bg-violet-100 transition-colors whitespace-nowrap shrink-0"
          >
            Create Your Own Page
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        {loading ? (
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-slate-200" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-100" />
              </div>
            </div>
            <div className="h-28 rounded-xl bg-slate-100" />
            <div className="h-11 rounded-xl bg-slate-200" />
          </div>
        ) : notFoundError || !page ? (
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <h1 className="text-xl font-bold text-slate-900">Page unavailable</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {notFoundError || 'This Quietbox link does not exist or has been disabled by its owner.'}
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 transition-colors"
            >
              Visit Quietbox Home
            </Link>
          </div>
        ) : submittedSuccess ? (
          /* Success Screen After Anonymous Submission */
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              Message sent successfully.
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Your anonymous submission has been delivered privately to{' '}
              <span className="font-semibold text-slate-900">{page.pageName}</span>.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSendAnother}
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                Send Another Message
              </button>
              <Link
                to="/signup"
                className="w-full sm:w-auto rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 transition-colors whitespace-nowrap"
              >
                Get Your Own Quietbox
              </Link>
            </div>
          </div>
        ) : (
          /* Public Anonymous Submission Card */
          <div className="w-full max-w-lg space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <ResilientAvatar
                  src={page.avatarUrl}
                  name={page.pageName}
                  sizeClass="w-14 h-14 text-lg"
                />
                <div className="min-w-0">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">
                    {page.pageName}
                  </h1>
                  <p className="text-xs font-mono text-slate-500 truncate">/u/{page.username}</p>
                </div>
              </div>

              {page.description && (
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">{page.description}</p>
              )}

              {!page.allowSubmissions ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                  <p className="text-sm font-semibold text-slate-800">
                    Submissions are currently paused
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    The owner of this Quietbox is taking a break from receiving new messages right now.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSend} className="mt-6 space-y-4">
                  {submitError && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-sm text-red-800 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Hidden anti-spam honeypot field */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="website_url_confirm">Leave this field blank</label>
                    <input
                      id="website_url_confirm"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="anon-message-input"
                        className="block text-sm font-medium text-slate-700"
                      >
                        Your Anonymous Message
                      </label>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {messageText.length}/{LIMITS.MESSAGE_TEXT_MAX}
                      </span>
                    </div>
                    <textarea
                      id="anon-message-input"
                      rows={5}
                      maxLength={LIMITS.MESSAGE_TEXT_MAX}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Write your message here... No account, name, or email is collected."
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
                    />
                  </div>

                  {/* Optional Image Attachment + Preview */}
                  <div>
                    {!imagePreview ? (
                      <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-xs font-medium text-slate-600 hover:border-violet-400 hover:bg-violet-50/30 transition-colors cursor-pointer">
                        <ImagePlus className="w-4 h-4 text-violet-700" />
                        <span>Attach an optional image (JPG, PNG, WebP · max 5 MB)</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleSelectImage}
                          className="sr-only"
                        />
                      </label>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between pb-2 text-xs text-slate-600">
                          <span className="font-medium truncate max-w-[240px]">
                            {imageFile?.name || 'Attached image'}
                          </span>
                          <button
                            type="button"
                            onClick={handleClearImage}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                        <img
                          src={imagePreview}
                          alt="Preview before sending"
                          className="max-h-56 w-auto mx-auto rounded-lg object-contain bg-white border border-slate-200"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || (!messageText.trim() && !imageFile)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? 'Sending Anonymously...' : 'Send Anonymously'}</span>
                  </button>

                  <p className="text-center text-xs text-slate-500">
                    One-way delivery · Recipient cannot reply · EXIF metadata stripped from images
                  </p>
                </form>
              )}
            </div>

            {/* Public Page Abuse Reporting */}
            <div className="flex items-center justify-between px-2 text-xs text-slate-500">
              <span>Powered by Quietbox</span>
              <button
                type="button"
                onClick={() => {
                  setReportOpen((v) => !v);
                  setReportSuccess(false);
                }}
                className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Report this page</span>
              </button>
            </div>

            {reportOpen && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                {reportSuccess ? (
                  <p className="text-xs font-medium text-emerald-800">
                    Thank you. Your report has been recorded for safety review.
                  </p>
                ) : (
                  <form onSubmit={handleReportSubmit} className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-900">Report Abuse or Misuse</h2>
                    {reportError && (
                      <p className="text-xs text-red-600">{reportError}</p>
                    )}
                    <div>
                      <label htmlFor="report-reason" className="block text-xs font-medium text-slate-700">
                        Reason
                      </label>
                      <select
                        id="report-reason"
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
                      >
                        <option value="Impersonation or fake profile">Impersonation or fake profile</option>
                        <option value="Harassment or targeted bullying">Harassment or targeted bullying</option>
                        <option value="Spam or malicious links">Spam or malicious links</option>
                        <option value="Illegal or harmful content solicitation">Illegal or harmful content solicitation</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="report-details" className="block text-xs font-medium text-slate-700">
                        Additional Context (Optional)
                      </label>
                      <textarea
                        id="report-details"
                        rows={2}
                        maxLength={LIMITS.ABUSE_DETAILS_MAX}
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        placeholder="Provide brief details..."
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReportOpen(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={reporting}
                        className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                      >
                        {reporting ? 'Submitting...' : 'Submit Report'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
