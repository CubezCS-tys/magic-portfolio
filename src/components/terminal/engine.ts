/**
 * A small but honest trading engine: a two-sided limit order book, price-time
 * matching, position keeping with realised/unrealised split, and square-root
 * market impact on fills.
 *
 * The passive side of the book is a pure function of (mid, seed) rather than a
 * stored list of maker orders. Regenerating it every tick is both cheaper and
 * closer to how a quote-driven venue behaves — the makers are always refreshing
 * anyway. User orders are held separately and merged in for display.
 */

import { mulberry32, toCents } from "./quant";

export type Side = "BUY" | "SELL";

export type Level = { px: number; size: number };

export type Book = {
  bids: Level[];
  asks: Level[];
  mid: number;
  spread: number;
};

export type Fill = { px: number; qty: number };

export type Execution = {
  id: number;
  ticker: string;
  side: Side;
  px: number;
  qty: number;
  /** Difference between fill VWAP and arrival mid, in basis points. */
  slippageBps: number;
};

export type RestingOrder = {
  id: number;
  ticker: string;
  side: Side;
  px: number;
  qty: number;
};

export type Position = { qty: number; avgPx: number; realized: number };

export const TICK = 0.05;
export const LEVELS = 8;
export const MAX_QTY = 2000;
export const START_CASH = 1_000_000;

const roundTick = (p: number) => toCents(Math.round(p / TICK) * TICK);

export const emptyPosition = (): Position => ({ qty: 0, avgPx: 0, realized: 0 });

/**
 * Passive depth around the mid. Sizes grow with distance from the touch, which
 * is the usual shape — makers keep less inventory at risk on the front row.
 */
export function makeBook(mid: number, seed: number): Book {
  const rand = mulberry32((seed ^ Math.round(mid * 100)) >>> 0);
  const halfSpread = TICK * (1 + Math.floor(rand() * 3));

  const bids: Level[] = [];
  const asks: Level[] = [];
  for (let k = 0; k < LEVELS; k++) {
    const off = halfSpread + k * TICK;
    const size = () => Math.round((120 + k * 95 + rand() * 280) / 10) * 10;
    bids.push({ px: roundTick(mid - off), size: size() });
    asks.push({ px: roundTick(mid + off), size: size() });
  }

  // Report the touch midpoint rather than the raw mark: levels are snapped to
  // the tick, so the two differ, and slippage should be measured against the
  // price a taker could actually have crossed.
  return {
    bids,
    asks,
    mid: toCents((bids[0].px + asks[0].px) / 2),
    spread: toCents(asks[0].px - bids[0].px),
  };
}

/**
 * Walk one side of the book taking liquidity, stopping at `limit` if given.
 * Levels must arrive in the order they should be consumed: asks ascending for
 * a buy, bids descending for a sell.
 */
export function sweep(
  levels: Level[],
  qty: number,
  side: Side,
  limit?: number,
): { fills: Fill[]; remaining: number } {
  const fills: Fill[] = [];
  let remaining = qty;

  for (const level of levels) {
    if (remaining <= 0) break;
    if (limit !== undefined) {
      const crossable = side === "BUY" ? level.px <= limit : level.px >= limit;
      if (!crossable) break;
    }
    const take = Math.min(remaining, level.size);
    if (take > 0) {
      fills.push({ px: level.px, qty: take });
      remaining -= take;
    }
  }

  return { fills, remaining };
}

export function vwap(fills: Fill[]): number {
  const qty = fills.reduce((a, f) => a + f.qty, 0);
  if (qty === 0) return 0;
  return toCents(fills.reduce((a, f) => a + f.px * f.qty, 0) / qty);
}

/**
 * Position update with the realised/unrealised split done properly: closing
 * into an existing position books P&L on the closed portion, and flipping
 * through zero re-bases the average at the fill price.
 */
export function applyFill(pos: Position, side: Side, px: number, qty: number): Position {
  const signed = side === "BUY" ? qty : -qty;

  // Same direction, or opening from flat: weighted-average the entry.
  if (pos.qty === 0 || Math.sign(pos.qty) === Math.sign(signed)) {
    const total = pos.qty + signed;
    return {
      qty: total,
      avgPx: toCents((pos.avgPx * Math.abs(pos.qty) + px * qty) / Math.abs(total)),
      realized: pos.realized,
    };
  }

  const closing = Math.min(Math.abs(signed), Math.abs(pos.qty));
  // Long closes at (exit - entry); short closes at (entry - exit).
  const pnl = (pos.qty > 0 ? px - pos.avgPx : pos.avgPx - px) * closing;
  const remaining = pos.qty + signed;

  if (remaining === 0) {
    return { qty: 0, avgPx: 0, realized: pos.realized + pnl };
  }
  if (Math.sign(remaining) === Math.sign(pos.qty)) {
    // Partial close, entry price is unchanged.
    return { qty: remaining, avgPx: pos.avgPx, realized: pos.realized + pnl };
  }
  // Flipped through zero: the residual is a new position at the fill price.
  return { qty: remaining, avgPx: px, realized: pos.realized + pnl };
}

export const unrealized = (pos: Position, mark: number): number =>
  pos.qty === 0 ? 0 : (mark - pos.avgPx) * pos.qty;

/**
 * Square-root market impact: Δ/S ≈ κ·σ·√(Q/ADV).
 *
 * The concave shape is one of the most robust empirical results in
 * microstructure — doubling size costs noticeably less than twice as much.
 * Treated as permanent here, so a large print visibly re-marks the candle.
 */
export function impactFraction(qty: number, sigma: number, adv = 50_000, kappa = 0.6): number {
  return kappa * sigma * Math.sqrt(Math.max(0, qty) / adv);
}

/** Basis points between a fill VWAP and the mid that stood when it was sent. */
export function slippageBps(fillPx: number, arrivalMid: number, side: Side): number {
  if (arrivalMid <= 0) return 0;
  const raw = ((fillPx - arrivalMid) / arrivalMid) * 10_000;
  return side === "BUY" ? raw : -raw;
}
