"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon } from "./ui";

/**
 * Landing hero: headline, caption and calls to action on the left; a miniature 3D neighbourhood
 * on the right (buildings, market stalls, pop-up booths and people walking along the pavements);
 * an example opportunity report below. The city is pure CSS 3D (no WebGL, no extra download).
 * People walk continuously with compositor-only CSS animations that pause when the scene is off
 * screen and stop entirely for reduced-motion users. Every number in the report is illustrative.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

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
  glow?: string;
}

/** A box standing on the ground plane. Only the two faces the camera sees are drawn. */
function Block({ x, y, w, d, h, top, front, side, z = 0, frontPattern, sidePattern, topChildren, round, glow }: BlockProps) {
  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: d, transformStyle: "preserve-3d", transform: `translateZ(${z}px)` }}>
      <div
        className="absolute inset-0"
        style={{ background: top, transform: `translateZ(${h}px)`, borderRadius: round ? "50%" : 3, transformStyle: "preserve-3d", boxShadow: glow ? `0 0 24px ${glow}` : undefined }}
      >
        {topChildren}
      </div>
      {!round && (
        <>
          <div className="absolute left-0" style={{ top: d, width: w, height: h, background: frontPattern ? `${frontPattern}, ${front}` : front, transformOrigin: "top", transform: "rotateX(90deg)" }} />
          <div className="absolute top-0" style={{ left: w, width: h, height: d, background: sidePattern ? `${sidePattern}, ${side}` : side, transformOrigin: "left", transform: "rotateY(-90deg)" }} />
        </>
      )}
    </div>
  );
}

/** Something upright that faces the camera (trees, people, signs). */
function Upright({ children }: { children: React.ReactNode }) {
  return <div style={{ transformOrigin: "bottom center", transform: "rotateZ(-45deg) rotateX(-90deg) translate(-50%, 0)", transformStyle: "preserve-3d" }}>{children}</div>;
}

function Billboard({ x, y, z = 0, children }: { x: number; y: number; z?: number; children: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: x, top: y, transformStyle: "preserve-3d", transform: `translateZ(${z}px)` }}>
      <Upright>{children}</Upright>
    </div>
  );
}

const windows = (color: string, step = 16) =>
  `repeating-linear-gradient(90deg, transparent 0 5px, ${color} 5px 11px, transparent 11px ${step}px) 0 8px / 100% 10px no-repeat, repeating-linear-gradient(90deg, transparent 0 5px, ${color} 5px 11px, transparent 11px ${step}px) 0 26px / 100% 10px no-repeat`;
const stripes = (a: string, b = "#241433") => `repeating-linear-gradient(90deg, ${a} 0 7px, ${b} 7px 14px)`;

// Night-time palette for the aurora theme.
const STALL = { top: "#2a2550", front: "#1c1838", side: "#15122c" } as const;

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <Billboard x={x} y={y}>
      <div className="flex flex-col items-center" style={{ transform: `scale(${s})`, transformOrigin: "bottom center" }}>
        <div className="h-7 w-7 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #5eead4, #0f766e 70%)", boxShadow: "0 0 14px rgb(94 234 212 / 0.45)" }} />
        <div className="-mt-1 h-3 w-1 rounded-sm bg-[#3b2f5c]" />
      </div>
    </Billboard>
  );
}

/** Market stall with a round umbrella. */
function UmbrellaStall({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Block x={x} y={y} w={26} d={20} h={12} {...STALL} topChildren={<div className="absolute -inset-2 rounded-full" style={{ background: color, transform: "translateZ(12px)", boxShadow: `0 0 18px ${color}` }} />} />
  );
}

