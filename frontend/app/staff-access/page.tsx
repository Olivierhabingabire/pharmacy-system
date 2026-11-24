"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CircleAlert,
  Copy,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { API_URL, authFetch } from "@/lib/api";

type Pharmacist = {
  id: string;
  email: string;
  full_name: string;
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
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);

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
            : "Could not reach the server. Is Django running?",
        });
      });
    return () => controller.abort();
  }, [attempt]);

  async function saveCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setProblem(null);
    setMessage(null);
    if (code.length < 12) {
      setProblem("Use a code with at least 12 characters.");
      return;
    }
    if (code !== confirmation) {
      setProblem("The codes do not match.");
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
      setMessage("Registration code saved. Share it only with pharmacists you authorize.");
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Could not save the code.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyCode() {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setMessage("Code copied. Share it only with pharmacists you authorize.");
    } catch {
      setProblem("Could not copy the code. Select and copy it manually.");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <header>
        <p className="text-sm font-medium text-ok">MANAGER SETTINGS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Staff access
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          Set the shared code pharmacists need to register. You can replace it
          whenever your team changes.
        </p>
      </header>

      {state.status === "loading" && (
        <div className="mt-8 h-48 rounded-xl bg-rule motion-safe:animate-pulse" />
      )}

      {state.status === "error" && (
        <div className="mt-8 rounded-lg border border-red/30 bg-red-bg p-4 text-sm text-red">
          <p>{state.message}</p>
          <button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
            className="mt-3 rounded-md bg-red px-3 py-1.5 font-medium text-white"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-rule bg-surface p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ok-bg">
                <KeyRound className="h-5 w-5 text-ok" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold">Pharmacist registration code</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {state.configured
                        ? "A code is set. For your security, the current code cannot be viewed."
                    : "No code is set yet. Pharmacists cannot register until you create one."}
                </p>
              </div>
            </div>

            <form onSubmit={saveCode} className="mt-6 grid gap-4">
              <div>
                <label htmlFor="registration-code" className="text-sm font-medium">
                  {state.configured ? "New shared code" : "Set shared code"}
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
                  Confirm shared code
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
                  {problem}
                </p>
              )}
              {message && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-lg bg-ok-bg px-3 py-2.5 text-sm text-ok"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {message}
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
                      aria-label="Copy registration code"
                      className="rounded-md p-2 text-ok hover:bg-white/60"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShareCode(null)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-ok hover:bg-white/60"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-[#123a32] disabled:opacity-50"
              >
                {saving && (
                  <LoaderCircle
                    className="h-4 w-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                )}
                {saving ? "Saving code" : "Save registration code"}
              </button>
            </form>

            <p className="mt-4 text-xs leading-5 text-muted">
              Use at least 12 characters. The code is stored as a secure hash,
              so it cannot be recovered; set a new one if you forget it.
              Anyone with the shared code can register until you replace it.
              Replacing it does not deactivate existing pharmacists.
            </p>
          </section>

          <section className="rounded-xl border border-rule bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-paper">
                  <Users className="h-5 w-5 text-pine" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">Authorized pharmacists</h2>
                  <p className="mt-1 text-sm text-muted">
                    Accounts that have registered with your code.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium tabular-nums text-muted">
                {state.pharmacists.length}
              </span>
            </div>

            {state.pharmacists.length === 0 ? (
              <p className="mt-6 rounded-lg border border-dashed border-rule p-5 text-sm text-muted">
                No pharmacists have registered with the manager code yet.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-rule">
                {state.pharmacists.map((pharmacist) => (
                  <li key={pharmacist.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">
                      {pharmacist.full_name || pharmacist.email}
                    </p>
                    <p className="mt-0.5 break-all text-xs text-muted">
                      {pharmacist.email}
                    </p>
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
