"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-lg border border-rule bg-surface py-2.5 pl-10 text-sm placeholder:text-muted/70 focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/30";

type Mode = "signIn" | "register";

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
    setSubmitting(true);
    setError(null);
    setNotice(null);

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
        const codeCheck = await fetch(`${API_URL}/registration/validate/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: registrationCode }),
        });
        if (!codeCheck.ok) throw new Error(await responseError(codeCheck));

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (signUpError) {
          throw new Error(
            "Could not create your account. Check the email and try again.",
          );
        }

        if (data.session) {
          await activatePharmacist(
            data.session.access_token,
            registrationCode,
            fullName,
          );
        } else {
          setNotice(
            "Account created. Confirm your email, then sign in and enter the manager code to activate your pharmacist access.",
          );
          setMode("signIn");
        }
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
    state.status === "signedIn" && signedInRole === null;
  const pendingEmail =
    state.status === "signedIn" ? state.user.email : "";
  const problem = error ?? (state.status === "error" ? state.message : null);

  return (
    <main className="cross-field grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[26rem]">
        <div className="flex flex-col items-center text-white">
          <span
            className="grid h-12 w-12 place-items-center rounded-xl bg-cross"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
              <path
                d="M12 4v16M4 12h16"
                stroke="#0c2a24"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className="mt-4 text-lg font-semibold tracking-tight">
            PHARMACY DESK
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-8 shadow-2xl shadow-black/30">
          <h1 className="text-xl font-bold tracking-tight">
            {accountNeedsActivation
              ? "Activate pharmacist access"
              : mode === "register"
                ? "Register as a pharmacist"
                : "Sign in"}
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            {accountNeedsActivation
              ? `Signed in as ${pendingEmail}. Enter the code your manager gave you to enable pharmacist access.`
              : mode === "register"
                ? "Ask your manager for the shared registration code before creating your account."
                : "Sign in to your Pharmacy Desk account."}
          </p>

          {accountNeedsActivation ? (
            <form
              onSubmit={activateSignedInUser}
              className="mt-6 grid gap-4"
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
                className="flex items-center justify-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-[#123a32] disabled:opacity-50"
              >
                {submitting && <Spinner />}
                {submitting ? "Activating account" : "Activate pharmacist account"}
              </button>
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                className="text-sm font-medium text-muted hover:text-ink"
              >
                Sign out and use another account
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
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
                    minLength={mode === "register" ? 8 : undefined}
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
                <RegistrationCodeField
                  value={registrationCode}
                  onChange={setRegistrationCode}
                />
              )}

              {problem && <Problem message={problem} />}
              {notice && <Notice message={notice} />}

              <button
                type="submit"
                disabled={
                  submitting ||
                  !email ||
                  !password ||
                  (mode === "register" &&
                    (!fullName.trim() ||
                      password.length < 8 ||
                      registrationCode.length < 12))
                }
                className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-[#123a32] disabled:opacity-50"
              >
                {submitting && <Spinner />}
                {submitting
                  ? mode === "register"
                    ? "Creating account"
                    : "Signing in"
                  : mode === "register"
                    ? "Create pharmacist account"
                    : "Sign in"}
              </button>
            </form>
          )}

          {!accountNeedsActivation && (
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
                      className="font-semibold text-ok hover:underline"
                    >
                      Register with a manager code
                    </button>
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
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ok hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to sign in
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="text-xs font-medium text-white/60 hover:text-white"
          >
            Back to Pharmacy Desk
          </Link>
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
