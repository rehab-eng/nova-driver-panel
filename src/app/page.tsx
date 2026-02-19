"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Bars3Icon,
  BoltIcon,
  BellIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
  LifebuoyIcon,
  ArrowRightOnRectangleIcon,
  TruckIcon,
  WalletIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";

const cn = (...inputs: Array<string | undefined | false>) =>
  twMerge(clsx(inputs));

type Driver = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  wallet_balance: number | null;
  photo_url: string | null;
};

type Order = {
  id: string;
  driver_id?: string | null;
  customer_name: string | null;
  customer_location_text: string | null;
  order_type: string | null;
  receiver_name: string | null;
  payout_method: string | null;
  price: number | null;
  delivery_fee: number | null;
  status: string | null;
};

type WalletTx = {
  id: string;
  amount: number;
  type: "credit" | "debit" | string;
  method: string | null;
  note: string | null;
  created_at: string | null;
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-sky-50 text-sky-700 border-sky-200",
  delivering: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-orange-50 text-orange-700 border-orange-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  accepted: "تم القبول",
  delivering: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

function formatStatus(value: string | null | undefined): string {
  if (!value) return "-";
  return statusLabels[value] ?? value;
}

const driverStatusLabels: Record<string, string> = {
  online: "متصل",
  offline: "غير متصل",
};

function formatDriverStatus(value: string | null | undefined): string {
  if (!value) return "غير متصل";
  return driverStatusLabels[value] ?? value;
}

const payoutLabels: Record<string, string> = {
  card: "بطاقة مصرفية",
  wallet: "محفظة محلية",
  cash: "نقداً",
  bank_transfer: "حوالة مصرفية",
};

function formatPayout(value: string | null | undefined): string {
  if (!value) return "-";
  return payoutLabels[value] ?? value;
}

function formatTxType(value: string | null | undefined): string {
  if (!value) return "-";
  if (value === "credit") return "شحن";
  if (value === "debit") return "سحب";
  return value;
}

function buildWsUrl(path: string, params: Record<string, string>): string {
  const url = new URL(API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = path;
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export default function DriverPanel() {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [driver, setDriver] = useState<Driver | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);

  const ordersRef = useRef<Order[]>([]);
  const hasLoadedRef = useRef(false);
  const flashTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const storedDriver = localStorage.getItem("nova.driver");
    const storedCode = localStorage.getItem("nova.driver_code");
    const storedEmail = localStorage.getItem("nova.driver_email");
    if (storedDriver) setDriver(JSON.parse(storedDriver));
    if (storedCode) setSecretCode(storedCode);
    if (storedEmail) setEmail(storedEmail);
  }, []);

  useEffect(() => {
    if (driver) localStorage.setItem("nova.driver", JSON.stringify(driver));
  }, [driver, secretCode]);

  useEffect(() => {
    setPhotoUrl(driver?.photo_url ?? "");
  }, [driver]);

  useEffect(() => {
    if (driver?.email) setEmail(driver.email);
  }, [driver]);

  const logout = () => {
    localStorage.removeItem("nova.driver");
    localStorage.removeItem("nova.driver_code");
    localStorage.removeItem("nova.driver_email");
    setDriver(null);
    setSecretCode("");
    setEmail("");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  useEffect(() => {
    localStorage.setItem("nova.driver_code", secretCode);
  }, [secretCode]);

  useEffect(() => {
    localStorage.setItem("nova.driver_email", email);
  }, [email]);

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
          toast.success(`طلب جديد ${order.id.slice(0, 6)}...`);
          flashOrder(order.id);
        } else if (previous.status !== order.status) {
          toast(`تم تحديث حالة الطلب إلى ${formatStatus(order.status)}`, {
            icon: "🔔",
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
    let socket: WebSocket | null = null;
    let pingTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let retry = 0;

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
        if (showToasts) toast.error("تعذر تحميل الطلبات");
      }
    };

    const upsertOrder = (
      incoming: Partial<Order> & { id: string },
      showToasts = true
    ) => {
      const current = ordersRef.current;
      const idx = current.findIndex((order) => order.id === incoming.id);
      let next: Order[];
      if (idx >= 0) {
        next = [...current];
        next[idx] = { ...next[idx], ...incoming };
      } else {
        next = [incoming as Order, ...current];
      }
      const shouldToast = showToasts && hasLoadedRef.current;
      applyOrders(next, shouldToast);
      if (!hasLoadedRef.current) hasLoadedRef.current = true;
    };

    const handleRealtime = (payload: Record<string, unknown>) => {
      const type = payload.type;
      if (type === "order_created" && payload.order && typeof payload.order === "object") {
        const order = payload.order as Order;
        if (order.driver_id && order.driver_id !== driver.id) return;
        upsertOrder(order);
        return;
      }
      if (type === "order_status" && typeof payload.order_id === "string") {
        upsertOrder(
          {
            id: payload.order_id,
            status: typeof payload.status === "string" ? payload.status : null,
            driver_id:
              typeof payload.driver_id === "string" ? payload.driver_id : null,
          },
          true
        );
        return;
      }
      if (type === "wallet_transaction" && typeof payload.driver_id === "string") {
        if (payload.driver_id !== driver.id) return;
        const balance =
          typeof payload.balance === "number" ? payload.balance : null;
        if (balance !== null) {
          setDriver((prev) => (prev ? { ...prev, wallet_balance: balance } : prev));
        }
        if (payload.transaction && typeof payload.transaction === "object") {
          const tx = payload.transaction as WalletTx;
          setTransactions((prev) => [tx, ...prev].slice(0, 6));
        }
        return;
      }
      if (type === "driver_status" && typeof payload.driver_id === "string") {
        if (payload.driver_id !== driver.id) return;
        const nextStatus =
          typeof payload.status === "string" ? payload.status : null;
        if (nextStatus) {
          setDriver((prev) => (prev ? { ...prev, status: nextStatus } : prev));
        }
      }
    };

    const startSocket = () => {
      const driverEmail = driver.email ?? email;
      if (!driverEmail) return;
      const wsUrl = buildWsUrl("/realtime", {
        role: "driver",
        driver_id: driver.id,
        secret_code: secretCode,
        email: driverEmail,
      });
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        retry = 0;
        if (pingTimer) window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          handleRealtime(payload);
        } catch {
          // ignore
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (pingTimer) window.clearInterval(pingTimer);
        if (!active) return;
        const delay = Math.min(30000, 1000 * 2 ** retry);
        retry += 1;
        reconnectTimer = window.setTimeout(startSocket, delay);
      };
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

    startSocket();
    fetchOrders(false);

    const poll = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        fetchOrders(true);
      }
    }, 6000);

    return () => {
      active = false;
      source?.close();
      socket?.close();
      if (pingTimer) window.clearInterval(pingTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(poll);
    };
  }, [driver]);

  useEffect(() => {
    if (!driver) return;
    fetchTransactions();
  }, [driver, secretCode]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("البريد الإلكتروني مطلوب");
      return;
    }
    const toastId = toast.loading("جاري تسجيل الدخول...");

    try {
      const res = await fetch(`${API_BASE}/drivers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email, secret_code: secretCode }),
      });

      const data = await res.json();
      if (data?.driver?.id) {
        setDriver(data.driver);
        toast.success("مرحباً بعودتك", { id: toastId });
      } else {
        toast.error(data?.error ?? "فشل تسجيل الدخول", { id: toastId });
      }
    } catch {
      toast.error("خطأ في الشبكة", { id: toastId });
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

  const fetchTransactions = async () => {
    if (!driver) return;
    try {
      await refreshDriver();
      const res = await fetch(
        `${API_BASE}/drivers/${driver.id}/wallet/transactions?secret_code=${encodeURIComponent(
          secretCode
        )}&limit=5`
      );
      const data = await res.json();
      if (data?.transactions) setTransactions(data.transactions);
    } catch {
      // ignore
    }
  };

  const setDriverStatus = async (nextStatus: "online" | "offline") => {
    if (!driver) return;
    const toastId = toast.loading("جاري تحديث حالة السائق...");
    try {
      const res = await fetch(`${API_BASE}/drivers/${driver.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Driver-Code": secretCode },
        body: JSON.stringify({ status: nextStatus, secret_code: secretCode }),
      });
      const data = await res.json();
      if (data?.ok) {
        toast.success("تم تحديث الحالة", { id: toastId });
        await refreshDriver();
      } else {
        toast.error(data?.error ?? "فشل تحديث الحالة", { id: toastId });
      }
    } catch {
      toast.error("خطأ في الشبكة", { id: toastId });
    }
  };

  const updatePhoto = async () => {
    if (!driver) return;
    if (!photoUrl.trim()) {
      toast.error("أدخل رابط الصورة");
      return;
    }
    const toastId = toast.loading("جاري حفظ الصورة...");
    try {
      const res = await fetch(`${API_BASE}/drivers/${driver.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Driver-Code": secretCode },
        body: JSON.stringify({ photo_url: photoUrl, secret_code: secretCode }),
      });
      const data = await res.json();
      if (data?.driver) {
        setDriver(data.driver);
        toast.success("تم تحديث الصورة", { id: toastId });
      } else {
        toast.error(data?.error ?? "فشل تحديث الصورة", { id: toastId });
      }
    } catch {
      toast.error("خطأ في الشبكة", { id: toastId });
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    if (!driver) return;

    const toastId = toast.loading("جاري تحديث الحالة...");

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
        toast.success("تم تحديث الحالة", { id: toastId });
        await refreshDriver();
      } else {
        toast.error(data?.error ?? "فشل التحديث", { id: toastId });
      }
    } catch {
      toast.error("خطأ في الشبكة", { id: toastId });
    }
  };

  if (!driver) {
    return (
      <div className="min-h-screen bg-[#eef1f6] text-slate-900 [background-image:radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_60%),radial-gradient(circle_at_bottom,rgba(148,163,184,0.25),transparent_60%)]">
        <Toaster position="top-center" />
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
          <div className="rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
                  <Image src="/logo.png" alt="NOVA MAX" width={46} height={46} />
                </div>
                <div className="text-right">
                  <p className="text-xs tracking-[0.25em] text-slate-500">
                    نوفا ماكس
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    لوحة السائق
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                واجهة هاتفية
              </span>
            </div>

            <div className="mt-6 text-right">
              <h1 className="text-2xl font-semibold">تسجيل دخول السائق</h1>
              <p className="mt-2 text-sm text-slate-500">
                أدخل رقم الهاتف والكود السري من لوحة المتجر.
              </p>
            </div>

            <form onSubmit={login} className="mt-6 grid w-full gap-4">
              <input
                className="h-14 rounded-2xl border border-white/60 bg-white/70 px-4 text-base text-slate-900 outline-none focus:border-orange-500/80"
                placeholder="رقم الهاتف"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                className="h-14 rounded-2xl border border-white/60 bg-white/70 px-4 text-base text-slate-900 outline-none focus:border-orange-500/80"
                placeholder="البريد الإلكتروني"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="h-14 rounded-2xl border border-white/60 bg-white/70 px-4 text-base text-slate-900 outline-none focus:border-orange-500/80"
                placeholder="الكود السري"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
              />
              <button className="h-14 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-400 text-base font-semibold text-slate-950 shadow-lg shadow-orange-500/30 transition hover:translate-y-[-1px]">
                دخول لوحة السائق
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] text-slate-900 [background-image:radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_60%),radial-gradient(circle_at_bottom,rgba(148,163,184,0.25),transparent_60%)]">
      <Toaster position="top-center" />
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            onClick={() => setMenuOpen(false)}
            aria-label="إغلاق القائمة"
          />
          <div className="relative h-full w-[85%] max-w-xs bg-white/80 p-5 text-right shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-[0.25em] text-slate-500">نوفا ماكس</p>
                <p className="text-base font-semibold text-slate-900">
                  {driver.name ?? "السائق"}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/60 bg-white/70 p-2"
                onClick={() => setMenuOpen(false)}
                aria-label="إغلاق"
              >
                <XMarkIcon className="h-5 w-5 text-slate-700" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => scrollToSection("profile")}
                className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                الملف الشخصي
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("wallet")}
                className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                المحفظة
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("orders")}
                className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                الطلبات
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/60 bg-white/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Cog6ToothIcon className="h-4 w-4 text-orange-500" />
                الإعدادات
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>إشعارات الطلبات</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                    مفعّل
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>الوضع الصامت</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">
                    غير مفعّل
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                الدعم الفني
                <LifebuoyIcon className="h-4 w-4 text-slate-600" />
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
              >
                تسجيل الخروج
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 pb-24">
        <header className="rounded-[28px] border border-white/60 bg-white/70 p-4 text-right shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-slate-700"
                aria-label="فتح القائمة"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white">
              <img
                src={driver.photo_url ?? "/logo.png"}
                alt="NOVA MAX"
                className="h-full w-full object-cover"
              />
            </div>
              <div>
                <p className="text-xs tracking-[0.25em] text-slate-500">
                  نوفا ماكس
                </p>
                <p className="text-sm text-slate-700">لوحة السائق</p>
              </div>
            </div>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              {formatDriverStatus(driver.status)}
            </span>
          </div>
          <div className="mt-4 rounded-2xl border border-orange-200 bg-gradient-to-l from-orange-100/80 via-orange-50 to-transparent px-4 py-4">
            <p className="text-xs text-slate-600">رصيد المحفظة</p>
            <p className="text-3xl font-semibold text-slate-900">
              {typeof driver.wallet_balance === "number"
                ? driver.wallet_balance.toFixed(2)
                : "0.00"}
            </p>
          </div>
        </header>

        <section
          id="profile"
          className="mt-4 rounded-[26px] border border-white/60 bg-white/70 p-4 text-right shadow-[0_16px_40px_-28px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        >
          <p className="text-xs tracking-[0.25em] text-slate-500">بيانات السائق</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {driver.name ?? "السائق"}
          </p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="text-xs tracking-[0.2em] text-slate-500">الهاتف</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {driver.phone ?? phone ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="text-xs tracking-[0.2em] text-slate-500">البريد الإلكتروني</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {driver.email ?? email ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="text-xs tracking-[0.2em] text-slate-500">الكود السري</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {secretCode || "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setDriverStatus(driver.status === "online" ? "offline" : "online")
              }
              className="h-12 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-400 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/30 transition hover:translate-y-[-1px]"
            >
              {driver.status === "online" ? "تحويل إلى غير متصل" : "تحويل إلى متصل"}
            </button>
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="text-xs tracking-[0.2em] text-slate-500">
                رابط صورة السائق
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <input
                  className="h-11 rounded-xl border border-white/60 bg-white/70 px-3 text-sm text-slate-900 outline-none focus:border-orange-500/80"
                  placeholder="https://"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                />
                <button
                  type="button"
                  onClick={updatePhoto}
                  className="h-11 rounded-xl border border-orange-400/40 bg-orange-500/10 text-sm font-semibold text-slate-900 transition hover:bg-orange-500/20"
                >
                  حفظ الصورة
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="orders" className="mt-5 flex-1 space-y-4 pb-8 text-right">
          <div
            id="wallet"
            className="rounded-[26px] border border-white/60 bg-white/70 p-4 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                حركات المحفظة الأخيرة
              </p>
              <button
                type="button"
                onClick={fetchTransactions}
                className="text-xs text-slate-600"
              >
                تحديث
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {transactions.length === 0 && (
                <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-center text-slate-500">
                  لا توجد حركات بعد.
                </div>
              )}
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatTxType(tx.type)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatPayout(tx.method)}
                      {tx.note ? ` · ${tx.note}` : ""}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      tx.type === "credit" ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {tx.type === "debit" ? "-" : "+"}
                    {Number.isFinite(tx.amount) ? tx.amount.toFixed(2) : "-"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {orders.map((order) => (
            <div
              key={order.id}
              className={cn(
                "rounded-[26px] border border-white/60 bg-white/70 p-5 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.7)] transition backdrop-blur-xl",
                flashIds.has(order.id) ? "ring-2 ring-orange-400/70" : ""
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {order.customer_name ?? "العميل"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.customer_location_text ?? "الموقع غير محدد"}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-500">
                    <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2">
                      <p className="tracking-[0.2em] text-[10px] text-slate-500">
                        المستلم
                      </p>
                      <p className="mt-1 text-sm text-slate-900">
                        {order.receiver_name ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2">
                      <p className="tracking-[0.2em] text-[10px] text-slate-500">
                        نوع الطلب
                      </p>
                      <p className="mt-1 text-sm text-slate-900">
                        {order.order_type ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
                      <p className="tracking-[0.2em] text-[10px] text-slate-600">
                        طريقة الدفع
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatPayout(order.payout_method)}
                      </p>
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                    statusStyles[order.status ?? ""] ?? "border-white/60 text-slate-700"
                  )}
                >
                  {formatStatus(order.status)}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm">
                <div>
                  <p className="text-xs tracking-[0.2em] text-slate-500">
                    رسوم التوصيل
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {typeof order.delivery_fee === "number"
                      ? order.delivery_fee.toFixed(2)
                      : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs tracking-[0.2em] text-slate-500">
                    الطلب
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {order.id.slice(0, 6)}...
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {order.status === "pending" && (
                  <button
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-200 text-base font-semibold text-slate-900 transition hover:bg-sky-300"
                    onClick={() => updateStatus(order.id, "accepted")}
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    قبول الطلب
                  </button>
                )}
                {order.status === "accepted" && (
                  <button
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-indigo-200 text-base font-semibold text-slate-900 transition hover:bg-indigo-300"
                    onClick={() => updateStatus(order.id, "delivering")}
                  >
                    <TruckIcon className="h-5 w-5" />
                    بدء التوصيل
                  </button>
                )}
                {order.status === "delivering" && (
                  <button
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-orange-200 text-base font-semibold text-slate-900 transition hover:bg-orange-300"
                    onClick={() => updateStatus(order.id, "delivered")}
                  >
                    <BoltIcon className="h-5 w-5" />
                    تم التسليم
                  </button>
                )}
                {order.status !== "delivered" && order.status !== "cancelled" && (
                  <button
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/10 text-base font-semibold text-rose-100 transition hover:bg-rose-500/20"
                    onClick={() => updateStatus(order.id, "cancelled")}
                  >
                    <XCircleIcon className="h-5 w-5" />
                    إلغاء الطلب
                  </button>
                )}
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="rounded-[26px] border border-white/60/80 bg-white/70/70 px-6 py-8 text-center text-base text-slate-700">
              لا توجد طلبات مخصصة بعد.
            </div>
          )}
        </section>
      </div>
      <nav className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-[24px] border border-white/60 bg-white/80 px-4 py-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        <div className="grid grid-cols-4 gap-3 text-xs text-slate-700">
          <button
            type="button"
            onClick={() => scrollToSection("profile")}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/60 bg-white/70 py-2"
          >
            <HomeIcon className="h-5 w-5 text-orange-500" />
            الرئيسية
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("orders")}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/60 bg-white/70 py-2"
          >
            <ClipboardDocumentListIcon className="h-5 w-5 text-slate-600" />
            الطلبات
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("wallet")}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/60 bg-white/70 py-2"
          >
            <WalletIcon className="h-5 w-5 text-slate-600" />
            المحفظة
          </button>
          <button
            type="button"
            onClick={() => toast("لا توجد إشعارات جديدة")}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/60 bg-white/70 py-2"
          >
            <BellIcon className="h-5 w-5 text-slate-600" />
            الإشعارات
          </button>
        </div>
      </nav>
    </div>
  );
}







