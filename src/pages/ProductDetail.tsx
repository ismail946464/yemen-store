import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import {
  ShoppingCart, ArrowRight, Share2, ShieldCheck, Truck,
  CheckCircle, Store, MessageCircle, Star, Send, User,
  Image as ImageIcon, PackageX, BookmarkCheck, ShoppingBag
} from 'lucide-react';
import toast from 'react-hot-toast';
import PreOrderModal from '../components/PreOrderModal';
import { ProductDetailSkeleton } from '../components/Skeletons';

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState<string>('');
  const [imgFailed, setImgFailed] = useState(false);

  const { addToCart, getThemeClasses, user, login } = useAppContext();
  const navigate = useNavigate();
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showPreOrderModal, setShowPreOrderModal] = useState(false);

  useEffect(() => {
    if (!productId) return;
    const q = query(
      collection(db, 'productReviews'),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn('Reviews listener notice (handled):', err.message);
    });

    return () => unsubscribe();
  }, [productId]);

  useEffect(() => {
    let isMounted = true;
    async function getProduct() {
      if (!productId) return;
      setLoading(true);
      setImgFailed(false);
      try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        if (!isMounted) return;
        if (docSnap.exists()) {
          const data = docSnap.data();
          const fullProduct = { id: docSnap.id, ...data };
          setProduct(fullProduct);
          setActiveImage(data.image || (data.images && data.images[0]) || '');
          setNotFound(false);

          if (data.ownerId) {
            const storeSnap = await getDoc(doc(db, 'storeProfiles', data.ownerId));
            if (isMounted && storeSnap.exists()) {
              setStoreProfile(storeSnap.data());
            }
          }
        } else {
          setNotFound(true);
        }
      } catch (e) {
        if (isMounted) {
          console.error(e);
          setNotFound(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    getProduct();
    return () => { isMounted = false; };
  }, [productId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      login();
      return;
    }
    if (!newComment.trim()) {
      toast.error('يرجى كتابة تعليق قبل الإرسال');
      return;
    }

    setSubmittingReview(true);
    try {
      await addDoc(collection(db, 'productReviews'), {
        productId,
        userId: user.uid,
        userName: user.displayName || 'عميل المتجر',
        userPhoto: user.photoURL || '',
        rating: newRating,
        comment: newComment.trim(),
        createdAt: new Date().toISOString()
      });

      const productRef = doc(db, 'products', productId!);
      const currentRatingCount = product.ratingCount || 0;
      const currentAverageRating = product.averageRating || 0;
      const newRatingCount = currentRatingCount + 1;
      const newAverageRating = ((currentAverageRating * currentRatingCount) + newRating) / newRatingCount;

      await updateDoc(productRef, {
        ratingCount: newRatingCount,
        averageRating: newAverageRating
      });

      setProduct((prev: any) => prev ? { ...prev, ratingCount: newRatingCount, averageRating: newAverageRating } : prev);
      setNewComment('');
      setNewRating(5);
      toast.success('تمت إضافة تقييمك بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('تعذر إضافة التقييم');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description,
          url: window.location.href,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share failed:', err);
        }
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ رابط المنتج');
    }
  };

  if (loading) return <ProductDetailSkeleton />;

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-12" dir="rtl">
        <div className="w-16 h-16 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-300 flex items-center justify-center mb-5 border border-[#E5E2DA] dark:border-[#232730]">
          <PackageX className="w-8 h-8" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] mb-2">
          هذا المنتج غير متوفر حالياً
        </h2>
        <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
          ربما تم نفاد الكمية أو إزالته من المتجر. يمكنك تصفح المنتجات الأخرى المتاحة.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className={`min-h-[42px] px-6 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-colors flex items-center gap-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>العودة للمتجر</span>
          </Link>
          <Link
            to="/search-stores"
            className="min-h-[42px] px-6 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs sm:text-sm transition-colors flex items-center"
          >
            دليل المتاجر
          </Link>
        </div>
      </div>
    );
  }

  const isStoreVerified = Boolean(
    product?.ownerVerified ||
    (storeProfile && Boolean(storeProfile.verified) && (!storeProfile.verifiedUntil || storeProfile.verifiedUntil === '' || new Date(storeProfile.verifiedUntil).getTime() >= Date.now()))
  );
  const canPreOrder = isStoreVerified && (product?.isPreOrderEnabled ?? true);
  const isOutOfStock = product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0;
  const depositAmount = (product.depositAmount && Number(product.depositAmount) > 0)
    ? Number(product.depositAmount)
    : Math.max(1000, Math.round(Number(product.price) * 0.2));

  return (
    <div className="py-2 sm:py-4 space-y-12" dir="rtl">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 mb-6 min-h-[40px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>رجوع</span>
        </button>

        {/* Contiguous Two-Column Purchase Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Media Gallery */}
          <div className="lg:col-span-6 space-y-3 lg:sticky lg:top-22">
            <div className="aspect-square rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] relative">
              {activeImage && !imgFailed ? (
                <img
                  src={activeImage}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Store className="w-16 h-16 text-[#5C5B57] dark:text-zinc-600 opacity-40" />
                </div>
              )}

              {product.category === 'local' && (
                <span className="absolute top-3.5 right-3.5 bg-[#111214]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                  منتج محلي
                </span>
              )}

              <button
                type="button"
                onClick={handleShare}
                aria-label="مشاركة المنتج"
                className="absolute top-3.5 left-3.5 w-10 h-10 flex items-center justify-center bg-white/95 dark:bg-[#131519]/95 text-[#111214] dark:text-[#F4F4F2] rounded-lg border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {product.images && product.images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {product.images.map((img: string, idx: number) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      setActiveImage(img);
                      setImgFailed(false);
                    }}
                    className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-opacity ${
                      activeImage === img
                        ? `${getThemeClasses('border')} opacity-100`
                        : 'border-[#E5E2DA] dark:border-[#232730] opacity-60 hover:opacity-100'
                    }`}
                  >
                    {img ? (
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#EFEDE6] dark:bg-[#1C1F26]">
                        <ImageIcon className="w-5 h-5 text-[#5C5B57]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contiguous Purchase Ledger */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3 border-b border-[#E5E2DA] dark:border-[#232730] pb-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5C5B57] dark:text-zinc-400">
                <span>{product.category || 'منتج'}</span>
                <span aria-hidden="true">·</span>
                <span className={isOutOfStock ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}>
                  {isOutOfStock ? 'نفدت الكمية' : `متوفر${product.stock !== undefined && product.stock !== null ? ` (${product.stock} وحدة)` : ''}`}
                </span>
                {product.ownerName && (
                  <>
                    <span aria-hidden="true">·</span>
                    <Link to={`/store/${product.ownerId}`} className="inline-flex items-center gap-1 text-[#111214] dark:text-[#F4F4F2] hover:underline">
                      <span>{product.ownerName}</span>
                      {isStoreVerified && <CheckCircle className={`w-3.5 h-3.5 ${getThemeClasses('verified')}`} />}
                    </Link>
                  </>
                )}
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight text-balance leading-snug">
                {product.title}
              </h1>

              <div className="flex items-center gap-2 text-xs text-[#5C5B57] dark:text-zinc-400">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                    {product.averageRating ? Number(product.averageRating).toFixed(1) : '5.0'}
                  </span>
                </div>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{product.ratingCount || 0} تقييم</span>
              </div>
            </div>

            {/* Price Ledger Line */}
            <div className="flex items-baseline justify-between flex-wrap gap-2 py-4 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div>
                <span className="text-xs text-[#5C5B57] dark:text-zinc-400 block mb-0.5">السعر</span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                    {Number(product.price || 0).toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                </div>
              </div>
              {product.deliveryFee > 0 && (
                <span className="text-xs font-semibold text-[#5C5B57] dark:text-zinc-300 flex items-center gap-1.5 tabular-nums">
                  <Truck className="w-4 h-4" />
                  توصيل: {Number(product.deliveryFee).toLocaleString()} ر.ي
                </span>
              )}
            </div>

            {/* Primary Actions */}
            <div className="space-y-2.5">
              {product.externalLink ? (
                <a
                  href={product.externalLink}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full min-h-[46px] py-3.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 text-sm ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  <span>شراء عبر الرابط الخارجي</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </a>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) { login(); return; }
                      addToCart(product);
                    }}
                    disabled={isOutOfStock}
                    className="w-full min-h-[46px] border border-[#111214] dark:border-[#F4F4F2] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-40"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>{isOutOfStock ? 'نفدت الكمية' : (user ? 'أضف للسلة' : 'سجل دخولك للشراء')}</span>
                  </button>

                  {!isOutOfStock && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) { login(); return; }
                        addToCart(product);
                        navigate('/cart');
                      }}
                      className={`w-full min-h-[46px] py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 text-sm ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>شراء وإتمام الآن</span>
                    </button>
                  )}
                </div>
              )}

              {product.ownerId && product.ownerId !== user?.uid && (
                <Link
                  to={`/contact?to=${product.ownerId}`}
                  className="w-full min-h-[44px] border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] py-3 rounded-lg font-bold text-center transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>مراسلة المتجر</span>
                </Link>
              )}
            </div>

            {/* Description & Trust Guarantees */}
            <div className="space-y-4 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">المواصفات والتفاصيل</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#5C5B57] dark:text-zinc-300">
                  {product.description || 'لا توجد تفاصيل إضافية مسجلة.'}
                </p>
              </div>

              <div className="grid grid-cols-2 border border-[#E5E2DA] dark:border-[#232730] rounded-lg bg-white dark:bg-[#131519] overflow-hidden">
                <div className="flex items-center gap-2.5 p-3.5 border-e border-[#E5E2DA] dark:border-[#232730]">
                  <Truck className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                  <div>
                    <span className="block font-bold text-[#111214] dark:text-[#F4F4F2] text-xs">توصيل مباشر</span>
                    <span className="text-[#5C5B57] dark:text-zinc-400 text-[11px]">استلام حتى بابك</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3.5">
                  <ShieldCheck className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                  <div>
                    <span className="block font-bold text-[#111214] dark:text-[#F4F4F2] text-xs">حماية الطلب</span>
                    <span className="text-[#5C5B57] dark:text-zinc-400 text-[11px]">استلام أو محفظة</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pre-Order Ledger */}
            {canPreOrder && (
              <div className="rounded-lg p-5 border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <BookmarkCheck className="w-5 h-5 text-[#111214] dark:text-[#F4F4F2] shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">حجز مسبق بعربون</h3>
                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">احتفظ بالسلعة باسمك لمدة محددة</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">متجر موثق</span>
                </div>

                <div className="grid grid-cols-2 text-center py-3 border-y border-[#E5E2DA] dark:border-[#232730]">
                  <div className="border-e border-[#E5E2DA] dark:border-[#232730]">
                    <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">قيمة العربون</span>
                    <span className="text-base font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                      {depositAmount.toLocaleString()} ر.ي
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block">مدة الحجز</span>
                    <span className="text-base font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                      {product.reservationDurationDays || 3} أيام
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed font-medium">
                  ملاحظة: في حال عدم استكمال سداد المبلغ المتبقي قبل انتهاء مدة الحجز ({product.reservationDurationDays || 3} أيام)، يُلغى الحجز تلقائياً ويُحتسب العربون للمتجر.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (!user) { login(); return; }
                    setShowPreOrderModal(true);
                  }}
                  className={`w-full min-h-[44px] py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>حجز مسبق للسلعة</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreOrderModal && (
        <PreOrderModal
          product={product}
          isOpen={showPreOrderModal}
          onClose={() => setShowPreOrderModal(false)}
        />
      )}

      {/* Customer Reviews Section */}
      <section className="border-t border-[#E5E2DA] dark:border-[#232730] pt-10">
        <div className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">آراء وتقييمات العملاء</h2>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 mt-1 tabular-nums">
            إجمالي التقييمات المسجلة: {reviews.length}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <div className="rounded-lg p-5 sm:p-6 border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
              <h3 className="font-bold text-base mb-4 text-[#111214] dark:text-[#F4F4F2]">أضف تقييمك</h3>
              {user ? (
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5B57] dark:text-zinc-400 mb-2">التقييم</label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setNewRating(num)}
                          className="p-1 transition-transform hover:scale-110"
                          aria-label={`${num} نجوم`}
                        >
                          <Star
                            className={`w-6 h-6 transition-colors ${num <= newRating ? 'fill-amber-400 text-amber-400' : 'text-[#D5D1C7] dark:text-zinc-700'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5B57] dark:text-zinc-400 mb-1.5">التعليق</label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="اكتب تجربتك مع هذا المنتج..."
                      className="w-full border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 rounded-lg p-3.5 text-sm outline-none focus:border-[#111214] dark:focus:border-zinc-400 transition-colors h-28 resize-none text-right"
                      dir="rtl"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className={`w-full min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50`}
                  >
                    {submittingReview ? 'جاري الإرسال...' : (
                      <>
                        <span>إرسال التقييم</span>
                        <Send className="w-3.5 h-3.5 rotate-180" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-6 rounded-lg bg-[#FAF9F6] dark:bg-[#1C1F26]">
                  <p className="text-[#5C5B57] dark:text-zinc-400 text-xs font-semibold mb-3">سجل دخولك لإضافة تقييم على المنتج</p>
                  <button
                    type="button"
                    onClick={login}
                    className={`min-h-[40px] px-5 py-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')} rounded-lg font-bold text-xs transition-colors`}
                  >
                    تسجيل الدخول
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 divide-y divide-[#E5E2DA] dark:divide-[#232730] rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
            {reviews.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Star className="w-8 h-8 text-[#5C5B57] dark:text-zinc-600 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">لا توجد تقييمات حتى الآن</p>
                <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-1">شارك تجربتك إذا سبق لك شراء هذا المنتج</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400">
                        {review.userPhoto ? <img src={review.userPhoto} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-[#111214] dark:text-[#F4F4F2] text-sm">{review.userName}</h4>
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                          {new Date(review.createdAt).toLocaleDateString('ar-YE')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{review.rating}.0</span>
                    </div>
                  </div>
                  <p className="text-[#5C5B57] dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {review.comment}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
