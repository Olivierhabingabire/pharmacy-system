"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  ReceiptText,
  ShoppingBag,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth";
import CustomerSupportFooter from "@/components/CustomerSupport";
import {
  LanguageProvider,
  LanguageSelector,
  useLanguage,
} from "@/lib/language";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, managerOnly: true },
  { href: "/staff-access", label: "Staff access", icon: Users, managerOnly: true },
  { href: "/sales", label: "New sale", icon: ReceiptText, staffOnly: true },
  { href: "/medicines", label: "Medicines", icon: Pill, staffOnly: true },
  { href: "/staff/orders", label: "Customer orders", icon: ShoppingBag, staffOnly: true },
  { href: "/customer/catalog", label: "Browse medicines", icon: Pill, customerOnly: true },
  { href: "/customer/orders", label: "My orders", icon: ShoppingBag, customerOnly: true },
];

const customerOnlyPaths = ["/customer/catalog", "/customer/orders"];
const staffOnlyPaths = ["/dashboard", "/staff-access", "/sales", "/medicines", "/staff/orders"];
const managerOnlyPaths = ["/dashboard", "/staff-access"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-9 w-9 place-items-center rounded-xl bg-[#e90074] text-white shadow-sm shadow-pink-200"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d="M12 4v16M4 12h16"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="text-[15px] font-bold tracking-tight text-pine">
        Pharmacy <span className="text-[#e90074]">Desk</span>
      </span>
    </div>
  );
}

