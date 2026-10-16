import type { DateRange, YearMonth } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-10" → "Oct 2025", "2025" → "2025". */
export function formatYearMonth(value: YearMonth): string {
  const [year, month] = value.split("-");
  if (!month) return year;
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** "Expected June 2028" style, with the full month name. */
export function formatLongYearMonth(value: YearMonth): string {
  const [year, month] = value.split("-");
  if (!month) return year;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return `${date.toLocaleString("en-US", { month: "long" })} ${year}`;
}

/** { start: "2023-08", end: "2024-01" } → "Aug 2023 — Jan 2024"; no end → "… — Present". */
export function formatDateRange(range: DateRange): string {
  if (range.display) return range.display;
  const start = formatYearMonth(range.start);
  const end = range.end ? formatYearMonth(range.end) : "Present";
  return `${start} — ${end}`;
}

/** 1 → "Solo project", 5 → "5 people". */
export function formatTeamSize(size: number): string {
  return size === 1 ? "Solo project" : `${size} people`;
}
