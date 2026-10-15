import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusColor, statusLabel } from "./format";

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-2xl font-medium tabular-nums tracking-tight">{value}</div>
      {hint ? <div className="text-xs leading-snug text-pretty text-muted-foreground">{hint}</div> : null}
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
  return <div className={cn("rounded-lg px-3 py-2 text-sm leading-relaxed ring-1 ring-foreground/10", cls)}>{children}</div>;
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
  return <h2 className="text-base font-medium tracking-tight">{children}</h2>;
}

type Col<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

export function SimpleTable<T>({ columns, rows, empty = "None" }: { columns: Col<T>[]; rows: T[]; empty?: string }) {
  return (
    <Table className="text-sm">
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
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">{children}</CardContent>
    </Card>
  );
}
