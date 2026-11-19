"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL, type Medicine } from "@/lib/api";
import { medicineStatus } from "@/lib/status";
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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/medicines/${id}/`, { signal: controller.signal })
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
    if (!window.confirm("Delete this medicine? This cannot be undone.")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`${API_URL}/medicines/${id}/`, {
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
    } catch {
      setDeleteError(
        "Could not reach the server. Is Django running on port 8000?",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/medicines" className="text-sm text-blue-400 hover:underline">
        ← Back to medicines
      </Link>

      {state.status === "loading" && (
        <p className="mt-6 text-gray-500">Loading…</p>
      )}

      {state.status === "notfound" && (
        <p className="mt-6 text-gray-500">This medicine does not exist.</p>
      )}

      {state.status === "error" && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          <p>{state.message}</p>
          <button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="mt-3 rounded bg-red-700 px-3 py-1 text-white"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <Details medicine={state.medicine} />

          <MedicineForm
            key={state.medicine.id}
            title="Edit this medicine"
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

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={remove}
              disabled={deleting}
              className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete medicine"}
            </button>
            {deleteError && (
              <span className="text-sm text-red-400">{deleteError}</span>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function Details({ medicine }: { medicine: Medicine }) {
  const b = medicineStatus(medicine);
  return (
    <section className="mt-4">
      <h1 className="text-2xl font-bold">{medicine.name}</h1>
      <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs ${b.style}`}>
        {b.label}
      </span>
      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Price</dt>
          <dd>{Number(medicine.price).toLocaleString("en-US")} RWF</dd>
        </div>
        <div>
          <dt className="text-gray-500">In stock</dt>
          <dd>{medicine.stock}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Expires</dt>
          <dd>{medicine.expiry_date}</dd>
        </div>
      </dl>
    </section>
  );
}