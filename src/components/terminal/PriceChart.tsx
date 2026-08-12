"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Bar } from "./quant";
import { fmt } from "./quant";

export type ChartMode = "line" | "candle";

type Props = {
  bars: Bar[];
  mode: ChartMode;
  tone: "up" | "down";
  height?: number;
  label: string;
};

/**
 * The viewBox is stretched horizontally (preserveAspectRatio="none") to fill
 * any panel width, which would squash text drawn inside it. The plot stays in
 * SVG; the price axis is HTML in a fixed gutter, so it reads the same at 390px
 * and 1600px. Vertical scale is 1:1 because the SVG is sized to `height`.
 */
const VB_W = 1000;
const CANDLES_WIDE = 72;
const CANDLES_NARROW = 40;

export function PriceChart({ bars, mode, tone, height = 220, label }: Props) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Starts at the wide count so server and client agree, then narrows on small
  // screens after mount — candles below ~4px wide are unreadable.
  const [candleCount, setCandleCount] = useState(CANDLES_WIDE);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCandleCount(entry.contentRect.width < 560 ? CANDLES_NARROW : CANDLES_WIDE);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = useMemo(
    () => (mode === "candle" ? bars.slice(-candleCount) : bars),
    [bars, mode, candleCount],
  );

  const geo = useMemo(() => {
    // Candles need the wick extremes; the line only tracks closes.
    const lows = mode === "candle" ? visible.map((b) => b.l) : visible.map((b) => b.c);
    const highs = mode === "candle" ? visible.map((b) => b.h) : visible.map((b) => b.c);
    const lo = Math.min(...lows);
    const hi = Math.max(...highs);
    const pad = (hi - lo) * 0.12 || 1;
    const min = lo - pad;
    const max = hi + pad;

    // Rounded so the SSR markup and the client agree exactly.
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const y = (v: number) => r2(height - ((v - min) / (max - min)) * height);

    const slot = VB_W / visible.length;
    // Line points sit on the left edge; candles centre in their slot.
    const x = (i: number) =>
      r2(mode === "candle" ? slot * (i + 0.5) : (i / (visible.length - 1)) * VB_W);

    const closes = visible.map((b, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(b.c)}`).join("");

    const ticks = [0, 1, 2, 3].map((k) => {
      const v = min + ((max - min) * (k + 0.5)) / 4;
      return { v, y: y(v) };
    });

    return { x, y, line: closes, area: `${closes}L${x(visible.length - 1)},${height}L0,${height}Z`, ticks, slot: r2(slot) };
  }, [visible, mode, height]);

  const color = tone === "up" ? "var(--up)" : "var(--down)";
  const idx = hover ?? visible.length - 1;
  const lastBar = visible[visible.length - 1];
  const bodyW = Math.max(1, Math.round(geo.slot * 0.62 * 100) / 100);

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="none"
        style={{ height }}
        role="img"
        aria-label={`${label} simulated ${mode === "candle" ? "candlestick" : "price"} chart over ${visible.length} sessions, last ${fmt(lastBar.c)}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientX - r.left) / r.width;
          const i =
            mode === "candle"
              ? Math.floor(frac * visible.length)
              : Math.round(frac * (visible.length - 1));
          setHover(Math.max(0, Math.min(visible.length - 1, i)));
        }}
      >
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {geo.ticks.map((t) => (
          <line
            key={t.v}
            x1="0"
            x2={VB_W}
            y1={t.y}
            y2={t.y}
            stroke="var(--rule)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {mode === "line" ? (
          <>
            <path d={geo.area} fill={`url(#fill-${uid})`} />
            <path
              d={geo.line}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </>
        ) : (
          visible.map((b, i) => {
            const up = b.c >= b.o;
            const stroke = up ? "var(--up)" : "var(--down)";
            const cx = geo.x(i);
            const top = Math.min(geo.y(b.o), geo.y(b.c));
            const body = Math.max(1, Math.abs(geo.y(b.c) - geo.y(b.o)));
            return (
              <g key={`${i}-${b.c}`}>
                <line
                  x1={cx}
                  x2={cx}
                  y1={geo.y(b.h)}
                  y2={geo.y(b.l)}
                  stroke={stroke}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Hollow up, filled down — the standard convention, and the
                    only cue that survives red-green colour blindness. */}
                <rect
                  x={Math.round((cx - bodyW / 2) * 100) / 100}
                  y={top}
                  width={bodyW}
                  height={body}
                  fill={up ? "var(--panel)" : stroke}
                  stroke={stroke}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })
        )}

        {/* Last print, held as a dashed level across the plot. */}
        <line
          x1="0"
          x2={VB_W}
          y1={geo.y(lastBar.c)}
          y2={geo.y(lastBar.c)}
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
        />

        {hover !== null && (
          <line
            x1={geo.x(idx)}
            x2={geo.x(idx)}
            y1="0"
            y2={height}
            stroke="var(--amber)"
            strokeWidth="1"
            opacity="0.7"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {hover !== null && (
        <>
          <span className="cx-price" style={{ top: geo.y(visible[idx].c) }}>
            {fmt(visible[idx].c)}
          </span>
          <span
            className="cx-time"
            style={{ left: `calc(${geo.x(idx) / 1000} * (100% - 48px))` }}
          >
            T−{visible.length - 1 - idx}
          </span>
        </>
      )}

      <div className="chart-axis" aria-hidden="true">
        {geo.ticks.map((t) => (
          <span key={t.v} style={{ top: t.y }}>
            {t.v.toFixed(1)}
          </span>
        ))}
      </div>

      <div className="chart-note">
        {hover === null ? (
          `sim · gbm · ${visible.length} sessions`
        ) : mode === "candle" ? (
          <>
            <span className="muted">O</span> {fmt(visible[idx].o)}{" "}
            <span className="muted">H</span> {fmt(visible[idx].h)}{" "}
            <span className="muted">L</span> {fmt(visible[idx].l)}{" "}
            <span className="muted">C</span>{" "}
            <span className={visible[idx].c >= visible[idx].o ? "up" : "down"}>
              {fmt(visible[idx].c)}
            </span>
          </>
        ) : (
          <>
            T−{visible.length - 1 - idx} · <span className="amber">{fmt(visible[idx].c)}</span>
          </>
        )}
      </div>
    </div>
  );
}
