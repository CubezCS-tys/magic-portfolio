import { links, profile } from "@/resources/terminal";
import "./terminal.css";

export type Section = "work" | "blog" | "about" | null;

const NAV: { href: string; label: string; key: Section }[] = [
  { href: "/work", label: "Work", key: "work" },
  { href: "/blog", label: "Notes", key: "blog" },
  { href: "/about", label: "Record", key: "about" },
];

/**
 * Chrome for the written pages: the terminal's top bar and footer, without the
 * live panels. Keeps the two halves of the site recognisably one thing.
 */
export function DocShell({
  section,
  children,
}: {
  section: Section;
  children: React.ReactNode;
}) {
  return (
    <div className="trm">
      <div className="shell">
        <header className="topbar">
          <a className="brand brand-link" href="/">
            <span className="brand-mark">
              SOLTANI<em>·</em>TERMINAL
            </span>
            <span className="brand-sub">← back to desk</span>
          </a>
          <div className="topbar-spacer" />
          <nav className="topnav" aria-label="Sections">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={section === item.key ? "page" : undefined}
              >
                {item.label}
              </a>
            ))}
            <a href={links.cv} target="_blank" rel="noopener noreferrer">
              CV
            </a>
            <a href={links.github} target="_blank" rel="noopener noreferrer">
              GH
            </a>
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer">
              LI
            </a>
          </nav>
        </header>

        {children}

        <div className="shell-fill" aria-hidden="true" />

        <footer className="trm-foot">
          <span>{profile.name}</span>
          <span className="sep">│</span>
          <span>{profile.role}</span>
          <span className="sep">│</span>
          <a href={`mailto:${links.email}`}>{links.email}</a>
          <span className="sep">│</span>
          <a href="/">Terminal</a>
        </footer>
      </div>
    </div>
  );
}
