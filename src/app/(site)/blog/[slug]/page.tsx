import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Meta, Schema } from "@once-ui-system/core";
import { Doc } from "@/components/terminal/Doc";
import { DocShell } from "@/components/terminal/DocShell";
import { ScrollToHash } from "@/components";
import { about, baseURL, canonical, blog, person } from "@/resources";
import { getPosts } from "@/utils/utils";

const DIR = ["src", "app", "(site)", "blog", "posts"];

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return getPosts(DIR).map((post) => ({ slug: post.slug }));
}

const resolve = async (params: Promise<{ slug: string | string[] }>) => {
  const routeParams = await params;
  return Array.isArray(routeParams.slug) ? routeParams.slug.join("/") : routeParams.slug || "";
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string | string[] }>;
}): Promise<Metadata> {
  const slug = await resolve(params);
  const post = getPosts(DIR).find((p) => p.slug === slug);
  if (!post) return {};

  const meta = await Meta.generate({
    title: post.metadata.title,
    description: post.metadata.summary,
    baseURL: baseURL,
    image: post.metadata.image || "/images/og/terminal.png",
    path: `${blog.path}/${post.slug}`,
  });
  return { ...meta, alternates: { canonical: canonical(`${blog.path}/${post.slug}`) } };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string | string[] }>;
}) {
  const slug = await resolve(params);
  const post = getPosts(DIR).find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <DocShell section="blog">
      <Schema
        as="blogPosting"
        baseURL={baseURL}
        path={`${blog.path}/${post.slug}`}
        title={post.metadata.title}
        description={post.metadata.summary}
        datePublished={post.metadata.publishedAt}
        dateModified={post.metadata.publishedAt}
        image={post.metadata.image || "/images/og/terminal.png"}
        author={{
          name: person.name,
          url: `${baseURL}${about.path}`,
          image: `${baseURL}${person.avatar}`,
        }}
      />
      <Doc post={post} kicker="Note" backHref="/blog" backLabel="All notes" />
      <ScrollToHash />
    </DocShell>
  );
}
