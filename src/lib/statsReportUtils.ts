import {
  formatArabicDateTime as formatSafeDateTime,
  formatArabicLongDate,
  formatArabicWeekdayDate,
  formatArabicMonthYear,
} from './deviceSafe';

export type ReportPeriodMode = 'all' | 'daily' | 'monthly' | 'custom';

export interface StatsResetConfig {
  resetAt: string;
  visitsBaseline: number;
  usersBaseline: number;
  storesBaseline?: number;
  resetDayKey?: string;
  resetDayVisitsBaseline?: number;
  resetBy?: string;
}

export function getLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getLocalMonthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getLocalDateTimeInputValue(d: Date = new Date()): string {
  const datePart = getLocalDateKey(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${datePart}T${hh}:${mm}`;
}

export function shiftLocalDateKey(dateKey: string, deltaDays: number): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return getLocalDateKey();
  const d = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays);
  return getLocalDateKey(d);
}

export function shiftLocalMonthKey(monthKey: string, deltaMonths: number): string {
  const parts = monthKey.split('-').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return getLocalMonthKey();
  const d = new Date(parts[0], parts[1] - 1 + deltaMonths, 1);
  return getLocalMonthKey(d);
}

export function formatArabicDateTime(iso: string): string {
  const formatted = formatSafeDateTime(iso);
  return formatted || iso;
}

export interface ComputeReportInput {
  mode: ReportPeriodMode;
  reportDay: string;
  reportMonth: string;
  reportCustomStart: string;
  reportCustomEnd: string;
  orders: any[];
  products: any[];
  users: any[];
  isAdmin: boolean;
  selectedStoreId: string; // 'all' or specific storeId
  totalVisitors: number;
  dailyVisits: Record<string, number>;
  realRegisteredCount: number;
  activeReset: StatsResetConfig | null;
  ignoreResetView: boolean;
}

export interface ComputedOverviewReport {
  periodLabel: string;
  windowStartMs: number | null;
  windowEndMs: number | null;
  effectiveStartMs: number | null;
  isRangeInvalid: boolean;
  isWindowBeforeReset: boolean;
  isResetApplied: boolean;
  visitsCount: number;
  registeredOrCustomersCount: number;
  registeredOrCustomersLabel: string;
  registeredOrCustomersTrend: string;
  ordersCardLabel: string;
  ordersCardValue: number;
  ordersCardTrend?: string;
  salesCardLabel: string;
  totalRevenue: number;
  validOrdersCount: number;
  periodOrders: any[];
  periodValidOrders: any[];
  deliveredCount: number;
  deliveredRevenue: number;
  inProgressCount: number;
  reservedCount: number;
  cancelledCount: number;
  avgOrderValue: number;
  bestSellers: any[];
}

export function computeOverviewReport(input: ComputeReportInput): ComputedOverviewReport {
  const {
    mode,
    reportDay,
    reportMonth,
    reportCustomStart,
    reportCustomEnd,
    orders,
    products,
    users,
    isAdmin,
    selectedStoreId,
    totalVisitors,
    dailyVisits,
    realRegisteredCount,
    activeReset,
    ignoreResetView,
  } = input;

  const storeFilterId = selectedStoreId && selectedStoreId !== 'all' ? selectedStoreId : null;

  const scopedOrders = storeFilterId
    ? orders.filter((o) => o.storeId === storeFilterId)
    : orders;
  const scopedProducts = storeFilterId
    ? products.filter((p) => p.ownerId === storeFilterId)
    : products;

  let windowStartMs: number | null = null;
  let windowEndMs: number | null = null;
  let startDayKey: string | null = null;
  let endDayKey: string | null = null;
  let periodLabel = 'الإجمالي التراكمي الكامل';
  let isRangeInvalid = false;

  if (mode === 'daily') {
    const [y, m, d] = (reportDay || getLocalDateKey()).split('-').map(Number);
    const startDate = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
    const endDate = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
    windowStartMs = startDate.getTime();
    windowEndMs = endDate.getTime();
    startDayKey = getLocalDateKey(startDate);
    endDayKey = startDayKey;
    const todayKey = getLocalDateKey();
    periodLabel =
      startDayKey === todayKey
        ? `تقرير اليوم (${formatArabicLongDate(startDate) || startDayKey})`
        : `تقرير يوم ${formatArabicWeekdayDate(startDate) || startDayKey}`;
  } else if (mode === 'monthly') {
    const [y, m] = (reportMonth || getLocalMonthKey()).split('-').map(Number);
    const startDate = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(y, m || 1, 0, 23, 59, 59, 999);
    windowStartMs = startDate.getTime();
    windowEndMs = endDate.getTime();
    startDayKey = getLocalDateKey(startDate);
    endDayKey = getLocalDateKey(endDate);
    periodLabel = `تقرير شهر ${formatArabicMonthYear(startDate) || reportMonth}`;
  } else if (mode === 'custom') {
    const s = reportCustomStart ? new Date(reportCustomStart).getTime() : NaN;
    const e = reportCustomEnd ? new Date(reportCustomEnd).getTime() : NaN;
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) {
      isRangeInvalid = true;
      periodLabel = 'يرجى تحديد بداية ونهاية صحيحة للفترة';
    } else {
      windowStartMs = s;
      windowEndMs = e;
      startDayKey = getLocalDateKey(new Date(s));
      endDayKey = getLocalDateKey(new Date(e));
      periodLabel = `من ${formatArabicDateTime(new Date(s).toISOString())} إلى ${formatArabicDateTime(new Date(e).toISOString())}`;
    }
  }

  const resetAtMs = activeReset?.resetAt ? new Date(activeReset.resetAt).getTime() : null;
  const resetValid = Boolean(activeReset && resetAtMs !== null && Number.isFinite(resetAtMs));
  const isResetApplied = Boolean(resetValid && !ignoreResetView);
  const resetDayKey = activeReset?.resetDayKey || (resetValid && resetAtMs !== null ? getLocalDateKey(new Date(resetAtMs)) : null);

  const isWindowBeforeReset = Boolean(
    isResetApplied &&
    resetAtMs !== null &&
    windowEndMs !== null &&
    windowEndMs < resetAtMs
  );

  let effectiveStartMs: number | null = windowStartMs;
  if (isResetApplied && resetAtMs !== null) {
    effectiveStartMs = windowStartMs !== null ? Math.max(windowStartMs, resetAtMs) : resetAtMs;
  }

  const inEffectiveWindow = (iso?: string | null): boolean => {
    if (isRangeInvalid) return false;
    if (effectiveStartMs === null && windowEndMs === null) return true;
    if (!iso) return false;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return false;
    if (effectiveStartMs !== null && ms < effectiveStartMs) return false;
    if (windowEndMs !== null && ms > windowEndMs) return false;
    return true;
  };

  const periodOrders = scopedOrders.filter((o) => inEffectiveWindow(o.createdAt));
  const periodValidOrders = periodOrders.filter(
    (o) => o.status !== 'cancelled' && o.status !== 'reservation_expired'
  );
  const cancelledOrExpired = periodOrders.filter(
    (o) => o.status === 'cancelled' || o.status === 'reservation_expired'
  );
  const deliveredOrders = periodValidOrders.filter((o) => o.status === 'delivered');
  const reservedOrders = periodValidOrders.filter(
    (o) => o.status === 'reserved' || o.status === 'deposit_paid'
  );
  const inProgressOrders = periodValidOrders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'reserved' && o.status !== 'deposit_paid'
  );

  const totalRevenue = periodValidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const avgOrderValue =
    periodValidOrders.length > 0 ? Math.round(totalRevenue / periodValidOrders.length) : 0;

  // Compute visits for selected period & reset baseline
  let visitsCount = 0;
  if (isRangeInvalid || isWindowBeforeReset) {
    visitsCount = 0;
  } else if (mode === 'all') {
    visitsCount = isResetApplied && activeReset
      ? Math.max(0, totalVisitors - (activeReset.visitsBaseline || 0))
      : totalVisitors;
  } else if (startDayKey && endDayKey) {
    const entries = Object.entries(dailyVisits || {});
    for (const [dayKey, rawVal] of entries) {
      if (dayKey < startDayKey || dayKey > endDayKey) continue;
      let dayCount = Number(rawVal) || 0;
      if (isResetApplied && resetDayKey) {
        if (dayKey < resetDayKey) {
          dayCount = 0;
        } else if (dayKey === resetDayKey) {
          dayCount = Math.max(0, dayCount - (activeReset?.resetDayVisitsBaseline || 0));
        }
      }
      visitsCount += dayCount;
    }
  }

  // Compute registered users or store customers
  let registeredOrCustomersCount = 0;
  let registeredOrCustomersLabel = 'المستخدمون المسجلون';
  let registeredOrCustomersTrend = '';

  const showStoreCustomerMetric = !isAdmin || Boolean(storeFilterId);

  if (showStoreCustomerMetric && mode !== 'all') {
    registeredOrCustomersLabel = 'العملاء في الفترة';
    const uniqueCustomers = new Set(
      periodValidOrders
        .map((o) => String(o.userId || o.customerPhone || o.customerEmail || o.customerName || '').trim())
        .filter(Boolean)
    );
    registeredOrCustomersCount = uniqueCustomers.size;
    registeredOrCustomersTrend = `${periodOrders.length} طلب مسجل`;
  } else if (isAdmin && !storeFilterId) {
    if (mode === 'all' && !isResetApplied) {
      registeredOrCustomersLabel = 'المستخدمون المسجلون';
      registeredOrCustomersCount = realRegisteredCount;
      registeredOrCustomersTrend = `${users.filter((u) => u.role === 'store').length} متجر`;
    } else {
      registeredOrCustomersLabel = mode === 'all' ? 'المستخدمون المسجلون' : 'مستخدمون جدد في الفترة';
      if (users.length > 0 && users.length < 100) {
        const filteredUsers = users.filter((u) => inEffectiveWindow(u.createdAt));
        registeredOrCustomersCount = filteredUsers.length;
        const storesCount = filteredUsers.filter((u) => u.role === 'store').length;
        registeredOrCustomersTrend = `${storesCount} متجر`;
      } else if (mode === 'all' && isResetApplied && activeReset) {
        registeredOrCustomersCount = Math.max(0, realRegisteredCount - (activeReset.usersBaseline || 0));
        registeredOrCustomersTrend = 'منذ التصفير';
      } else {
        registeredOrCustomersCount = 0;
        registeredOrCustomersTrend = '0 متجر';
      }
    }
  } else {
    // Store owner in 'all' mode
    registeredOrCustomersLabel = 'المستخدمون المسجلون';
    if (isResetApplied && activeReset) {
      registeredOrCustomersCount = Math.max(0, realRegisteredCount - (activeReset.usersBaseline || 0));
      registeredOrCustomersTrend = 'منذ التصفير';
    } else {
      registeredOrCustomersCount = realRegisteredCount;
      registeredOrCustomersTrend = `${users.filter((u) => u.role === 'store').length} متجر`;
    }
  }

  // Orders card (today in 'all' mode, or total in chosen period)
  let ordersCardLabel = 'طلبات اليوم';
  let ordersCardValue = 0;
  let ordersCardTrend: string | undefined;

  if (mode === 'all') {
    const todayStr = new Date().toDateString();
    const todayOrders = periodValidOrders.filter((o) => {
      try {
        return new Date(o.createdAt).toDateString() === todayStr;
      } catch {
        return false;
      }
    });
    ordersCardLabel = 'طلبات اليوم';
    ordersCardValue = todayOrders.length;
    ordersCardTrend = todayOrders.length > 0 ? 'نشط' : undefined;
  } else {
    ordersCardLabel =
      mode === 'daily' ? 'طلبات اليوم المختار' : mode === 'monthly' ? 'طلبات الشهر' : 'طلبات الفترة';
    ordersCardValue = periodValidOrders.length;
    ordersCardTrend =
      cancelledOrExpired.length > 0 ? `${cancelledOrExpired.length} ملغي/منتهي` : periodValidOrders.length > 0 ? 'فعّال' : undefined;
  }

  const salesCardLabel =
    mode === 'all'
      ? 'إجمالي المبيعات'
      : mode === 'daily'
        ? 'مبيعات اليوم المختار'
        : mode === 'monthly'
          ? 'مبيعات الشهر'
          : 'مبيعات الفترة';

  // Best sellers strictly computed from periodValidOrders
  const productSalesMap: Record<string, { qty: number; revenue: number }> = {};
  periodValidOrders.forEach((o) => {
    if (Array.isArray(o.items)) {
      o.items.forEach((item: any) => {
        const pid = item.productId || item.id;
        if (pid) {
          const qty = Math.max(1, Number(item.quantity) || 1);
          const lineTotal = (Number(item.price) || 0) * qty;
          if (!productSalesMap[pid]) {
            productSalesMap[pid] = { qty: 0, revenue: 0 };
          }
          productSalesMap[pid].qty += qty;
          productSalesMap[pid].revenue += lineTotal;
        }
      });
    }
  });

  const bestSellers = [...scopedProducts]
    .map((p) => ({
      ...p,
      soldCount: productSalesMap[p.id]?.qty || 0,
      soldRevenue: productSalesMap[p.id]?.revenue || 0,
    }))
    .sort((a, b) => b.soldCount - a.soldCount || b.soldRevenue - a.soldRevenue);

  return {
    periodLabel,
    windowStartMs,
    windowEndMs,
    effectiveStartMs,
    isRangeInvalid,
    isWindowBeforeReset,
    isResetApplied,
    visitsCount,
    registeredOrCustomersCount,
    registeredOrCustomersLabel,
    registeredOrCustomersTrend,
    ordersCardLabel,
    ordersCardValue,
    ordersCardTrend,
    salesCardLabel,
    totalRevenue,
    validOrdersCount: periodValidOrders.length,
    periodOrders,
    periodValidOrders,
    deliveredCount: deliveredOrders.length,
    deliveredRevenue,
    inProgressCount: inProgressOrders.length,
    reservedCount: reservedOrders.length,
    cancelledCount: cancelledOrExpired.length,
    avgOrderValue,
    bestSellers,
  };
}
