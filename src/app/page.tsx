"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  BoltIcon,
  CheckCircleIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";

const cn = (...inputs: Array<string | undefined | false>) =>
  twMerge(clsx(inputs));

type Driver = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  wallet_balance: number | null;
};

type Order = {
  id: string;
  customer_name: string | null;
  customer_location_text: string | null;
  order_type: string | null;
  receiver_name: string | null;
  payout_method: string | null;
  price: number | null;
  delivery_fee: number | null;
  status: string | null;
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-200 border-amber-400/40",
  accepted: "bg-sky-500/20 text-sky-200 border-sky-400/40",
  delivering: "bg-indigo-500/20 text-indigo-200 border-indigo-400/40",
  delivered: "bg-orange-500/20 text-orange-200 border-orange-400/40",
  cancelled: "bg-rose-500/20 text-rose-200 border-rose-400/40",
};

const payoutLabels: Record<string, string> = {
  card: "Bank Card",
  wallet: "Local Wallet",
  cash: "Cash",
  bank_transfer: "Bank Transfer",
};

function formatPayout(value: string | null | undefined): string {
  if (!value) return "-";
  return payoutLabels[value] ?? value;
}

export default function DriverPanel() {
  const [phone, setPhone] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [driver, setDriver] = useState<Driver | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const ordersRef = useRef<Order[]>([]);
  const hasLoadedRef = useRef(false);
  const flashTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const storedDriver = localStorage.getItem("nova.driver");
    const storedCode = localStorage.getItem("nova.driver_code");
    if (storedDriver) setDriver(JSON.parse(storedDriver));
    if (storedCode) setSecretCode(storedCode);
  }, []);

  useEffect(() => {
    if (driver) localStorage.setItem("nova.driver", JSON.stringify(driver));
  }, [driver]);

  useEffect(() => {
    localStorage.setItem("nova.driver_code", secretCode);
  }, [secretCode]);

  const flashOrder = (id: string) => {
    setFlashIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const existing = flashTimers.current.get(id);
    if (existing) window.clearTimeout(existing);

    const timeout = window.setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      flashTimers.current.delete(id);
    }, 2000);

    flashTimers.current.set(id, timeout);
  };

  const applyOrders = (nextOrders: Order[], showToasts: boolean) => {
    const prev = ordersRef.current;
    const prevMap = new Map(prev.map((order) => [order.id, order]));

    if (showToasts) {
      for (const order of nextOrders) {
        const previous = prevMap.get(order.id);
        if (!previous) {
          toast.success(`New order ${order.id.slice(0, 6)}...`);
          flashOrder(order.id);
        } else if (previous.status !== order.status) {
          toast(`Order ${order.id.slice(0, 6)}... is now ${order.status}`, {
            icon: "?",
          });
          flashOrder(order.id);
        }
      }
    }

    ordersRef.current = nextOrders;
    setOrders(nextOrders);
  };

  useEffect(() => {
    if (!driver) return;
    let active = true;
    let source: EventSource | null = null;

    const fetchOrders = async (showToasts: boolean) => {
      try {
        const res = await fetch(
          `${API_BASE}/orders?driver_id=${encodeURIComponent(driver.id)}`
        );
        const data = await res.json();
        if (active && data?.orders) {
          applyOrders(data.orders, showToasts && hasLoadedRef.current);
          if (!hasLoadedRef.current) hasLoadedRef.current = true;
        }
      } catch {
        if (showToasts) toast.error("Failed to load orders");
      }
    };

    const startSSE = () => {
      source = new EventSource(
        `${API_BASE}/orders/stream?driver_id=${encodeURIComponent(driver.id)}`
      );
      source.addEventListener("orders", (event) => {
        if (!active) return;
        const list = JSON.parse((event as MessageEvent).data) as Order[];
        applyOrders(list, hasLoadedRef.current);
        if (!hasLoadedRef.current) hasLoadedRef.current = true;
      });
      source.onerror = () => {
        source?.close();
        source = null;
      };
    };

    startSSE();
    fetchOrders(false);

    const poll = window.setInterval(() => {
      if (!source) fetchOrders(true);
    }, 4000);

    return () => {
      active = false;
      source?.close();
      window.clearInterval(poll);
    };
  }, [driver]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Signing in...");

    try {
      const res = await fetch(`${API_BASE}/drivers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, secret_code: secretCode }),
      });

      const data = await res.json();
      if (data?.driver?.id) {
        setDriver(data.driver);
        toast.success("Welcome back", { id: toastId });
      } else {
        toast.error(data?.error ?? "Login failed", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    }
  };

  const refreshDriver = async () => {
    if (!driver) return;
    const res = await fetch(
      `${API_BASE}/drivers/${driver.id}?secret_code=${encodeURIComponent(secretCode)}`
    );
    const data = await res.json();
    if (data?.driver) setDriver(data.driver);
  };

  const updateStatus = async (orderId: string, status: string) => {
    if (!driver) return;

    const toastId = toast.loading("Updating status...");

    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Driver-Code": secretCode },
        body: JSON.stringify({
          status,
          driver_id: driver.id,
          secret_code: secretCode,
        }),
      });

      const data = await res.json();
      if (data?.ok) {
        toast.success("Status updated", { id: toastId });
        await refreshDriver();
      } else {
        toast.error(data?.error ?? "Update failed", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    }
  };

  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Toaster position="top-right" />
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
          <div className="flex w-full flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-10 shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
              <Image src="/logo.png" alt="NOVA MAX" width={52} height={52} />
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                Nova Max
              </p>
              <h1 className="text-2xl font-semibold">Driver Login</h1>
            </div>
            <form onSubmit={login} className="mt-4 grid w-full gap-3">
              <input
                className="h-12 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 outline-none focus:border-slate-600"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                className="h-12 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 outline-none focus:border-slate-600"
                placeholder="Secret Code"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
              />
              <button className="h-12 rounded-2xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400">
                Enter Driver Panel
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <header className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
              <Image src="/logo.png" alt="NOVA MAX" width={40} height={40} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                NOVA MAX
              </p>
              <p className="text-sm text-slate-200">Ready for delivery</p>
            </div>
          </div>
          <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-right">
            <p className="text-xs text-orange-200">Wallet Balance</p>
            <p className="text-2xl font-semibold text-orange-100">
              {typeof driver.wallet_balance === "number"
                ? driver.wallet_balance.toFixed(2)
                : "0.00"}
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Driver Profile
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  {driver.name ?? "Driver"}
                </p>
              </div>
              <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Phone
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {driver.phone ?? phone ?? "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Secret Code
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {secretCode || "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-orange-200">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-semibold text-orange-100">
                    {driver.status ?? "offline"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className={cn(
                "rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg transition",
                flashIds.has(order.id) ? "ring-2 ring-indigo-400/70" : ""
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-100">
                    {order.customer_name ?? "Customer"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {order.customer_location_text ?? "Location not set"}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                      <p className="uppercase tracking-[0.2em] text-[10px] text-slate-500">
                        Recipient
                      </p>
                      <p className="mt-1 text-sm text-slate-100">
                        {order.receiver_name ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                      <p className="uppercase tracking-[0.2em] text-[10px] text-slate-500">
                        Order Type
                      </p>
                      <p className="mt-1 text-sm text-slate-100">
                        {order.order_type ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2">
                      <p className="uppercase tracking-[0.2em] text-[10px] text-orange-200">
                        Payout Method
                      </p>
                      <p className="mt-1 text-sm font-semibold text-orange-100">
                        {formatPayout(order.payout_method)}
                      </p>
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                    statusStyles[order.status ?? ""] ?? "border-slate-700 text-slate-300"
                  )}
                >
                  {order.status ?? "unknown"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Delivery Fee
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-100">
                    {typeof order.delivery_fee === "number"
                      ? order.delivery_fee.toFixed(2)
                      : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Order
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-100">
                    {order.id.slice(0, 6)}...
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {order.status === "pending" && (
                  <button
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-sky-500 text-sm font-semibold text-white transition hover:bg-sky-400"
                    onClick={() => updateStatus(order.id, "accepted")}
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    Accept Order
                  </button>
                )}
                {order.status === "accepted" && (
                  <button
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400"
                    onClick={() => updateStatus(order.id, "delivering")}
                  >
                    <TruckIcon className="h-5 w-5" />
                    Start Delivery
                  </button>
                )}
                {order.status === "delivering" && (
                  <button
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-400"
                    onClick={() => updateStatus(order.id, "delivered")}
                  >
                    <BoltIcon className="h-5 w-5" />
                    Mark Delivered
                  </button>
                )}
                {order.status !== "delivered" && order.status !== "cancelled" && (
                  <button
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/10 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20"
                    onClick={() => updateStatus(order.id, "cancelled")}
                  >
                    <XCircleIcon className="h-5 w-5" />
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-8 text-center text-sm text-slate-400">
              No assigned orders yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
