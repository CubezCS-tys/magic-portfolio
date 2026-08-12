"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { bsCallGreeks, downAndOutCall, fmt, mcDownAndOutCall } from "./quant";

type Params = {
  S: number;
  K: number;
  B: number;
  sigma: number;
  T: number;
  r: number;
  paths: number;
  antithetic: boolean;
};

const STEPS = 128;
const KEEP = 44;

const PATH_CHOICES = [5000, 20000, 60000];

function Slider({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  full,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  full?: boolean;
}) {
  return (
    <div className={`ctl${full ? " full" : ""}`}>
      <label htmlFor={id}>
        {label}
        <span className="val">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/**
 * Down-and-out call desk.
 *
 * Three prices are shown side by side on purpose: the vanilla call, the
 * continuously-monitored analytic barrier price, and a discretely-monitored
 * simulation. The gap between the last two is the point.
 */
export function Pricer() {
  const [p, setP] = useState<Params>({
    S: 100,
    K: 100,
    B: 85,
    sigma: 0.25,
    T: 1,
    r: 0.04,
    paths: 20000,
    antithetic: true,
  });

  const set = <K extends keyof Params>(key: K, v: Params[K]) =>
    setP((prev) => {
      const next = { ...prev, [key]: v };
      // The analytic solution used here assumes B <= K and a live spot.
      next.B = Math.min(next.B, next.K - 1, next.S - 1);
      return next;
    });

  // Keep sliders responsive while the simulation catches up.
  const dp = useDeferredValue(p);
  const busy = dp !== p;

  // Timing is a client measurement; withheld until mount so SSR markup matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const mc = useMemo(
    () =>
      mcDownAndOutCall({
        S: dp.S,
        K: dp.K,
        B: dp.B,
        r: dp.r,
        sigma: dp.sigma,
        T: dp.T,
        paths: dp.paths,
        steps: STEPS,
        antithetic: dp.antithetic,
        seed: 20260811,
        keepPaths: KEEP,
      }),
    [dp],
  );

  const analytic = downAndOutCall(dp.S, dp.K, dp.B, dp.r, dp.sigma, dp.T);
  const vanilla = bsCallGreeks(dp.S, dp.K, dp.r, dp.sigma, dp.T);
  const bias = mc.price - analytic;

  // ---- canvas ----------------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 640, h: 300 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(240, width), h: Math.max(200, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(2, typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1);
    const { w, h } = size;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padR = 46;
    const plotW = w - padR;

    // Scale to quantiles, not extremes. The lognormal right tail means one
    // lucky path can otherwise stretch the axis until the barrier — the whole
    // point of the picture — is crushed into the bottom of the canvas.
    const vals: number[] = [];
    for (const path of mc.sample) for (const v of path.points) vals.push(v);
    vals.sort((a, b) => a - b);
    const q = (f: number) => vals[Math.min(vals.length - 1, Math.floor(f * vals.length))];

    let lo = Math.min(q(0.01), dp.B, dp.K, dp.S);
    let hi = Math.max(q(0.98), dp.K, dp.S);
    const span = hi - lo || 1;
    lo -= span * 0.06;
    hi += span * 0.06;

    const X = (i: number) => (i / STEPS) * plotW;
    const Y = (v: number) => h - ((v - lo) / (hi - lo)) * h;

    let raf = 0;
    let start = 0;

    const draw = (progress: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0d1015";
      ctx.fillRect(0, 0, w, h);

      // Price gridlines with a right-hand axis.
      // Canvas ignores CSS custom properties, so the family is named outright.
      ctx.font = '9px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = "middle";
      for (let k = 0; k < 5; k++) {
        const v = lo + ((hi - lo) * (k + 0.5)) / 5;
        const y = Y(v);
        ctx.strokeStyle = "#1b1f28";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(plotW, y + 0.5);
        ctx.stroke();
        ctx.fillStyle = "#798897";
        ctx.fillText(v.toFixed(0), plotW + 8, y);
      }

      const cut = Math.max(1, Math.round(STEPS * progress));

      // Paths first, so the reference levels sit on top of them.
      for (const path of mc.sample) {
        const end = path.knockedOut ? Math.min(path.outAt, cut) : cut;
        ctx.strokeStyle = path.knockedOut ? "rgba(255,77,94,0.42)" : "rgba(38,208,124,0.34)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X(0), Y(path.points[0]));
        for (let i = 1; i <= end; i++) ctx.lineTo(X(i), Y(path.points[i]));
        ctx.stroke();

        if (path.knockedOut && path.outAt <= cut) {
          ctx.fillStyle = "#ff4d5e";
          ctx.fillRect(X(path.outAt) - 1.5, Y(path.points[path.outAt]) - 1.5, 3, 3);
        }
      }

      const level = (v: number, color: string, text: string, dash: number[]) => {
        const y = Y(v);
        ctx.save();
        ctx.setLineDash(dash);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(plotW, y + 0.5);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = color;
        ctx.fillText(text, 6, y - 8);
      };

      level(dp.K, "#9aa7b4", `K ${dp.K}`, [2, 3]);
      level(dp.B, "#ffb020", `BARRIER ${dp.B}`, [5, 4]);
    };

    if (reduce) {
      draw(1);
      return;
    }

    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / 620);
      draw(t * t * (3 - 2 * t)); // smoothstep
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mc, dp.B, dp.K, dp.S, size]);

  const maxB = Math.max(20, Math.min(p.K, p.S) - 1);

  return (
    <div className="pricer">
      <div className="pr-controls">
        <Slider
          id="pr-s"
          label="Spot"
          value={p.S}
          display={fmt(p.S, 0)}
          min={40}
          max={180}
          step={1}
          onChange={(v) => set("S", v)}
        />
        <Slider
          id="pr-k"
          label="Strike"
          value={p.K}
          display={fmt(p.K, 0)}
          min={40}
          max={180}
          step={1}
          onChange={(v) => set("K", v)}
        />
        <Slider
          id="pr-b"
          label="Barrier"
          value={Math.min(p.B, maxB)}
          display={fmt(Math.min(p.B, maxB), 0)}
          min={20}
          max={maxB}
          step={1}
          onChange={(v) => set("B", v)}
        />
        <Slider
          id="pr-v"
          label="Vol σ"
          value={p.sigma}
          display={`${(p.sigma * 100).toFixed(0)}%`}
          min={0.05}
          max={0.8}
          step={0.01}
          onChange={(v) => set("sigma", v)}
        />
        <Slider
          id="pr-t"
          label="Maturity"
          value={p.T}
          display={`${p.T.toFixed(2)}y`}
          min={0.08}
          max={3}
          step={0.02}
          onChange={(v) => set("T", v)}
        />
        <Slider
          id="pr-r"
          label="Rate r"
          value={p.r}
          display={`${(p.r * 100).toFixed(1)}%`}
          min={0}
          max={0.12}
          step={0.001}
          onChange={(v) => set("r", v)}
        />

        <div className="ctl full">
          <span className="lbl" id="pr-paths">
            Paths
          </span>
          <div className="toggles" role="group" aria-labelledby="pr-paths">
            {PATH_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={p.paths === n}
                onClick={() => set("paths", n)}
              >
                {n >= 1000 ? `${n / 1000}k` : n}
              </button>
            ))}
          </div>
        </div>

        <div className="ctl full">
          <span className="lbl" id="pr-av">
            Variance reduction
          </span>
          <div className="toggles" role="group" aria-labelledby="pr-av">
            <button
              type="button"
              aria-pressed={!p.antithetic}
              onClick={() => set("antithetic", false)}
            >
              Crude
            </button>
            <button
              type="button"
              aria-pressed={p.antithetic}
              onClick={() => set("antithetic", true)}
            >
              Antithetic
            </button>
          </div>
        </div>
      </div>

      <div className="pr-canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} aria-hidden="true" />
        <div className="pr-legend">
          <span>
            <i className="swatch" style={{ background: "var(--up)" }} /> survived
          </span>
          <span>
            <i className="swatch" style={{ background: "var(--down)" }} /> knocked out
          </span>
          <span>{KEEP} of {mc.paths.toLocaleString("en-GB")} shown</span>
        </div>
      </div>

      <div className="pr-out" aria-busy={busy}>
        <dl className="out-list">
        <div className="out-row hero">
          <dt>
            MC price
            <br />
            <span style={{ fontSize: 9 }}>discrete · {STEPS} steps</span>
          </dt>
          <dd>{fmt(mc.price, 4)}</dd>
        </div>
        <div className="out-row">
          <dt>95% CI</dt>
          <dd>
            ±{fmt(1.96 * mc.stdError, 4)}{" "}
            <span className="muted">
              [{fmt(mc.ci[0], 3)}, {fmt(mc.ci[1], 3)}]
            </span>
          </dd>
        </div>
        <div className="out-row">
          <dt>Analytic barrier</dt>
          <dd>{fmt(analytic, 4)}</dd>
        </div>
        <div className="out-row">
          <dt>Discretisation bias</dt>
          <dd className={bias >= 0 ? "up" : "down"}>
            {bias >= 0 ? "+" : "−"}
            {fmt(Math.abs(bias), 4)}
          </dd>
        </div>
        <div className="out-row">
          <dt>Vanilla call</dt>
          <dd>{fmt(vanilla.price, 4)}</dd>
        </div>
        <div className="out-row">
          <dt>Δ / Γ / ν</dt>
          <dd className="muted">
            {vanilla.delta.toFixed(3)} · {vanilla.gamma.toFixed(4)} · {vanilla.vega.toFixed(2)}
          </dd>
        </div>
        <div className="out-row">
          <dt>Knock-out rate</dt>
          <dd className={mc.knockOutRate > 0.5 ? "down" : "flat"}>
            {(mc.knockOutRate * 100).toFixed(1)}%
          </dd>
        </div>
        <div className="out-row">
          <dt>Compute</dt>
          <dd className="muted">
            {mc.paths.toLocaleString("en-GB")} paths ·{" "}
            {mounted ? `${mc.elapsedMs.toFixed(0)}ms` : "—"}
          </dd>
        </div>
        </dl>
        <p className="pr-note">
          <strong>Why the two prices differ.</strong> The analytic figure assumes the barrier is
          watched continuously. The simulation only checks it {STEPS} times, so paths that dip below{" "}
          {dp.B} and recover between observations survive when they should not — which biases the
          simulated price upward. The gap closes like 1/√steps. Antithetic sampling narrows the
          confidence interval without touching that bias.
        </p>
      </div>
    </div>
  );
}
