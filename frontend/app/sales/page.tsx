"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, Printer, Search, X } from "lucide-react";
import { API_URL, authFetch, type Medicine } from "@/lib/api";
import { money } from "@/lib/format";
import { medicineStatus } from "@/lib/status";
import { useLanguage } from "@/lib/language";

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

function isSellable(m: Medicine) {
  const label = medicineStatus(m).label;
  return label !== "Expired" && label !== "Out of stock";
}

export default function SalesPage() {
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState<Catalog>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<Refusal[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch(`${API_URL}/medicines/`, { signal: controller.signal })
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
            : t("Could not reach the server. Is Django running on port 8000?"),
        });
      });
    return () => controller.abort();
  }, [attempt, t]);

  const medicines = catalog.status === "ready" ? catalog.medicines : [];
  const byId = new Map(medicines.map((m) => [m.id, m]));
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ medicine: byId.get(Number(id)), qty }))
    .filter(
      (line): line is { medicine: Medicine; qty: number } => !!line.medicine,
    );
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);
  const runningTotal = lines.reduce(
    (sum, l) => sum + Number(l.medicine.price) * l.qty,
    0,
  );

  const needle = search.trim().toLowerCase();
  const shown = medicines.filter((m) => m.name.toLowerCase().includes(needle));

  function setQty(m: Medicine, qty: number) {
    setCart((current) => {
      const next = { ...current };
      if (qty <= 0) delete next[m.id];
      else next[m.id] = Math.min(qty, m.stock);
      return next;
    });
  }

  function addOne(m: Medicine) {
    setQty(m, (cart[m.id] ?? 0) + 1);
  }

  async function completeSale() {
    if (submitting || lines.length === 0) return;
    setSubmitting(true);
    setProblem(null);
    setRefusals([]);
    try {
      const response = await authFetch(`${API_URL}/sales/`, {
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
        setProblem(t(body.detail ?? "The sale could not be processed."));
        setRefusals(body.errors ?? []);
      } else if (response.status === 404) {
        setProblem(t("A medicine in the cart no longer exists. Reload the page."));
      } else {
        setProblem(`The server answered ${response.status}.`);
      }
    } catch {
      setProblem(t("Could not reach the server. Is Django running on port 8000?"));
    } finally {
      setSubmitting(false);
    }
  }

  function newSale() {
    setReceipt(null);
    setProblem(null);
    setRefusals([]);
    setSearch("");
  }

  if (receipt) {
    return <FinishedReceipt receipt={receipt} onNewSale={newSale} />;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 pb-28 md:px-8 lg:pb-8">
      <h1 className="text-2xl font-bold tracking-tight text-pine">{t("New sale")}</h1>
      <p className="mt-1 text-sm text-muted">
        {t("Search a medicine and press Enter to add it, or use the Add buttons.")}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label={t("Medicines")} className="min-w-0">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const first = shown.find(isSellable);
                if (first) {
                  addOne(first);
                  setSearch("");
                }
              }}
              placeholder={t("Search by name")}
              aria-label={t("Search medicines")}
              className="w-full rounded-xl border border-rule bg-surface py-3 pl-9 pr-3 text-sm placeholder:text-muted focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/20"
            />
          </div>

          {catalog.status === "loading" && (
            <div className="mt-4 space-y-2" aria-busy="true" aria-label={t("Loading…")}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-md bg-rule motion-safe:animate-pulse"
                />
              ))}
            </div>
          )}

          {catalog.status === "error" && (
            <div className="mt-4 rounded-lg border border-red/30 bg-red-bg p-4 text-sm text-red">
              <p>{catalog.message}</p>
              <button
                onClick={() => {
                  setCatalog({ status: "loading" });
                  setAttempt((n) => n + 1);
                }}
                className="mt-3 rounded-md bg-red px-3 py-1.5 font-medium text-white"
              >
                {t("Try again")}
              </button>
            </div>
          )}

          {catalog.status === "ready" && (
            <ul className="mt-4 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-surface shadow-sm lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto">
              {shown.length === 0 && (
                <li className="p-6 text-center text-sm text-muted">
                  {t("No medicine matches your search.")}
                </li>
              )}
              {shown.map((m) => {
                const status = medicineStatus(m);
                const sellable = isSellable(m);
                const inCart = cart[m.id] ?? 0;
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#fffafd]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="tabular-nums">
                          {money(m.price)} RWF
                        </span>
                        {" · "}
                        <span className="tabular-nums">{m.stock}</span> {t("in stock")}
                        {status.label !== "OK" && (
                          <span
                            className={`ml-2 whitespace-nowrap rounded px-1.5 py-0.5 font-medium ${status.style}`}
                          >
                            {t(status.label)}
                          </span>
                        )}
                      </p>
                    </div>
                    {sellable ? (
                      <button
                        onClick={() => addOne(m)}
                        disabled={inCart >= m.stock}
                        aria-label={`${t("Add")} ${m.name}`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#f1b1d0] px-3 py-1.5 text-sm font-semibold text-[#c90062] transition hover:border-[#e90074] hover:bg-[#e90074] hover:text-white disabled:opacity-40 disabled:hover:border-rule disabled:hover:bg-transparent disabled:hover:text-ink"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        {inCart > 0 ? `${t("Add")} (${inCart})` : t("Add")}
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs text-muted">
                        Cannot be sold
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside id="receipt" aria-label={t("Cart")} className="lg:sticky lg:top-6 lg:self-start">
          <Paper>
            <p className="text-center text-sm font-medium tracking-wide">
              PHARMACY DESK
            </p>
            <p className="mt-1 text-center text-xs text-muted">{t("Current sale")}</p>
            <Rule />

            {lines.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">
                {t("No items yet.")}
                <br />
                {t("Add a medicine to start.")}
              </p>
            ) : (
              <ul className="text-sm">
                {lines.map(({ medicine, qty }) => (
                  <li key={medicine.id} className="py-2">
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0 break-words">
                        {medicine.name}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {money(Number(medicine.price) * qty)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <button
                        onClick={() => setQty(medicine, qty - 1)}
                        aria-label={`${t("One less")} ${medicine.name}`}
                        className="grid h-6 w-6 place-items-center rounded border border-rule text-ink hover:bg-paper"
                      >
                        <Minus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="w-5 text-center tabular-nums text-ink">
                        {qty}
                      </span>
                      <button
                        onClick={() => setQty(medicine, qty + 1)}
                        disabled={qty >= medicine.stock}
                        aria-label={`${t("One more")} ${medicine.name}`}
                        className="grid h-6 w-6 place-items-center rounded border border-rule text-ink hover:bg-paper disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="tabular-nums">
                        x {money(medicine.price)}
                      </span>
                      <button
                        onClick={() => setQty(medicine, 0)}
                        aria-label={`${t("Remove")} ${medicine.name}`}
                        className="ml-auto text-muted hover:text-red"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Rule />
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">
                {itemCount}                 {t(itemCount === 1 ? "item" : "items")}
              </span>
              <span className="text-xl font-medium tabular-nums">
                {money(runningTotal)}{" "}
                <span className="text-sm text-muted">RWF</span>
              </span>
            </div>
            <p className="mt-2 pb-5 text-[11px] leading-snug text-muted">
              {t("The server recalculates the final total from the database prices.")}
            </p>
          </Paper>

          {problem && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red/30 bg-red-bg p-3 text-sm text-red"
            >
              <p className="font-medium">{problem}</p>
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

          <button
            onClick={completeSale}
            disabled={submitting || lines.length === 0}
            className="mt-4 w-full rounded-xl bg-[#e90074] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-pink-200 transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? t("Processing…") : t("Complete sale")}
          </button>
        </aside>
      </div>

      {lines.length > 0 && (
        <a
          href="#receipt"
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between bg-[#e90074] px-5 py-4 text-white shadow-[0_-8px_24px_rgba(201,0,98,0.18)] lg:hidden"
        >
          <span className="text-sm">
            {itemCount}             {t(itemCount === 1 ? "item" : "items")}
          </span>
          <span className="font-medium tabular-nums">
            {money(runningTotal)} RWF · {t("View cart")}
          </span>
        </a>
      )}
    </main>
  );
}

function Paper({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono">
      <div className="rounded-t-2xl border border-b-0 border-rule bg-surface px-5 pt-5">
        {children}
      </div>
      <div className="receipt-edge" aria-hidden="true" />
    </div>
  );
}

function Rule() {
  return <div className="my-3 border-t border-dashed border-muted/50" />;
}

function FinishedReceipt({
  receipt,
  onNewSale,
}: {
  receipt: Receipt;
  onNewSale: () => void;
}) {
  const { t, language } = useLanguage();
  const when = new Date(receipt.sold_at).toLocaleString(language === "fr" ? "fr-FR" : language === "rw" ? "rw-RW" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="mx-auto max-w-sm px-5 py-8">
      <div className="print:hidden">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-ok-bg text-ok">
          <Check className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {t("Sale recorded")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t("Stock has been updated. Print the receipt or start the next sale.")}
        </p>
      </div>

      <div className="mt-6 print:mt-0">
        <Paper>
          <p className="text-center text-sm font-medium tracking-wide">
            PHARMACY DESK
          </p>
          <p className="mt-1 text-center text-xs text-muted">
            Receipt {receipt.receipt_id.slice(0, 8).toUpperCase()}
            <br />
            {when}
          </p>
          <Rule />
          <ul className="text-sm">
            {receipt.lines.map((line) => (
              <li key={line.medicine_id} className="py-1.5">
                <div className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">{line.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {money(line.line_total)}
                  </span>
                </div>
                <p className="text-xs text-muted tabular-nums">
                  {line.qty} x {money(line.unit_price)}
                </p>
              </li>
            ))}
          </ul>
          <Rule />
          <div className="flex items-baseline justify-between">
            <span className="text-sm">{t("TOTAL")}</span>
            <span className="text-xl font-medium tabular-nums">
              {money(receipt.total)}{" "}
              <span className="text-sm text-muted">RWF</span>
            </span>
          </div>
          <p className="pb-5 pt-4 text-center text-xs text-muted">
            {t("Thank you")}
          </p>
        </Paper>
      </div>

      <div className="mt-6 flex gap-3 print:hidden">
        <button
          onClick={onNewSale}
          className="flex-1 rounded-xl bg-[#e90074] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c90062]"
        >
          {t("New sale")}
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md border border-rule bg-surface px-4 py-2.5 text-sm font-medium"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("Print")}
        </button>
      </div>
    </main>
  );
}