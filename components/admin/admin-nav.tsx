"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ArrowLeftRight,
  FileBarChart,
  Upload,
  Settings,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/cierre", label: "Cierre mensual", icon: CalendarCheck },
  { href: "/admin/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/admin/reportes", label: "Reportes", icon: FileBarChart },
  { href: "/admin/importar", label: "Importar", icon: Upload },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText },
];

function active(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            active(pathname, href)
              ? "bg-brand-gold text-brand-navy"
              : "text-brand-cream/70 hover:bg-white/5 hover:text-brand-cream",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminTopNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-2 py-2 lg:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            active(pathname, href)
              ? "bg-brand-gold text-brand-navy"
              : "text-brand-cream/70 hover:bg-white/5",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
