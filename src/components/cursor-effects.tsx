"use client";

import { useEffect, useRef } from "react";

/**
 * Playful pointer effects, purely decorative:
 * - a soft pastel glow that trails the cursor behind the content and slowly shifts colour;
 * - a light trail of pastel sparkles while the pointer moves;
 * - a ring that follows the cursor and grows over anything clickable;
 * - magnetic buttons that lean toward the pointer and wiggle when it arrives;
 * - cards with the `lift` class that tilt toward the pointer.
 *
 * Only for a fine pointer (mouse or trackpad) and only without prefers-reduced-motion; touch
 * devices and reduced-motion users get none of it. The native cursor is never hidden, all layers
 * ignore pointer events, and one requestAnimationFrame loop runs only while something moves.
 */

const SPARKLE_COLOURS_LIGHT = ["#ff9db5", "#b9a9ff", "#8fdcb8", "#9cc8ff", "#ffc49b", "#ffd76e"];
const SPARKLE_COLOURS_DARK = ["#ff9db8", "#c6b6ff", "#82deb7", "#9cc8ff", "#ffc49b", "#ffe08a"];
const INTERACTIVE = 'a[href], button:not(:disabled), [role="button"], [role="tab"], [role="radio"], summary, label[for], select';
const MAGNETIC = ".btn-primary, [data-magnetic]";
const TEXT_INPUT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"]';
const MAX_SPARKLES = 70;

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  colour: string;
  star: boolean;
  spin: number;
}

