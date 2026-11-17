import { useState, useEffect, useMemo, useRef } from 'react';
import { Package, Clock, CheckCircle2, Truck, BookmarkCheck, AlertTriangle, XCircle, ShieldCheck, Bike, Store, MapPin, Phone, ExternalLink } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { OrderListSkeleton } from '../components/Skeletons';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  respondToDeliveryFeeTransaction,
  expireDeliveryFeeProposalTransaction,
  computeOrderBaseSubtotal,
  getRemainingMs,
  formatRemainingDuration
} from '../lib/deliveryFeeUtils';
import { expireReservationTransaction, isStorePickupOnlyOrder } from '../lib/reservationUtils';

type OrderFilter = 'all' | 'active' | 'delivered' | 'preorder';

export default function Orders() {
  const { user, getThemeClasses } = useAppContext();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [respondingOrderId, setRespondingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const ordersData = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        ordersData.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setOrders(ordersData);
        setLoading(false);
      },
      (error) => {
        console.error("Error syncing orders:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const hasPendingFeeProposals = useMemo(
    () => orders.some(o => o.deliveryFeeApprovalStatus === 'pending_customer'),
    [orders]
  );

  const hasActiveReservations = useMemo(
    () => orders.some(o => (o.status === 'reserved' || o.status === 'deposit_paid') && o.reservationExpiresAt),
    [orders]
  );

  const expiringResRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hasPendingFeeProposals && !hasActiveReservations) return;
    setNowMs(Date.now());
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [hasPendingFeeProposals, hasActiveReservations]);

  useEffect(() => {
    if (hasPendingFeeProposals) {
      orders.forEach((o) => {
        if (
          o.deliveryFeeApprovalStatus === 'pending_customer' &&
          o.deliveryFeeExpiresAt &&
          new Date(o.deliveryFeeExpiresAt).getTime() <= nowMs
        ) {
          expireDeliveryFeeProposalTransaction(o.id);
        }
      });
    }

    if (hasActiveReservations) {
      orders.forEach((o) => {
        if (
          (o.status === 'reserved' || o.status === 'deposit_paid') &&
          o.reservationExpiresAt &&
          new Date(o.reservationExpiresAt).getTime() <= nowMs &&
          !expiringResRef.current.has(o.id)
        ) {
          expiringResRef.current.add(o.id);
          expireReservationTransaction(o.id).catch(() => {
            expiringResRef.current.delete(o.id);
          });
        }
      });
    }
  }, [orders, nowMs, hasPendingFeeProposals, hasActiveReservations]);

  const handleRespondToFee = async (orderId: string, action: 'accept' | 'reject') => {
    if (!user) return;
    setRespondingOrderId(orderId);
    const toastId = toast.loading(action === 'accept' ? 'جاري اعتماد رسوم التوصيل...' : 'جاري رفض عرض التوصيل...');
    try {
      const res = await respondToDeliveryFeeTransaction({
        orderId,
        customerId: user.uid,
        action
      });
      if (res.outcome === 'accepted') {
        toast.success('تم قبول رسوم التوصيل! سيتمكن المندوب الآن من استلام طلبك وتوصيله.', { id: toastId });
      } else if (res.outcome === 'rejected') {
        toast.success('تم رفض رسوم التوصيل وإعادة الطلب لقائمة الطلبات المتوفرة للتوصيل.', { id: toastId });
      } else {
        toast.error('انتهت مهلة القبول المحددة، تمت إعادة الطلب للطلبات المتوفرة للتوصيل.', { id: toastId });
      }
    } catch (err: any) {
      console.error('Delivery fee response error:', err);
      toast.error(err?.message || 'تعذر تنفيذ العملية', { id: toastId });
    } finally {
      setRespondingOrderId(null);
    }
  };

  const counts = useMemo(() => {
    const preorder = orders.filter(o => o.isPreOrder || o.orderType === 'preorder').length;
    const delivered = orders.filter(o => o.status === 'delivered' || o.deliveryStatus === 'delivered').length;
    const active = orders.filter(o => {
      const isPre = o.isPreOrder || o.orderType === 'preorder';
      const isDel = o.status === 'delivered' || o.deliveryStatus === 'delivered';
      return !isPre && !isDel && o.status !== 'cancelled' && o.status !== 'reservation_expired';
    }).length;
    return { all: orders.length, active, delivered, preorder };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    if (activeFilter === 'preorder') {
      return orders.filter(o => o.isPreOrder || o.orderType === 'preorder');
    }
    if (activeFilter === 'delivered') {
      return orders.filter(o => o.status === 'delivered' || o.deliveryStatus === 'delivered');
    }
    return orders.filter(o => {
      const isPre = o.isPreOrder || o.orderType === 'preorder';
      const isDel = o.status === 'delivered' || o.deliveryStatus === 'delivered';
      return !isPre && !isDel && o.status !== 'cancelled' && o.status !== 'reservation_expired';
    });
  }, [orders, activeFilter]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4" dir="rtl">
        <div className="w-16 h-16 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-[#5C5B57] dark:text-zinc-300" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] mb-2">سجل الطلبات والحجوزات</h2>
        <p className="text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mb-5">
          الرجاء تسجيل الدخول لعرض ومتابعة طلباتك وحجوزاتك السابقة
        </p>
        <Link
          to="/login"
          className={`${getThemeClasses('bg')} ${getThemeClasses('hover')} min-h-[44px] px-6 py-2.5 rounded-lg text-sm font-bold transition-colors inline-flex items-center`}
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-4">
        <OrderListSkeleton count={3} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4" dir="rtl">
        <div className="w-16 h-16 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-[#5C5B57] dark:text-zinc-300" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] mb-2">لا توجد طلبات أو حجوزات</h2>
        <p className="text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mb-6">
          لم تقم بأي طلبات أو عمليات حجز مسبق بعد
        </p>
        <Link
          to="/"
          className={`${getThemeClasses('bg')} ${getThemeClasses('hover')} min-h-[44px] px-6 py-2.5 rounded-lg text-sm font-bold transition-colors inline-flex items-center`}
        >
          تصفح المنتجات
        </Link>
      </div>
    );
  }

  const getStatusIcon = (order: any, isPreOrder?: boolean) => {
    if (order?.deliveryFeeApprovalStatus === 'pending_customer') {
      return <Clock className="h-4 w-4 text-amber-600" />;
    }
    const status = order?.status;
    if (isPreOrder) {
      if (status === 'reserved' || status === 'deposit_paid') {
        return <BookmarkCheck className="h-4 w-4 text-amber-600" />;
      }
      if (status === 'reservation_expired') {
        return <AlertTriangle className="h-4 w-4 text-rose-600" />;
      }
    }
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-600" />;
      case 'processing': return <Package className="h-4 w-4 text-blue-600" />;
      case 'out_for_delivery': return <Truck className="h-4 w-4 text-amber-600" />;
      case 'shipped': return <Truck className="h-4 w-4 text-blue-600" />;
      case 'delivered': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-rose-600" />;
      case 'reserved': return <BookmarkCheck className="h-4 w-4 text-amber-600" />;
      case 'deposit_paid': return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
      case 'reservation_expired': return <AlertTriangle className="h-4 w-4 text-rose-600" />;
      default: return <Clock className="h-4 w-4 text-[#5C5B57]" />;
    }
  };

  const getStatusText = (order: any, isPreOrder?: boolean) => {
    if (order?.deliveryFeeApprovalStatus === 'pending_customer') {
      return 'بانتظار موافقتك على رسوم التوصيل';
    }
    const status = order?.status;
    switch (status) {
      case 'pending': return isPreOrder ? 'بانتظار تأكيد العربون' : 'قيد الانتظار';
      case 'out_for_delivery': return 'في الطريق مع المندوب';
      case 'reserved': return 'حجز مسبق مؤكد';
      case 'deposit_paid': return 'تم سداد العربون بنجاح';
      case 'processing': return 'جاري التجهيز';
      case 'shipped': return 'تم الشحن';
      case 'delivered': return 'تم الاستلام بنجاح';
      case 'cancelled': return 'ملغي';
      case 'reservation_expired': return 'انتهت المهلة (ذهب العربون للمتجر)';
      default: return 'قيد المراجعة';
    }
  };

  const formatExpiresAt = (expiresAt?: string, orderStatus?: string) => {
    if (orderStatus === 'reservation_expired') return 'انتهت المهلة وذهب العربون للمتجر';
    if (!expiresAt) return null;
    const exp = new Date(expiresAt).getTime();
    const diffMs = exp - nowMs;
    if (diffMs <= 0) return 'انتهت المهلة وذهب العربون للمتجر';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `متبقي ${days} يوم و ${hours} ساعة`;
    if (hours > 0) return `متبقي ${hours} ساعة و ${mins} د`;
    return `متبقي ${Math.max(1, mins)} دقيقة`;
  };

  const filterTabs: { id: OrderFilter; label: string; count: number }[] = [
    { id: 'all', label: 'الكل', count: counts.all },
    { id: 'active', label: 'قيد التنفيذ', count: counts.active },
    { id: 'delivered', label: 'تم التسليم', count: counts.delivered },
    { id: 'preorder', label: 'حجز مسبق', count: counts.preorder },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight">
            طلباتي وحجوزاتي المسبقة
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-1">
            تحديث فوري لحالة طلبات الشراء والحجوزات المدفوعة بالعربون
          </p>
        </div>
        <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 tabular-nums">
          إجمالي العمليات: {orders.length}
        </span>
      </div>

      {/* Flush Underline Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-[#E5E2DA] dark:border-[#232730]">
        {filterTabs.map((tab) => {
          const isSelected = activeFilter === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`min-h-[44px] px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                isSelected
                  ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                  : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[11px] opacity-65 tabular-nums">({tab.count})</span>
            </button>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-12 text-center space-y-2">
          <Package className="w-8 h-8 text-[#5C5B57] dark:text-zinc-500 mx-auto opacity-50" />
          <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">لا توجد طلبات ضمن هذا التصنيف حالياً</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isPreOrder = order.isPreOrder || order.orderType === 'preorder';
            const isPickupOnly = isStorePickupOnlyOrder(order);
            const isForfeited = Boolean(order.depositForfeited || order.status === 'reservation_expired');
            const isExpired = isForfeited || (order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= nowMs);
            const isFeePending = order.deliveryFeeApprovalStatus === 'pending_customer';
            const remainingFeeMs = isFeePending ? getRemainingMs(order.deliveryFeeExpiresAt, nowMs) : 0;
            const proposedFee = Number(order.proposedDeliveryFee ?? 0);
            const baseSubtotal = computeOrderBaseSubtotal(order);
            const totalWithProposedFee = baseSubtotal + proposedFee;

            return (
              <article
                key={order.id}
                className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden"
              >
                {/* Header Row */}
                <div className="p-5 border-b border-[#E5E2DA] dark:border-[#232730] flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                      isPreOrder || isPickupOnly
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                        : 'bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] border-[#E5E2DA] dark:border-[#232730]'
                    }`}>
                      {isPickupOnly ? <Store className="w-5 h-5" /> : isPreOrder ? <BookmarkCheck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                          {isPickupOnly ? 'حجز للاستلام من المتجر' : isPreOrder ? 'حجز مسبق' : 'طلب شراء'}
                        </p>
                        <span className="font-mono text-xs font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">#{order.id.slice(0, 8)}</span>
                        {isPickupOnly && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            لا يوجد توصيل
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium tabular-nums mt-0.5">
                        {order.createdAt ? `${new Date(order.createdAt).toLocaleDateString('ar-YE')} · ${new Date(order.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                    {getStatusIcon(order, isPreOrder)}
                    <span>{getStatusText(order, isPreOrder)}</span>
                  </div>
                </div>

                {/* Courier Proposed Delivery Fee Approval Banner */}
                {isFeePending && (
                  <div className="border-b border-amber-200 dark:border-amber-800/70 bg-amber-50/75 dark:bg-amber-950/30 p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60 flex items-center justify-center shrink-0">
                          <Bike className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-200">
                            عرض رسوم التوصيل من المندوب ({order.courierName || 'مندوب توصيل'})
                          </h3>
                          <p className="text-xs font-medium text-amber-900/80 dark:text-amber-300/85">
                            حدد المندوب رسوم التوصيل لهذا الطلب. يرجى القبول أو الرفض قبل انتهاء المهلة المحددة.
                          </p>
                        </div>
                      </div>

                      <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#131519] border border-amber-300 dark:border-amber-700/70 text-xs font-extrabold text-amber-700 dark:text-amber-300 tabular-nums shrink-0 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>متبقي: {formatRemainingDuration(remainingFeeMs)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 border border-amber-200 dark:border-amber-800/60 rounded-lg bg-white dark:bg-[#131519] divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-amber-200 dark:divide-amber-800/60">
                      <div className="p-3">
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">قيمة المنتجات</span>
                        <span className="font-extrabold text-[#111214] dark:text-[#F4F4F2] text-sm tabular-nums">
                          {baseSubtotal.toLocaleString('ar-YE')} ر.ي
                        </span>
                      </div>
                      <div className="p-3">
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">رسوم التوصيل المقترحة</span>
                        <span className="font-extrabold text-amber-700 dark:text-amber-400 text-sm tabular-nums">
                          {proposedFee === 0 ? 'مجاناً (0 ر.ي)' : `${proposedFee.toLocaleString('ar-YE')} ر.ي`}
                        </span>
                      </div>
                      <div className="p-3">
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">الإجمالي بعد القبول</span>
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">
                          {totalWithProposedFee.toLocaleString('ar-YE')} ر.ي
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                        في حال الرفض أو انتهاء المهلة دون رد، يُلغى قبول المندوب ويعود الطلب للطلبات المتوفرة للتوصيل.
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRespondToFee(order.id, 'accept')}
                          disabled={respondingOrderId === order.id}
                          className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>قبول رسوم التوصيل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondToFee(order.id, 'reject')}
                          disabled={respondingOrderId === order.id}
                          className="min-h-[44px] px-4 py-2 bg-white hover:bg-rose-50 dark:bg-[#131519] dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/70 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>رفض</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!isFeePending && !order.courierId && (order.deliveryFeeApprovalStatus === 'rejected' || order.deliveryFeeApprovalStatus === 'expired') && (
                  <div className="px-5 py-2.5 bg-[#FAF9F6] dark:bg-[#101216] border-b border-[#E5E2DA] dark:border-[#232730] text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      {order.deliveryFeeApprovalStatus === 'expired'
                        ? 'انتهت مهلة قبول عرض التوصيل السابق، وطلبك متاح الآن لمندوبي التوصيل لتقديم عرض جديد.'
                        : 'تم رفض عرض رسوم التوصيل السابق، وطلبك متاح الآن لمندوبي التوصيل لتقديم عرض جديد.'}
                    </span>
                  </div>
                )}

                {/* Single Hairline Deposit Ledger Bar (No cards inside cards) */}
                {(isPreOrder || isPickupOnly) && (
                  <div className="border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-[#E5E2DA] dark:border-[#232730]">
                      <div className="p-3.5 border-b sm:border-b-0 border-e border-[#E5E2DA] dark:border-[#232730]">
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">العربون المدفوع</span>
                        <span className="font-extrabold text-amber-700 dark:text-amber-400 text-sm tabular-nums">{(order.depositAmount || 0).toLocaleString()} ر.ي</span>
                      </div>
                      <div className="p-3.5 border-b sm:border-b-0 sm:border-e border-[#E5E2DA] dark:border-[#232730]">
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">المتبقي عند الاستلام</span>
                        <span className="font-extrabold text-[#111214] dark:text-[#F4F4F2] text-sm tabular-nums">{(order.remainingAmount || 0).toLocaleString()} ر.ي</span>
                      </div>
                      <div className="p-3.5 border-e border-[#E5E2DA] dark:border-[#232730]">
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">مدة الحجز</span>
                        <span className="font-extrabold text-[#111214] dark:text-[#F4F4F2] text-sm tabular-nums">{order.reservationDurationDays || 3} أيام</span>
                      </div>
                      <div className="p-3.5">
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">صلاحية الحجز</span>
                        <span className={`font-extrabold text-xs sm:text-sm tabular-nums ${isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {formatExpiresAt(order.reservationExpiresAt, order.status)}
                        </span>
                      </div>
                    </div>

                    {isPickupOnly && (
                      <div className="px-4 py-3 border-b border-[#E5E2DA] dark:border-[#232730] bg-sky-50/60 dark:bg-sky-950/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sky-900 dark:text-sky-200">
                          <span className="font-bold inline-flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>الاستلام من: {order.storeName || 'المتجر'}</span>
                          </span>
                          {order.storeAddress && (
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              <span>{order.storeAddress}</span>
                            </span>
                          )}
                          {order.storePhone && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums" dir="ltr">
                              <Phone className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              <span>{order.storePhone}</span>
                            </span>
                          )}
                        </div>
                        {(order.storeMapsUrl || order.storeLocation) && (
                          <a
                            href={
                              order.storeMapsUrl ||
                              `https://www.google.com/maps?q=${order.storeLocation.lat},${order.storeLocation.lng}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:underline"
                          >
                            <span>خريطة المتجر</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    <div className={`px-4 py-2.5 flex items-center gap-2 text-[11px] font-semibold ${
                      isForfeited
                        ? 'bg-rose-50 dark:bg-rose-950/35 text-rose-700 dark:text-rose-300'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isForfeited
                          ? 'انتهت مهلة الحضور للمتجر — تم إلغاء الحجز وذهب العربون للمتجر.'
                          : isPickupOnly
                            ? 'لا يوجد توصيل: يرجى الحضور للمتجر نفسه للاستلام وسداد المتبقي قبل انتهاء المدة، وإلا يذهب العربون للمتجر.'
                            : 'مالم يتم سداد المتبقي قبل انتهاء المدة، يُلغى الحجز تلقائياً ويُحتسب العربون للمتجر.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Hairline Itemized List */}
                <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730] px-5">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs sm:text-sm py-3">
                      <span className="font-semibold text-[#111214] dark:text-[#F4F4F2]">
                        <span className="tabular-nums font-bold text-[#5C5B57] dark:text-zinc-400 ml-1.5">{item.quantity}×</span>
                        {item.title}
                        {item.variantName && (
                          <span className="mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-300 border border-[#E5E2DA] dark:border-[#232730]">
                            الصنف: {item.variantName}
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {((item.price || 0) * (item.quantity || 1)).toLocaleString()} ر.ي
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer Total */}
                <div className="px-5 py-3.5 bg-[#FAF9F6] dark:bg-[#101216] border-t border-[#E5E2DA] dark:border-[#232730] space-y-1.5">
                  {(Number(order.deliveryFee || 0) > 0 || order.deliveryFeeApprovalStatus === 'accepted') && (
                    <div className="flex justify-between items-center text-xs text-[#5C5B57] dark:text-zinc-400">
                      <span className="font-medium">
                        رسوم التوصيل {order.courierName ? `(${order.courierName})` : ''}
                      </span>
                      <span className="font-bold tabular-nums text-[#111214] dark:text-[#F4F4F2]">
                        {Number(order.deliveryFee || 0) === 0 ? 'مجاناً' : `${Number(order.deliveryFee).toLocaleString('ar-YE')} ر.ي`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400">القيمة الإجمالية</span>
                    <span className={`text-base sm:text-lg font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                      {Number(order.total || 0).toLocaleString()} ر.ي
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