/** Pop-up booth: a counter with a striped canopy and a lit front. */
function Booth({ x, y, color, w = 28 }: { x: number; y: number; color: string; w?: number }) {
  return (
    <Block
      x={x}
      y={y}
      w={w}
      d={18}
      h={13}
      {...STALL}
      frontPattern={`linear-gradient(${color}55, ${color}55) 0 0 / 100% 3px no-repeat`}
      topChildren={
        <div
          className="absolute"
          style={{ inset: "-3px -4px", background: stripes(color, "#f5f5fa"), transform: "translateZ(11px)", borderRadius: 2, boxShadow: `0 0 16px ${color}88`, opacity: 0.95 }}
        />
      }
    />
  );
}

/** A small walking figure: moves along a pavement path with a gentle step bob. */
function Walker({ path, x, y, color, duration, delay, alternate }: { path: string; x: number; y: number; color: string; duration: number; delay: number; alternate?: boolean }) {
  return (
    <div
      className={`walker ${path}`}
      style={{ "--x": `${x}px`, "--y": `${y}px`, animationDuration: `${duration}s`, animationDelay: `${delay}s`, animationDirection: alternate ? "alternate" : "normal" } as React.CSSProperties}
    >
      <Upright>
        <div className="walker-bob flex flex-col items-center">
          <div className="h-2 w-2 rounded-full bg-[#e7e2ff]" />
          <div className="h-3.5 w-2.5 rounded-t-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        </div>
      </Upright>
    </div>
  );
}