function Nav({
  pathname,
  isManager,
  isCustomer,
  onNavigate,
}: {
  pathname: string;
  isManager: boolean;
  isCustomer: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t("Main")}>
      <ul className="space-y-1">
        {nav
          .filter(
            (item) =>
              (!item.managerOnly || isManager) &&
              (!item.staffOnly || !isCustomer) &&
              (!item.customerOnly || isCustomer),
          )
          .map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[#fde2f0] text-[#c90062]"
                      : "text-slate-600 hover:bg-[#fff1f7] hover:text-[#c90062]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {t(label)}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}

function Account() {
  const { signOut } = useAuth();
  const { t } = useLanguage();
  return (
    <div className="border-t border-rule px-2 pt-4">
      <button
        onClick={signOut}
        className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#fff1f7] hover:text-[#c90062]"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {t("Sign out")}
      </button>
    </div>
  );
}

function ProfileLink({
  user,
  pathname,
  compact = false,
}: {
  user: AuthUser;
  pathname: string;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const active = isActive(pathname, "/profile");
  const displayName = user.full_name.trim() || user.email;
  const label = `${t("My profile")}: ${displayName}`;

  return (
    <Link
      href="/profile"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={
        compact
          ? `grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition ${
              active
                ? "border-[#f1c7dc] bg-[#fff1f7] text-[#c90062]"
                : "border-rule bg-white text-slate-600 hover:border-[#f1c7dc] hover:bg-[#fffafd] hover:text-[#c90062]"
            }`
          : `flex max-w-64 items-center gap-2.5 rounded-xl border px-3 py-2 transition ${
              active
                ? "border-[#f1c7dc] bg-[#fff1f7]"
                : "border-rule bg-white hover:border-[#f1c7dc] hover:bg-[#fffafd]"
            }`
      }
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fde2f0] text-[#c90062]">
        <UserRound className="h-4 w-4" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="min-w-0 text-left">
          <span className="block truncate text-xs font-bold text-pine">
            {displayName}
          </span>
          <span className="block truncate text-[10px] font-medium capitalize text-muted">
            {user.role ? t(user.role) : ""}
          </span>
        </span>
      )}
    </Link>
  );
}

function Splash({ children }: { children?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="grid min-h-screen place-items-center bg-[#fffafd] px-6">
        <div className="max-w-sm text-center">
          {children ?? <p className="text-sm text-muted">{t("Loading…")}</p>}
        </div>
      </div>
      <CustomerSupportFooter />
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Shell>{children}</Shell>
      </AuthProvider>
    </LanguageProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const { state, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  const onLogin = pathname === "/login";
  const onLanding = pathname === "/";
  const onCustomerRegister = pathname === "/customer/register";
  const user = state.status === "signedIn" ? state.user : null;
  const isManager = user?.role === "manager";
  const isCustomer = user?.role === "customer";
  const userRole = user?.role;
  const blocked =
    !!user &&
    user.role !== null &&
    (isCustomer
      ? staffOnlyPaths.some((path) => isActive(pathname, path))
      : customerOnlyPaths.some((path) => isActive(pathname, path))) ||
    (!!user &&
      !isManager &&
      managerOnlyPaths.some((path) => isActive(pathname, path))) ||
    (!!user && onCustomerRegister);

  useEffect(() => {
    if (
      state.status === "signedOut" &&
      !onLogin &&
      !onLanding &&
      !onCustomerRegister
    ) {
      router.replace("/login");
    }
    if (
      state.status === "signedIn" &&
      userRole === null &&
      !onLogin &&
      !onCustomerRegister
    ) {
      router.replace("/login");
    }
    if (blocked) {
      router.replace(isCustomer ? "/customer/catalog" : isManager ? "/dashboard" : "/sales");
    }
  }, [
    state.status,
    userRole,
    onLogin,
    onLanding,
    onCustomerRegister,
    blocked,
    isCustomer,
    isManager,
    router,
  ]);

  if (onLogin) {
    return (
      <>
        {children}
        <CustomerSupportFooter />
      </>
    );
  }
  if (onLanding) return <>{children}</>;
  if (onCustomerRegister && !user) {
    return (
      <>
        {children}
        <CustomerSupportFooter />
      </>
    );
  }
  if (state.status === "loading" || state.status === "signedOut" || blocked) {
    return <Splash />;
  }

  if (state.status === "error") {
    return (
      <Splash>
        <p className="text-sm text-red">{t(state.message)}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-[#e90074] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c90062]"
          >
            {t("Try again")}
          </button>
          <button
            onClick={signOut}
            className="rounded-md border border-rule bg-surface px-4 py-2 text-sm"
          >
            {t("Sign out")}
          </button>
        </div>
      </Splash>
    );
  }

  if (user && !user.is_active) {
    return (
      <Splash>
        <h1 className="text-lg font-semibold">{t("Staff access deactivated")}</h1>
        <p className="mt-2 text-sm text-muted">
          {t("This account can no longer access the Pharmacy Desk workspace. Contact a manager if you think this is a mistake.")}
        </p>
        <button
          onClick={signOut}
          className="mt-4 rounded-xl border border-rule bg-surface px-4 py-2.5 text-sm font-semibold text-pine transition hover:border-[#e90074]/40 hover:text-[#c90062]"
        >
          {t("Sign out")}
        </button>
      </Splash>
    );
  }

  if (!user || user.role === null) {
    return (
      <Splash>
        <h1 className="text-lg font-semibold">{t("No role assigned yet")}</h1>
        <p className="mt-2 text-sm text-muted">
          {t("You are signed in as {email}, but your account has no role. Ask a manager to add you to the pharmacy team.").replace("{email}", user?.email ?? "")}
        </p>
        <button
          onClick={signOut}
          className="mt-4 rounded-md border border-rule bg-surface px-4 py-2 text-sm"
        >
          {t("Sign out")}
        </button>
      </Splash>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffafd]">
      {/* Desktop sidebar */}
      <aside
        id="desktop-navigation"
        className={`fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-rule bg-white px-3 py-5 text-pine shadow-[4px_0_24px_rgba(80,20,50,0.03)] ${
          desktopSidebarOpen ? "md:flex" : "md:hidden"
        } print:hidden`}
      >
        <div className="px-3 pb-7">
          <Brand />
        </div>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          {t("Workspace")}
        </p>
        <Nav pathname={pathname} isManager={isManager} isCustomer={isCustomer} />
        <div className="mt-auto px-1">
          <Account />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-white px-4 py-3 text-pine shadow-sm md:hidden print:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <LanguageSelector compact />
          <ProfileLink user={user} pathname={pathname} compact />
          <button
            onClick={() => setOpen(true)}
            aria-label={t("Open menu")}
            className="rounded-lg p-2 text-[#c90062] hover:bg-[#fff1f7]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-label={t("Close menu")}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-rule bg-white px-3 py-5 text-pine shadow-xl">
            <div className="flex items-center justify-between px-3 pb-7">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label={t("Close menu")}
                className="rounded-lg p-2 text-[#c90062] hover:bg-[#fff1f7]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {t("Workspace")}
            </p>
            <Nav
              pathname={pathname}
              isManager={isManager}
              isCustomer={isCustomer}
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-auto px-1">
              <Account />
            </div>
          </aside>
        </div>
      )}

      <div
        className={`min-h-screen ${
          desktopSidebarOpen ? "md:pl-60" : "md:pl-0"
        } print:pl-0`}
      >
        <header className="sticky top-0 z-10 hidden items-center justify-between gap-3 border-b border-rule bg-white/95 px-5 py-3 text-pine shadow-sm backdrop-blur md:flex md:px-8 print:hidden">
          <button
            type="button"
            onClick={() => setDesktopSidebarOpen((isOpen) => !isOpen)}
            aria-label={t(desktopSidebarOpen ? "Close menu" : "Open menu")}
            aria-expanded={desktopSidebarOpen}
            aria-controls="desktop-navigation"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-[#fff1f7] hover:text-[#c90062]"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <ProfileLink user={user} pathname={pathname} />
          </div>
        </header>
        {children}
        <CustomerSupportFooter />
      </div>
    </div>
  );
}