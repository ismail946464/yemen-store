import React, { useEffect, useMemo, useState } from 'react';
import {
  Gavel,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  ExternalLink,
  Truck,
  ShieldCheck,
  Trash2,
  Lock,
  RotateCcw,
  X,
  MessageCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import {
  BuyerRequestItem,
  REQUEST_CATEGORIES,
  RequestBidItem,
  YEMEN_REQUEST_CITIES,
  deleteBuyerRequestWithBids,
  getFulfillmentLabel,
  getRequestStatusLabel,
  submitStoreBidTransaction,
  updateBuyerRequestStatus,
} from '../lib/buyerRequests';
import { formatArabicDate } from '../lib/deviceSafe';

interface AdminBuyerRequestsTabProps {
  buyerRequests: BuyerRequestItem[];
  currentStoreId: string;
  currentStoreName: string;
  storeProfile: any;
  storeProducts: any[];
  isAdmin: boolean;
  getThemeClasses: (type?: any) => string;
}

export default function AdminBuyerRequestsTab({
  buyerRequests,
  currentStoreId,
  currentStoreName,
  storeProfile,
  storeProducts,
  isAdmin,
  getThemeClasses,
}: AdminBuyerRequestsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'accepted' | 'all'>('open');
  const [cityFilter, setCityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [myBidsMap, setMyBidsMap] = useState<Record<string, RequestBidItem>>({});
  const [biddingRequest, setBiddingRequest] = useState<BuyerRequestItem | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidDeliveryIncluded, setBidDeliveryIncluded] = useState(true);
  const [bidDeliveryFee, setBidDeliveryFee] = useState('0');
  const [bidEstimate, setBidEstimate] = useState('خلال نفس اليوم');
  const [bidWarranty, setBidWarranty] = useState('');
  const [bidProductId, setBidProductId] = useState('');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);

  useEffect(() => {
    if (!currentStoreId) {
      setMyBidsMap({});
      return;
    }
    const q = query(collection(db, 'requestBids'), where('storeId', '==', currentStoreId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, RequestBidItem> = {};
        snap.docs.forEach((d) => {
          const data = { id: d.id, ...d.data() } as RequestBidItem;
          if (data.requestId) next[data.requestId] = data;
        });
        setMyBidsMap(next);
      },
      (err) => console.warn('My store bids listener notice:', err.message)
    );
    return () => unsub();
  }, [currentStoreId]);

  const activeStoreProducts = useMemo(
    () =>
      storeProducts.filter(
        (p) => (p.status || 'active') === 'active' && (!p.ownerId || p.ownerId === currentStoreId)
      ),
    [storeProducts, currentStoreId]
  );

  const openCount = useMemo(
    () => buyerRequests.filter((r) => r.status === 'open').length,
    [buyerRequests]
  );

  const mySubmittedCount = useMemo(
    () => Object.keys(myBidsMap).length,
    [myBidsMap]
  );

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return buyerRequests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (cityFilter !== 'all' && r.city !== cityFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        String(r.title || '').toLowerCase().includes(term) ||
        String(r.details || '').toLowerCase().includes(term) ||
        String(r.city || '').toLowerCase().includes(term) ||
        String(r.category || '').toLowerCase().includes(term) ||
        String(r.userName || '').toLowerCase().includes(term)
      );
    });
  }, [buyerRequests, statusFilter, cityFilter, categoryFilter, searchTerm]);

  const openBidModal = (req: BuyerRequestItem) => {
    const existing = myBidsMap[req.id];
    setBiddingRequest(req);
    if (existing) {
      setBidPrice(String(existing.price ?? ''));
      setBidDeliveryIncluded(Boolean(existing.deliveryIncluded));
      setBidDeliveryFee(String(existing.deliveryFee ?? 0));
      setBidEstimate(existing.deliveryEstimate || 'خلال نفس اليوم');
      setBidWarranty(existing.warrantyNote || '');
      setBidProductId(existing.productId || '');
    } else {
      setBidPrice(req.targetBudget ? String(req.targetBudget) : '');
      setBidDeliveryIncluded(true);
      setBidDeliveryFee('0');
      setBidEstimate('خلال نفس اليوم');
      setBidWarranty('');
      setBidProductId('');
    }
  };

  const handleProductPick = (prodId: string) => {
    setBidProductId(prodId);
    const chosen = activeStoreProducts.find((p) => p.id === prodId);
    if (chosen && !bidPrice) {
      setBidPrice(String(Math.round(Number(chosen.price || 0))));
    }
  };

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biddingRequest || !currentStoreId) return;
    const numericPrice = Number(bidPrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      toast.error('يرجى إدخال سعر صحيح للعرض');
      return;
    }

    setIsSubmittingBid(true);
    try {
      const selectedProduct = activeStoreProducts.find((p) => p.id === bidProductId) || null;
      const result = await submitStoreBidTransaction({
        request: biddingRequest,
        storeId: currentStoreId,
        storeName: storeProfile?.name || currentStoreName || 'متجر',
        storeLogo: storeProfile?.logoUrl || '',
        storeCity: storeProfile?.city || '',
        storeVerified: Boolean(storeProfile?.verified),
        price: numericPrice,
        deliveryIncluded: bidDeliveryIncluded,
        deliveryFee: bidDeliveryIncluded ? 0 : Number(bidDeliveryFee || 0),
        deliveryEstimate: bidEstimate.trim() || 'خلال نفس اليوم',
        warrantyNote: bidWarranty.trim(),
        productId: selectedProduct ? selectedProduct.id : null,
        productTitle: selectedProduct ? (selectedProduct.title || selectedProduct.name || null) : null,
      });
      toast.success(result.isUpdate ? 'تم تحديث عرض سعرك بنجاح' : 'تم إرسال عرض سعرك إلى العميل');
      setBiddingRequest(null);
    } catch (err: any) {
      toast.error(err?.message || 'تعذر إرسال العرض');
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleToggleStatus = async (req: BuyerRequestItem) => {
    const next = req.status === 'open' ? 'closed' : 'open';
    try {
      await updateBuyerRequestStatus(req.id, next);
      toast.success(next === 'closed' ? 'تم إغلاق الطلب' : 'تمت إعادة فتح الطلب');
    } catch {
      toast.error('تعذر تحديث حالة الطلب');
    }
  };

  const handleDelete = async (req: BuyerRequestItem) => {
    try {
      await deleteBuyerRequestWithBids(req.id);
      toast.success('تم حذف الطلب وعروضه نهائياً');
    } catch {
      toast.error('تعذر حذف الطلب');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">
            طلبات التسعير العكسية من العملاء
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
            تصفح ما يبحث عنه المشترون حالياً، وقدّم عرض سعرك التنافسي مع التوصيل أو ربط منتج من متجرك
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold tabular-nums text-[#111214] dark:text-[#F4F4F2]">
            مفتوحة: {openCount} | عروضك: {mySubmittedCount}
          </div>
          <Link
            to="/requests"
            className={`min-h-[42px] px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>فتح سوق الطلبات</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم الطلب أو العميل..."
            className="w-full min-h-[42px] pr-9 pl-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-medium text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
        >
          <option value="open">الطلبات المفتوحة فقط ({openCount})</option>
          <option value="accepted">الصفقات المكتملة</option>
          <option value="all">جميع الطلبات ({buyerRequests.length})</option>
        </select>

        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
        >
          <option value="all">كل المدن</option>
          {YEMEN_REQUEST_CITIES.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
        >
          <option value="all">كل التصنيفات</option>
          {REQUEST_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-14 px-4 rounded-xl border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-2">
          <Gavel className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500" />
          <p className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">
            لا توجد طلبات تسعير مطابقة حالياً
          </p>
          <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
            عندما يضيف العملاء طلبات شراء جديدة ستظهر هنا فوراً للمزايدة وتقديم الأسعار.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((req) => {
            const myBid = myBidsMap[req.id];
            const isOwnRequest = req.userId === currentStoreId;
            return (
              <div
                key={req.id}
                className="rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400">
                        {req.category} • {formatArabicDate(req.createdAt)}
                      </span>
                      <h3 className="font-display font-extrabold text-sm sm:text-base text-[#111214] dark:text-[#F4F4F2] mt-0.5 line-clamp-2">
                        {req.title}
                      </h3>
                    </div>

                    <span
                      className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold border ${
                        req.status === 'open'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : req.status === 'accepted'
                            ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {getRequestStatusLabel(req.status)}
                    </span>
                  </div>

                  {req.details && (
                    <p className="text-xs text-[#5C5B57] dark:text-zinc-300 leading-relaxed line-clamp-2">
                      {req.details}
                    </p>
                  )}

                  {req.referenceImage && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
                      <img src={req.referenceImage} alt={req.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 pt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {req.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" />
                      {getFulfillmentLabel(req.fulfillmentPreference)}
                    </span>
                    <span>العميل: {req.userName}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730] text-[11px]">
                    <div>
                      <span className="text-[#5C5B57] dark:text-zinc-400 block">ميزانية العميل</span>
                      <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {req.targetBudget ? `${req.targetBudget.toLocaleString()} ر.ي` : 'مفتوحة'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#5C5B57] dark:text-zinc-400 block">أقل عرض حالياً</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {req.lowestBidPrice !== null ? `${req.lowestBidPrice.toLocaleString()} ر.ي` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#5C5B57] dark:text-zinc-400 block">العروض المقدمة</span>
                      <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {req.bidsCount} متاجر
                      </span>
                    </div>
                  </div>

                  {myBid && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#131519] border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>عرضك الحالي: {Number(myBid.price).toLocaleString()} ر.ي</span>
                      </span>
                      <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                        {myBid.status === 'accepted' ? 'تم القبول!' : myBid.deliveryEstimate}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                  {req.status === 'open' && !isOwnRequest && (
                    <button
                      type="button"
                      onClick={() => openBidModal(req)}
                      className={`flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      <span>{myBid ? 'تحديث عرض متجرك' : 'تقديم عرض سعر'}</span>
                    </button>
                  )}

                  <Link
                    to={`/contact?to=${req.userId}`}
                    className="min-h-[40px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>مراسلة</span>
                  </Link>

                  <Link
                    to={`/requests?id=${req.id}`}
                    className="min-h-[40px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center gap-1"
                  >
                    <span>التفاصيل</span>
                  </Link>

                  {isAdmin && (
                    <>
                      {req.status !== 'accepted' && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(req)}
                          title={req.status === 'open' ? 'إغلاق الطلب' : 'إعادة فتح الطلب'}
                          className="w-10 h-10 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-300 hover:text-[#111214] dark:hover:text-white flex items-center justify-center"
                        >
                          {req.status === 'open' ? <Lock className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(req)}
                        title="حذف الطلب"
                        className="w-10 h-10 rounded-lg border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/70 flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Store Bid Modal */}
      {biddingRequest && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between gap-3 bg-[#FAF9F6] dark:bg-[#101216]">
              <div>
                <h3 className="font-display font-bold text-base text-[#111214] dark:text-[#F4F4F2]">
                  {myBidsMap[biddingRequest.id] ? 'تحديث عرض السعر' : 'تقديم عرض سعر منافس'}
                </h3>
                <p className="text-xs text-[#5C5B57] dark:text-zinc-400 truncate max-w-[320px]">
                  {biddingRequest.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBiddingRequest(null)}
                className="w-9 h-9 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex items-center justify-center text-[#5C5B57] dark:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitBid} className="p-5 space-y-4">
              {activeStoreProducts.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                    ربط منتج من كتالوج متجرك (اختياري)
                  </label>
                  <select
                    value={bidProductId}
                    onChange={(e) => handleProductPick(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-medium text-[#111214] dark:text-[#F4F4F2] outline-none"
                  >
                    <option value="">عرض سعر خاص بدون ربط منتج</option>
                    {activeStoreProducts.slice(0, 60).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || p.name} ({Number(p.price || 0).toLocaleString()} ر.ي)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                    السعر المقترح (ر.ي) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={bidPrice}
                    onChange={(e) => setBidPrice(e.target.value)}
                    placeholder="مثال: 45000"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-bold tabular-nums text-[#111214] dark:text-[#F4F4F2] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                    مدة التجهيز والتوصيل
                  </label>
                  <input
                    type="text"
                    value={bidEstimate}
                    onChange={(e) => setBidEstimate(e.target.value)}
                    placeholder="مثال: خلال نفس اليوم"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-medium text-[#111214] dark:text-[#F4F4F2] outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] space-y-2.5">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                    <Truck className="w-4 h-4" />
                    <span>توصيل مجاني مشمول في العرض</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={bidDeliveryIncluded}
                    onChange={(e) => setBidDeliveryIncluded(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                </label>

                {!bidDeliveryIncluded && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 mb-1">
                      رسوم التوصيل التقديرية (ر.ي) — اتركها 0 للاستلام من المتجر
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={bidDeliveryFee}
                      onChange={(e) => setBidDeliveryFee(e.target.value)}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold tabular-nums text-[#111214] dark:text-[#F4F4F2] outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                  ملاحظات الضمان أو مواصفات العرض (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={bidWarranty}
                  onChange={(e) => setBidWarranty(e.target.value)}
                  placeholder="مثال: أصلي بضمان 6 أشهر شامل الفحص عند الاستلام..."
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-medium text-[#111214] dark:text-[#F4F4F2] outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                <button
                  type="button"
                  onClick={() => setBiddingRequest(null)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#111214] dark:text-[#F4F4F2]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBid}
                  className={`min-h-[42px] px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmittingBid ? 'جاري الإرسال...' : 'إرسال عرض السعر'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
