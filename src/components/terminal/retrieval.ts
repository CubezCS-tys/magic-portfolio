/**
 * Lexical retrieval over the CV, running entirely in the browser.
 *
 * This is Okapi BM25 — the sparse half of a hybrid retrieval stack. There is
 * no model and no API call here, which is the point: the ranking is fully
 * inspectable, every score decomposes into per-term contributions, and it
 * costs nothing to run. The dense half (FAISS/Qdrant embeddings) is what sits
 * behind the production RAG platform described in the RAG instrument.
 */

import { book, instruments, positions, profile, stack } from "@/resources/terminal";

export type Chunk = { id: number; source: string; text: string };

export type Hit = {
  chunk: Chunk;
  score: number;
  /** Query terms that actually matched, best contribution first. */
  matched: string[];
};

const STOP = new Set([
  "a","an","and","are","as","at","be","been","but","by","can","did","do","does","for","from",
  "had","has","have","he","her","his","how","i","if","in","into","is","it","its","of","on","or",
  "s","she","so","than","that","the","their","them","then","there","these","they","this","to",
  "was","we","were","what","when","where","which","who","why","will","with","you","your",
]);

/** Cheap suffix stripping. Not Porter, but enough to join plurals to singulars. */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s\-.]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

/** Shorthand a quant would type, mapped onto the vocabulary of the corpus. */
const EXPANSIONS: Record<string, string[]> = {
  vol: ["volatility"],
  ml: ["machine", "learning"],
  pnl: ["sharpe", "drawdown", "return"],
  hft: ["latency", "execution", "routing"],
  rag: ["retrieval", "augmented", "generation"],
  llm: ["openai", "gemini", "model"],
  uni: ["university", "college"],
  grades: ["mark", "honours", "average"],
  job: ["engineer", "contractor", "role"],
  maths: ["mathematics"],
};

function buildCorpus(): Chunk[] {
  const chunks: Chunk[] = [];
  let id = 0;
  const add = (source: string, text: string) => chunks.push({ id: id++, source, text });

  for (const line of profile.bio) add("PROFILE", line);
  add("PROFILE", `${profile.name}, ${profile.role}, based in ${profile.location}.`);
  add("PROFILE", `Languages spoken: ${profile.languages}. Interests: ${profile.interests}.`);

  for (const inst of instruments) {
    add(inst.ticker, `${inst.name} (${inst.klass}, ${inst.status}, ${inst.since}). ${inst.thesis}`);
    for (const para of inst.detail) add(inst.ticker, para);
    add(inst.ticker, `${inst.name} stack: ${inst.stack.join(", ")}.`);
    add(
      inst.ticker,
      `${inst.name} headline figures: ${inst.metrics.map((m) => `${m.label} ${m.value}`).join(", ")}.`,
    );
  }

  for (const pos of positions) {
    add(
      pos.code,
      `${pos.desc} at ${pos.venue}, ${pos.opened} to ${pos.closed ?? "present"}. ${pos.headline}.`,
    );
    for (const note of pos.notes) add(pos.code, note);
  }

  add("EDU", `Module marks: ${book.map((b) => `${b.module} ${b.mark}%`).join(", ")}.`);
  for (const group of stack) add("STACK", `${group.group}: ${group.items.join(", ")}.`);

  return chunks;
}

const K1 = 1.5;
const B = 0.75;

function buildIndex() {
  const chunks = buildCorpus();
  const docs = chunks.map((c) => tokenize(c.text));
  const lengths = docs.map((d) => d.length);
  const avgdl = lengths.reduce((a, b) => a + b, 0) / docs.length;

  // term -> doc index -> frequency
  const postings = new Map<string, Map<number, number>>();
  docs.forEach((terms, d) => {
    for (const t of terms) {
      let p = postings.get(t);
      if (!p) postings.set(t, (p = new Map()));
      p.set(d, (p.get(d) ?? 0) + 1);
    }
  });

  return { chunks, lengths, avgdl, postings, n: docs.length };
}

const INDEX = buildIndex();

export const corpusSize = INDEX.n;

export function search(query: string, k = 3): { hits: Hit[]; ms: number; terms: string[] } {
  const started = typeof performance !== "undefined" ? performance.now() : 0;

  const base = tokenize(query);
  const expanded = [...base];
  for (const t of base) for (const e of EXPANSIONS[t] ?? []) expanded.push(stem(e));
  const terms = [...new Set(expanded)];

  // score -> per-term contributions, so hits can report why they ranked.
  const scores = new Map<number, number>();
  const why = new Map<number, Map<string, number>>();

  for (const term of terms) {
    const posting = INDEX.postings.get(term);
    if (!posting) continue;
    const df = posting.size;
    // BM25 IDF with the +0.5 smoothing, floored so common terms can't go negative.
    const idf = Math.max(0.01, Math.log(1 + (INDEX.n - df + 0.5) / (df + 0.5)));

    for (const [d, tf] of posting) {
      const norm = 1 - B + (B * INDEX.lengths[d]) / INDEX.avgdl;
      const contribution = (idf * (tf * (K1 + 1))) / (tf + K1 * norm);
      scores.set(d, (scores.get(d) ?? 0) + contribution);
      let w = why.get(d);
      if (!w) why.set(d, (w = new Map()));
      w.set(term, (w.get(term) ?? 0) + contribution);
    }
  }

  const hits: Hit[] = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([d, score]) => ({
      chunk: INDEX.chunks[d],
      score,
      matched: [...(why.get(d) ?? new Map())]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([t]) => t),
    }));

  return {
    hits,
    ms: (typeof performance !== "undefined" ? performance.now() : 0) - started,
    terms,
  };
}
