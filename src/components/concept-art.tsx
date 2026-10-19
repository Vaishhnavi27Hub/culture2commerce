"use client";

import { useId, useState } from "react";

/**
 * A picture for the recommended business idea. Each concept gets a themed illustration of a
 * market stall (inline SVG: no network, no licence questions, works offline at a demo). To use
 * real photos instead, add a legally usable image URL to CONCEPT_PHOTOS; if it fails to load,
 * the illustration is shown.
 */

/** Optional photo per concept id (e.g. "/concepts/art-prints.jpg"). Empty by default. */
export const CONCEPT_PHOTOS: Record<string, string> = {};

type Kind = "prints" | "thrift" | "coffee" | "cakes" | "games" | "workshop" | "plants" | "jewellery" | "generic";

const KIND_BY_CONCEPT: Record<string, Kind> = {
  "art-prints": "prints",
  "thrift-stall": "thrift",
  "coffee-popup": "coffee",
  "baked-goods": "cakes",
  "board-game-evening": "games",
  "art-workshop": "workshop",
  "plant-stall": "plants",
  "handmade-jewellery": "jewellery",
};
const KIND_BY_CATEGORY: Record<string, Kind> = { art: "prints", fashion: "thrift", food: "cakes", experiences: "workshop", home: "plants" };

const ACCENT: Record<Kind, string> = {
  prints: "#c4b5fd",
  thrift: "#f0abfc",
  coffee: "#fcd34d",
  cakes: "#f9a8d4",
  games: "#7dd3fc",
  workshop: "#5eead4",
  plants: "#6ee7b7",
  jewellery: "#fde68a",
  generic: "#c4b5fd",
};

export function conceptKind(conceptId: string, category?: string): Kind {
  return KIND_BY_CONCEPT[conceptId] ?? (category ? KIND_BY_CATEGORY[category] : undefined) ?? "generic";
}

export function ConceptImage({ conceptId, category, label, className = "" }: { conceptId: string; category?: string; label: string; className?: string }) {
  const photo = CONCEPT_PHOTOS[conceptId];
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- optional, configurable photo with a fallback
      <img src={photo} alt={`${label} stall`} className={`h-full w-full object-cover ${className}`} loading="lazy" onError={() => setFailed(true)} />
    );
  }
  return (
    <div className={`concept-sky ${className}`}>
      <ConceptArt kind={conceptKind(conceptId, category)} label={label} className="" />
    </div>
  );
}

