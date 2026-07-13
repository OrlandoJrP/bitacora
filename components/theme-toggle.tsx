"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPCIONES = [
  { valor: "light", label: "Claro", icon: Sun },
  { valor: "dark", label: "Oscuro", icon: Moon },
  { valor: "system", label: "Sistema", icon: Monitor },
] as const;

/** Selector de tema (claro / oscuro / sistema), persistente por dispositivo. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  // Evita el desajuste de hidratación: el tema real solo se conoce en cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const Icono = mounted && resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Cambiar tema"
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/60 transition-colors hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Icono className="h-[1.1rem] w-[1.1rem]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPCIONES.map(({ valor, label, icon: Icon }) => (
          <DropdownMenuItem key={valor} onSelect={() => setTheme(valor)}>
            <Icon className="h-4 w-4" />
            {label}
            {mounted && theme === valor && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
