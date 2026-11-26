"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Clock3,
  Heart,
  Mail,
  Plus,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  CustomerSupportDetails,
  SocialLinks,
} from "@/components/CustomerSupport";

const features = [
  {
    icon: Boxes,
    title: "Medicine stock, in view",
    description:
      "Keep quantities, prices, and expiry dates together. Spot low stock before it slows your team down.",
  },
  {
    icon: ShoppingCart,
    title: "Confident counter sales",
    description:
      "Process sales against current stock and prices, with checks for expired or unavailable medicine.",
  },
  {
    icon: BarChart3,
    title: "Useful business insights",
    description:
      "Give managers a clear view of sales, revenue, and the medicines customers choose.",
  },
];

const assurances = [
  { icon: ShieldCheck, title: "Stock you can trust", detail: "Clear inventory checks" },
  { icon: Clock3, title: "Ready for the counter", detail: "A smoother daily workflow" },
  { icon: Heart, title: "Care at the centre", detail: "Built for pharmacy teams" },
];

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e90074] text-white shadow-md shadow-pink-200">
        <Plus className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="text-[15px] font-bold leading-tight tracking-tight text-[#13213a] sm:text-base">
        Pharmacy <span className="text-[#e90074]">Desk</span>
        <span className="mt-0.5 block text-[10px] font-medium tracking-wide text-slate-500">
          STOCK. SALES. SIMPLIFIED.
        </span>
      </span>
    </span>
  );
}

