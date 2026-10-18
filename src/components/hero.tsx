"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import Link from "next/link";
import { ArrowIcon } from "./ui";

/**
 * Landing hero: a centred headline with the key word in a gradient pill, a pill call to action,
 * and a product preview below it (an example opportunity report with small floating stat cards).
 * The floating cards drift a little with the pointer at different depths; motion stops for
 * reduced-motion users and on touch screens. Every number in the preview is illustrative and
 * labelled as such.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** A card that shifts with the pointer; depth sets the direction and distance. */
function Floating({ x, y, depth, className, delay, children }: { x: MotionValue<number>; y: MotionValue<number>; depth: number; className: string; delay: number; children: React.ReactNode }) {
  const dx = useTransform(x, (v) => v * depth);
  const dy = useTransform(y, (v) => v * depth);
  return (
    <motion.div className={`absolute ${className}`} style={{ x: dx, y: dy }}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay, ease: EASE }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Example chart for the central report card: cultural fit across a few areas (illustrative). */
function ReportChart() {
  const line = "M0,120 C40,110 60,70 100,78 C140,86 150,40 190,46 C230,52 240,96 280,90 C320,84 330,30 370,24 C400,20 420,40 440,34";
  return (
    <svg viewBox="0 0 440 150" className="h-36 w-full sm:h-44" role="presentation">
      <defs>
        <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="60%" stopColor="#f0abfc" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      {[30, 60, 90, 120].map((y) => (
        <line key={y} x1="0" x2="440" y1={y} y2={y} stroke="rgb(255 255 255 / 0.07)" strokeDasharray="3 5" />
      ))}
      <motion.path d={`${line} L440,150 L0,150 Z`} fill="url(#hero-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.9 }} />
      <motion.path d={line} fill="none" stroke="url(#hero-line)" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 0.5, ease: EASE }} />
      <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 1.8 }} style={{ transformOrigin: "190px 46px" }}>
        <line x1="190" x2="190" y1="46" y2="150" stroke="rgb(255 255 255 / 0.25)" strokeDasharray="2 4" />
        <circle cx="190" cy="46" r="6" fill="#0b0b14" stroke="#f0abfc" strokeWidth="3" />
      </motion.g>
    </svg>
  );
}

/** Hand-drawn arrow pointing at the call to action. */
function Squiggle() {
  return (
    <svg viewBox="0 0 80 60" className="h-12 w-16 text-ink/80" aria-hidden="true">
      <motion.path
        d="M6 52 C14 40 18 50 24 38 C30 26 34 40 40 28 C46 16 52 26 60 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, delay: 0.9, ease: EASE }}
      />
      <motion.path d="M50 10 L61 11 L58 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }} />
    </svg>
  );
}

const MINI_BARS = [38, 62, 45, 80, 56, 72, 50];

