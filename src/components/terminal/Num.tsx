"use client";

import { useEffect, useRef, useState } from "react";
import { fmt, signed } from "./quant";

/**
 * Values count to their target instead of snapping to it.
 *
 * Initial state is the target, so the server and the first client render agree
 * and nothing animates on hydration — only subsequent changes roll. Anyone who
 * asked for reduced motion gets the value immediately.
 */
export function useRoll(target: number, ms = 420): number {
  const [display, setDisplay] = useState(target);
  const current = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    current.current = display;
  }, [display]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      return;
    }
    const from = current.current;
    if (from === target) return;

    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      // easeOutCubic — fast off the mark, settles rather than stops.
      const e = 1 - (1 - p) ** 3;
      setDisplay(from + (target - from) * e);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);

  return display;
}

type Props = {
  value: number;
  dp?: number;
  /** Render with an explicit + or − sign. */
  sign?: boolean;
  /** Roll duration in ms. */
  ms?: number;
  suffix?: string;
};

export function Num({ value, dp = 2, sign = false, ms, suffix }: Props) {
  const v = useRoll(value, ms);
  return (
    <>
      {sign ? signed(v, dp) : fmt(v, dp)}
      {suffix}
    </>
  );
}
