"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import Link from "next/link";
import { forwardRef } from "react";
import { ArrowIcon } from "./ui";

/**
 * Landing hero: headline and calls to action on the left, a miniature 3D neighbourhood on the right.
 * The city is pure CSS 3D (no WebGL, no extra download), so it renders with the page and costs
 * nothing on slow devices. It floats gently and tilts with the pointer; both stop for reduced motion.
 */

// ---------------------------------------------------------------------------
// CSS 3D primitives
// ---------------------------------------------------------------------------

interface BlockProps {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  top: string;
  front: string;
  side: string;
  z?: number;
  frontPattern?: string;
  sidePattern?: string;
  topChildren?: React.ReactNode;
  round?: boolean;
}

/** A box standing on the ground plane. Only the two faces the camera sees are drawn. */
function Block({ x, y, w, d, h, top, front, side, z = 0, frontPattern, sidePattern, topChildren, round }: BlockProps) {
  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: d, transformStyle: "preserve-3d", transform: `translateZ(${z}px)` }}>
      <div className="absolute inset-0" style={{ background: top, transform: `translateZ(${h}px)`, borderRadius: round ? "50%" : 3, transformStyle: "preserve-3d" }}>
        {topChildren}
      </div>
      {!round && (
        <>
          <div
            className="absolute left-0"
            style={{ top: d, width: w, height: h, background: frontPattern ? `${frontPattern}, ${front}` : front, transformOrigin: "top", transform: "rotateX(90deg)" }}
          />
          <div
            className="absolute top-0"
            style={{ left: w, width: h, height: d, background: sidePattern ? `${sidePattern}, ${side}` : side, transformOrigin: "left", transform: "rotateY(-90deg)" }}
          />
        </>
      )}
    </div>
  );
}

/** Something that stands upright and faces the camera (trees, signs, people). */
function Billboard({ x, y, z = 0, children }: { x: number; y: number; z?: number; children: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: x, top: y, transformStyle: "preserve-3d", transform: `translateZ(${z}px)` }}>
      <div style={{ transformOrigin: "bottom center", transform: "rotateZ(-45deg) rotateX(-90deg) translate(-50%, 0)", transformStyle: "preserve-3d" }}>{children}</div>
    </div>
  );
}

const windows = (color: string, step = 16) =>
  `repeating-linear-gradient(90deg, transparent 0 5px, ${color} 5px 11px, transparent 11px ${step}px) 0 8px / 100% 10px no-repeat, repeating-linear-gradient(90deg, transparent 0 5px, ${color} 5px 11px, transparent 11px ${step}px) 0 26px / 100% 10px no-repeat`;

const stripes = (a: string) => `repeating-linear-gradient(90deg, ${a} 0 7px, #fffbf7 7px 14px)`;

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <Billboard x={x} y={y}>
      <div className="flex flex-col items-center" style={{ transform: `scale(${s})`, transformOrigin: "bottom center" }}>
        <div className="h-7 w-7 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #93deb9, #4fae86 70%)" }} />
        <div className="-mt-1 h-3 w-1 rounded-sm bg-[#a07a5c]" />
      </div>
    </Billboard>
  );
}

function Person({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Billboard x={x} y={y}>
      <div className="flex flex-col items-center">
        <div className="h-2 w-2 rounded-full bg-[#6d5146]" />
        <div className="h-3.5 w-2.5 rounded-t-full" style={{ background: color }} />
      </div>
    </Billboard>
  );
}

