"use client";

import { useEffect } from "react";

/**
 * Subtle pointer effects, in the style of modern B2B product sites:
 * - a spotlight that reveals a faint dot grid (and a soft wash of light) around the pointer,
 *   trailing it smoothly;
 * - cards whose border and surface light up where the pointer is;
 * - primary buttons that lean a few pixels toward the pointer.
 *
 * Mouse and trackpad only, never with prefers-reduced-motion. The native cursor is untouched,
 * the spotlight layer ignores pointer events, and the animation loop sleeps when nothing moves.
 */

const MAGNETIC = ".btn-primary, [data-magnetic]";

export function CursorEffects() {
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    const root = document.documentElement;
    const target = { x: innerWidth / 2, y: innerHeight / 3 };
    const pos = { ...target };
    let frame = 0;
    let seen = false;
    let card: HTMLElement | null = null;
    let magnet: HTMLElement | null = null;

    const tick = () => {
      frame = 0;
      pos.x += (target.x - pos.x) * 0.14;
      pos.y += (target.y - pos.y) * 0.14;
      root.style.setProperty("--cx", `${pos.x.toFixed(1)}px`);
      root.style.setProperty("--cy", `${pos.y.toFixed(1)}px`);
      if (Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.3) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const releaseCard = () => {
      card?.classList.remove("fx-glow");
      card = null;
    };
    const releaseMagnet = () => {
      if (magnet) magnet.style.translate = "";
      magnet = null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!seen) {
        seen = true;
        pos.x = target.x;
        pos.y = target.y;
        root.classList.add("fx-active");
      }
      const el = e.target instanceof Element ? e.target : null;

      // Card glow follows the pointer inside the hovered card.
      const c = el?.closest<HTMLElement>(".card") ?? null;
      if (c !== card) {
        releaseCard();
        if (c) {
          card = c;
          c.classList.add("fx-glow");
        }
      }
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
        card.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
      }

      // Buttons lean up to ~5 px toward the pointer.
      const m = el?.closest<HTMLElement>(MAGNETIC) ?? null;
      if (m !== magnet) {
        releaseMagnet();
        if (m) {
          magnet = m;
          m.classList.add("fx-magnetic");
        }
      }
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const mx = ((e.clientX - (r.left + r.width / 2)) / r.width) * 6;
        const my = ((e.clientY - (r.top + r.height / 2)) / r.height) * 5;
        magnet.style.translate = `${mx.toFixed(1)}px ${my.toFixed(1)}px`;
      }
      wake();
    };

    const onLeave = () => {
      releaseCard();
      releaseMagnet();
      root.classList.remove("fx-active");
      seen = false;
    };
    const onMediaChange = () => {
      if (!fine.matches || reduced.matches) cleanup();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    reduced.addEventListener("change", onMediaChange);
    fine.addEventListener("change", onMediaChange);

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      reduced.removeEventListener("change", onMediaChange);
      fine.removeEventListener("change", onMediaChange);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      releaseCard();
      releaseMagnet();
      root.classList.remove("fx-active");
    }
    return cleanup;
  }, []);

  return <div aria-hidden="true" className="cursor-spotlight" />;
}
