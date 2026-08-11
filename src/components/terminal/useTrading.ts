"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Execution, Position, RestingOrder, Side } from "./engine";
import {
  applyFill,
  emptyPosition,
  impactFraction,
  MAX_QTY,
  makeBook,
  slippageBps,
  START_CASH,
  sweep,
  unrealized,
  vwap,
} from "./engine";
import { toCents } from "./quant";

export type SubmitArgs = { ticker: string; side: Side; qty: number; limit?: number };
export type SubmitResult = { ok: boolean; lines: string[] };

type Marks = Record<string, { mark: number; seed: number; sigma: number }>;

const MAX_EXECUTIONS = 14;

export function useTrading(marks: Marks, onImpact: (ticker: string, delta: number) => void) {
  const [cash, setCash] = useState(START_CASH);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [resting, setResting] = useState<RestingOrder[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const idRef = useRef(1);

  // Held in refs so the resting-order sweep can read current values without
  // re-subscribing every tick.
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const impactRef = useRef(onImpact);
  impactRef.current = onImpact;
  const restingRef = useRef(resting);
  restingRef.current = resting;

  const book = (ticker: string) => {
    const m = marksRef.current[ticker];
    return m ? makeBook(m.mark, m.seed) : null;
  };

  /** Book a completed fill: position, cash, tape, and the print's impact. */
  const record = useCallback((ticker: string, side: Side, px: number, qty: number, arrival: number) => {
    const sigma = marksRef.current[ticker]?.sigma ?? 0.25;

    setPositions((prev) => ({
      ...prev,
      [ticker]: applyFill(prev[ticker] ?? emptyPosition(), side, px, qty),
    }));
    setCash((prev) => toCents(prev + (side === "BUY" ? -1 : 1) * px * qty));
    setExecutions((prev) =>
      [
        {
          id: idRef.current++,
          ticker,
          side,
          px,
          qty,
          slippageBps: slippageBps(px, arrival, side),
        },
        ...prev,
      ].slice(0, MAX_EXECUTIONS),
    );

    const frac = impactFraction(qty, sigma) * (side === "BUY" ? 1 : -1);
    impactRef.current(ticker, frac);
  }, []);

  const submit = useCallback(
    ({ ticker, side, qty, limit }: SubmitArgs): SubmitResult => {
      const m = marksRef.current[ticker];
      if (!m) return { ok: false, lines: [`No instrument ${ticker}.`] };
      if (!Number.isFinite(qty) || qty <= 0) return { ok: false, lines: ["Quantity must be positive."] };
      if (qty > MAX_QTY) return { ok: false, lines: [`Max clip is ${MAX_QTY}.`] };

      const b = makeBook(m.mark, m.seed);
      const levels = side === "BUY" ? b.asks : b.bids;
      const { fills, remaining } = sweep(levels, Math.round(qty), side, limit);
      const filled = Math.round(qty) - remaining;
      const lines: string[] = [];

      if (filled > 0) {
        const px = vwap(fills);
        record(ticker, side, px, filled, b.mid);
        const slip = slippageBps(px, b.mid, side);
        lines.push(
          `${side} ${filled} ${ticker} @ ${px.toFixed(2)} · ${fills.length} level${fills.length > 1 ? "s" : ""} · slippage ${slip >= 0 ? "+" : ""}${slip.toFixed(1)}bp`,
        );
      }

      if (remaining > 0) {
        if (limit === undefined) {
          lines.push(`${remaining} unfilled — swept the visible book.`);
        } else {
          const id = idRef.current++;
          setResting((prev) => [...prev, { id, ticker, side, px: limit, qty: remaining }]);
          lines.push(`${remaining} ${ticker} resting ${side} @ ${limit.toFixed(2)} · order #${id}`);
        }
      }

      return { ok: true, lines };
    },
    [record],
  );

  const cancel = useCallback((id?: number): SubmitResult => {
    setResting((prev) => (id === undefined ? [] : prev.filter((o) => o.id !== id)));
    return {
      ok: true,
      lines: [id === undefined ? "Cancelled all working orders." : `Cancelled #${id}.`],
    };
  }, []);

  const flatten = useCallback((): SubmitResult => {
    const open = Object.entries(positions).filter(([, p]) => p.qty !== 0);
    if (!open.length) return { ok: true, lines: ["Already flat."] };
    const lines: string[] = [];
    for (const [ticker, p] of open) {
      const r = submit({ ticker, side: p.qty > 0 ? "SELL" : "BUY", qty: Math.abs(p.qty) });
      lines.push(...r.lines);
    }
    return { ok: true, lines };
  }, [positions, submit]);

  // Working orders are re-checked whenever the market moves: a bid rests until
  // the offer trades down to it.
  //
  // The sweep runs outside any state updater on purpose. Updaters must be pure
  // — React is free to call them twice — and booking a fill from inside one
  // would double the trade under StrictMode.
  useEffect(() => {
    const current = restingRef.current;
    if (!current.length) return;

    const survivors: RestingOrder[] = [];
    const booked: { ticker: string; side: Side; px: number; qty: number; mid: number }[] = [];

    for (const order of current) {
      const b = book(order.ticker);
      if (!b) {
        survivors.push(order);
        continue;
      }
      const levels = order.side === "BUY" ? b.asks : b.bids;
      const { fills, remaining } = sweep(levels, order.qty, order.side, order.px);
      const filled = order.qty - remaining;
      if (filled > 0) {
        booked.push({ ticker: order.ticker, side: order.side, px: vwap(fills), qty: filled, mid: b.mid });
      }
      if (remaining > 0) survivors.push({ ...order, qty: remaining });
    }

    if (!booked.length) return;
    for (const f of booked) record(f.ticker, f.side, f.px, f.qty, f.mid);
    setResting(survivors);
    // Intentionally keyed on the marks object identity — one sweep per tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks]);

  const marketValue = Object.entries(positions).reduce(
    (a, [t, p]) => a + p.qty * (marks[t]?.mark ?? p.avgPx),
    0,
  );
  const realized = Object.values(positions).reduce((a, p) => a + p.realized, 0);
  const openPnl = Object.entries(positions).reduce(
    (a, [t, p]) => a + unrealized(p, marks[t]?.mark ?? p.avgPx),
    0,
  );

  return {
    cash,
    positions,
    resting,
    executions,
    submit,
    cancel,
    flatten,
    realized,
    openPnl,
    nlv: cash + marketValue,
    pnl: cash + marketValue - START_CASH,
  };
}
