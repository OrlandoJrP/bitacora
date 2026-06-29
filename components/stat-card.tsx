import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn(accent && "border-brand-gold/40 bg-brand-gold/5", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon && (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-gold/15 text-brand-gold-600">
              {icon}
            </span>
          )}
        </div>
        <p className="mt-2 font-serif text-2xl font-semibold tabular sm:text-3xl">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
