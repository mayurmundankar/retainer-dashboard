import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusColor, statusLabel } from "./format";

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-lg font-medium tabular-nums tracking-tight">{value}</div>
      {hint ? <div className="truncate text-[11px] text-muted-foreground">{hint}</div> : <div className="h-4" />}
    </div>
  );
}

export function Banner({ tone, children }: { tone: "warn" | "info" | "bad" | "ok"; children: ReactNode }) {
  const cls = {
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    info: "border-sky-200 bg-sky-50 text-sky-950",
    bad: "border-red-200 bg-red-50 text-red-950",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-950",
  }[tone];
  return <div className={cn("rounded-md border px-3 py-2 text-xs leading-relaxed", cls)}>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="size-1.5 rounded-full" style={{ background: statusColor(status) }} />
      {statusLabel(status)}
    </span>
  );
}

export function Disclosure({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-md border bg-card">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium">{title}</summary>
      <div className="max-h-96 overflow-auto border-t">{children}</div>
    </details>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-medium">{children}</h2>;
}

type Col<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

export function SimpleTable<T>({ columns, rows, empty = "None" }: { columns: Col<T>[]; rows: T[]; empty?: string }) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c.key} className={cn("h-8 whitespace-nowrap", c.className)}>
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key} className={cn("whitespace-nowrap py-1.5", c.className)}>
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
    <div className="min-w-0 rounded-md border p-3">
      <div className="mb-2 text-xs font-medium">{title}</div>
      <div className="h-72">{children}</div>
    </div>
  );
}