function CityScene() {
  return (
    <div className="relative" style={{ width: 340, height: 340, transformStyle: "preserve-3d" }}>
      {/* Ground plate with a faint grid, and glowing streets. */}
      <Block
        x={0}
        y={0}
        w={340}
        d={340}
        h={14}
        z={-14}
        top="linear-gradient(rgb(196 181 253 / .07) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(90deg, rgb(196 181 253 / .07) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(135deg, #1d1940, #110f26)"
        front="#0d0b1d"
        side="#090816"
      />
      <div className="absolute" style={{ left: 0, top: 158, width: 340, height: 26, background: "#211d42", transform: "translateZ(0.5px)" }} />
      <div className="absolute" style={{ left: 158, top: 0, width: 26, height: 340, background: "#211d42", transform: "translateZ(0.5px)" }} />
      <div className="absolute" style={{ left: 0, top: 170, width: 340, height: 2, background: "repeating-linear-gradient(90deg, #7dd3fc 0 10px, transparent 10px 20px)", transform: "translateZ(1px)", boxShadow: "0 0 8px #7dd3fc" }} />
      <div className="absolute" style={{ left: 170, top: 0, width: 2, height: 340, background: "repeating-linear-gradient(0deg, #c4b5fd 0 10px, transparent 10px 20px)", transform: "translateZ(1px)", boxShadow: "0 0 8px #c4b5fd" }} />

      {/* Creative studio: tall violet glass tower with lit windows. */}
      <Block x={22} y={20} w={78} d={66} h={96} top="linear-gradient(135deg, #ddd6fe, #a78bfa)" front="#2b2360" side="#1f1a48" frontPattern={windows("rgb(196 181 253 / .85)")} sidePattern={windows("rgb(196 181 253 / .45)")} glow="rgb(167 139 250 / .6)" />
      {/* Café: orchid roof and a striped awning. */}
      <Block x={196} y={24} w={84} d={60} h={44} top="#f0abfc" front="#2d1a3d" side="#24142f" frontPattern={`${stripes("#f0abfc")} 0 0 / 100% 9px no-repeat`} sidePattern={`${stripes("#f0abfc")} 0 0 / 9px 100% no-repeat`} glow="rgb(240 171 252 / .55)" />
      <Block x={288} y={30} w={28} d={22} h={18} top="#5eead4" front="#0f3b3a" side="#0b2e2d" glow="rgb(94 234 212 / .5)" />
      {/* Independent shop row. */}
      <Block x={30} y={204} w={52} d={50} h={54} top="#7dd3fc" front="#14284a" side="#0f1f3a" frontPattern={windows("rgb(125 211 252 / .8)", 14)} glow="rgb(125 211 252 / .5)" />
      <Block x={88} y={210} w={48} d={44} h={38} top="#a5b4fc" front="#1e1b4b" side="#17153b" frontPattern={windows("rgb(165 180 252 / .8)", 14)} />
      {/* Gallery with a glowing dome. */}
      <Block x={206} y={206} w={92} d={86} h={30} {...STALL} frontPattern="repeating-linear-gradient(90deg, transparent 0 9px, rgb(196 181 253 / .35) 9px 13px)" />
      <Block x={232} y={228} w={40} d={40} h={30} round top="radial-gradient(circle at 35% 35%, #fff, #c4b5fd 55%, #7c3aed)" front="" side="" glow="rgb(196 181 253 / .7)" />

      {/* Weekend market: umbrella stalls along the street. */}
      <UmbrellaStall x={38} y={112} color="#f0abfc" />
      <UmbrellaStall x={78} y={120} color="#c4b5fd" />
      <UmbrellaStall x={116} y={108} color="#5eead4" />
      <UmbrellaStall x={210} y={112} color="#7dd3fc" />
      <UmbrellaStall x={256} y={118} color="#f0abfc" />
      {/* Pop-up booths and a kiosk: where micro-businesses start. */}
      <Booth x={46} y={276} color="#f0abfc" />
      <Booth x={86} y={282} color="#7dd3fc" />
      <Booth x={300} y={108} color="#5eead4" w={24} />
      <Block x={192} y={194} w={22} d={14} h={12} top="#ffd36e" front="#3a2f15" side="#2d2410" glow="rgb(255 211 110 / .5)" />
      <Block x={302} y={300} w={24} d={20} h={16} top="#c4b5fd" front="#231e4a" side="#1a1640" frontPattern={windows("rgb(240 171 252 / .7)", 12)} />

      <Tree x={130} y={36} />
      <Tree x={140} y={70} s={0.8} />
      <Tree x={150} y={300} />
      <Tree x={18} y={306} s={0.85} />
      <Tree x={318} y={186} s={0.9} />

      {/* People walking along the pavements (and browsing the market). */}
      <Walker path="walk-east" x={60} y={190} color="#f0abfc" duration={22} delay={0} />
      <Walker path="walk-west" x={250} y={152} color="#c4b5fd" duration={26} delay={-9} />
      <Walker path="walk-south" x={190} y={60} color="#5eead4" duration={24} delay={-4} />
      <Walker path="walk-north" x={152} y={260} color="#7dd3fc" duration={20} delay={-13} />
      <Walker path="walk-turn" x={240} y={190} color="#ffd36e" duration={28} delay={-6} />
      <Walker path="walk-market-a" x={70} y={146} color="#a5b4fc" duration={13} delay={-3} alternate />
      <Walker path="walk-market-b" x={240} y={146} color="#f0abfc" duration={11} delay={-7} alternate />
      <Walker path="walk-booths" x={90} y={308} color="#5eead4" duration={10} delay={-2} alternate />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating tags: the cultural signals the scene represents (illustrative labels)
// ---------------------------------------------------------------------------

const TAGS = [
  { text: "Indie coffee", dot: "#f0abfc", pos: "left-[2%] top-[12%]" },
  { text: "Art & design", dot: "#c4b5fd", pos: "right-[0%] top-[6%]" },
  { text: "Thrift fashion", dot: "#5eead4", pos: "right-[0%] top-[58%]" },
  { text: "Weekend markets", dot: "#7dd3fc", pos: "left-[0%] top-[64%]" },
  { text: "Pop-up stalls", dot: "#ffd36e", pos: "left-[34%] bottom-[0%]" },
];

/** The neighbourhood with pointer tilt (mouse only); it floats gently and pauses when off screen. */
function Neighbourhood() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(px, { stiffness: 60, damping: 18 });
  const ry = useSpring(py, { stiffness: 60, damping: 18 });
  const transform = useMotionTemplate`rotateX(calc(56deg + ${ry}deg)) rotateZ(calc(45deg + ${rx}deg))`;

  // Pause the walking animation while the scene is off screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
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
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
      className="relative mx-auto h-[300px] w-full max-w-[480px] sm:h-[440px]"
      data-paused={visible ? undefined : "true"}
      aria-hidden="true"
    >
      <div className="city absolute inset-0 flex items-center justify-center">
        <div className="animate-float origin-center scale-[0.66] sm:scale-100" style={{ perspective: 1400 }}>
          <motion.div style={{ transform, transformStyle: "preserve-3d" }}>
            <CityScene />
          </motion.div>
        </div>
      </div>
      {TAGS.map((t, i) => (
        <motion.span
          key={t.text}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 + i * 0.12, ease: EASE }}
          className={`absolute ${t.pos} hidden items-center gap-1.5 rounded-full border border-line bg-card/85 px-3 py-1.5 text-xs font-semibold text-ink shadow-[var(--shadow-lift)] backdrop-blur sm:inline-flex`}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: t.dot }} />
          {t.text}
        </motion.span>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Example report chart: only the graph responds to the pointer
// ---------------------------------------------------------------------------

const LINE = "M0,120 C40,110 60,70 100,78 C140,86 150,40 190,46 C230,52 240,96 280,90 C320,84 330,30 370,24 C400,20 420,40 440,34";

/**
 * Illustrative chart. On mouse hover a guide line and a dot follow the pointer along the curve,
 * the line brightens and the fill shifts very slightly; the data and the card never move.
 */
function ReportChart() {
  const reduce = useReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const samples = useRef<{ x: number; y: number }[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path || typeof path.getTotalLength !== "function") return;
    const total = path.getTotalLength();
    samples.current = Array.from({ length: 221 }, (_, i) => {
      const p = path.getPointAtLength((i / 220) * total);
      return { x: p.x, y: p.y };
    });
  }, []);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (reduce || e.pointerType !== "mouse" || samples.current.length === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * 440;
    let best = samples.current[0]!;
    for (const s of samples.current) if (Math.abs(s.x - vx) < Math.abs(best.x - vx)) best = s;
    setHover(best);
  };

  const shift = hover ? (hover.x / 440 - 0.5) * 4 : 0;
  return (
    <svg viewBox="0 0 440 150" className="report-chart h-36 w-full sm:h-44" role="presentation" onPointerMove={onMove} onPointerLeave={() => setHover(null)} data-hover={hover ? "true" : undefined}>
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
      <motion.path d={`${LINE} L440,150 L0,150 Z`} fill="url(#hero-area)" initial={{ opacity: 0 }} animate={{ opacity: hover ? 1 : 0.85, x: shift, y: hover ? -1.5 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
      <motion.path
        ref={pathRef}
        d={LINE}
        fill="none"
        stroke="url(#hero-line)"
        strokeLinecap="round"
        className="report-line"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1, strokeWidth: hover ? 3.6 : 3 }}
        transition={{ pathLength: { duration: 1.6, delay: 0.5, ease: EASE }, strokeWidth: { duration: 0.25 } }}
      />
      {/* The pinned example point (Koramangala). */}
      <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 1.8 }} style={{ transformOrigin: "190px 46px" }}>
        <line x1="190" x2="190" y1="46" y2="150" stroke="rgb(255 255 255 / 0.25)" strokeDasharray="2 4" />
        <circle cx="190" cy="46" r="6" fill="#0b0b14" stroke="#f0abfc" strokeWidth="3" />
      </motion.g>
      {/* Hover guide that follows the pointer along the curve. */}
      {hover && (
        <g pointerEvents="none">
          <line x1={hover.x} x2={hover.x} y1={hover.y} y2="150" stroke="rgb(196 181 253 / 0.5)" strokeWidth="1" />
          <circle cx={hover.x} cy={hover.y} r="10" fill="rgb(196 181 253 / 0.18)" />
          <circle cx={hover.x} cy={hover.y} r="4.5" fill="#ffffff" stroke="#c4b5fd" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

const MINI_BARS = [38, 62, 45, 80, 56, 72, 50];

/** Example opportunity report with small stat cards around it (illustrative; the cards stay still). */
function ReportPreview() {
  return (
    <div className="relative mx-auto mt-10 h-[300px] max-w-5xl sm:mt-14 sm:h-[320px]" aria-label="Example opportunity report (illustrative)" role="img">
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
            className="pointer-events-none absolute left-[43%] top-0 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-[#0b0b14] px-2 py-1 text-center text-[10px] leading-tight ring-1 ring-white/15"
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

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.7, ease: EASE }} className="absolute left-0 top-6 hidden md:block lg:left-4">
        <div className="w-52 rounded-2xl bg-white p-4 text-left text-[#14121f] shadow-2xl">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-[#5a5870]">Cultural fit</span>
            <span className="text-2xl font-bold">82</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[#eeeafe]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[#5b45d6] to-[#7dd3fc]" initial={{ width: 0 }} animate={{ width: "82%" }} transition={{ delay: 1.2, duration: 1, ease: EASE }} />
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.85, ease: EASE }} className="absolute left-6 top-32 hidden md:block lg:left-14">
        <div className="w-56 rounded-2xl bg-gradient-to-br from-[#efe7ff] to-[#f5d0fe] p-4 text-left text-[#14121f] shadow-2xl">
          <p className="text-xs font-semibold">Qloo taste signals</p>
          <p className="text-[10px] text-[#5a5870]">Affinity by venue type</p>
          <div className="mt-2 flex h-10 items-end gap-1.5">
            {MINI_BARS.map((h, i) => (
              <motion.span key={i} className="w-3 rounded-sm bg-[#14121f]" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 1.1 + i * 0.06, duration: 0.5, ease: EASE }} />
            ))}
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8, ease: EASE }} className="absolute right-0 top-4 hidden md:block lg:right-4">
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
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.95, ease: EASE }} className="absolute right-8 top-36 hidden md:block lg:right-16">
        <div className="flex w-56 items-center gap-3 rounded-2xl bg-gradient-to-br from-[#f5d0fe] to-[#ddd6fe] p-4 text-left text-[#14121f] shadow-2xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14121f] text-sm text-white" aria-hidden="true">
            ✓
          </span>
          <span>
            <span className="block text-[10px] font-medium text-[#5a5870]">Top opportunity</span>
            <span className="text-sm font-bold">Art print pop-up</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function LandingHero({ discoverHref, learnHref }: { discoverHref: string; learnHref: string }) {
  return (
    <section className="relative" aria-labelledby="hero-heading">
      <div className="grid items-center gap-6 pt-8 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pt-14">
        <div className="text-center lg:text-left">
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
            className="mt-5 text-[2.4rem] font-extrabold leading-[1.08] tracking-tight text-ink outline-none sm:text-[3.25rem] lg:text-[3.5rem] xl:text-[3.8rem]"
          >
            Turn cultural signals into your next big <span className="highlight-pill">opportunity.</span>
          </motion.h1>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }} className="mx-auto mt-6 max-w-xl lg:mx-0">
            <p className="text-base leading-relaxed text-muted sm:text-lg">
              Discover promising local business ideas, uncover what makes them relevant, and turn them into small, actionable pilots.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href={discoverHref} className="btn-primary px-7 py-3.5 text-base">
              Discover Opportunity <ArrowIcon />
            </Link>
            <Link href={learnHref} className="btn-secondary px-6 py-3.5 text-base">
              See how it works
            </Link>
          </motion.div>
        </div>
        <Neighbourhood />
      </div>
      <ReportPreview />
    </section>
  );
}
