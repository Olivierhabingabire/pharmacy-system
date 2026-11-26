"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  CircleAlert,
  Copy,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { API_URL, authFetch } from "@/lib/api";
import { useLanguage } from "@/lib/language";

type Pharmacist = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; configured: boolean; pharmacists: Pharmacist[] };

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return body.detail ?? `The server answered ${response.status}.`;
}

export default function StaffAccessPage() {
  const { t } = useLanguage();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rosterProblem, setRosterProblem] = useState<string | null>(null);
  const [rosterNotice, setRosterNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      authFetch(`${API_URL}/registration/code/`, { signal: controller.signal }),
      authFetch(`${API_URL}/staff/pharmacists/`, { signal: controller.signal }),
    ])
      .then(async ([codeResponse, staffResponse]) => {
        if (!codeResponse.ok) throw new Error(await errorMessage(codeResponse));
        if (!staffResponse.ok) throw new Error(await errorMessage(staffResponse));
        const codeData = (await codeResponse.json()) as { configured: boolean };
        const pharmacists = (await staffResponse.json()) as Pharmacist[];
        setState({
          status: "ready",
          configured: codeData.configured,
          pharmacists,
        });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setState({
          status: "error",
          message: error.message.startsWith("The server")
            ? error.message
            : t("Could not reach the server. Is Django running?"),
        });
      });
    return () => controller.abort();
  }, [attempt, t]);

  async function saveCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setProblem(null);
    setMessage(null);
    if (code.length < 12) {
      setProblem(t("Use a code with at least 12 characters."));
      return;
    }
    if (code !== confirmation) {
      setProblem(t("The codes do not match."));
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch(`${API_URL}/registration/code/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setCode("");
      setConfirmation("");
      setShareCode(code);
      setState((current) =>
        current.status === "ready"
          ? { ...current, configured: true }
          : current,
      );
      setMessage(t("Registration code saved. Share it only with pharmacists you authorize."));
    } catch (error) {
      setProblem(
        error instanceof Error ? t(error.message) : t("Could not save the code."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyCode() {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setMessage(t("Code copied. Share it only with pharmacists you authorize."));
    } catch {
      setProblem(t("Could not copy the code. Select and copy it manually."));
    }
  }

  async function setPharmacistActive(pharmacist: Pharmacist) {
    const isActive = !pharmacist.is_active;
    if (
      !isActive &&
      !window.confirm(
        t("Deactivate {name}? They will lose access, but their sales history will be kept.").replace("{name}", pharmacist.full_name || pharmacist.email),
      )
    ) {
      return;
    }

    setUpdatingId(pharmacist.id);
    setRosterProblem(null);
    setRosterNotice(null);
    try {
      const response = await authFetch(
        `${API_URL}/staff/pharmacists/${pharmacist.id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: isActive }),
        },
      );
      if (!response.ok) throw new Error(await errorMessage(response));
      const updated = (await response.json()) as Pharmacist;
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              pharmacists: current.pharmacists.map((member) =>
                member.id === updated.id ? updated : member,
              ),
            }
          : current,
      );
      setRosterNotice(
        isActive
          ? t("{name} can access the workspace again.").replace("{name}", pharmacist.full_name || pharmacist.email)
          : t("{name} has been deactivated. Sales history is preserved.").replace("{name}", pharmacist.full_name || pharmacist.email),
      );
    } catch (error) {
      setRosterProblem(
        error instanceof Error
          ? error.message
          : t("Could not update pharmacist access."),
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <header>
        <p className="text-xs font-bold tracking-[0.16em] text-[#c90062]">{t("MANAGER SETTINGS")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {t("Staff access")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          {t("Set the shared code pharmacists need to register. You can replace it whenever your team changes.")}
        </p>
      </header>

      {state.status === "loading" && (
        <div className="mt-8 h-48 rounded-xl bg-rule motion-safe:animate-pulse" />
      )}

      {state.status === "error" && (
        <div className="mt-8 rounded-lg border border-red/30 bg-red-bg p-4 text-sm text-red">
          <p>{t(state.message)}</p>
          <button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
            className="mt-3 rounded-md bg-red px-3 py-1.5 font-medium text-white"
          >
            {t("Try again")}
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-rule bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fde2f0]">
                <KeyRound className="h-5 w-5 text-[#d50068]" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold">{t("Pharmacist registration code")}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {state.configured
                        ? t("A code is set. For your security, the current code cannot be viewed.")
                    : t("No code is set yet. Pharmacists cannot register until you create one.")}
                </p>
              </div>
            </div>

            <form onSubmit={saveCode} className="mt-6 grid gap-4">
              <div>
                <label htmlFor="registration-code" className="text-sm font-medium">
                  {state.configured ? t("New shared code") : t("Set shared code")}
                </label>
                <input
                  id="registration-code"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-rule bg-white px-3 py-2.5 text-sm focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/30"
                />
              </div>
              <div>
                <label htmlFor="registration-code-confirm" className="text-sm font-medium">
                  {t("Confirm shared code")}
                </label>
                <input
                  id="registration-code-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-rule bg-white px-3 py-2.5 text-sm focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/30"
                />
              </div>

              {problem && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-red-bg px-3 py-2.5 text-sm text-red"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {t(problem)}
                </p>
              )}
              {message && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-lg bg-ok-bg px-3 py-2.5 text-sm text-ok"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {t(message)}
                </p>
              )}
              {shareCode && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-ok/20 bg-ok-bg px-3 py-2.5">
                  <code className="break-all text-sm font-medium text-ok">
                    {shareCode}
                  </code>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={copyCode}
                      aria-label={t("Copy registration code")}
                      className="rounded-md p-2 text-ok hover:bg-white/60"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShareCode(null)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-ok hover:bg-white/60"
                    >
                      {t("Hide")}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#e90074] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-pink-200 transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && (
                  <LoaderCircle
                    className="h-4 w-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                )}
                {saving ? t("Saving code") : t("Save registration code")}
              </button>
            </form>

            <p className="mt-4 text-xs leading-5 text-muted">
              {t("Share the registration code and sign-in page with the pharmacist you want to add. They can choose “Register with a manager code” to create their account. The code is stored as a secure hash and cannot be viewed again after this page is refreshed.")}
            </p>
            {state.configured && (
              <Link
                href="/login"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#f1b1d0] px-4 py-2.5 text-sm font-semibold text-[#c90062] transition hover:bg-[#fff1f7]"
              >
                {t("Open staff sign-in")}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </section>

          <section className="rounded-2xl border border-rule bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fde2f0]">
                  <Users className="h-5 w-5 text-[#d50068]" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">{t("Pharmacist roster")}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {t("Active and deactivated pharmacist accounts.")}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium tabular-nums text-muted">
                {state.pharmacists.length}
              </span>
            </div>

            {rosterProblem && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg bg-red-bg px-3 py-2.5 text-sm text-red"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t(rosterProblem)}
              </p>
            )}
            {rosterNotice && (
              <p
                role="status"
                className="mt-4 rounded-lg bg-ok-bg px-3 py-2.5 text-sm text-ok"
              >
                {t(rosterNotice)}
              </p>
            )}

            {state.pharmacists.length === 0 ? (
              <p className="mt-6 rounded-lg border border-dashed border-rule p-5 text-sm text-muted">
                {t("No pharmacist accounts have registered yet. Create a registration code and share it with the staff member you want to add.")}
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-rule">
                {state.pharmacists.map((pharmacist) => (
                  <li
                    key={pharmacist.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-pine">
                        {pharmacist.full_name || pharmacist.email}
                      </p>
                      <p className="mt-0.5 break-all text-xs text-muted">
                        {pharmacist.email}
                      </p>
                      <span
                        className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          pharmacist.is_active
                            ? "bg-ok-bg text-ok"
                            : "bg-paper text-muted"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            pharmacist.is_active ? "bg-ok" : "bg-slate-400"
                          }`}
                          aria-hidden="true"
                        />
                        {pharmacist.is_active ? t("Active") : t("Deactivated")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void setPharmacistActive(pharmacist)}
                      disabled={updatingId !== null}
                      className={`inline-flex shrink-0 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        pharmacist.is_active
                          ? "border-red/30 text-red hover:bg-red-bg"
                          : "border-[#f1b1d0] text-[#c90062] hover:bg-[#fff1f7]"
                      }`}
                    >
                      {updatingId === pharmacist.id
                        ? t("Updating…")
                        : pharmacist.is_active
                          ? t("Deactivate")
                          : t("Restore access")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
