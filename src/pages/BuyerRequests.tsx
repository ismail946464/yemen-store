import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  MapPin,
  Store,
  ShieldCheck,
  CheckCircle2,
  MessageCircle,
  Clock,
  Truck,
  X,
  Image as ImageIcon,
  Trash2,
  ArrowUpDown,
  Lock,
  RotateCcw,
  ExternalLink,
  Gavel,
  ChevronLeft,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import {
  BuyerRequestItem,
  FulfillmentPreference,
  REQUEST_CATEGORIES,
  RequestBidItem,
  YEMEN_REQUEST_CITIES,
  acceptStoreBidTransaction,
  createBuyerRequest,
  deleteBuyerRequestWithBids,
  getFulfillmentLabel,
  getRequestStatusLabel,
  submitStoreBidTransaction,
  updateBuyerRequestStatus,
} from '../lib/buyerRequests';
import { formatArabicDate, formatArabicTime } from '../lib/deviceSafe';

const compressRefImage = (base64Str: string, maxDim = 900, quality = 0.65): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > h && w > maxDim) {
        h *= maxDim / w;
        w = maxDim;
      } else if (h >= w && h > maxDim) {
        w *= maxDim / h;
        h = maxDim;
      }
      canvas.width = Math.max(1, Math.round(w));
      canvas.height = Math.max(1, Math.round(h));
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });

