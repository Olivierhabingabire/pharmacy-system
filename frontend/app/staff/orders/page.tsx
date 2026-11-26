"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  API_URL,
  authFetch,
  type OrderStatus,
  type PharmacyOrder,
} from "@/lib/api";
import { money } from "@/lib/format";

type QueueState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: PharmacyOrder[] };

const statusLabel: Record<OrderStatus, string> = {
  submitted: "Awaiting review",
  ready_for_pickup: "Ready for pickup",
  declined: "Declined",
  completed: "Collected",
  cancelled: "Cancelled",
};

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return body.detail ?? `The server answered ${response.status}.`;
}

export default function StaffOrdersPage() {
  const [state, setState] = useState<QueueState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchOrders = useCallback(async (signal?: AbortSignal) => {
    const response = await authFetch(`${API_URL}/staff/orders/`, { signal });
    if (!response.ok) throw new Error(await responseError(response));
    return (await response.json()) as PharmacyOrder[];
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchOrders(controller.signal)
      .then((orders) => setState({ status: "ready", orders }))
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setState({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [attempt, fetchOrders]);

  async function updateOrder(order: PharmacyOrder, action: string) {
    if (working) return;
    setWorking(order.id);
    setProblem(null);
    setNotice(null);
    try {
      const response = await authFetch(`${API_URL}/staff/orders/${order.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: notes[order.id] ?? "",
          prescription_checked:
            action === "approve" ? reviewed[order.id] === true : undefined,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setNotice(
        action === "approve"
          ? "Order approved and stock reserved. It is ready for pickup."
          : action === "complete"
            ? "Order marked collected and recorded as a sale."
            : action === "decline"
              ? "Order declined."
              : "Order cancelled and reserved stock released.",
      );
      const orders = await fetchOrders();
      setState({ status: "ready", orders });
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Could not update this order.",
      );
    } finally {
      setWorking(null);
    }
  }

  const orders = state.status === "ready" ? state.orders : [];
  const pendingCount = orders.filter((order) => order.status === "submitted").length;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[#c90062]">
            PHARMACY WORKSPACE
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-pine">
            Customer orders
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Review customer requests, check prescription requirements, and
            prepare approved orders for pickup. A sale is recorded only when
            the customer collects the medicines.
          </p>
        </div>
        <button
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-rule bg-white px-3 py-2 text-sm font-semibold text-pine hover:bg-[#fff5fa]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </header>

      {problem && (
        <p role="alert" className="mt-5 rounded-xl bg-red-bg p-3 text-sm text-red">
          {problem}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-5 rounded-xl bg-ok-bg p-3 text-sm text-ok">
          {notice}
        </p>
      )}
      {state.status === "loading" && (
        <p className="mt-8 text-sm text-muted">Loading customer orders…</p>
      )}
      {state.status === "error" && (
        <div className="mt-6 rounded-xl border border-red/30 bg-red-bg p-4 text-sm text-red">
          <p>{state.message}</p>
          <button
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}
      {state.status === "ready" &&
        (orders.length ? (
          <>
            <p className="mt-5 text-sm text-muted">
              {pendingCount} request{pendingCount === 1 ? "" : "s"} awaiting review
            </p>
            <ul className="mt-4 space-y-4">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="rounded-2xl border border-rule bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Request {order.id.slice(0, 8)}
                      </p>
                      <h2 className="mt-1 font-bold text-pine">
                        {order.customer_name || "Customer"}
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        {order.customer_email}
                        {order.customer_phone ? ` · ${order.customer_phone}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#fde2f0] px-3 py-1 text-xs font-bold text-[#c90062]">
                      {statusLabel[order.status]}
                    </span>
                  </div>

                  <ul className="mt-4 divide-y divide-rule border-y border-rule">
                    {order.items.map((item) => (
                      <li
                        key={item.medicine_id}
                        className="flex justify-between gap-3 py-2.5 text-sm"
                      >
                        <span className="text-pine">
                          {item.name} × {item.qty}
                        </span>
                        <span className="shrink-0 tabular-nums text-pine">
                          {money(item.line_total)} RWF
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between text-sm font-bold text-pine">
                    <span>Total</span>
                    <span>{money(order.total)} RWF</span>
                  </div>
                  {order.customer_note && (
                    <p className="mt-3 rounded-lg bg-[#fff5fa] p-3 text-sm text-pine">
                      <span className="font-semibold">Customer note:</span>{" "}
                      {order.customer_note}
                    </p>
                  )}
                  {order.staff_note && (
                    <p className="mt-2 text-sm text-muted">
                      <span className="font-semibold text-pine">Staff note:</span>{" "}
                      {order.staff_note}
                    </p>
                  )}

                  {order.status === "submitted" && (
                    <div className="mt-4 border-t border-rule pt-4">
                      <label className="flex items-start gap-2 text-sm leading-5 text-pine">
                        <input
                          type="checkbox"
                          checked={reviewed[order.id] ?? false}
                          onChange={(event) =>
                            setReviewed((current) => ({
                              ...current,
                              [order.id]: event.target.checked,
                            }))
                          }
                          className="mt-1 accent-[#e90074]"
                        />
                        I reviewed this request and checked whether a
                        prescription is required and valid.
                      </label>
                      <label className="mt-3 block text-sm font-semibold text-pine">
                        Note to customer
                        <textarea
                          value={notes[order.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [order.id]: event.target.value,
                            }))
                          }
                          maxLength={500}
                          rows={2}
                          placeholder="Required if declining"
                          className="mt-1.5 w-full resize-y rounded-xl border border-rule px-3 py-2 text-sm font-normal focus:border-cross focus:outline-none focus:ring-2 focus:ring-cross/20"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => void updateOrder(order, "approve")}
                          disabled={working !== null || !reviewed[order.id]}
                          className="rounded-xl bg-[#e90074] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {working === order.id ? "Updating…" : "Approve & reserve stock"}
                        </button>
                        <button
                          onClick={() => void updateOrder(order, "decline")}
                          disabled={working !== null || !(notes[order.id] ?? "").trim()}
                          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {order.status === "ready_for_pickup" && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
                      <p className="text-sm font-semibold text-emerald-700">
                        Reserved and waiting for pickup.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void updateOrder(order, "complete")}
                          disabled={working !== null}
                          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {working === order.id ? "Updating…" : "Mark collected"}
                        </button>
                        <button
                          onClick={() => void updateOrder(order, "cancel")}
                          disabled={working !== null}
                          className="rounded-xl border border-rule px-4 py-2.5 text-sm font-semibold text-pine hover:bg-[#fff5fa] disabled:opacity-50"
                        >
                          Cancel & release stock
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-rule bg-white p-8 text-center text-sm text-muted">
            No customer requests have been submitted yet.
          </p>
        ))}
    </main>
  );
}
