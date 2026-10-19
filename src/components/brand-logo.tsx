import { useId } from "react";
import { APP_NAME } from "@/lib/brand";

/**
 * The Culture2Commerce logo: the gradient stall mark plus the wordmark. Every few seconds the
 * "2" slides up into an arrow ("Culture → Commerce") and back, a small brand moment rather than
 * a background effect. The text stays readable throughout; the swap stops for reduced motion.
 */
export function BrandLogo({ showWordmark = true, className = "" }: { showWordmark?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const tile = `logo-tile-${id}`;
  return (
    <span role="img" aria-label={APP_NAME} className={`items-center gap-2 ${className.includes("hidden") || className.includes("flex") ? className : `inline-flex ${className}`}`}>
      <svg viewBox="0 0 48 48" className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c4b5fd" />
            <stop offset="0.5" stopColor="#a5b4fc" />
            <stop offset="1" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <g transform="scale(0.75)">
          <rect width="64" height="64" rx="16" fill={`url(#${tile})`} />
          <rect x="1" y="1" width="62" height="31" rx="15" fill="#ffffff" opacity="0.18" />
          <path d="M15 24 L32 12 L49 24" fill="none" stroke="#0b0b14" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="15" cy="24" r="3.6" fill="#0b0b14" />
          <circle cx="49" cy="24" r="3.6" fill="#0b0b14" />
          <circle cx="32" cy="12" r="5" fill="#ffffff" stroke="#0b0b14" strokeWidth="2.6" />
          <path d="M11 30 H53 L50 37 H14 Z" fill="#0b0b14" />
          <rect x="15" y="36" width="34" height="16" rx="3" fill="#0b0b14" />
          <rect x="27" y="41" width="10" height="11" rx="2" fill={`url(#${tile})`} />
        </g>
      </svg>
      {showWordmark && (
        <span aria-hidden="true" className="font-display text-[1.2rem] font-extrabold leading-none tracking-[-0.03em] text-ink sm:text-[1.3rem]">
          Culture
          <span className="logo-swap text-gradient">
            <span>2</span>
            <span>→</span>
            <span>2</span>
          </span>
          Commerce
        </span>
      )}
    </span>
  );
}
