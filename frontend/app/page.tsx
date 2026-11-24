"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  CircleCheck,
  ClipboardList,
  PackageCheck,
  Pill,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const features = [
  {
    icon: Boxes,
    title: "Stock, clearly managed",
    description:
      "See what is available, spot low stock, and keep expiry dates in view.",
  },
  {
    icon: ShieldCheck,
    title: "Safer sales at the counter",
    description:
      "Sales are checked against live prices, stock levels, and expiry dates.",
  },
  {
    icon: BarChart3,
    title: "A useful view of your business",
    description:
      "Managers can follow daily sales, revenue, and the medicines customers choose.",
  },
];

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-cross">
        <Pill className="h-5 w-5 -rotate-45 text-pine" aria-hidden="true" />
      </span>
      <span className="text-base font-bold tracking-tight text-pine">
        Pharmacy Desk
      </span>
    </span>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div
        className="absolute -inset-5 rounded-[2rem] bg-cross/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-2xl border border-rule bg-white shadow-[0_24px_80px_-28px_rgba(12,42,36,0.3)]">
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-pine">
              <Pill className="h-5 w-5 text-cross" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Today at a glance</p>
              <p className="text-xs text-muted">Your pharmacy overview</p>
            </div>
          </div>
          <span className="rounded-full bg-ok-bg px-2.5 py-1 text-xs font-medium text-ok">
            Live overview
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {[
            { label: "Today's sales", value: "RWF 248,500", icon: TrendingUp },
            { label: "Receipts", value: "36", icon: ClipboardList },
            { label: "In stock", value: "128 items", icon: PackageCheck },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-rule bg-paper/60 p-3.5"
            >
              <Icon className="h-4 w-4 text-ok" aria-hidden="true" />
              <p className="mt-3 text-xs text-muted">{label}</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-pine">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Stock health</p>
            <span className="text-xs text-muted">This week</span>
          </div>
          <div className="mt-4 flex h-24 items-end gap-2 rounded-xl bg-paper/60 px-4 pt-3">
            {[38, 55, 45, 70, 53, 86, 66, 96, 72, 81, 60, 90].map(
              (height, index) => (
                <span
                  key={index}
                  className={`flex-1 rounded-t-sm ${
                    index === 7 ? "bg-cross" : "bg-pine/15"
                  }`}
                  style={{ height: `${height}%` }}
                />
              ),
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-rule bg-ok-bg/50 px-5 py-3.5">
          <CircleCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
          <p className="text-xs text-ok">
            Every sale checked for stock and expiry before it is completed.
          </p>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2.5 rounded-xl border border-rule bg-white px-4 py-3 shadow-lg sm:flex">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ok-bg">
          <Check className="h-4 w-4 text-ok" aria-hidden="true" />
        </span>
        <span className="text-xs font-medium text-pine">
          Expired items blocked at checkout
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { state } = useAuth();
  const destination =
    state.status === "signedIn"
      ? state.user.role === "manager"
        ? "/dashboard"
        : "/sales"
      : "/login";
  const actionLabel =
    state.status === "signedIn" ? "Open your workspace" : "Staff sign in";

  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Pharmacy Desk home">
          <Brand />
        </Link>
        <nav className="flex items-center gap-5 sm:gap-8" aria-label="Main">
          <a
            href="#features"
            className="hidden text-sm font-medium text-muted transition hover:text-pine sm:inline"
          >
            Features
          </a>
          <Link
            href={destination}
            className="rounded-lg border border-rule px-4 py-2.5 text-sm font-semibold text-pine transition hover:border-pine/30 hover:bg-paper"
          >
            {actionLabel}
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1fr_1.04fr] lg:gap-12 lg:px-12 lg:pb-28 lg:pt-20">
        <div className="absolute -left-48 top-0 h-96 w-96 rounded-full bg-cross/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-cross/20 bg-cross/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-cross" />
            MADE FOR THE PHARMACY COUNTER
          </div>
          <h1 className="mt-6 max-w-xl text-5xl font-bold leading-[1.08] tracking-[-0.045em] text-pine sm:text-6xl lg:text-[4.25rem]">
            Your pharmacy, <span className="text-ok">in good hands.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Pharmacy Desk brings stock, sales, and reporting together—so your
            team can serve customers with confidence and keep the day moving.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={destination}
              className="group inline-flex items-center gap-2 rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-pine/15 transition hover:-translate-y-0.5 hover:bg-[#123a32]"
            >
              {actionLabel}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <a
              href="#features"
              className="rounded-lg px-4 py-3 text-sm font-semibold text-pine transition hover:bg-paper"
            >
              Explore the features
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {["Expiry-aware checkout", "Live stock tracking"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CircleCheck className="h-4 w-4 text-ok" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative px-1 py-2 sm:px-5 sm:py-6 lg:px-0">
          <DashboardPreview />
        </div>
      </section>

      <section className="border-y border-rule bg-paper/60">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-rule px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-12">
          {[
            ["One clear view", "Know what is selling and what needs attention."],
            ["Confident checkout", "Catch expired and out-of-stock items in time."],
            ["Built for your team", "Simple tools for pharmacists and managers."],
          ].map(([title, detail], index) => (
            <div
              key={title}
              className={`flex items-start gap-3 py-5 md:px-6 lg:py-6 ${
                index === 0 ? "md:pl-0" : ""
              }`}
            >
              <CircleCheck
                className="mt-0.5 h-5 w-5 shrink-0 text-ok"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-sm font-semibold text-pine">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-ok">
            EVERYTHING IN ONE PLACE
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-pine sm:text-4xl">
            Less guesswork. Better care.
          </h2>
          <p className="mt-4 leading-7 text-muted">
            Spend less time chasing numbers and more time looking after the
            people who count on your pharmacy.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-2xl border border-rule bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-pine/5"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-ok-bg">
                <Icon className="h-5 w-5 text-ok" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-semibold text-pine">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 sm:flex-row sm:px-8 lg:px-12">
          <Link href="/" aria-label="Pharmacy Desk home">
            <Brand />
          </Link>
          <p className="text-sm text-muted">
            Stock and sales, made simpler for your pharmacy.
          </p>
          <Link
            href={destination}
            className="text-sm font-semibold text-ok transition hover:text-pine"
          >
            {actionLabel}
          </Link>
        </div>
      </footer>
    </main>
  );
}
