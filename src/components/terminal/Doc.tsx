import { formatDate } from "@/utils/formatDate";
import { profile } from "@/resources/terminal";
import { DocMDX } from "./DocMDX";

type Post = {
  slug: string;
  content: string;
  metadata: {
    title: string;
    publishedAt: string;
    summary?: string;
    tag?: string;
    link?: string;
  };
};

/** A single written record: work write-up or note. */
export function Doc({
  post,
  kicker,
  backHref,
  backLabel,
}: {
  post: Post;
  kicker: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <section className="pnl doc-panel w-doc">
      <div className="pnl-h">
        <span className="ttl">{kicker}</span>
        <span className="pnl-code">DOC&lt;GO&gt;</span>
      </div>

      <header className="doc-head">
        <p className="doc-kicker">
          <a href={backHref}>← {backLabel}</a>
          {post.metadata.tag && <span>{post.metadata.tag}</span>}
        </p>
        <h1 className="doc-title">{post.metadata.title}</h1>
        {post.metadata.summary && <p className="doc-lede">{post.metadata.summary}</p>}
        <div className="doc-meta">
          {post.metadata.publishedAt && <span>{formatDate(post.metadata.publishedAt)}</span>}
          <span>{profile.name}</span>
          {post.metadata.link && (
            <a href={post.metadata.link} target="_blank" rel="noopener noreferrer">
              Live ↗
            </a>
          )}
        </div>
      </header>

      <div className="doc-body">
        <DocMDX source={post.content} />
      </div>

      <div className="doc-foot">
        <a className="link-btn" href={backHref}>
          ← {backLabel}
        </a>
        <a className="link-btn" href="/">
          Back to desk
        </a>
      </div>
    </section>
  );
}
