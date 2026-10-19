"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";

/**
 * The Culture2Commerce logo: the gradient stall mark plus the wordmark. Every few seconds the
 * "2" slides up into an arrow ("Culture → Commerce") and back, a small brand moment rather than
 * a background effect. The text stays readable throughout; the swap stops for reduced motion.
 * On top of that the parts of the mark animate: a playful entrance on the home page, a hover reaction
 * and an occasional idle wink (all in globals.css under .c2c-logo / .lg-*).
 */
const LEFT = "Culture".split("");
const RIGHT = "Commerce".split("");
const ch = (c: string, i: number) => (
  <span key={`${i}-${c}`} className="lg-ch" style={{ ["--i" as string]: i }}>
    {c}
  </span>
);

export function BrandLogo({ showWordmark = true, className = "" }: { showWordmark?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const tile = `logo-tile-${id}`;
  const isHome = usePathname() === "/";
  const [intro, setIntro] = useState(isHome);
  useEffect(() => {
    if (!isHome) return;
    const t = setTimeout(() => setIntro(false), 2600);
    return () => clearTimeout(t);
  }, [isHome]);
  return (
    <span role="img" aria-label={APP_NAME} className={`c2c-logo ${intro ? "lg-intro" : ""} items-center gap-2 ${className.includes("hidden") || className.includes("flex") ? className : `inline-flex ${className}`}`}>
      <svg viewBox="0 0 48 48" className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c4b5fd" />
            <stop offset="0.5" stopColor="#a5b4fc" />
            <stop offset="1" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <g transform="scale(0.75)">
          <rect className="lg-tile" width="64" height="64" rx="16" fill={`url(#${tile})`} />
          <rect x="1" y="1" width="62" height="31" rx="15" fill="#ffffff" opacity="0.18" />
          <path className="lg-roof" pathLength={1} d="M15 24 L32 12 L49 24" fill="none" stroke="#0b0b14" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle className="lg-dot lg-dot-l" cx="15" cy="24" r="3.6" fill="#0b0b14" />
          <circle className="lg-dot lg-dot-r" cx="49" cy="24" r="3.6" fill="#0b0b14" />
          <circle className="lg-top" cx="32" cy="12" r="5" fill="#ffffff" stroke="#0b0b14" strokeWidth="2.6" />
          <path className="lg-awn" d="M11 30 H53 L50 37 H14 Z" fill="#0b0b14" />
          <rect className="lg-store" x="15" y="36" width="34" height="16" rx="3" fill="#0b0b14" />
          <rect className="lg-door" x="27" y="41" width="10" height="11" rx="2" fill={`url(#${tile})`} />
        </g>
      </svg>
      {showWordmark && (
        <span aria-hidden="true" className="font-display text-[1.2rem] font-extrabold leading-none tracking-[-0.03em] text-ink sm:text-[1.3rem]">
          {LEFT.map((c, i) => ch(c, i))}
          <span className="logo-swap lg-two text-gradient" style={{ ["--i" as string]: LEFT.length }}>
            <span>2</span>
            <span>→</span>
            <span>2</span>
          </span>
          {RIGHT.map((c, i) => ch(c, LEFT.length + 1 + i))}
        </span>
      )}
    </span>
  );
}