function CityScene() {
  return (
    <div className="relative" style={{ width: 340, height: 340, transformStyle: "preserve-3d" }}>
      {/* Ground: a thick sage plate with a cream street grid. */}
      <Block x={0} y={0} w={340} d={340} h={14} z={-14} top="#d8f1e4" front="#bde3cf" side="#a6d5bd" />
      <div className="absolute" style={{ left: 0, top: 158, width: 340, height: 26, background: "#fffbf7", transform: "translateZ(0.5px)" }} />
      <div className="absolute" style={{ left: 158, top: 0, width: 26, height: 340, background: "#fffbf7", transform: "translateZ(0.5px)" }} />
      <div className="absolute" style={{ left: 0, top: 170, width: 340, height: 2, background: "repeating-linear-gradient(90deg, #ece4f7 0 10px, transparent 10px 20px)", transform: "translateZ(1px)" }} />

      {/* Creative studio: tall lavender block. */}
      <Block x={22} y={20} w={78} d={66} h={96} top="#cfc2ff" front="#e9e2ff" side="#bcaef5" frontPattern={windows("rgba(74,58,140,.35)")} sidePattern={windows("rgba(74,58,140,.3)")} />
      {/* Café: cream walls, coral roof and a striped awning. */}
      <Block x={196} y={24} w={84} d={60} h={44} top="#ff9fb6" front="#fff1f5" side="#f6d8e2" frontPattern={`${stripes("#ff9fb6")} 0 0 / 100% 9px no-repeat`} sidePattern={`${stripes("#ff9fb6")} 0 0 / 9px 100% no-repeat`} />
      <Block x={288} y={30} w={28} d={22} h={18} top="#7d6ee6" front="#62c7a2" side="#4caf8b" />
      {/* Independent shop row. */}
      <Block x={30} y={204} w={52} d={50} h={54} top="#7d6ee6" front="#d8f1e4" side="#c6e8d6" frontPattern={windows("rgba(91,75,196,.3)", 14)} />
      <Block x={88} y={210} w={48} d={44} h={38} top="#ffc6a6" front="#fffbf7" side="#f4e0d3" frontPattern={windows("rgba(184,54,95,.3)", 14)} />
      {/* Cultural venue / gallery with a round dome. */}
      <Block x={206} y={206} w={92} d={86} h={30} top="#f3eefe" front="#fdfbff" side="#ece4f7" frontPattern={`repeating-linear-gradient(90deg, transparent 0 9px, rgba(91,75,196,.22) 9px 13px)`} />
      <Block x={232} y={228} w={40} d={40} h={30} z={0} round top="radial-gradient(circle at 35% 35%, #fff, #e9e2ff 60%, #b7a8f0)" front="" side="" />

      {/* Weekend market stalls with umbrellas. */}
      {[
        [38, 112, "#ff9fb6"],
        [78, 120, "#9d8cf0"],
        [116, 108, "#62c7a2"],
      ].map(([x, y, c]) => (
        <Block key={`${x}`} x={x as number} y={y as number} w={26} d={20} h={12} top="#fffbf7" front="#ece4f7" side="#ddd3ee" topChildren={<div className="absolute -inset-2 rounded-full opacity-95" style={{ background: c as string, transform: "translateZ(12px)" }} />} />
      ))}
      <Block x={210} y={112} w={30} d={22} h={14} top="#fffbf7" front="#ece4f7" side="#ddd3ee" topChildren={<div className="absolute -inset-2 rounded-full" style={{ background: "#ffd36e", transform: "translateZ(12px)" }} />} />
      <Block x={256} y={118} w={30} d={22} h={14} top="#fffbf7" front="#ece4f7" side="#ddd3ee" topChildren={<div className="absolute -inset-2 rounded-full" style={{ background: "#ff9fb6", transform: "translateZ(12px)" }} />} />

      <Tree x={130} y={36} />
      <Tree x={140} y={70} s={0.8} />
      <Tree x={150} y={290} />
      <Tree x={22} y={300} s={0.85} />
      <Tree x={310} y={180} s={0.9} />
      <Person x={176} y={110} color="#ff9fb6" />
      <Person x={190} y={146} color="#9d8cf0" />
      <Person x={150} y={196} color="#62c7a2" />
      <Person x={240} y={176} color="#ffd36e" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating tags: the cultural signals the scene represents (illustrative labels)
// ---------------------------------------------------------------------------

const TAGS = [
  { text: "Indie coffee", dot: "#ff9fb6", pos: "left-[2%] top-[14%]", depth: 2.6 },
  { text: "Art & design", dot: "#9d8cf0", pos: "right-[0%] top-[8%]", depth: -2.2 },
  { text: "Thrift fashion", dot: "#62c7a2", pos: "right-[2%] top-[56%]", depth: 3.2 },
  { text: "Weekend markets", dot: "#ffd36e", pos: "left-[0%] top-[62%]", depth: -2.8 },
  { text: "Live music", dot: "#7d6ee6", pos: "left-[30%] bottom-[2%]", depth: 1.8 },
];

/** Wraps a floating tag so it shifts with the pointer; depth sets direction and distance. */
function ParallaxTag({ x, y, depth, className, children }: { x: MotionValue<number>; y: MotionValue<number>; depth: number; className: string; children: React.ReactNode }) {
  const dx = useTransform(x, (v) => v * depth);
  const dy = useTransform(y, (v) => v * depth);
  return (
    <motion.div className={`absolute ${className}`} style={{ x: dx, y: dy }}>
      {children}
    </motion.div>
  );
}

export function CityHero({ discoverHref, learnHref, children }: { discoverHref: string; learnHref: string; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(px, { stiffness: 60, damping: 18 });
  const ry = useSpring(py, { stiffness: 60, damping: 18 });
  const transform = useMotionTemplate`rotateX(calc(56deg + ${ry}deg)) rotateZ(calc(45deg + ${rx}deg))`;
  // Floating tags drift with the pointer at different depths (parallax).
  const tagX = useTransform(rx, (v) => v * 2.2);
  const tagY = useTransform(ry, (v) => -v * 2.6);

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 10);
    py.set(-((e.clientY - r.top) / r.height - 0.5) * 6);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <section onPointerMove={onMove} onPointerLeave={reset} className="relative -mx-4 overflow-hidden px-4 sm:-mx-6 sm:px-6" aria-labelledby="hero-heading">
      {/* Soft background washes, kept behind the content. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[6%] top-[8%] h-80 w-80 rounded-full bg-lavender/80 blur-3xl" />
        <div className="absolute bottom-[10%] right-[30%] h-56 w-56 rounded-full bg-sage/80 blur-3xl" />
        <div className="absolute left-[-4%] top-[30%] h-64 w-64 rounded-full bg-peach/70 blur-3xl" />
      </div>

      <div className="grid items-center gap-6 py-8 sm:py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:py-16">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-card/80 px-3 py-1 text-xs font-semibold text-brand shadow-sm"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-spark" />
            Grounded in Qloo’s cultural taste graph
          </motion.p>
          {children}
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }} className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Four AI agents. Local cultural insights. One actionable business opportunity, with a small pilot to test it.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.25 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={discoverHref} className="btn-primary px-6 py-3.5 text-base">
              Discover Opportunity <ArrowIcon />
            </Link>
            <Link href={learnHref} className="inline-flex items-center justify-center rounded-[0.875rem] px-4 py-3.5 text-base font-semibold text-brand underline-offset-4 hover:underline">
              See how it works
            </Link>
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }} className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-sm">
            {[
              ["4 agents", "research, fit, feasibility, pilot"],
              ["Up to 3", "localities compared"],
              ["1–8", "weekend pilots"],
            ].map(([k, v]) => (
              <div key={k} className="border-l-2 border-spark/60 pl-3">
                <dt className="font-display text-xl font-semibold text-brand">{k}</dt>
                <dd className="text-xs text-muted">{v}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto h-[300px] w-full max-w-[460px] sm:h-[440px]"
          aria-hidden="true"
        >
          <div className="hero-city absolute inset-0 flex items-center justify-center">
            <div className="animate-float origin-center scale-[0.68] sm:scale-100" style={{ perspective: 1400 }}>
              <motion.div style={{ transform, transformStyle: "preserve-3d" }}>
                <CityScene />
              </motion.div>
            </div>
          </div>
          {TAGS.map((t, i) => (
            <ParallaxTag key={t.text} x={tagX} y={tagY} depth={t.depth} className={t.pos}>
            <motion.span
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="hidden items-center gap-1.5 rounded-full border border-line bg-card/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-[var(--shadow-lift)] backdrop-blur sm:inline-flex"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: t.dot }} />
              {t.text}
            </motion.span>
            </ParallaxTag>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/** The hero headline, separate so app.tsx keeps its focus ref on the page's h1. */
export const HeroHeadline = forwardRef<HTMLHeadingElement>(function HeroHeadline(_, ref) {
  return (
    <motion.h1
      ref={ref}
      id="hero-heading"
      tabIndex={-1}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="mt-5 text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-brand outline-none sm:text-6xl lg:text-[4.1rem]"
    >
      Find the next big thing <span className="text-gradient italic">in your neighbourhood.</span>
    </motion.h1>
  );
});
