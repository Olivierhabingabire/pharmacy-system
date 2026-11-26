"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingBag } from "lucide-react";
import { API_URL, authFetch, type CustomerMedicine } from "@/lib/api";
import { money } from "@/lib/format";
import { useLanguage } from "@/lib/language";

type CatalogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; medicines: CustomerMedicine[] };

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return body.detail ?? `The server answered ${response.status}.`;
}

export default function CustomerCatalogPage() {
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    authFetch(`${API_URL}/customer/medicines/`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return (await response.json()) as CustomerMedicine[];
      })
      .then((medicines) => setCatalog({ status: "ready", medicines }))
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setCatalog({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [attempt]);

  const visible = useMemo(() => {
    if (catalog.status !== "ready") return [];
    const query = search.trim().toLowerCase();
    return catalog.medicines.filter((medicine) =>
      medicine.name.toLowerCase().includes(query),
    );
  }, [catalog, search]);
  const cartItems =
    catalog.status === "ready"
      ? catalog.medicines.filter((medicine) => (quantities[medicine.id] ?? 0) > 0)
      : [];
  const total = cartItems.reduce(
    (sum, medicine) =>
      sum + Number(medicine.price) * (quantities[medicine.id] ?? 0),
    0,
  );

  async function submitOrder() {
    if (!cartItems.length || submitting) return;
    setSubmitting(true);
    setProblem(null);
    setNotice(null);
    try {
      const response = await authFetch(`${API_URL}/customer/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((medicine) => ({
            medicine_id: medicine.id,
            qty: quantities[medicine.id],
          })),
          customer_note: note.trim(),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setQuantities({});
      setNote("");
      setNotice(t("Your request was sent. A pharmacist will review it shortly."));
    } catch (error) {
      setProblem(
        error instanceof Error ? t(error.message) : t("Could not submit your request."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[#c90062]">
            {t("CUSTOMER PORTAL")}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-pine">
            {t("Browse medicines")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {t("View current prices and request medicines for pickup. Stock is not reserved until a pharmacist reviews and approves your request.")}
          </p>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Search medicines")}
              aria-label={t("Search medicines")}
              className="w-full rounded-xl border border-rule bg-white py-2.5 pl-9 pr-3 text-sm focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/20"
            />
          </div>

          {catalog.status === "loading" && (
            <p className="mt-6 text-sm text-muted">{t("Loading available medicines…")}</p>
          )}
          {catalog.status === "error" && (
            <div className="mt-6 rounded-xl border border-red/30 bg-red-bg p-4 text-sm text-red">
              <p>{catalog.message}</p>
              <button
                onClick={() => {
                  setCatalog({ status: "loading" });
                  setAttempt((value) => value + 1);
                }}
                className="mt-3 font-semibold underline"
              >
                {t("Try again")}
              </button>
            </div>
          )}
          {catalog.status === "ready" && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-rule bg-white shadow-sm">
              {visible.length ? (
                <ul className="divide-y divide-rule">
                  {visible.map((medicine) => (
                    <li
                      key={medicine.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-pine">
                          {medicine.name}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {money(medicine.price)} RWF · {t("Available")}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <span className="sr-only">Quantity for {medicine.name}</span>
                        {t("Qty")}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={quantities[medicine.id] ?? 0}
                          onChange={(event) => {
                            const quantity = Math.min(
                              100,
                              Math.max(0, Number(event.target.value) || 0),
                            );
                            setQuantities((current) => ({
                              ...current,
                              [medicine.id]: quantity,
                            }));
                            setProblem(null);
                            setNotice(null);
                          }}
                          className="w-20 rounded-lg border border-rule px-2 py-2 text-center text-pine focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/20"
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-8 text-center text-sm text-muted">
                  {catalog.medicines.length
                    ? t("No available medicines match your search.")
                    : t("There are no medicines currently available to request.")}
                </p>
              )}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-[#f2c5da] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#c90062]" aria-hidden="true" />
            <h2 className="font-bold text-pine">{t("Your request")}</h2>
          </div>
          {cartItems.length ? (
            <>
              <ul className="mt-4 space-y-3">
                {cartItems.map((medicine) => {
                  const quantity = quantities[medicine.id];
                  return (
                    <li key={medicine.id} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 text-pine">
                        {medicine.name} <span className="text-muted">× {quantity}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-pine">
                        {money(Number(medicine.price) * quantity)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 border-t border-rule pt-3">
                <div className="flex justify-between font-bold text-pine">
                  <span>{t("Estimated total")}</span>
                  <span>{money(total)} RWF</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {t("Final price is confirmed by the pharmacist.")}
                </p>
              </div>
              <label className="mt-4 block text-sm font-semibold text-pine">
                {t("Note for the pharmacist (optional)")}
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-xl border border-rule px-3 py-2 text-sm font-normal focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/20"
                />
              </label>
              {problem && (
                <p role="alert" className="mt-3 rounded-lg bg-red-bg p-3 text-sm text-red">
                  {problem}
                </p>
              )}
              {notice && (
                <p role="status" className="mt-3 rounded-lg bg-ok-bg p-3 text-sm text-ok">
                  {notice}
                </p>
              )}
              <button
                onClick={submitOrder}
                disabled={submitting}
                className="mt-4 w-full rounded-xl bg-[#e90074] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t("Sending request…") : t("Request for pickup")}
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted">
              {t("Set the quantity beside any medicine to add it to your request.")}
            </p>
          )}
          <p className="mt-4 text-xs leading-5 text-muted">
            {t("This is a request, not a confirmed sale. A pharmacist must review the order and any prescription requirements.")}
          </p>
        </aside>
      </div>
    </main>
  );
}
