import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Meta, Schema } from "@once-ui-system/core";
import { Doc } from "@/components/terminal/Doc";
import { DocShell } from "@/components/terminal/DocShell";
import { ScrollToHash } from "@/components";
import { about, baseURL, person, work } from "@/resources";
import { getPosts } from "@/utils/utils";

const DIR = ["src", "app", "(site)", "work", "projects"];

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

  return Meta.generate({
    title: post.metadata.title,
    description: post.metadata.summary,
    baseURL: baseURL,
    image: post.metadata.image || "/images/og/terminal.png",
    path: `${work.path}/${post.slug}`,
  });
}

export default async function WorkPost({
  params,
}: {
  params: Promise<{ slug: string | string[] }>;
}) {
  const slug = await resolve(params);
  const post = getPosts(DIR).find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <DocShell section="work">
      <Schema
        as="webPage"
        baseURL={baseURL}
        path={`${work.path}/${post.slug}`}
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
      <Doc post={post} kicker="Work" backHref="/work" backLabel="All work" />
      <ScrollToHash />
    </DocShell>
  );
}
