import {
  ArrowLeftRight,
  CalendarCheck,
  FileBarChart,
  LayoutDashboard,
  ScrollText,
  Settings,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Navegación COMPLETA del operador (sidebar y drawer). */
export const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/cierre", label: "Cierre mensual", icon: CalendarCheck },
  { href: "/admin/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/admin/reportes", label: "Reportes", icon: FileBarChart },
  { href: "/admin/importar", label: "Importar", icon: Upload },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText },
];

/** Las 4 secciones más usadas para la barra inferior (Cierre va en el FAB). */
export const ADMIN_BOTTOM: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/movimientos", label: "Movim.", icon: ArrowLeftRight },
  { href: "/admin/reportes", label: "Reportes", icon: FileBarChart },
];

/** Acción principal del operador → FAB y CTA del drawer. */
export const ADMIN_CTA = { href: "/admin/cierre", label: "Cierre mensual" };

export function isActiveAdmin(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}
