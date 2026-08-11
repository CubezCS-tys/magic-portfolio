import { Meta, Schema } from "@once-ui-system/core";
import { Archive } from "@/components/terminal/Archive";
import { DocShell } from "@/components/terminal/DocShell";
import { about, baseURL, person, work } from "@/resources";

export async function generateMetadata() {
  return Meta.generate({
    title: work.title,
    description: work.description,
    baseURL: baseURL,
    image: "/images/og/terminal.png",
    path: work.path,
  });
}

export default function Work() {
  return (
    <DocShell section="work">
      <Schema
        as="webPage"
        baseURL={baseURL}
        path={work.path}
        title={work.title}
        description={work.description}
        image="/images/og/terminal.png"
        author={{
          name: person.name,
          url: `${baseURL}${about.path}`,
          image: `${baseURL}${person.avatar}`,
        }}
      />
      <Archive
        dir={["src", "app", "(site)", "work", "projects"]}
        base="/work"
        code="WRK"
        title="Work archive"
        panelCode="WRK<GO>"
        blurb="Long-form write-ups behind the instruments on the desk — method, results, and what the numbers actually mean."
      />
    </DocShell>
  );
}
