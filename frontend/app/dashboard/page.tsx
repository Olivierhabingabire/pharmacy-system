"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, authFetch, type Analytics, type Medicine } from "@/lib/api";
import { compact, money } from "@/lib/format";
import { daysFromToday, shortDate } from "@/lib/status";
import { useLanguage } from "@/lib/language";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; analytics: Analytics; medicines: Medicine[] };

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await authFetch(url, { signal });
  if (!response.ok) {
    throw new Error(`The server answered ${response.status}.`);
  }
  return (await response.json()) as T;
}

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getJson<Analytics>(
        `${API_URL}/analytics/?days=7&limit=5`,
        controller.signal,
      ),
      getJson<Medicine[]>(`${API_URL}/medicines/`, controller.signal),
    ])
      .then(([analytics, medicines]) =>
        setState({ status: "ready", analytics, medicines }),
      )
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

  const locale = language === "fr" ? "fr-FR" : language === "rw" ? "rw-RW" : "en-GB";
  const today = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Dashboard")}</h1>
          <p className="mt-1 text-sm text-muted">{today}</p>
        </div>
        <Link
          href="/sales"
          className="rounded-xl bg-[#e90074] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-pink-200 transition hover:bg-[#c90062]"
        >
          {t("New sale")}
        </Link>
      </header>

      {state.status === "loading" && <Skeleton />}

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
            {t("Try again")}
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <Overview analytics={state.analytics} medicines={state.medicines} />
      )}
    </main>
  );
}

