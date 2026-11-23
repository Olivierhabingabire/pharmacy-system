"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { API_URL, authFetch, type Medicine } from "@/lib/api";
import { money } from "@/lib/format";
import { daysFromToday, medicineStatus, shortDate } from "@/lib/status";
import MedicineForm from "../MedicineForm";

type State =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "error"; message: string }
  | { status: "ready"; medicine: Medicine };

export default function MedicineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authFetch(`${API_URL}/medicines/${id}/`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setState({ status: "notfound" });
          return;
        }
        if (!response.ok) {
          throw new Error(`The server answered ${response.status}.`);
        }
        setState({
          status: "ready",
          medicine: (await response.json()) as Medicine,
        });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setState({
          status: "error",
          message: error.message.startsWith("The server")
            ? error.message
            : "Could not reach the server. Is Django running on port 8000?",
        });
      });
    return () => controller.abort();
  }, [id, attempt]);

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await authFetch(`${API_URL}/medicines/${id}/`, {
        method: "DELETE",
      });
      if (response.status === 204) {
        router.push("/medicines");
        return;
      }
      if (response.status === 409) {
        const body = (await response.json()) as { detail?: string };
        setDeleteError(body.detail ?? "This medicine cannot be deleted.");
      } else {
        setDeleteError(`The server answered ${response.status}.`);
      }
      setConfirming(false);
    } catch {
      setDeleteError(
        "Could not reach the server. Is Django running on port 8000?",
      );
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-8">
      <Link
        href="/medicines"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Medicines
      </Link>

      {state.status === "loading" && (
        <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading">
          <div className="h-8 w-64 rounded-md bg-rule motion-safe:animate-pulse" />
          <div className="h-20 rounded-lg bg-rule motion-safe:animate-pulse" />
        </div>
      )}

      {state.status === "notfound" && (
        <p className="mt-6 rounded-lg border border-dashed border-rule p-8 text-center text-sm text-muted">
          This medicine does not exist. It may have been deleted.
        </p>
      )}

      {state.status === "error" && (
        <div className="mt-6 rounded-lg border border-red/30 bg-red-bg p-4 text-sm text-red">
          <p>{state.message}</p>
          <button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="mt-3 rounded-md bg-red px-3 py-1.5 font-medium text-white"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <Facts medicine={state.medicine} />

          <section className="mt-8 rounded-lg border border-rule bg-surface p-5">
            <h2 className="font-semibold">Edit details</h2>
            <div className="mt-4 max-w-md">
              <MedicineForm
                key={state.medicine.id}
                submitLabel="Save changes"
                successText="Changes saved."
                method="PATCH"
                url={`${API_URL}/medicines/${id}/`}
                successStatus={200}
                initial={{
                  name: state.medicine.name,
                  price: state.medicine.price,
                  stock: String(state.medicine.stock),
                  expiry_date: state.medicine.expiry_date,
                }}
                resetOnSuccess={false}
                onSaved={() => setAttempt((n) => n + 1)}
              />
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-red/30 bg-surface p-5">
            <h2 className="font-semibold">Delete this medicine</h2>
            <p className="mt-1 text-sm text-muted">
              A medicine that has been sold cannot be deleted. Set its stock to
              0 instead.
            </p>
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="mt-4 rounded-md border border-red/40 px-4 py-2 text-sm font-medium text-red hover:bg-red-bg"
              >
                Delete medicine
              </button>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  Delete {state.medicine.name}?
                </span>
                <button
                  onClick={remove}
                  disabled={deleting}
                  className="rounded-md bg-red px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="rounded-md border border-rule px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
            {deleteError && (
              <p role="alert" className="mt-3 text-sm text-red">
                {deleteError}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Facts({ medicine }: { medicine: Medicine }) {
  const b = medicineStatus(medicine);
  const days = daysFromToday(medicine.expiry_date);
  const shelfLabel = days < 0 ? "Expired" : "Time left";
  const shelf =
    days < 0
      ? `${-days} ${-days === 1 ? "day" : "days"} ago`
      : days === 0
        ? "Today"
        : `${days} ${days === 1 ? "day" : "days"}`;

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {medicine.name}
        </h1>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${b.style}`}>
          {b.label}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4">
        <Fact label="Price" value={`${money(medicine.price)} RWF`} />
        <Fact label="In stock" value={String(medicine.stock)} />
        <Fact
          label="Expires"
          value={`${shortDate(medicine.expiry_date)} ${medicine.expiry_date.slice(0, 4)}`}
        />
        <Fact label={shelfLabel} value={shelf} />
      </dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}