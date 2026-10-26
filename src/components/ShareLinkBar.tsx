import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ShareLinkBar({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const [activeShareUrl, setActiveShareUrl] = useState<string | null>(null);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://quietbox.app';
  const publicUrl = `${origin}/u/${username}`;
  const shareText = `Send me an anonymous message on Quietbox:`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy input selection
      const input = document.getElementById('quietbox-share-url-input') as HTMLInputElement | null;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    }
  };

  const socialTargets = [
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${publicUrl}`)}`,
    },
    {
      name: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(publicUrl)}`,
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`,
    },
  ];

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Quietbox',
          text: shareText,
          url: publicUrl,
        });
        return;
      } catch {
        // User cancelled native share
      }
    }
    await handleCopy();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Your Personal Share Link</h3>
          <p className="mt-1 text-sm text-slate-600">
            Post this URL anywhere on social media to receive private anonymous messages.
          </p>
        </div>
        <Link
          to={`/u/${username}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-800 whitespace-nowrap shrink-0"
        >
          <span>Open Public Page</span>
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          id="quietbox-share-url-input"
          type="text"
          readOnly
          value={publicUrl}
          aria-label="Your shareable Quietbox link"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
          </button>
          <button
            type="button"
            onClick={handleNativeShare}
            title="Share via device sheet"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-slate-100 text-sm">
        <span className="text-slate-500">Share directly on:</span>
        {socialTargets.map((item) => (
          <a
            key={item.name}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setActiveShareUrl(item.name)}
            className={`font-medium transition-colors whitespace-nowrap ${
              activeShareUrl === item.name
                ? 'text-violet-800 underline underline-offset-4'
                : 'text-slate-700 hover:text-violet-700 hover:underline underline-offset-4'
            }`}
          >
            {item.name}
          </a>
        ))}
      </div>
    </div>
  );
}
