"use client";

import { useMemo, useState } from "react";
import type { Execution, Position, RestingOrder, Side } from "./engine";
import { emptyPosition, makeBook, MAX_QTY, START_CASH, unrealized } from "./engine";
import { fmt, signed } from "./quant";
import { Num } from "./Num";
import type { SubmitArgs, SubmitResult } from "./useTrading";

type Props = {
  ticker: string;
  mark: number;
  seed: number;
  positions: Record<string, Position>;
  resting: RestingOrder[];
  executions: Execution[];
  cash: number;
  nlv: number;
  pnl: number;
  realized: number;
  openPnl: number;
  marks: Record<string, number>;
  onSubmit: (args: SubmitArgs) => SubmitResult;
  onCancel: (id?: number) => SubmitResult;
  onFlatten: () => SubmitResult;
};

const CLIPS = [100, 250, 500, 1000];

const pnlClass = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "muted");

export function TradeDesk({
  ticker,
  mark,
  seed,
  positions,
  resting,
  executions,
  cash,
  nlv,
  pnl,
  realized,
  openPnl,
  marks,
  onSubmit,
  onCancel,
  onFlatten,
}: Props) {
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState(250);
  const [isLimit, setIsLimit] = useState(false);
  const [limit, setLimit] = useState<string>("");
  const [note, setNote] = useState<string | null>(null);

  const book = useMemo(() => makeBook(mark, seed), [mark, seed]);
  const best = side === "BUY" ? book.asks[0].px : book.bids[0].px;
  const maxSize = Math.max(...book.bids.map((l) => l.size), ...book.asks.map((l) => l.size));
  const position = positions[ticker] ?? emptyPosition();

  // Resting orders drawn onto the ladder, keyed to the nearest price level.
  const working = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of resting.filter((r) => r.ticker === ticker)) {
      const k = o.px.toFixed(2);
      map.set(k, (map.get(k) ?? 0) + o.qty);
    }
    return map;
  }, [resting, ticker]);

  const send = () => {
    const px = isLimit ? Number.parseFloat(limit) : undefined;
    if (isLimit && (!Number.isFinite(px) || (px as number) <= 0)) {
      setNote("Enter a limit price.");
      return;
    }
    const r = onSubmit({ ticker, side, qty, limit: px });
    setNote(r.lines[0] ?? null);
  };

  const openPositions = Object.entries(positions).filter(([, p]) => p.qty !== 0);

  return (
    <div className="desk">
      {/* ---- ticket ---- */}
      <div className="tkt">
        <div className="tkt-side toggles" role="group" aria-label="Side">
          <button
            type="button"
            className="buy"
            aria-pressed={side === "BUY"}
            onClick={() => setSide("BUY")}
          >
            Buy
          </button>
          <button
            type="button"
            className="sell"
            aria-pressed={side === "SELL"}
            onClick={() => setSide("SELL")}
          >
            Sell
          </button>
        </div>

        <div className="ctl">
          <label htmlFor="tkt-qty">
            Quantity
            <span className="val">{qty}</span>
          </label>
          <input
            id="tkt-qty"
            className="num"
            type="number"
            min={1}
            max={MAX_QTY}
            step={10}
            value={qty}
            onChange={(e) => setQty(Math.min(MAX_QTY, Math.max(1, Number(e.target.value) || 0)))}
          />
          <div className="clips">
            {CLIPS.map((c) => (
              <button key={c} type="button" onClick={() => setQty(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="ctl">
          <span className="lbl" id="tkt-type">
            Order type
          </span>
          <div className="toggles" role="group" aria-labelledby="tkt-type">
            <button type="button" aria-pressed={!isLimit} onClick={() => setIsLimit(false)}>
              Market
            </button>
            <button
              type="button"
              aria-pressed={isLimit}
              onClick={() => {
                setIsLimit(true);
                if (!limit) setLimit(best.toFixed(2));
              }}
            >
              Limit
            </button>
          </div>
        </div>

        {isLimit && (
          <div className="ctl">
            <label htmlFor="tkt-px">
              Limit price
              <span className="val">{side === "BUY" ? "bid" : "offer"}</span>
            </label>
            <input
              id="tkt-px"
              className="num"
              type="number"
              step={0.05}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
        )}

        <button type="button" className={`send ${side.toLowerCase()}`} onClick={send}>
          {side} {qty} {ticker}
          <span className="send-px">
            {isLimit ? `@ ${limit || "—"}` : `≈ ${fmt(best)}`}
          </span>
        </button>

        <dl className="tkt-meta">
          <div>
            <dt>Notional</dt>
            <dd>{fmt(qty * best, 0)}</dd>
          </div>
          <div>
            <dt>Buying power</dt>
            <dd>{fmt(cash, 0)}</dd>
          </div>
        </dl>

        {note && <p className="tkt-note">{note}</p>}
      </div>

      {/* ---- depth ---- */}
      <div className="ladder">
        <div className="ladder-head">
          <span>Bid size</span>
          <span>Price</span>
          <span>Ask size</span>
        </div>

        {[...book.asks].reverse().map((level, i) => {
          const w = working.get(level.px.toFixed(2));
          return (
            <div className={`lad-row${i === book.asks.length - 1 ? " touch" : ""}`} key={`a${level.px}`}>
              <span className="lad-bid" />
              <span className="lad-px down">{level.px.toFixed(2)}</span>
              <span className="lad-ask">
                <span className="lad-bar ask" style={{ width: `${(level.size / maxSize) * 100}%` }} />
                <span className="lad-sz">
                  {level.size}
                  {w ? <b title="your working order"> ▸{w}</b> : null}
                </span>
              </span>
            </div>
          );
        })}

        <div className="lad-mid">
          <span>spread {book.spread.toFixed(2)}</span>
          <span className="amber">{fmt(book.mid)}</span>
          <span>{((book.spread / book.mid) * 10000).toFixed(1)} bp</span>
        </div>

        {book.bids.map((level, i) => {
          const w = working.get(level.px.toFixed(2));
          return (
            <div className={`lad-row${i === 0 ? " touch" : ""}`} key={`b${level.px}`}>
              <span className="lad-bid">
                <span className="lad-bar bid" style={{ width: `${(level.size / maxSize) * 100}%` }} />
                <span className="lad-sz">
                  {w ? <b title="your working order">{w}◂ </b> : null}
                  {level.size}
                </span>
              </span>
              <span className="lad-px up">{level.px.toFixed(2)}</span>
              <span className="lad-ask" />
            </div>
          );
        })}

        <p className="ladder-foot">
          Synthetic passive depth, {book.bids.length} levels a side. Fills walk the book at
          price-time priority and re-mark the tape through a √-law impact model.
        </p>
      </div>

      {/* Mobile stand-ins for the ladder and ticket, which are cut below 640px. */}
      <div className="m-spread">
        <span className="muted">Spread</span>
        <b>{book.spread.toFixed(2)}</b>
        <span className="muted">{((book.spread / book.mid) * 10000).toFixed(1)} bp</span>
      </div>
      <p className="m-note">The full trading terminal is available on desktop.</p>

      {/* ---- risk ---- */}
      <div className="risk">
        <dl className="risk-top">
          <div>
            <dt>Net liq</dt>
            <dd>
              <Num value={nlv} dp={0} ms={560} />
            </dd>
          </div>
          <div>
            <dt>Session P&amp;L</dt>
            <dd className={pnlClass(pnl)}>
              <Num value={pnl} dp={0} sign ms={560} />
            </dd>
          </div>
          <div>
            <dt>Return</dt>
            <dd className={pnlClass(pnl)}>
              <Num value={(pnl / START_CASH) * 100} dp={2} sign suffix="%" ms={560} />
            </dd>
          </div>
        </dl>

        <div className="risk-split">
          <span>
            realised <b className={pnlClass(realized)}>{signed(realized, 0)}</b>
          </span>
          <span>
            open <b className={pnlClass(openPnl)}>{signed(openPnl, 0)}</b>
          </span>
          <button type="button" className="flat-btn" onClick={() => onFlatten()}>
            Flatten all
          </button>
        </div>

        <div className="risk-tbl">
          <div className="rt-head">
            <span>Sym</span>
            <span>Qty</span>
            <span>Avg</span>
            <span>Mark</span>
            <span>Open P&amp;L</span>
          </div>
          {openPositions.length === 0 ? (
            <p className="risk-empty">
              No position. Send an order, or type <span className="kbd">BUY 250 {ticker}</span> in
              the command line.
            </p>
          ) : (
            openPositions.map(([sym, p]) => {
              const m = marks[sym] ?? p.avgPx;
              const u = unrealized(p, m);
              return (
                <div className="rt-row" key={sym}>
                  <span className="amber">{sym}</span>
                  <span className={p.qty > 0 ? "up" : "down"}>{p.qty > 0 ? "+" : ""}{p.qty}</span>
                  <span>{fmt(p.avgPx)}</span>
                  <span>{fmt(m)}</span>
                  <span className={pnlClass(u)}>{signed(u, 0)}</span>
                </div>
              );
            })
          )}
        </div>

        {resting.length > 0 && (
          <div className="risk-tbl">
            <div className="rt-head work">
              <span>Working</span>
              <span />
              <span />
              <span />
              <span />
            </div>
            {resting.map((o) => (
              <div className="rt-row" key={o.id}>
                <span className="amber">{o.ticker}</span>
                <span className={o.side === "BUY" ? "up" : "down"}>
                  {o.side === "BUY" ? "+" : "−"}
                  {o.qty}
                </span>
                <span>{fmt(o.px)}</span>
                <span className="muted">#{o.id}</span>
                <span>
                  <button type="button" className="x-btn" onClick={() => onCancel(o.id)}>
                    cancel
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="risk-tbl">
          <div className="rt-head">
            <span>Fills</span>
            <span />
            <span />
            <span />
            <span>Slip</span>
          </div>
          {executions.length === 0 ? (
            <p className="risk-empty">No executions yet.</p>
          ) : (
            executions.map((e) => (
              <div className="rt-row" key={e.id}>
                <span className="amber">{e.ticker}</span>
                <span className={e.side === "BUY" ? "up" : "down"}>
                  {e.side === "BUY" ? "B" : "S"} {e.qty}
                </span>
                <span>{fmt(e.px)}</span>
                <span />
                <span className={e.slippageBps > 0 ? "down" : "up"}>
                  {e.slippageBps >= 0 ? "+" : ""}
                  {e.slippageBps.toFixed(1)}bp
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
