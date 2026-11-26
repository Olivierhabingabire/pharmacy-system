"use client";

import { useState, type FormEvent } from "react";
import { authFetch } from "@/lib/api";
import { useLanguage } from "@/lib/language";

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
  submitLabel,
  successText,
  method,
  url,
  successStatus,
  initial = empty,
  resetOnSuccess,
  onSaved,
}: {
  submitLabel: string;
  successText: string;
  method: "POST" | "PATCH";
  url: string;
  successStatus: number;
  initial?: Values;
  resetOnSuccess: boolean;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
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
      const response = await authFetch(url, {
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
        setMessage({ kind: "error", text: t("Please fix the marked fields.") });
      } else if (response.status === 404) {
        setMessage({ kind: "error", text: t("This medicine no longer exists.") });
      } else {
        setMessage({
          kind: "error",
          text: `The server answered ${response.status}.`,
        });
      }
    } catch {
      setMessage({
        kind: "error",
        text: t("Could not reach the server. Is Django running on port 8000?"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {fields.map((f) => (
        <div key={f.key}>
          <label htmlFor={`field-${f.key}`} className="text-sm font-medium">
            {t(f.label)}
          </label>
          <input
            id={`field-${f.key}`}
            type={f.type}
            value={values[f.key]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [f.key]: e.target.value }))
            }
            step={f.key === "price" ? "0.01" : undefined}
            aria-invalid={errors[f.key] ? true : undefined}
            aria-describedby={errors[f.key] ? `error-${f.key}` : undefined}
            className={`mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm ${
              errors[f.key] ? "border-red" : "border-rule"
            } focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/30`}
          />
          {errors[f.key] && (
            <p id={`error-${f.key}`} className="mt-1 text-xs text-red">
              {errors[f.key].join(" ")}
            </p>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#e90074] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t("Saving…") : submitLabel}
        </button>
        {message && (
          <p
            role="status"
            className={`text-sm ${message.kind === "ok" ? "text-ok" : "text-red"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}