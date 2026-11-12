import { useState, useEffect } from 'react';
import { 
  Bike, Package, MapPin, Navigation, Phone, MessageCircle, CheckCircle2, 
  Clock, AlertCircle, ExternalLink, Store, User, DollarSign, 
  RefreshCw, Search
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
  const { user, userData, isDelivery, isDarkMode, settings } = useAppContext();
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
    const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: DeliveryOrder[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setOrders(fetched);
      setLoading(false);

      // Pre-fetch store profiles for stores in orders (checking both storeProfiles and users collections)
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
      console.warn("Orders sync error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Access check: STRICTLY restricted to delivery role only (not even admin / site owner)
  if (!user || !isDelivery) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-neutral-200 dark:border-slate-800 shadow-xs text-center space-y-6 font-tajawal" dir="rtl">
        <div className="w-16 h-16 bg-neutral-100 dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 rounded-2xl flex items-center justify-center mx-auto border border-neutral-200 dark:border-slate-700">
          <Bike className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white">بوابة مندوب التوصيل المعتمد</h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-xs sm:text-sm font-medium leading-relaxed max-w-md mx-auto">
            هذه الصفحة مخصصة ومحصورة حصرياً لمن يحملون <strong>رتبة مندوب توصيل</strong> في المنصة، ولا تتاح لأي مستخدم آخر حتى مالك الموقع.
          </p>
        </div>
        <div className="p-3.5 bg-neutral-50 dark:bg-slate-800/40 rounded-xl border border-neutral-200 dark:border-slate-700 text-xs font-medium text-neutral-600 dark:text-neutral-400 leading-relaxed">
          إذا كنت مندوب توصيل وترغب في استلام وتوصيل الطلبات، يرجى التواصل مع إدارة المتجر لمنح حسابك رتبة "توصيل".
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            to="/contact?to=admin"
            className="flex-1 py-3 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold text-xs shadow-xs active:scale-95 transition"
          >
            مراسلة الإدارة لطلب رتبة توصيل
          </Link>
          <Link
            to="/"
            className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-neutral-800 dark:text-neutral-200 rounded-xl font-bold text-xs active:scale-95 transition border border-neutral-200 dark:border-slate-700"
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

  // Helper for Google Maps navigation links (Turn-by-turn directions)
  const getStoreMapUrl = (order: DeliveryOrder) => {
    const storeProfile = order.storeId ? storeProfilesCache[order.storeId] : null;
    const storeLoc = order.storeLocation || storeProfile?.location || storeProfile?.coordinates;
    
    // 1. Direct GPS latitude & longitude navigation
    if (storeLoc && typeof storeLoc.lat === 'number' && typeof storeLoc.lng === 'number') {
      return `https://www.google.com/maps/dir/?api=1&destination=${storeLoc.lat},${storeLoc.lng}`;
    }
    
    // 2. Direct Google Maps pin or link saved by store owner
    if (order.storeMapsUrl || storeProfile?.googleMapsUrl || storeProfile?.mapsUrl) {
      return order.storeMapsUrl || storeProfile?.googleMapsUrl || storeProfile?.mapsUrl;
    }
    
    // 3. Address query directions
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
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-6 font-tajawal" dir="rtl">
      
      {/* Courier Identity Card - Clean Executive Architecture */}
      <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-neutral-900 text-white shrink-0 flex items-center justify-center shadow-xs">
              <Bike className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                  بوابة مندوب التوصيل
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold border border-neutral-200 dark:border-slate-700">
                  رتبة توصيل معتمدة
                </span>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm font-medium leading-relaxed">
                مرحباً بك، {userData?.name || userData?.displayName || user.displayName || 'مندوب التوصيل'} · إدارة واستلام الشحنات من المتاجر وتوصيلها للزبائن مع ملاحة GPS دقيقة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>حالة المندوب: متاح وجاهز للاستلام</span>
          </div>
        </div>

        {/* 4 Metric KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-neutral-100 dark:border-slate-800">
          <div className="bg-neutral-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-neutral-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-[11px] font-medium">طلبات متاحة للاستلام</span>
              <Package className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-neutral-950 dark:text-white tabular-nums">{availableOrders.length}</div>
            <span className="text-[10px] text-neutral-400 font-normal">بانتظار قبول المندوب</span>
          </div>

          <div className="bg-neutral-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-neutral-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-[11px] font-medium">قيد التوصيل معي</span>
              <Bike className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-neutral-950 dark:text-white tabular-nums">{activeCourierOrders.length}</div>
            <span className="text-[10px] text-neutral-400 font-normal">شحنات جارية قيد التنفيذ</span>
          </div>

          <div className="bg-neutral-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-neutral-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-[11px] font-medium">تم تسليمها بنجاح</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-neutral-950 dark:text-white tabular-nums">{deliveredOrders.length}</div>
            <span className="text-[10px] text-neutral-400 font-normal">عمليات تسليم مكتملة</span>
          </div>

          <div className="bg-neutral-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-neutral-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-[11px] font-medium">أجور التوصيل المحققة</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-neutral-950 dark:text-white tabular-nums">
              {totalEarnedDeliveryFees.toLocaleString('ar-YE')} <span className="text-xs font-normal text-neutral-500">ر.ي</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold">مستحقاتك النقدية المحصلة</span>
          </div>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center p-1 bg-neutral-100 dark:bg-slate-800/80 rounded-xl border border-neutral-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'available'
                ? 'bg-white dark:bg-slate-900 text-neutral-950 dark:text-white shadow-2xs border border-neutral-200/60 dark:border-slate-700'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>طلبات متاحة للاستلام</span>
            {availableOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-neutral-900 text-white text-[10px] font-bold tabular-nums">
                {availableOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'active'
                ? 'bg-white dark:bg-slate-900 text-neutral-950 dark:text-white shadow-2xs border border-neutral-200/60 dark:border-slate-700'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>قيد التوصيل معي</span>
            {activeCourierOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold tabular-nums">
                {activeCourierOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('delivered')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'delivered'
                ? 'bg-white dark:bg-slate-900 text-neutral-950 dark:text-white shadow-2xs border border-neutral-200/60 dark:border-slate-700'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تم تسليمها</span>
            {deliveredOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold tabular-nums">
                {deliveredOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative sm:w-72">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text"
            placeholder="بحث برقم الطلب، الزبون، أو المتجر..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs font-medium outline-none focus:border-neutral-900 transition-all text-neutral-950 dark:text-white placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="p-16 text-center">
          <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-neutral-400">جاري تحميل بيانات الشحنات والمهام اللوجستية...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-neutral-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 mx-auto flex items-center justify-center border border-neutral-200 dark:border-slate-700">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-white">
            {activeTab === 'available' ? 'لا توجد طلبات جديدة بانتظار مندوب حالياً' : activeTab === 'active' ? 'ليس لديك أي طلبات جارية قيد التوصيل الآن' : 'لم تسجل أي طلبات مكتملة بعد'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
            {activeTab === 'available' ? 'عند قيام أي زبون بطلب شراء من المتجر، سيظهر هنا فوراً مع موقع المتجر وموقع الزبون لتتمكن من قبوله والتوجه لتوصيله.' : 'يمكنك تصفح تبويب "طلبات متاحة للاستلام" وقبول الطلبات الجديدة.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
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
                className="bg-white dark:bg-slate-900 rounded-2xl border border-neutral-200 dark:border-slate-800 shadow-xs hover:border-neutral-300 transition-all duration-200 overflow-hidden"
              >
                {/* Order Top Bar */}
                <div className="p-4 sm:p-5 border-b border-neutral-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/60 dark:bg-slate-950/40">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <Package className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-neutral-950 dark:text-white dir-ltr">
                          #{order.id.slice(0, 8)}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isDelivered 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' 
                            : isOutForDelivery 
                              ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                              : isAssignedToMe
                                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                                : 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-slate-800 dark:text-neutral-300 dark:border-slate-700'
                        }`}>
                          {isDelivered 
                            ? 'تم التسليم بنجاح' 
                            : isOutForDelivery 
                              ? 'في الطريق للزبون' 
                              : isAssignedToMe 
                                ? 'معي - جاري الاستلام من المتجر' 
                                : 'متاح للاستلام والتوصيل'}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-500 tabular-nums">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Financial Overview */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] text-neutral-500 font-medium">التحصيل من الزبون:</div>
                      <div className="text-sm sm:text-base font-black text-neutral-950 dark:text-white tabular-nums">
                        {order.paymentMethod === 'wallet' ? '0 ر.ي (مدفوع بالمحفظة)' : `${order.total.toLocaleString('ar-YE')} ر.ي`}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 text-right">
                      <div className="text-[10px] text-neutral-500 font-medium">أجرة التوصيل لك</div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {(order.deliveryFee || 1500).toLocaleString('ar-YE')} ر.ي
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content: Store Location (Pickup) & Customer Location (Delivery) */}
                <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  
                  {/* 1. STORE (PICKUP STATION) */}
                  <div className="bg-neutral-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-neutral-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-200 dark:border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
                          <Store className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                            محطة الاستلام (المتجر)
                          </div>
                          <h4 className="font-bold text-sm text-neutral-950 dark:text-white">
                            {storeName}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-500">
                        الخطوة 1: استلام الشحنة
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2 text-neutral-600 dark:text-neutral-300">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-semibold text-neutral-900 dark:text-white">عنوان المتجر: </span>
                          <span>{storeAddress}</span>
                          {storeProfile?.city && !storeAddress.includes(storeProfile.city) && (
                            <span className="text-neutral-500"> ({storeProfile.city})</span>
                          )}
                        </div>
                      </div>

                      {storeOwnerName && storeOwnerName !== storeName && (
                        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                          <User className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span className="font-semibold text-neutral-900 dark:text-white">صاحب المتجر: </span>
                          <span>{storeOwnerName}</span>
                        </div>
                      )}

                      {storePhone && (
                        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                          <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span className="font-semibold text-neutral-900 dark:text-white">هاتف المتجر: </span>
                          <span className="font-mono dir-ltr">{storePhone}</span>
                        </div>
                      )}

                      <div>
                        {hasStoreGps ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>📍 موقع GPS دقيق للمتجر محدد على الخريطة</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-slate-700 text-[10px]">
                            <span>موقع المتجر عبر العنوان المسجل</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons for Store */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={getStoreMapUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[140px] px-3 py-2 bg-neutral-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>ملاحة مباشرة للمتجر (GPS)</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>

                      {storePhone && (
                        <>
                          <a
                            href={`tel:${storePhone}`}
                            className="p-2 bg-white dark:bg-slate-700 border border-neutral-200 dark:border-slate-600 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-100 transition"
                            title="اتصال بالمتجر"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/${storePhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white dark:bg-slate-700 border border-neutral-200 dark:border-slate-600 text-emerald-600 rounded-lg hover:bg-neutral-100 transition"
                            title="واتساب المتجر"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 2. CUSTOMER (DELIVERY STATION) */}
                  <div className="bg-neutral-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-neutral-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-200 dark:border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                            محطة التسليم (الزبون المستلم)
                          </div>
                          <h4 className="font-bold text-sm text-neutral-950 dark:text-white">
                            {order.customerName || 'عميل المتجر'}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-500">
                        الخطوة 2: التسليم
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-start gap-2 text-neutral-600 dark:text-neutral-300">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-neutral-900 dark:text-white">العنوان: </span>
                          <span>{customerAddress}</span>
                        </div>
                      </div>

                      {customerPhone && (
                        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                          <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span className="font-semibold text-neutral-900 dark:text-white">الهاتف: </span>
                          <span className="font-mono dir-ltr">{customerPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons for Customer */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={getCustomerMapUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[140px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>ملاحة الخرائط للزبون {order.location ? '(GPS دقيق)' : ''}</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>

                      {customerPhone && (
                        <>
                          <a
                            href={`tel:${customerPhone}`}
                            className="p-2 bg-white dark:bg-slate-700 border border-neutral-200 dark:border-slate-600 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-100 transition"
                            title="اتصال بالزبون"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white dark:bg-slate-700 border border-neutral-200 dark:border-slate-600 text-emerald-600 rounded-lg hover:bg-neutral-100 transition"
                            title="واتساب الزبون"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                </div>

                {/* Package Items Snippet */}
                <div className="px-4 sm:px-5 py-2.5 bg-neutral-50/50 dark:bg-slate-950/20 border-t border-neutral-100 dark:border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="font-bold text-neutral-500 shrink-0 text-[11px]">محتويات الشحنة:</span>
                    {order.items.map((it, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 text-[11px] font-medium text-neutral-800 dark:text-neutral-200 shrink-0">
                        {it.title} × {it.quantity}
                      </span>
                    ))}
                  </div>

                  {order.deliveryNotes && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
                      ملاحظة: {order.deliveryNotes}
                    </div>
                  )}
                </div>

                {/* Action Buttons for Courier based on order state */}
                <div className="p-4 sm:p-5 border-t border-neutral-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setSelectedOrderForNotes(order);
                      setDeliveryNoteText(order.deliveryNotes || '');
                    }}
                    className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-slate-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 transition"
                  >
                    تدوين ملاحظة على الطلب
                  </button>

                  <div className="flex items-center gap-2">
                    {/* State 1: Order is available -> Courier claims it */}
                    {!order.courierId && (
                      <button
                        onClick={() => handleClaimOrder(order)}
                        disabled={actionLoadingId === order.id}
                        className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-lg font-bold text-xs shadow-xs active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <Bike className="w-3.5 h-3.5" />
                        <span>قبول واستلام الطلب للتوصيل</span>
                      </button>
                    )}

                    {/* State 2: Order is claimed by courier and not yet picked up from store */}
                    {isAssignedToMe && !isOutForDelivery && !isDelivered && (
                      <button
                        onClick={() => handleConfirmStorePickup(order)}
                        disabled={actionLoadingId === order.id}
                        className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-lg font-bold text-xs shadow-xs active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>تأكيد الاستلام من المتجر والانطلاق</span>
                      </button>
                    )}

                    {/* State 3: Order is out for delivery -> Courier completes delivery */}
                    {isAssignedToMe && isOutForDelivery && !isDelivered && (
                      <button
                        onClick={() => handleCompleteDelivery(order)}
                        disabled={actionLoadingId === order.id}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تم التسليم للزبون وتحصيل المبلغ</span>
                      </button>
                    )}

                    {/* State 4: Already delivered */}
                    {isDelivered && (
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-neutral-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-neutral-950 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-neutral-700" />
              ملاحظة التوصيل على طلب #{selectedOrderForNotes.id.slice(0, 8)}
            </h3>
            <p className="text-xs text-neutral-500 font-medium">
              يمكنك تدوين أي تفاصيل تخص التسليم (مثل: الزبون غير متواجد حالياً، تم الاتفاق على موعد لاحق، تم تسليم الطرد للحارس).
            </p>
            <textarea
              rows={4}
              value={deliveryNoteText}
              onChange={(e) => setDeliveryNoteText(e.target.value)}
              placeholder="اكتب ملاحظتك هنا..."
              className="w-full p-3 rounded-xl border border-neutral-300 dark:border-slate-700 bg-neutral-50 dark:bg-slate-800 text-xs font-medium outline-none focus:bg-white focus:border-neutral-900 text-neutral-950 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveDeliveryNote}
                className="flex-1 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                حفظ الملاحظة
              </button>
              <button
                onClick={() => setSelectedOrderForNotes(null)}
                className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold text-xs transition border border-neutral-200 dark:border-slate-700"
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
