"use client";

import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function parse(period: string) {
  const [year, month] = period.split("-").map(Number);
  return { year, monthIndex: (month || 1) - 1 };
}

export function formatMonth(period: string) {
  const { year, monthIndex } = parse(period);
  return `${MONTHS[monthIndex] ?? ""} ${year}`.trim();
}

export function MonthDatePicker({
  label,
  value,
  months,
  onChange,
}: {
  label: string;
  value: string;
  months: string[];
  onChange: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [year, setYear] = useState(selected.year);
  const allowed = new Set(months);
  const years = [...new Set(months.map((month) => Number(month.slice(0, 4))))].filter(Number.isFinite).sort((a, b) => a - b);
  const minYear = years[0] ?? selected.year;
  const maxYear = years[years.length - 1] ?? selected.year;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setYear(parse(value).year);
        }}
      >
        <PopoverTrigger render={<Button variant="outline" className="w-full justify-start px-2.5 font-normal" />}>
          <CalendarIcon />
          {formatMonth(value)}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="mb-2 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={year <= minYear}
              onClick={() => setYear((current) => current - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="text-sm font-medium">{year}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={year >= maxYear}
              onClick={() => setYear((current) => current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, index) => {
              const key = monthKey(year, index);
              const enabled = allowed.has(key);
              return (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant={key === value ? "secondary" : "ghost"}
                  disabled={!enabled}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
