import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Helper estándar de shadcn para componer clases de Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
