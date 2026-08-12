/**
 * Terminal content. Every figure here traces back to the CV at /cv.pdf.
 * Instruments are projects, positions are roles and degrees, the book is
 * real module marks.
 */

export type Metric = {
  label: string;
  value: string;
  tone?: "up" | "down" | "flat";
};

export type Instrument = {
  ticker: string;
  name: string;
  klass: string;
  status: "LIVE" | "RESEARCH" | "BUILD";
  since: string;
  /** One line, shown under the ticker in the detail header. */
  thesis: string;
  detail: string[];
  metrics: Metric[];
  stack: string[];
  href?: string;
  /** Simulation parameters for the instrument chart. */
  sim: { base: number; drift: number; sigma: number; seed: number };
};

const defs: Instrument[] = [
  {
    ticker: "MDX",
    name: "Mikon Derivatives Exchange",
    klass: "MARKET STRUCTURE",
    status: "RESEARCH",
    since: "2026",
    thesis: "Standardising exotic payoffs so a CCP can clear them.",
    detail: [
      "Exotic derivatives sit almost entirely off-exchange because their payoffs are bespoke, and bespoke payoffs cannot be margined by a central counterparty. That bifurcation between cleared and OTC markets is the problem this work attacks.",
      "The proposed design restricts payoff flexibility and enforces parameter grids — strike, barrier, and maturity snapped to standard levels — so an exotic becomes fungible enough to clear. An RFQ layer preserves competitive pricing for the resulting contracts without giving up the risk discipline that clearing demands.",
      "The open question is the liquidity–clearing trade-off: how much structural freedom can be removed before the instrument stops being useful to the people who wanted it bespoke in the first place.",
    ],
    metrics: [
      { label: "MARKET", value: "OTC → CCP", tone: "flat" },
      { label: "MECHANISM", value: "RFQ", tone: "flat" },
      { label: "STAGE", value: "DESIGN", tone: "flat" },
    ],
    stack: ["Market microstructure", "Clearing", "Margin models", "RFQ design"],
    sim: { base: 118.4, drift: 0.22, sigma: 0.31, seed: 8831 },
  },
  {
    ticker: "BARR",
    name: "Barrier Option Pricing Engine",
    klass: "EXOTIC DERIVATIVES",
    status: "LIVE",
    since: "2024",
    thesis: "Analytic, lattice and Monte Carlo pricers, benchmarked against QuantLib.",
    detail: [
      "A full pricing stack for barrier options built three independent ways — closed-form solutions, finite-difference schemes (forward Euler, backward Euler, Crank–Nicolson), and Monte Carlo — with every result cross-checked against QuantLib to catch anomalies rather than trusting a single implementation.",
      "Variance reduction did the heavy lifting on the simulation side. Antithetic variates paired with control variates cut the paths needed for a 95% confidence interval by roughly 40%, which is the difference between a dashboard that responds and one that spins.",
      "The lattice work produced the sharpest result: an adaptive binomial mesh that refines the grid near the barrier priced 83% more accurately than a uniform binomial tree. Discontinuous payoffs punish uniform grids precisely where the payoff breaks, and dynamic refinement is what recovers the accuracy.",
      "Extended to rebates, path-dependent features, stochastic jump diffusions and dynamic barriers, then wrapped in a Streamlit dashboard so the pricers are usable rather than merely correct.",
    ],
    metrics: [
      { label: "MESH ACCURACY", value: "+83%", tone: "up" },
      { label: "PATHS @ 95% CI", value: "−40%", tone: "up" },
      { label: "BENCHMARK", value: "QuantLib", tone: "flat" },
    ],
    stack: ["Python", "QuantLib", "NumPy", "SciPy", "Streamlit", "Crank–Nicolson"],
    href: "/work/pricing-barrier-options-research-computational-finance",
    sim: { base: 204.75, drift: 0.34, sigma: 0.24, seed: 4417 },
  },
  {
    ticker: "ALGO",
    name: "Event-Driven Trading Engine",
    klass: "SYSTEMATIC EQUITY",
    status: "LIVE",
    since: "2024",
    thesis: "US equities, backtested to live routing, Sharpe 1.45 out of sample.",
    detail: [
      "An event-driven trading system for US equities, written for modularity and execution precision. Automated ingestion pipelines run on Linux cron jobs to fetch, sanitise and aggregate five years of daily OHLCV across more than 500 tickers into a high-fidelity SQL history.",
      "Two strategy families were developed and tested: mean-reversion pairs trading and ML-based momentum forecasting. Both were run through survivorship-bias-free data and walk-forward analysis, because a backtest that skips bias mitigation is a marketing document rather than evidence.",
      "Risk management is where the engine earns its keep — dynamic position sizing via the Kelly criterion, volatility scaling, and hard drawdown constraints. Out-of-sample the system returned a Sharpe of 1.45 and a Sortino of 1.90 while holding maximum drawdown to 12%.",
      "The execution layer moved from simulation to live trading through Interactive Brokers, with sub-100ms latency on order routing and real-time state management.",
    ],
    metrics: [
      { label: "SHARPE", value: "1.45", tone: "up" },
      { label: "SORTINO", value: "1.90", tone: "up" },
      { label: "MAX DD", value: "12%", tone: "down" },
      { label: "UNIVERSE", value: "500+", tone: "flat" },
      { label: "ROUTING", value: "<100ms", tone: "up" },
    ],
    stack: ["Python", "Alpaca API", "Interactive Brokers", "SQL", "Kelly criterion", "Linux"],
    href: "/work/algorithmic-trading-engine",
    sim: { base: 145.0, drift: 0.41, sigma: 0.19, seed: 1450 },
  },
  {
    ticker: "RAG",
    name: "Arabic Research RAG Platform",
    klass: "AI INFRASTRUCTURE",
    status: "LIVE",
    since: "2025",
    thesis: "Retrieval over millions of Arabic documents, 2.3× faster.",
    detail: [
      "A retrieval-augmented generation platform powering AI-assisted academic research across millions of Arabic documents, built end to end at Dar Al-Mandumah.",
      "The ingestion side turns unstructured PDFs and raw text into structured JSON, with document chunking, embedding strategy and metadata alignment tuned specifically for retrieval quality — Arabic morphology makes naive chunking noticeably worse than it is in English.",
      "Multiple LLM providers sit behind an abstraction layer covering OpenAI and Google Gemini, supporting model switching, prompt versioning and response consistency across providers rather than hard-wiring the platform to one vendor.",
      "Similarity search runs on distributed vector databases — FAISS and Qdrant — with caching, query batching and parallel retrieval delivering a 2.3× throughput gain and roughly 30% lower latency. Full-stack monitoring tracks latency, token usage, retrieval depth and failure modes so tuning is driven by data.",
    ],
    metrics: [
      { label: "RETRIEVAL", value: "2.3×", tone: "up" },
      { label: "LATENCY", value: "−30%", tone: "up" },
      { label: "CORPUS", value: "millions", tone: "flat" },
    ],
    stack: ["Python", "FastAPI", "FAISS", "Qdrant", "OpenAI", "Gemini", "Docker", "Postgres"],
    sim: { base: 92.3, drift: 0.28, sigma: 0.27, seed: 2309 },
  },
];

