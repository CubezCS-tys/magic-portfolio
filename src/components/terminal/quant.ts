/**
 * Pricing primitives for the terminal's option desk.
 *
 * Everything here is exact closed form or plain Monte Carlo — no dependencies,
 * so it runs in the browser on every slider drag.
 */

/** Standard normal CDF. Abramowitz & Stegun 26.2.17, |error| < 7.5e-8. */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Standard normal PDF. */
export function normPdf(x: number): number {
  return 0.3989422804014327 * Math.exp((-x * x) / 2);
}

export type Greeks = {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
};

/** Black–Scholes European call, no dividends. */
export function bsCall(S: number, K: number, r: number, sigma: number, T: number): number {
  if (T <= 0) return Math.max(S - K, 0);
  if (sigma <= 0) return Math.max(S - K * Math.exp(-r * T), 0);
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / sq;
  const d2 = d1 - sq;
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

/** Black–Scholes call price plus first-order sensitivities. Theta is per year. */
export function bsCallGreeks(
  S: number,
  K: number,
  r: number,
  sigma: number,
  T: number,
): Greeks {
  if (T <= 0 || sigma <= 0) {
    return { price: Math.max(S - K, 0), delta: S > K ? 1 : 0, gamma: 0, vega: 0, theta: 0 };
  }
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / sq;
  const d2 = d1 - sq;
  const disc = Math.exp(-r * T);
  return {
    price: S * normCdf(d1) - K * disc * normCdf(d2),
    delta: normCdf(d1),
    gamma: normPdf(d1) / (S * sq),
    vega: S * normPdf(d1) * Math.sqrt(T),
    theta: -(S * normPdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * disc * normCdf(d2),
  };
}

/**
 * Continuously-monitored down-and-out call, zero rebate, barrier B <= K.
 *
 * Image solution: V(S) = C(S) - (B/S)^a * C(B^2/S) with a = 2r/sigma^2 - 1,
 * which vanishes at S = B as the knock-out condition requires.
 */
export function downAndOutCall(
  S: number,
  K: number,
  B: number,
  r: number,
  sigma: number,
  T: number,
): number {
  if (S <= B) return 0;
  if (T <= 0) return Math.max(S - K, 0);
  const a = (2 * r) / (sigma * sigma) - 1;
  return bsCall(S, K, r, sigma, T) - Math.pow(B / S, a) * bsCall((B * B) / S, K, r, sigma, T);
}

/** Deterministic PRNG so server and client render the same first frame. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box–Muller draws, one at a time.
 *
 * The transform yields two normals per pair of uniforms, so the second is
 * held for the next call. (Returning a tuple instead measures the same — V8
 * elides the short-lived array — but every caller wanted one draw at a time
 * and was hand-rolling its own spare-handling to get it.)
 */
function gaussian(rand: () => number): () => number {
  let spare = 0;
  let hasSpare = false;
  return () => {
    if (hasSpare) {
      hasSpare = false;
      return spare;
    }
    let u = rand();
    if (u < 1e-12) u = 1e-12;
    const v = rand();
    const rad = Math.sqrt(-2 * Math.log(u));
    const ang = 2 * Math.PI * v;
    spare = rad * Math.sin(ang);
    hasSpare = true;
    return rad * Math.cos(ang);
  };
}

export type McInput = {
  S: number;
  K: number;
  B: number;
  r: number;
  sigma: number;
  T: number;
  paths: number;
  steps: number;
  antithetic: boolean;
  seed: number;
  /** How many full trajectories to retain for the chart. */
  keepPaths?: number;
};

export type McPath = {
  points: number[];
  knockedOut: boolean;
  /** Step index where the barrier was breached, or -1. */
  outAt: number;
};

export type McResult = {
  price: number;
  stdError: number;
  ci: [number, number];
  knockOutRate: number;
  paths: number;
  sample: McPath[];
  elapsedMs: number;
};

/**
 * Discretely-monitored down-and-out call by simulation.
 *
 * The GBM step is exact, but monitoring only at step boundaries misses paths
 * that dip below B and recover between observations, so this sits above the
 * continuous closed form. That gap is the discrete-monitoring bias, and it
 * shrinks like 1/sqrt(steps).
 */
export function mcDownAndOutCall(input: McInput): McResult {
  const { S, K, B, r, sigma, T, steps, antithetic, seed } = input;
  const keepPaths = input.keepPaths ?? 40;
  const started = typeof performance !== "undefined" ? performance.now() : 0;

  // Antithetic sampling consumes draws in +Z / -Z pairs.
  const groups = antithetic ? Math.max(1, Math.floor(input.paths / 2)) : input.paths;
  const perGroup = antithetic ? 2 : 1;
  const total = groups * perGroup;

  const dt = T / steps;
  const drift = (r - (sigma * sigma) / 2) * dt;
  const vol = sigma * Math.sqrt(dt);
  const disc = Math.exp(-r * T);
  const nextZ = gaussian(mulberry32(seed));

  let sum = 0;
  let sumSq = 0;
  let knocked = 0;
  const sample: McPath[] = [];

  // Reused across groups to avoid reallocating per path.
  const normals = new Float64Array(steps);

  for (let g = 0; g < groups; g++) {
    for (let i = 0; i < steps; i++) normals[i] = nextZ();

    for (let leg = 0; leg < perGroup; leg++) {
      const sign = leg === 0 ? 1 : -1;
      const keep = sample.length < keepPaths;
      const points: number[] = keep ? [S] : [];

      let s = S;
      let out = false;
      let outAt = -1;

      for (let i = 0; i < steps; i++) {
        s = s * Math.exp(drift + vol * sign * normals[i]);
        if (keep) points.push(s);
        if (!out && s <= B) {
          out = true;
          outAt = i + 1;
          if (!keep) break;
        }
      }

      const payoff = out ? 0 : Math.max(s - K, 0);
      const value = disc * payoff;
      sum += value;
      sumSq += value * value;
      if (out) knocked++;
      if (keep) sample.push({ points, knockedOut: out, outAt });
    }
  }

  const mean = sum / total;
  // Sample variance, guarded against float noise driving it negative.
  const variance = Math.max(0, sumSq / total - mean * mean) * (total / Math.max(1, total - 1));
  const stdError = Math.sqrt(variance / total);

  return {
    price: mean,
    stdError,
    ci: [mean - 1.96 * stdError, mean + 1.96 * stdError],
    knockOutRate: knocked / total,
    paths: total,
    sample,
    elapsedMs: (typeof performance !== "undefined" ? performance.now() : 0) - started,
  };
}

/** Prices to the nearest cent. */
export const toCents = (x: number): number => Math.round(x * 100) / 100;

export type Bar = { o: number; h: number; l: number; c: number };

/**
 * Seeded OHLC sessions from geometric Brownian motion.
 * Labelled as a simulation wherever it is drawn — these are not real quotes.
 *
 * Highs and lows come from walking `intraday` sub-steps inside each session
 * rather than being jittered around the close, so the wicks are consistent
 * with the path that produced them.
 *
 * Each step is rounded to a cent before it feeds the next one. V8 in Node and
 * V8 in the browser can disagree on the last bit of Math.exp, and without this
 * the two would drift apart and break hydration; rounding resyncs every step.
 */
export function gbmBars(
  base: number,
  drift: number,
  sigma: number,
  sessions: number,
  seed: number,
  intraday = 6,
): Bar[] {
  const rand = mulberry32(seed);
  const dt = 1 / 252 / intraday;
  const mu = (drift - (sigma * sigma) / 2) * dt;
  const vol = sigma * Math.sqrt(dt);

  const nextZ = gaussian(rand);
  const bars: Bar[] = [];
  let s = toCents(base);
  for (let i = 0; i < sessions; i++) {
    const o = s;
    let h = o;
    let l = o;
    for (let k = 0; k < intraday; k++) {
      s = toCents(s * Math.exp(mu + vol * nextZ()));
      if (s > h) h = s;
      if (s < l) l = s;
    }
    bars.push({ o, h, l, c: s });
  }
  return bars;
}

export function fmt(n: number, dp = 2): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function signed(n: number, dp = 2): string {
  return `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n), dp)}`;
}
