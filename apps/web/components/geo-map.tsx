'use client';

import { useEffect, useRef, useState } from 'react';

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const DEFAULT_ZOOM = 13;
const CENTER_LAT = 30.044;
const CENTER_LNG = 31.236;

const COLORS: Record<string, string> = {
  blue: '#2563eb',
  violet: '#7c3aed',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  gray: '#6b7280',
};

export interface GeoMapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  ring?: boolean;
  onClick?: () => void;
}

export interface GeoMapProps {
  markers?: GeoMapMarker[];
  path?: { lat: number; lng: number }[];
  className?: string;
  emptyText?: string;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mercX(lng: number, scale: number): number {
  return ((lng + 180) / 360) * scale;
}

function mercY(lat: number, scale: number): number {
  const r = (lat * Math.PI) / 180;
  const merc = Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI;
  return ((1 - merc) / 2) * scale;
}

export default function GeoMap({
  markers = [],
  path = [],
  className = '',
  emptyText = 'لا توجد بيانات للموقع',
}: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState({ zoom: DEFAULT_ZOOM, lat: CENTER_LAT, lng: CENTER_LNG });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    const pts: { lat: number; lng: number }[] = [
      ...markers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...path,
    ];
    if (pts.length === 0) {
      setView((v) =>
        v.zoom === DEFAULT_ZOOM && v.lat === CENTER_LAT && v.lng === CENTER_LNG
          ? v
          : { zoom: DEFAULT_ZOOM, lat: CENTER_LAT, lng: CENTER_LNG },
      );
      return;
    }
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of pts) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }
    if (!Number.isFinite(minLat)) return;
    const cLat = (minLat + maxLat) / 2;
    const cLng = (minLng + maxLng) / 2;
    const spanLon = Math.max(maxLng - minLng, 0.0005);
    const spanLat = Math.max(maxLat - minLat, 0.0005);
    const zLon = Math.log2((w * 360) / (spanLon * TILE));
    const zLat = Math.log2((h * 360) / (spanLat * TILE));
    const target = clamp(Math.floor(Math.min(zLon, zLat)) - 1, MIN_ZOOM, MAX_ZOOM);
    setView((v) => (v.zoom === target && v.lat === cLat && v.lng === cLng ? v : { zoom: target, lat: cLat, lng: cLng }));
  }, [markers, path]);

  const zoomIn = () => setView((v) => ({ ...v, zoom: clamp(v.zoom + 1, MIN_ZOOM, MAX_ZOOM) }));
  const zoomOut = () => setView((v) => ({ ...v, zoom: clamp(v.zoom - 1, MIN_ZOOM, MAX_ZOOM) }));

  const scale = TILE * 2 ** view.zoom;
  const cx = mercX(view.lng, scale);
  const cy = mercY(view.lat, scale);
  const w = size?.w ?? 800;
  const h = size?.h ?? 450;
  const left = cx - w / 2;
  const top = cy - h / 2;

  const x0 = Math.max(0, Math.floor(left / TILE));
  const x1 = Math.min(2 ** view.zoom - 1, Math.floor((left + w) / TILE));
  const y0 = Math.max(0, Math.floor(top / TILE));
  const y1 = Math.min(2 ** view.zoom - 1, Math.floor((top + h) / TILE));

  const tiles: { key: string; sx: number; sy: number; url: string }[] = [];
  for (let xt = x0; xt <= x1; xt++) {
    for (let yt = y0; yt <= y1; yt++) {
      tiles.push({
        key: `${view.zoom}/${xt}/${yt}`,
        sx: xt * TILE - left,
        sy: yt * TILE - top,
        url: `https://tile.openstreetmap.org/${view.zoom}/${xt}/${yt}.png`,
      });
    }
  }

  const pathPts = path.map((p) => `${mercX(p.lng, scale) - left},${mercY(p.lat, scale) - top}`);
  const polyline = pathPts.length > 1 ? pathPts.join(' ') : null;
  const hasData = markers.length > 0 || polyline !== null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const last = dragRef.current;
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    if (dx === 0 && dy === 0) return;
    const degPx = 360 / scale;
    setView((v) => ({ ...v, lng: v.lng - dx * degPx, lat: clamp(v.lat + dy * degPx, -85, 85) }));
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-gray-200 bg-[#e8eaed] ${className}`} style={{ touchAction: 'none' }}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={(e) => {
          if (e.deltaY < 0) zoomIn();
          else zoomOut();
        }}
      >
        {size
          ? tiles.map((t) => (
              <div
                key={t.key}
                className="absolute"
                style={{
                  left: t.sx,
                  top: t.sy,
                  width: TILE,
                  height: TILE,
                  backgroundImage: `url(${t.url})`,
                  backgroundSize: 'cover',
                }}
              />
            ))
          : null}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`}>
          {polyline ? (
            <>
              <polyline points={polyline} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
              <polyline points={polyline} fill="none" stroke="#1d4ed8" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : null}
          {markers.map((m) => {
            const mx = mercX(m.lng, scale) - left;
            const my = mercY(m.lat, scale) - top;
            const fill = COLORS[m.color ?? 'blue'] ?? COLORS.blue;
            return (
              <g
                key={m.id}
                transform={`translate(${mx},${my})`}
                className={m.onClick ? 'pointer-events-auto cursor-pointer' : ''}
                onClick={m.onClick}
              >
                {m.ring ? <circle r={11} fill="none" stroke={fill} strokeWidth={2} strokeDasharray="4 3" /> : null}
                <circle r={7} fill={fill} stroke="#ffffff" strokeWidth={2} />
                {m.label ? (
                  <text y={20} textAnchor="middle" fontSize={11} fontWeight={600} fill="#ffffff" stroke="#1f2937" strokeWidth={2.5} paintOrder="stroke">
                    {m.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {!hasData ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rounded-lg bg-white/90 px-3 py-2 text-sm text-gray-500">{emptyText}</span>
        </div>
      ) : null}

      <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          disabled={view.zoom >= MAX_ZOOM}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-700 shadow hover:bg-gray-50 disabled:opacity-40"
          aria-label="تكبير"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          disabled={view.zoom <= MIN_ZOOM}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-700 shadow hover:bg-gray-50 disabled:opacity-40"
          aria-label="تصغير"
        >
          −
        </button>
      </div>
      <span className="absolute bottom-2 right-3 z-10 text-[10px] text-gray-500 drop-shadow">© OpenStreetMap</span>
    </div>
  );
}