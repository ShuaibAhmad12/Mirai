"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
import {
  Home,
  LayoutDashboard,
  Wallet,
  Users,
  UserCog,
  Settings,
  FileText,
  Layers,
} from "lucide-react";

// Optional custom labels for certain route segments
const LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  "academic-management": "Academic Management",
  fees: "Fees",
  staff: "Staff",
  agents: "Agents",
  settings: "Settings",
};

// Map segments to icons
const ICON_MAP: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  "academic-management": Layers,
  fees: Wallet,
  staff: Users,
  agents: UserCog,
  settings: Settings,
};

function toLabel(segment: string) {
  return (
    LABEL_MAP[segment] ||
    segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function AutoBreadCrumbs() {
  const pathname = usePathname();
  const segments = pathname
    .split("/")
    .filter(Boolean) // remove empty
    .filter((s) => s !== "protected"); // safety if segment folder exposed

  // Only render on protected pages; if empty show nothing
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const isLast = idx === segments.length - 1;
    // Dynamic route detection (e.g. [id])
    const dynamic = seg.startsWith("[") && seg.endsWith("]");
    const label = dynamic ? "Detail" : toLabel(seg);
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="px-6 pt-4">
      <ol className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <li>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Home</span>
          </Link>
        </li>
        {crumbs.map((c) => {
          const seg = c.href.split("/").filter(Boolean).pop() || "";
          const Icon = ICON_MAP[seg] || FileText;
          return (
            <Fragment key={c.href}>
              <li className="select-none text-muted-foreground/60">/</li>
              <li>
                {c.isLast ? (
                  <span className="inline-flex items-center gap-1 text-foreground font-medium">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {c.label}
                  </span>
                ) : (
                  <Link
                    href={c.href}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {c.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
