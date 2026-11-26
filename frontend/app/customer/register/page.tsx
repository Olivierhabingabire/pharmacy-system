"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function CustomerRegistrationPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setProblem(null);
    setNotice(null);
    if (password.length < 8) {
      setProblem("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setProblem("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            account_type: "customer",
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
          emailRedirectTo: `${window.location.origin}/customer/catalog`,
        },
      });
      if (error) {
        throw new Error(
          error.message.includes("already registered")
            ? "An account with this email already exists. Sign in instead."
            : error.message,
        );
      }
      if (data.session) {
        router.replace("/customer/catalog");
      } else {
        setNotice(
          "Account created. Check your email to confirm your address, then sign in to browse medicines.",
        );
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Could not create your account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[70vh] bg-gradient-to-br from-[#fff5fa] via-[#fffafd] to-[#ffe8f4] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#bd005d] hover:text-[#e90074]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Pharmacy Desk
        </Link>

        <section className="mt-5 rounded-3xl border border-[#f4d0e1] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(181,16,93,0.3)] sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold tracking-[0.16em] text-[#c90062]">
              CUSTOMER ACCOUNT
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#142039]">
              Create your account
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Browse available medicines, see current prices, and send a request
              for pharmacist review. No access code is needed.
            </p>
          </div>

          <form onSubmit={submit} className="grid gap-4">
            <Field
              id="customer-name"
              label="Full name"
              icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
              type="text"
              autoComplete="name"
              maxLength={200}
              required
              value={fullName}
              onChange={setFullName}
            />
            <Field
              id="customer-email"
              label="Email address"
              icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={setEmail}
            />
            <Field
              id="customer-phone"
              label="Phone number (optional)"
              icon={<Phone className="h-4 w-4" aria-hidden="true" />}
              type="tel"
              autoComplete="tel"
              maxLength={32}
              value={phone}
              onChange={setPhone}
              placeholder="+250 7XX XXX XXX"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[#17213a]">
                Password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-xl border border-[#e7d6df] px-3 py-3 font-normal focus:border-[#e90074] focus:outline-none focus:ring-2 focus:ring-[#e90074]/15"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#17213a]">
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="rounded-xl border border-[#e7d6df] px-3 py-3 font-normal focus:border-[#e90074] focus:outline-none focus:ring-2 focus:ring-[#e90074]/15"
                />
              </label>
            </div>

            {problem && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-red-bg px-3 py-2.5 text-sm text-red"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {problem}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-xl bg-ok-bg px-3 py-2.5 text-sm leading-5 text-ok"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#e90074] px-4 py-3 text-sm font-bold text-white shadow-sm shadow-pink-200 transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating account…" : "Create customer account"}
              {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </form>

          <p className="mt-5 border-t border-[#f2dce7] pt-5 text-center text-sm text-slate-600">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#c90062] hover:underline"
            >
              Sign in
            </Link>
          </p>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">
            Orders are requests only. A pharmacist must review them before
            medicines are reserved or dispensed.
          </p>
        </section>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  icon,
  value,
  onChange,
  ...inputProps
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm font-semibold text-[#17213a]">
      {label}
      <span className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-[#e7d6df] py-3 pl-10 pr-3 font-normal focus:border-[#e90074] focus:outline-none focus:ring-2 focus:ring-[#e90074]/15"
          {...inputProps}
        />
      </span>
    </label>
  );
}
