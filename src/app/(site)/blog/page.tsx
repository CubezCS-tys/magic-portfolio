import { Meta, Schema } from "@once-ui-system/core";
import { Archive } from "@/components/terminal/Archive";
import { DocShell } from "@/components/terminal/DocShell";
import { baseURL, canonical, blog, person } from "@/resources";

export async function generateMetadata() {
  const meta = await Meta.generate({
    title: blog.title,
    description: blog.description,
    baseURL: baseURL,
    image: "/images/og/terminal.png",
    path: blog.path,
  });
  return { ...meta, alternates: { canonical: canonical(blog.path) } };
}

export default function Blog() {
  return (
    <DocShell section="blog">
      <Schema
        as="blogPosting"
        baseURL={baseURL}
        title={blog.title}
        description={blog.description}
        path={blog.path}
        image="/images/og/terminal.png"
        author={{
          name: person.name,
          url: `${baseURL}/blog`,
          image: `${baseURL}${person.avatar}`,
        }}
      />
      <Archive
        dir={["src", "app", "(site)", "blog", "posts"]}
        base="/blog"
        code="NTE"
        title="Notes"
        panelCode="NTE<GO>"
        blurb="Working notes on quantitative finance, retrieval systems and the engineering underneath both."
      />
    </DocShell>
  );
}
