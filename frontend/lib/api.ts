export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type Medicine = {
  id: number;
  name: string;
  price: string;
  stock: number;
  expiry_date: string;
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