function ConceptArt({ kind, label, className }: { kind: Kind; label: string; className: string }) {
  const id = useId().replace(/:/g, "");
  const accent = ACCENT[kind];
  return (
    <svg viewBox="0 0 480 300" className={`h-full w-full ${className}`} role="img" aria-label={`Illustration of ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label.toLowerCase()} stall`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={`lamp-${id}`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor={accent} stopOpacity="0.28" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`counter-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b2f78" />
          <stop offset="1" stopColor="#231c4d" />
        </linearGradient>
        <linearGradient id={`wall-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2257" />
          <stop offset="1" stopColor="#1c1740" />
        </linearGradient>
      </defs>

      {/* Ground (the night sky is painted by the wrapper, so it fills any frame without seams). */}
      <rect x="-400" y="250" width="1280" height="200" fill="#0a0817" />
      <path d="M-400 250 H880" stroke="rgb(196 181 253 / 0.25)" />

      {/* Stall: back wall, lamp light, posts. */}
      <rect x="90" y="78" width="300" height="140" rx="6" fill={`url(#wall-${id})`} />
      <rect x="90" y="78" width="300" height="140" fill={`url(#lamp-${id})`} />
      <rect x="84" y="70" width="8" height="182" rx="3" fill="#15112e" />
      <rect x="388" y="70" width="8" height="182" rx="3" fill="#15112e" />

      {/* Merchandise behind the counter. */}
      <Merchandise kind={kind} accent={accent} />

      {/* Striped awning with a scalloped edge. */}
      <g>
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${72 + i * 33.6} 46 h33.6 v24 a16.8 10 0 0 1 -33.6 0 Z`} fill={i % 2 === 0 ? accent : "#f5f5fa"} opacity={i % 2 === 0 ? 0.95 : 0.9} />
        ))}
        <rect x="68" y="38" width="344" height="10" rx="4" fill="#15112e" />
      </g>

      {/* String lights. */}
      <path d="M40 30 Q240 66 440 30" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="1.2" />
      {Array.from({ length: 13 }, (_, i) => {
        const t = (i + 0.5) / 13;
        const x = 40 + 400 * t;
        const y = 30 + 2 * (1 - t) * t * 36;
        return <circle key={i} cx={x} cy={y} r="2.6" fill={i % 3 === 0 ? "#fde68a" : i % 3 === 1 ? "#f0abfc" : "#7dd3fc"} opacity="0.95" />;
      })}

      {/* Counter with a small sign. */}
      <rect x="78" y="200" width="324" height="52" rx="6" fill={`url(#counter-${id})`} />
      <rect x="78" y="200" width="324" height="6" rx="3" fill={accent} opacity="0.85" />
      <rect x="196" y="216" width="88" height="22" rx="11" fill="#0b0b14" stroke={accent} strokeOpacity="0.6" />
      <text x="240" y="231" textAnchor="middle" fontSize="10" fontWeight="700" fill="#f5f5fa" fontFamily="var(--font-display), sans-serif" letterSpacing="0.6">
        OPEN TODAY
      </text>

      {/* Counter-top items. */}
      <CounterItems kind={kind} accent={accent} />
    </svg>
  );
}

function Merchandise({ kind, accent }: { kind: Kind; accent: string }) {
  switch (kind) {
    case "prints":
      return (
        <g>
          {[
            [112, 96, 70, 88, "#7dd3fc", "#c4b5fd"],
            [196, 90, 88, 66, "#f0abfc", "#7c3aed"],
            [298, 96, 70, 88, "#5eead4", "#2563eb"],
            [204, 164, 72, 30, "#fde68a", "#f472b6"],
          ].map(([x, y, w, h, c1, c2], i) => (
            <g key={i}>
              <rect x={x as number} y={y as number} width={w as number} height={h as number} rx="2" fill="#f5f5fa" />
              <rect x={(x as number) + 5} y={(y as number) + 5} width={(w as number) - 10} height={(h as number) - 10} fill={c2 as string} opacity="0.85" />
              <circle cx={(x as number) + (w as number) * 0.62} cy={(y as number) + (h as number) * 0.36} r={Math.min(w as number, h as number) * 0.16} fill={c1 as string} />
              <path d={`M${(x as number) + 5} ${(y as number) + (h as number) - 5} l${((w as number) - 10) * 0.4} ${-(h as number) * 0.35} l${((w as number) - 10) * 0.3} ${(h as number) * 0.2} l${((w as number) - 10) * 0.3} ${(h as number) * 0.15} Z`} fill="#0b0b14" opacity="0.45" />
            </g>
          ))}
        </g>
      );
    case "thrift":
      return (
        <g>
          <rect x="116" y="96" width="248" height="5" rx="2.5" fill="#cbd5e1" />
          {["#f0abfc", "#7dd3fc", "#c4b5fd", "#5eead4", "#fde68a", "#f9a8d4", "#a5b4fc"].map((c, i) => {
            const x = 128 + i * 33;
            const dress = i % 3 === 1;
            return (
              <g key={i}>
                <path d={`M${x + 12} 101 q0 -7 5 -7`} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
                {dress ? (
                  <path d={`M${x + 6} 106 h14 l8 76 h-30 Z`} fill={c} />
                ) : (
                  <path d={`M${x} 110 l8 -6 h10 l8 6 l-4 10 h-2 v54 h-14 v-54 h-2 Z`} fill={c} />
                )}
              </g>
            );
          })}
        </g>
      );
    case "coffee":
      return (
        <g>
          <rect x="118" y="96" width="96" height="66" rx="6" fill="#0b0b14" stroke={accent} strokeOpacity="0.5" />
          <text x="166" y="116" textAnchor="middle" fontSize="11" fontWeight="800" fill={accent} fontFamily="var(--font-display), sans-serif">MENU</text>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="132" y={126 + i * 11} width="40" height="3" rx="1.5" fill="#f5f5fa" opacity="0.6" />
              <rect x="186" y={126 + i * 11} width="14" height="3" rx="1.5" fill={accent} opacity="0.8" />
            </g>
          ))}
          {/* Espresso machine */}
          <rect x="262" y="120" width="100" height="80" rx="8" fill="#cbd5e1" />
          <rect x="262" y="120" width="100" height="16" rx="8" fill="#94a3b8" />
          <rect x="282" y="150" width="14" height="22" rx="3" fill="#334155" />
          <rect x="328" y="150" width="14" height="22" rx="3" fill="#334155" />
          <circle cx="312" cy="146" r="7" fill={accent} />
        </g>
      );
    case "cakes":
      return (
        <g>
          <rect x="112" y="150" width="256" height="6" rx="3" fill="#94a3b8" opacity="0.6" />
          {/* Tiered cake */}
          <rect x="146" y="118" width="60" height="32" rx="4" fill="#fbcfe8" />
          <rect x="156" y="96" width="40" height="24" rx="4" fill="#f5f5fa" />
          <path d="M146 126 q7.5 7 15 0 t15 0 t15 0 t15 0" fill="none" stroke={accent} strokeWidth="3" />
          <circle cx="176" cy="92" r="4" fill="#f43f5e" />
          {/* Cupcakes */}
          {[236, 270, 304, 338].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 11} 132 h22 l-3 18 h-16 Z`} fill={["#c4b5fd", "#7dd3fc", "#5eead4", "#fde68a"][i]} />
              <ellipse cx={x} cy="128" rx="13" ry="8" fill="#fdf2f8" />
              <circle cx={x + 3} cy="121" r="3" fill="#f43f5e" />
            </g>
          ))}
          {/* Glass dome */}
          <path d="M226 112 a22 22 0 0 1 44 0" fill="rgb(255 255 255 / 0.12)" stroke="rgb(255 255 255 / 0.4)" />
        </g>
      );
    case "games":
      return (
        <g>
          <rect x="116" y="98" width="248" height="5" rx="2" fill="#475569" />
          <rect x="116" y="146" width="248" height="5" rx="2" fill="#475569" />
          {["#7dd3fc", "#f0abfc", "#fde68a", "#5eead4", "#c4b5fd", "#f9a8d4", "#a5b4fc"].map((c, i) => (
            <rect key={c} x={126 + i * 33} y={i % 2 ? 108 : 112} width="26" height={i % 2 ? 38 : 34} rx="2" fill={c} opacity="0.9" />
          ))}
          {["#5eead4", "#f0abfc", "#7dd3fc", "#fde68a", "#c4b5fd"].map((c, i) => (
            <rect key={c} x={132 + i * 46} y={160} width="40" height="10" rx="2" fill={c} opacity="0.85" />
          ))}
        </g>
      );
    case "workshop":
      return (
        <g>
          {[
            [140, "#c4b5fd"],
            [216, "#f0abfc"],
            [292, "#5eead4"],
          ].map(([x, c]) => (
            <g key={x as number}>
              <path d={`M${(x as number) + 10} 196 L${(x as number) + 24} 96 L${(x as number) + 38} 196`} fill="none" stroke="#a16207" strokeWidth="3" />
              <rect x={x as number} y="104" width="48" height="58" rx="2" fill="#f5f5fa" />
              <circle cx={(x as number) + 18} cy="124" r="10" fill={c as string} opacity="0.85" />
              <path d={`M${(x as number) + 4} 156 q12 -18 22 -6 t18 -8`} fill="none" stroke="#0b0b14" strokeOpacity="0.5" strokeWidth="2" />
            </g>
          ))}
        </g>
      );
    case "plants":
      return (
        <g>
          <rect x="116" y="150" width="248" height="5" rx="2" fill="#475569" />
          {[
            [138, 34, "#34d399"],
            [184, 46, "#6ee7b7"],
            [236, 30, "#10b981"],
            [282, 52, "#5eead4"],
            [334, 38, "#34d399"],
          ].map(([x, h, c], i) => (
            <g key={x as number}>
              <ellipse cx={(x as number) - 8} cy={150 - (h as number) * 0.6} rx="9" ry={(h as number) * 0.32} fill={c as string} transform={`rotate(-24 ${(x as number) - 8} ${150 - (h as number) * 0.6})`} />
              <ellipse cx={(x as number) + 8} cy={150 - (h as number) * 0.6} rx="9" ry={(h as number) * 0.32} fill={c as string} transform={`rotate(24 ${(x as number) + 8} ${150 - (h as number) * 0.6})`} />
              <ellipse cx={x as number} cy={150 - (h as number) * 0.8} rx="7" ry={(h as number) * 0.36} fill={c as string} opacity="0.9" />
              <path d={`M${(x as number) - 13} 134 h26 l-4 16 h-18 Z`} fill={["#f9a8d4", "#c4b5fd", "#fde68a", "#7dd3fc", "#f0abfc"][i]} />
            </g>
          ))}
        </g>
      );
    case "jewellery":
      return (
        <g>
          <rect x="140" y="92" width="200" height="96" rx="8" fill="#3b0764" stroke={accent} strokeOpacity="0.4" />
          {[0, 1, 2].map((i) => {
            const cx = 180 + i * 60;
            return (
              <g key={i}>
                <path d={`M${cx - 22} 106 Q${cx} ${148 + i * 4} ${cx + 22} 106`} fill="none" stroke={accent} strokeWidth="2" />
                {Array.from({ length: 7 }, (_, k) => {
                  const t = (k + 1) / 8;
                  const x = (1 - t) * (1 - t) * (cx - 22) + 2 * (1 - t) * t * cx + t * t * (cx + 22);
                  const y = (1 - t) * (1 - t) * 106 + 2 * (1 - t) * t * (148 + i * 4) + t * t * 106;
                  return <circle key={k} cx={x} cy={y} r={k === 3 ? 5 : 2.4} fill={k === 3 ? ["#7dd3fc", "#f0abfc", "#5eead4"][i] : "#fef3c7"} />;
                })}
              </g>
            );
          })}
          {[170, 220, 270, 310].map((x, i) => (
            <circle key={x} cx={x} cy="168" r="5" fill="none" stroke={i % 2 ? "#e2e8f0" : accent} strokeWidth="2.5" />
          ))}
        </g>
      );
    default:
      return (
        <g>
          {[130, 200, 270].map((x, i) => (
            <rect key={x} x={x} y={120 + (i % 2) * 8} width="60" height="60" rx="6" fill={["#c4b5fd", "#f0abfc", "#7dd3fc"][i]} opacity="0.85" />
          ))}
        </g>
      );
  }
}

function CounterItems({ kind, accent }: { kind: Kind; accent: string }) {
  switch (kind) {
    case "prints":
      return (
        <g>
          {[110, 128, 146].map((x, i) => (
            <rect key={x} x={x} y={178 - i * 2} width="26" height="20" rx="1.5" fill="#f5f5fa" transform={`rotate(${-8 + i * 6} ${x + 13} 190)`} />
          ))}
          <rect x="326" y="180" width="50" height="18" rx="3" fill={accent} opacity="0.8" />
        </g>
      );
    case "thrift":
      return (
        <g>
          {["#c4b5fd", "#f0abfc", "#7dd3fc"].map((c, i) => (
            <rect key={c} x="106" y={186 - i * 8} width="56" height="8" rx="2" fill={c} />
          ))}
          <rect x="320" y="176" width="44" height="22" rx="3" fill="#a16207" />
        </g>
      );
    case "coffee":
      return (
        <g>
          {[112, 140, 340, 368].map((x) => (
            <g key={x}>
              <path d={`M${x} 182 h18 l-2 18 h-14 Z`} fill="#f5f5fa" />
              <path d={`M${x + 5} 176 q-3 -5 0 -10 t0 -10`} fill="none" stroke="rgb(255 255 255 / 0.5)" strokeWidth="1.5" />
            </g>
          ))}
        </g>
      );
    case "cakes":
      return (
        <g>
          {[112, 138, 342, 368].map((x, i) => (
            <circle key={x} cx={x} cy="192" r="9" fill={["#fbcfe8", "#fde68a", "#c4b5fd", "#5eead4"][i]} />
          ))}
        </g>
      );
    case "games":
      return (
        <g>
          <rect x="106" y="178" width="64" height="22" rx="3" fill="#f5f5fa" />
          <path d="M106 189 h64 M138 178 v22" stroke="#334155" strokeWidth="1" />
          <rect x="336" y="182" width="16" height="16" rx="3" fill="#f5f5fa" />
          <circle cx="341" cy="187" r="1.6" fill="#0b0b14" />
          <circle cx="347" cy="193" r="1.6" fill="#0b0b14" />
          <rect x="358" y="186" width="14" height="14" rx="3" fill={accent} />
        </g>
      );
    case "workshop":
      return (
        <g>
          <ellipse cx="128" cy="192" rx="24" ry="9" fill="#e2e8f0" />
          {["#f0abfc", "#5eead4", "#fde68a", "#7dd3fc"].map((c, i) => (
            <circle key={c} cx={116 + i * 8} cy="190" r="3" fill={c} />
          ))}
          <rect x="350" y="178" width="18" height="22" rx="3" fill="#94a3b8" />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${354 + i * 4} 178 l${-2 + i * 2} -16`} stroke="#a16207" strokeWidth="2" />
          ))}
        </g>
      );
    case "plants":
      return (
        <g>
          {[116, 146, 344, 370].map((x, i) => (
            <g key={x}>
              <ellipse cx={x} cy="178" rx="7" ry="10" fill={i % 2 ? "#34d399" : "#6ee7b7"} />
              <path d={`M${x - 9} 184 h18 l-3 14 h-12 Z`} fill={i % 2 ? "#fde68a" : "#f9a8d4"} />
            </g>
          ))}
        </g>
      );
    case "jewellery":
      return (
        <g>
          <rect x="108" y="184" width="54" height="14" rx="3" fill="#3b0764" />
          {[118, 134, 150].map((x, i) => (
            <circle key={x} cx={x} cy="184" r="4" fill="none" stroke={i === 1 ? accent : "#e2e8f0"} strokeWidth="2" />
          ))}
          <path d="M346 198 v-22 h12 v22" fill="none" stroke="#e2e8f0" strokeWidth="2" />
          <circle cx="352" cy="190" r="3.5" fill={accent} />
        </g>
      );
    default:
      return <rect x="330" y="180" width="44" height="18" rx="3" fill={accent} opacity="0.8" />;
  }
}
