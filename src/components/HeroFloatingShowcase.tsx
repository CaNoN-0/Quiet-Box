import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Copy,
  ImagePlus,
  Inbox,
  Link2,
  Lock,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { ResilientAvatar } from './Layout';

const SAMPLE_AVATAR_PATH = '/src/assets/images/quietbox_sample_avatar_1792944102419.jpg';
const SAMPLE_ATTACHMENT_PATH = '/src/assets/images/quietbox_hero_stationery_1792944101073.jpg';

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Card 1: Compact anonymous message preview with short message and timestamp.
 */
function Card1CompactMessagePreview() {
  return (
    <div className="h-full w-full rounded-[18px] border border-white/85 bg-white/95 p-3 text-left shadow-[0_20px_44px_rgba(16,43,67,0.22)] group-hover:shadow-[0_30px_62px_rgba(16,43,67,0.34)] group-hover:border-white transition-all duration-200 backdrop-blur-md flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between text-[9.5px] text-slate-400 tabular-nums">
          <span className="font-semibold text-[#102B43]">Anonymous</span>
          <span>4m</span>
        </div>
        <p className="mt-2 text-[10px] leading-[1.42] text-slate-700 line-clamp-4">
          &ldquo;Your quiet product essays helped me rethink how our team communicates.&rdquo;
        </p>
      </div>
      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
        <span className="font-medium text-[#0878B9]">Delivered</span>
        <span>Private</span>
      </div>
    </div>
  );
}

/**
 * Card 2: Personal inbox showing anonymous messages in a clean list.
 */
function Card2PersonalInboxList() {
  return (
    <div className="h-full w-full rounded-[19px] border border-white/90 bg-white p-3 text-left shadow-[0_24px_50px_rgba(16,43,67,0.24)] group-hover:shadow-[0_32px_66px_rgba(16,43,67,0.34)] transition-all duration-200 flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1">
            <Inbox className="w-3 h-3 text-[#0878B9]" />
            <span className="text-[10px] font-semibold text-[#102B43]">Personal Inbox</span>
          </div>
          <span className="text-[9px] font-medium text-[#0878B9] tabular-nums">3 notes</span>
        </div>

        <div className="mt-2 space-y-1.5">
          <div className="rounded-[10px] bg-[#F2F8FD] border border-[#C7E7FF]/80 px-2 py-1.5 transition-transform duration-150 group-hover:translate-x-0.5">
            <div className="flex items-center justify-between text-[8.5px] text-slate-500 tabular-nums">
              <span className="font-semibold text-[#102B43]">Anonymous</span>
              <span>Now</span>
            </div>
            <p className="mt-0.5 text-[9.5px] text-slate-700 truncate">
              Loved the keynote slides!
            </p>
          </div>

          <div className="rounded-[10px] bg-slate-50/90 border border-slate-100 px-2 py-1.5">
            <div className="flex items-center justify-between text-[8.5px] text-slate-400 tabular-nums">
              <span className="font-medium text-slate-700">Anonymous</span>
              <span>28m</span>
            </div>
            <p className="mt-0.5 text-[9.5px] text-slate-600 truncate">
              Ship the minimal dark mode.
            </p>
          </div>

          <div className="rounded-[10px] bg-slate-50/90 border border-slate-100 px-2 py-1.5">
            <div className="flex items-center justify-between text-[8.5px] text-slate-400 tabular-nums">
              <span className="font-medium text-slate-700">Anonymous</span>
              <span>2h</span>
            </div>
            <p className="mt-0.5 text-[9.5px] text-slate-600 truncate">
              Which lens did you use?
            </p>
          </div>
        </div>
      </div>

      <div className="pt-1 flex items-center justify-between text-[8.5px] text-slate-400">
        <span>Owner-only</span>
        <span>Search</span>
      </div>
    </div>
  );
}

/**
 * Card 3: Anonymous message containing an attached photograph with image preview.
 */
