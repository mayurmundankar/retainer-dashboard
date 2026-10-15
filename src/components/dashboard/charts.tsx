"use client";

import type { ComponentProps } from "react";
import { Tooltip } from "recharts";

export const tick = { fontSize: 12, fill: "var(--muted-foreground)" };

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

export function ChartTooltip(props: ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip
      {...props}
      contentStyle={{
        background: "var(--popover)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        fontSize: 12,
        color: "var(--popover-foreground)",
        boxShadow: "none",
      }}
      labelStyle={{ color: "var(--foreground)", fontWeight: 500 }}
      itemStyle={{ color: "var(--foreground)" }}
    />
  );
}