function PharmacistHero() {
  return (
    <figure className="relative mx-auto w-full max-w-[36rem] px-2 pb-8 sm:px-5">
      <div
        className="absolute -inset-4 rounded-[2.5rem] bg-[#f7b8d7]/60 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative aspect-[1.16/1] overflow-hidden rounded-[1.8rem] border-[5px] border-white bg-[#ffe7f3] shadow-[0_25px_70px_-25px_rgba(181,16,93,0.35)] sm:rounded-[2rem]">
        <Image
          src="/pharmacist-hero.jpg"
          alt="A pharmacist in a white coat standing in a well-stocked pharmacy"
          fill
          priority
          sizes="(max-width: 1024px) 90vw, 42vw"
          className="object-cover object-[center_30%]"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#17162b]/80 via-[#17162b]/20 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 sm:inset-x-6 sm:bottom-6">
          <div className="text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 sm:text-xs">
              Your pharmacy, more connected
            </p>
            <p className="mt-1 text-base font-semibold sm:text-xl">
              Made for the people who care.
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#e90074] shadow-lg sm:h-12 sm:w-12">
            <Check className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </span>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-[10px] text-slate-500">
        Photo by{" "}
        <a
          href="https://www.pexels.com/photo/young-pharmacist-in-drugstore-19471013/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-[#bd005d]"
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
    <main className="min-h-screen overflow-hidden bg-[#fffafd] text-[#17213a]">
      <header className="relative z-10 border-b border-pink-100 bg-white/95 shadow-[0_2px_16px_rgba(70,20,50,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Pharmacy Desk home">
            <Brand />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-5" aria-label="Main">
            <a
              href="#home"
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#d50068] sm:inline-flex"
            >
              Home
            </a>
            <a
              href="#about"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-pink-50 hover:text-[#d50068] md:inline-flex"
            >
              About
            </a>
            <a
              href="#features"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-pink-50 hover:text-[#d50068] sm:inline-flex"
            >
              Services
            </a>
            <a
              href="#contact"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-pink-50 hover:text-[#d50068] lg:inline-flex"
            >
              Contact
            </a>
            <Link
              href={destination}
              className="ml-1 inline-flex items-center gap-2 rounded-full border border-[#f2a4cb] px-4 py-2 text-sm font-semibold text-[#c90062] transition hover:bg-[#fff0f7] sm:ml-3 sm:px-5"
            >
              <span className="hidden sm:inline">{actionLabel}</span>
              <span className="sm:hidden">Sign in</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <section
        id="home"
        className="relative isolate scroll-mt-20 overflow-hidden bg-gradient-to-br from-[#fff5fa] via-[#fffafd] to-[#ffe8f4]"
      >
        <div
          className="pointer-events-none absolute -left-40 top-12 -z-10 h-80 w-80 rounded-full bg-[#f9c5df]/50 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-36 top-0 -z-10 h-96 w-96 rounded-full bg-white/80 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:grid-cols-[1fr_1.04fr] lg:gap-12 lg:px-12 lg:pb-16 lg:pt-14">
          <div className="relative z-10 max-w-xl">
            <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-[#cf0065] sm:text-sm">
              WELCOME TO PHARMACY DESK
              <span className="h-px w-9 bg-[#ec5b9f]" aria-hidden="true" />
            </p>
            <h1 className="mt-4 text-[2.65rem] font-extrabold leading-[1.03] tracking-[-0.055em] text-[#142039] sm:text-6xl lg:text-[4.35rem]">
              A clearer view of{" "}
              <span className="text-[#e90074]">your pharmacy.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Manage medicine stock, make confident counter sales, and keep an
              eye on your business—all in one practical workspace for your
              pharmacy team.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={destination}
                className="group inline-flex items-center gap-2 rounded-full bg-[#e90074] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#e90074]/20 transition hover:-translate-y-0.5 hover:bg-[#c90062] hover:shadow-xl"
              >
                {actionLabel}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-[#f2a4cb] bg-white/70 px-5 py-3.5 text-sm font-semibold text-[#b9005a] transition hover:bg-white"
              >
                Explore features
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#f3c5db] pt-5 text-xs font-medium text-slate-600 sm:text-sm">
              {["Live stock visibility", "Expiry-aware checkout"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#fce0ee] text-[#ce0065]">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="relative px-1 sm:px-5 lg:px-0">
            <PharmacistHero />
          </div>
        </div>
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-7 w-full text-[#e90074] sm:h-10"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0 50c140-55 255-55 395 0s255 55 395 0 255-55 395 0 180 55 255 20v10H0Z"
          />
        </svg>
      </section>

      <section
        aria-label="Pharmacy Desk benefits"
        className="relative z-[1] bg-[#e90074] text-white shadow-[0_8px_24px_rgba(201,0,98,0.2)]"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-white/25 px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-12">
          {assurances.map(({ icon: Icon, title, detail }) => (
            <div
              key={title}
              className="flex items-center gap-3 py-4 md:justify-center md:px-5 lg:py-5"
            >
              <Icon className="h-7 w-7 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-0.5 text-xs text-white/80">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="scroll-mt-16 bg-gradient-to-b from-[#fffafd] to-[#fff5fa] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24"
      >
        <div id="about" className="mx-auto max-w-3xl scroll-mt-20 text-center">
          <div className="mx-auto flex max-w-xs items-center justify-center gap-3 text-[#ec5b9f]">
            <span className="h-px flex-1 bg-[#f3b2d1]" />
            <Heart className="h-5 w-5 fill-current" aria-hidden="true" />
            <span className="h-px flex-1 bg-[#f3b2d1]" />
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#142039] sm:text-4xl">
            More time for what{" "}
            <span className="text-[#e90074]">matters.</span>
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Pharmacy Desk brings everyday operations into one place, helping
            your team stay organized and serve customers with confidence.
          </p>
        </div>

        <div className="mx-auto mt-9 grid max-w-6xl gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="group flex gap-4 rounded-2xl border border-[#f8d5e6] bg-white p-5 shadow-[0_8px_24px_rgba(184,28,98,0.08)] transition duration-200 hover:-translate-y-1 hover:border-[#f0a3c8] hover:shadow-[0_18px_36px_rgba(184,28,98,0.14)] sm:gap-5 sm:p-6"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#fde2f0] text-[#e90074] transition group-hover:bg-[#e90074] group-hover:text-white">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-bold tracking-tight text-[#17213a]">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
                <Link
                  href={destination}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#d50068] transition hover:text-[#a90053]"
                >
                  Open your workspace
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer id="contact" className="scroll-mt-16 border-t border-[#f4c9de] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1.1fr_1fr_0.8fr_0.8fr] lg:px-12">
          <div className="flex flex-col items-start gap-3">
            <Link href="/" aria-label="Pharmacy Desk home">
              <Brand />
            </Link>
            <p className="max-w-xs text-sm leading-6 text-slate-600">
              Practical tools for clearer stock management and smoother
              pharmacy sales.
            </p>
          </div>
          <div>
            <CustomerSupportDetails />
          </div>
          <nav aria-label="Footer quick links">
            <h2 className="text-sm font-semibold text-[#17213a]">Quick links</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <a className="transition hover:text-[#d50068]" href="#home">
                  Home
                </a>
              </li>
              <li>
                <a className="transition hover:text-[#d50068]" href="#about">
                  About Pharmacy Desk
                </a>
              </li>
              <li>
                <a className="transition hover:text-[#d50068]" href="#features">
                  Features
                </a>
              </li>
              <li>
                <Link className="transition hover:text-[#d50068]" href={destination}>
                  Staff sign in
                </Link>
              </li>
            </ul>
          </nav>
          <SocialLinks />
        </div>
        <div className="bg-[#d9006b] px-5 py-3 text-center text-xs text-white sm:flex sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>© 2026 Pharmacy Desk. Built for pharmacy teams.</p>
          <a
            href="mailto:pharmacydesk@gmail.com"
            className="mt-1 inline-flex items-center justify-center gap-1.5 text-white/90 hover:text-white sm:mt-0"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            We’re here to help
          </a>
        </div>
      </footer>
    </main>
  );
}
