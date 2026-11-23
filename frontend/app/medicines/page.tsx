"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import SlideOver from "@/components/SlideOver";
import { API_URL, authFetch, type Medicine } from "@/lib/api";
import { money } from "@/lib/format";
import { daysFromToday, medicineStatus, shortDate } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import MedicineForm from "./MedicineForm";

const PAGE_SIZE = 25;

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  {
    key: "expired",
    label: "Expired",
    test: (m: Medicine) => daysFromToday(m.expiry_date) < 0,
  },
  {
    key: "expiring",
    label: "Expires within 30 days",
    test: (m: Medicine) => {
      const d = daysFromToday(m.expiry_date);
      return d >= 0 && d <= 30;
    },
  },
  {
    key: "out",
    label: "Out of stock",
    test: (m: Medicine) => daysFromToday(m.expiry_date) >= 0 && m.stock === 0,
  },
  {
    key: "low",
    label: "Low stock",
    test: (m: Medicine) =>
      daysFromToday(m.expiry_date) >= 0 && m.stock > 0 && m.stock < 10,
  },
];

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; medicines: Medicine[] };

export default function MedicinesPage() {
  return (
    <Suspense fallback={null}>
      <MedicinesView />
    </Suspense>
  );
}

function MedicinesView() {
  const router = useRouter();
  const { state: auth } = useAuth();
  const canEdit = auth.status === "signedIn" && auth.user.role === "manager";
  const params = useSearchParams();
  const filterKey = FILTERS.some((f) => f.key === params.get("filter"))
    ? (params.get("filter") as string)
    : "all";

  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const closePanel = useCallback(() => setAdding(false), []);

  useEffect(() => {
    const controller = new AbortController();
    authFetch(`${API_URL}/medicines/`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`The server answered ${response.status}.`);
        }
        return (await response.json()) as Medicine[];
      })
      .then((medicines) => setState({ status: "ready", medicines }))
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setState({
          status: "error",
          message: error.message.startsWith("The server")
            ? error.message
            : "Could not reach the server. Is Django running on port 8000?",
        });
      });
    return () => controller.abort();
  }, [attempt]);

  function chooseFilter(key: string) {
    setPage(0);
    router.replace(key === "all" ? "/medicines" : `/medicines?filter=${key}`);
  }

  const medicines = state.status === "ready" ? state.medicines : [];
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const needle = search.trim().toLowerCase();
  const rows = medicines.filter(
    (m) => filter.test(m) && m.name.toLowerCase().includes(needle),
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Medicines</h1>
          <p className="mt-1 text-sm text-muted">
            {state.status === "ready"
              ? `${medicines.length} medicines in stock records`
              : "Stock, prices and expiry dates"}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-[#123a32]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add medicine
          </button>
        )}
      </header>

      {state.status === "loading" && (
        <div className="mt-8 space-y-3" aria-busy="true" aria-label="Loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 rounded-md bg-rule motion-safe:animate-pulse"
            />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-8 rounded-lg border border-red/30 bg-red-bg p-4 text-sm text-red">
          <p>{state.message}</p>
          <button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="mt-3 rounded-md bg-red px-3 py-1.5 font-medium text-white"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter">
            {FILTERS.map((f) => {
              const count = medicines.filter(f.test).length;
              const active = f.key === filterKey;
              return (
                <button
                  key={f.key}
                  onClick={() => chooseFilter(f.key)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    active
                      ? "border-pine bg-pine text-white"
                      : "border-rule bg-surface hover:border-pine/40"
                  }`}
                >
                  {f.label}{" "}
                  <span
                    className={`tabular-nums ${active ? "text-white/70" : "text-muted"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative mt-4 max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search by name"
              aria-label="Search by name"
              className="w-full rounded-md border border-rule bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/30"
            />
          </div>

          {medicines.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-rule p-8 text-center text-sm text-muted">
              {canEdit
                ? "No medicines yet. Use “Add medicine” to create the first one."
                : "No medicines have been added yet."}
            </p>
          ) : rows.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-rule p-8 text-center text-sm text-muted">
              <p>No medicine matches these filters.</p>
              <button
                onClick={() => {
                  setSearch("");
                  chooseFilter("all");
                }}
                className="mt-2 font-medium text-ok hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto rounded-lg border border-rule bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-rule text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                        Price (RWF)
                      </th>
                      <th className="px-4 py-3 text-right font-medium">Stock</th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">Expires</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {visible.map((m) => {
                      const b = medicineStatus(m);
                      return (
                        <tr key={m.id} className="hover:bg-paper">
                          <td className="px-4 py-3">
                            <Link
                              href={`/medicines/${m.id}`}
                              className="font-medium hover:underline"
                            >
                              {m.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted sm:hidden">
                              {money(m.price)} RWF, expires{" "}
                              {shortDate(m.expiry_date)}{" "}
                              {m.expiry_date.slice(0, 4)}
                            </p>
                          </td>
                          <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                            {money(m.price)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {m.stock}
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-3 tabular-nums sm:table-cell">
                            {shortDate(m.expiry_date)}{" "}
                            <span className="text-muted">
                              {m.expiry_date.slice(0, 4)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {b.label !== "OK" && (
                              <span
                                className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${b.style}`}
                              >
                                {b.label}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm text-muted">
                <p className="tabular-nums">
                  {current * PAGE_SIZE + 1} to{" "}
                  {current * PAGE_SIZE + visible.length} of {rows.length}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(current - 1)}
                    disabled={current === 0}
                    className="rounded-md border border-rule bg-surface px-3 py-1 text-ink disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(current + 1)}
                    disabled={current >= pageCount - 1}
                    className="rounded-md border border-rule bg-surface px-3 py-1 text-ink disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {canEdit && (
        <SlideOver open={adding} title="Add a medicine" onClose={closePanel}>
          <MedicineForm
            submitLabel="Add medicine"
            successText="Medicine added."
            method="POST"
            url={`${API_URL}/medicines/`}
            successStatus={201}
            resetOnSuccess
            onSaved={() => setAttempt((n) => n + 1)}
          />
        </SlideOver>
      )}
    </main>
  );
}