export function CursorEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    const canvas = canvasRef.current;
    const glow = glowRef.current;
    const ring = ringRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !glow || !ring || !ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
    };
    resize();

    const pointer = { x: innerWidth / 2, y: innerHeight / 3, seen: false };
    const glowPos = { ...pointer };
    const ringPos = { ...pointer };
    let ringScale = 1;
    let ringTarget = 1;
    let pressed = false;
    let lastSpawn = { x: pointer.x, y: pointer.y };
    const sparkles: Sparkle[] = [];
    let frame = 0;
    let hue = 0;
    let magnet: HTMLElement | null = null;
    let tilted: HTMLElement | null = null;

    const dark = () => document.documentElement.dataset.theme === "dark";

    const spawn = (x: number, y: number, burst = false) => {
      const colours = dark() ? SPARKLE_COLOURS_DARK : SPARKLE_COLOURS_LIGHT;
      const count = burst ? 14 : 1;
      for (let i = 0; i < count && sparkles.length < MAX_SPARKLES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = burst ? 1.2 + Math.random() * 2.4 : 0.2 + Math.random() * 0.6;
        const max = burst ? 40 + Math.random() * 25 : 34 + Math.random() * 26;
        sparkles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (burst ? 0.6 : 0.25),
          life: 0,
          max,
          size: burst ? 3 + Math.random() * 4 : 2 + Math.random() * 3.5,
          colour: colours[Math.floor(Math.random() * colours.length)]!,
          star: Math.random() < 0.45,
          spin: Math.random() * Math.PI,
        });
      }
    };

    const drawStar = (s: Sparkle, alpha: number) => {
      const r = s.size * (1 - (s.life / s.max) * 0.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.colour;
      ctx.translate(s.x * dpr, s.y * dpr);
      ctx.rotate(s.spin + s.life * 0.05);
      ctx.scale(dpr, dpr);
      ctx.beginPath();
      if (s.star) {
        // Four-point sparkle.
        for (let i = 0; i < 8; i++) {
          const rad = i % 2 === 0 ? r * 1.6 : r * 0.45;
          const a = (i * Math.PI) / 4;
          ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
      } else {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      frame = 0;
      // Glow and ring ease toward the pointer at different speeds, so they trail playfully.
      glowPos.x += (pointer.x - glowPos.x) * 0.08;
      glowPos.y += (pointer.y - glowPos.y) * 0.08;
      ringPos.x += (pointer.x - ringPos.x) * 0.28;
      ringPos.y += (pointer.y - ringPos.y) * 0.28;
      ringScale += ((pressed ? ringTarget * 0.75 : ringTarget) - ringScale) * 0.2;
      hue = (hue + 0.4) % 360;
      glow.style.transform = `translate3d(${glowPos.x - 260}px, ${glowPos.y - 260}px, 0)`;
      glow.style.filter = `hue-rotate(${Math.round(hue)}deg)`;
      ring.style.transform = `translate3d(${ringPos.x - 16}px, ${ringPos.y - 16}px, 0) scale(${ringScale.toFixed(3)})`;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i]!;
        s.life++;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.03; // a little gravity
        s.vx *= 0.97;
        if (s.life >= s.max) {
          sparkles.splice(i, 1);
          continue;
        }
        drawStar(s, Math.sin((s.life / s.max) * Math.PI) * 0.9);
      }

      const settling = Math.abs(pointer.x - glowPos.x) + Math.abs(pointer.y - glowPos.y) > 0.5 || Math.abs(ringTarget - ringScale) > 0.01;
      if (sparkles.length > 0 || settling) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const releaseMagnet = () => {
      if (magnet) magnet.style.translate = "";
      magnet = null;
    };
    const releaseTilt = () => {
      if (tilted) {
        tilted.style.removeProperty("--tilt-x");
        tilted.style.removeProperty("--tilt-y");
      }
      tilted = null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (!pointer.seen) {
        pointer.seen = true;
        glowPos.x = ringPos.x = pointer.x;
        glowPos.y = ringPos.y = pointer.y;
        document.documentElement.classList.add("fx-active");
      }

      // Sparkles: one every ~14 px of travel, so a still cursor stays calm.
      const dx = pointer.x - lastSpawn.x;
      const dy = pointer.y - lastSpawn.y;
      if (dx * dx + dy * dy > 196) {
        spawn(pointer.x, pointer.y);
        lastSpawn = { x: pointer.x, y: pointer.y };
      }

      const target = e.target instanceof Element ? e.target : null;
      const overText = Boolean(target?.closest(TEXT_INPUT));
      const overInteractive = Boolean(target?.closest(INTERACTIVE));
      ringTarget = overText ? 0 : overInteractive ? 1.7 : 1;
      ring.dataset.hover = overInteractive && !overText ? "true" : "false";

      // Magnetic buttons lean up to ~8 px toward the pointer; they wiggle once on arrival.
      const m = target?.closest<HTMLElement>(MAGNETIC) ?? null;
      if (m !== magnet) {
        releaseMagnet();
        if (m) {
          magnet = m;
          m.classList.add("fx-magnetic");
          m.classList.remove("fx-wiggle");
          void m.offsetWidth; // restart the animation
          m.classList.add("fx-wiggle");
        }
      }
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const mx = ((pointer.x - (r.left + r.width / 2)) / r.width) * 10;
        const my = ((pointer.y - (r.top + r.height / 2)) / r.height) * 8;
        magnet.style.translate = `${mx.toFixed(1)}px ${my.toFixed(1)}px`;
      }

      // Cards tilt toward the pointer, at most ~5 degrees.
      const card = target?.closest<HTMLElement>(".lift") ?? null;
      if (card !== tilted) releaseTilt();
      if (card) {
        tilted = card;
        const r = card.getBoundingClientRect();
        const px = (pointer.x - r.left) / r.width - 0.5;
        const py = (pointer.y - r.top) / r.height - 0.5;
        card.style.setProperty("--tilt-x", `${(-py * 6).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${(px * 7).toFixed(2)}deg`);
      }
      wake();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pressed = true;
      // A small burst of confetti on clicks of buttons and links.
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) spawn(e.clientX, e.clientY, true);
      wake();
    };
    const onUp = () => {
      pressed = false;
      wake();
    };
    const onLeave = () => {
      ringTarget = 0;
      releaseMagnet();
      releaseTilt();
      wake();
    };
    const onAnimationEnd = (e: AnimationEvent) => {
      if (e.animationName === "c2c-wiggle" && e.target instanceof HTMLElement) e.target.classList.remove("fx-wiggle");
    };
    const onMediaChange = () => {
      if (!fine.matches || reduced.matches) {
        cleanup();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("animationend", onAnimationEnd);
    window.addEventListener("resize", resize);
    reduced.addEventListener("change", onMediaChange);
    fine.addEventListener("change", onMediaChange);

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("animationend", onAnimationEnd);
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", onMediaChange);
      fine.removeEventListener("change", onMediaChange);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      releaseMagnet();
      releaseTilt();
      ctx?.clearRect(0, 0, canvas!.width, canvas!.height);
      document.documentElement.classList.remove("fx-active");
    }
    return cleanup;
  }, []);

  return (
    <div aria-hidden="true" className="cursor-fx">
      <div ref={glowRef} className="cursor-glow" />
      <canvas ref={canvasRef} className="cursor-sparkles" />
      <div ref={ringRef} className="cursor-ring" data-hover="false" />
    </div>
  );
}
