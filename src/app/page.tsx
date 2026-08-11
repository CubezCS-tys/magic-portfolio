import { Meta, Schema } from "@once-ui-system/core";
import { BootSequence } from "@/components/terminal/BootSequence";
import { Terminal } from "@/components/terminal/Terminal";
import { about, baseURL, canonical, home, person } from "@/resources";

export async function generateMetadata() {
  const meta = await Meta.generate({
    title: home.title,
    description: home.description,
    baseURL: baseURL,
    path: home.path,
    image: home.image,
  });
  return { ...meta, alternates: { canonical: canonical(home.path) } };
}

export default function Home() {
  return (
    <>
      <Schema
        as="webPage"
        baseURL={baseURL}
        path={home.path}
        title={home.title}
        description={home.description}
        image={`/api/og/generate?title=${encodeURIComponent(home.title)}`}
        author={{
          name: person.name,
          url: `${baseURL}${about.path}`,
          image: `${baseURL}${person.avatar}`,
        }}
      />
      <Terminal />
      <BootSequence />
    </>
  );
}
