import { useState, useEffect, useMemo } from 'react';
import { Package, Clock, CheckCircle2, Truck, BookmarkCheck, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { OrderListSkeleton } from '../components/Skeletons';
import { Link } from 'react-router-dom';

type OrderFilter = 'all' | 'active' | 'delivered' | 'preorder';

export default function Orders() {
  const { user, getThemeClasses } = useAppContext();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');

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

  const getStatusIcon = (status: string, isPreOrder?: boolean) => {
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

  const getStatusText = (status: string, isPreOrder?: boolean) => {
    switch (status) {
      case 'pending': return isPreOrder ? 'بانتظار تأكيد العربون' : 'قيد الانتظار';
      case 'out_for_delivery': return 'في الطريق مع المندوب';
      case 'reserved': return 'حجز مسبق مؤكد';
      case 'deposit_paid': return 'تم سداد العربون بنجاح';
      case 'processing': return 'جاري التجهيز';
      case 'shipped': return 'تم الشحن';
      case 'delivered': return 'تم الاستلام بنجاح';
      case 'cancelled': return 'ملغي';
      case 'reservation_expired': return 'انتهت مهلة الحجز المسبق';
      default: return 'قيد المراجعة';
    }
  };

  const formatExpiresAt = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const exp = new Date(expiresAt).getTime();
    const now = Date.now();
    const diffMs = exp - now;
    if (diffMs <= 0) return 'انتهت مهلة الحجز';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `متبقي ${days} يوم و ${hours} ساعة`;
    return `متبقي ${hours} ساعة`;
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
            const isExpired = order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() < Date.now();

            return (
              <article
                key={order.id}
                className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden"
              >
                {/* Header Row */}
                <div className="p-5 border-b border-[#E5E2DA] dark:border-[#232730] flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                      isPreOrder
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                        : 'bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] border-[#E5E2DA] dark:border-[#232730]'
                    }`}>
                      {isPreOrder ? <BookmarkCheck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">{isPreOrder ? 'حجز مسبق' : 'طلب شراء'}</p>
                        <span className="font-mono text-xs font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">#{order.id.slice(0, 8)}</span>
                      </div>
                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium tabular-nums mt-0.5">
                        {order.createdAt ? `${new Date(order.createdAt).toLocaleDateString('ar-YE')} · ${new Date(order.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                    {getStatusIcon(order.status, isPreOrder)}
                    <span>{getStatusText(order.status, isPreOrder)}</span>
                  </div>
                </div>

                {/* Single Hairline Deposit Ledger Bar (No cards inside cards) */}
                {isPreOrder && (
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
                        <span className={`font-extrabold text-sm tabular-nums ${isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {formatExpiresAt(order.reservationExpiresAt)}
                        </span>
                      </div>
                    </div>

                    <div className="px-4 py-2.5 flex items-center gap-2 text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>مالم يتم سداد المتبقي قبل انتهاء المدة، يُلغى الحجز تلقائياً ويُحتسب العربون للمتجر.</span>
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
                      </span>
                      <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {((item.price || 0) * (item.quantity || 1)).toLocaleString()} ر.ي
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer Total */}
                <div className="px-5 py-3.5 bg-[#FAF9F6] dark:bg-[#101216] border-t border-[#E5E2DA] dark:border-[#232730] flex justify-between items-center">
                  <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400">القيمة الإجمالية</span>
                  <span className={`text-base sm:text-lg font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                    {order.total?.toLocaleString()} ر.ي
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