function Overview({
  analytics,
  medicines,
}: {
  analytics: Analytics;
  medicines: Medicine[];
}) {
  const { t } = useLanguage();
  const days = analytics.daily_revenue;
  const todayRow = days[days.length - 1];

  const expired = medicines.filter((m) => daysFromToday(m.expiry_date) < 0);
  const live = medicines.filter((m) => daysFromToday(m.expiry_date) >= 0);
  const outOfStock = live.filter((m) => m.stock === 0);
  const lowStock = live.filter((m) => m.stock > 0 && m.stock < 10);
  const expiringSoon = live.filter((m) => daysFromToday(m.expiry_date) <= 30);
  const flagged = new Set(
    [...expired, ...outOfStock, ...lowStock, ...expiringSoon].map((m) => m.id),
  );

  return (
    <>
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-rule bg-rule shadow-sm sm:grid-cols-4">
        <Stat label={t("Revenue today")} value={`${money(todayRow?.revenue ?? 0)} RWF`} />
        <Stat label={t("Receipts today")} value={String(todayRow?.receipts ?? 0)} />
        <Stat label={t("Items sold today")} value={String(todayRow?.items_sold ?? 0)} />
        <Stat
          label={t("Medicines needing attention")}
          value={String(flagged.size)}
          tone={flagged.size > 0 ? "alert" : "normal"}
        />
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          <section aria-labelledby="revenue-heading" className="rounded-2xl border border-rule bg-white p-5 shadow-sm sm:p-6">
            <h2 id="revenue-heading" className="font-semibold text-pine">
              {t("Sales, last 7 days")}
            </h2>
            <RevenueBars days={days} />
          </section>

          <section aria-labelledby="sellers-heading" className="rounded-2xl border border-rule bg-white p-5 shadow-sm sm:p-6">
            <h2 id="sellers-heading" className="font-semibold text-pine">
              {t("Best sellers")}
            </h2>
            <BestSellers sellers={analytics.best_sellers} />
          </section>
        </div>

        <aside aria-labelledby="attention-heading" className="max-lg:order-first rounded-2xl border border-rule bg-white p-5 shadow-sm sm:p-6">
          <h2 id="attention-heading" className="font-semibold text-pine">
            {t("Needs attention")}
          </h2>
          <Attention
            groups={[
              {
                key: "expired",
                title: t("Expired"),
                tone: "red",
                items: expired,
                note: (m) => `expired ${shortDate(m.expiry_date)}`,
              },
              {
                key: "expiring",
                title: t("Expires within 30 days"),
                tone: "amber",
                items: expiringSoon,
                note: (m) => `${daysFromToday(m.expiry_date)} days left`,
              },
              {
                key: "out",
                title: t("Out of stock"),
                tone: "red",
                items: outOfStock,
                note: () => "0 left",
              },
              {
                key: "low",
                title: t("Low stock"),
                tone: "amber",
                items: lowStock,
                note: (m) => `${m.stock} left`,
              },
            ]}
          />
        </aside>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "alert";
}) {
  return (
    <div className="bg-surface p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "alert" ? "text-red" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function RevenueBars({ days }: { days: Analytics["daily_revenue"] }) {
  const { t, language } = useLanguage();
  const values = days.map((d) => Number(d.revenue));
  const max = Math.max(...values, 0);

  if (max === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-rule p-6 text-sm text-muted">
        {t("No sales in the last 7 days. Complete a sale and it will appear here.")}
      </p>
    );
  }

  return (
    <div
      className="mt-4"
      role="img"
      aria-label={`Revenue per day: ${days
        .map((d, i) => `${d.date} ${money(values[i])} RWF`)
        .join(", ")}`}
    >
      <div className="flex h-44 items-end gap-3 border-b border-rule">
        {days.map((d, i) => {
          const pct = (values[i] / max) * 100;
          const isPeak = values[i] === max;
          return (
            <div
              key={d.date}
              className="relative flex h-full flex-1 items-end justify-center"
            >
              {values[i] > 0 && (
                <span
                  className="absolute text-xs tabular-nums text-muted"
                  style={{ bottom: `calc(${pct * 0.88}% + 6px)` }}
                >
                  {compact(values[i])}
                </span>
              )}
              <div
                className={`w-full max-w-12 rounded-t ${
                  isPeak ? "bg-cross" : "bg-pine/70"
                } ${values[i] === 0 ? "h-0.5 bg-rule" : ""}`}
                style={values[i] > 0 ? { height: `${pct * 0.88}%` } : undefined}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 text-xs text-muted">
        {days.map((d, i) => (
          <span
            key={d.date}
            className={`flex-1 text-center ${
              i === days.length - 1 ? "font-semibold text-ink" : ""
            }`}
          >
            {new Date(`${d.date}T00:00:00`).toLocaleDateString(language === "fr" ? "fr-FR" : language === "rw" ? "rw-RW" : "en-GB", {
              weekday: "short",
            })}
          </span>
        ))}
      </div>
    </div>
  );
}

function BestSellers({ sellers }: { sellers: Analytics["best_sellers"] }) {
  const { t } = useLanguage();
  if (sellers.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-rule p-6 text-sm text-muted">
        {t("Best sellers appear after the first receipt.")}
      </p>
    );
  }
  const max = Math.max(...sellers.map((s) => s.qty_sold), 1);
  return (
    <ul className="mt-3 divide-y divide-rule border-y border-rule">
      {sellers.map((s) => (
        <li key={s.medicine_id} className="py-3">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <Link
              href={`/medicines/${s.medicine_id}`}
              className="font-medium hover:underline"
            >
              {s.name}
            </Link>
            <span className="tabular-nums text-muted">
              {s.qty_sold} sold, {money(s.revenue)} RWF
            </span>
          </div>
          <div className="mt-2 h-1 rounded bg-rule">
            <div
              className="h-1 rounded bg-cross"
              style={{ width: `${(s.qty_sold / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

type Group = {
  key: string;
  title: string;
  tone: "red" | "amber";
  items: Medicine[];
  note: (m: Medicine) => string;
};

function Attention({ groups }: { groups: Group[] }) {
  const { t } = useLanguage();
  const active = groups.filter((g) => g.items.length > 0);

  if (active.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-rule bg-surface p-5 text-sm text-muted">
        {t("Nothing needs attention. Stock levels and expiry dates look fine.")}
      </p>
    );
  }

  return (
    <div className="mt-3 divide-y divide-rule rounded-lg border border-rule bg-surface">
      {active.map((g) => (
        <section key={g.key} className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <span
              className={`h-2 w-2 rounded-full ${
                g.tone === "red" ? "bg-red" : "bg-amber"
              }`}
              aria-hidden="true"
            />
            {t(g.title)}
            <span className="font-normal tabular-nums text-muted">
              {g.items.length}
            </span>
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {g.items.slice(0, 4).map((m) => (
              <li key={m.id} className="flex justify-between gap-3">
                <Link
                  href={`/medicines/${m.id}`}
                  className="truncate hover:underline"
                >
                  {m.name}
                </Link>
                <span className="shrink-0 tabular-nums text-muted">
                  {g.note(m)}
                </span>
              </li>
            ))}
          </ul>
          {g.items.length > 4 && (
            <Link
              href={`/medicines?filter=${g.key}`}
              className="mt-2 inline-block text-sm font-medium text-ok hover:underline"
            >
              View all {g.items.length}
            </Link>
          )}
        </section>
      ))}
    </div>
  );
}

function Skeleton() {
  const { t } = useLanguage();
  return (
    <div className="mt-8 space-y-6" aria-busy="true" aria-label={t("Loading…")}>
      <div className="h-20 rounded-lg bg-rule motion-safe:animate-pulse" />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="h-64 rounded-lg bg-rule motion-safe:animate-pulse" />
        <div className="h-64 rounded-lg bg-rule motion-safe:animate-pulse" />
      </div>
    </div>
  );
}