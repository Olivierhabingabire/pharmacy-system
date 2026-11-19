import type { Medicine } from "./api";

export function todayLocal() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export function medicineStatus(m: Medicine) {
  if (m.expiry_date < todayLocal())
    return { label: "Expired", style: "bg-red-100 text-red-800" };
  if (m.stock === 0)
    return { label: "Out of stock", style: "bg-red-100 text-red-800" };
  if (m.stock < 10)
    return { label: "Low stock", style: "bg-amber-100 text-amber-800" };
  return { label: "OK", style: "bg-green-100 text-green-800" };
}