export function LandingHero({ discoverHref, learnHref }: { discoverHref: string; learnHref: string }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 50, damping: 16 });
  const y = useSpring(py, { stiffness: 50, damping: 16 });

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 6);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 6);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <section onPointerMove={onMove} onPointerLeave={reset} className="relative" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-4xl pt-10 text-center sm:pt-16">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-card/60 px-3.5 py-1.5 text-xs font-semibold text-muted backdrop-blur"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand to-info" />
          Grounded in Qloo’s cultural taste graph
        </motion.p>
        <motion.h1
          id="hero-heading"
          tabIndex={-1}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-ink outline-none sm:text-6xl lg:text-[4.2rem]"
        >
          Find the next big thing in your <span className="highlight-pill">neighbourhood</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }} className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Four AI agents read local cultural signals from Qloo and turn them into one actionable business opportunity, with a small, low-cost pilot to test it.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }} className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={discoverHref} className="btn-primary px-7 py-3.5 text-base">
            Discover Opportunity <ArrowIcon />
          </Link>
          <Link href={learnHref} className="btn-secondary px-6 py-3.5 text-base">
            See how it works
          </Link>
          <span className="pointer-events-none absolute -bottom-14 left-[18%] hidden sm:block">
            <Squiggle />
          </span>
        </motion.div>
      </div>

      {/* Product preview: an example report, labelled illustrative. */}
      <div className="relative mx-auto mt-16 h-[300px] max-w-5xl sm:mt-20 sm:h-[320px]" aria-label="Example opportunity report (illustrative)" role="img">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
          className="bg-hero absolute left-1/2 top-0 w-[92%] max-w-[480px] -translate-x-1/2 rounded-3xl border border-white/10 p-5 text-white shadow-[0_30px_80px_-30px_rgb(124_58_237/0.6)]"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-sm font-semibold">Opportunity report</p>
              <p className="text-xs text-white/55">Cultural fit by area · example</p>
            </div>
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-semibold text-white/70">Illustrative</span>
          </div>
          <div className="relative mt-3">
            <ReportChart />
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2, duration: 0.4 }}
              className="absolute left-[43%] top-0 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-[#0b0b14] px-2 py-1 text-center text-[10px] leading-tight ring-1 ring-white/15"
            >
              <span className="block text-white/60">Koramangala</span>
              <span className="font-bold">78 / 100</span>
            </motion.span>
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-white/45">
            {["Jayanagar", "HSR", "Koramangala", "BTM", "Indiranagar"].map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
        </motion.div>

        {/* Floating stat cards (white on dark, as in the reference); hidden on small screens. */}
        <Floating x={x} y={y} depth={2.4} delay={0.7} className="left-0 top-6 hidden md:block lg:left-4">
          <div className="w-52 rounded-2xl bg-white p-4 text-left text-[#14121f] shadow-2xl">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-[#5a5870]">Cultural fit</span>
              <span className="text-2xl font-bold">82</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[#eeeafe]">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#5b45d6] to-[#7dd3fc]" initial={{ width: 0 }} animate={{ width: "82%" }} transition={{ delay: 1.2, duration: 1, ease: EASE }} />
            </div>
          </div>
        </Floating>
        <Floating x={x} y={y} depth={-1.8} delay={0.85} className="left-6 top-32 hidden md:block lg:left-14">
          <div className="w-56 rounded-2xl bg-gradient-to-br from-[#efe7ff] to-[#f5d0fe] p-4 text-left text-[#14121f] shadow-2xl">
            <p className="text-xs font-semibold">Qloo taste signals</p>
            <p className="text-[10px] text-[#5a5870]">Affinity by venue type</p>
            <div className="mt-2 flex h-10 items-end gap-1.5">
              {MINI_BARS.map((h, i) => (
                <motion.span key={i} className="w-3 rounded-sm bg-[#14121f]" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 1.1 + i * 0.06, duration: 0.5, ease: EASE }} />
              ))}
            </div>
          </div>
        </Floating>
        <Floating x={x} y={y} depth={-2.4} delay={0.8} className="right-0 top-4 hidden md:block lg:right-4">
          <div className="w-52 rounded-2xl bg-white p-4 text-left text-[#14121f] shadow-2xl">
            <span className="text-xs font-medium text-[#5a5870]">Pilot budget</span>
            <div className="mt-1 flex items-end justify-between">
              <span className="text-xl font-bold">₹13,000</span>
              <svg viewBox="0 0 60 20" className="h-5 w-14" aria-hidden="true">
                <path d="M0 15 L10 12 L18 16 L28 8 L36 11 L46 4 L60 7" fill="none" stroke="#5b45d6" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-[#0e7c66]">Fits a ₹15,000 budget</span>
          </div>
        </Floating>
        <Floating x={x} y={y} depth={1.8} delay={0.95} className="right-8 top-36 hidden md:block lg:right-16">
          <div className="flex w-56 items-center gap-3 rounded-2xl bg-gradient-to-br from-[#f5d0fe] to-[#ddd6fe] p-4 text-left text-[#14121f] shadow-2xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14121f] text-sm text-white" aria-hidden="true">
              ✓
            </span>
            <span>
              <span className="block text-[10px] font-medium text-[#5a5870]">Top opportunity</span>
              <span className="text-sm font-bold">Art print pop-up</span>
            </span>
          </div>
        </Floating>
      </div>
    </section>
  );
}
