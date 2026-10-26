import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Image as ImageIcon,
  Lock,
  MailCheck,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ResilientAvatar, SiteFooter } from '../components/Layout';
import { HeroFloatingShowcase } from '../components/HeroFloatingShowcase';

const SAMPLE_AVATAR_PATH = '/src/assets/images/quietbox_sample_avatar_1792944102419.jpg';
const SAMPLE_PHOTO_PATH = '/src/assets/images/quietbox_hero_stationery_1792944101073.jpg';

const HERO_BACKGROUND_SLIDES = [
  '/hero-backgrounds/slide-1.jpg',
  '/hero-backgrounds/slide-2.jpg',
  '/hero-backgrounds/slide-3.jpg',
  '/hero-backgrounds/slide-4.jpg',
] as const;

const HERO_SLIDE_DURATION_MS = 20_000;

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function LandingPage() {
  const { user } = useAuth();
  const [sampleCopied, setSampleCopied] = useState(false);
  const [sampleImgError, setSampleImgError] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  useEffect(() => {
    HERO_BACKGROUND_SLIDES.forEach((src) => {
      const preloadImg = new Image();
      preloadImg.src = src;
    });

    const intervalId = window.setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % HERO_BACKGROUND_SLIDES.length);
    }, HERO_SLIDE_DURATION_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleSampleCopy = () => {
    setSampleCopied(true);
    setTimeout(() => setSampleCopied(false), 2000);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F5F9FC] text-[#102B43] overflow-x-hidden">
      {/* =====================================================================
          1. FULL-SCREEN IMMERSIVE HERO CONTAINER WITH 4-IMAGE LOOPING FADE BG
             Targeted selector: div#root > div#top > div:nth-of-type(1) > div:nth-of-type(1)
         ===================================================================== */}
      <div className="w-full p-0">
        <div className="relative w-full min-h-dvh flex flex-col justify-between overflow-hidden bg-[#0B192C]">
          {/* Looping 4-Photo Cross-Fade Background Layer (~20s per image) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden select-none"
          >
            {HERO_BACKGROUND_SLIDES.map((slideSrc, index) => {
              const isActive = index === activeSlideIndex;
              return (
                <img
                  key={slideSrc}
                  src={slideSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover object-center transition-[opacity,transform] duration-[1800ms] ease-in-out motion-reduce:transition-none will-change-[opacity,transform] ${
                    isActive
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-[1.04] motion-reduce:scale-100'
                  }`}
                />
              );
            })}

            {/* Subtle atmospheric scrim ensuring crisp headline, nav & card legibility across all 4 scenes */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/25 to-slate-950/55" />
          </div>

          {/* -----------------------------------------------------------------
              2. COMPACT TRANSPARENT TOP NAVIGATION BAR (Strict 3-Zone Contract)
             ----------------------------------------------------------------- */}
          <motion.header
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
            className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between gap-8 px-5 sm:px-10 pt-5 pb-2"
          >
            {/* Left Side: Quietbox Logo & Wordmark in White */}
            <Link
              to={user ? '/dashboard' : '/'}
              className="group inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9FF57] rounded-lg"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-white shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3"
                aria-hidden="true"
              >
                <rect
                  x="2.5"
                  y="4.5"
                  width="19"
                  height="15"
                  rx="4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M4.5 7.5L11.15 12.25C11.66 12.61 12.34 12.61 12.85 12.25L19.5 7.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Quietbox</span>
            </Link>

            {/* Center: Small Uppercase Navigation Links with Hover Underline Glide */}
            <nav className="hidden md:flex items-center gap-9 text-[11px] font-medium uppercase tracking-[0.18em] text-white/90">
              {[
                { label: 'Home', href: '#top' },
                { label: 'Features', href: '#features' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'About', href: '#about' },
              ].map((navItem) => (
                <a
                  key={navItem.label}
                  href={navItem.href}
                  className="relative py-1 hover:text-white transition-all duration-150 hover:-translate-y-0.5 after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] after:origin-center after:scale-x-0 after:bg-[#D9FF57] after:transition-transform after:duration-200 hover:after:scale-x-100 whitespace-nowrap shrink-0"
                >
                  {navItem.label}
                </a>
              ))}
            </nav>

            {/* Right Side: Bright Lime Green Pill Button ("GET STARTED") */}
            <div className="flex items-center shrink-0">
              <Link
                to={user ? '/dashboard' : '/signup'}
                className="inline-flex items-center justify-center rounded-full bg-[#D9FF57] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#102B43] shadow-[0_8px_22px_rgba(16,43,67,0.18)] hover:bg-[#e5ff80] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(16,43,67,0.28)] active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {user ? 'OPEN INBOX' : 'GET STARTED'}
              </Link>
            </div>
          </motion.header>

          {/* -----------------------------------------------------------------
              3. CENTERED HERO HEADLINE, DESCRIPTION & PILL BUTTONS
             ----------------------------------------------------------------- */}
          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.68, delay: 0.06, ease: EASE_OUT_EXPO }}
            className="relative z-10 mx-auto max-w-4xl px-5 pt-4 pb-3 sm:pt-6 sm:pb-4 text-center"
          >
            <h1 className="mx-auto text-[2.35rem] sm:text-[3.15rem] lg:text-[3.55rem] font-normal tracking-[-0.025em] leading-[1.08]">
              <span className="block text-white">Your thoughts,</span>
              <span className="block text-[#C7E7FF]">without the names.</span>
            </h1>

            <p className="mx-auto mt-4 max-w-[30rem] text-sm sm:text-[15px] leading-[1.6] text-white/85 [text-wrap:balance]">
              Create your anonymous page, share your link, and receive messages, photos, and honest thoughts from anyone.
            </p>

            {/* Horizontally Aligned Pill CTA Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              {/* Primary Button: CREATE YOUR PAGE */}
              <Link
                to={user ? '/page' : '/signup'}
                className="group inline-flex items-center gap-3 rounded-full bg-[#D9FF57] pl-6 pr-2 py-2 text-[11px] font-bold uppercase tracking-[0.13em] text-[#102B43] shadow-[0_14px_32px_rgba(16,43,67,0.22)] hover:bg-[#e5ff80] hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(16,43,67,0.3)] active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>{user ? 'MANAGE YOUR PAGE' : 'CREATE YOUR PAGE'}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#102B43] text-white transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              {/* Secondary Button: EXPLORE FEATURES */}
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-[#102B43]/45 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-white backdrop-blur-md hover:bg-[#102B43]/70 hover:border-white/45 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9FF57]"
              >
                EXPLORE FEATURES
              </a>
            </div>
          </motion.section>

          {/* -----------------------------------------------------------------
              4. FLOATING 8-CARD APPLICATION SHOWCASE + TRUST CAPTION
             ----------------------------------------------------------------- */}
          <section
            aria-label="Quietbox Interface Previews"
            className="relative z-10 pt-1 pb-6 sm:pb-7"
          >
            <HeroFloatingShowcase />

            {/* Bottom Caption & Decorative Star Trust Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.42, ease: EASE_OUT_EXPO }}
              className="mt-3 flex flex-col items-center justify-center text-center"
            >
              <p className="text-xs sm:text-[13px] font-medium tracking-wide text-white drop-shadow-[0_1px_8px_rgba(16,43,67,0.3)]">
                Made for honest conversations
              </p>
              <div
                aria-hidden="true"
                className="mt-1.5 flex items-center justify-center gap-1.5"
              >
                {[0, 1, 2, 3, 4].map((idx) => (
                  <Star
                    key={idx}
                    className="w-3.5 h-3.5 fill-[#D9FF57] text-[#D9FF57] drop-shadow-[0_1px_4px_rgba(16,43,67,0.2)] transition-transform duration-150 hover:scale-125"
                  />
                ))}
              </div>
            </motion.div>
          </section>
        </div>
      </div>

      {/* =====================================================================
          BELOW-HERO SECTIONS (With Tactile Card & Element Hover Animations)
         ===================================================================== */}
      <main className="flex-1">
        {/* Features Section */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0878B9]">
              Platform Capabilities
            </p>
            <h2 className="mt-2.5 text-3xl sm:text-4xl font-medium tracking-tight text-[#102B43] [text-wrap:balance]">
              Built for candid text notes, snapshots, or both together
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Every Quietbox page pairs zero-friction anonymous sending with a calm, strictly isolated inbox owned only by you.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Feature Card A */}
            <div className="group lg:col-span-7 rounded-[20px] border border-slate-200/90 bg-white p-7 sm:p-9 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1.5 hover:border-[#0878B9]/35 hover:shadow-[0_22px_50px_rgba(16,43,67,0.08)]">
              <div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F4FF] text-[#0878B9] transition-transform duration-200 group-hover:scale-110">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[#102B43]">
                  Text messages, image attachments, or combined notes
                </h3>
                <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
                  Visitors can write up to 2,000 characters, attach a JPG, PNG, or WebP photograph with live preview before sending, or send both together—without creating an account or entering personal details.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-100 text-xs text-slate-600">
                <div className="transition-transform duration-150 hover:translate-x-0.5">
                  <p className="font-semibold text-[#102B43]">Verified Formats</p>
                  <p className="mt-0.5">JPG, JPEG, PNG &amp; WebP</p>
                </div>
                <div className="transition-transform duration-150 hover:translate-x-0.5">
                  <p className="font-semibold text-[#102B43]">EXIF Sanitization</p>
                  <p className="mt-0.5">Camera &amp; GPS data stripped</p>
                </div>
                <div className="transition-transform duration-150 hover:translate-x-0.5">
                  <p className="font-semibold text-[#102B43]">Private Delivery</p>
                  <p className="mt-0.5">Short-lived signed URLs</p>
                </div>
              </div>
            </div>

            {/* Feature Card B (Dark Navy Contrast Card) */}
            <div className="group lg:col-span-5 rounded-[20px] bg-[#102B43] p-7 sm:p-9 text-white flex flex-col justify-between transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[0_24px_54px_rgba(16,43,67,0.22)]">
              <div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#D9FF57] transition-transform duration-200 group-hover:scale-110">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">
                  Complete control over your link
                </h3>
                <p className="mt-2.5 text-sm text-[#C7E7FF]/85 leading-relaxed">
                  Pause incoming submissions anytime with one toggle, update your prompt or avatar, or hide your public page without losing existing messages.
                </p>
              </div>

              <div className="mt-8 rounded-2xl bg-white/10 border border-white/15 p-4 transition-colors duration-200 group-hover:border-white/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">Your Personal URL</p>
                    <p className="font-mono text-xs text-[#C7E7FF] mt-0.5 truncate">
                      quietbox.app/u/your-name
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSampleCopy}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#D9FF57] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#102B43] hover:bg-[#e5ff80] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {sampleCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{sampleCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="border-y border-slate-200/80 bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0878B9]">
                How It Works
              </p>
              <h2 className="mt-2.5 text-3xl sm:text-4xl font-medium tracking-tight text-[#102B43] [text-wrap:balance]">
                Open your Quietbox in three simple steps
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                {
                  num: '01. Claim',
                  title: 'Create your anonymous page',
                  desc: 'Register with Google or email, pick a unique username slug, and preview how your public page looks before sharing.',
                },
                {
                  num: '02. Share',
                  title: 'Post your link anywhere',
                  desc: 'Copy your /u/username link or share directly to WhatsApp, X, Telegram, or Facebook. Anyone with the link can submit from any device.',
                },
                {
                  num: '03. Read',
                  title: 'Review privately at your pace',
                  desc: 'Read notes and view attached photos inside your private inbox. Search submissions, track unread items, or delete messages permanently.',
                },
              ].map((step) => (
                <div
                  key={step.num}
                  className="group rounded-[20px] border border-slate-200/90 bg-[#F5F9FC] hover:bg-white p-7 transition-all duration-200 hover:-translate-y-1.5 hover:border-[#0878B9]/40 hover:shadow-[0_18px_42px_rgba(16,43,67,0.07)]"
                >
                  <span className="inline-block font-mono text-xs font-bold text-[#0878B9] transition-transform duration-150 group-hover:translate-x-0.5">
                    {step.num}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-[#102B43]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Personal Inbox Experience & Privacy Section */}
        <section id="about" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-center">
            <div className="lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0878B9]">
                About &amp; Privacy
              </p>
              <h2 className="mt-2.5 text-3xl sm:text-4xl font-medium tracking-tight text-[#102B43] [text-wrap:balance]">
                Isolated private inboxes backed by real security
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                Quietbox never collects messages into a shared feed. Every account has its own private inbox protected by server-side token verification and zero-trust database rules.
              </p>

              <div className="mt-6 space-y-3.5 text-sm text-slate-700">
                <div className="flex items-center gap-2.5 transition-transform duration-150 hover:translate-x-1">
                  <Lock className="w-4 h-4 text-[#0878B9] shrink-0" />
                  <span>Strict per-user recipient isolation on every read and delete</span>
                </div>
                <div className="flex items-center gap-2.5 transition-transform duration-150 hover:translate-x-1">
                  <ShieldCheck className="w-4 h-4 text-[#0878B9] shrink-0" />
                  <span>Magic-byte image inspection and safe WebP re-encoding</span>
                </div>
                <div className="flex items-center gap-2.5 transition-transform duration-150 hover:translate-x-1">
                  <MailCheck className="w-4 h-4 text-[#0878B9] shrink-0" />
                  <span>
                    Honest{' '}
                    <Link
                      to="/privacy"
                      className="font-semibold text-[#0878B9] hover:underline underline-offset-4"
                    >
                      Privacy Policy
                    </Link>{' '}
                    with clear abuse &amp; rate-limit safeguards
                  </span>
                </div>
              </div>
            </div>

            {/* Clean Product Preview of Inbox */}
            <div className="lg:col-span-7 rounded-[20px] border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_14px_40px_rgba(16,43,67,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(16,43,67,0.1)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <ResilientAvatar
                    src={SAMPLE_AVATAR_PATH}
                    name="Claire"
                    sizeClass="w-10 h-10 text-sm"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span>Public page active</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#0878B9]">1 unread</span>
                    </div>
                    <h3 className="text-base font-bold text-[#102B43]">Claire&apos;s Quietbox</h3>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold tabular-nums">
                  <span className="rounded-md bg-white px-2.5 py-1 text-[#102B43] shadow-2xs">
                    All (2)
                  </span>
                  <span className="px-2.5 py-1 text-slate-600">Unread (1)</span>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="group rounded-2xl border border-[#C7E7FF] bg-[#F2F9FF] p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#102B43]">Anonymous Sender</span>
                      <span aria-hidden="true">·</span>
                      <span>Today, 9:42 AM</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-slate-400 transition-colors group-hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#102B43] leading-relaxed">
                    Loved the quiet stationery aesthetic you shared last week. Sending over a photo from our studio desk!
                  </p>
                  {!sampleImgError && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 inline-block">
                      <img
                        src={SAMPLE_PHOTO_PATH}
                        alt="Sample inbox photo attachment"
                        referrerPolicy="no-referrer"
                        onError={() => setSampleImgError(true)}
                        className="h-32 w-auto object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#102B43]">Anonymous Sender</span>
                      <span aria-hidden="true">·</span>
                      <span>Yesterday, 6:15 PM</span>
                    </div>
                    <span className="text-slate-400">Read</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                    Thank you for always giving thoughtful design critiques during Friday reviews—it makes a real difference.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Final Sky-Gradient Call to Action Banner */}
          <div
            className="mt-20 relative overflow-hidden rounded-[20px] px-8 py-12 sm:px-14 sm:py-16 text-white shadow-[0_20px_55px_rgba(8,120,185,0.2)] transition-transform duration-200 hover:-translate-y-1"
            style={{
              background: 'linear-gradient(135deg, #0878B9 0%, #079FE0 55%, #19BDEB 100%)',
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -bottom-20 h-64 w-64 rounded-full bg-white/25 blur-2xl"
            />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="max-w-xl">
                <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-white">
                  Ready to hear <span className="text-[#C7E7FF]">honest thoughts?</span>
                </h2>
                <p className="mt-3 text-sm sm:text-base text-white/85 leading-relaxed">
                  Create your Quietbox account, customize your personal link, and receive anonymous notes and photos in your private inbox.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 shrink-0">
                <Link
                  to={user ? '/dashboard' : '/signup'}
                  className="group inline-flex items-center gap-3 rounded-full bg-[#D9FF57] pl-6 pr-2 py-2 text-[11px] font-bold uppercase tracking-[0.13em] text-[#102B43] shadow-lg hover:bg-[#e5ff80] hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] transition-all duration-150 whitespace-nowrap"
                >
                  <span>{user ? 'OPEN YOUR INBOX' : 'CREATE YOUR PAGE'}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#102B43] text-white transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
                {!user && (
                  <Link
                    to="/signin"
                    className="inline-flex items-center justify-center rounded-full border border-white/25 bg-[#102B43]/45 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-white hover:bg-[#102B43]/70 hover:border-white/45 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 whitespace-nowrap"
                  >
                    SIGN IN
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
