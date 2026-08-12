"use client";

import { useEffect, useRef } from "react";
import { instruments } from "@/resources/terminal";
import { LEVELS } from "./engine";
import { corpusSize } from "./retrieval";

/**
 * Terminal boot sequence.
 *
 * Runs on CSS alone so it still completes if hydration is slow or fails — the
 * overlay animates itself out rather than waiting for React. JS only adds the
 * ability to skip, and a head script suppresses it after the first load of a
 * session so navigating back doesn't replay it.
 *
 * The terminal is rendered underneath the whole time, not gated behind this,
 * so crawlers and screen readers are unaffected.
 */

const CHECKS: { label: string; value: string }[] = [
  { label: "Market data", value: `${instruments.length} instruments` },
  { label: "Pricing engine", value: "Black–Scholes · Monte Carlo" },
  { label: "Order book", value: `${LEVELS} levels a side` },
  { label: "Retrieval index", value: `${corpusSize} chunks` },
  { label: "Session", value: "London" },
];

export function BootSequence() {
  const ref = useRef<HTMLDivElement | null>(null);
  const skip = () => ref.current?.setAttribute("data-skip", "");

  // Any key dismisses it, not just a click — the terminal is keyboard-driven
  // and a visitor reaching for "/" shouldn't have to wait it out.
  useEffect(() => {
    const onKey = () => ref.current?.setAttribute("data-skip", "");
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="boot"
      ref={ref}
      aria-hidden="true"
      onClick={skip}
      onKeyDown={skip}
      role="presentation"
    >
      <div className="boot-inner">
        <div className="boot-mark">
          <span className="bm-word bm-a">
            <i>Soltani</i>
          </span>
          <em className="bm-dot">·</em>
          <span className="bm-word bm-b">
            <i>Terminal</i>
          </span>
        </div>

        <div className="boot-rule">
          <span className="boot-sweep" />
        </div>

        <ul className="boot-list">
          {CHECKS.map((c, i) => (
            <li key={c.label} style={{ animationDelay: `${0.65 + i * 0.17}s` }}>
              <span className="boot-label">{c.label}</span>
              <span className="boot-dots" />
              <span className="boot-value">{c.value}</span>
              <span className="boot-ok" style={{ animationDelay: `${0.95 + i * 0.17}s` }}>
                OK
              </span>
            </li>
          ))}
        </ul>

        <div className="boot-foot">
          <span className="boot-pulse" />
          <span className="boot-status">
            <i>Opening session</i>
            <b>Session open</b>
          </span>
          <span className="boot-meter">
            <i />
          </span>
        </div>
      </div>
    </div>
  );
}
