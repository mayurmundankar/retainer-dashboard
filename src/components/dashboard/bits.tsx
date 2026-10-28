import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { statusColor, statusLabel } from "./format";

export function Metric({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tooltip?: string | ReactNode;
}) {
  const card = (
    <div
      className={cn(
        "group relative min-w-0 p-3.5 rounded-xl border border-border/80 bg-card shadow-xs transition-all",
        tooltip
          ? "cursor-help hover:border-[#b5018b]/60 hover:shadow-[2px_2px_0px_#b5018b]"
          : "hover:border-[#b5018b]/40 hover:shadow-[2px_2px_0px_#b5018b]",
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">{label}</div>
        {tooltip && (
          <span className="text-muted-foreground/60 group-hover:text-[#b5018b] transition-colors shrink-0">
            <Info className="size-3" />
          </span>
        )}
      </div>
      <div className="truncate text-2xl font-bold tabular-nums tracking-tight mt-0.5 text-foreground">{value}</div>
      {hint ? <div className="text-[11px] leading-snug text-muted-foreground mt-0.5 truncate font-light">{hint}</div> : null}
    </div>
  );

  if (!tooltip) return card;

  return (
    <Tooltip>
      <TooltipTrigger render={card} />
      <TooltipContent
        side="top"
        className="max-w-xs text-xs font-normal leading-relaxed p-2.5 z-50 shadow-lg border border-border/80 bg-popover text-popover-foreground"
      >
        <div className="font-bold text-[11px] uppercase tracking-wider text-[#b5018b] mb-1">{label}</div>
        <div>{tooltip}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export function Banner({ tone, children }: { tone: "warn" | "info" | "bad" | "ok"; children: ReactNode }) {
  const cls = {
    warn: "border-[#ea580c]/30 bg-[#ea580c]/10 text-foreground",
    info: "border-[#4b439d]/30 bg-[#4b439d]/5 text-foreground",
    bad: "border-destructive/30 bg-destructive/10 text-destructive",
    ok: "border-[#99d132]/40 bg-[#99d132]/10 text-foreground",
  }[tone];
  return (
    <div className={cn("rounded-xl px-4 py-2.5 text-sm leading-relaxed border shadow-xs font-normal", cls)}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">
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
    ? "bg-[#b5018b]/15 text-[#b5018b] border-[#b5018b]/30"
    : isUnder
    ? "bg-[#01abc8]/15 text-[#007f96] dark:text-[#01abc8] border-[#01abc8]/30"
    : "bg-[#99d132]/15 text-[#3a660a] dark:text-[#99d132] border-[#99d132]/35";
  const sign = v > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums border shadow-xs ${cls}`}>
      {sign}{v.toFixed(1)}%
    </span>
  );
}

export function Disclosure({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-xl border border-border/80 bg-card/80 shadow-xs">
      <summary className="cursor-pointer px-3.5 py-2 text-xs font-semibold text-foreground/90 uppercase tracking-wide">{title}</summary>
      <div className="max-h-96 overflow-auto border-t border-border/40">{children}</div>
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
    <div className="space-y-1 pb-1 border-b-2 border-[#4b439d]/20">
      {badge && (
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#b5018b] uppercase">
          {badge}
        </div>
      )}
      <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2 uppercase">
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
    <table className="w-full text-sm border-separate border-spacing-0">
      <thead>
        <tr className="bg-[#b5018b]">
          {columns.map((c) => (
            <th
              key={c.key}
              title={c.tooltip}
              className={cn(
                "h-9 px-3 py-2 text-left whitespace-nowrap text-xs font-bold uppercase tracking-wider text-white border-b-2 border-[#820164]",
                stickyHeader ? "sticky top-0 z-20 bg-[#b5018b]" : "bg-[#b5018b]",
                c.headerClassName
              )}
            >
              {c.tooltip ? (
                <Tooltip>
                  <TooltipTrigger className="inline-flex items-center gap-1 cursor-help hover:text-white/80 transition-colors group/th">
                    <span>{c.label}</span>
                    <span className="text-[10px] text-white/70 border border-white/40 rounded-full size-3.5 inline-flex items-center justify-center font-normal group-hover/th:text-white group-hover/th:border-white">
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
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="text-muted-foreground py-6 text-center text-xs">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} className="group hover:bg-[#f4e8f1]/30 transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={cn("whitespace-nowrap px-3 py-2 text-foreground/90 font-normal border-b border-border/40", c.className)}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function ChartBox({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <Card size="sm" className="min-w-0 border border-border/80 bg-card rounded-xl shadow-xs">
      <CardHeader className="border-b-2 border-[#4b439d]/15 pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-bold tracking-wider uppercase text-foreground/90">{title}</CardTitle>
        {subtitle && <div className="text-[11px] font-normal text-muted-foreground mt-0.5 leading-snug">{subtitle}</div>}
      </CardHeader>
      <CardContent className="h-80 pt-3">{children}</CardContent>
    </Card>
  );
}
