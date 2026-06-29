"use client";

import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { cerrarSesion } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  email,
  rol,
  accountHref,
}: {
  email: string;
  rol: string;
  accountHref?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-sm transition-colors hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-gold/20 text-xs font-semibold text-brand-gold-600">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[160px] truncate sm:inline">{email}</span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{email}</span>
          <span className="text-xs font-normal capitalize text-muted-foreground">{rol}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accountHref && (
          <DropdownMenuItem asChild>
            <Link href={accountHref}>
              <User className="h-4 w-4" />
              Mi cuenta
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
