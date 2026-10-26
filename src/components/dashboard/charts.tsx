"use client";

import type { ComponentProps } from "react";
import { Tooltip } from "recharts";

export const tick = { fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-raleway), sans-serif" };

export const series = {
  allocated: "var(--chart-2)",
  forecast: "var(--chart-1)",
  actual: "var(--chart-3)",
  contracted: "var(--chart-4)",
  planned: "var(--chart-5)",
  capacity: "var(--chart-2)",
  muted: "var(--muted-foreground)",
};

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function seriesColor(index: number) {
  return palette[index % palette.length];
}

export function ChartTooltip({ formatter, ...props }: ComponentProps<typeof Tooltip>) {
  const roundFormatter = (value: any, name: any, item: any, index: number, payload: any) => {
    if (formatter) {
      const customRes = formatter(value, name, item, index, payload);
      if (Array.isArray(customRes)) {
        const [val, n] = customRes;
        const rounded = typeof val === "number" ? Math.round(val).toLocaleString() : val;
        return [rounded, n ?? name];
      }
      return typeof customRes === "number" ? Math.round(customRes).toLocaleString() : customRes;
    }
    if (typeof value === "number" && !Number.isNaN(value)) {
      return [Math.round(value).toLocaleString(), name];
    }
    return [value, name];
  };

  return (
    <Tooltip
      formatter={roundFormatter}
      contentStyle={{
        background: "var(--card)",
        border: "1px solid rgba(75, 67, 157, 0.25)",
        borderRadius: "0.75rem",
        fontSize: 12,
        fontFamily: "var(--font-raleway), sans-serif",
        color: "var(--foreground)",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      }}
      labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
      itemStyle={{ color: "var(--foreground)" }}
      {...props}
    />
  );
}