export default function BuyerRequests() {
  const { user, userData, isStore, isAdmin, getThemeClasses, openLoginModal } = useAppContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState<BuyerRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'open' | 'mine' | 'accepted'>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // New request composer state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqDetails, setReqDetails] = useState('');
  const [reqCity, setReqCity] = useState('صنعاء');
  const [reqCategory, setReqCategory] = useState(REQUEST_CATEGORIES[0]);
  const [reqBudget, setReqBudget] = useState('');
  const [reqFulfillment, setReqFulfillment] = useState<FulfillmentPreference>('any');
  const [reqImage, setReqImage] = useState<string | null>(null);
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected request & live bids
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(() => searchParams.get('id'));
  const [bids, setBids] = useState<RequestBidItem[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bidSort, setBidSort] = useState<'lowest' | 'verified'>('lowest');

  // Store bid composer inside selected request modal
  const [storeProfileInfo, setStoreProfileInfo] = useState<any>(null);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [bidPrice, setBidPrice] = useState('');
  const [bidDeliveryIncluded, setBidDeliveryIncluded] = useState(true);
  const [bidDeliveryFee, setBidDeliveryFee] = useState('0');
  const [bidEstimate, setBidEstimate] = useState('خلال نفس اليوم');
  const [bidWarranty, setBidWarranty] = useState('');
  const [bidProductId, setBidProductId] = useState('');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);

  // Real-time list of buyer requests (capped cleanly to 80 recent)
  useEffect(() => {
    const q = query(collection(db, 'buyerRequests'), orderBy('updatedAt', 'desc'), limit(80));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BuyerRequestItem[];
        setRequests(list);
        setLoading(false);
      },
      (err) => {
        console.warn('BuyerRequests listener notice:', err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Load store metadata + store products if viewer is store/admin
  useEffect(() => {
    if (!user?.uid || (!isStore && !isAdmin)) return;
    let active = true;
    getDoc(doc(db, 'storeProfiles', user.uid))
      .then((snap) => {
        if (active && snap.exists()) setStoreProfileInfo(snap.data());
      })
      .catch(() => {});

    const unsubProds = onSnapshot(
      query(collection(db, 'products'), where('ownerId', '==', user.uid), where('status', '==', 'active'), limit(50)),
      (snap) => {
        if (active) setStoreProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );
    return () => {
      active = false;
      unsubProds();
    };
  }, [user?.uid, isStore, isAdmin]);

  // Sync ?id= search param with selectedRequestId
  useEffect(() => {
    const paramId = searchParams.get('id');
    if (paramId && paramId !== selectedRequestId) {
      setSelectedRequestId(paramId);
    }
  }, [searchParams]);

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  // Live listener for bids on the currently opened request
  useEffect(() => {
    if (!selectedRequestId) {
      setBids([]);
      return;
    }
    setBidsLoading(true);
    const q = query(collection(db, 'requestBids'), where('requestId', '==', selectedRequestId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as RequestBidItem[];
        setBids(list);
        setBidsLoading(false);
      },
      (err) => {
        console.warn('RequestBids listener notice:', err.message);
        setBidsLoading(false);
      }
    );
    return () => unsub();
  }, [selectedRequestId]);

  // Pre-fill store's own existing bid when opening a request
  useEffect(() => {
    if (!selectedRequestId || !user?.uid) return;
    const mine = bids.find((b) => b.storeId === user.uid);
    if (mine) {
      setBidPrice(String(mine.price ?? ''));
      setBidDeliveryIncluded(Boolean(mine.deliveryIncluded));
      setBidDeliveryFee(String(mine.deliveryFee ?? 0));
      setBidEstimate(mine.deliveryEstimate || 'خلال نفس اليوم');
      setBidWarranty(mine.warrantyNote || '');
      setBidProductId(mine.productId || '');
    } else {
      setBidPrice('');
      setBidDeliveryIncluded(true);
      setBidDeliveryFee('0');
      setBidEstimate('خلال نفس اليوم');
      setBidWarranty('');
      setBidProductId('');
    }
  }, [selectedRequestId, bids.length, user?.uid]);

  const openRequestDetail = (id: string) => {
    setSelectedRequestId(id);
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    setSearchParams(next, { replace: true });
  };

  const closeRequestDetail = () => {
    setSelectedRequestId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: true });
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يتجاوز 5 ميجابايت');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressRefImage(reader.result as string, 900, 0.65);
        setReqImage(compressed);
      } catch {
        toast.error('تعذر معالجة الصورة');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openLoginModal();
      return;
    }
    if (!reqTitle.trim()) {
      toast.error('يرجى كتابة اسم المنتج أو الطلب الذي تبحث عنه');
      return;
    }
    setIsSubmittingReq(true);
    try {
      const createdId = await createBuyerRequest({
        userId: user.uid,
        userName: userData?.name || user.displayName || 'مشتري',
        city: reqCity,
        category: reqCategory,
        title: reqTitle.trim(),
        details: reqDetails.trim(),
        targetBudget: reqBudget.trim() ? Number(reqBudget) : null,
        fulfillmentPreference: reqFulfillment,
        referenceImage: reqImage,
      });
      toast.success('تم نشر طلبك! ستتنافس المتاجر لتقديم أفضل سعر لك.');
      setShowCreateModal(false);
      setReqTitle('');
      setReqDetails('');
      setReqBudget('');
      setReqImage(null);
      setActiveTab('mine');
      openRequestDetail(createdId);
    } catch (err: any) {
      toast.error(err?.message || 'تعذر نشر الطلب');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRequest) return;
    if (!isStore && !isAdmin) {
      toast.error('تقديم عروض الأسعار متاح لحسابات المتاجر فقط');
      return;
    }
    const priceNum = Number(bidPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0 || bidPrice.trim() === '') {
      toast.error('يرجى إدخال السعر المقترح');
      return;
    }

    const linkedProduct = bidProductId ? storeProducts.find((p) => p.id === bidProductId) : null;
    const verifiedUntil = storeProfileInfo?.verifiedUntil;
    const isVerifiedNow =
      Boolean(storeProfileInfo?.verified) &&
      (!verifiedUntil || verifiedUntil === '' || new Date(verifiedUntil).getTime() >= Date.now());

    setIsSubmittingBid(true);
    try {
      const res = await submitStoreBidTransaction({
        request: selectedRequest,
        storeId: user.uid,
        storeName: storeProfileInfo?.name || userData?.name || user.displayName || 'متجر مسجل',
        storeLogo: storeProfileInfo?.logoUrl || userData?.photoURL || '',
        storeCity: storeProfileInfo?.city || '',
        storeVerified: isVerifiedNow || isAdmin,
        price: priceNum,
        deliveryIncluded: bidDeliveryIncluded,
        deliveryFee: bidDeliveryIncluded ? 0 : Number(bidDeliveryFee || 0),
        deliveryEstimate: bidEstimate,
        warrantyNote: bidWarranty,
        productId: linkedProduct?.id || null,
        productTitle: linkedProduct?.title || null,
      });
      toast.success(res.isUpdate ? 'تم تحديث عرض سعرك بنجاح' : 'تم إرسال عرض سعرك التنافسي للعميل');
    } catch (err: any) {
      toast.error(err?.message || 'تعذر إرسال العرض');
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleAcceptBid = async (bid: RequestBidItem) => {
    if (!user || !selectedRequest) return;
    setAcceptingBidId(bid.id);
    try {
      await acceptStoreBidTransaction({
        request: selectedRequest,
        bid,
        buyerId: user.uid,
        buyerName: userData?.name || user.displayName || 'مشتري',
      });
      toast.success(`تم قبول عرض متجر ${bid.storeName}! يمكنك مراسلته الآن لإتمام الشراء.`);
    } catch (err: any) {
      toast.error(err?.message || 'تعذر قبول العرض');
    } finally {
      setAcceptingBidId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return requests.filter((r) => {
      if (activeTab === 'open' && r.status !== 'open') return false;
      if (activeTab === 'mine' && (!user?.uid || r.userId !== user.uid)) return false;
      if (activeTab === 'accepted' && r.status !== 'accepted') return false;
      if (cityFilter !== 'all' && r.city !== cityFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (term) {
        const hay = `${r.title} ${r.details || ''} ${r.category} ${r.city} ${r.userName}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [requests, activeTab, cityFilter, categoryFilter, searchTerm, user?.uid]);

  const sortedBids = useMemo(() => {
    const activeBids = bids.filter((b) => b.status !== 'withdrawn');
    if (bidSort === 'verified') {
      return [...activeBids].sort((a, b) => {
        if (a.storeVerified !== b.storeVerified) return a.storeVerified ? -1 : 1;
        return (a.price + a.deliveryFee) - (b.price + b.deliveryFee);
      });
    }
    return [...activeBids].sort((a, b) => {
      if (a.status === 'accepted' && b.status !== 'accepted') return -1;
      if (b.status === 'accepted' && a.status !== 'accepted') return 1;
      return (a.price + a.deliveryFee) - (b.price + b.deliveryFee);
    });
  }, [bids, bidSort]);

  const openCount = useMemo(() => requests.filter((r) => r.status === 'open').length, [requests]);
  const mineCount = useMemo(
    () => (user?.uid ? requests.filter((r) => r.userId === user.uid).length : 0),
    [requests, user?.uid]
  );
  const acceptedCount = useMemo(() => requests.filter((r) => r.status === 'accepted').length, [requests]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Editorial Header */}
      <section className="pb-5 border-b border-[#E5E2DA] dark:border-[#232730] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5C5B57] dark:text-zinc-400">
            <Gavel className="w-3.5 h-3.5" />
            <span>سوق الطلبات العكسي</span>
            <span aria-hidden="true">·</span>
            <span>ميزة حصرية في محيط</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-balance text-[#111214] dark:text-[#F4F4F2]">
            اطلبها بالسعر اللي يناسبك
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 leading-relaxed">
            اكتب ما تبحث عنه وحدد ميزانيتك التقريبية، وستتنافس المتاجر الموثقة لتقديم أقل سعر وأسرع توصيل وضمان لك في مكان واحد.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (!user) {
                openLoginModal();
                return;
              }
              setShowCreateModal(true);
            }}
            className={`min-h-[44px] px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            <Plus className="w-4 h-4" />
            <span>أضف طلب تسعيرة الآن</span>
          </button>
        </div>
      </section>

      {/* Flush Tabs + Filter Controls */}
      <section className="space-y-4">
        <div className="border-b border-[#E5E2DA] dark:border-[#232730] flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`shrink-0 min-h-[44px] px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'open'
                ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
            }`}
          >
            <span>الطلبات المفتوحة</span>
            <span className="text-[11px] opacity-70 tabular-nums">({openCount})</span>
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setActiveTab('mine')}
              className={`shrink-0 min-h-[44px] px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'mine'
                  ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                  : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
              }`}
            >
              <span>طلباتي</span>
              <span className="text-[11px] opacity-70 tabular-nums">({mineCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('accepted')}
            className={`shrink-0 min-h-[44px] px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'accepted'
                ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
            }`}
          >
            <span>صفقات مكتملة</span>
            <span className="text-[11px] opacity-70 tabular-nums">({acceptedCount})</span>
          </button>
        </div>

        {/* Search & City/Category Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="relative sm:col-span-6">
            <Search className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث في طلبات الزبائن (سماعة، عسل، قطع غيار، جوال...)"
              className="w-full min-h-[44px] pr-10 pl-8 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs sm:text-sm font-medium text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5C5B57] p-1"
                aria-label="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            aria-label="تصفية حسب المحافظة"
            className="sm:col-span-3 min-h-[44px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
          >
            <option value="all">كل المحافظات</option>
            {YEMEN_REQUEST_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="تصفية حسب القسم"
            className="sm:col-span-3 min-h-[44px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
          >
            <option value="all">كل الأقسام</option>
            {REQUEST_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Requests Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-48 rounded-lg skeleton-shimmer border border-[#E5E2DA] dark:border-[#232730]" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-14 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-6 space-y-3">
          <Gavel className="w-9 h-9 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-55" />
          <p className="text-sm sm:text-base font-bold text-[#111214] dark:text-[#F4F4F2]">
            {activeTab === 'mine'
              ? 'لم تنشر أي طلب تسعيرة بعد'
              : 'لا توجد طلبات مطابقة حالياً'}
          </p>
          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 max-w-md mx-auto">
            كن أول من ينشر طلبه ليصلك تنافس المتاجر الموثقة بأفضل الأسعار والضمانات.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                openLoginModal();
                return;
              }
              setShowCreateModal(true);
            }}
            className={`mt-2 min-h-[42px] px-5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            <Plus className="w-4 h-4" />
            <span>أضف أول طلب تسعيرة</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRequests.map((req) => {
            const isMine = user?.uid === req.userId;
            return (
              <article
                key={req.id}
                onClick={() => openRequestDetail(req.id)}
                className="group cursor-pointer rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:border-[#111214] dark:hover:border-zinc-500 transition-colors p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  {/* Quiet 1-line unboxed metadata */}
                  <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{req.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{req.city}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatArabicDate(req.createdAt) || 'الآن'}</span>
                    </div>
                    {isMine && (
                      <span className="font-bold text-[#111214] dark:text-[#F4F4F2] shrink-0">طلبك</span>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    {req.referenceImage && (
                      <img
                        src={req.referenceImage}
                        alt={req.title}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-md object-cover border border-[#E5E2DA] dark:border-[#232730] shrink-0 bg-[#EFEDE6] dark:bg-[#1C1F26]"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="font-bold text-sm sm:text-base text-[#111214] dark:text-[#F4F4F2] line-clamp-2 leading-snug">
                        {req.title}
                      </h2>
                      {req.details && (
                        <p className="text-xs text-[#5C5B57] dark:text-zinc-400 line-clamp-2 leading-relaxed">
                          {req.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between gap-3">
                  <div className="space-y-0.5 tabular-nums">
                    {req.status === 'accepted' && req.acceptedPrice !== null ? (
                      <>
                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          تم الاتفاق · {req.acceptedStoreName}
                        </p>
                        <p className="text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                          {Number(req.acceptedPrice).toLocaleString()} ر.ي
                        </p>
                      </>
                    ) : req.lowestBidPrice !== null && req.bidsCount > 0 ? (
                      <>
                        <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                          أقل عرض متاح ({req.bidsCount} {req.bidsCount === 1 ? 'متجر' : 'متاجر'})
                        </p>
                        <p className={`text-sm sm:text-base font-extrabold ${getThemeClasses('price')}`}>
                          {Number(req.lowestBidPrice).toLocaleString()} ر.ي
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                          {req.targetBudget ? 'الميزانية المستهدفة' : 'بانتظار عروض المتاجر'}
                        </p>
                        <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                          {req.targetBudget ? `حتى ${Number(req.targetBudget).toLocaleString()} ر.ي` : 'مفتوح للتسعير'}
                        </p>
                      </>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] group-hover:underline shrink-0">
                    <span>
                      {(isStore || isAdmin) && req.status === 'open' && !isMine
                        ? 'قدّم عرضك'
                        : req.bidsCount > 0
                          ? 'مقارنة العروض'
                          : 'التفاصيل'}
                    </span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal: Create New Reverse Price Request */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div>
                <h3 className="font-display text-lg font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                  طلب تسعيرة جديد من المتاجر
                </h3>
                <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                  أخبر المتاجر بما تريده لتصلك عروض أسعار منافسة مباشرة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-10 h-10 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                  ما الذي تبحث عنه؟ *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="مثال: سماعة AirPods Pro أصلية / بطارية سيارة 70 أمبير / عسل سدر دوعني"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-medium text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                    المحافظة / المدينة
                  </label>
                  <select
                    value={reqCity}
                    onChange={(e) => setReqCity(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
                  >
                    {YEMEN_REQUEST_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                    القسم
                  </label>
                  <select
                    value={reqCategory}
                    onChange={(e) => setReqCategory(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
                  >
                    {REQUEST_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                    السعر المستهدف بالر.ي (اختياري)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={reqBudget}
                    onChange={(e) => setReqBudget(e.target.value)}
                    placeholder="مثال: 25000"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-bold tabular-nums text-[#111214] dark:text-[#F4F4F2] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                    طريقة الاستلام المفضلة
                  </label>
                  <select
                    value={reqFulfillment}
                    onChange={(e) => setReqFulfillment(e.target.value as FulfillmentPreference)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
                  >
                    <option value="any">توصيل أو استلام من المتجر</option>
                    <option value="delivery">أفضّل التوصيل لعنواني</option>
                    <option value="store_pickup">أفضّل الحضور للاستلام من المتجر</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                  المواصفات والشروط المطلوبة (اختياري)
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={reqDetails}
                  onChange={(e) => setReqDetails(e.target.value)}
                  placeholder="اذكر اللون، الحجم، الحالة (جديد/أصلي)، الكمية المطلوبة، أو أي تفاصيل تساعد المتاجر على تسعير دقيق..."
                  className="w-full p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs sm:text-sm font-medium text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                />
              </div>

              {/* Optional Reference Photo */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                  صورة توضيحية للمنتج المطلوب (اختياري)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[42px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold flex items-center gap-2 text-[#111214] dark:text-[#F4F4F2]"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{reqImage ? 'تغيير الصورة' : 'إرفاق صورة مرجعية'}</span>
                  </button>
                  {reqImage && (
                    <div className="flex items-center gap-2">
                      <img src={reqImage} alt="معاينة" className="w-11 h-11 rounded-md object-cover border border-[#E5E2DA]" />
                      <button
                        type="button"
                        onClick={() => setReqImage(null)}
                        className="text-xs font-bold text-rose-600 hover:underline"
                      >
                        حذف
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImagePick}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#5C5B57] dark:text-zinc-400"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReq}
                  className={`min-h-[44px] px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  {isSubmittingReq ? 'جاري النشر...' : 'نشر الطلب للمتاجر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Details, Competitive Store Bids & Bidding Form */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
          <div className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-6 shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5B57] dark:text-zinc-400">
                  <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">
                    {getRequestStatusLabel(selectedRequest.status)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedRequest.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedRequest.city}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatArabicDate(selectedRequest.createdAt)} {formatArabicTime(selectedRequest.createdAt)}
                  </span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                  {selectedRequest.title}
                </h2>
                <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
                  بواسطة: <strong className="text-[#111214] dark:text-[#F4F4F2]">{selectedRequest.userName}</strong>
                  <span className="mx-2" aria-hidden="true">·</span>
                  <span>{getFulfillmentLabel(selectedRequest.fulfillmentPreference)}</span>
                  {selectedRequest.targetBudget !== null && (
                    <>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span className="tabular-nums font-bold text-[#111214] dark:text-[#F4F4F2]">
                        الميزانية: {Number(selectedRequest.targetBudget).toLocaleString()} ر.ي
                      </span>
                    </>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={closeRequestDetail}
                className="w-10 h-10 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 shrink-0"
                aria-label="إغلاق التفاصيل"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body details + reference image */}
            {(selectedRequest.details || selectedRequest.referenceImage) && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                {selectedRequest.referenceImage && (
                  <img
                    src={selectedRequest.referenceImage}
                    alt={selectedRequest.title}
                    referrerPolicy="no-referrer"
                    className="w-full sm:w-32 h-36 sm:h-32 rounded-lg object-cover border border-[#E5E2DA] dark:border-[#232730] shrink-0"
                  />
                )}
                <div className="space-y-1.5 flex-1">
                  <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block">
                    تفاصيل ومواصفات الطلب:
                  </span>
                  <p className="text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] leading-relaxed whitespace-pre-line">
                    {selectedRequest.details || 'لا توجد تفاصيل إضافية — يمكن للمتاجر الاستفسار أو إرسال عرض السعر المناسب.'}
                  </p>
                </div>
              </div>
            )}

            {/* Owner / Admin management strip */}
            {(user?.uid === selectedRequest.userId || isAdmin) && (
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedRequest.status === 'open' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateBuyerRequestStatus(selectedRequest.id, 'closed')
                          .then(() => toast.success('تم إغلاق الطلب'))
                          .catch(() => toast.error('تعذر إغلاق الطلب'))
                      }
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] inline-flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>إغلاق الطلب</span>
                    </button>
                  )}
                  {selectedRequest.status === 'closed' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateBuyerRequestStatus(selectedRequest.id, 'open')
                          .then(() => toast.success('تم إعادة فتح الطلب للمتاجر'))
                          .catch(() => toast.error('تعذر إعادة الفتح'))
                      }
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة فتح الطلب</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    deleteBuyerRequestWithBids(selectedRequest.id)
                      .then(() => {
                        toast.success('تم حذف الطلب وعروضه');
                        closeRequestDetail();
                      })
                      .catch(() => toast.error('تعذر حذف الطلب'));
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الطلب</span>
                </button>
              </div>
            )}

            {/* Accepted Banner */}
            {selectedRequest.status === 'accepted' && selectedRequest.acceptedStoreId && (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs sm:text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                      تم اختيار عرض متجر «{selectedRequest.acceptedStoreName}» بسعر {Number(selectedRequest.acceptedPrice || 0).toLocaleString()} ر.ي
                    </p>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                      يمكن للمشتري والمتجر متابعة إتمام الطلب والدفع والتوصيل عبر المحادثة المباشرة.
                    </p>
                  </div>
                </div>
                {user && (user.uid === selectedRequest.userId || user.uid === selectedRequest.acceptedStoreId) && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/contact?to=${
                          user.uid === selectedRequest.userId
                            ? selectedRequest.acceptedStoreId
                            : selectedRequest.userId
                        }`
                      )
                    }
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>فتح المحادثة</span>
                  </button>
                )}
              </div>
            )}

            {/* Store Bid Composer (for Store accounts or Admin on open requests not belonging to self) */}
            {selectedRequest.status === 'open' && user && (isStore || isAdmin) && user.uid !== selectedRequest.userId && (
              <form
                onSubmit={handleSubmitBid}
                className="p-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    <span>
                      {bids.some((b) => b.storeId === user.uid)
                        ? 'تحديث عرض السعر التنافسي لمتجرك'
                        : 'قدّم عرض سعر منافس من متجرك'}
                    </span>
                  </h3>
                  {selectedRequest.lowestBidPrice !== null && (
                    <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                      أقل عرض حالياً: {Number(selectedRequest.lowestBidPrice).toLocaleString()} ر.ي
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 mb-1">
                      السعر المقترح (ر.ي) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={bidPrice}
                      onChange={(e) => setBidPrice(e.target.value)}
                      placeholder="مثال: 22000"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-sm font-bold tabular-nums text-[#111214] dark:text-[#F4F4F2] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 mb-1">
                      مدة التجهيز / التوصيل
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={bidEstimate}
                      onChange={(e) => setBidEstimate(e.target.value)}
                      placeholder="مثال: خلال 3 ساعات"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-medium text-[#111214] dark:text-[#F4F4F2] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 mb-1">
                      ربط بمنتج من متجرك (اختياري)
                    </label>
                    <select
                      value={bidProductId}
                      onChange={(e) => setBidProductId(e.target.value)}
                      className="w-full min-h-[42px] px-2.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
                    >
                      <option value="">عرض خاص بدون ربط منتج</option>
                      {storeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({Number(p.price || 0).toLocaleString()} ر.ي)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bidDeliveryIncluded}
                      onChange={(e) => setBidDeliveryIncluded(e.target.checked)}
                      className="w-4 h-4 accent-[#111214]"
                    />
                    <span>شامل التوصيل مجاناً (أو بدون رسوم إضافية)</span>
                  </label>

                  {!bidDeliveryIncluded && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400">رسوم التوصيل:</span>
                      <input
                        type="number"
                        min="0"
                        value={bidDeliveryFee}
                        onChange={(e) => setBidDeliveryFee(e.target.value)}
                        className="w-28 min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold tabular-nums outline-none"
                      />
                      <span className="text-xs text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                    </div>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    maxLength={1000}
                    value={bidWarranty}
                    onChange={(e) => setBidWarranty(e.target.value)}
                    placeholder="ملاحظات الضمان أو الجودة (مثال: أصلي بختم الوكالة + ضمان استبدال أسبوع + فاتورة رسمية)"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-medium text-[#111214] dark:text-[#F4F4F2] outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingBid}
                    className={`min-h-[42px] px-5 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    {isSubmittingBid
                      ? 'جاري الإرسال...'
                      : bids.some((b) => b.storeId === user.uid)
                        ? 'تحديث العرض'
                        : 'إرسال العرض للمشتري'}
                  </button>
                </div>
              </form>
            )}

            {/* Live Competing Bids Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                  عروض المتاجر المنافسة ({sortedBids.length})
                </h3>

                {sortedBids.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#5C5B57]" />
                    <select
                      value={bidSort}
                      onChange={(e) => setBidSort(e.target.value as 'lowest' | 'verified')}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold outline-none"
                    >
                      <option value="lowest">الأقل سعراً أولاً</option>
                      <option value="verified">المتاجر الموثقة أولاً</option>
                    </select>
                  </div>
                )}
              </div>

              {bidsLoading ? (
                <div className="space-y-2.5">
                  <div className="h-24 rounded-lg skeleton-shimmer" />
                  <div className="h-24 rounded-lg skeleton-shimmer" />
                </div>
              ) : sortedBids.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] text-center text-xs text-[#5C5B57] dark:text-zinc-400">
                  لم تُقدَّم عروض أسعار على هذا الطلب بعد. ستصل إشعارات فورية لصاحب الطلب فور تقديم أول عرض.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730] rounded-lg border border-[#E5E2DA] dark:border-[#232730] overflow-hidden">
                  {sortedBids.map((bid, idx) => {
                    const isWinner = bid.status === 'accepted' || selectedRequest.acceptedBidId === bid.id;
                    const totalOffer = Number(bid.price || 0) + (bid.deliveryIncluded ? 0 : Number(bid.deliveryFee || 0));
                    const canAccept =
                      selectedRequest.status === 'open' &&
                      user?.uid === selectedRequest.userId;

                    return (
                      <div
                        key={bid.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isWinner
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                            : 'bg-white dark:bg-[#131519]'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <Link
                            to={`/store/${bid.storeId}`}
                            onClick={() => closeRequestDetail()}
                            className="w-11 h-11 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] flex items-center justify-center overflow-hidden shrink-0"
                          >
                            {bid.storeLogo ? (
                              <img src={bid.storeLogo} alt={bid.storeName} className="w-full h-full object-cover" />
                            ) : (
                              <Store className="w-5 h-5 text-[#5C5B57]" />
                            )}
                          </Link>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                                to={`/store/${bid.storeId}`}
                                onClick={() => closeRequestDetail()}
                                className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2] hover:underline"
                              >
                                {bid.storeName}
                              </Link>
                              {bid.storeVerified ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                  <span>متجر موثق</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
                                  متجر مشارك
                                </span>
                              )}
                              {idx === 0 && bidSort === 'lowest' && sortedBids.length > 1 && !isWinner && (
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  · أقل سعر
                                </span>
                              )}
                              {isWinner && (
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  · العرض المقبول
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5C5B57] dark:text-zinc-400">
                              {bid.storeCity && <span>{bid.storeCity}</span>}
                              {bid.storeCity && <span aria-hidden="true">·</span>}
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {bid.deliveryEstimate || 'حسب الاتفاق'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                {bid.deliveryIncluded
                                  ? 'التوصيل مجاني'
                                  : bid.deliveryFee > 0
                                    ? `التوصيل: ${Number(bid.deliveryFee).toLocaleString()} ر.ي`
                                    : 'استلام من المتجر'}
                              </span>
                            </div>

                            {bid.warrantyNote && (
                              <p className="text-xs text-[#111214] dark:text-zinc-300 leading-relaxed pt-0.5">
                                {bid.warrantyNote}
                              </p>
                            )}

                            {bid.productId && (
                              <Link
                                to={`/product/${bid.productId}`}
                                onClick={() => closeRequestDetail()}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-400 hover:underline pt-0.5"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>عرض المنتج المرتبط: {bid.productTitle || 'صفحة المنتج'}</span>
                              </Link>
                            )}
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                          <div className="text-right sm:text-left tabular-nums">
                            <p className={`text-lg font-extrabold ${getThemeClasses('price')}`}>
                              {Number(bid.price).toLocaleString()} <span className="text-xs font-bold">ر.ي</span>
                            </p>
                            {!bid.deliveryIncluded && bid.deliveryFee > 0 && (
                              <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400">
                                الإجمالي بالتوصيل: {totalOffer.toLocaleString()} ر.ي
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {user && user.uid !== bid.storeId && (
                              <button
                                type="button"
                                onClick={() => {
                                  closeRequestDetail();
                                  navigate(`/contact?to=${bid.storeId}`);
                                }}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] inline-flex items-center gap-1"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>استفسار</span>
                              </button>
                            )}

                            {canAccept && (
                              <button
                                type="button"
                                disabled={acceptingBidId === bid.id}
                                onClick={() => handleAcceptBid(bid)}
                                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                              >
                                {acceptingBidId === bid.id ? 'جاري التأكيد...' : 'قبول هذا العرض'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
