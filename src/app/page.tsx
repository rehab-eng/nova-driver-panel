"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ArrowLeft, Bell, CheckCircle2, ClipboardList, Clock, Home, LifeBuoy, LogOut, MapPin, Menu, Truck, UserCircle2, Wallet, X, XCircle, Zap } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://nova-backend.rehabha770.workers.dev";

const cn = (...inputs: Array<string | undefined | false>) =>
  twMerge(clsx(inputs));

type Driver = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  wallet_balance: number | null;
  store_id?: string | null;
};

type Order = {
  id: string;
  store_id?: string | null;
  store_name?: string | null;
  store_code?: string | null;
  driver_id?: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_location_text: string | null;
  order_type: string | null;
  receiver_name: string | null;
  payout_method: string | null;
  price: number | null;
  delivery_fee: number | null;
  status: string | null;
  created_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
};

type DeclinedOrder = Order & {
  declined_at: string;
  status: "declined";
};

type StoreTrackSession = {
  id: string;
  name: string | null;
  store_code: string | null;
};

type PublicStore = {
  id: string;
  name: string | null;
};

type StoreTrackOrder = {
  id: string;
  status: string | null;
  created_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  receiver_name?: string | null;
  order_type?: string | null;
  cancel_reason?: string | null;
};

type WalletTx = {
  id: string;
  amount: number;
  type: "credit" | "debit" | string;
  method: string | null;
  note: string | null;
  created_at: string | null;
};

type LedgerSummaryRow = {
  period: string;
  trips: number;
  delivery_total: number;
  cash_total: number;
  wallet_total: number;
};

type LedgerWalletRow = {
  period: string;
  credits: number;
  debits: number;
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
  declined: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  accepted: "تم القبول",
  delivering: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  declined: "مرفوض",
};

function formatStatus(value: string | null | undefined): string {
  if (!value) return "-";
  return statusLabels[value] ?? value;
}

function formatStoreStatus(value: string | null | undefined): string {
  if (!value) return "-";
  if (value === "pending") return "قيد التجهيز";
  if (value === "accepted" || value === "delivering") return "قيد التوصيل";
  if (value === "delivered") return "تم التوصيل";
  if (value === "cancelled") return "راجع";
  return value;
}

