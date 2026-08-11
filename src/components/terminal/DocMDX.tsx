import { MDXRemote } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";
import React from "react";
import { slugify } from "transliteration";

/**
 * Markdown rendered to plain elements, styled by `.doc-body` in terminal.css.
 *
 * The default renderer in components/mdx.tsx maps everything onto Once UI,
 * which brings its own light-theme surfaces — fine for the original template,
 * wrong inside the terminal palette.
 */

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/** Headings get stable ids so the on-page contents can link to them. */
function heading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return function Heading({ children }: { children?: ReactNode }) {
    const id = slugify(textOf(children));
    return (
      <Tag id={id}>
        <a className="anchor" href={`#${id}`} aria-label="Link to this section">
          #
        </a>
        {children}
      </Tag>
    );
  };
}

function Anchor({ href = "", children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const external = /^https?:\/\//.test(href);
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
      {children}
    </a>
  );
}

const components = {
  h1: heading(2),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  a: Anchor,
  // eslint-disable-next-line @next/next/no-img-element
  img: (p: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={p.alt ?? ""} {...p} />,
  table: (p: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="doc-table">
      <table {...p} />
    </div>
  ),
};

export function DocMDX({ source }: { source: string }) {
  return <MDXRemote source={source} components={components} />;
}
