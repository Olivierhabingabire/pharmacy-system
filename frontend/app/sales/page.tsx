"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, type Medicine } from "@/lib/api";
import { medicineStatus } from "@/lib/status";

type Receipt = {
  receipt_id: string;
  sold_at: string;
  lines: {
    medicine_id: number;
    name: string;
    qty: number;
    unit_price: string;
    line_total: string;
  }[];
  total: string;
};

type Refusal = { medicine_id: number; name: string; error: string };

type Catalog =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; medicines: Medicine[] };

const money = (value: string | number) =>
  Number(value).toLocaleString("en-US");

export default function SalesPage() {
  const [catalog, setCatalog] = useState<Catalog>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<Refusal[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/medicines/`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`The server answered ${response.status}.`);
        }
        return (await response.json()) as Medicine[];
      })
      .then((medicines) => setCatalog({ status: "ready", medicines }))
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setCatalog({
          status: "error",
          message: error.message.startsWith("The server")
            ? error.message
            : "Could not reach the server. Is Django running on port 8000?",
        });
      });
    return () => controller.abort();
  }, [attempt]);

  const medicines = catalog.status === "ready" ? catalog.medicines : [];
  const byId = new Map(medicines.map((m) => [m.id, m]));
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ medicine: byId.get(Number(id)), qty }))
    .filter(
      (line): line is { medicine: Medicine; qty: number } => !!line.medicine,
    );
  const runningTotal = lines.reduce(
    (sum, line) => sum + Number(line.medicine.price) * line.qty,
    0,
  );

  function setQty(id: number, qty: number) {
    setCart((current) => {
      const next = { ...current };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  async function completeSale() {
    if (submitting || lines.length === 0) return;
    setSubmitting(true);
    setProblem(null);
    setRefusals([]);
    try {
      const response = await fetch(`${API_URL}/sales/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            medicine_id: l.medicine.id,
            qty: l.qty,
          })),
        }),
      });
      if (response.status === 201) {
        setReceipt((await response.json()) as Receipt);
        setCart({});
        setAttempt((n) => n + 1); // stock changed, so reload the list
      } else if (response.status === 400) {
        const body = (await response.json()) as {
          detail?: string;
          errors?: Refusal[];
        };
        setProblem(body.detail ?? "The sale could not be processed.");
        setRefusals(body.errors ?? []);
      } else if (response.status === 404) {
        setProblem("A medicine in the cart no longer exists. Reload the page.");
      } else {
        setProblem(`The server answered ${response.status}.`);
      }
    } catch {
      setProblem("Could not reach the server. Is Django running on port 8000?");
    } finally {
      setSubmitting(false);
    }
  }

  function newSale() {
    setReceipt(null);
    setProblem(null);
    setRefusals([]);
  }

  if (receipt) {
    return <ReceiptView receipt={receipt} onNewSale={newSale} />;
  }

  const shown = medicines.filter((m) =>
    m.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link href="/medicines" className="text-sm text-blue-400 hover:underline">
        ← Medicines
      </Link>
      <h1 className="mt-2 text-2xl font-bold">New sale</h1>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="font-semibold">1. Choose medicines</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="mt-2 w-full rounded border border-gray-300 bg-white p-2 text-black placeholder-gray-500"
          />

          {catalog.status === "loading" && (
            <p className="mt-4 text-gray-500">Loading medicines…</p>
          )}

          {catalog.status === "error" && (
            <div className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-red-800">
              <p>{catalog.message}</p>
              <button
                onClick={() => {
                  setCatalog({ status: "loading" });
                  setAttempt((n) => n + 1);
                }}
                className="mt-3 rounded bg-red-700 px-3 py-1 text-white"
              >
                Try again
              </button>
            </div>
          )}

          {catalog.status === "ready" && (
            <ul className="mt-3 max-h-[28rem] divide-y divide-gray-700 overflow-y-auto rounded border border-gray-700">
              {shown.length === 0 && (
                <li className="p-3 text-gray-500">No medicine matches.</li>
              )}
              {shown.map((m) => {
                const status = medicineStatus(m);
                const unavailable =
                  status.label === "Expired" || status.label === "Out of stock";
                const inCart = cart[m.id] ?? 0;
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 p-2 text-sm"
                  >
                    <div>
                      <div>{m.name}</div>
                      <div className="text-xs text-gray-500">
                        {money(m.price)} RWF · stock {m.stock}{" "}
                        <span
                          className={`rounded px-1.5 py-0.5 ${status.style}`}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setQty(m.id, inCart + 1)}
                      disabled={unavailable || inCart >= m.stock}
                      className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-semibold">2. Cart</h2>

          {lines.length === 0 ? (
            <p className="mt-3 rounded border border-gray-700 p-4 text-gray-500">
              The cart is empty. Add medicines from the list.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-700 rounded border border-gray-700">
              {lines.map(({ medicine, qty }) => (
                <li key={medicine.id} className="p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{medicine.name}</span>
                    <span>{money(Number(medicine.price) * qty)} RWF</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => setQty(medicine.id, qty - 1)}
                      className="rounded border border-gray-500 px-2"
                      aria-label={`One less ${medicine.name}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center">{qty}</span>
                    <button
                      onClick={() => setQty(medicine.id, qty + 1)}
                      disabled={qty >= medicine.stock}
                      className="rounded border border-gray-500 px-2 disabled:opacity-40"
                      aria-label={`One more ${medicine.name}`}
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-500">
                      × {money(medicine.price)}
                    </span>
                    <button
                      onClick={() => setQty(medicine.id, 0)}
                      className="ml-auto text-xs text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{money(runningTotal)} RWF</span>
          </div>
          <p className="text-xs text-gray-500">
            The server recalculates the final total from the database prices.
          </p>

          <button
            onClick={completeSale}
            disabled={submitting || lines.length === 0}
            className="mt-4 w-full rounded bg-green-600 px-4 py-2 text-white disabled:opacity-40"
          >
            {submitting ? "Processing…" : "Complete sale"}
          </button>

          {problem && (
            <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <p>{problem}</p>
              {refusals.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {refusals.map((r) => (
                    <li key={r.medicine_id}>
                      {r.name}: {r.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ReceiptView({
  receipt,
  onNewSale,
}: {
  receipt: Receipt;
  onNewSale: () => void;
}) {
  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded border border-gray-500 p-5">
        <h1 className="text-xl font-bold">Receipt</h1>
        <p className="mt-1 text-xs text-gray-500">
          No. {receipt.receipt_id}
          <br />
          {new Date(receipt.sold_at).toLocaleString()}
        </p>

        <table className="mt-4 w-full text-sm">
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.medicine_id} className="border-b border-gray-700">
                <td className="py-2">
                  {line.name}
                  <div className="text-xs text-gray-500">
                    {line.qty} × {money(line.unit_price)}
                  </div>
                </td>
                <td className="py-2 text-right">{money(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{money(receipt.total)} RWF</span>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={onNewSale}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          New sale
        </button>
        <button
          onClick={() => window.print()}
          className="rounded border border-gray-500 px-4 py-2"
        >
          Print
        </button>
      </div>
    </main>
  );
}