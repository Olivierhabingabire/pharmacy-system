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
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth";
import CustomerSupportFooter from "@/components/CustomerSupport";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, managerOnly: true },
  { href: "/staff-access", label: "Staff access", icon: Users, managerOnly: true },
  { href: "/sales", label: "New sale", icon: ReceiptText, managerOnly: false },
  { href: "/medicines", label: "Medicines", icon: Pill, managerOnly: false },
  { href: "/profile", label: "My profile", icon: UserRound, managerOnly: false },
];

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
  onNavigate,
}: {
  pathname: string;
  isManager: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {nav
          .filter((item) => isManager || !item.managerOnly)
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
                  {label}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}

function Account({ user }: { user: AuthUser }) {
  const { signOut } = useAuth();
  return (
    <div className="border-t border-rule px-2 pt-4">
      <p className="truncate text-sm font-semibold text-pine" title={user.email}>
        {user.email}
      </p>
      <p className="mt-1 inline-flex rounded-full bg-[#fde2f0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#c90062]">
        {user.role}
      </p>
      <button
        onClick={signOut}
        className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#fff1f7] hover:text-[#c90062]"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <div className="grid min-h-screen place-items-center bg-[#fffafd] px-6">
        <div className="max-w-sm text-center">
          {children ?? <p className="text-sm text-muted">Loading…</p>}
        </div>
      </div>
      <CustomerSupportFooter />
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const onLogin = pathname === "/login";
  const onLanding = pathname === "/";
  const user = state.status === "signedIn" ? state.user : null;
  const isManager = user?.role === "manager";
  const userRole = user?.role;
  const blocked =
    !!user &&
    user.role !== null &&
    !isManager &&
    managerOnlyPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

  useEffect(() => {
    if (state.status === "signedOut" && !onLogin && !onLanding) {
      router.replace("/login");
    }
    if (
      state.status === "signedIn" &&
      userRole === null &&
      !onLogin
    ) {
      router.replace("/login");
    }
    if (blocked) router.replace("/sales");
  }, [state.status, userRole, onLogin, onLanding, blocked, router]);

  if (onLogin) {
    return (
      <>
        {children}
        <CustomerSupportFooter />
      </>
    );
  }
  if (onLanding) return <>{children}</>;
  if (state.status === "loading" || state.status === "signedOut" || blocked) {
    return <Splash />;
  }

  if (state.status === "error") {
    return (
      <Splash>
        <p className="text-sm text-red">{state.message}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-[#e90074] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c90062]"
          >
            Try again
          </button>
          <button
            onClick={signOut}
            className="rounded-md border border-rule bg-surface px-4 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </Splash>
    );
  }

  if (user && !user.is_active) {
    return (
      <Splash>
        <h1 className="text-lg font-semibold">Staff access deactivated</h1>
        <p className="mt-2 text-sm text-muted">
          This account can no longer access the pharmacy workspace. Contact a
          manager if you think this is a mistake.
        </p>
        <button
          onClick={signOut}
          className="mt-4 rounded-xl border border-rule bg-surface px-4 py-2.5 text-sm font-semibold text-pine transition hover:border-[#e90074]/40 hover:text-[#c90062]"
        >
          Sign out
        </button>
      </Splash>
    );
  }

  if (!user || user.role === null) {
    return (
      <Splash>
        <h1 className="text-lg font-semibold">No role assigned yet</h1>
        <p className="mt-2 text-sm text-muted">
          You are signed in as {user?.email}, but your account has no role. Ask
          a manager to add you as a pharmacist or manager.
        </p>
        <button
          onClick={signOut}
          className="mt-4 rounded-md border border-rule bg-surface px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </Splash>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffafd]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-rule bg-white px-3 py-5 text-pine shadow-[4px_0_24px_rgba(80,20,50,0.03)] md:flex print:hidden">
        <div className="px-3 pb-7">
          <Brand />
        </div>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Workspace
        </p>
        <Nav pathname={pathname} isManager={isManager} />
        <div className="mt-auto px-1">
          <Account user={user} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-white px-4 py-3 text-pine shadow-sm md:hidden print:hidden">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-[#c90062] hover:bg-[#fff1f7]"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-rule bg-white px-3 py-5 text-pine shadow-xl">
            <div className="flex items-center justify-between px-3 pb-7">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-[#c90062] hover:bg-[#fff1f7]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Workspace
            </p>
            <Nav
              pathname={pathname}
              isManager={isManager}
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-auto px-1">
              <Account user={user} />
            </div>
          </aside>
        </div>
      )}

      <div className="min-h-screen md:pl-60 print:pl-0">
        {children}
        <CustomerSupportFooter />
      </div>
    </div>
  );
}