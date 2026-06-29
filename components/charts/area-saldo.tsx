"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUSD } from "@/lib/format";

export type PuntoSaldo = { label: string; saldo: number };

const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{label}</div>
      <div className="tabular text-brand-gold-600">{formatUSD(payload[0].value)}</div>
    </div>
  );
}

export function AreaSaldo({
  data,
  color = "#D4A574",
  height = 260,
}: {
  data: PuntoSaldo[];
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.12} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
          tickFormatter={(v) => compact.format(v as number)}
        />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: color, strokeOpacity: 0.3 }} />
        <Area
          type="monotone"
          dataKey="saldo"
          stroke={color}
          strokeWidth={2.5}
          fill="url(#saldoFill)"
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