function Card3AttachedPhotoMessage() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="h-full w-full rounded-[20px] border border-white/90 bg-white p-3 text-left shadow-[0_26px_56px_rgba(16,43,67,0.26)] group-hover:shadow-[0_34px_70px_rgba(16,43,67,0.36)] transition-all duration-200 flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between text-[9.5px] text-slate-400 tabular-nums">
          <span className="font-semibold text-[#102B43]">Anonymous Photo</span>
          <span>12m</span>
        </div>

        <div className="mt-1.5 relative h-22 w-full overflow-hidden rounded-[12px] border border-slate-200/80 bg-[#EBF6FF]">
          {!imgFailed ? (
            <img
              src={SAMPLE_ATTACHMENT_PATH}
              alt="Anonymous attached desk photograph"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#C7E7FF] via-white to-sky-100 flex items-center justify-center text-[9px] font-medium text-[#102B43]">
              Sanitized WebP
            </div>
          )}
          <span className="absolute bottom-1 left-1 rounded-[7px] bg-[#102B43]/80 px-1.5 py-0.5 text-[8px] font-medium text-white backdrop-blur-xs">
            EXIF Stripped
          </span>
        </div>

        <p className="mt-1.5 text-[9.5px] leading-[1.38] text-slate-700 line-clamp-2">
          Spotted this stationery set in Lisbon and thought of your studio.
        </p>
      </div>

      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
        <span className="font-medium text-[#0878B9]">Signed URL</span>
        <Trash2 className="w-2.5 h-2.5 text-slate-400 transition-colors group-hover:text-red-500" />
      </div>
    </div>
  );
}

/**
 * Card 4: Center-Left Prominent Card — Public anonymous page preview.
 */
