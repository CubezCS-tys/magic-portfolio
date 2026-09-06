"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { card, links, profile } from "@/resources/terminal";
import { Num } from "./Num";
import { fmt, gbmBars, mulberry32, signed } from "./quant";
import "./terminal.css";

/**
 * The tap card.
 *
 * Reached by tapping an aluminium NFC card, so the working assumption is a
 * phone held by someone who met him ninety seconds ago: portrait, one thumb,
 * possibly poor signal, and about twenty seconds of attention. Everything is
 * a single column with 44px tap targets, and the two links that matter —
 * LinkedIn and GitHub — sit above the fold on a small handset.
 *
 * The trading is real in the sense that matters here: the quote is a genuine
 * GBM walk and the position P&L is computed off it, disclosed as simulated in
 * the footer the same way the terminal's charts are.
 */

const POINTS = 56;
const TICK_MS = 700;
/** Per-tick vol, tuned so a twelve-second position actually moves. */
const TICK_VOL = 0.0034;
const HOLD_MS = 12_000;

/** Seeded history, so the server and the first client paint agree exactly. */
function seedSeries(): number[] {
  const { base, drift, sigma, seed } = card.sim;
  return gbmBars(base, drift, sigma, POINTS, seed, 1).map((b) => b.c);
}

/** Box–Muller off a seeded generator. Client-only, after hydration. */
function gaussian(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

type Side = "long" | "short";
type Egg = { phase: "hidden" } | { phase: "armed" } | { phase: "open"; side: Side; entry: number; until: number } | { phase: "settled"; side: Side; entry: number; exit: number };

export function Card() {
  const [series, setSeries] = useState<number[]>(seedSeries);
  const [now, setNow] = useState<string | null>(null);
  const [egg, setEgg] = useState<Egg>({ phase: "hidden" });
  const [hint, setHint] = useState(false);
  const [left, setLeft] = useState(0);

  const px = series[series.length - 1];
  const open = series[0];
  const change = ((px - open) / open) * 100;

  // ---- live quote -------------------------------------------------------
  useEffect(() => {
    const rand = mulberry32((Date.now() ^ 0x9e37) >>> 0);
    const id = setInterval(() => {
      setSeries((s) => {
        const last = s[s.length - 1];
        // Rounded to a cent each step, the same discipline the charts use.
        const next = Math.round(last * Math.exp(-0.5 * TICK_VOL ** 2 + TICK_VOL * gaussian(rand)) * 100) / 100;
        return [...s.slice(1), next];
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // ---- London clock -----------------------------------------------------
  useEffect(() => {
    const paint = () =>
      setNow(
        new Date().toLocaleTimeString("en-GB", {
          timeZone: profile.timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    paint();
    const id = setInterval(paint, 1000);
    return () => clearInterval(id);
  }, []);

  // The egg has to be findable by a stranger in one conversation, so the
  // prompt surfaces itself after a few seconds rather than staying secret.
  useEffect(() => {
    const id = setTimeout(() => setHint(true), 6500);
    return () => clearTimeout(id);
  }, []);

  // ---- the position -----------------------------------------------------
  useEffect(() => {
    if (egg.phase !== "open") return;
    const id = setInterval(() => {
      const ms = egg.until - Date.now();
      if (ms <= 0) {
        setLeft(0);
        setEgg({ phase: "settled", side: egg.side, entry: egg.entry, exit: px });
      } else {
        setLeft(Math.ceil(ms / 1000));
      }
    }, 200);
    return () => clearInterval(id);
  }, [egg, px]);

  const taps = useRef<number[]>([]);
  const onQuoteTap = useCallback(() => {
    if (egg.phase !== "hidden") return;
    const t = Date.now();
    taps.current = [...taps.current, t].filter((x) => t - x < 3000);
    if (taps.current.length >= 3) {
      taps.current = [];
      setEgg({ phase: "armed" });
    }
  }, [egg.phase]);

  const take = (side: Side) => {
    setLeft(HOLD_MS / 1000);
    setEgg({ phase: "open", side, entry: px, until: Date.now() + HOLD_MS });
  };

  const pnl =
    egg.phase === "open"
      ? ((px - egg.entry) / egg.entry) * 100 * (egg.side === "long" ? 1 : -1)
      : egg.phase === "settled"
        ? ((egg.exit - egg.entry) / egg.entry) * 100 * (egg.side === "long" ? 1 : -1)
        : 0;

  const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "flat");

  return (
    <div className="trm card">
      <Handshake />

      <main className="card-body">
        <header className="c-head">
          <div className="c-portrait">
            <Image src="/images/avatar.jpg" alt={profile.name} width={132} height={132} priority />
            <span className="c-scan" aria-hidden="true" />
            <span className="c-bracket c-tl" aria-hidden="true" />
            <span className="c-bracket c-tr" aria-hidden="true" />
            <span className="c-bracket c-bl" aria-hidden="true" />
            <span className="c-bracket c-br" aria-hidden="true" />
          </div>

          <div className="c-id">
            <p className="c-eyebrow">
              <span className="c-dot" aria-hidden="true" />
              {profile.handle} · VERIFIED
            </p>
            <h1 className="c-name">{profile.name}</h1>
          </div>

          {/* Status and location run the full width — in the column beside an
              84px portrait they wrapped to three lines and stopped scanning. */}
          <p className="c-status">{card.status}</p>
          <p className="c-where">
            {profile.location} <span aria-hidden="true">·</span>{" "}
            <time suppressHydrationWarning>{now ?? "--:--:--"}</time>{" "}
            <span aria-hidden="true">·</span> {profile.languages}
          </p>
        </header>

        <section className="c-quote" aria-label="Simulated quote">
          <button
            type="button"
            className="c-qtap"
            onClick={onQuoteTap}
            aria-label={`TYS ${fmt(px)}, ${signed(change)} percent. Tap three times to open a position.`}
          >
            <span className="c-qhead">
              <b>TYS</b>
              <i>SOLTANI · SIM</i>
            </span>
            <span className="c-qpx">
              <Num value={px} ms={TICK_MS} />
              <em data-tone={tone(change)}>
                <Num value={change} sign ms={TICK_MS} suffix="%" />
              </em>
            </span>
            <Spark values={series} up={change >= 0} />
            {egg.phase === "hidden" && hint && <span className="c-hint">TAP ×3</span>}
          </button>

          {egg.phase !== "hidden" && (
            <div className="c-egg" data-phase={egg.phase}>
              {egg.phase === "armed" && (
                <>
                  <p className="c-egg-ask">Take a position in me. Twelve seconds.</p>
                  <div className="c-egg-side">
                    <button type="button" data-side="long" onClick={() => take("long")}>
                      BUY
                    </button>
                    <button type="button" data-side="short" onClick={() => take("short")}>
                      SELL
                    </button>
                  </div>
                </>
              )}

              {egg.phase === "open" && (
                <>
                  <dl className="c-egg-row">
                    <div>
                      <dt>SIDE</dt>
                      <dd>{egg.side === "long" ? "LONG" : "SHORT"}</dd>
                    </div>
                    <div>
                      <dt>ENTRY</dt>
                      <dd>{fmt(egg.entry)}</dd>
                    </div>
                    <div>
                      <dt>P&L</dt>
                      <dd data-tone={tone(pnl)}>
                        <Num value={pnl} sign ms={TICK_MS} suffix="%" />
                      </dd>
                    </div>
                  </dl>
                  <p className="c-egg-clock">
                    <span className="c-egg-bar" style={{ animationDuration: `${HOLD_MS}ms` }} />
                    {left}s TO CLOSE
                  </p>
                </>
              )}

              {egg.phase === "settled" && (
                <>
                  <p className="c-egg-fill">
                    {egg.side === "long" ? "LONG" : "SHORT"} TYS {fmt(egg.entry)} →{" "}
                    {fmt(egg.exit)} <b data-tone={tone(pnl)}>{signed(pnl)}%</b>
                  </p>
                  <p className="c-egg-line">{verdict(egg.side, pnl)}</p>
                  <button
                    type="button"
                    className="c-egg-again"
                    onClick={() => setEgg({ phase: "armed" })}
                  >
                    RUN IT BACK
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        <section className="c-about">
          <h2 className="c-h">WHO</h2>
          {card.summary.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>

        <section className="c-vitals" aria-label="Headline figures">
          <h2 className="c-h">BOOK</h2>
          <dl>
            {card.vitals.map((v) => (
              <div key={v.label}>
                <dt>{v.label}</dt>
                <dd>{v.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <nav className="c-actions" aria-label="Contact">
          <h2 className="c-h">CONNECT</h2>
          <a className="c-act c-primary" href={links.linkedin} target="_blank" rel="noreferrer">
            <span>LinkedIn</span>
            <i>yassine-soltani</i>
          </a>
          <a className="c-act c-primary" href={links.github} target="_blank" rel="noreferrer">
            <span>GitHub</span>
            <i>CubezCS-tys</i>
          </a>
          <div className="c-act-row">
            <a className="c-act" href={`mailto:${links.email}`}>
              <span>Email</span>
            </a>
            <a className="c-act" href={links.cv} target="_blank" rel="noreferrer">
              <span>CV</span>
            </a>
            <a className="c-act" href="/contact.vcf" download>
              <span>Save contact</span>
            </a>
          </div>
        </nav>

        <footer className="c-foot">
          <a className="c-term" href="/">
            OPEN THE FULL TERMINAL <span aria-hidden="true">→</span>
          </a>
          <p>
            TYS is a simulated instrument — a seeded geometric Brownian motion, not a listed
            security. Every figure above traces back to the CV.
          </p>
        </footer>
      </main>
    </div>
  );
}

function verdict(side: Side, pnl: number): string {
  if (side === "long") {
    return pnl >= 0
      ? "Good call. Most people wait until they've read the CV."
      : "Drawdown is temporary. Max drawdown on the real book is 12%.";
  }
  return pnl >= 0
    ? "Bold, and you were right. I'd like to hear the thesis."
    : "You shorted me and it went against you. Let's call that a lesson.";
}

/** Sparkline over the visible window. Autoscaled, so small moves still read. */
function Spark({ values, up }: { values: number[]; up: boolean }) {
  const w = 280;
  const h = 44;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - lo) / span) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg className="c-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <title>TYS session</title>
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} data-tone={up ? "up" : "down"} />
      <polyline points={pts.join(" ")} data-tone={up ? "up" : "down"} />
    </svg>
  );
}

/**
 * How the card was reached. The physical cards carry ?ref=nfc on the chip and
 * ?ref=qr on the printed code, so the page can name the medium it arrived
 * through; the bare URL printed on the card gets the neutral wording.
 *
 * Read from the URL after mount rather than through searchParams, because
 * touching those on the server would make a statically prerendered page
 * dynamic for the sake of two words.
 */
const ARRIVALS: Record<string, [string, string]> = {
  nfc: ["NFC LINK", "ESTABLISHED"],
  qr: ["OPTICAL SCAN", "DECODED"],
};
const ARRIVAL_DEFAULT: [string, string] = ["SESSION", "OPEN"];

/**
 * The tap handshake. CSS-driven so it finishes even if hydration stalls, and
 * short — a second and a bit — because someone is watching over your shoulder.
 */
function Handshake() {
  const host = useRef<HTMLDivElement | null>(null);
  const [[lead, confirm], setArrival] = useState<[string, string]>(ARRIVAL_DEFAULT);
  const skip = () => host.current?.setAttribute("data-skip", "");

  useEffect(() => {
    const via = new URLSearchParams(window.location.search).get("ref");
    // Lands well before the second line fades in at 0.5s, so the swap is unseen.
    if (via && ARRIVALS[via]) setArrival(ARRIVALS[via]);
    window.addEventListener("keydown", skip, { once: true });
    return () => window.removeEventListener("keydown", skip);
  }, []);

  return (
    <div className="card-link" ref={host} aria-hidden="true" role="presentation" onClick={skip}>
      <div className="cl-inner">
        <span className="cl-ring" />
        <p className="cl-a">{lead}</p>
        <p className="cl-b">{confirm}</p>
        <span className="cl-sweep" />
      </div>
    </div>
  );
}
