"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, type Medicine } from "@/lib/api";
import { medicineStatus } from "@/lib/status";
import MedicineForm from "./MedicineForm";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; medicines: Medicine[] };

export default function MedicinesPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/medicines/`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`The server answered ${response.status}.`);
        }
        return (await response.json()) as Medicine[];
      })
      .then((medicines) => setState({ status: "ready", medicines }))
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
  }, [attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  function reload() {
    setAttempt((n) => n + 1);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Medicines</h1>
      <Link href="/sales" className="text-sm text-blue-400 hover:underline">
        New sale →
      </Link>
      <MedicineForm
        title="Add a medicine"
        submitLabel="Add medicine"
        successText="Medicine added."
        method="POST"
        url={`${API_URL}/medicines/`}
        successStatus={201}
        resetOnSuccess
        onSaved={reload}
      />

      {state.status === "loading" && (
        <p className="mt-6 text-gray-500">Loading medicines…</p>
      )}

      {state.status === "error" && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          <p>{state.message}</p>
          <button
            onClick={retry}
            className="mt-3 rounded bg-red-700 px-3 py-1 text-white"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <MedicineTable
          medicines={state.medicines}
          search={search}
          onSearch={setSearch}
        />
      )}
    </main>
  );
}

function MedicineTable({
  medicines,
  search,
  onSearch,
}: {
  medicines: Medicine[];
  search: string;
  onSearch: (value: string) => void;
}) {
  if (medicines.length === 0) {
    return (
      <p className="mt-6 text-gray-500">
        No medicines yet. Add the first one to get started.
      </p>
    );
  }

  const shown = medicines.filter((m) =>
    m.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by name"
        className="mt-4 w-full rounded border border-gray-300 bg-white p-2 text-black placeholder-gray-500"
      />
      <p className="mt-2 text-sm text-gray-500">
        Showing {shown.length} of {medicines.length}
      </p>

      {shown.length === 0 ? (
        <p className="mt-6 text-gray-500">No medicine matches “{search}”.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Price (RWF)</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const b = medicineStatus(m);
                return (
                  <tr key={m.id} className="border-b border-gray-200">
                    <td className="px-3 py-2">
                      <Link
                        href={`/medicines/${m.id}`}
                        className="text-blue-400 hover:underline"
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(m.price).toLocaleString("en-US")}
                    </td>
                    <td className="px-3 py-2 text-right">{m.stock}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {m.expiry_date}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${b.style}`}
                      >
                        {b.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}