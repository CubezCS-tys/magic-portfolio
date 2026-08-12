"use client";

import { useEffect, useRef } from "react";

/**
 * Full-viewport crosshair tracking the pointer.
 *
 * Written straight to the DOM from a rAF loop rather than through state — a
 * pointermove handler that re-renders React on every event would cost more
 * than the whole rest of the page.
 */
export function Crosshair() {
  const across = useRef<HTMLDivElement | null>(null);
  const down = useRef<HTMLDivElement | null>(null);
  const readout = useRef<HTMLSpanElement | null>(null);
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Touch has no hover, and a crosshair chasing taps is noise.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let x = 0;
    let y = 0;
    let queued = false;
    let raf = 0;

    const apply = () => {
      queued = false;
      if (across.current) across.current.style.transform = `translate3d(0,${y}px,0)`;
      if (down.current) down.current.style.transform = `translate3d(${x}px,0,0)`;
      if (readout.current) readout.current.textContent = `${x}·${y}`;
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      host.current?.setAttribute("data-live", "");
      if (!queued) {
        queued = true;
        raf = requestAnimationFrame(apply);
      }
    };

    const onLeave = () => host.current?.removeAttribute("data-live");

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="xhair" ref={host} aria-hidden="true">
      <div className="xhair-x" ref={across} />
      <div className="xhair-y" ref={down} />
      <span className="xhair-pos" ref={readout} />
    </div>
  );
}

type Mem = { usedJSHeapSize: number };

/**
 * The terminal reporting its own health. Real measurements — frame rate and
 * frame cost from a rAF loop, heap from the memory API where it exists.
 */
export function Vitals() {
  const out = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let frames = 0;
    let worst = 0;
    let last = performance.now();
    let mark = last;
    let raf = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames++;
      if (dt > worst) worst = dt;

      if (now - mark >= 500) {
        const fps = Math.round((frames * 1000) / (now - mark));
        const mem = (performance as Performance & { memory?: Mem }).memory;
        const heap = mem ? ` · ${Math.round(mem.usedJSHeapSize / 1048576)}MB` : "";
        if (out.current) out.current.textContent = `${fps}FPS · ${worst.toFixed(1)}MS${heap}`;
        frames = 0;
        worst = 0;
        mark = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className="vitals" ref={out} suppressHydrationWarning>
      —
    </span>
  );
}
