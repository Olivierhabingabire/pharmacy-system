"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CircleCheck,
  Pill,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  CustomerSupportDetails,
  SocialLinks,
} from "@/components/CustomerSupport";

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

function PharmacistHero() {
  return (
    <figure className="relative mx-auto w-full max-w-[34rem] px-2 pb-10 sm:px-5">
      <div
        className="absolute -inset-x-5 -inset-y-4 rounded-[3rem] bg-gradient-to-br from-cross/20 via-cross/5 to-transparent blur-2xl"
        aria-hidden="true"
      />
      <div className="relative aspect-[4/4.6] overflow-hidden rounded-[2rem] border-4 border-white bg-paper shadow-[0_30px_90px_-35px_rgba(12,42,36,0.45)] sm:rounded-[2.5rem]">
        <Image
          src="/pharmacist-hero.jpg"
          alt="A pharmacist in a white coat standing in a well-stocked pharmacy"
          fill
          priority
          sizes="(max-width: 1024px) 90vw, 42vw"
          className="object-cover object-[center_30%]"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-pine/80 via-pine/20 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 sm:inset-x-7 sm:bottom-7">
          <div className="text-white">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/75">
              Made for pharmacy teams
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
              Better visibility. Smoother days.
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
            <CircleCheck className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[11px] text-muted">
        Photo by{" "}
        <a
          href="https://www.pexels.com/photo/young-pharmacist-in-drugstore-19471013/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-pine"
        >
          BYB BYB on Pexels
        </a>
      </figcaption>
    </figure>
  );
}

export default function LandingPage() {
  const { state } = useAuth();
  const destination =
    state.status === "signedIn"
      ? state.user.role === "manager"
        ? "/dashboard"
        : state.user.role === "pharmacist"
          ? "/sales"
          : "/login"
      : "/login";
  const actionLabel =
    state.status !== "signedIn"
      ? "Staff sign in"
      : state.user.role === null
        ? "Activate account"
        : "Open your workspace";

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfcfa]">
      <header className="relative z-10 border-b border-rule/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
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
              className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#123a32] hover:shadow-md"
            >
              {actionLabel}
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative isolate mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:px-12 lg:pb-24 lg:pt-20">
        <div
          className="pointer-events-none absolute -left-56 top-0 -z-10 h-[34rem] w-[34rem] rounded-full bg-cross/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cross/20 bg-white px-3.5 py-2 text-[11px] font-bold tracking-[0.15em] text-ok shadow-sm">
            <span className="h-2 w-2 rounded-full bg-cross ring-4 ring-cross/10" />
            PHARMACY OPERATIONS, MADE SIMPLE
          </div>
          <h1 className="mt-7 text-[2.75rem] font-bold leading-[1.04] tracking-[-0.055em] text-pine sm:text-6xl lg:text-[4.5rem]">
            A clearer view of{" "}
            <span className="text-ok">your pharmacy.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Bring stock, sales, and reporting together in one calm, practical
            workspace—so your team can spend less time chasing details and more
            time caring for customers.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={destination}
              className="group inline-flex items-center gap-2 rounded-full bg-pine px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-pine/15 transition hover:-translate-y-0.5 hover:bg-[#123a32] hover:shadow-xl"
            >
              {actionLabel}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <a
              href="#features"
              className="rounded-full px-5 py-3.5 text-sm font-semibold text-pine transition hover:bg-white"
            >
              See what it can do
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-rule/80 pt-5 text-sm font-medium text-muted">
            {["Expiry-aware checkout", "Live stock tracking"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-ok-bg">
                  <CircleCheck className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative px-1 py-2 sm:px-5 lg:px-0">
          <PharmacistHero />
        </div>
      </section>

      <section className="border-y border-white/10 bg-pine text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/10 px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-12">
          {[
            ["One clear view", "Know what is selling and what needs attention."],
            ["Confident checkout", "Catch expired and out-of-stock items in time."],
            ["Built for your team", "Simple tools for pharmacists and managers."],
          ].map(([title, detail], index) => (
            <div
              key={title}
              className={`flex items-start gap-4 py-6 md:px-6 lg:py-7 ${
                index === 0 ? "md:pl-0" : ""
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-cross">
                <CircleCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-white/65">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-ok">
            EVERYTHING IN ONE PLACE
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-pine sm:text-4xl">
            More time for what matters.
          </h2>
          <p className="mt-4 leading-7 text-muted sm:text-lg">
            Thoughtful tools to keep everyday pharmacy work clear, connected,
            and under control.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="group rounded-3xl border border-rule/80 bg-white p-7 shadow-[0_8px_30px_-20px_rgba(12,42,36,0.2)] transition duration-200 hover:-translate-y-1 hover:border-cross/30 hover:shadow-[0_24px_50px_-25px_rgba(12,42,36,0.22)] sm:p-8"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ok-bg transition-colors group-hover:bg-cross/15">
                <Icon className="h-5 w-5 text-ok" aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-lg font-semibold tracking-tight text-pine">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-rule bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_1fr_0.8fr] lg:px-12 lg:py-14">
          <div className="flex flex-col items-start gap-4">
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

          <div>
            <CustomerSupportDetails />
          </div>

          <SocialLinks />
        </div>
      </footer>
    </main>
  );
}
