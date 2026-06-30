"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUSD } from "@/lib/format";

export type PuntoBarra = { label: string; valor: number };

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
      <div className="tabular">{formatUSD(payload[0].value)}</div>
    </div>
  );
}

/** Gráfico de barras (comisión mensual del operador, AUM, etc.). */
export function Bars({
  data,
  color = "#D4A574",
  height = 220,
  signedColors = false,
}: {
  data: PuntoBarra[];
  color?: string;
  height?: number;
  signedColors?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.12} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
          minTickGap={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={46}
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
          tickFormatter={(v) => compact.format(v as number)}
        />
        <Tooltip content={<TooltipBox />} cursor={{ fill: color, fillOpacity: 0.08 }} />
        <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill={color}>
          {signedColors &&
            data.map((d, i) => (
              <Cell key={i} fill={d.valor >= 0 ? "#1E8E5A" : "#C0392B"} />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