function Card4PublicAnonymousPage() {
  return (
    <div className="h-full w-full rounded-[22px] border border-white bg-white p-3.5 text-left shadow-[0_30px_64px_rgba(10,37,64,0.28)] group-hover:shadow-[0_38px_78px_rgba(10,37,64,0.38)] transition-all duration-200 flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center gap-2">
          <div className="transition-transform duration-200 group-hover:scale-105">
            <ResilientAvatar
              src={SAMPLE_AVATAR_PATH}
              name="Claire"
              sizeClass="w-8 h-8 text-[11px]"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#102B43] truncate">Claire&apos;s Quietbox</p>
            <p className="text-[9px] font-mono text-[#0878B9] truncate">quietbox.app/u/claire</p>
          </div>
        </div>

        <p className="mt-2 text-[9.5px] leading-[1.4] text-slate-600 line-clamp-2">
          Share candid feedback, book notes, or a photo from your week.
        </p>

        <div className="mt-2 rounded-[11px] border border-slate-200 bg-slate-50/80 group-hover:border-[#0878B9]/40 transition-colors px-2.5 py-1.5 h-13 text-[9.5px] text-slate-400">
          Write an anonymous message...
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-500 group-hover:text-[#0878B9] transition-colors">
          <ImagePlus className="w-2.5 h-2.5 text-[#0878B9]" />
          <span>Photo</span>
        </span>
        <span className="rounded-full bg-[#102B43] group-hover:bg-[#0878B9] transition-colors px-2.5 py-1 text-[9px] font-semibold text-white">
          Send Anonymously
        </span>
      </div>
    </div>
  );
}

/**
 * Card 5: Center-Right Prominent Card — Dark navy feature card ("Your identity stays yours").
 */
function Card5DarkNavyPrivacyCard() {
  return (
    <div className="h-full w-full rounded-[22px] border border-[#23496B] group-hover:border-[#D9FF57]/55 bg-[#102B43] p-3.5 text-left text-white shadow-[0_30px_64px_rgba(8,28,48,0.34)] group-hover:shadow-[0_40px_80px_rgba(8,28,48,0.45)] transition-all duration-200 flex flex-col justify-between select-none">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-white/10 border border-white/15 transition-transform duration-200 group-hover:scale-110">
          <ShieldCheck className="w-3 h-3 text-[#D9FF57]" />
        </span>
        <span className="font-mono text-[8.5px] tracking-wider uppercase text-[#C7E7FF]/80">
          Zero Tracking
        </span>
      </div>

      <div className="my-auto py-1.5">
        <h3 className="text-[14px] font-medium leading-[1.2] tracking-tight text-white">
          Your identity <span className="text-[#C7E7FF]">stays yours</span>
        </h3>
        <p className="mt-1.5 text-[9.5px] leading-[1.44] text-[#C7E7FF]/80 line-clamp-3">
          Senders never sign up or enter an email. Isolated inboxes strip camera EXIF metadata automatically.
        </p>
      </div>

      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[9px] text-[#C7E7FF]/75">
        <span className="inline-flex items-center gap-1">
          <Lock className="w-2.5 h-2.5 text-[#D9FF57]" />
          <span>Private</span>
        </span>
        <span className="text-[#D9FF57] font-medium">Verified</span>
      </div>
    </div>
  );
}

/**
 * Card 6: Pale Blue Shareable Link Interface.
 */
function Card6ShareableLinkInterface() {
  const [copied, setCopied] = useState(false);

  const handleCopyDemo = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="h-full w-full rounded-[20px] border border-white/75 group-hover:border-white bg-gradient-to-b from-[#E6F4FF]/95 to-[#C7E7FF]/90 p-3 text-left text-[#102B43] shadow-[0_24px_52px_rgba(16,43,67,0.23)] group-hover:shadow-[0_34px_68px_rgba(16,43,67,0.34)] transition-all duration-200 backdrop-blur-md flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#0878B9] shadow-2xs transition-transform duration-200 group-hover:rotate-12">
            <Link2 className="w-3 h-3" />
          </span>
          <span className="text-[10px] font-bold text-[#102B43]">Shareable Link</span>
        </div>

        <p className="mt-1.5 text-[9px] leading-[1.38] text-[#102B43]/75">
          Post your personal URL anywhere on social media.
        </p>

        <div className="mt-2 rounded-[10px] bg-white/95 border border-white px-2 py-1.5 font-mono text-[9px] text-[#102B43] truncate shadow-2xs">
          quietbox.app/u/claire
        </div>

        <button
          type="button"
          onClick={handleCopyDemo}
          className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-full bg-[#D9FF57] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#102B43] hover:bg-[#e5ff80] active:scale-[0.98] transition-all duration-150 cursor-pointer"
        >
          {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          <span>{copied ? 'Copied' : 'Copy Link'}</span>
        </button>
      </div>

      <div className="pt-1.5 border-t border-[#102B43]/10 flex items-center justify-between text-[8.5px] font-medium text-[#102B43]/70">
        <span>Active</span>
        <span>Pause anytime</span>
      </div>
    </div>
  );
}

/**
 * Card 7: Message composition interface with text area, image attachment icon, and send button.
 */
function Card7MessageComposer() {
  return (
    <div className="h-full w-full rounded-[19px] border border-white/90 bg-white p-3 text-left shadow-[0_22px_48px_rgba(16,43,67,0.22)] group-hover:shadow-[0_32px_64px_rgba(16,43,67,0.34)] transition-all duration-200 flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="font-semibold text-[#102B43]">Compose Note</span>
          <span className="text-slate-400 tabular-nums">84/2000</span>
        </div>

        <div className="mt-1.5 rounded-[10px] border border-slate-200 bg-slate-50/70 p-2 h-19 text-[9px] leading-[1.4] text-slate-700 line-clamp-3">
          Here is the whiteboard sketch from our afternoon product review!
        </div>

        <div className="mt-1.5 flex items-center justify-between rounded-[9px] border border-dashed border-sky-200 bg-[#F3FAFF] px-2 py-1 text-[8.5px] font-medium text-[#0878B9]">
          <span className="inline-flex items-center gap-1">
            <ImagePlus className="w-2.5 h-2.5" />
            <span>sketch.webp</span>
          </span>
          <span className="text-slate-400">420 KB</span>
        </div>
      </div>

      <div className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-[10px] bg-[#0878B9] group-hover:bg-[#079FE0] transition-colors py-1.5 text-[9px] font-semibold text-white">
        <Send className="w-2.5 h-2.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        <span>Send Note</span>
      </div>
    </div>
  );
}

/**
 * Card 8: Dark Navy Compact Inbox Overview.
 */
function Card8CompactInboxOverview() {
  return (
    <div className="h-full w-full rounded-[18px] border border-[#23496B]/80 group-hover:border-[#C7E7FF]/50 bg-[#102B43]/95 p-3 text-left text-white shadow-[0_20px_44px_rgba(16,43,67,0.24)] group-hover:shadow-[0_30px_64px_rgba(16,43,67,0.38)] transition-all duration-200 backdrop-blur-md flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="font-semibold text-white">Inbox Digest</span>
          <span className="rounded-full bg-[#D9FF57] px-1.5 py-0.5 text-[8px] font-bold text-[#102B43] tabular-nums">
            2 new
          </span>
        </div>

        <div className="mt-2 space-y-1.5">
          <div className="rounded-[9px] bg-white/10 px-2 py-1.5 border border-white/10">
            <p className="text-[8.5px] font-medium text-[#C7E7FF] tabular-nums">Today · 10:14</p>
            <p className="mt-0.5 text-[9px] text-white/90 truncate">
              Thank you for mentoring...
            </p>
          </div>
          <div className="rounded-[9px] bg-white/5 px-2 py-1.5 border border-white/5">
            <p className="text-[8.5px] text-white/55 tabular-nums">Yesterday · Photo</p>
            <p className="mt-0.5 text-[9px] text-white/75 truncate">
              Studio sketch attached
            </p>
          </div>
        </div>
      </div>

      <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[8.5px] text-[#C7E7FF]/75 tabular-nums">
        <span>Active</span>
        <span>/u/claire</span>
      </div>
    </div>
  );
}

interface FloatingDesktopSpec {
  id: string;
  widthClass: string;
  heightClass: string;
  zClass: string;
  delay: number;
  yOffset: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  render: () => React.ReactNode;
}

/**
 * Compact cards positioned along a large-circumference circular arc (broad horizontal sweep + gentle radial curvature).
 */
const DESKTOP_CARDS: FloatingDesktopSpec[] = [
  {
    id: 'card-1',
    widthClass: 'w-[122px] 2xl:w-[138px]',
    heightClass: 'h-[168px] 2xl:h-[180px]',
    zClass: 'z-[1]',
    delay: 0.34,
    yOffset: 18,
    rotateY: 13.5,
    rotateZ: -2.1,
    scale: 0.95,
    render: () => <Card1CompactMessagePreview />,
  },
  {
    id: 'card-2',
    widthClass: 'w-[140px] 2xl:w-[158px]',
    heightClass: 'h-[186px] 2xl:h-[200px]',
    zClass: 'z-[2]',
    delay: 0.26,
    yOffset: 10,
    rotateY: 9.5,
    rotateZ: -1.35,
    scale: 0.97,
    render: () => <Card2PersonalInboxList />,
  },
  {
    id: 'card-3',
    widthClass: 'w-[154px] 2xl:w-[172px]',
    heightClass: 'h-[200px] 2xl:h-[214px]',
    zClass: 'z-[4]',
    delay: 0.18,
    yOffset: 4,
    rotateY: 5.5,
    rotateZ: -0.7,
    scale: 0.985,
    render: () => <Card3AttachedPhotoMessage />,
  },
  {
    id: 'card-4',
    widthClass: 'w-[172px] 2xl:w-[192px]',
    heightClass: 'h-[212px] 2xl:h-[226px]',
    zClass: 'z-[8]',
    delay: 0.1,
    yOffset: 0,
    rotateY: 2,
    rotateZ: -0.2,
    scale: 1,
    render: () => <Card4PublicAnonymousPage />,
  },
  {
    id: 'card-5',
    widthClass: 'w-[172px] 2xl:w-[192px]',
    heightClass: 'h-[212px] 2xl:h-[226px]',
    zClass: 'z-[8]',
    delay: 0.12,
    yOffset: 0,
    rotateY: -2,
    rotateZ: 0.2,
    scale: 1,
    render: () => <Card5DarkNavyPrivacyCard />,
  },
  {
    id: 'card-6',
    widthClass: 'w-[154px] 2xl:w-[172px]',
    heightClass: 'h-[200px] 2xl:h-[214px]',
    zClass: 'z-[4]',
    delay: 0.2,
    yOffset: 4,
    rotateY: -5.5,
    rotateZ: 0.7,
    scale: 0.985,
    render: () => <Card6ShareableLinkInterface />,
  },
  {
    id: 'card-7',
    widthClass: 'w-[140px] 2xl:w-[158px]',
    heightClass: 'h-[188px] 2xl:h-[202px]',
    zClass: 'z-[2]',
    delay: 0.28,
    yOffset: 10,
    rotateY: -9.5,
    rotateZ: 1.35,
    scale: 0.97,
    render: () => <Card7MessageComposer />,
  },
  {
    id: 'card-8',
    widthClass: 'w-[122px] 2xl:w-[138px]',
    heightClass: 'h-[168px] 2xl:h-[180px]',
    zClass: 'z-[1]',
    delay: 0.36,
    yOffset: 18,
    rotateY: -13.5,
    rotateZ: 2.1,
    scale: 0.95,
    render: () => <Card8CompactInboxOverview />,
  },
];

const TABLET_CARDS = [
  {
    id: 'tab-2',
    widthClass: 'w-[140px]',
    heightClass: 'h-[186px]',
    zClass: 'z-[2]',
    delay: 0.22,
    yOffset: 11,
    rotateY: 8.5,
    rotateZ: -1.3,
    scale: 0.96,
    render: () => <Card2PersonalInboxList />,
  },
  {
    id: 'tab-3',
    widthClass: 'w-[154px]',
    heightClass: 'h-[198px]',
    zClass: 'z-[5]',
    delay: 0.15,
    yOffset: 4,
    rotateY: 4.5,
    rotateZ: -0.6,
    scale: 0.985,
    render: () => <Card3AttachedPhotoMessage />,
  },
  {
    id: 'tab-4',
    widthClass: 'w-[172px]',
    heightClass: 'h-[210px]',
    zClass: 'z-10',
    delay: 0.08,
    yOffset: 0,
    rotateY: 1,
    rotateZ: 0,
    scale: 1,
    render: () => <Card4PublicAnonymousPage />,
  },
  {
    id: 'tab-5',
    widthClass: 'w-[170px]',
    heightClass: 'h-[210px]',
    zClass: 'z-10',
    delay: 0.1,
    yOffset: 1,
    rotateY: -3.5,
    rotateZ: 0.5,
    scale: 1,
    render: () => <Card5DarkNavyPrivacyCard />,
  },
  {
    id: 'tab-6',
    widthClass: 'w-[142px]',
    heightClass: 'h-[188px]',
    zClass: 'z-[2]',
    delay: 0.24,
    yOffset: 11,
    rotateY: -8.5,
    rotateZ: 1.3,
    scale: 0.96,
    render: () => <Card6ShareableLinkInterface />,
  },
];

const MOBILE_CARDS = [
  { id: 'mob-4', w: 'w-[178px] h-[208px]', delay: 0.08, render: () => <Card4PublicAnonymousPage /> },
  { id: 'mob-5', w: 'w-[178px] h-[208px]', delay: 0.14, render: () => <Card5DarkNavyPrivacyCard /> },
  { id: 'mob-3', w: 'w-[166px] h-[202px]', delay: 0.2, render: () => <Card3AttachedPhotoMessage /> },
  { id: 'mob-6', w: 'w-[164px] h-[202px]', delay: 0.26, render: () => <Card6ShareableLinkInterface /> },
  { id: 'mob-2', w: 'w-[160px] h-[198px]', delay: 0.32, render: () => <Card2PersonalInboxList /> },
  { id: 'mob-7', w: 'w-[160px] h-[198px]', delay: 0.38, render: () => <Card7MessageComposer /> },
  { id: 'mob-1', w: 'w-[146px] h-[184px]', delay: 0.44, render: () => <Card1CompactMessagePreview /> },
  { id: 'mob-8', w: 'w-[146px] h-[184px]', delay: 0.5, render: () => <Card8CompactInboxOverview /> },
];

export function HeroFloatingShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-[1680px]">
      {/* Desktop 8-Card Curved 3D Floating Composition with expanded arc circumference */}
      <div className="hidden xl:flex items-center justify-center gap-2.5 2xl:gap-4 px-4 pt-2 pb-5 [perspective:3200px]">
        {DESKTOP_CARDS.map((card) => (
          <motion.div
            key={card.id}
            initial={{
              opacity: 0,
              y: card.yOffset + 56,
              rotateY: card.rotateY * 1.25,
              rotateZ: card.rotateZ * 1.25,
              scale: card.scale * 0.88,
            }}
            animate={{
              opacity: 1,
              y: card.yOffset,
              rotateY: card.rotateY,
              rotateZ: card.rotateZ,
              scale: card.scale,
            }}
            transition={{
              duration: 0.78,
              delay: card.delay,
              ease: EASE_OUT_EXPO,
            }}
            whileHover={{
              y: card.yOffset - 13,
              rotateY: card.rotateY * 0.35,
              rotateZ: 0,
              scale: Math.min(1.06, card.scale + 0.06),
              transition: { duration: 0.18, ease: EASE_OUT_EXPO },
            }}
            className={`group ${card.widthClass} ${card.heightClass} ${card.zClass} hover:z-40 shrink-0 cursor-pointer will-change-transform [transform-style:preserve-3d]`}
          >
            {card.render()}
          </motion.div>
        ))}
      </div>

      {/* Tablet Balanced 5-Card Perspective Composition with expanded circumference */}
      <div className="hidden md:flex xl:hidden items-center justify-center gap-4 px-6 pt-2 pb-5 [perspective:2500px]">
        {TABLET_CARDS.map((card) => (
          <motion.div
            key={card.id}
            initial={{
              opacity: 0,
              y: card.yOffset + 48,
              rotateY: card.rotateY * 1.2,
              rotateZ: card.rotateZ,
              scale: card.scale * 0.9,
            }}
            animate={{
              opacity: 1,
              y: card.yOffset,
              rotateY: card.rotateY,
              rotateZ: card.rotateZ,
              scale: card.scale,
            }}
            transition={{
              duration: 0.72,
              delay: card.delay,
              ease: EASE_OUT_EXPO,
            }}
            whileHover={{
              y: card.yOffset - 11,
              rotateY: card.rotateY * 0.3,
              rotateZ: 0,
              scale: Math.min(1.05, card.scale + 0.05),
              transition: { duration: 0.18, ease: EASE_OUT_EXPO },
            }}
            className={`group ${card.widthClass} ${card.heightClass} ${card.zClass} hover:z-30 shrink-0 cursor-pointer will-change-transform [transform-style:preserve-3d]`}
          >
            {card.render()}
          </motion.div>
        ))}
      </div>

      {/* Mobile Horizontally Scrollable Floating Card Strip */}
      <div className="md:hidden w-full overflow-x-auto no-scrollbar px-5 pt-2 pb-3">
        <div className="flex items-center gap-3 w-max">
          {MOBILE_CARDS.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 38, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.65,
                delay: card.delay,
                ease: EASE_OUT_EXPO,
              }}
              whileHover={{
                y: -6,
                scale: 1.03,
                transition: { duration: 0.16, ease: EASE_OUT_EXPO },
              }}
              whileTap={{ scale: 0.98 }}
              className={`group ${card.w} shrink-0 cursor-pointer will-change-transform`}
            >
              {card.render()}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
