import type { Medicine } from "./api";

export function todayLocal() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

/** Whole days from today until an ISO date (negative when it is in the past). */
export function daysFromToday(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function medicineStatus(m: Medicine) {
  if (m.expiry_date < todayLocal())
    return { label: "Expired", style: "bg-red-bg text-red" };
  if (m.stock === 0)
    return { label: "Out of stock", style: "bg-red-bg text-red" };
  if (daysFromToday(m.expiry_date) <= 30)
    return { label: "Expires soon", style: "bg-amber-bg text-amber" };
  if (m.stock < 10)
    return { label: "Low stock", style: "bg-amber-bg text-amber" };
  return { label: "OK", style: "bg-ok-bg text-ok" };
}

/** "2026-10-31" becomes "31 Oct". */
export function shortDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}