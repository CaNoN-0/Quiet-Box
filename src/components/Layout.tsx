import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function QuietboxMark({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="4"
        className="stroke-violet-700"
        strokeWidth="2"
      />
      <path
        d="M4.5 7.5L11.15 12.25C11.66 12.61 12.34 12.61 12.85 12.25L19.5 7.5"
        className="stroke-violet-700"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TopNav() {
  const { user, page, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single text element wordmark */}
        <Link
          to={user ? '/dashboard' : '/'}
          className="group inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded"
        >
          <QuietboxMark className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
          <span>Quietbox</span>
        </Link>

        {/* Zone 2: Clean single-line text navigation links */}
        {user ? (
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
            <Link
              to="/dashboard"
              className={`hover:text-slate-900 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 py-1 ${
                location.pathname === '/dashboard'
                  ? 'text-slate-900 underline decoration-violet-600 decoration-2 underline-offset-8'
                  : 'hover:underline underline-offset-8'
              }`}
            >
              Inbox
            </Link>
            <Link
              to="/page"
              className={`hover:text-slate-900 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 py-1 ${
                location.pathname === '/page'
                  ? 'text-slate-900 underline decoration-violet-600 decoration-2 underline-offset-8'
                  : 'hover:underline underline-offset-8'
              }`}
            >
              {page ? 'My Page' : 'Create Page'}
            </Link>
            {page && (
              <Link
                to={`/u/${page.username}`}
                className="hover:text-slate-900 hover:underline underline-offset-8 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 py-1"
              >
                Public View
              </Link>
            )}
            <Link
              to="/settings"
              className={`hover:text-slate-900 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 py-1 ${
                location.pathname === '/settings'
                  ? 'text-slate-900 underline decoration-violet-600 decoration-2 underline-offset-8'
                  : 'hover:underline underline-offset-8'
              }`}
            >
              Settings
            </Link>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="/#how-it-works"
              className="hover:text-slate-900 hover:underline underline-offset-8 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="/#about"
              className="hover:text-slate-900 hover:underline underline-offset-8 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            >
              Privacy
            </a>
            <Link
              to="/terms"
              className="hover:text-slate-900 hover:underline underline-offset-8 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            >
              Terms
            </Link>
            <Link
              to="/signin"
              className="hover:text-slate-900 hover:underline underline-offset-8 transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          </nav>
        )}

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
            >
              Sign Out
            </button>
          ) : (
            <Link
              to="/signup"
              className="px-4 py-2 text-sm font-semibold text-white bg-violet-700 rounded-lg hover:bg-violet-800 hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
            >
              Create Account
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 text-sm text-slate-600 transition-transform duration-150 hover:-translate-y-0.5"
        >
          <QuietboxMark className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
          <span className="font-semibold text-slate-900">Quietbox</span>
          <span aria-hidden="true">·</span>
          <span>Private anonymous messaging</span>
        </Link>
        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
          <Link
            to="/privacy"
            className="hover:text-slate-900 hover:-translate-y-0.5 transition-all duration-150 whitespace-nowrap"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="hover:text-slate-900 hover:-translate-y-0.5 transition-all duration-150 whitespace-nowrap"
          >
            Terms of Service
          </Link>
          <Link
            to="/signin"
            className="hover:text-slate-900 hover:-translate-y-0.5 transition-all duration-150 whitespace-nowrap"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="hover:text-slate-900 hover:-translate-y-0.5 transition-all duration-150 whitespace-nowrap"
          >
            Create Page
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function ResilientAvatar({
  src,
  name,
  sizeClass = 'w-14 h-14 text-lg',
}: {
  src?: string | null;
  name: string;
  sizeClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || 'Q').trim().charAt(0).toUpperCase();

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-violet-100 text-violet-800 font-semibold flex items-center justify-center shrink-0 select-none border border-violet-200/70`}
        aria-label={name}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover shrink-0 border border-slate-200 bg-slate-100`}
    />
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  loading = false,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <h3 id="confirm-modal-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-700 hover:bg-violet-800'
            }`}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
