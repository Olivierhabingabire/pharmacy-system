"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border border-[#e7d6df] bg-white py-3 pl-10 text-sm text-[#17213a] placeholder:text-slate-400 focus:border-[#e90074] focus:outline-none focus:ring-2 focus:ring-[#e90074]/15";

type Mode = "signIn" | "register";
const MIN_PASSWORD_LENGTH = 6;
const MIN_REGISTRATION_CODE_LENGTH = 12;

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return body.detail ?? `The server answered ${response.status}.`;
}

export default function LoginPage() {
  const router = useRouter();
  const { state, refreshUser } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const signedInRole =
    state.status === "signedIn" ? state.user.role : undefined;

  useEffect(() => {
    if (signedInRole === "manager") router.replace("/dashboard");
    if (signedInRole === "pharmacist") router.replace("/sales");
    if (signedInRole === "customer") router.replace("/customer/catalog");
  }, [signedInRole, router]);

  async function activatePharmacist(
    accessToken: string,
    code: string,
    name: string,
  ) {
    const response = await fetch(`${API_URL}/registration/activate/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, full_name: name.trim() }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    setNotice("Your pharmacist account is authorized. Opening your workspace…");
    refreshUser();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);

    if (mode === "register") {
      if (!fullName.trim()) {
        setError("Enter your full name.");
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(
          `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
        );
        return;
      }
      if (registrationCode.length < MIN_REGISTRATION_CODE_LENGTH) {
        setError(
          `Enter the manager code (at least ${MIN_REGISTRATION_CODE_LENGTH} characters).`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "signIn") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          throw new Error(
            signInError.status === 400
              ? "That email or password is not correct."
              : "Could not sign in. Check your connection and try again.",
          );
        }
      } else {
        const response = await fetch(`${API_URL}/registration/register/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            full_name: fullName.trim(),
            code: registrationCode,
          }),
        });
        if (!response.ok) throw new Error(await responseError(response));

        setNotice(
          "Your account is active. Sign in with the email and password you just registered.",
        );
        setPassword("");
        setRegistrationCode("");
        setMode("signIn");
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not complete the request. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function activateSignedInUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error("Your session expired. Sign in again to activate.");
      }
      await activatePharmacist(
        data.session.access_token,
        registrationCode,
        fullName,
      );
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "Could not activate this account. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const accountNeedsActivation =
    state.status === "signedIn" &&
    signedInRole === null &&
    state.user.is_active;
  const accountDeactivated =
    state.status === "signedIn" && !state.user.is_active;
  const pendingEmail =
    state.status === "signedIn" ? state.user.email : "";
  const problem = error ?? (state.status === "error" ? state.message : null);

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#fff5fa] via-[#fffafd] to-[#ffe8f4] px-4 pb-10 sm:px-6">
      <div
        className="pointer-events-none absolute -left-40 top-40 h-96 w-96 rounded-full bg-[#f7c0dc]/60 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-36 bottom-0 h-96 w-96 rounded-full bg-white/80 blur-3xl"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between border-b border-[#f2c5da] py-4">
        <Link href="/" aria-label="Pharmacy Desk home" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e90074] text-white shadow-md shadow-pink-200">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
              <path
                d="M12 4v16M4 12h16"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-[15px] font-bold leading-tight tracking-tight text-[#13213a] sm:text-base">
            Pharmacy <span className="text-[#e90074]">Desk</span>
            <span className="mt-0.5 block text-[10px] font-medium tracking-wide text-slate-500">
              STOCK. SALES. SIMPLIFIED.
            </span>
          </span>
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f1b1d0] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#c90062] sm:px-4 sm:text-xs">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Secure staff access
        </span>
      </header>

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 pt-8 sm:pt-12 lg:grid-cols-[1fr_0.92fr] lg:gap-14 lg:pt-14">
        <aside className="hidden lg:block">
          <p className="text-xs font-bold tracking-[0.16em] text-[#cf0065]">
            YOUR PHARMACY, MORE CONNECTED
          </p>
          <h2 className="mt-4 max-w-xl text-5xl font-extrabold leading-[1.04] tracking-[-0.05em] text-[#142039]">
            Your team’s work,{" "}
            <span className="text-[#e90074]">all in one place.</span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
            Sign in to manage medicine stock, make counter sales, and keep an
            eye on expiry dates and business performance.
          </p>
          <div className="relative mt-8 overflow-hidden rounded-[1.75rem] border-4 border-white shadow-[0_25px_70px_-25px_rgba(181,16,93,0.35)]">
            <div className="relative aspect-[1.45/1]">
              <Image
                src="/pharmacist-hero.jpg"
                alt="Pharmacist at work in a pharmacy"
                fill
                sizes="(max-width: 1280px) 45vw, 560px"
                className="object-cover object-[center_30%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#17162b]/75 via-transparent to-transparent" />
              <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-4 text-white">
                <div>
                  <p className="text-xs font-medium text-white/75">
                    Pharmacy Desk
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    A smoother day starts here.
                  </p>
                </div>
                <ShieldCheck className="h-7 w-7 shrink-0" aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            {["Live stock visibility", "Expiry-aware checkout"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#f1c7dc] bg-white/75 px-3 py-1.5"
              >
                {item}
              </span>
            ))}
          </div>
        </aside>

        <div className="mx-auto w-full max-w-[28rem] justify-self-center">
        <div className="rounded-[1.75rem] border border-[#f3d2e2] bg-white p-6 shadow-[0_24px_70px_-28px_rgba(155,20,83,0.28)] sm:p-8">
          <div className="mb-5 flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#fde2f0] text-[#e90074]">
              <UserRound className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-3 text-[10px] font-bold tracking-[0.18em] text-[#d50068]">
              PHARMACY DESK
            </p>
          </div>
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#142039]">
            {accountDeactivated
              ? "Staff access deactivated"
              : accountNeedsActivation
              ? "Activate pharmacist access"
              : mode === "register"
                ? "Register as a pharmacist"
                : "Sign in"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-600">
            {accountDeactivated
              ? "This account can no longer access the Pharmacy Desk workspace. Contact a manager if you think this is a mistake."
              : accountNeedsActivation
              ? `Signed in as ${pendingEmail}. Enter the code your manager gave you to enable pharmacist access.`
              : mode === "register"
                ? "Ask your manager for the shared registration code before creating your account."
                : "Sign in to your Pharmacy Desk account."}
          </p>

          {accountDeactivated ? (
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#f1b1d0] px-4 py-3 text-sm font-semibold text-[#c90062] transition hover:bg-[#fff1f7]"
            >
              Sign out
            </button>
          ) : accountNeedsActivation ? (
            <form
              onSubmit={activateSignedInUser}
              className="mt-6 grid gap-4 text-[#17213a]"
              noValidate
            >
              <div>
                <label htmlFor="full-name" className="text-sm font-medium">
                  Full name
                </label>
                <div className="relative mt-1.5">
                  <UserRound
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="full-name"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className={`${inputClass} pr-3`}
                  />
                </div>
              </div>
              <RegistrationCodeField
                value={registrationCode}
                onChange={setRegistrationCode}
              />
              {problem && <Problem message={problem} />}
              {notice && <Notice message={notice} />}
              <button
                type="submit"
                disabled={
                  submitting ||
                  !fullName.trim() ||
                  registrationCode.length < 12
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-[#e90074] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Spinner />}
                {submitting ? "Activating account" : "Activate pharmacist account"}
                {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                className="text-sm font-medium text-slate-500 hover:text-[#c90062]"
              >
                Sign out and use another account
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-6 grid gap-4 text-[#17213a]" noValidate>
              {mode === "register" && (
                <div>
                  <label htmlFor="full-name" className="text-sm font-medium">
                    Full name
                  </label>
                  <div className="relative mt-1.5">
                    <UserRound
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <input
                      id="full-name"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className={`${inputClass} pr-3`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <div className="relative mt-1.5">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@pharmacy.rw"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={`${inputClass} pr-3`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    minLength={
                      mode === "register" ? MIN_PASSWORD_LENGTH : undefined
                    }
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-paper hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <>
                  <RegistrationCodeField
                    value={registrationCode}
                    onChange={setRegistrationCode}
                  />
                  <p className="-mt-3 text-xs leading-5 text-muted">
                    Password: at least {MIN_PASSWORD_LENGTH} characters.
                    Registration code: at least{" "}
                    {MIN_REGISTRATION_CODE_LENGTH} characters.
                  </p>
                </>
              )}

              {problem && <Problem message={problem} />}
              {notice && <Notice message={notice} />}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#e90074] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Spinner />}
                {submitting
                  ? mode === "register"
                    ? "Creating account"
                    : "Signing in"
                  : mode === "register"
                    ? "Create pharmacist account"
                    : "Sign in"}
                {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </form>
          )}

          {!accountNeedsActivation && !accountDeactivated && (
            <div className="mt-6 border-t border-rule pt-5 text-center">
              {mode === "signIn" ? (
                <>
                  <p className="text-sm text-muted">
                    New pharmacist?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setError(null);
                        setNotice(null);
                      }}
                      className="font-semibold text-[#d50068] hover:underline"
                    >
                      Register with a manager code
                    </button>
                  </p>
                  <p className="mt-3 text-sm text-muted">
                    Looking for medicine?{" "}
                    <Link
                      href="/customer/register"
                      className="font-semibold text-[#d50068] hover:underline"
                    >
                      Create a customer account
                    </Link>
                  </p>
                  <p className="mt-4 text-xs text-muted">
                    Forgot your password? Ask your manager to reset it.
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signIn");
                    setError(null);
                    setNotice(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#d50068] hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to sign in
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#bd005d] hover:text-[#e90074]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Pharmacy Desk
          </Link>
        </div>
      </div>
      </div>
    </main>
  );
}

function RegistrationCodeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor="registration-code" className="text-sm font-medium">
        Manager registration code
      </label>
      <div className="relative mt-1.5">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id="registration-code"
          type="password"
          autoComplete="one-time-code"
          required
          minLength={12}
          maxLength={128}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-3`}
        />
      </div>
    </div>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-red-bg px-3 py-2.5 text-sm text-red"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="rounded-lg bg-ok-bg px-3 py-2.5 text-sm leading-5 text-ok"
    >
      {message}
    </p>
  );
}

function Spinner() {
  return (
    <LoaderCircle
      className="h-4 w-4 motion-safe:animate-spin"
      aria-hidden="true"
    />
  );
}
