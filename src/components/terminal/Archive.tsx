import { formatDate } from "@/utils/formatDate";
import { getPosts } from "@/utils/utils";

type Props = {
  /** Path segments passed to getPosts. */
  dir: string[];
  /** Route prefix for each record. */
  base: string;
  /** Reference prefix, e.g. WRK or NTE. */
  code: string;
  title: string;
  blurb: string;
  panelCode: string;
};

/** Records listed the way the blotter lists positions. */
export function Archive({ dir, base, code, title, blurb, panelCode }: Props) {
  const posts = getPosts(dir).sort(
    (a, b) =>
      new Date(b.metadata.publishedAt).getTime() - new Date(a.metadata.publishedAt).getTime(),
  );

  return (
    <section className="pnl doc-panel w-wide" aria-labelledby="h-arch">
      <div className="pnl-h">
        <h2 id="h-arch">{title}</h2>
        <span className="sub">
          {posts.length} record{posts.length === 1 ? "" : "s"}
        </span>
        <span className="pnl-code">{panelCode}</span>
      </div>

      <p className="arch-blurb">{blurb}</p>

      <div className="arch-head" aria-hidden="true">
        <span>Ref</span>
        <span>Title</span>
        <span>Tag</span>
        <span>Published</span>
      </div>

      {posts.map((post, i) => {
        // getPosts defaults a missing tag to [], which is truthy — so the
        // usual `tag || "—"` fallback would render nothing at all.
        const raw = post.metadata.tag;
        const tag = (Array.isArray(raw) ? raw[0] : raw) || "—";

        return (
        <a className="arch-row" href={`${base}/${post.slug}`} key={post.slug}>
          <span className="arch-ref">
            {code}.{String(posts.length - i).padStart(2, "0")}
          </span>
          <span className="arch-main">
            <span className="arch-title">{post.metadata.title}</span>
            {post.metadata.summary && <span className="arch-sum">{post.metadata.summary}</span>}
          </span>
          <span className="arch-tag">{tag}</span>
          <span className="arch-date">
            {post.metadata.publishedAt ? formatDate(post.metadata.publishedAt) : "—"}
          </span>
        </a>
        );
      })}

      {posts.length === 0 && <p className="arch-blurb">Nothing filed yet.</p>}
    </section>
  );
}
