"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { book, instruments, links, positions, profile, stack, tape } from "@/resources/terminal";
import type { Bar } from "./quant";
import { fmt, gbmBars, signed, toCents } from "./quant";
import type { ChartMode } from "./PriceChart";
import { PriceChart } from "./PriceChart";
import { Pricer } from "./Pricer";
import { TradeDesk } from "./TradeDesk";
import { useTrading } from "./useTrading";
import { corpusSize, search } from "./retrieval";
import "./terminal.css";

const SESSIONS = 180;
const TICK_MS = 1500;
/** Ticks that make up one session, so a candle closes every ~18s. */
const TICKS_PER_BAR = 12;

type Quote = {
  bars: Bar[];
  flash: "up" | "down" | null;
  seq: number;
};

/** Session change, measured across the window currently on the chart. */
const changePct = (q: Quote) => {
  const open = q.bars[0].o;
  return ((q.bars[q.bars.length - 1].c - open) / open) * 100;
};

/**
 * Walk seeds until the sampled path finishes up on the session.
 * These are decorative simulations, disclosed as such in the footer — this
 * just picks a flattering draw rather than shipping whatever seed 1 gave.
 */
function pickBars(inst: (typeof instruments)[number]): Bar[] {
  const { base, drift, sigma, seed } = inst.sim;
  let fallback: Bar[] | null = null;
  for (let k = 0; k < 500; k++) {
    const b = gbmBars(base, drift, sigma, SESSIONS, seed + k * 7919);
    const chg = (b[b.length - 1].c - b[0].o) / b[0].o;
    if (chg > 0.12 && chg < 0.55) return b;
    if (!fallback) fallback = b;
  }
  return fallback as Bar[];
}

function initialQuotes(): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const inst of instruments) {
    out[inst.ticker] = { bars: pickBars(inst), flash: null, seq: 0 };
  }
  return out;
}

/** London cash-equity hours, used only for the status light. */
function marketOpen(d: Date): boolean {
  const wd = d.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= 480 && mins <= 990;
}

