"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import { score } from "@/lib/format";
import type { LocalityProfile, ScoredOption } from "@/lib/schemas";

/**
 * A real street map of the compared localities. Pins sit at the coordinates Qloo returned for
 * each area; the ring around each pin is the 2 km radius used for the competitor count.
 * Base map: standard OpenStreetMap tiles (free, no key; attribution shown). In dark mode the
 * tiles are recoloured with a CSS filter so the map matches the theme. No Qloo calls; Leaflet
 * is loaded only on the client, only when this section renders.
 */

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CATCHMENT_M = 2000;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function LocalityMap({
  localities,
  selected,
  onSelect,
  best,
}: {
  localities: LocalityProfile[];
  selected: string;
  onSelect: (name: string) => void;
  best: (name: string) => ScoredOption | undefined;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const fittedKeyRef = useRef("");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const located = localities.filter((l) => l.lat !== undefined && l.lon !== undefined);
  const key = located.map((l) => `${l.name}:${l.lat}:${l.lon}`).join("|");

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(el.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      map.attributionControl.setPrefix(false);
      mapRef.current = map;
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      // Re-render pins and tiles now that Leaflet is ready.
      el.current.dispatchEvent(new Event("c2c-map-ready"));
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Pins, catchment rings and the view follow the data and the selection.
  useEffect(() => {
    const draw = () => {
      const L = leafletRef.current;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!L || !map || !layer) return;
      layer.clearLayers();
      // Set the view first (from the coordinates and the 2 km radius), then add layers.
      if (fittedKeyRef.current !== key && located.length > 0) {
        fittedKeyRef.current = key;
        const bounds = L.latLngBounds([]);
        for (const l of located) bounds.extend(L.latLng(l.lat!, l.lon!).toBounds(CATCHMENT_M * 2));
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
      }
      const winnerScore = Math.max(...located.map((l) => best(l.name)?.scores.final ?? 0));
      for (const l of located) {
        const top = best(l.name);
        const isSel = l.name === selected;
        const lead = top !== undefined && top.scores.final === winnerScore;
        L.circle([l.lat!, l.lon!], {
          radius: CATCHMENT_M,
          color: isSel ? "#f0abfc" : "#a78bfa",
          weight: isSel ? 2 : 1,
          opacity: isSel ? 0.9 : 0.5,
          fillColor: isSel ? "#f0abfc" : "#a78bfa",
          fillOpacity: isSel ? 0.12 : 0.05,
          interactive: false,
        }).addTo(layer);
        const label = `${escapeHtml(l.name)}${top ? ` <b>${escapeHtml(score(top.scores.final))}</b>` : ""}`;
        const icon = L.divIcon({
          className: "c2c-pin-wrap",
          html: `<span class="c2c-pin${isSel ? " is-selected" : ""}${lead ? " is-lead" : ""}"><span class="c2c-pin-dot"></span><span class="c2c-pin-label">${label}</span></span>`,
          // A real hit area (dot plus label), anchored at the centre of the dot.
          iconSize: [168, 52],
          iconAnchor: [84, 9],
        });
        const description = `${l.name}${top ? `, best idea ${top.conceptLabel}, score ${score(top.scores.final)}` : ", nothing fits the budget"}`;
        const marker = L.marker([l.lat!, l.lon!], {
          icon,
          keyboard: true,
          title: description,
          alt: l.name,
          riseOnHover: true,
          zIndexOffset: isSel ? 1000 : lead ? 500 : 0,
        }).addTo(layer);
        marker.on("click", () => onSelectRef.current(l.name));
        // Screen readers announce the full description, and the selected state.
        const markerEl = marker.getElement();
        markerEl?.setAttribute("aria-label", description);
        markerEl?.setAttribute("aria-pressed", String(isSel));
      }
    };
    draw();
    const node = el.current;
    node?.addEventListener("c2c-map-ready", draw);
    return () => node?.removeEventListener("c2c-map-ready", draw);
    // `best` is derived from the same result as `key`; redrawing on key/selection is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, selected]);

  if (located.length === 0) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-line bg-paper/60 p-4 text-center text-sm text-muted">
        Qloo returned no coordinates for these areas, so they cannot be placed on a map.
      </div>
    );
  }

  return (
    <figure className="relative">
      <div ref={el} className="c2c-map aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-map" aria-label={`Map of ${located.map((l) => l.name).join(", ")}`} role="region" />
      <figcaption className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border border-[#a78bfa] bg-[#a78bfa]/20" />
          2 km catchment used for the competitor count
        </span>
        <span>Pins at Qloo coordinates</span>
      </figcaption>
    </figure>
  );
}