/**
 * Display order. ALGO leads because it is the only instrument with hard
 * performance numbers (Sharpe, Sortino, drawdown) — those do more work on a
 * first impression than MDX's qualitative design labels.
 */
const ORDER = ["ALGO", "BARR", "MDX", "RAG"];

export const instruments: Instrument[] = ORDER.map(
  (t) => defs.find((d) => d.ticker === t) as Instrument,
);

export type Position = {
  code: string;
  desc: string;
  venue: string;
  opened: string;
  closed: string | null;
  headline: string;
  tone: "up" | "flat";
  notes: string[];
};

export const positions: Position[] = [
  {
    code: "ENG.AI",
    desc: "Full-Stack AI Engineer (Contractor)",
    venue: "Dar Al-Mandumah",
    opened: "Jun 2025",
    closed: null,
    headline: "2.3× retrieval",
    tone: "up",
    notes: [
      "Built and scaled a RAG platform over millions of Arabic academic documents.",
      "Designed provider-agnostic LLM orchestration across OpenAI and Gemini with prompt versioning.",
      "Engineered distributed vector search on FAISS and Qdrant with caching and query batching.",
      "Shipped monitoring dashboards for latency, token usage, retrieval depth and failure modes.",
    ],
  },
  {
    code: "MSC.FM",
    desc: "MSc Financial Mathematics",
    venue: "King's College London",
    opened: "Sep 2025",
    closed: null,
    headline: "in progress",
    tone: "flat",
    notes: [
      "Risk-neutral valuation, stochastic analysis, numerical methods in finance.",
      "C++ for financial mathematics, machine learning, stochastic control.",
      "Dissertation: numerical methods for stochastic volatility models in derivative pricing.",
    ],
  },
  {
    code: "TA.MATH",
    desc: "Teaching Assistant",
    venue: "Brunel University London",
    opened: "Sep 2023",
    closed: "Apr 2025",
    headline: "150+ students",
    tone: "up",
    notes: [
      "Supported Mathematical Programming, Fundamentals of Mathematics and Statistics.",
      "Led MATLAB and R sessions on numerical computation and stochastic processes.",
      "Gave individual support and formative feedback to over 150 undergraduates.",
    ],
  },
  {
    code: "BSC.MCS",
    desc: "BSc (Hons) Mathematics with Computer Science",
    venue: "Brunel University London",
    opened: "Sep 2022",
    closed: "Jun 2025",
    headline: "First · 82%",
    tone: "up",
    notes: [
      "First Class Honours with an 82% average.",
      "CEDPS Academic Excellence Scholarship.",
      "Institute of Mathematics and its Applications Progression Prize and Student Award.",
    ],
  },
];

