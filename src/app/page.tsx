"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  BoltIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  HomeIcon,
  LifebuoyIcon,
  MapPinIcon,
  TruckIcon,
  UserCircleIcon,
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
  created_at?: string | null;
};

type WalletTx = {
  id: string;
  amount: number;
  type: "credit" | "debit" | string;
  method: string | null;
  note: string | null;
  created_at: string | null;
};

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  created_at: string;
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-sky-50 text-sky-700 border-sky-200",
  delivering: "bg-orange-50 text-orange-700 border-orange-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
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

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

const canUseWebAuthn = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "PublicKeyCredential" in window;

const bufferToBase64Url = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const base64UrlToBuffer = (base64Url: string) => {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const randomChallenge = (size = 32) => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
};

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
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLinked, setBiometricLinked] = useState(false);
  const [walletUnlocked, setWalletUnlocked] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "home" | "orders" | "wallet" | "notifications" | "profile" | "history" | "support"
  >("home");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

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
    setBiometricSupported(canUseWebAuthn());
  }, []);

  useEffect(() => {
    if (driver) localStorage.setItem("nova.driver", JSON.stringify(driver));
  }, [driver, secretCode]);

  useEffect(() => {
    if (driver?.email) setEmail(driver.email);
  }, [driver]);

  const getBiometricKey = () => {
    if (!phone.trim() || !secretCode.trim()) return null;
    return `nova.webauthn.${phone.trim()}.${secretCode.trim()}`;
  };

  useEffect(() => {
    const key = getBiometricKey();
    if (!key) return;
    setBiometricLinked(!!localStorage.getItem(key));
  }, [phone, secretCode, driver]);

  const logout = () => {
    localStorage.removeItem("nova.driver");
    localStorage.removeItem("nova.driver_code");
    localStorage.removeItem("nova.driver_email");
    const key = getBiometricKey();
    if (key) localStorage.removeItem(key);
    setDriver(null);
    setSecretCode("");
    setEmail("");
    setActiveSection("home");
    setWalletUnlocked(false);
    window.location.reload();
  };

  const goToSection = async (
    section:
      | "home"
      | "orders"
      | "wallet"
      | "notifications"
      | "profile"
      | "history"
      | "support"
  ) => {
    if (section === "wallet") {
      const biometricOk = await ensureBiometric();
      if (!biometricOk) return;
      setWalletUnlocked(true);
    }
    setActiveSection(section);
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

  const pushNotification = (title: string, description?: string) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const entry: NotificationItem = {
      id,
      title,
      description,
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => [entry, ...prev].slice(0, 20));
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
        pushNotification("طلب جديد", order.customer_location_text ?? "تم تعيين طلب جديد.");
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
        if (typeof payload.status === "string") {
          pushNotification(
            "تحديث حالة الطلب",
            `الحالة الآن: ${formatStatus(payload.status)}`
          );
        }
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
          pushNotification(
            "حركة محفظة جديدة",
            `${formatTxType(tx.type)} بقيمة ${
              Number.isFinite(tx.amount) ? tx.amount.toFixed(2) : "-"
            }`
          );
        }
        return;
      }
      if (type === "driver_status" && typeof payload.driver_id === "string") {
        if (payload.driver_id !== driver.id) return;
        const nextStatus =
          typeof payload.status === "string" ? payload.status : null;
        if (nextStatus) {
          setDriver((prev) => (prev ? { ...prev, status: nextStatus } : prev));
          pushNotification("تحديث الحالة", formatDriverStatus(nextStatus));
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

    startSocket();
    fetchOrders(false);

    const poll = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        fetchOrders(true);
      }
    }, 6000);

    return () => {
      active = false;
      socket?.close();
      if (pingTimer) window.clearInterval(pingTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(poll);
    };
  }, [driver, email, secretCode]);

  useEffect(() => {
    if (!driver) return;
    fetchTransactions();
  }, [driver, secretCode]);

  const ensureBiometric = async () => {
    if (!canUseWebAuthn()) return true;
    const key = getBiometricKey();
    if (!key) return true;
    const stored = localStorage.getItem(key);
    if (!stored) return true;
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: randomChallenge(),
          timeout: 60000,
          userVerification: "required",
          allowCredentials: [
            {
              id: base64UrlToBuffer(stored),
              type: "public-key",
            },
          ],
        },
      });
      return true;
    } catch {
      toast.error("فشل التحقق بالبصمة، حاول مرة أخرى.");
      return false;
    }
  };

  const registerBiometric = async (driverInfo: Driver) => {
    if (!canUseWebAuthn()) return;
    const key = getBiometricKey();
    if (!key || localStorage.getItem(key)) return;
    try {
      const userId = new TextEncoder().encode(driverInfo.id);
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: randomChallenge(),
          rp: { name: "Nova Max WS" },
          user: {
            id: userId,
            name: driverInfo.email ?? phone ?? "driver",
            displayName: driverInfo.name ?? "Driver",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "required",
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (credential?.rawId) {
        localStorage.setItem(key, bufferToBase64Url(credential.rawId));
        setBiometricLinked(true);
      }
    } catch {
      // ignore biometric registration failures
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("البريد الإلكتروني مطلوب");
      return;
    }
    const biometricOk = await ensureBiometric();
    if (!biometricOk) return;
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
        await registerBiometric(data.driver);
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

  const activeOrders = orders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );
  const historyOrders = orders.filter(
    (order) => order.status === "delivered" || order.status === "cancelled"
  );
  const deliveredCount = historyOrders.filter((order) => order.status === "delivered")
    .length;
  const deliveringCount = activeOrders.filter((order) => order.status === "delivering")
    .length;
  const pendingCount = activeOrders.filter((order) => order.status === "pending")
    .length;
  const walletBalance =
    typeof driver?.wallet_balance === "number" ? driver.wallet_balance : 0;

  if (!driver) {
    return (
      <div className="min-h-screen bg-[#eef1f6] text-slate-900 [background-image:radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_60%),radial-gradient(circle_at_bottom,rgba(148,163,184,0.25),transparent_60%)]">
        <Toaster position="top-center" />
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
          <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
                  <Image src="/logo.png" alt="NOVA MAX" width={46} height={46} />
                </div>
                <div className="text-right">
                  <p className="text-xs tracking-[0.25em] text-slate-500">نوفا ماكس</p>
                  <p className="text-sm font-semibold text-slate-900">واجهة المندوب</p>
                </div>
              </div>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                تسجيل الدخول
              </span>
            </div>

            <div className="mt-6 text-right">
              <h1 className="text-2xl font-semibold">تسجيل دخول المندوب</h1>
              <p className="mt-2 text-sm text-slate-500">
                أدخل رقم الهاتف، البريد الإلكتروني، والكود السري من لوحة المتجر.
              </p>
            </div>

            <form onSubmit={login} className="mt-6 grid w-full gap-4">
              <input
                className="h-14 rounded-2xl border border-white/70 bg-white/80 px-4 text-base text-slate-900 outline-none focus:border-orange-500/80"
                placeholder="رقم الهاتف"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                className="h-14 rounded-2xl border border-white/70 bg-white/80 px-4 text-base text-slate-900 outline-none focus:border-orange-500/80"
                placeholder="البريد الإلكتروني"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="h-14 rounded-2xl border border-white/70 bg-white/80 px-4 text-base text-slate-900 outline-none focus:border-orange-500/80"
                placeholder="الكود السري"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
              />
              <button className="h-14 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-400 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:translate-y-[-1px]">
                دخول لوحة السائق
              </button>
            </form>
            {biometricSupported && (
              <p className="mt-4 text-xs text-slate-500">
                سيتم طلب التحقق بالبصمة أو الوجه عند كل تسجيل دخول.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] text-slate-900 [background-image:radial-gradient(circle_at_top,rgba(255,255,255,0.92),transparent_65%),radial-gradient(circle_at_bottom,rgba(148,163,184,0.25),transparent_60%)]">
      <Toaster position="top-center" />
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            onClick={() => setMenuOpen(false)}
            aria-label="إغلاق القائمة"
          />
          <div className="relative h-full w-[85%] max-w-xs bg-white/85 p-5 text-right shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.3em] text-slate-500">NOVA MAX</p>
                <p className="text-base font-semibold text-slate-900">
                  {driver.name ?? "السائق"}
                </p>
                <p className="text-xs text-slate-500">{driver.phone ?? phone ?? ""}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/70 bg-white/80 p-2"
                onClick={() => setMenuOpen(false)}
                aria-label="إغلاق"
              >
                <XMarkIcon className="h-5 w-5 text-slate-700" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => goToSection("profile")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                الملف الشخصي
                <UserCircleIcon className="h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={() => goToSection("history")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                سجل الطلبات
                <ClipboardDocumentListIcon className="h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={() => goToSection("support")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                الدعم الفني
                <LifebuoyIcon className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 p-4 text-sm">
              <p className="text-xs text-slate-500">بيانات الوصول</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-slate-600">الكود السري</span>
                <span className="font-semibold text-slate-900">{secretCode || "-"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-600">البصمة</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    biometricLinked
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {biometricLinked ? "مفعل" : "غير مفعل"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="mt-6 flex w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
            >
              تسجيل الخروج
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 pb-28">
        <header className="rounded-[28px] border border-white/70 bg-white/80 p-4 text-right shadow-[0_22px_55px_-32px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col items-start text-left">
              <span className="text-[10px] text-slate-500">الكود السري</span>
              <span className="text-xs font-semibold text-slate-800">
                {secretCode || "-"}
              </span>
            </div>
            <div className="flex flex-1 flex-col items-end text-right">
              <span className="text-[11px] text-slate-500">اسم المندوب</span>
              <span className="text-base font-semibold text-slate-900">
                {driver.name ?? "السائق"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-700 shadow-sm"
              aria-label="فتح القائمة"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {formatDriverStatus(driver.status)}
            </span>
            <button
              type="button"
              onClick={() =>
                setDriverStatus(driver.status === "online" ? "offline" : "online")
              }
              className="rounded-full border border-orange-200 bg-gradient-to-l from-orange-500 to-amber-400 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/30"
            >
              {driver.status === "online" ? "إيقاف الاتصال" : "تفعيل الاتصال"}
            </button>
          </div>
        </header>

        {activeSection === "home" && (
          <section className="mt-4 space-y-4 text-right">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs text-slate-500">الطلبات النشطة</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {activeOrders.length}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs text-slate-500">قيد التوصيل</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {deliveringCount}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs text-slate-500">قيد الانتظار</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {pendingCount}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs text-slate-500">تم التسليم</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {deliveredCount}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">اتصال فوري</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDriverStatus(driver.status)}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-500">آخر تحديث</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatTime(new Date().toISOString())}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "wallet" && (
          <section className="mt-4 space-y-4 pb-8 text-right">
            {!walletUnlocked ? (
              <div className="rounded-[26px] border border-white/70 bg-white/80 p-6 text-center shadow-sm backdrop-blur-xl">
                <p className="text-sm font-semibold text-slate-900">
                  التحقق قبل عرض المحفظة
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  نحتاج تأكيد البصمة قبل إظهار البيانات المالية.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await ensureBiometric();
                    if (ok) setWalletUnlocked(true);
                  }}
                  className="mt-4 h-11 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-400 px-5 text-sm font-semibold text-white shadow-lg shadow-orange-500/30"
                >
                  تأكيد الهوية
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                  <p className="text-xs text-slate-500">رصيد المحفظة الحالي</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {walletBalance.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">آخر خمس حركات مالية</p>
                </div>

                <div className="rounded-[26px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      الحركات المالية الأخيرة
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
                      <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-center text-slate-500">
                        لا توجد حركات بعد.
                      </div>
                    )}
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3"
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
                            tx.type === "credit"
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {tx.type === "debit" ? "-" : "+"}
                          {Number.isFinite(tx.amount) ? tx.amount.toFixed(2) : "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {activeSection === "orders" && (
          <section className="mt-4 space-y-4 pb-8 text-right">
            {activeOrders.map((order) => (
              <div
                key={order.id}
                className={cn(
                  "rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.25)] backdrop-blur-xl transition",
                  flashIds.has(order.id) ? "ring-2 ring-orange-400/70" : ""
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/70 bg-gradient-to-br from-sky-100 via-white to-orange-100">
                    <MapPinIcon className="h-6 w-6 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {order.customer_name ?? "العميل"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {order.customer_location_text ?? "الموقع غير محدد"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                          statusStyles[order.status ?? ""] ??
                            "border-white/70 text-slate-700"
                        )}
                      >
                        {formatStatus(order.status)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                        <p className="flex items-center gap-1 text-[10px] text-slate-500">
                          <ClockIcon className="h-3 w-3" />
                          التوقيت
                        </p>
                        <p className="mt-1 text-sm text-slate-900">
                          {formatTime(order.created_at)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                        <p className="text-[10px] text-slate-500">رسوم التوصيل</p>
                        <p className="mt-1 text-sm text-slate-900">
                          {typeof order.delivery_fee === "number"
                            ? order.delivery_fee.toFixed(2)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {order.status === "pending" && (
                    <button
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-sky-200 text-sm font-semibold text-slate-900 transition hover:bg-sky-300"
                      onClick={() => updateStatus(order.id, "accepted")}
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                      قبول الطلب
                    </button>
                  )}
                  {order.status === "accepted" && (
                    <button
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-200 text-sm font-semibold text-slate-900 transition hover:bg-indigo-300"
                      onClick={() => updateStatus(order.id, "delivering")}
                    >
                      <TruckIcon className="h-5 w-5" />
                      بدء التوصيل
                    </button>
                  )}
                  {order.status === "delivering" && (
                    <button
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-200 text-sm font-semibold text-slate-900 transition hover:bg-orange-300"
                      onClick={() => updateStatus(order.id, "delivered")}
                    >
                      <BoltIcon className="h-5 w-5" />
                      تم التسليم
                    </button>
                  )}
                  {order.status !== "delivered" && order.status !== "cancelled" && (
                    <button
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      onClick={() => updateStatus(order.id, "cancelled")}
                    >
                      <XCircleIcon className="h-5 w-5" />
                      إلغاء الطلب
                    </button>
                  )}
                </div>
              </div>
            ))}

            {activeOrders.length === 0 && (
              <div className="rounded-[26px] border border-white/70 bg-white/80 px-6 py-8 text-center text-base text-slate-700">
                لا توجد طلبات نشطة حالياً.
              </div>
            )}
          </section>
        )}

        {activeSection === "notifications" && (
          <section className="mt-4 space-y-3 pb-8 text-right">
            {notifications.length === 0 && (
              <div className="rounded-[26px] border border-white/70 bg-white/80 px-6 py-8 text-center text-base text-slate-700">
                لا توجد إشعارات جديدة.
              </div>
            )}
            {notifications.map((note) => (
              <div
                key={note.id}
                className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{note.title}</p>
                  <span className="text-xs text-slate-500">
                    {formatTime(note.created_at)}
                  </span>
                </div>
                {note.description && (
                  <p className="mt-2 text-xs text-slate-500">{note.description}</p>
                )}
              </div>
            ))}
          </section>
        )}

        {activeSection === "profile" && (
          <section className="mt-4 space-y-4 pb-8 text-right">
            <div className="rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
              <p className="text-xs tracking-[0.25em] text-slate-500">بيانات المندوب</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {driver.name ?? "السائق"}
              </p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                  <p className="text-xs tracking-[0.2em] text-slate-500">الهاتف</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {driver.phone ?? phone ?? "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                  <p className="text-xs tracking-[0.2em] text-slate-500">
                    البريد الإلكتروني
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {driver.email ?? email ?? "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                  <p className="text-xs tracking-[0.2em] text-slate-500">الحالة</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDriverStatus(driver.status)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                  <p className="text-xs tracking-[0.2em] text-slate-500">البصمة</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {biometricSupported
                      ? biometricLinked
                        ? "مفعلة"
                        : "غير مفعلة"
                      : "غير مدعومة"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "history" && (
          <section className="mt-4 space-y-4 pb-8 text-right">
            {historyOrders.length === 0 && (
              <div className="rounded-[26px] border border-white/70 bg-white/80 px-6 py-8 text-center text-base text-slate-700">
                لا يوجد سجل طلبات بعد.
              </div>
            )}
            {historyOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {order.customer_name ?? "العميل"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {order.customer_location_text ?? "الموقع غير محدد"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                      statusStyles[order.status ?? ""] ??
                        "border-white/70 text-slate-700"
                    )}
                  >
                    {formatStatus(order.status)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                    <p className="text-[10px] text-slate-500">التوقيت</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {formatTime(order.created_at)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                    <p className="text-[10px] text-slate-500">رسوم التوصيل</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {typeof order.delivery_fee === "number"
                        ? order.delivery_fee.toFixed(2)
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {activeSection === "support" && (
          <section className="mt-4 space-y-4 pb-8 text-right">
            <div className="rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
              <p className="text-sm font-semibold text-slate-900">الدعم الفني</p>
              <p className="mt-2 text-xs text-slate-500">
                تواصل مع فريق الدعم لأي مشكلة تشغيلية.
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                  <span>خط الدعم الرئيسي</span>
                  <span dir="ltr">+964 770 000 0000</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                  <span>واتساب</span>
                  <span dir="ltr">+964 780 000 0000</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <nav className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-[24px] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className="grid grid-cols-4 gap-3 text-xs text-slate-700">
          <button
            type="button"
            onClick={() => goToSection("home")}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border px-2 py-2",
              activeSection === "home"
                ? "border-orange-200 bg-orange-100 text-orange-700"
                : "border-white/70 bg-white/80 text-slate-600"
            )}
          >
            <HomeIcon className="h-5 w-5" />
            الرئيسية
          </button>
          <button
            type="button"
            onClick={() => goToSection("orders")}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border px-2 py-2",
              activeSection === "orders"
                ? "border-orange-200 bg-orange-100 text-orange-700"
                : "border-white/70 bg-white/80 text-slate-600"
            )}
          >
            <ClipboardDocumentListIcon className="h-5 w-5" />
            الطلبات
          </button>
          <button
            type="button"
            onClick={() => goToSection("wallet")}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border px-2 py-2",
              activeSection === "wallet"
                ? "border-orange-200 bg-orange-100 text-orange-700"
                : "border-white/70 bg-white/80 text-slate-600"
            )}
          >
            <WalletIcon className="h-5 w-5" />
            المحفظة
          </button>
          <button
            type="button"
            onClick={() => goToSection("notifications")}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-2",
              activeSection === "notifications"
                ? "border-orange-200 bg-orange-100 text-orange-700"
                : "border-white/70 bg-white/80 text-slate-600"
            )}
          >
            <BellIcon className="h-5 w-5" />
            الإشعارات
            {notifications.length > 0 && (
              <span className="absolute -top-1 right-2 rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white">
                {notifications.length}
              </span>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
