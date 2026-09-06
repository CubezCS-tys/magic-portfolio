import type { Metadata } from "next";
import { Card } from "@/components/terminal/Card";
import { baseURL, canonical } from "@/resources";
import { card, profile } from "@/resources/terminal";

/**
 * Sits outside the (site) route group so it renders bare — no header, no
 * footer, no route guard. This is what an aluminium NFC card opens.
 */
export const metadata: Metadata = {
  title: `${profile.name} — Card`,
  description: card.status,
  alternates: { canonical: canonical("/card") },
  openGraph: {
    title: `${profile.name} — Card`,
    description: card.status,
    url: `${baseURL}/card`,
    images: [{ url: `${baseURL}${"/images/avatar.jpg"}` }],
  },
  // Not a page anyone should reach from search — it's for the person holding
  // the card. Keeping it out of the index also keeps it out of the sitemap.
  robots: { index: false, follow: true },
};

export const viewport = {
  themeColor: "#050609",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function CardPage() {
  return <Card />;
}
