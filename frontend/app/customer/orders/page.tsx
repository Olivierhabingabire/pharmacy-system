"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { API_URL, authFetch, type PharmacyOrder } from "@/lib/api";
import { money } from "@/lib/format";

type OrdersState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: PharmacyOrder[] };

const statusLabel: Record<PharmacyOrder["status"], string> = {
  submitted: "Awaiting pharmacist review",
  ready_for_pickup: "Ready for pickup",
  declined: "Not approved",
  completed: "Collected",
  cancelled: "Cancelled",
};

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return body.detail ?? `The server answered ${response.status}.`;
}

export default function CustomerOrdersPage() {
  const [state, setState] = useState<OrdersState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const fetchOrders = useCallback(async (signal?: AbortSignal) => {
    const response = await authFetch(`${API_URL}/customer/orders/`, { signal });
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

  async function cancelOrder(orderId: string) {
    if (working) return;
    setWorking(orderId);
    setProblem(null);
    try {
      const response = await authFetch(
        `${API_URL}/customer/orders/${orderId}/cancel/`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const orders = await fetchOrders();
      setState({ status: "ready", orders });
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Could not cancel this order.",
      );
    } finally {
      setWorking(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[#c90062]">
            CUSTOMER PORTAL
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-pine">
            My orders
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track requests and see when an approved order is ready for pickup.
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
      {state.status === "loading" && (
        <p className="mt-8 text-sm text-muted">Loading your orders…</p>
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
        (state.orders.length ? (
          <ul className="mt-6 space-y-4">
            {state.orders.map((order) => (
              <li
                key={order.id}
                className="rounded-2xl border border-rule bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Request {order.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      order.status === "ready_for_pickup"
                        ? "bg-emerald-50 text-emerald-700"
                        : order.status === "declined" || order.status === "cancelled"
                          ? "bg-red-50 text-red-700"
                          : "bg-[#fde2f0] text-[#c90062]"
                    }`}
                  >
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
                  <span>{order.status === "submitted" ? "Estimated total" : "Total"}</span>
                  <span>{money(order.total)} RWF</span>
                </div>
                {order.customer_note && (
                  <p className="mt-3 text-sm text-muted">
                    <span className="font-semibold text-pine">Your note:</span>{" "}
                    {order.customer_note}
                  </p>
                )}
                {order.staff_note && (
                  <p className="mt-2 rounded-lg bg-[#fff5fa] p-3 text-sm text-pine">
                    <span className="font-semibold">Pharmacy:</span>{" "}
                    {order.staff_note}
                  </p>
                )}
                {order.status === "ready_for_pickup" && (
                  <p className="mt-3 text-sm font-semibold text-emerald-700">
                    Please collect this order at the pharmacy. Payment is handled
                    at pickup.
                  </p>
                )}
                {["submitted", "ready_for_pickup"].includes(order.status) && (
                  <button
                    onClick={() => void cancelOrder(order.id)}
                    disabled={working !== null}
                    className="mt-4 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {working === order.id ? "Cancelling…" : "Cancel request"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-rule bg-white p-8 text-center text-sm text-muted">
            You have no requests yet. Browse medicines to start an order.
          </p>
        ))}
    </main>
  );
}
