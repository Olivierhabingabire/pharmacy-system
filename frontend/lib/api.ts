import { supabase } from "./supabase";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type Medicine = {
  id: number;
  name: string;
  price: string;
  stock: number;
  expiry_date: string;
};

export type CustomerMedicine = {
  id: number;
  name: string;
  price: string;
  available: boolean;
};

export type OrderStatus =
  | "submitted"
  | "ready_for_pickup"
  | "declined"
  | "completed"
  | "cancelled";

export type OrderItem = {
  medicine_id: number;
  name: string;
  qty: number;
  unit_price: string;
  line_total: string;
};

export type PharmacyOrder = {
  id: string;
  status: OrderStatus;
  customer_note: string;
  staff_note: string;
  pharmacist_id: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  total: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
};

export type DailyRevenue = {
  date: string;
  revenue: string;
  items_sold: number;
  receipts: number;
};

export type BestSeller = {
  medicine_id: number;
  name: string;
  qty_sold: number;
  revenue: string;
};

export type Analytics = {
  from: string;
  to: string;
  daily_revenue: DailyRevenue[];
  best_sellers: BestSeller[];
};

/**
 * fetch() that sends the signed-in user's token to Django.
 * If Django answers 401 the session is no longer valid, so we tell the
 * auth provider to sign the user out.
 */
export async function authFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:unauthorized"));
  }
  return response;
}