"use client";

import { useState, type FormEvent } from "react";
import {
  CircleAlert,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth, type AuthUser } from "@/lib/auth";
import { API_URL, authFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language";

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return body.detail ?? `The server answered ${response.status}.`;
}

export default function ProfilePage() {
  const { state } = useAuth();

  if (state.status !== "signedIn") return null;
  return <ProfileForm key={state.user.id} user={state.user} />;
}

function ProfileForm({ user }: { user: AuthUser }) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    if (!normalizedName) {
      setProblem(t("Enter your full name."));
      return;
    }

    setSaving(true);
    setProblem(null);
    setNotice(null);
    try {
      const response = await authFetch(`${API_URL}/profile/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: normalizedName,
          phone: normalizedPhone,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));

      const emailChanged =
        normalizedEmail.toLowerCase() !== user.email.toLowerCase();
      if (emailChanged) {
        const { data, error } = await supabase.auth.updateUser({
          email: normalizedEmail,
        });
        if (error) {
          setNotice(t("Your name and phone number were saved."));
          setProblem(`${t("Email was not updated:")} ${error.message}`);
          return;
        }

        const confirmationPending =
          data.user.email?.toLowerCase() !== normalizedEmail.toLowerCase();
        setNotice(
          confirmationPending
            ? t("Your profile was saved. Check your new email address and follow the confirmation link to finish changing your email.")
            : t("Your profile and email were updated."),
        );
        return;
      }

      setNotice(t("Your profile was saved."));
    } catch (error) {
      setProblem(
        error instanceof Error ? t(error.message) : t("Could not save your profile."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <header>
        <p className="text-xs font-bold tracking-[0.16em] text-[#c90062]">
          {t("ACCOUNT SETTINGS")}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-pine">
          {t("My profile")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          {t("View your account details and keep your contact information up to date.")}
        </p>
      </header>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(15rem,0.7fr)]">
        <form
          onSubmit={saveProfile}
          className="rounded-2xl border border-rule bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="flex items-center gap-3 border-b border-rule pb-5">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fde2f0] text-[#d50068]">
              <UserRound className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-pine">{t("Personal information")}</h2>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-5">
            <div>
              <label
                htmlFor="profile-full-name"
                className="text-sm font-semibold text-pine"
              >
                {t("Full name")}
              </label>
              <div className="relative mt-1.5">
                <UserRound
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="profile-full-name"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  maxLength={200}
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-xl border border-rule bg-white py-3 pl-10 pr-3 text-sm focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-email"
                className="text-sm font-semibold text-pine"
              >
                {t("Email address")}
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-rule bg-white py-3 pl-10 pr-3 text-sm focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/20"
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                {t("Changing your email requires confirmation from your new email inbox.")}
              </p>
            </div>

            <div>
              <label
                htmlFor="profile-phone"
                className="text-sm font-semibold text-pine"
              >
                {t("Phone number")}
              </label>
              <div className="relative mt-1.5">
                <Phone
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={32}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+250 7XX XXX XXX"
                  className="w-full rounded-xl border border-rule bg-white py-3 pl-10 pr-3 text-sm focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/20"
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                {t("Contact information only; this phone number is not verified.")}
              </p>
            </div>
          </div>

          {problem && (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl bg-red-bg px-3 py-2.5 text-sm text-red"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {problem}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mt-5 rounded-xl bg-ok-bg px-3 py-2.5 text-sm leading-5 text-ok"
            >
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e90074] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-pink-200 transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? t("Saving profile…") : t("Save changes")}
          </button>
        </form>

        <aside className="h-fit rounded-2xl border border-[#f1c7dc] bg-gradient-to-br from-white to-[#fff3f9] p-5 shadow-sm sm:p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fde2f0] text-[#d50068]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold text-pine">{t("Account access")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {t("Your role and account status are managed by your pharmacy. Contact a manager if you need access changes.")}
          </p>
          <dl className="mt-5 space-y-4 border-t border-[#f1c7dc] pt-5">
            <div>
              <dt className="text-xs font-medium text-muted">{t("Role")}</dt>
              <dd className="mt-1 inline-flex rounded-full bg-[#fde2f0] px-2.5 py-1 text-xs font-bold capitalize text-[#c90062]">
                {user.role}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{t("Account status")}</dt>
              <dd className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-ok">
                <span
                  className="h-2 w-2 rounded-full bg-ok"
                  aria-hidden="true"
                />
                {t("Active")}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
