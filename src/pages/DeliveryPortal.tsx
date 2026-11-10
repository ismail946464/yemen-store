import { useState, useEffect } from 'react';
import { 
  Bike, Package, MapPin, Navigation, Phone, MessageCircle, CheckCircle2, 
  Clock, AlertCircle, ExternalLink, ChevronLeft, Store, User, DollarSign, 
  TrendingUp, RefreshCw, Search, ShieldCheck
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDoc,
  limit 
} from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
}

interface DeliveryOrder {
  id: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  customerNotes?: string;
  customerAddress?: string;
  storeId?: string;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  items: OrderItem[];
  total: number;
  deliveryFee?: number;
  status: string;
  deliveryStatus?: string;
  deliveryNotes?: string;
  courierId?: string;
  courierName?: string;
  courierPhone?: string;
  paymentMethod?: string;
  selectedWallet?: any;
  location?: { lat: number; lng: number } | null;
  createdAt: string;
}

export default function DeliveryPortal() {
  const { user, userData, isDelivery, isAdmin, isDarkMode, getThemeClasses, settings } = useAppContext();
  const currentStoreName = settings?.storeName || 'يمن ستور';

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'delivered'>('available');
  const [storeProfilesCache, setStoreProfilesCache] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<DeliveryOrder | null>(null);
  const [deliveryNoteText, setDeliveryNoteText] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Real-time listener for orders
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ordersRef = collection(db, 'orders');
    // Listen to recent orders
    const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: DeliveryOrder[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setOrders(fetched);
      setLoading(false);

      // Pre-fetch store profiles for stores in orders
      const uniqueStoreIds = Array.from(new Set(fetched.map(o => o.storeId).filter(Boolean))) as string[];
      uniqueStoreIds.forEach(async (sid) => {
        if (sid && sid !== 'global' && !storeProfilesCache[sid]) {
          try {
            const sSnap = await getDoc(doc(db, 'storeProfiles', sid));
            if (sSnap.exists()) {
              setStoreProfilesCache(prev => ({ ...prev, [sid]: sSnap.data() }));
            }
          } catch {
            // Silently continue
          }
        }
      });
    }, (err) => {
      console.warn("Delivery orders sync notice:", err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Authorization check
  const isAuthorizedCourier = isDelivery || isAdmin;

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl space-y-5" dir="rtl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
          <Bike className="w-10 h-10 animate-bounce" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">بوابة مندوبي التوصيل</h2>
        <p className="text-gray-500 text-sm font-medium leading-relaxed">
          يرجى تسجيل الدخول بحساب مندوب التوصيل المعتمد للوصول لطلبات التوصيل ومواقع المتاجر والزبائن.
        </p>
        <Link 
          to="/login"
          className="block w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-500/25 active:scale-95 transition"
        >
          تسجيل الدخول الآن
        </Link>
      </div>
    );
  }

  if (!isAuthorizedCourier) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl space-y-6" dir="rtl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">بوابة مندوبي التوصيل المعتمدين</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed">
            هذا القسم مخصص حصرياً للمندوبين برتبة <span className="font-black text-amber-600">"توصيل"</span> لاستلام وتوصيل طلبات الشراء بين المتاجر والزبائن.
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-slate-800 p-4 rounded-2xl border border-amber-200 dark:border-slate-700 text-xs font-bold text-amber-900 dark:text-amber-200">
          إذا كنت ترغب بالانضمام كمندوب توصيل معتمد في منصة {currentStoreName}، يرجى التواصل مع إدارة المتجر لترقية حسابك لرتبة توصيل.
        </div>
        <div className="flex gap-3">
          <Link
            to="/contact?to=admin"
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs shadow-md active:scale-95 transition"
          >
            مراسلة الإدارة لطلب رتبة توصيل 🛵
          </Link>
          <Link
            to="/"
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-2xl font-black text-xs active:scale-95 transition"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  // Filter orders by active tab
  const availableOrders = orders.filter(o => 
    (!o.courierId || o.courierId === '') && 
    (o.status === 'pending' || o.status === 'processing')
  );

  const activeCourierOrders = orders.filter(o => 
    o.courierId === user.uid && 
    (o.status === 'processing' || o.status === 'out_for_delivery' || o.deliveryStatus === 'out_for_delivery')
  );

  const deliveredOrders = orders.filter(o => 
    o.courierId === user.uid && 
    (o.status === 'delivered' || o.deliveryStatus === 'delivered')
  );

  // Financial statistics for this courier
  const totalEarnedDeliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.deliveryFee || 1500), 0);

  // Active list to render based on tab and search
  const currentTabList = activeTab === 'available' 
    ? availableOrders 
    : activeTab === 'active' 
      ? activeCourierOrders 
      : deliveredOrders;

  const filteredOrders = currentTabList.filter(o => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.id.toLowerCase().includes(term) ||
      (o.customerName || '').toLowerCase().includes(term) ||
      (o.customerPhone || '').toLowerCase().includes(term) ||
      (o.storeName || '').toLowerCase().includes(term)
    );
  });

  // Action 1: Courier accepts/claims an order
  const handleClaimOrder = async (order: DeliveryOrder) => {
    setActionLoadingId(order.id);
    const toastId = toast.loading('جاري قبول الطلب وتعيينه لك...');
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        courierId: user.uid,
        courierName: userData?.displayName || userData?.name || user.displayName || 'مندوب توصيل',
        courierPhone: userData?.phone || '',
        deliveryStatus: 'assigned',
        status: 'processing'
      });
      toast.success('تم قبول الطلب بنجاح! انتقل إلى تبويب "قيد التوصيل معي" للبدء بالتوجه للمتجر.', { id: toastId });
      setActiveTab('active');
    } catch (err: any) {
      console.error("Claim error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`, auth);
      toast.error('تعذر قبول الطلب: ' + (err?.message || 'خطأ غير متوقع'), { id: toastId });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action 2: Courier confirms pickup from store
  const handleConfirmStorePickup = async (order: DeliveryOrder) => {
    setActionLoadingId(order.id);
    const toastId = toast.loading('جاري تأكيد الاستلام من المتجر...');
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        deliveryStatus: 'out_for_delivery',
        status: 'out_for_delivery',
        pickedUpAt: new Date().toISOString()
      });
      toast.success('تم استلام الطرد من المتجر! يمكنك الآن فتح ملاحة خريطة الزبون والتوجه للتسليم.', { id: toastId });
    } catch (err: any) {
      console.error("Pickup error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`, auth);
      toast.error('فشل تأكيد الاستلام: ' + (err?.message || 'خطأ'), { id: toastId });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action 3: Courier marks delivered to customer
  const handleCompleteDelivery = async (order: DeliveryOrder) => {
    setActionLoadingId(order.id);
    const toastId = toast.loading('جاري تأكيد التسليم للزبون...');
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        deliveryStatus: 'delivered',
        status: 'delivered',
        deliveredAt: new Date().toISOString()
      });
      toast.success('تم تسليم الطلب للزبون بنجاح! شكراً لجهودك العظيمة.', { id: toastId });
    } catch (err: any) {
      console.error("Delivery complete error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`, auth);
      toast.error('فشل تسجيل التسليم: ' + (err?.message || 'خطأ'), { id: toastId });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action 4: Save courier note or issue
  const handleSaveDeliveryNote = async () => {
    if (!selectedOrderForNotes) return;
    const toastId = toast.loading('جاري حفظ الملاحظة...');
    try {
      const orderRef = doc(db, 'orders', selectedOrderForNotes.id);
      await updateDoc(orderRef, {
        deliveryNotes: deliveryNoteText.trim()
      });
      toast.success('تم حفظ ملاحظة التوصيل', { id: toastId });
      setSelectedOrderForNotes(null);
      setDeliveryNoteText('');
    } catch (err: any) {
      toast.error('فشل حفظ الملاحظة', { id: toastId });
    }
  };

  // Helper for Google Maps navigation links
  const getStoreMapUrl = (order: DeliveryOrder) => {
    const storeProfile = order.storeId ? storeProfilesCache[order.storeId] : null;
    const storeQuery = order.storeAddress || storeProfile?.address || order.storeName || storeProfile?.name || 'صنعاء';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeQuery)}`;
  };

  const getCustomerMapUrl = (order: DeliveryOrder) => {
    if (order.location?.lat && order.location?.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}`;
    }
    const customerQuery = order.customerAddress || order.customerNotes || 'اليمن';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customerQuery)}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-6 font-tajawal" dir="rtl">
      
      {/* Courier Identity Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-600 to-amber-700 rounded-3xl p-6 sm:p-8 text-white shadow-2xl shadow-amber-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-md p-1 border border-white/30 shrink-0 flex items-center justify-center">
              <Bike className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  بوابة مندوب التوصيل
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-white text-amber-900 text-[11px] font-black shadow-sm">
                  رتبة توصيل 🛵
                </span>
              </div>
              <p className="text-white/90 text-xs sm:text-sm font-medium mt-1">
                مرحباً بك {userData?.name || userData?.displayName || user.email}! استلم الطلبات من المتاجر وتوجه بها للزبائن بكل سهولة وملاحة GPS فورية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-black/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-xs font-black">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>حالة المندوب: متاح وجاهز للاستلام 🟢</span>
          </div>
        </div>

        {/* Quick Stat Badges */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/20">
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl">
            <div className="text-[11px] font-bold text-white/80">طلبات متاحة للاستلام</div>
            <div className="text-2xl font-black mt-1">{availableOrders.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl">
            <div className="text-[11px] font-bold text-white/80">قيد التوصيل معي</div>
            <div className="text-2xl font-black mt-1 text-yellow-200">{activeCourierOrders.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl">
            <div className="text-[11px] font-bold text-white/80">تم تسليمها بنجاح</div>
            <div className="text-2xl font-black mt-1 text-emerald-200">{deliveredOrders.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl">
            <div className="text-[11px] font-bold text-white/80">أجور التوصيل المحققة</div>
            <div className="text-xl sm:text-2xl font-black mt-1">{totalEarnedDeliveryFees.toLocaleString('ar-YE')} <span className="text-xs font-bold">ر.ي</span></div>
          </div>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1.5 bg-gray-100 dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'available'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>طلبات متاحة للاستلام</span>
            {availableOrders.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">
                {availableOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'active'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>قيد التوصيل معي</span>
            {activeCourierOrders.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
                {activeCourierOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('delivered')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'delivered'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تم تسليمها</span>
            {deliveredOrders.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">
                {deliveredOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative sm:w-72">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="بحث برقم الطلب أو اسم الزبون..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 transition-all text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="p-16 text-center">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-gray-400">جاري تحميل طلبات التوصيل...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {activeTab === 'available' ? 'لا توجد طلبات جديدة بانتظار مندوب حالياً' : activeTab === 'active' ? 'ليس لديك أي طلبات جارية قيد التوصيل الآن' : 'لم تسجل أي طلبات مكتملة بعد'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {activeTab === 'available' ? 'عند قيام أي زبون بطلب شراء من المتجر، سيظهر هنا فوراً مع موقع المتجر وموقع الزبون لتتمكن من قبوله والتوجه لتوصيله.' : 'يمكنك تصفح تبويب "طلبات متاحة للاستلام" وقبول الطلبات الجديدة.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredOrders.map((order) => {
            const storeProfile = order.storeId ? storeProfilesCache[order.storeId] : null;
            const storeName = order.storeName || storeProfile?.name || 'متجر معتمد';
            const storePhone = order.storePhone || storeProfile?.phone || storeProfile?.whatsapp || '';
            const storeAddress = order.storeAddress || storeProfile?.address || 'صنعاء';
            const customerPhone = order.customerPhone || '';
            const customerAddress = order.customerAddress || order.customerNotes || 'العنوان محدد بالخريطة';
            const isAssignedToMe = order.courierId === user.uid;
            const isOutForDelivery = order.status === 'out_for_delivery' || order.deliveryStatus === 'out_for_delivery';
            const isDelivered = order.status === 'delivered' || order.deliveryStatus === 'delivered';

            return (
              <div 
                key={order.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Order Top Bar */}
                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 dark:bg-slate-950/40">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
                      📦
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-gray-900 dark:text-white dir-ltr">
                          #{order.id.slice(0, 8)}
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          isDelivered 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : isOutForDelivery 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : isAssignedToMe
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {isDelivered 
                            ? 'تم التسليم بنجاح ✓' 
                            : isOutForDelivery 
                              ? 'في الطريق للزبون 🛵' 
                              : isAssignedToMe 
                                ? 'معي - جاري الاستلام من المتجر' 
                                : 'متاح للاستلام ⚡'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Financial Overview Pill */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 font-bold">المطلوب تحصيله من الزبون:</div>
                      <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {order.paymentMethod === 'wallet' ? '0 ر.ي (مدفوع مسبقاً)' : `${order.total.toLocaleString('ar-YE')} ر.ي`}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-right">
                      <div className="text-[9px] text-amber-700 dark:text-amber-300 font-bold">أجرة التوصيل لك</div>
                      <div className="text-xs font-black text-amber-900 dark:text-amber-100">
                        {(order.deliveryFee || 1500).toLocaleString('ar-YE')} ر.ي
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content: Store Location (Pickup) & Customer Location (Delivery) */}
                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* 1. STORE (PICKUP STATION) */}
                  <div className="bg-blue-50/50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-blue-100 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between border-b border-blue-100 dark:border-slate-700 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            محطة الاستلام (المتجر)
                          </div>
                          <h4 className="font-black text-sm sm:text-base text-gray-900 dark:text-white">
                            {storeName}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        الخطوة 1: استلام البضاعة
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                        <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">عنوان المتجر: </span>
                          <span>{storeAddress}</span>
                        </div>
                      </div>

                      {storePhone && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-bold text-gray-900 dark:text-white">هاتف المتجر: </span>
                          <span className="font-mono dir-ltr">{storePhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons for Store */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <a
                        href={getStoreMapUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[140px] px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center justify-center gap-2"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>ملاحة خرائط Google للمتجر</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>

                      {storePhone && (
                        <>
                          <a
                            href={`tel:${storePhone}`}
                            className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-xl transition"
                            title="اتصال بالمتجر"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`https://wa.me/${storePhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition"
                            title="واتساب المتجر"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 2. CUSTOMER (DELIVERY STATION) */}
                  <div className="bg-emerald-50/50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-emerald-100 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-100 dark:border-slate-700 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            محطة التسليم (الزبون المستلم)
                          </div>
                          <h4 className="font-black text-sm sm:text-base text-gray-900 dark:text-white">
                            {order.customerName || 'عميل المتجر'}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                        الخطوة 2: التسليم
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">عنوان وملاحظات الزبون: </span>
                          <span>{customerAddress}</span>
                        </div>
                      </div>

                      {customerPhone && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-bold text-gray-900 dark:text-white">رقم هاتف الزبون: </span>
                          <span className="font-mono dir-ltr">{customerPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons for Customer */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <a
                        href={getCustomerMapUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[140px] px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>ملاحة خرائط Google للزبون {order.location ? '(GPS دقيق 📍)' : ''}</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>

                      {customerPhone && (
                        <>
                          <a
                            href={`tel:${customerPhone}`}
                            className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-xl transition"
                            title="اتصال بالزبون"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition"
                            title="واتساب الزبون"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                </div>

                {/* Package Items Snippet */}
                <div className="px-4 sm:px-6 py-3 bg-gray-50/50 dark:bg-slate-950/20 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="font-bold text-gray-500 shrink-0">محتويات الطرد:</span>
                    {order.items.map((it, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[11px] font-bold shrink-0">
                        {it.title} × {it.quantity}
                      </span>
                    ))}
                  </div>

                  {order.deliveryNotes && (
                    <div className="text-[11px] text-amber-600 font-bold">
                      ملاحظة: {order.deliveryNotes}
                    </div>
                  )}
                </div>

                {/* Action Buttons for Courier based on order state */}
                <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedOrderForNotes(order);
                        setDeliveryNoteText(order.deliveryNotes || '');
                      }}
                      className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition"
                    >
                      إضافة ملاحظة على الطلب
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* State 1: Order is available -> Courier claims it */}
                    {!order.courierId && (
                      <button
                        onClick={() => handleClaimOrder(order)}
                        disabled={actionLoadingId === order.id}
                        className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <Bike className="w-4 h-4" />
                        <span>قبول واستلام الطلب للتوصيل 🛵</span>
                      </button>
                    )}

                    {/* State 2: Order is claimed by courier and not yet picked up from store */}
                    {isAssignedToMe && !isOutForDelivery && !isDelivered && (
                      <button
                        onClick={() => handleConfirmStorePickup(order)}
                        disabled={actionLoadingId === order.id}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-600/25 active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <Package className="w-4 h-4" />
                        <span>تم استلام الطرد من المتجر وجاري التوجه للزبون 📦</span>
                      </button>
                    )}

                    {/* State 3: Order is out for delivery -> Courier completes delivery */}
                    {isAssignedToMe && isOutForDelivery && !isDelivered && (
                      <button
                        onClick={() => handleCompleteDelivery(order)}
                        disabled={actionLoadingId === order.id}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/25 active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التسليم للزبون واستلام المبلغ بنجاح ✅</span>
                      </button>
                    )}

                    {/* State 4: Already delivered */}
                    {isDelivered && (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-xs px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>مكتمل ومسلم بنجاح</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Note / Issue Modal */}
      {selectedOrderForNotes && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              ملاحظة التوصيل على طلب #{selectedOrderForNotes.id.slice(0, 8)}
            </h3>
            <p className="text-xs text-gray-500">
              يمكنك تدوين أي تفاصيل تخص التسليم (مثل: الزبون غير متواجد حالياً، تم الاتفاق على موعد لاحق، تم تسليم الطرد للحارس).
            </p>
            <textarea
              rows={4}
              value={deliveryNoteText}
              onChange={(e) => setDeliveryNoteText(e.target.value)}
              placeholder="اكتب ملاحظتك هنا..."
              className="w-full p-3 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveDeliveryNote}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs shadow-md transition"
              >
                حفظ الملاحظة
              </button>
              <button
                onClick={() => setSelectedOrderForNotes(null)}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-black text-xs transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
