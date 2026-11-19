export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type Medicine = {
  id: number;
  name: string;
  price: string;
  stock: number;
  expiry_date: string;
};