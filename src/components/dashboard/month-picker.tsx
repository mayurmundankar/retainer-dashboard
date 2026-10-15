"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1);
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
  const [picked, setPicked] = useState<Date>(() => monthStart(value));
  const allowed = new Set(months);
  const sorted = [...months].sort();
  const selected = monthKey(picked) === value ? picked : monthStart(value);
  const first = monthStart(sorted[0] ?? value);
  const last = monthStart(sorted[sorted.length - 1] ?? value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" className="w-full justify-start px-2.5 font-normal" />}
        >
          <CalendarIcon />
          {format(selected, "d MMM yyyy")}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            startMonth={first}
            endMonth={last}
            disabled={(date) => !allowed.has(monthKey(date))}
            onSelect={(date) => {
              if (!date) return;
              const key = monthKey(date);
              if (!allowed.has(key)) return;
              setPicked(date);
              onChange(key);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