/** Real module marks from the BSc — the depth ladder is actual data. */
export const book: { module: string; mark: number }[] = [
  { module: "Calculus", mark: 98 },
  { module: "Numerical Analysis", mark: 98 },
  { module: "Linear Algebra", mark: 91 },
  { module: "Stochastic Processes", mark: 90 },
  { module: "Probability & Statistics", mark: 87 },
  { module: "Artificial Intelligence", mark: 87 },
  { module: "Algorithms", mark: 86 },
  { module: "Numerical Methods", mark: 80 },
];

export const stack: { group: string; items: string[] }[] = [
  {
    group: "Languages",
    items: ["Python", "C++", "Java", "MATLAB", "R", "SQL", "JavaScript", "Git"],
  },
  {
    group: "Libraries",
    items: [
      "PyTorch",
      "TensorFlow",
      "Pandas",
      "NumPy",
      "Scikit-learn",
      "QuantLib",
      "Matplotlib",
    ],
  },
  {
    group: "Infrastructure",
    items: ["FastAPI", "Flask", "Next.js", "Docker", "Postgres", "FAISS", "Qdrant", "Linux"],
  },
];

/** Scrolling tape. Keep each entry short — it moves. */
export const tape: { text: string; tone?: "up" | "down" | "flat" }[] = [
  { text: "ALGO  SHARPE 1.45", tone: "up" },
  { text: "ALGO  SORTINO 1.90", tone: "up" },
  { text: "ALGO  MAX DD 12%", tone: "down" },
  { text: "BARR  ADAPTIVE MESH +83% ACCURACY", tone: "up" },
  { text: "BARR  ANTITHETIC + CONTROL VARIATES −40% PATHS", tone: "up" },
  { text: "RAG  RETRIEVAL 2.3×", tone: "up" },
  { text: "RAG  LATENCY −30%", tone: "up" },
  { text: "EDU  BSc FIRST CLASS 82%", tone: "up" },
  { text: "EDU  MSc FIN MATH · KCL 2026", tone: "flat" },
  { text: "AWD  CEDPS SCHOLARSHIP", tone: "flat" },
  { text: "AWD  IMA PROGRESSION PRIZE", tone: "flat" },
  { text: "ALGO  500+ TICKERS · 5Y OHLCV", tone: "flat" },
  { text: "ALGO  ROUTING <100MS", tone: "up" },
];

export const links = {
  email: "ysolta1969@gmail.com",
  github: "https://github.com/CubezCS-tys",
  linkedin: "https://www.linkedin.com/in/yassine-soltani-1615b620b/",
  streamlit: "https://barrier-options.streamlit.app",
  cv: "/cv.pdf",
};

export const profile = {
  name: "Tahar Yassine Soltani",
  handle: "TYS",
  role: "Quantitative Developer · AI Engineer",
  /* Rail-width variant; the long form stays in metadata and on /about. */
  roleShort: "Quant Dev · AI Engineer",
  location: "London",
  timezone: "Europe/London",
  languages: "English (fluent) · French · Arabic",
  bio: [
    "MSc Financial Mathematics at King's College London, following a First Class BSc in Mathematics with Computer Science at Brunel.",
    "I build the computational side of finance: derivative pricers that agree with QuantLib, trading systems that survive walk-forward testing, and retrieval infrastructure that holds up under load.",
    "Currently contracting as a full-stack AI engineer while researching how exotic derivatives could be standardised enough to clear centrally.",
  ],
  interests: "Hackathons · speedcubing · market microstructure",
};
