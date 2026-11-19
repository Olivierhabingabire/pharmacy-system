"use client";

import { useState, type FormEvent } from "react";

type Values = {
  name: string;
  price: string;
  stock: string;
  expiry_date: string;
};
type FieldErrors = Record<string, string[]>;
type Message = { kind: "ok" | "error"; text: string } | null;

const empty: Values = { name: "", price: "", stock: "", expiry_date: "" };

const fields = [
  { key: "name", label: "Name", type: "text" },
  { key: "price", label: "Price (RWF)", type: "number" },
  { key: "stock", label: "Stock", type: "number" },
  { key: "expiry_date", label: "Expiry date", type: "date" },
] as const;

export default function MedicineForm({
  title,
  submitLabel,
  successText,
  method,
  url,
  successStatus,
  initial = empty,
  resetOnSuccess,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  successText: string;
  method: "POST" | "PATCH";
  url: string;
  successStatus: number;
  initial?: Values;
  resetOnSuccess: boolean;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<Message>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // ignore a second click while the first is running
    setSubmitting(true);
    setErrors({});
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          price: values.price,
          stock: values.stock === "" ? null : Number(values.stock),
          expiry_date: values.expiry_date,
        }),
      });
      if (response.status === successStatus) {
        if (resetOnSuccess) setValues(empty);
        setMessage({ kind: "ok", text: successText });
        onSaved();
      } else if (response.status === 400) {
        setErrors((await response.json()) as FieldErrors);
        setMessage({ kind: "error", text: "Please fix the marked fields." });
      } else if (response.status === 404) {
        setMessage({ kind: "error", text: "This medicine no longer exists." });
      } else {
        setMessage({
          kind: "error",
          text: `The server answered ${response.status}.`,
        });
      }
    } catch {
      setMessage({
        kind: "error",
        text: "Could not reach the server. Is Django running on port 8000?",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-3 rounded border border-gray-300 p-4 sm:grid-cols-2"
    >
      <h2 className="font-semibold sm:col-span-2">{title}</h2>

      {fields.map((f) => (
        <label key={f.key} className="text-sm">
          {f.label}
          <input
            type={f.type}
            value={values[f.key]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [f.key]: e.target.value }))
            }
            step={f.key === "price" ? "0.01" : undefined}
            className={`mt-1 w-full rounded border bg-white p-2 text-black ${
              errors[f.key] ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors[f.key] && (
            <span className="mt-1 block text-xs text-red-400">
              {errors[f.key].join(" ")}
            </span>
          )}
        </label>
      ))}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
        {message && (
          <span
            className={
              message.kind === "ok"
                ? "text-sm text-green-400"
                : "text-sm text-red-400"
            }
          >
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}