import { Meta, Schema } from "@once-ui-system/core";
import { DocShell } from "@/components/terminal/DocShell";
import { about, baseURL, canonical, person } from "@/resources";
import { book, instruments, links, positions, profile, stack } from "@/resources/terminal";

export async function generateMetadata() {
  const meta = await Meta.generate({
    title: about.title,
    description: about.description,
    baseURL: baseURL,
    image: "/images/og/terminal.png",
    path: about.path,
  });
  return { ...meta, alternates: { canonical: canonical(about.path) } };
}

/**
 * The CV as a plain readable page.
 *
 * The terminal is the interactive version, but a recruiter skimming on a phone
 * — or a crawler — needs the same content in one static column. Everything is
 * read from resources/terminal.ts so the two views cannot drift apart.
 */
export default function About() {
  return (
    <DocShell section="about">
      <Schema
        as="webPage"
        baseURL={baseURL}
        path={about.path}
        title={about.title}
        description={about.description}
        image="/images/og/terminal.png"
        author={{
          name: person.name,
          url: `${baseURL}${about.path}`,
          image: `${baseURL}${person.avatar}`,
        }}
      />

      <section className="pnl doc-panel w-rec">
        <div className="pnl-h">
          <span className="ttl">Record</span>
          <span className="sub">full CV</span>
          <span className="pnl-code">BIO&lt;GO&gt;</span>
        </div>

        <header className="doc-head">
          <p className="doc-kicker">
            <a href="/">← back to desk</a>
            <span>{profile.location}</span>
          </p>
          <h1 className="doc-title">{profile.name}</h1>
          <p className="doc-lede">{profile.role}</p>
          <div className="doc-meta">
            <a href={links.cv} target="_blank" rel="noopener noreferrer">
              Download CV ↗
            </a>
            <a href={`mailto:${links.email}`}>{links.email}</a>
            <a href={links.github} target="_blank" rel="noopener noreferrer">
              GitHub ↗
            </a>
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn ↗
            </a>
          </div>
        </header>

        <dl className="rec-grid">
          <dt>Profile</dt>
          <dd>
            {profile.bio.map((para) => (
              <p key={para.slice(0, 32)}>{para}</p>
            ))}
          </dd>

          <dt>Roles &amp; degrees</dt>
          <dd>
            {positions.map((pos) => (
              <div className="rec-item" key={pos.code}>
                <h3>{pos.desc}</h3>
                <span className="rec-when">
                  {pos.venue} · {pos.opened} → {pos.closed ?? "present"} · {pos.headline}
                </span>
                <ul className="rec-list">
                  {pos.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ))}
          </dd>

          <dt>Projects</dt>
          <dd>
            {instruments.map((inst) => (
              <div className="rec-item" key={inst.ticker}>
                <h3>{inst.name}</h3>
                <span className="rec-when">
                  {inst.klass} · {inst.status} · {inst.since} ·{" "}
                  {inst.metrics.map((m) => `${m.label} ${m.value}`).join(" · ")}
                </span>
                <p>{inst.thesis}</p>
                {inst.detail.slice(0, 2).map((para) => (
                  <p key={para.slice(0, 32)}>{para}</p>
                ))}
                {inst.href && (
                  <p>
                    <a href={inst.href}>Full write-up →</a>
                  </p>
                )}
              </div>
            ))}
          </dd>

          <dt>Module marks</dt>
          <dd>
            <ul className="rec-list">
              {book.map((row) => (
                <li key={row.module}>
                  {row.module} — {row.mark}%
                </li>
              ))}
            </ul>
            <p>Brunel University London · average 82% · First Class Honours.</p>
          </dd>

          <dt>Toolset</dt>
          <dd>
            {stack.map((group) => (
              <p key={group.group}>
                <strong>{group.group}:</strong> {group.items.join(", ")}.
              </p>
            ))}
            <p>
              <strong>Spoken:</strong> {profile.languages}.
            </p>
            <p>
              <strong>Interests:</strong> {profile.interests}.
            </p>
          </dd>
        </dl>

        <div className="doc-foot">
          <a className="link-btn" href="/">
            ← Back to desk
          </a>
          <a className="link-btn" href={links.cv} target="_blank" rel="noopener noreferrer">
            CV PDF ↗
          </a>
        </div>
      </section>
    </DocShell>
  );
}
