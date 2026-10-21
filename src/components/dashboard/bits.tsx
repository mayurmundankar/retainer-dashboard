import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { statusColor, statusLabel } from "./format";

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="min-w-0 p-3 rounded-lg border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 shadow-xs hover:border-primary/20 transition-all">
      <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">{label}</div>
      <div className="truncate text-2xl font-light tabular-nums tracking-tight mt-0.5 text-foreground">{value}</div>
      {hint ? <div className="text-[11px] leading-snug text-muted-foreground mt-0.5 truncate">{hint}</div> : null}
    </div>
  );
}

export function Banner({ tone, children }: { tone: "warn" | "info" | "bad" | "ok"; children: ReactNode }) {
  const cls = {
    warn: "bg-muted text-foreground",
    info: "bg-card text-muted-foreground",
    bad: "border-destructive/30 bg-destructive/10 text-destructive",
    ok: "bg-card text-foreground",
  }[tone];
  return (
    <div className={cn("rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ring-1 ring-foreground/10 bg-gradient-to-r from-card to-card/60 shadow-xs", cls)}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span className="size-2 rounded-full shadow-xs" style={{ background: statusColor(status) }} />
      {statusLabel(status)}
    </span>
  );
}

export function CtdVarBadge({ v, threshold = 10 }: { v: number | null | undefined; threshold?: number }) {
  if (v == null || Number.isNaN(v)) return <span className="text-muted-foreground">—</span>;
  const isOver = v > threshold;
  const isUnder = v < -threshold;
  const cls = isOver
    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25"
    : isUnder
    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
  const sign = v > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums border shadow-xs ${cls}`}>
      {sign}{v.toFixed(1)}%
    </span>
  );
}

export function Disclosure({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-md border bg-card/60 shadow-xs">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium">{title}</summary>
      <div className="max-h-96 overflow-auto border-t">{children}</div>
    </details>
  );
}

export function SectionTitle({
  children,
  badge,
  subtitle,
}: {
  children: ReactNode;
  badge?: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-0.5">
      {badge && (
        <div className="text-[10px] font-bold tracking-[0.2em] text-lime-600 dark:text-lime-400 uppercase">
          {badge}
        </div>
      )}
      <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
        {children}
      </h2>
      {subtitle && <p className="text-xs text-muted-foreground font-light">{subtitle}</p>}
    </div>
  );
}

export type Col<T> = {
  key: string;
  label: string;
  tooltip?: string;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export function SimpleTable<T>({
  columns,
  rows,
  empty = "None",
  stickyHeader = false,
}: {
  columns: Col<T>[];
  rows: T[];
  empty?: string;
  stickyHeader?: boolean;
}) {
  return (
    <Table className="text-sm border-collapse">
      <TableHeader className={stickyHeader ? "sticky top-0 z-20 bg-card border-b shadow-xs" : undefined}>
        <TableRow className="border-b bg-muted/30">
          {columns.map((c) => (
            <TableHead
              key={c.key}
              title={c.tooltip}
              className={cn("h-9 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground/90", c.headerClassName || c.className)}
            >
              {c.tooltip ? (
                <Tooltip>
                  <TooltipTrigger className="inline-flex items-center gap-1 cursor-help hover:text-foreground transition-colors group/th">
                    <span>{c.label}</span>
                    <span className="text-[10px] text-muted-foreground/60 border border-muted-foreground/30 rounded-full size-3.5 inline-flex items-center justify-center font-normal group-hover/th:text-foreground group-hover/th:border-foreground/50">
                      ?
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs font-normal leading-relaxed shadow-lg">
                    {c.tooltip}
                  </TooltipContent>
                </Tooltip>
              ) : (
                c.label
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-muted-foreground py-4 text-center">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, i) => (
            <TableRow key={i} className="group hover:bg-muted/40 transition-colors">
              {columns.map((c) => (
                <TableCell key={c.key} className={cn("whitespace-nowrap py-2", c.className)}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function ChartBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="sm" className="min-w-0 border-border/70 bg-gradient-to-b from-card to-card/60 shadow-xs">
      <CardHeader className="border-b border-border/40 pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80 pt-3">{children}</CardContent>
    </Card>
  );
}
