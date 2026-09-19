import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, startOfMonth } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPKR(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy");
}

export function formatMonth(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date.slice(0, 10)) : date;
  return format(d, "MMMM yyyy");
}

/** Canonical fee_vouchers.billing_month value: date as yyyy-MM-dd (1st of month). */
export function toBillingMonth(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? parseISO(date.slice(0, 10)) : date;
  return format(startOfMonth(d), "yyyy-MM-dd");
}

export function monthInputValue(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? parseISO(date.slice(0, 10)) : date;
  return format(startOfMonth(d), "yyyy-MM");
}

/** Convert `<input type="month">` value (yyyy-MM) → billing_month (yyyy-MM-dd). */
export function fromMonthInput(value: string): string {
  return `${value}-01`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function generateVoucherNo(schoolCode: string, seq: number): string {
  const year = new Date().getFullYear().toString().slice(-2);
  return `V${schoolCode}${year}${String(seq).padStart(5, "0")}`;
}

export function generateReceiptNo(schoolCode: string, seq: number): string {
  const year = new Date().getFullYear().toString().slice(-2);
  return `R${schoolCode}${year}${String(seq).padStart(5, "0")}`;
}

export function schoolCodeFromId(id: string): string {
  return id.replace(/-/g, "").slice(0, 4).toUpperCase();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}