function storeStatusStyle(value: string | null | undefined): string {
  if (value === "delivered") return statusStyles.delivered;
  if (value === "cancelled") return statusStyles.cancelled;
  if (value === "accepted" || value === "delivering") return statusStyles.delivering;
  if (value === "pending") return statusStyles.pending;
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function storeProgress(value: string | null | undefined): { width: string; tone: string } {
  if (value === "pending") return { width: "30%", tone: "bg-amber-400" };
  if (value === "accepted" || value === "delivering")
    return { width: "70%", tone: "bg-orange-400" };
  if (value === "delivered") return { width: "100%", tone: "bg-emerald-400" };
  if (value === "cancelled") return { width: "100%", tone: "bg-rose-400" };
  return { width: "15%", tone: "bg-slate-300" };
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
  wallet: "محفظة",
  cash: "كاش",
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

function formatTxNote(note: string | null | undefined): string {
  if (!note) return "";
  let text = note;
  const idMatch = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  if (idMatch) {
    const id = idMatch[0];
    text = text.replace(id, `#${formatOrderNumber(id)}`);
  }
  text = text.replace(/order/gi, "طلب");
  text = text.replace(/delivered/gi, "تم التسليم");
  text = text.replace(/accepted/gi, "تم القبول");
  text = text.replace(/cancelled/gi, "تم الإلغاء");
  return text;
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOrderNumber(id: string): string {
  const clean = id.replace(/-/g, "");
  if (!clean) return "-";
  const tail = clean.slice(-8);
  const numeric = Number.parseInt(tail, 16);
  if (Number.isNaN(numeric)) return clean.slice(0, 6).toUpperCase();
  return String(numeric % 1_000_000).padStart(6, "0");
}

function formatOrderTotal(order: Order): string {
  const hasAmount =
    typeof order.price === "number" || typeof order.delivery_fee === "number";
  if (!hasAmount) return "-";
  const price = typeof order.price === "number" ? order.price : 0;
  const fee = typeof order.delivery_fee === "number" ? order.delivery_fee : 0;
  return (price + fee).toFixed(2);
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
  const [secretCode, setSecretCode] = useState("");
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loginMode, setLoginMode] = useState<"driver" | "store">("driver");
  const [storeTrackId, setStoreTrackId] = useState("");
  const [storeTrackName, setStoreTrackName] = useState("");
  const [storeTrackCode, setStoreTrackCode] = useState("");
  const [storeTrack, setStoreTrack] = useState<StoreTrackSession | null>(null);
  const [storeOrders, setStoreOrders] = useState<StoreTrackOrder[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [publicStores, setPublicStores] = useState<PublicStore[]>([]);
  const [publicStoresLoading, setPublicStoresLoading] = useState(false);
  const [storeRealtimeStatus, setStoreRealtimeStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");
  const [storeSearch, setStoreSearch] = useState("");
  const [storeLastSync, setStoreLastSync] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [ledgerPeriod, setLedgerPeriod] = useState("daily");
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummaryRow[]>([]);
  const [ledgerWallet, setLedgerWallet] = useState<LedgerWalletRow[]>([]);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "home" | "orders" | "wallet" | "notifications" | "profile" | "history" | "support"
  >("home");
  const [ordersTab, setOrdersTab] = useState<"pool" | "special">("pool");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [orderActionIds, setOrderActionIds] = useState<Record<string, boolean>>({});
  const [declinedHistory, setDeclinedHistory] = useState<DeclinedOrder[]>([]);

  const ordersRef = useRef<Order[]>([]);
  const hasLoadedRef = useRef(false);
  const flashTimers = useRef<Map<string, number>>(new Map());
  const lastDriverStatusRef = useRef<string | null>(null);
  const declinedOrdersRef = useRef<Set<string>>(new Set());
  const declinedHistoryRef = useRef<DeclinedOrder[]>([]);
  const orderEventTsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const storedDriver = localStorage.getItem("nova.driver");
    const storedCode = localStorage.getItem("nova.driver_code");
    const storedPhone = localStorage.getItem("nova.driver_phone");
    const storedStore = localStorage.getItem("nova.store_track");
    if (storedCode) setSecretCode(storedCode);
    if (storedPhone) setPhone(storedPhone);
    if (storedDriver) {
      try {
        const parsed = JSON.parse(storedDriver) as Driver;
        setDriver(parsed);
        if (!storedPhone && parsed?.phone) setPhone(parsed.phone);
      } catch {
        localStorage.removeItem("nova.driver");
      }
    }
    if (storedStore) {
      try {
        const parsed = JSON.parse(storedStore) as StoreTrackSession;
        if (parsed?.id) {
          setStoreTrack(parsed);
          setStoreTrackId(parsed.id ?? "");
          setStoreTrackName(parsed.name ?? "");
          if (parsed.store_code) setStoreTrackCode(parsed.store_code ?? "");
        }
      } catch {
        localStorage.removeItem("nova.store_track");
      }
    }
  }, []);


  useEffect(() => {
    if (driver) localStorage.setItem("nova.driver", JSON.stringify(driver));
  }, [driver]);

  useEffect(() => {
    if (storeTrack) {
      localStorage.setItem("nova.store_track", JSON.stringify(storeTrack));
      if (storeTrack.store_code) setStoreTrackCode(storeTrack.store_code ?? "");
    } else {
      localStorage.removeItem("nova.store_track");
    }
  }, [storeTrack]);

  useEffect(() => {
    if (driver?.status) lastDriverStatusRef.current = driver.status;
  }, [driver?.status]);


  useEffect(() => {
    if (!driver?.id) return;
    const key = `nova.driver.declined.${driver.id}`;
    try {
      const stored = localStorage.getItem(key);
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      declinedOrdersRef.current = new Set(parsed);
    } catch {
      declinedOrdersRef.current = new Set();
    }
  }, [driver?.id]);

  useEffect(() => {
    if (!driver?.id) return;
    const key = `nova.driver.declined.history.${driver.id}`;
    try {
      const stored = localStorage.getItem(key);
      const parsed = stored ? (JSON.parse(stored) as DeclinedOrder[]) : [];
      if (Array.isArray(parsed)) {
        declinedHistoryRef.current = parsed;
        setDeclinedHistory(parsed);
      } else {
        declinedHistoryRef.current = [];
        setDeclinedHistory([]);
      }
    } catch {
      declinedHistoryRef.current = [];
      setDeclinedHistory([]);
    }
  }, [driver?.id]);

  useEffect(() => {
    if (phone.trim()) {
      localStorage.setItem("nova.driver_phone", phone.trim());
    }
  }, [phone]);

  const logout = () => {
    localStorage.removeItem("nova.driver");
    localStorage.removeItem("nova.driver_code");
    localStorage.removeItem("nova.driver_phone");
    setDriver(null);
    setSecretCode("");
    setActiveSection("home");
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
    setActiveSection(section);
    setMenuOpen(false);
  };

  useEffect(() => {
    localStorage.setItem("nova.driver_code", secretCode);
  }, [secretCode]);

  const fetchStoreOrders = useCallback(
    async (silent = false) => {
      if (!storeTrack?.id) return;
      if (!silent) setStoreLoading(true);
      try {
        const code = storeTrack.store_code ?? storeTrackCode;
        const res = await fetch(
          `${API_BASE}/stores/track?store_id=${encodeURIComponent(
            storeTrack.id
          )}&store_code=${encodeURIComponent(code ?? "")}`
        );
        const data = (await res.json()) as { ok?: boolean; orders?: StoreTrackOrder[]; store?: StoreTrackSession; error?: string };
      if (data?.ok && Array.isArray(data.orders)) {
        setStoreOrders(data.orders);
        if (data.store) setStoreTrack(data.store);
        setStoreRealtimeStatus("connected");
        setStoreLastSync(new Date().toISOString());
      } else if (!silent) {
        toast.error(data?.error ?? "تعذر جلب الطلبات");
        setStoreRealtimeStatus("disconnected");
      }
    } catch {
      if (!silent) toast.error("خطأ في الشبكة");
      setStoreRealtimeStatus("disconnected");
    } finally {
      if (!silent) setStoreLoading(false);
    }
  },
    [storeTrack?.id, storeTrackCode]
  );

  const fetchPublicStores = useCallback(async () => {
    setPublicStoresLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stores/public`);
      const data = (await res.json()) as { ok?: boolean; stores?: PublicStore[] };
      if (data?.ok && Array.isArray(data.stores)) {
        setPublicStores(data.stores);
      }
    } catch {
      // ignore
    } finally {
      setPublicStoresLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loginMode === "store") {
      fetchPublicStores();
    }
  }, [loginMode, fetchPublicStores]);

  const loginStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeTrackId.trim()) {
      toast.error("اختر المتجر أولاً");
      return;
    }
    if (!storeTrackCode.trim() || storeTrackCode.trim().length < 4) {
      toast.error("أدخل الكود السري للمتجر");
      return;
    }
    setStoreLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/stores/track?store_id=${encodeURIComponent(
          storeTrackId.trim()
        )}&store_code=${encodeURIComponent(storeTrackCode.trim())}`
      );
      const data = (await res.json()) as {
        ok?: boolean;
        store?: StoreTrackSession;
        orders?: StoreTrackOrder[];
        error?: string;
      };
      if (data?.ok && data.store) {
        setStoreTrack(data.store);
        setStoreTrackName(data.store.name ?? "");
        setStoreTrackCode(data.store.store_code ?? storeTrackCode.trim());
        setStoreOrders(Array.isArray(data.orders) ? data.orders : []);
        setStoreLastSync(new Date().toISOString());
        toast.success("تم فتح لوحة متابعة المتجر");
      } else {
        toast.error(data?.error ?? "تعذر تسجيل الدخول");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setStoreLoading(false);
    }
  };

  const logoutStore = () => {
    setStoreTrack(null);
    setStoreOrders([]);
    setStoreTrackId("");
    setStoreTrackName("");
    setStoreTrackCode("");
  };

  useEffect(() => {
    if (!storeTrack?.id) return;
    let active = true;
    let socket: WebSocket | null = null;
    let retry = 0;
    let reconnectTimer: number | null = null;
    let pollTimer: number | null = null;

    const upsertStoreOrder = (incoming: StoreTrackOrder) => {
      setStoreOrders((prev) => {
        const idx = prev.findIndex((order) => order.id === incoming.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...incoming };
          return next;
        }
        return [incoming, ...prev];
      });
    };

    const handleStoreEvent = (payload: Record<string, unknown>) => {
      const type = payload.type;
      if (payload.store_id && typeof payload.store_id === "string") {
        if (storeTrack?.id && payload.store_id !== storeTrack.id) return;
      }
      if (type === "order_created" && payload.order && typeof payload.order === "object") {
        const order = payload.order as StoreTrackOrder;
        upsertStoreOrder(order);
        return;
      }
      if (type === "order_status" && typeof payload.order_id === "string") {
        upsertStoreOrder({
          id: payload.order_id,
          status: typeof payload.status === "string" ? payload.status : null,
          delivered_at:
            typeof payload.delivered_at === "string" ? payload.delivered_at : null,
          cancelled_at:
            typeof payload.cancelled_at === "string" ? payload.cancelled_at : null,
          cancel_reason:
            typeof payload.cancel_reason === "string" ? payload.cancel_reason : null,
        });
      }
    };

    const startSocket = () => {
      setStoreRealtimeStatus("connecting");
      const wsUrl = buildWsUrl("/realtime", {
        role: "store",
        store_id: storeTrack.id ?? "",
        store_code: storeTrack.store_code ?? storeTrackCode ?? "",
      });
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        retry = 0;
        setStoreRealtimeStatus("connected");
        fetchStoreOrders(true);
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          handleStoreEvent(payload);
        } catch {
          // ignore
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (!active) return;
        setStoreRealtimeStatus("disconnected");
        const delay = Math.min(30000, 1000 * 2 ** retry);
        retry += 1;
        reconnectTimer = window.setTimeout(startSocket, delay);
      };
    };

    startSocket();
    pollTimer = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        fetchStoreOrders(true);
      }
    }, 7000);

    return () => {
      active = false;
      socket?.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [storeTrack?.id, fetchStoreOrders]);

  const setOrderBusy = (orderId: string, busy: boolean) => {
    setOrderActionIds((prev) => {
      if (prev[orderId] === busy) return prev;
      return { ...prev, [orderId]: busy };
    });
  };

  const persistDeclines = (driverId: string) => {
    const key = `nova.driver.declined.${driverId}`;
    localStorage.setItem(key, JSON.stringify(Array.from(declinedOrdersRef.current)));
  };

  const persistDeclinedHistory = (driverId: string, next: DeclinedOrder[]) => {
    const key = `nova.driver.declined.history.${driverId}`;
    localStorage.setItem(key, JSON.stringify(next.slice(0, 80)));
  };

  const recordDecline = (order: Order, reason?: string | null) => {
    if (!driver) return;
    const entry: DeclinedOrder = {
      ...order,
      driver_id: driver.id,
      cancel_reason: reason ?? order.cancel_reason ?? null,
      status: "declined",
      declined_at: new Date().toISOString(),
    };
    setDeclinedHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== order.id);
      const next = [entry, ...filtered].slice(0, 80);
      declinedHistoryRef.current = next;
      persistDeclinedHistory(driver.id, next);
      return next;
    });
  };

  const markDeclined = (orderId: string) => {
    if (!driver) return;
    declinedOrdersRef.current.add(orderId);
    persistDeclines(driver.id);
    setOrders((prev) => {
      const next = prev.filter((order) => order.id !== orderId);
      ordersRef.current = next;
      return next;
    });
  };

  const allowOrderForDriver = (order: Order) => {
    if (!driver) return false;
    if (order.status === "pending") {
      if (order.driver_id && order.driver_id !== driver.id) return false;
      if (!order.driver_id && declinedOrdersRef.current.has(order.id)) return false;
      return true;
    }
    if (order.driver_id && order.driver_id !== driver.id) return false;
    return true;
  };

  const shouldApplyOrderEvent = (orderId: string, ts?: unknown) => {
    if (!ts) return true;
    const parsed =
      typeof ts === "number"
        ? ts
        : typeof ts === "string"
          ? Date.parse(ts)
          : NaN;
    if (!Number.isFinite(parsed)) return true;
    const last = orderEventTsRef.current.get(orderId) ?? 0;
    if (parsed <= last) return false;
    orderEventTsRef.current.set(orderId, parsed);
    return true;
  };

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

  const pushNotification = (
    title: string,
    description?: string,
    key?: string
  ) => {
    const id =
      key ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);
    const entry: NotificationItem = {
      id,
      title,
      description,
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return [entry, ...filtered].slice(0, 20);
    });
  };

  const applyOrders = (nextOrders: Order[], showToasts: boolean) => {
    const prev = ordersRef.current;
    const prevMap = new Map(prev.map((order) => [order.id, order]));

    if (showToasts) {
      for (const order of nextOrders) {
        const previous = prevMap.get(order.id);
        if (!previous) {
          toast.success(`طلب جديد #${formatOrderNumber(order.id)}`);
          flashOrder(order.id);
        } else if (previous.status !== order.status) {
          toast(`تم تحديث حالة الطلب إلى ${formatStatus(order.status)}`, {
            icon: "🔔",
          });
          flashOrder(order.id);
        }
      }
    }

    let declinedChanged = false;
    if (driver) {
      for (const order of nextOrders) {
        if (order.status !== "pending" || order.driver_id === driver.id) {
          if (declinedOrdersRef.current.delete(order.id)) {
            declinedChanged = true;
          }
        }
      }
      if (declinedChanged) persistDeclines(driver.id);
    }

    const filtered = nextOrders.filter(allowOrderForDriver);
    ordersRef.current = filtered;
    setOrders(filtered);
  };

  const updateOrderLocal = (orderId: string, patch: Partial<Order>) => {
    const current = ordersRef.current;
    const idx = current.findIndex((order) => order.id === orderId);
    if (idx < 0) return;
    const next = [...current];
    next[idx] = { ...next[idx], ...patch };
    const filtered = next.filter(allowOrderForDriver);
    ordersRef.current = filtered;
    setOrders(filtered);
  };

  const fetchOrders = useCallback(
    async (showToasts: boolean) => {
      if (!driver) return;
      try {
        const [poolRes, driverRes] = await Promise.all([
          fetch(
            `${API_BASE}/orders?status=pending&driver_code=${encodeURIComponent(
              secretCode
            )}`
          ),
          fetch(
            `${API_BASE}/orders?driver_id=${encodeURIComponent(
              driver.id
            )}&driver_code=${encodeURIComponent(secretCode)}`
          ),
        ]);

        const poolData = await poolRes.json();
        const driverData = await driverRes.json();
        const poolOrders = Array.isArray(poolData?.orders)
          ? (poolData.orders as Order[])
          : [];
        const driverOrders = Array.isArray(driverData?.orders)
          ? (driverData.orders as Order[])
          : [];

        const merged = new Map<string, Order>();
        for (const order of [...poolOrders, ...driverOrders]) {
          merged.set(order.id, order);
        }

        applyOrders(
          Array.from(merged.values()),
          showToasts && hasLoadedRef.current
        );
        if (!hasLoadedRef.current) hasLoadedRef.current = true;
      } catch {
        if (showToasts) toast.error("تعذر تحميل الطلبات");
      }
    },
    [driver, secretCode]
  );

  useEffect(() => {
    if (!driver) return;
    let active = true;
    let socket: WebSocket | null = null;
    let pingTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let retry = 0;
    const safeFetchOrders = (showToasts: boolean) => {
      if (!active) return;
      void fetchOrders(showToasts);
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

    const isDriverBusy = () =>
      ordersRef.current.some(
        (order) =>
          order.driver_id === driver.id &&
          order.status !== "pending" &&
          order.status !== "delivered" &&
          order.status !== "cancelled"
      );

    const handleRealtime = (payload: Record<string, unknown>) => {
      const type = payload.type;
      if (type === "order_created" && payload.order && typeof payload.order === "object") {
        const order = payload.order as Order;
        if (!shouldApplyOrderEvent(order.id, (payload as { ts?: unknown }).ts)) return;
        if (order.driver_id && order.driver_id !== driver.id) return;
        if (!order.driver_id && isDriverBusy()) return;
        upsertOrder(order);
        pushNotification(
          "طلب جديد",
          order.customer_location_text ?? "تم تعيين طلب جديد.",
          `order:${order.id}`
        );
        return;
      }
      if (type === "order_status" && typeof payload.order_id === "string") {
        if (!shouldApplyOrderEvent(payload.order_id, (payload as { ts?: unknown }).ts))
          return;
        const existing = ordersRef.current.find(
          (order) => order.id === payload.order_id
        );
        upsertOrder(
          {
            id: payload.order_id,
            status: typeof payload.status === "string" ? payload.status : null,
            driver_id:
              typeof payload.driver_id === "string" ? payload.driver_id : null,
            delivered_at:
              typeof payload.delivered_at === "string"
                ? payload.delivered_at
                : null,
            cancelled_at:
              typeof payload.cancelled_at === "string"
                ? payload.cancelled_at
                : null,
            cancel_reason:
              typeof payload.cancel_reason === "string"
                ? payload.cancel_reason
                : null,
            cancelled_by:
              typeof payload.cancelled_by === "string"
                ? payload.cancelled_by
                : null,
          },
          true
        );
        if (!existing || !existing.customer_location_text) {
          safeFetchOrders(false);
        }
        if (typeof payload.status === "string") {
          pushNotification(
            "تحديث حالة الطلب",
            `الحالة الآن: ${formatStatus(payload.status)}`,
            `order:${payload.order_id}`
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
            }`,
            `wallet:${tx.id ?? payload.driver_id}`
          );
        }
        return;
      }
      if (type === "driver_status" && typeof payload.driver_id === "string") {
        if (payload.driver_id !== driver.id) return;
        const nextStatus =
          typeof payload.status === "string" ? payload.status : null;
        if (!nextStatus) return;
        if (lastDriverStatusRef.current === nextStatus) return;
        lastDriverStatusRef.current = nextStatus;
        setDriver((prev) => (prev ? { ...prev, status: nextStatus } : prev));
        pushNotification(
          "تحديث الحالة",
          formatDriverStatus(nextStatus),
          "driver:status"
        );
      }
    };

    const startSocket = () => {
      const wsUrl = buildWsUrl("/realtime", {
        role: "driver",
        driver_id: driver.id,
        driver_code: secretCode,
        secret_code: secretCode,
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
    safeFetchOrders(false);

    const poll = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        safeFetchOrders(true);
      }
    }, 6000);

    return () => {
      active = false;
      socket?.close();
      if (pingTimer) window.clearInterval(pingTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(poll);
    };
  }, [driver, secretCode]);

  useEffect(() => {
    if (!driver) return;
    fetchTransactions();
  }, [driver, secretCode]);

  useEffect(() => {
    if (!driver) return;
    if (activeSection !== "wallet") return;
    fetchLedger(ledgerPeriod);
  }, [driver, activeSection, ledgerPeriod, secretCode]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !secretCode.trim()) {
      toast.error("رقم الهاتف وكود السائق مطلوبان");
      return;
    }
    const toastId = toast.loading("جاري تسجيل الدخول...");

    try {
      const res = await fetch(`${API_BASE}/drivers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), secret_code: secretCode.trim(), driver_code: secretCode.trim() }),
      });

      const data = await res.json();
      if (data?.driver?.id) {
        setDriver(data.driver);
        setStoreTrack(null);
        setStoreOrders([]);
        setLoginMode("driver");
        toast.success("مرحباً بعودتك", { id: toastId });
      } else {
        toast.error(data?.error ?? "فشل تسجيل الدخول", { id: toastId });
      }
    } catch {
      toast.error("خطأ في الشبكة", { id: toastId });
    }
  };

  const refreshDriver = async () => {
    if (!driver || !secretCode.trim()) return;
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

  const fetchLedger = async (period = ledgerPeriod) => {
    if (!driver) return;
    try {
      const res = await fetch(
        `${API_BASE}/drivers/${driver.id}/ledger?period=${encodeURIComponent(
          period
        )}&driver_code=${encodeURIComponent(secretCode)}`
      );
      const data = (await res.json()) as {
        orders?: LedgerSummaryRow[];
        wallet?: LedgerWalletRow[];
      };
      if (Array.isArray(data?.orders)) setLedgerSummary(data.orders);
      if (Array.isArray(data?.wallet)) setLedgerWallet(data.wallet);
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
        body: JSON.stringify({ status: nextStatus, secret_code: secretCode, driver_code: secretCode }),
      });
      const data = await res.json();
      if (data?.ok) {
        lastDriverStatusRef.current = nextStatus;
        toast.success("تم تحديث الحالة", { id: toastId });
        await refreshDriver();
      } else {
        toast.error("رقم الهاتف وكود السائق مطلوبان");
      }
    } catch {
      toast.error("خطأ في الشبكة", { id: toastId });
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    if (!driver) return;
    if (orderActionIds[orderId]) return;

    const reasonRequired = status === "cancelled";
    let cancelReason: string | null = null;
    if (reasonRequired) {
      const input = window.prompt("اكتب سبب الإلغاء");
      cancelReason = input ? input.trim() : "";
      if (!cancelReason) {
        toast.error("سبب الإلغاء مطلوب");
        return;
      }
    }

    const toastId = toast.loading("جاري تحديث الحالة...");
    setOrderBusy(orderId, true);

    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Driver-Code": secretCode },
        body: JSON.stringify({
          status,
          driver_id: driver.id,
          secret_code: secretCode,
          driver_code: secretCode,
          cancel_reason: cancelReason,
        }),
      });

      const data = await res.json();
      if (data?.ok) {
        updateOrderLocal(orderId, { status, driver_id: driver.id });
        toast.success("تم تحديث الحالة", { id: toastId });
        await refreshDriver();
        await fetchOrders(true);
      } else {
        toast.error(data?.error ?? "تعذر تحديث الطلب");
      }
    } catch {
      toast.error("خطأ في الشبكة", { id: toastId });
    } finally {
      setOrderBusy(orderId, false);
    }
  };

  const declineOrder = async (order: Order) => {
    if (!driver) return;
    if (orderActionIds[order.id]) return;
    const input = window.prompt("اكتب سبب رفض الطلب");
    const cancelReason = input ? input.trim() : "";
    if (!cancelReason) {
      toast.error("سبب الرفض مطلوب");
      return;
    }
    const toastId = toast.loading("جاري رفض الطلب...");
    setOrderBusy(order.id, true);
    try {
      if (!order.driver_id) {
        markDeclined(order.id);
        recordDecline(order, cancelReason);
        toast.success("تم إخفاء الطلب", { id: toastId });
        return;
      }
      const res = await fetch(`${API_BASE}/orders/${order.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Driver-Code": secretCode },
        body: JSON.stringify({
          driver_id: driver.id,
          secret_code: secretCode,
          driver_code: secretCode,
          cancel_reason: cancelReason,
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        markDeclined(order.id);
        recordDecline(order, cancelReason);
        toast.success("تم رفض الطلب", { id: toastId });
        await fetchOrders(true);
      } else {
        toast.error(data?.error ?? "تعذر رفض الطلب", { id: toastId });
      }
    } catch {
      toast.error("خطأ في الشبكة", { id: toastId });
    } finally {
      setOrderBusy(order.id, false);
    }
  };

  const driverId = driver?.id ?? "";
  const poolOrders = orders.filter(
    (order) => order.status === "pending" && !order.driver_id
  );
  const directOrders = orders.filter(
    (order) => order.status === "pending" && order.driver_id === driverId
  );
  const activeOrders = orders.filter(
    (order) =>
      order.driver_id === driverId &&
      order.status !== "pending" &&
      order.status !== "delivered" &&
      order.status !== "cancelled"
  );
  const historyOrders = orders.filter(
    (order) =>
      order.driver_id === driverId &&
      (order.status === "delivered" || order.status === "cancelled")
  );
  const declinedEntries = declinedHistory.filter(
    (order) => order.driver_id === driverId || !order.driver_id
  );
  const historyEntries = [...historyOrders, ...declinedEntries].sort((a, b) => {
    const aTime = (a as DeclinedOrder).declined_at ?? a.created_at ?? "";
    const bTime = (b as DeclinedOrder).declined_at ?? b.created_at ?? "";
    return Date.parse(bTime) - Date.parse(aTime);
  });
  const ordersToRender = ordersTab === "pool" ? poolOrders : directOrders;
  const deliveredCount = historyOrders.filter((order) => order.status === "delivered")
    .length;
  const deliveringCount = activeOrders.filter((order) => order.status === "delivering")
    .length;
  const pendingCount = poolOrders.length + directOrders.length;
  const walletBalance =
    typeof driver?.wallet_balance === "number" ? driver.wallet_balance : 0;
  const latestLedger = ledgerSummary[0];
  const latestWallet = ledgerWallet[0];

  const storeOrdersFiltered = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    if (!query) return storeOrders;
    return storeOrders.filter((order) => {
      const parts = [
        order.id,
        order.order_type,
        order.receiver_name,
        order.customer_name,
        order.customer_phone,
        order.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return parts.includes(query);
    });
  }, [storeOrders, storeSearch]);

  const storeOrdersSorted = useMemo(() => {
    return [...storeOrdersFiltered].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [storeOrdersFiltered]);

  const storeStats = useMemo(() => {
    const preparing = storeOrders.filter((o) => o.status === "pending").length;
    const delivering = storeOrders.filter(
      (o) => o.status === "accepted" || o.status === "delivering"
    ).length;
    const delivered = storeOrders.filter((o) => o.status === "delivered").length;
    const returned = storeOrders.filter((o) => o.status === "cancelled").length;
    return { preparing, delivering, delivered, returned };
  }, [storeOrders]);

  const storeSyncLabel = storeLastSync ? formatDateTime(storeLastSync) : "—";

  if (!driver && storeTrack) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 text-slate-900">
        <Toaster position="top-center" />
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="relative mx-auto w-full max-w-6xl px-5 py-10">
            <header className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_30px_80px_-45px_rgba(2,132,199,0.35)] backdrop-blur-2xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-sky-100">
                    <img
                      src="/logo.webp"
                      alt="Nova Max"
                      className="h-12 w-12 rounded-2xl border border-white/80 bg-white"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-[0.35em] text-slate-400">NOVA MAX</p>
                    <p className="text-2xl font-semibold text-slate-900">
                      متابعة المتجر
                    </p>
                  <p className="text-xs text-slate-500">
                    {storeTrack.name ?? "متجر"}
                  </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${
                      storeRealtimeStatus === "connected"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : storeRealtimeStatus === "connecting"
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {storeRealtimeStatus === "connected"
                      ? "متصل"
                      : storeRealtimeStatus === "connecting"
                      ? "جارٍ الاتصال"
                      : "منقطع"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                    <Clock className="h-4 w-4" />
                    آخر تحديث: {storeSyncLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchStoreOrders(false)}
                    className="h-10 rounded-full border border-sky-100 bg-sky-50 px-4 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    {storeLoading ? "جاري التحديث..." : "تحديث الآن"}
                  </button>
                  <button
                    type="button"
                    onClick={logoutStore}
                    className="h-10 rounded-full border border-orange-200 bg-orange-50 px-4 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                  >
                    تسجيل خروج المتجر
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-sky-100/80 bg-white/90 px-4 py-4 text-right">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">قيد التجهيز</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {storeStats.preparing}
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-100/80 bg-white/90 px-4 py-4 text-right">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">قيد التوصيل</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <Truck className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {storeStats.delivering}
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-100/80 bg-white/90 px-4 py-4 text-right">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">تم التوصيل</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {storeStats.delivered}
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-100/80 bg-white/90 px-4 py-4 text-right">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">راجع</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                      <XCircle className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {storeStats.returned}
                  </p>
                </div>
              </div>
            </header>

            <section className="mt-6 rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_30px_80px_-45px_rgba(2,132,199,0.35)] backdrop-blur-2xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">سجل الطلبات</h2>
                  <p className="text-xs text-slate-500">
                    {storeOrdersSorted.length} طلب في السجل
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                  <input
                    className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-xs text-slate-900 outline-none transition focus:border-sky-300 md:w-64"
                    placeholder="بحث برقم الطلب أو الهاتف أو الحالة"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => fetchStoreOrders(false)}
                    className="h-11 rounded-full border border-sky-100 bg-sky-50 px-4 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    تحديث
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {storeOrdersSorted.length === 0 && (
                  <div className="rounded-2xl border border-sky-100/80 bg-white/90 px-4 py-6 text-center text-sm text-slate-500">
                    لا توجد طلبات حالياً لهذا المتجر.
                  </div>
                )}

                <div className="hidden overflow-hidden rounded-2xl border border-sky-100/80 md:block">
                  <table className="min-w-full text-right text-xs">
                    <thead className="bg-sky-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3">رقم الطلب</th>
                        <th className="px-4 py-3">الحالة</th>
                        <th className="px-4 py-3">النوع</th>
                        <th className="px-4 py-3">المستلم</th>
                        <th className="px-4 py-3">الهاتف</th>
                        <th className="px-4 py-3">آخر تحديث</th>
                        <th className="px-4 py-3">ملاحظة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100/70 bg-white">
                      {storeOrdersSorted.map((order) => (
                        <tr key={`store-row-${order.id}`} className="text-slate-700">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            #{formatOrderNumber(order.id)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${storeStatusStyle(
                                order.status
                              )}`}
                            >
                              <span className="h-2 w-2 rounded-full bg-current" />
                              {formatStoreStatus(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {order.order_type ?? order.receiver_name ?? order.customer_name ?? "-"}
                          </td>
                          <td className="px-4 py-3">
                            {order.receiver_name ?? order.customer_name ?? "-"}
                          </td>
                          <td className="px-4 py-3">{order.customer_phone ?? "-"}</td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDateTime(
                              order.delivered_at ??
                                order.cancelled_at ??
                                order.created_at ??
                                ""
                            )}
                          </td>
                          <td className="px-4 py-3 text-rose-600">
                            {order.status === "cancelled" ? order.cancel_reason ?? "-" : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 space-y-3 md:hidden">
                  {storeOrdersSorted.map((order) => {
                    const progress = storeProgress(order.status);
                    return (
                      <div
                        key={`store-card-${order.id}`}
                        className="rounded-2xl border border-sky-100/80 bg-white/90 px-4 py-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">
                            طلب #{formatOrderNumber(order.id)}
                          </p>
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${storeStatusStyle(
                              order.status
                            )}`}
                          >
                            <span className="h-2 w-2 rounded-full bg-current" />
                            {formatStoreStatus(order.status)}
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className={`h-1.5 rounded-full ${progress.tone}`}
                            style={{ width: progress.width }}
                          />
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                          {order.order_type ?? order.receiver_name ?? order.customer_name ?? "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          المستلم: {order.receiver_name ?? order.customer_name ?? "-"}
                        </p>
                        {order.customer_phone && (
                          <p className="mt-1 text-xs text-slate-500">
                            الهاتف: {order.customer_phone}
                          </p>
                        )}
                        {order.status === "cancelled" && order.cancel_reason && (
                          <p className="mt-1 text-xs text-rose-600">
                            سبب الراجع: {order.cancel_reason}
                          </p>
                        )}
                        <p className="mt-3 text-xs text-slate-500">
                          آخر تحديث:{" "}
                          {formatDateTime(
                            order.delivered_at ??
                              order.cancelled_at ??
                              order.created_at ??
                              ""
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-orange-100 text-slate-900">
        <Toaster position="top-center" />
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.45)] backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
                <img
                  src="/logo.webp"
                  alt="Nova Max"
                  className="h-12 w-12 rounded-2xl border border-white/70 bg-white/80"
                />
              </div>
              <div className="text-right">
                <p className="text-[11px] tracking-[0.35em] text-slate-400">NOVA MAX</p>
                <p className="text-sm font-semibold text-slate-900">
                  {loginMode === "driver" ? "لوحة تحكم المندوب" : "لوحة تحكم المتجر"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  دخول آمن وسريع للمتابعة الفورية.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-100/70 p-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLoginMode("driver")}
                  className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                    loginMode === "driver"
                      ? "bg-white text-orange-600 shadow"
                      : "text-slate-500"
                  }`}
                >
                  مندوب
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode("store")}
                  className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                    loginMode === "store"
                      ? "bg-white text-sky-600 shadow"
                      : "text-slate-500"
                  }`}
                >
                  متجر
                </button>
              </div>
            </div>

            <div className="mt-6 text-right">
              <h1 className="text-2xl font-semibold">
                {loginMode === "driver" ? "لوحة تحكم المندوب" : "لوحة تحكم المتجر"}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {loginMode === "driver"
                  ? "أدخل رقم الهاتف وكود السائق."
                  : "اختر المتجر من القائمة لمتابعة الطلبات."}
              </p>
            </div>

            {loginMode === "driver" ? (
              <form onSubmit={login} className="mt-6 grid w-full gap-4 text-right">
                <label className="text-xs font-semibold text-slate-500">رقم الهاتف</label>
                <input
                  className="h-14 rounded-2xl border border-white/70 bg-white/90 px-4 text-base text-slate-900 outline-none focus:border-orange-500/80"
                  placeholder="09xxxxxxxx"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <label className="text-xs font-semibold text-slate-500">كود السائق</label>
                <input
                  className="h-14 rounded-2xl border border-white/70 bg-white/90 px-4 text-base text-slate-900 outline-none focus:border-orange-500/80"
                  placeholder="ادخل الرمز السري"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                />
                <button className="mt-2 h-14 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-400 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:translate-y-[-1px]">
                  دخول لوحة تحكم المندوب
                </button>
              </form>
            ) : (
              <form onSubmit={loginStore} className="mt-6 grid w-full gap-4 text-right">
                <label className="text-xs font-semibold text-slate-500">اختر المتجر</label>
                <select
                  className="h-14 rounded-2xl border border-white/70 bg-white/90 px-4 text-base text-slate-900 outline-none focus:border-sky-400/80"
                  value={storeTrackId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setStoreTrackId(selectedId);
                    const selected = publicStores.find((store) => store.id === selectedId);
                    setStoreTrackName(selected?.name ?? "");
                  }}
                >
                  <option value="">اختر المتجر من القائمة</option>
                  {publicStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name ?? "متجر"}
                    </option>
                  ))}
                </select>
                <label className="text-xs font-semibold text-slate-500">
                  الكود السري للمتجر
                </label>
                <input
                  className="h-14 rounded-2xl border border-white/70 bg-white/90 px-4 text-base text-slate-900 outline-none focus:border-sky-400/80"
                  placeholder="ادخل الرمز السري للمتجر"
                  value={storeTrackCode}
                  onChange={(e) => setStoreTrackCode(e.target.value)}
                />
                {publicStoresLoading && (
                  <p className="text-xs text-slate-500">جاري تحميل المتاجر...</p>
                )}
                <button className="mt-2 h-14 rounded-2xl bg-gradient-to-l from-sky-500 to-cyan-400 text-base font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:translate-y-[-1px]">
                  دخول لوحة المتجر
                </button>
              </form>
            )}
            <p className="mt-4 text-xs text-slate-500">
              يتم تحميل البيانات مباشرة بعد تسجيل الدخول.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-orange-100 text-slate-900">
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
                <X className="h-5 w-5 text-slate-700" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => goToSection("profile")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                الملف الشخصي
                <UserCircle2 className="h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={() => goToSection("history")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                سجل الطلبات
                <ClipboardList className="h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={() => goToSection("support")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                الدعم الفني
                <LifeBuoy className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 p-4 text-sm">
              <p className="text-xs text-slate-500">بيانات الوصول</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-slate-600">الكود السري</span>
                <span className="font-semibold text-slate-900">{secretCode || "-"}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="mt-6 flex w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
            >
              تسجيل الخروج
              <LogOut className="h-4 w-4" />
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
              <Menu className="h-5 w-5" />
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
            <div className="rounded-[28px] bg-gradient-to-br from-sky-600 via-sky-500 to-orange-400 p-5 text-white shadow-[0_20px_40px_-24px_rgba(14,165,233,0.6)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-sky-100">رصيد المحفظة الحالي</p>
                  <p className="mt-3 text-3xl font-semibold">
                    {walletBalance.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-sky-100">Nova Max Wallet</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-sky-100">
                <span>النشاط المالي</span>
                <span>{latestLedger?.period ?? "—"}</span>
              </div>
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
                        {tx.note ? ` · ${formatTxNote(tx.note)}` : ""}
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

            <div className="rounded-[26px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">ملخص الأرباح</p>
                <select
                  className="rounded-xl border border-white/70 bg-white/80 px-3 py-1 text-xs text-slate-700"
                  value={ledgerPeriod}
                  onChange={(e) => setLedgerPeriod(e.target.value)}
                >
                  <option value="daily">يومي</option>
                  <option value="weekly">أسبوعي</option>
                  <option value="monthly">شهري</option>
                  <option value="yearly">سنوي</option>
                </select>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3">
                  <p className="text-slate-500">الرحلات</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {latestLedger?.trips ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3">
                  <p className="text-slate-500">إجمالي التوصيل</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {Number(latestLedger?.delivery_total || 0).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3">
                  <p className="text-slate-500">المحفظة</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {Number(latestWallet?.credits || 0).toFixed(2)} / {Number(latestWallet?.debits || 0).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3">
                  <p className="text-slate-500">الكاش</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {Number(latestLedger?.cash_total || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "orders" && (
          <section className="mt-4 space-y-4 pb-8 text-right">
            <div className="rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">ساحة الطلبات</p>
                  <p className="mt-1 text-xs text-slate-500">
                    الطلبات العامة والطلبات الموجهة لك مباشرة.
                  </p>
                </div>
                <ClipboardList className="h-5 w-5 text-slate-500" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOrdersTab("pool")}
                  className={cn(
                    "rounded-2xl border px-3 py-2 font-semibold",
                    ordersTab === "pool"
                      ? "border-orange-200 bg-orange-100 text-orange-700"
                      : "border-white/70 bg-white/80 text-slate-600"
                  )}
                >
                  الساحة العامة
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersTab("special")}
                  className={cn(
                    "rounded-2xl border px-3 py-2 font-semibold",
                    ordersTab === "special"
                      ? "border-orange-200 bg-orange-100 text-orange-700"
                      : "border-white/70 bg-white/80 text-slate-600"
                  )}
                >
                  طلبات خاصة
                </button>
              </div>
            </div>

            {ordersToRender.map((order) => (
              <div
                key={order.id}
                className={cn(
                  "rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.25)] backdrop-blur-xl transition",
                  flashIds.has(order.id) ? "ring-2 ring-orange-400/70" : ""
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/70 bg-gradient-to-br from-sky-100 via-white to-orange-100">
                    <MapPin className="h-6 w-6 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {order.customer_name ?? "العميل"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          #{formatOrderNumber(order.id)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          المتجر: {order.store_name ?? order.store_code ?? (order.store_id ? `${order.store_id.slice(0, 6)}...` : "-")}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {order.customer_location_text ?? "الموقع غير محدد"}
                        </p>
                        {order.customer_phone && (
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 hover:border-orange-300"
                          >
                            اتصال مباشر: {order.customer_phone}
                          </a>
                        )}
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
                          <Clock className="h-3 w-3" />
                          التوقيت
                        </p>
                        <p className="mt-1 text-sm text-slate-900">
                          {formatTime(order.created_at)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                        <p className="text-[10px] text-slate-500">الإجمالي</p>
                        <p className="mt-1 text-sm text-slate-900">
                          {formatOrderTotal(order)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {order.status === "pending" && (
                    <>
                      <button
                        className={`flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 ${
                          orderActionIds[order.id] ? "cursor-not-allowed opacity-60" : ""
                        }`}
                        onClick={() => updateStatus(order.id, "accepted")}
                        disabled={orderActionIds[order.id]}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        قبول الطلب
                      </button>
                      <button
                        className={`flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 ${
                          orderActionIds[order.id] ? "cursor-not-allowed opacity-60" : ""
                        }`}
                        onClick={() => declineOrder(order)}
                        disabled={orderActionIds[order.id]}
                      >
                        <XCircle className="h-5 w-5" />
                        رفض الطلب
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {ordersToRender.length === 0 && (
              <div className="rounded-[26px] border border-white/70 bg-white/80 px-6 py-8 text-center text-base text-slate-700">
                لا توجد طلبات متاحة حالياً.
              </div>
            )}

            <div className="pt-2">
              <p className="text-sm font-semibold text-slate-900">الطلبات النشطة</p>
              <div className="mt-4 space-y-4">
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
                        <MapPin className="h-6 w-6 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {order.customer_name ?? "العميل"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              #{formatOrderNumber(order.id)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              المتجر: {order.store_name ?? order.store_code ?? (order.store_id ? `${order.store_id.slice(0, 6)}...` : "-")}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {order.customer_location_text ?? "الموقع غير محدد"}
                            </p>
                            {order.customer_phone && (
                              <a
                                href={`tel:${order.customer_phone}`}
                                className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 hover:border-orange-300"
                              >
                                اتصال مباشر: {order.customer_phone}
                              </a>
                            )}
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
                              <Clock className="h-3 w-3" />
                              التوقيت
                            </p>
                            <p className="mt-1 text-sm text-slate-900">
                              {formatTime(order.created_at)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                            <p className="text-[10px] text-slate-500">الإجمالي</p>
                            <p className="mt-1 text-sm text-slate-900">
                              {formatOrderTotal(order)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {order.status === "accepted" && (
                        <button
                          className={`flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 ${
                            orderActionIds[order.id] ? "cursor-not-allowed opacity-60" : ""
                          }`}
                          onClick={() => updateStatus(order.id, "delivering")}
                          disabled={orderActionIds[order.id]}
                        >
                          <Truck className="h-5 w-5" />
                          بدء التوصيل
                        </button>
                      )}
                      {order.status === "delivering" && (
                        <button
                          className={`flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 ${
                            orderActionIds[order.id] ? "cursor-not-allowed opacity-60" : ""
                          }`}
                          onClick={() => updateStatus(order.id, "delivered")}
                          disabled={orderActionIds[order.id]}
                        >
                          <Zap className="h-5 w-5" />
                          تم التسليم
                        </button>
                      )}
                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          className={`flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 ${
                            orderActionIds[order.id] ? "cursor-not-allowed opacity-60" : ""
                          }`}
                          onClick={() => updateStatus(order.id, "cancelled")}
                          disabled={orderActionIds[order.id]}
                        >
                          <XCircle className="h-5 w-5" />
                          إلغاء الطلب
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {activeOrders.length === 0 && (
                <div className="mt-4 rounded-[26px] border border-white/70 bg-white/80 px-6 py-8 text-center text-base text-slate-700">
                  لا توجد طلبات نشطة حالياً.
                </div>
              )}
            </div>
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
                  <p className="text-xs tracking-[0.2em] text-slate-500">الحالة</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDriverStatus(driver.status)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "history" && (
          <section className="mt-4 space-y-4 pb-8 text-right">
            {historyEntries.length === 0 && (
              <div className="rounded-[26px] border border-white/70 bg-white/80 px-6 py-8 text-center text-base text-slate-700">
                لا يوجد سجل طلبات بعد.
              </div>
            )}
            {historyEntries.map((order) => (
              <div
                key={order.id}
                className="rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {order.customer_name ?? "العميل"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      #{formatOrderNumber(order.id)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {order.customer_location_text ?? "الموقع غير محدد"}
                    </p>
                    {order.customer_phone && (
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 hover:border-orange-300"
                      >
                        اتصال مباشر: {order.customer_phone}
                      </a>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      المستلم: {order.receiver_name ?? "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      المتجر: {order.store_name ?? order.store_code ?? "-"}
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
                      {formatDateTime(
                        (order as DeclinedOrder).declined_at ??
                          order.delivered_at ??
                          order.cancelled_at ??
                          order.created_at
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                    <p className="text-[10px] text-slate-500">الإجمالي</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {formatOrderTotal(order)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                    <p className="text-[10px] text-slate-500">نوع الطلب</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {order.order_type ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                    <p className="text-[10px] text-slate-500">طريقة الدفع</p>
                    <p className="mt-1 text-sm text-slate-900">
                      {formatPayout(order.payout_method)}
                    </p>
                  </div>
                  {(order.cancel_reason ?? (order as DeclinedOrder).cancel_reason) && (
                    <div className="col-span-2 rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2">
                      <p className="text-[10px] text-rose-500">سبب الرفض</p>
                      <p className="mt-1 text-sm font-semibold text-rose-700">
                        {order.cancel_reason ?? (order as DeclinedOrder).cancel_reason}
                      </p>
                    </div>
                  )}
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
            <Home className="h-5 w-5" />
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
            <ClipboardList className="h-5 w-5" />
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
            <Wallet className="h-5 w-5" />
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
            <Bell className="h-5 w-5" />
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






