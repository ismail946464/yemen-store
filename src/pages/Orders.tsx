import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle2, Truck, BookmarkCheck, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function Orders() {
  const { user, isDarkMode, getThemeClasses } = useAppContext();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', user.uid),
        );
        const querySnapshot = await getDocs(q);
        const ordersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort manually for now since we didn't setup composite index
        ordersData.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(ordersData);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" dir="rtl">
        <Package className="h-12 w-12 text-gray-500 dark:text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">سجل الطلبات والحجوزات</h2>
        <p className="text-gray-600 dark:text-gray-300 font-bold">الرجاء تسجيل الدخول لعرض طلباتك وحجوزاتك السابقة</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-700 dark:text-gray-200 font-black" dir="rtl">جاري تحميل الطلبات والحجوزات...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" dir="rtl">
        <Package className="h-12 w-12 text-gray-500 dark:text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">لا توجد طلبات أو حجوزات</h2>
        <p className="text-gray-600 dark:text-gray-300 font-bold">لم تقم بأي طلبات أو عمليات حجز مسبق بعد</p>
      </div>
    );
  }

  const getStatusIcon = (status: string, isPreOrder?: boolean) => {
    if (isPreOrder) {
      if (status === 'reserved' || status === 'deposit_paid') {
        return <BookmarkCheck className="h-5 w-5 text-amber-600" />;
      }
      if (status === 'reservation_expired') {
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      }
    }
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-orange-500" />;
      case 'processing': return <Package className="h-5 w-5 text-blue-500" />;
      case 'out_for_delivery': return <Truck className="h-5 w-5 text-amber-500 animate-pulse" />;
      case 'shipped': return <Truck className="h-5 w-5 text-purple-500" />;
      case 'delivered': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'cancelled': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'reserved': return <BookmarkCheck className="h-5 w-5 text-amber-600" />;
      case 'deposit_paid': return <ShieldCheck className="h-5 w-5 text-emerald-600" />;
      case 'reservation_expired': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string, isPreOrder?: boolean) => {
    switch (status) {
      case 'pending': return isPreOrder ? 'بانتظار تأكيد العربون' : 'قيد الانتظار';
      case 'out_for_delivery': return 'في الطريق مع المندوب 🛵';
      case 'reserved': return 'حجز مسبق مؤكد';
      case 'deposit_paid': return 'تم سداد العربون بنجاح';
      case 'processing': return 'جاري التجهيز';
      case 'shipped': return 'تم الشحن';
      case 'delivered': return 'تم الاستلام بنجاح';
      case 'cancelled': return 'ملغي';
      case 'reservation_expired': return 'انتهت مهلة الحجز المسبق';
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

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-1">طلباتي وحجوزاتي المسبقة</h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-bold">متابعة حالة طلبات الشراء والحجوزات المدفوعة بالعربون</p>
        </div>
        <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${isDarkMode ? 'bg-slate-800 text-neutral-300 border-slate-700' : 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
          إجمالي العمليات: {orders.length}
        </div>
      </div>

      {orders.map((order) => {
        const isPreOrder = order.isPreOrder || order.orderType === 'preorder';
        const isExpired = order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() < Date.now();

        return (
          <div 
            key={order.id} 
            className={`rounded-2xl shadow-xs border p-5 sm:p-6 space-y-4 transition ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-neutral-200'
            } ${
              isPreOrder ? 'border-amber-400 dark:border-amber-500' : ''
            }`}
          >
            {/* Header info */}
            <div className={`flex flex-wrap justify-between items-center border-b pb-4 gap-4 ${isDarkMode ? 'border-slate-800' : 'border-neutral-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  isPreOrder ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900' : (isDarkMode ? 'bg-slate-800 text-neutral-200 border-slate-700' : 'bg-neutral-100 text-neutral-700 border-neutral-200')
                }`}>
                  {isPreOrder ? <BookmarkCheck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">رقم {isPreOrder ? 'الحجز' : 'الطلب'}</p>
                    <span className="font-mono text-xs font-medium text-neutral-500 dark:text-neutral-400">#{order.id.slice(0, 8)}</span>
                    {isPreOrder && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800">
                        حجز مسبق بعربون
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">{new Date(order.createdAt).toLocaleDateString('ar-YE')} - {new Date(order.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  isPreOrder 
                    ? (order.status === 'reservation_expired' || isExpired ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800')
                    : (isDarkMode ? 'bg-slate-800 text-neutral-200 border-slate-700' : 'bg-neutral-50 text-neutral-800 border-neutral-200')
                }`}>
                  {getStatusIcon(order.status, isPreOrder)}
                  <span>{getStatusText(order.status, isPreOrder)}</span>
                </div>
              </div>
            </div>

            {/* Pre-order Deposit Details */}
            {isPreOrder && (
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-amber-100'}`}>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mb-0.5">العربون المدفوع:</span>
                    <span className="font-black text-amber-700 dark:text-amber-400 text-sm">{(order.depositAmount || 0).toLocaleString()} ريال</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-amber-100'}`}>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mb-0.5">المتبقي عند الاستلام:</span>
                    <span className="font-black text-blue-700 dark:text-blue-400 text-sm">{(order.remainingAmount || 0).toLocaleString()} ريال</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-amber-100'}`}>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mb-0.5">مدة الحجز:</span>
                    <span className="font-black text-gray-800 dark:text-gray-200 text-sm">{order.reservationDurationDays || 3} أيام</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-amber-100'}`}>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mb-0.5">صلاحية الحجز:</span>
                    <span className={`font-black text-sm ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {formatExpiresAt(order.reservationExpiresAt)}
                    </span>
                  </div>
                </div>

                {/* Forfeiture Clause Warning */}
                <div className="p-3 bg-red-50/80 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/40 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-800 dark:text-red-300 font-black leading-relaxed">
                    شرط الحجز المعتمد: مالم يتم إتمام الشراء وسداد باقي المبلغ قبل انتهاء مدة الحجز، يعتبر الحجز ملغياً تلقائياً ويذهب مبلغ العربون للمتجر تعويضاً عن حجز السلعة.
                  </p>
                </div>
              </div>
            )}
            
            {/* Items */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block">عناصر {isPreOrder ? 'الحجز' : 'الطلب'}:</span>
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className={`flex justify-between items-center text-xs sm:text-sm p-3 rounded-xl border ${isDarkMode ? 'bg-slate-850 border-slate-700' : 'bg-neutral-50 border-neutral-200'}`}>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{item.quantity}x {item.title}</span>
                  <span className="font-black text-neutral-950 dark:text-white tabular-nums">{((item.price || 0) * (item.quantity || 1)).toLocaleString()} ريال</span>
                </div>
              ))}
            </div>

            {/* Total Footer */}
            <div className={`flex justify-between items-center pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-neutral-200'}`}>
              <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">القيمة الإجمالية للمنتج:</span>
              <span className="text-lg font-black text-neutral-950 dark:text-white tabular-nums">{order.total?.toLocaleString()} ريال</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
