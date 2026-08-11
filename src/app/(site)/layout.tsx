import { RouteGuard } from "@/components";

/**
 * The written pages carry their own chrome via DocShell, because each needs to
 * mark its own section. This layer only enforces route access.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard>{children}</RouteGuard>;
}
