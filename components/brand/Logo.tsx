import { cn } from "@/lib/utils";

/**
 * Isotipo de brújula de Brújula Markets. Una rosa de los vientos de 4 puntas
 * (aguja navy/dorado) dentro de un anillo. Funciona sobre fondo claro u oscuro.
 */
export function Logo({
  className,
  size = 40,
  withWordmark = false,
  nombre = "Brújula Markets",
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  nombre?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Brújula Markets"
        className="shrink-0"
      >
        <circle cx="32" cy="32" r="30" stroke="#D4A574" strokeWidth="2.5" />
        <circle cx="32" cy="32" r="23" stroke="#D4A574" strokeWidth="1" opacity="0.35" />
        {/* Aguja vertical: norte dorado, sur navy */}
        <path d="M32 9 L38 32 L32 30 Z" fill="#D4A574" />
        <path d="M32 55 L26 32 L32 34 Z" fill="#0A2540" className="dark:fill-[#FAF7F2]" />
        {/* Aguja horizontal */}
        <path d="M9 32 L32 26 L30 32 Z" fill="#0A2540" className="dark:fill-[#FAF7F2]" opacity="0.85" />
        <path d="M55 32 L32 38 L34 32 Z" fill="#D4A574" opacity="0.85" />
        <circle cx="32" cy="32" r="3.4" fill="#D4A574" />
      </svg>
      {withWordmark && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate font-serif text-base font-semibold tracking-tight sm:text-lg">
            {nombre}
          </span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Bitácora
          </span>
        </span>
      )}
    </span>
  );
}
