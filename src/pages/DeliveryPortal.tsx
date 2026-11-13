import { useState, useEffect } from 'react';
import {
  Bike, Package, MapPin, Navigation, Phone, MessageCircle, CheckCircle2,
  AlertCircle, ExternalLink, Store, User, DollarSign, Search, X
} from 'lucide-react';
import { db, auth } from '../firebase';
import {
  collection,
  query,
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
import { OrderListSkeleton } from '../components/Skeletons';

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
  storeLocation?: { lat: number; lng: number } | null;
  storeMapsUrl?: string;
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
  const { user, userData, isDelivery, getThemeClasses } = useAppContext();

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
    const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: DeliveryOrder[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setOrders(fetched);
      setLoading(false);

      const uniqueStoreIds = Array.from(new Set(fetched.map(o => o.storeId).filter(Boolean))) as string[];
      uniqueStoreIds.forEach(async (sid) => {
        if (sid && sid !== 'global' && !storeProfilesCache[sid]) {
          try {
            const sSnap = await getDoc(doc(db, 'storeProfiles', sid));
            if (sSnap.exists()) {
              setStoreProfilesCache(prev => ({ ...prev, [sid]: sSnap.data() }));
            } else {
              const uSnap = await getDoc(doc(db, 'users', sid));
              if (uSnap.exists()) {
                setStoreProfilesCache(prev => ({ ...prev, [sid]: uSnap.data() }));
              }
            }
          } catch {
            // Handled
          }
        }
      });
    }, (error) => {
      console.warn('Orders sync error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Access check: STRICTLY restricted to delivery role only
  if (!user || !isDelivery) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 bg-white dark:bg-[#131519] rounded-xl border border-[#E5E2DA] dark:border-[#232730] text-center space-y-6" dir="rtl">
        <div className="w-14 h-14 bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] rounded-lg flex items-center justify-center mx-auto border border-[#E5E2DA] dark:border-[#232730]">
          <Bike className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">
            بوابة مندوب التوصيل المعتمد
          </h2>
          <p className="text-[#5C5B57] dark:text-zinc-400 text-xs sm:text-sm font-medium leading-relaxed max-w-md mx-auto">
            هذه الصفحة مخصصة ومحصورة حصرياً لمن يحملون <strong className="text-[#111214] dark:text-[#F4F4F2]">رتبة مندوب توصيل</strong> في المنصة، ولا تتاح لأي مستخدم آخر حتى مالك الموقع.
          </p>
        </div>
        <div className="p-4 bg-[#FAF9F6] dark:bg-[#101216] rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-medium text-[#5C5B57] dark:text-zinc-400 leading-relaxed">
          إذا كنت مندوب توصيل وترغب في استلام وتوصيل الطلبات، يرجى التواصل مع إدارة المتجر لمنح حسابك رتبة «توصيل».
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <Link
            to="/contact?to=admin"
            className={`flex-1 min-h-[44px] px-4 py-2.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg font-bold text-xs flex items-center justify-center transition`}
          >
            مراسلة الإدارة لطلب رتبة توصيل
          </Link>
          <Link
            to="/"
            className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] rounded-lg font-bold text-xs flex items-center justify-center transition border border-[#E5E2DA] dark:border-[#232730]"
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

  const totalEarnedDeliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.deliveryFee || 1500), 0);

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
      toast.success('تم قبول الطلب بنجاح! انتقل إلى تبويب «قيد التوصيل معي» للبدء بالتوجه للمتجر.', { id: toastId });
      setActiveTab('active');
    } catch (err: any) {
      console.error('Claim error:', err);
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
      console.error('Pickup error:', err);
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
      toast.success('تم تسليم الطلب للزبون بنجاح!', { id: toastId });
    } catch (err: any) {
      console.error('Delivery complete error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`, auth);
      toast.error('فشل تسجيل التسليم: ' + (err?.message || 'خطأ'), { id: toastId });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action 4: Save courier note
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
    } catch {
      toast.error('فشل حفظ الملاحظة', { id: toastId });
    }
  };

  // Helper for Google Maps navigation links
  const getStoreMapUrl = (order: DeliveryOrder) => {
    const storeProfile = order.storeId ? storeProfilesCache[order.storeId] : null;
    const storeLoc = order.storeLocation || storeProfile?.location || storeProfile?.coordinates;

    if (storeLoc && typeof storeLoc.lat === 'number' && typeof storeLoc.lng === 'number') {
      return `https://www.google.com/maps/dir/?api=1&destination=${storeLoc.lat},${storeLoc.lng}`;
    }

    if (order.storeMapsUrl || storeProfile?.googleMapsUrl || storeProfile?.mapsUrl) {
      return order.storeMapsUrl || storeProfile?.googleMapsUrl || storeProfile?.mapsUrl;
    }

    const storeAddress = order.storeAddress || storeProfile?.address;
    const storeCity = storeProfile?.city || 'صنعاء';
    const storeName = order.storeName || storeProfile?.name || 'المتجر';
    const storeQuery = storeAddress ? `${storeAddress}, ${storeCity}` : `${storeName}, ${storeCity}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(storeQuery)}`;
  };

  const getCustomerMapUrl = (order: DeliveryOrder) => {
    if (order.location?.lat && order.location?.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${order.location.lat},${order.location.lng}`;
    }
    const customerQuery = order.customerAddress || order.customerNotes || 'اليمن';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customerQuery)}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-6" dir="rtl">

      {/* Courier Identity & Consolidated 4-Cell Hairline KPI Ledger */}
      <div className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`w-11 h-11 rounded-lg ${getThemeClasses('bg')} text-white shrink-0 flex items-center justify-center`}>
              <Bike className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#111214] dark:text-[#F4F4F2]">
                  بوابة مندوب التوصيل
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] text-[11px] font-bold border border-[#E5E2DA] dark:border-[#232730]">
                  رتبة توصيل معتمدة
                </span>
              </div>
              <p className="text-[#5C5B57] dark:text-zinc-400 text-xs sm:text-sm font-medium leading-relaxed">
                مرحباً، {userData?.name || userData?.displayName || user.displayName || 'مندوب التوصيل'} — إدارة واستلام الشحنات من المتاجر وتوصيلها للزبائن
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 self-start md:self-auto px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>الحالة: متاح للاستلام</span>
          </div>
        </div>

        {/* Single 4-Cell Hairline KPI Ledger */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-[#E5E2DA] dark:border-[#232730] divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730] bg-[#FAF9F6] dark:bg-[#101216]">
          <div className="p-4">
            <div className="flex items-center justify-between text-[#5C5B57] dark:text-zinc-400 mb-1">
              <span className="text-[11px] font-bold">متاحة للاستلام</span>
              <Package className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
              {availableOrders.length}
            </div>
            <span className="text-[10px] text-[#5C5B57] dark:text-zinc-500">بانتظار القبول</span>
          </div>

          <div className="p-4 border-r sm:border-r-0 border-[#E5E2DA] dark:border-[#232730]">
            <div className="flex items-center justify-between text-[#5C5B57] dark:text-zinc-400 mb-1">
              <span className="text-[11px] font-bold">قيد التوصيل معي</span>
              <Bike className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
              {activeCourierOrders.length}
            </div>
            <span className="text-[10px] text-[#5C5B57] dark:text-zinc-500">شحنات جارية</span>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between text-[#5C5B57] dark:text-zinc-400 mb-1">
              <span className="text-[11px] font-bold">تم تسليمها</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
              {deliveredOrders.length}
            </div>
            <span className="text-[10px] text-[#5C5B57] dark:text-zinc-500">عمليات مكتملة</span>
          </div>

          <div className="p-4 border-r sm:border-r-0 border-[#E5E2DA] dark:border-[#232730]">
            <div className="flex items-center justify-between text-[#5C5B57] dark:text-zinc-400 mb-1">
              <span className="text-[11px] font-bold">أجور التوصيل</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-lg sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
              {totalEarnedDeliveryFees.toLocaleString('ar-YE')}{' '}
              <span className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
            </div>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">مستحقات محصلة</span>
          </div>
        </div>
      </div>

      {/* Flush Underline Tabs & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E2DA] dark:border-[#232730] pb-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('available')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-bold transition border-b-2 -mb-[9px] shrink-0 ${
              activeTab === 'available'
                ? 'border-[#111214] dark:border-[#F4F4F2] text-[#111214] dark:text-[#F4F4F2]'
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>متاحة للاستلام</span>
            <span className="px-1.5 py-0.5 rounded-md bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] text-[10px] tabular-nums">
              {availableOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-bold transition border-b-2 -mb-[9px] shrink-0 ${
              activeTab === 'active'
                ? 'border-[#111214] dark:border-[#F4F4F2] text-[#111214] dark:text-[#F4F4F2]'
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>قيد التوصيل معي</span>
            <span className="px-1.5 py-0.5 rounded-md bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] text-[10px] tabular-nums">
              {activeCourierOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('delivered')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-bold transition border-b-2 -mb-[9px] shrink-0 ${
              activeTab === 'delivered'
                ? 'border-[#111214] dark:border-[#F4F4F2] text-[#111214] dark:text-[#F4F4F2]'
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تم تسليمها</span>
            <span className="px-1.5 py-0.5 rounded-md bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] text-[10px] tabular-nums">
              {deliveredOrders.length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative md:w-72 shrink-0">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5B57] dark:text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث برقم الطلب، الزبون، أو المتجر..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[44px] bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg pr-10 pl-4 py-2 text-xs font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400 transition text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57]/70 dark:placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <OrderListSkeleton count={3} />
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#131519] rounded-lg p-10 sm:p-12 text-center border border-[#E5E2DA] dark:border-[#232730] space-y-3">
          <div className="w-12 h-12 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 mx-auto flex items-center justify-center border border-[#E5E2DA] dark:border-[#232730]">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2]">
            {activeTab === 'available'
              ? 'لا توجد طلبات جديدة بانتظار مندوب حالياً'
              : activeTab === 'active'
                ? 'ليس لديك أي طلبات جارية قيد التوصيل الآن'
                : 'لم تسجل أي طلبات مكتملة بعد'}
          </h3>
          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            {activeTab === 'available'
              ? 'عند قيام أي زبون بطلب شراء من المتجر، سيظهر هنا فوراً مع موقع المتجر وموقع الزبون لتتمكن من قبوله وتوصيله.'
              : 'يمكنك تصفح تبويب «متاحة للاستلام» وقبول الطلبات الجديدة.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => {
            const storeProfile = order.storeId ? storeProfilesCache[order.storeId] : null;
            const storeName = order.storeName || storeProfile?.name || 'متجر معتمد';
            const storePhone = order.storePhone || storeProfile?.phone || storeProfile?.whatsapp || '';
            const storeAddress = order.storeAddress || storeProfile?.address || (storeProfile?.city ? `${storeProfile.city} - المركز` : 'صنعاء');
            const storeLoc = order.storeLocation || storeProfile?.location || storeProfile?.coordinates;
            const hasStoreGps = Boolean(storeLoc && typeof storeLoc.lat === 'number' && typeof storeLoc.lng === 'number');
            const storeOwnerName = storeProfile?.ownerName || storeProfile?.displayName || storeProfile?.name;
            const customerPhone = order.customerPhone || '';
            const customerAddress = order.customerAddress || order.customerNotes || 'العنوان محدد بالخريطة';
            const isAssignedToMe = order.courierId === user.uid;
            const isOutForDelivery = order.status === 'out_for_delivery' || order.deliveryStatus === 'out_for_delivery';
            const isDelivered = order.status === 'delivered' || order.deliveryStatus === 'delivered';

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-[#131519] rounded-lg border border-[#E5E2DA] dark:border-[#232730] overflow-hidden"
              >
                {/* Order Top Bar */}
                <div className="p-4 sm:p-5 border-b border-[#E5E2DA] dark:border-[#232730] flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F6] dark:bg-[#101216]">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums" dir="ltr">
                          #{order.id.slice(0, 8)}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            isDelivered
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : isOutForDelivery
                                ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                                : isAssignedToMe
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-[#EFEDE6] text-[#111214] border-[#E5E2DA] dark:bg-[#1C1F26] dark:text-[#F4F4F2] dark:border-[#232730]'
                          }`}
                        >
                          {isDelivered
                            ? 'تم التسليم بنجاح'
                            : isOutForDelivery
                              ? 'في الطريق للزبون'
                              : isAssignedToMe
                                ? 'معي — جاري الاستلام من المتجر'
                                : 'متاح للاستلام والتوصيل'}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Financial Overview */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-medium">التحصيل من الزبون</div>
                      <div className="text-sm sm:text-base font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {order.paymentMethod === 'wallet' ? '0 ر.ي (مدفوع بالمحفظة)' : `${Number(order.total || 0).toLocaleString('ar-YE')} ر.ي`}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-right">
                      <div className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-medium">أجرة التوصيل</div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {(order.deliveryFee || 1500).toLocaleString('ar-YE')} ر.ي
                      </div>
                    </div>
                  </div>
                </div>

                {/* Two-Station Grid: Store Pickup & Customer Delivery */}
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730]">
                  {/* Station 1: Store Pickup */}
                  <div className="p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-[#E5E2DA] dark:border-[#232730] pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] flex items-center justify-center shrink-0">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">
                            محطة الاستلام (المتجر)
                          </div>
                          <h4 className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">
                            {storeName}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400">
                        الخطوة 1
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2 text-[#5C5B57] dark:text-zinc-300">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">عنوان المتجر: </span>
                          <span>{storeAddress}</span>
                          {storeProfile?.city && !storeAddress.includes(storeProfile.city) && (
                            <span className="text-[#5C5B57] dark:text-zinc-400"> ({storeProfile.city})</span>
                          )}
                        </div>
                      </div>

                      {storeOwnerName && storeOwnerName !== storeName && (
                        <div className="flex items-center gap-2 text-[#5C5B57] dark:text-zinc-300">
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">صاحب المتجر: </span>
                          <span>{storeOwnerName}</span>
                        </div>
                      )}

                      {storePhone && (
                        <div className="flex items-center gap-2 text-[#5C5B57] dark:text-zinc-300">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">هاتف المتجر: </span>
                          <span className="font-mono tabular-nums" dir="ltr">{storePhone}</span>
                        </div>
                      )}

                      <div>
                        {hasStoreGps ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-[11px]">
                            <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>موقع GPS دقيق للمتجر محدد على الخريطة</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 border border-[#E5E2DA] dark:border-[#232730] text-[10px] font-medium">
                            <span>موقع المتجر عبر العنوان المسجل</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={getStoreMapUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[140px] min-h-[44px] px-3 py-2 bg-[#111214] hover:bg-black dark:bg-[#F4F4F2] dark:hover:bg-white text-white dark:text-[#111214] rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>ملاحة مباشرة للمتجر</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>

                      {storePhone && (
                        <>
                          <a
                            href={`tel:${storePhone}`}
                            className="w-11 h-11 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center justify-center"
                            title="اتصال بالمتجر"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`https://wa.me/${storePhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-11 h-11 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center justify-center"
                            title="واتساب المتجر"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Station 2: Customer Delivery */}
                  <div className="p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-[#E5E2DA] dark:border-[#232730] pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">
                            محطة التسليم (الزبون المستلم)
                          </div>
                          <h4 className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">
                            {order.customerName || 'عميل المتجر'}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400">
                        الخطوة 2
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2 text-[#5C5B57] dark:text-zinc-300">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">العنوان: </span>
                          <span>{customerAddress}</span>
                        </div>
                      </div>

                      {customerPhone && (
                        <div className="flex items-center gap-2 text-[#5C5B57] dark:text-zinc-300">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">الهاتف: </span>
                          <span className="font-mono tabular-nums" dir="ltr">{customerPhone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={getCustomerMapUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[140px] min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>ملاحة الخرائط للزبون {order.location ? '(GPS دقيق)' : ''}</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>

                      {customerPhone && (
                        <>
                          <a
                            href={`tel:${customerPhone}`}
                            className="w-11 h-11 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center justify-center"
                            title="اتصال بالزبون"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-11 h-11 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center justify-center"
                            title="واتساب الزبون"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Package Items Strip */}
                <div className="px-4 sm:px-5 py-2.5 bg-[#FAF9F6] dark:bg-[#101216] border-t border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="font-bold text-[#5C5B57] dark:text-zinc-400 shrink-0 text-[11px]">محتويات الشحنة:</span>
                    {order.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[11px] font-medium text-[#111214] dark:text-[#F4F4F2] shrink-0 tabular-nums"
                      >
                        {it.title} × {it.quantity}
                      </span>
                    ))}
                  </div>

                  {order.deliveryNotes && (
                    <div className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium">
                      ملاحظة: {order.deliveryNotes}
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="p-4 sm:p-5 border-t border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setSelectedOrderForNotes(order);
                      setDeliveryNoteText(order.deliveryNotes || '');
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                  >
                    تدوين ملاحظة على الطلب
                  </button>

                  <div className="flex items-center gap-2">
                    {!order.courierId && (
                      <button
                        onClick={() => handleClaimOrder(order)}
                        disabled={actionLoadingId === order.id}
                        className={`min-h-[44px] px-5 py-2.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg font-bold text-xs transition flex items-center gap-2 disabled:opacity-50`}
                      >
                        <Bike className="w-4 h-4" />
                        <span>قبول واستلام الطلب للتوصيل</span>
                      </button>
                    )}

                    {isAssignedToMe && !isOutForDelivery && !isDelivered && (
                      <button
                        onClick={() => handleConfirmStorePickup(order)}
                        disabled={actionLoadingId === order.id}
                        className={`min-h-[44px] px-5 py-2.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg font-bold text-xs transition flex items-center gap-2 disabled:opacity-50`}
                      >
                        <Package className="w-4 h-4" />
                        <span>تأكيد الاستلام من المتجر والانطلاق</span>
                      </button>
                    )}

                    {isAssignedToMe && isOutForDelivery && !isDelivered && (
                      <button
                        onClick={() => handleCompleteDelivery(order)}
                        disabled={actionLoadingId === order.id}
                        className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التسليم للزبون وتحصيل المبلغ</span>
                      </button>
                    )}

                    {isDelivered && (
                      <div className="min-h-[44px] flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التسليم بنجاح</span>
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
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedOrderForNotes(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#131519] rounded-xl p-6 w-full max-w-md shadow-xl border border-[#E5E2DA] dark:border-[#232730] space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
              <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
                <span>ملاحظة التوصيل #{selectedOrderForNotes.id.slice(0, 8)}</span>
              </h3>
              <button
                onClick={() => setSelectedOrderForNotes(null)}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
              يمكنك تدوين أي تفاصيل تخص التسليم (مثل: الزبون غير متواجد حالياً، تم الاتفاق على موعد لاحق، تم تسليم الطرد للحارس).
            </p>

            <textarea
              rows={4}
              value={deliveryNoteText}
              onChange={(e) => setDeliveryNoteText(e.target.value)}
              placeholder="اكتب ملاحظتك هنا..."
              className="w-full p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-medium outline-none focus:bg-white dark:focus:bg-[#131519] focus:border-[#111214] dark:focus:border-zinc-400 text-[#111214] dark:text-[#F4F4F2]"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSaveDeliveryNote}
                className={`flex-1 min-h-[44px] py-2.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg font-bold text-xs transition`}
              >
                حفظ الملاحظة
              </button>
              <button
                onClick={() => setSelectedOrderForNotes(null)}
                className="min-h-[44px] px-5 py-2.5 bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] rounded-lg font-bold text-xs transition border border-[#E5E2DA] dark:border-[#232730]"
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
