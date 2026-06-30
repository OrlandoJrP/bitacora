"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_ITEMS, isActiveAdmin } from "./admin-nav-items";

/** Sidebar fija para escritorio (≥ md). */
export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {ADMIN_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActiveAdmin(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-gold text-brand-navy"
                : "text-brand-cream/70 hover:bg-white/5 hover:text-brand-cream",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