export function Terminal() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>(initialQuotes);
  const [active, setActive] = useState(instruments[0].ticker);
  const [chartMode, setChartMode] = useState<ChartMode>("candle");
  const [openRow, setOpenRow] = useState<string | null>(positions[0].code);
  const [log, setLog] = useState<{ kind: "echo" | "out" | "err"; text: string }[]>([]);
  const [entry, setEntry] = useState("");
  const [clock, setClock] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const panels = {
    watch: useRef<HTMLElement | null>(null),
    inst: useRef<HTMLElement | null>(null),
    desk: useRef<HTMLElement | null>(null),
    pricer: useRef<HTMLElement | null>(null),
    book: useRef<HTMLElement | null>(null),
    stack: useRef<HTMLElement | null>(null),
    blotter: useRef<HTMLElement | null>(null),
  };

  const instrument = useMemo(
    () => instruments.find((i) => i.ticker === active) ?? instruments[0],
    [active],
  );

  /** Everything the trading engine needs to price and size a fill. */
  const marks = useMemo(() => {
    const out: Record<string, { mark: number; seed: number; sigma: number }> = {};
    for (const inst of instruments) {
      const qq = quotes[inst.ticker];
      out[inst.ticker] = {
        mark: qq.bars[qq.bars.length - 1].c,
        seed: inst.sim.seed,
        sigma: inst.sim.sigma,
      };
    }
    return out;
  }, [quotes]);

  const markPrices = useMemo(
    () => Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v.mark])),
    [marks],
  );

  // A print re-marks the tape. Applied to the live bar so a large clip visibly
  // moves the candle it traded in.
  const applyImpact = useCallback((ticker: string, frac: number) => {
    setQuotes((prev) => {
      const q = prev[ticker];
      if (!q) return prev;
      const cur = q.bars[q.bars.length - 1];
      const px = toCents(cur.c * (1 + frac));
      const live: Bar = { o: cur.o, h: Math.max(cur.h, px), l: Math.min(cur.l, px), c: px };
      return {
        ...prev,
        [ticker]: {
          bars: [...q.bars.slice(0, -1), live],
          flash: frac >= 0 ? "up" : "down",
          seq: q.seq + 1,
        },
      };
    });
  }, []);

  const desk = useTrading(marks, applyImpact);

  // Clock and market state are client-only so the server markup stays stable.
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: profile.timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now),
      );
      setIsOpen(marketOpen(now));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Quotes drift after mount. Paused for anyone who asked for reduced motion.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      // Each tick is a fraction of a session, and the bar closes on the last
      // one. Advancing a whole trading day per tick would age the chart by
      // over a year in ten minutes and blow out the scale.
      const rollover = tick % TICKS_PER_BAR === 0;
      const dt = 1 / 252 / TICKS_PER_BAR;

      setQuotes((prev) => {
        const next: Record<string, Quote> = {};
        for (const inst of instruments) {
          const q = prev[inst.ticker];
          const current = q.bars[q.bars.length - 1];
          const z = (Math.random() + Math.random() + Math.random() - 1.5) * 1.6;
          const px = toCents(
            current.c *
              Math.exp(
                (inst.sim.drift - (inst.sim.sigma * inst.sim.sigma) / 2) * dt +
                  inst.sim.sigma * Math.sqrt(dt) * z,
              ),
          );
          // The newest bar is the live session: its close moves and the wick
          // extends, the way an unfinished candle behaves on a real chart.
          const live: Bar = {
            o: current.o,
            h: Math.max(current.h, px),
            l: Math.min(current.l, px),
            c: px,
          };
          const settled = [...q.bars.slice(0, -1), live];
          next[inst.ticker] = {
            // On rollover the window slides: drop the oldest session and open
            // a new one at the last print.
            bars: rollover
              ? [...settled.slice(1), { o: px, h: px, l: px, c: px }]
              : settled,
            flash: px >= current.c ? "up" : "down",
            seq: q.seq + 1,
          };
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const scrollTo = useCallback((key: keyof typeof panels) => {
    panels[key].current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = (lines: string[], kind: "out" | "err" = "out") =>
    setLog((l) => [...l, ...lines.map((text) => ({ kind, text }))]);

  const run = (raw: string) => {
    const input = raw.trim();
    if (!input) return;
    setLog((l) => [...l, { kind: "echo" as const, text: `> ${input.toUpperCase()}` }]);

    const [head, ...rest] = input.toUpperCase().split(/\s+/);
    const arg = rest.join(" ").replace(/<GO>$/, "").trim();

    const pick = (t: string) => {
      const hit = instruments.find((i) => i.ticker === t);
      if (!hit) return false;
      setActive(hit.ticker);
      scrollTo("inst");
      say([`${hit.ticker} · ${hit.name}`, hit.thesis]);
      return true;
    };

    const answer = (query: string) => {
      const { hits, ms, terms } = search(query, 3);
      if (!hits.length) {
        say([`Nothing matched [${terms.join(" ")}] across ${corpusSize} chunks.`], "err");
        return;
      }
      say([
        `BM25 · ${corpusSize} chunks · query [${terms.join(" ")}] · ${ms.toFixed(1)}ms · no model, no network`,
        ...hits.flatMap((h) => [
          `  ${h.chunk.source}  score ${h.score.toFixed(2)}  on [${h.matched.join(" ")}]`,
          `    ${h.chunk.text}`,
        ]),
      ]);
    };

    // BUY 250 ALGO   ·   SELL 100 BARR @ 243.50
    if (head === "BUY" || head === "SELL") {
      const m = /^(\d+)\s+([A-Z]+)(?:\s*@\s*([\d.]+))?$/.exec(arg);
      if (!m) {
        say(["Format: BUY <qty> <ticker> [@ price]. Try BUY 250 ALGO."], "err");
        return;
      }
      const [, q, sym, px] = m;
      if (!instruments.some((i) => i.ticker === sym)) {
        say([`No instrument ${sym}.`], "err");
        return;
      }
      setActive(sym);
      const res = desk.submit({
        ticker: sym,
        side: head,
        qty: Number(q),
        limit: px ? Number(px) : undefined,
      });
      say(res.lines, res.ok ? "out" : "err");
      return;
    }

    switch (head) {
      case "HELP":
      case "?":
        say([
          "DES <TICKER>  load an instrument      MDX BARR ALGO RAG",
          "BUY / SELL    BUY 250 ALGO · SELL 100 BARR @ 243.50",
          "POS           positions, working orders and P&L",
          "FLAT          close everything at market",
          "CXL [id]      cancel a working order, or all of them",
          "ASK <words>   BM25 retrieval over the CV — no LLM, no network",
          "CANDLE LINE   switch the chart type",
          "MC            jump to the option desk",
          "BLT           trade blotter — roles and degrees",
          "BOOK          module marks",
          "STACK         languages and tooling",
          "BIO           who is behind this terminal",
          "CV            open the PDF",
          "GH LI MAIL    github · linkedin · email",
          "BLOG          written notes",
          "CLEAR         wipe this log",
        ]);
        break;
      case "DES":
        if (!arg) say(["DES needs a ticker. Try DES ALGO."], "err");
        else if (!pick(arg)) say([`No instrument ${arg}. Loaded: MDX BARR ALGO RAG.`], "err");
        break;
      case "POS": {
        scrollTo("desk");
        const open = Object.entries(desk.positions).filter(([, p]) => p.qty !== 0);
        say([
          `Net liq ${fmt(desk.nlv, 0)} · session P&L ${signed(desk.pnl, 0)} (realised ${signed(desk.realized, 0)}, open ${signed(desk.openPnl, 0)})`,
          ...(open.length
            ? open.map(
                ([sym, p]) =>
                  `${sym.padEnd(6)} ${p.qty > 0 ? "+" : ""}${p.qty} @ ${fmt(p.avgPx)} · mark ${fmt(markPrices[sym] ?? p.avgPx)}`,
              )
            : ["Flat."]),
          ...desk.resting.map(
            (o) => `working #${o.id} ${o.side} ${o.qty} ${o.ticker} @ ${fmt(o.px)}`,
          ),
        ]);
        break;
      }
      case "FLAT": {
        const r = desk.flatten();
        say(r.lines);
        break;
      }
      case "CXL":
      case "CANCEL": {
        const r = desk.cancel(arg ? Number(arg) : undefined);
        say(r.lines);
        break;
      }
      case "ASK":
        if (!arg) say(["ASK takes a question. Try ASK how did you reduce latency."], "err");
        else answer(arg);
        break;
      case "CANDLE":
      case "LINE":
        setChartMode(head === "CANDLE" ? "candle" : "line");
        scrollTo("inst");
        say([`Chart set to ${head.toLowerCase()}.`]);
        break;
      case "MC":
      case "PRICER":
        scrollTo("pricer");
        say(["Option desk — down-and-out call, analytic against Monte Carlo."]);
        break;
      case "BLT":
      case "BLOTTER":
        scrollTo("blotter");
        say(["Blotter loaded. Two positions open."]);
        break;
      case "BOOK":
        scrollTo("book");
        say(["BSc module marks, Brunel. Average 82%, First Class."]);
        break;
      case "STACK":
        scrollTo("stack");
        say(stack.map((g) => `${g.group.padEnd(16)} ${g.items.join(" · ")}`));
        break;
      case "BIO":
      case "WHOAMI":
        say([`${profile.name} — ${profile.role}`, ...profile.bio]);
        break;
      case "CV":
        window.open(links.cv, "_blank", "noopener");
        say(["Opening cv.pdf."]);
        break;
      case "GH":
        window.open(links.github, "_blank", "noopener");
        say(["Opening GitHub."]);
        break;
      case "LI":
        window.open(links.linkedin, "_blank", "noopener");
        say(["Opening LinkedIn."]);
        break;
      case "MAIL":
        window.location.href = `mailto:${links.email}`;
        say([links.email]);
        break;
      case "BLOG":
        window.location.href = "/blog";
        break;
      case "CLEAR":
        setLog([]);
        return;
      default:
        if (pick(head)) break;
        // Anything conversational falls through to retrieval rather than
        // scolding the visitor for not knowing the command set.
        if (rest.length > 0) answer(input);
        else say([`${head} is not a command. Type HELP, or ASK a question.`], "err");
    }
  };

  // Global shortcuts: / or ⌘K to reach the command line, digits to switch tape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= instruments.length) setActive(instruments[n - 1].ticker);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = quotes[instrument.ticker];
  const last = q.bars[q.bars.length - 1].c;
  const chg = changePct(q);
  const chgAbs = last - q.bars[0].o;

  return (
    <div className="trm">
      <div className="shell">
        {/* ---- top bar ---- */}
        <header className="topbar">
          <div className="brand">
            <h1 className="brand-mark">
              SOLTANI<em>·</em>TERMINAL
              <span className="sr-only">
                {" "}
                — {profile.name}, {profile.role}
              </span>
            </h1>
            <span className="brand-sub">{profile.handle} &lt;GO&gt;</span>
          </div>
          <div className="topbar-spacer" />
          <div className="status">
            <span className={`dot${isOpen ? "" : " closed"}`} aria-hidden="true" />
            <span className="status-label">LSE</span>
            <span>{isOpen ? "OPEN" : "CLOSED"}</span>
          </div>
          <div className="status">
            <span className="status-label">{profile.location}</span>
            <span suppressHydrationWarning>{clock ?? "--:--:--"}</span>
          </div>
          <nav className="topnav" aria-label="Sections">
            <a href={links.cv} target="_blank" rel="noopener noreferrer">
              CV
            </a>
            <a href="/blog">Notes</a>
            <a href={links.github} target="_blank" rel="noopener noreferrer">
              GH
            </a>
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer">
              LI
            </a>
            <a href={`mailto:${links.email}`}>Mail</a>
          </nav>
        </header>

        {/* ---- tape ---- */}
        <div className="tape">
          <div className="tape-track">
            {[0, 1].map((copy) => (
              <div key={copy} style={{ display: "flex" }} aria-hidden={copy === 1}>
                {tape.map((t) => {
                  const [tag, ...body] = t.text.split(/\s{2,}/);
                  return (
                    <span className="tape-item" key={`${copy}-${t.text}`}>
                      <span className="tag">{tag}</span>
                      <span className={t.tone ?? "flat"}>{body.join(" ")}</span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ---- panels ---- */}
        <div className="grid">
          {/* left rail — watchlist over identity */}
          <div className="rail a-lrail">
          <section className="pnl" ref={panels.watch} aria-labelledby="h-watch">
            <div className="pnl-h">
              <h2 id="h-watch">Watchlist</h2>
              <span className="sub">180d</span>
              <span className="pnl-code">MON&lt;GO&gt;</span>
            </div>
            <div className="pnl-b flush">
              <div className="wl-head" aria-hidden="true">
                <span>Symbol</span>
                <span>Last</span>
                <span style={{ textAlign: "right" }}>Chg</span>
              </div>
              {instruments.map((inst, i) => {
                const qq = quotes[inst.ticker];
                const px = qq.bars[qq.bars.length - 1].c;
                const pct = changePct(qq);
                return (
                  <button
                    type="button"
                    key={inst.ticker}
                    className="wl-row"
                    aria-pressed={inst.ticker === active}
                    onClick={() => setActive(inst.ticker)}
                  >
                    <span className="wl-tick">
                      <span className="wl-key">{i + 1}</span>
                      <span className="wl-sym">{inst.ticker}</span>
                    </span>
                    <span
                      className={`wl-px ${qq.flash ? `tick-${qq.flash}` : ""}`}
                      key={`${inst.ticker}-${qq.seq}`}
                    >
                      {fmt(px)}
                    </span>
                    <span className={`wl-chg ${pct >= 0 ? "up" : "down"}`}>
                      {signed(pct)}%
                    </span>
                    <span className="wl-name">{inst.name}</span>
                  </button>
                );
              })}
              <p className="book-foot">
                Press <span className="kbd">1</span>–<span className="kbd">{instruments.length}</span>{" "}
                to switch.
              </p>
            </div>
          </section>

          <section className="pnl" aria-labelledby="h-id">
            <div className="pnl-h">
              <h2 id="h-id">Operator</h2>
              <span className="pnl-code">BIO&lt;GO&gt;</span>
            </div>
            <div className="id-b">
              <div>
                <div className="id-name">{profile.name}</div>
                <div className="id-role">{profile.roleShort}</div>
              </div>
              {profile.bio.map((para) => (
                <p key={para.slice(0, 32)}>{para}</p>
              ))}
              <div className="id-meta">
                <span>{profile.location} · {profile.timezone}</span>
                <span>{profile.interests}</span>
              </div>
            </div>
          </section>
          </div>

          {/* instrument */}
          <section className="pnl a-inst" ref={panels.inst} aria-labelledby="h-inst">
            <div className="pnl-h">
              <h2 id="h-inst">Instrument</h2>
              <span className="sub">{instrument.klass}</span>
              <div className="seg" role="group" aria-label="Chart type">
                {(["candle", "line"] as ChartMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={chartMode === m}
                    onClick={() => setChartMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <span className="pnl-code">GP&lt;GO&gt;</span>
            </div>

            <div className="inst-head">
              <div className="inst-id">
                <div className="inst-sym">
                  <h3>{instrument.ticker}</h3>
                  <span className="inst-name">{instrument.name}</span>
                  <span className={`chip ${instrument.status.toLowerCase()}`}>
                    {instrument.status}
                  </span>
                  <span className="chip">{instrument.since}</span>
                </div>
                <p className="inst-thesis">{instrument.thesis}</p>
              </div>
              <div className="inst-quote">
                <div className="inst-px">{fmt(last)}</div>
                <div className={`inst-chg ${chg >= 0 ? "up" : "down"}`}>
                  {signed(chgAbs)} ({signed(chg)}%)
                </div>
              </div>
            </div>

            <PriceChart
              key={instrument.ticker}
              bars={q.bars}
              mode={chartMode}
              tone={chg >= 0 ? "up" : "down"}
              label={instrument.ticker}
            />

            <dl className="metrics">
              {instrument.metrics.map((m) => (
                <div className="metric" key={m.label}>
                  <dt>{m.label}</dt>
                  <dd className={m.tone ?? "flat"}>{m.value}</dd>
                </div>
              ))}
            </dl>

            <div className="inst-copy">
              {instrument.detail.map((para) => (
                <p key={para.slice(0, 40)}>{para}</p>
              ))}
            </div>

            <div className="inst-foot">
              {instrument.stack.map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
              {instrument.href && (
                <a className="link-btn" href={instrument.href}>
                  Full write-up →
                </a>
              )}
              {instrument.ticker === "BARR" && (
                <a
                  className="link-btn"
                  href={links.streamlit}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Live dashboard ↗
                </a>
              )}
            </div>
          </section>

          {/* right rail — marks over stack */}
          <div className="rail a-rrail">
          <section className="pnl" ref={panels.book} aria-labelledby="h-book">
            <div className="pnl-h">
              <h2 id="h-book">Book</h2>
              <span className="sub">BSc marks · scaled 70–100</span>
              <span className="pnl-code">EDU&lt;GO&gt;</span>
            </div>
            <div className="pnl-b flush">
              {book.map((row) => (
                <div className="book-row" key={row.module}>
                  {/* Scaled from 70, not 0 — every mark here is a first, so a
                      0-100 bar makes 80 and 98 look identical. */}
                  <span className="book-track" aria-hidden="true">
                    <i style={{ width: `${((row.mark - 70) / 30) * 100}%` }} />
                  </span>
                  <span>{row.module}</span>
                  <span className="book-mark">{row.mark}</span>
                </div>
              ))}
              <p className="book-foot">
                Brunel University London · average 82% · First Class Honours
              </p>
            </div>
          </section>

          <section className="pnl" ref={panels.stack} aria-labelledby="h-stack">
            <div className="pnl-h">
              <h2 id="h-stack">Stack</h2>
              <span className="pnl-code">SKL&lt;GO&gt;</span>
            </div>
            <div className="pnl-b flush">
              {stack.map((group) => (
                <div className="stack-group" key={group.group}>
                  <h3>{group.group}</h3>
                  <div className="stack-tags">
                    {group.items.map((item) => (
                      <span className="tag" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="stack-group">
                <h3>Spoken</h3>
                <p className="muted" style={{ fontSize: 11 }}>
                  {profile.languages}
                </p>
              </div>
            </div>
          </section>
          </div>

          {/* trading desk */}
          <section className="pnl a-desk" ref={panels.desk} aria-labelledby="h-desk">
            <div className="pnl-h">
              <h2 id="h-desk">Order entry</h2>
              <span className="sub">{active} · paper</span>
              <span className="pnl-code">TKT&lt;GO&gt;</span>
            </div>
            <TradeDesk
              ticker={active}
              mark={marks[active].mark}
              seed={marks[active].seed}
              positions={desk.positions}
              resting={desk.resting}
              executions={desk.executions}
              cash={desk.cash}
              nlv={desk.nlv}
              pnl={desk.pnl}
              realized={desk.realized}
              openPnl={desk.openPnl}
              marks={markPrices}
              onSubmit={desk.submit}
              onCancel={desk.cancel}
              onFlatten={desk.flatten}
            />
          </section>

          {/* pricer — the signature panel */}
          <section className="pnl a-pricer" ref={panels.pricer} aria-labelledby="h-pricer">
            <div className="pnl-h">
              <h2 id="h-pricer">Option desk</h2>
              <span className="sub">Down-and-out call · live</span>
              <span className="pnl-code">OVME&lt;GO&gt;</span>
            </div>
            <Pricer />
          </section>

          {/* blotter */}
          <section className="pnl a-blotter" ref={panels.blotter} aria-labelledby="h-blotter">
            <div className="pnl-h">
              <h2 id="h-blotter">Blotter</h2>
              <span className="sub">Roles &amp; degrees</span>
              <span className="pnl-code">BLT&lt;GO&gt;</span>
            </div>
            <div className="pnl-b flush">
              <div className="bl-head" aria-hidden="true">
                <span>Code</span>
                <span>Description</span>
                <span>Venue</span>
                <span className="bl-gap" />
                <span>Period</span>
                <span style={{ textAlign: "right" }}>Result</span>
                <span />
              </div>
              {positions.map((pos) => {
                const open = pos.closed === null;
                const expanded = openRow === pos.code;
                return (
                  <div key={pos.code}>
                    <button
                      type="button"
                      className="bl-row"
                      aria-expanded={expanded}
                      onClick={() => setOpenRow(expanded ? null : pos.code)}
                    >
                      <span className="bl-code">{pos.code}</span>
                      <span className="bl-desc">{pos.desc}</span>
                      <span className="bl-venue">{pos.venue}</span>
                      <span className="bl-gap" />
                      <span className="bl-dates">
                        {pos.opened} → {open ? <span className="up">open</span> : pos.closed}
                      </span>
                      <span className={`bl-pnl ${pos.tone}`}>{pos.headline}</span>
                      <span className="bl-caret" aria-hidden="true">
                        ›
                      </span>
                    </button>
                    {expanded && (
                      <ul className="bl-notes">
                        {pos.notes.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

        </div>

        <div className="shell-fill" aria-hidden="true" />

        {/* ---- command line ---- */}
        <div className="cmd">
          <div className="cmd-log" ref={logRef} aria-live="polite" aria-atomic="false">
            {log.map((line, i) => (
              <div key={`${i}-${line.text.slice(0, 24)}`} className={line.kind}>
                {line.text}
              </div>
            ))}
          </div>
          <form
            className="cmd-bar"
            onSubmit={(e) => {
              e.preventDefault();
              run(entry);
              setEntry("");
            }}
          >
            <span className="cmd-prompt" aria-hidden="true">
              {profile.handle} ›
            </span>
            <input
              ref={inputRef}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="Type HELP and press enter"
              aria-label="Terminal command"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="cmd-chips">
              {["HELP", "BUY 250 ALGO", "ASK barrier options", "POS", "CV"].map((c) => (
                <button key={c} type="button" onClick={() => run(c)}>
                  {c}
                </button>
              ))}
            </div>
            <span className="cmd-hint">
              <span className="kbd">/</span> to focus · <span className="kbd">⌘K</span>
            </span>
          </form>
        </div>

        <footer className="trm-foot">
          <span>{profile.name}</span>
          <span className="sep">│</span>
          <span>{profile.role}</span>
          <span className="sep">│</span>
          <a href={`mailto:${links.email}`}>{links.email}</a>
          <span className="sep">│</span>
          <span>Quotes are seeded simulations, not market data.</span>
        </footer>
      </div>
    </div>
  );
}
