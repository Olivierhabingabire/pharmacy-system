"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-lg border border-rule bg-surface py-2.5 pl-10 text-sm placeholder:text-muted/70 focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/30";

export default function LoginPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the provider knows who signed in, go to that role's home page.
  useEffect(() => {
    if (state.status === "signedIn") {
      router.replace(state.user.role === "manager" ? "/dashboard" : "/sales");
    }
  }, [state, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(
        signInError.status === 400
          ? "That email or password is not correct."
          : "Could not sign in. Check your connection and try again.",
      );
    }
    setSubmitting(false);
  }

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
          <h1 className="text-xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
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
                  onChange={(e) => setEmail(e.target.value)}
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
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

            {problem && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-red-bg px-3 py-2.5 text-sm text-red"
              >
                <CircleAlert
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {problem}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-[#123a32] disabled:opacity-50"
            >
              {submitting && (
                <LoaderCircle
                  className="h-4 w-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
              )}
              {submitting ? "Signing in" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            Forgot your password? Ask your manager to reset it.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          PHARMACY STOCK AND SALES SYSTEM
        </p>
      </div>
    </main>
  );
}