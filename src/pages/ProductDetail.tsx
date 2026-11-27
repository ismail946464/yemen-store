import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, getDocs, limit, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import {
  ShoppingCart, ArrowRight, Share2, ShieldCheck, Truck,
  CheckCircle, Store, MessageCircle, Star, Send, User,
  Image as ImageIcon, PackageX, BookmarkCheck, ShoppingBag, Percent, Gift, Layers, ChevronDown, ChevronUp, Plus, Minus,
  MapPin, Phone, ExternalLink, Heart, Maximize2, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProductPublisherMiniCard from '../components/ProductPublisherMiniCard';
import PriceRadarButton from '../components/PriceRadarButton';
import { ProductDetailSkeleton } from '../components/Skeletons';
import { formatArabicDate, safeCopyText } from '../lib/deviceSafe';

const PreOrderModal = lazy(() => import('../components/PreOrderModal'));
const ProductVariantsModal = lazy(() => import('../components/ProductVariantsModal'));
import { isProductOfferActive, getOfferTypeLabel, getProductDiscountPercent, getProductOfferBadgeText } from '../lib/offerUtils';
import {
  getAvailableProductVariants,
  buildBaseProductForCart,
} from '../lib/variantUtils';
import { getStockLimit, isItemOutOfStock, calculateSafeDeposit } from '../lib/stockUtils';

export default function ProductDetail() {
  const { productId, slug } = useParams<{ productId: string; slug?: string }>();
  const [searchParams] = useSearchParams();
  const initialVariantId = searchParams.get('variant');
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState<string>('');
  const [imgFailed, setImgFailed] = useState(false);

  const { addToCart, cart, getThemeClasses, user, isAdmin, login, isFavorite, toggleFavorite, recordRecentlyViewed } = useAppContext();
  const navigate = useNavigate();
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showPreOrderModal, setShowPreOrderModal] = useState(false);
  const [showVariantsDrawer, setShowVariantsDrawer] = useState(false);
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    if (productId && initialVariantId) {
      const target = slug
        ? `/s/${slug}/variant/${productId}/${initialVariantId}`
        : `/variant/${productId}/${initialVariantId}`;
      navigate(target, { replace: true });
    }
  }, [productId, initialVariantId, slug, navigate]);

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
          recordRecentlyViewed(docSnap.id);

          if (data.ownerId) {
            const storeSnap = await getDoc(doc(db, 'storeProfiles', data.ownerId));
            if (isMounted && storeSnap.exists()) {
              setStoreProfile(storeSnap.data());
            }
          }

          // Fetch up to 4 related active products from same category (fallback to same store)
          try {
            const relItems: any[] = [];
            const seenIds = new Set<string>([docSnap.id]);
            if (data.category) {
              const catSnap = await getDocs(
                query(
                  collection(db, 'products'),
                  where('status', '==', 'active'),
                  where('category', '==', data.category),
                  limit(8)
                )
              );
              catSnap.docs.forEach((d) => {
                if (!seenIds.has(d.id) && relItems.length < 4) {
                  seenIds.add(d.id);
                  relItems.push({ id: d.id, ...d.data() });
                }
              });
            }
            if (relItems.length < 4 && data.ownerId) {
              const storeProdSnap = await getDocs(
                query(
                  collection(db, 'products'),
                  where('status', '==', 'active'),
                  where('ownerId', '==', data.ownerId),
                  limit(8)
                )
              );
              storeProdSnap.docs.forEach((d) => {
                if (!seenIds.has(d.id) && relItems.length < 4) {
                  seenIds.add(d.id);
                  relItems.push({ id: d.id, ...d.data() });
                }
              });
            }
            if (isMounted) setRelatedProducts(relItems);
          } catch {}
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
      const ok = await safeCopyText(window.location.href);
      if (ok) toast.success('تم نسخ رابط المنتج');
      else toast.error('تعذر نسخ الرابط تلقائياً');
    }
  };

  if (loading) return <ProductDetailSkeleton />;

  const isPubliclyVisible = product?.status === 'active';
  const canBypassVisibility = Boolean(product && (isAdmin || (user?.uid && user.uid === product.ownerId)));

  if (notFound || !product || (!isPubliclyVisible && !canBypassVisibility)) {
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

  const availableVariants = getAvailableProductVariants(product);
  const baseProductForPurchase = buildBaseProductForCart(product);
  const effectivePrice = Number(product?.price || 0);
  const effectiveOriginalPrice = Number(product?.originalPrice || 0);
  const effectiveStockLimit = getStockLimit(product);
  const activeCartKey = product.id;
  const inCartQty = cart.find(
    (item) => (item.product?._cartKey || (item.product?.selectedVariantId ? `${item.product.id}__variant__${item.product.selectedVariantId}` : item.product?.id)) === activeCartKey
  )?.quantity || 0;
  const remainingAddable = effectiveStockLimit !== null ? Math.max(0, effectiveStockLimit - inCartQty) : null;
  const safeQuantity = remainingAddable !== null
    ? Math.max(1, Math.min(quantity, Math.max(1, remainingAddable)))
    : Math.max(1, quantity);

  const isStoreVerified = Boolean(
    product?.ownerVerified ||
    (storeProfile && Boolean(storeProfile.verified) && (!storeProfile.verifiedUntil || storeProfile.verifiedUntil === '' || new Date(storeProfile.verifiedUntil).getTime() >= Date.now()))
  );
  const isNoDelivery = Boolean(product?.noDelivery);
  const canPreOrder = isNoDelivery || (isStoreVerified && (product?.isPreOrderEnabled ?? true));
  const isOutOfStock = isItemOutOfStock(product);
  const reachedCartMax = remainingAddable !== null && remainingAddable <= 0 && !isOutOfStock;
  const depositAmount = calculateSafeDeposit(effectivePrice, product.depositAmount);
  const remainingDepositAmount = Math.max(0, effectivePrice - depositAmount);
  const reservationDays = Math.max(1, Number(product.reservationDurationDays) || 3);
  const hasOfferActive = isProductOfferActive(product);
  const offerDiscountPct = effectiveOriginalPrice > effectivePrice
    ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
    : getProductDiscountPercent(product);
  const hasCrossedPrice = effectiveOriginalPrice > effectivePrice;
  const savingsAmount = hasCrossedPrice ? effectiveOriginalPrice - effectivePrice : 0;
  const offerBadge = hasOfferActive ? getProductOfferBadgeText(product) : '';
  const variantRouteBase = slug ? `/s/${slug}/variant/${product.id}` : `/variant/${product.id}`;

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

        {!isPubliclyVisible && canBypassVisibility && (
          <div className="mb-6 p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center justify-between gap-3 flex-wrap">
            <span>معاينة داخلية — هذا المنتج غير منشور للعامة حالياً (قائمة الانتظار / بانتظار المراجعة) ولا يمكن شراؤه.</span>
            <Link
              to="/admin?tab=products"
              className="px-3 py-1.5 rounded-md bg-amber-900 text-white dark:bg-amber-400 dark:text-[#111214] text-[11px] font-bold hover:opacity-90 transition-opacity"
            >
              إدارة الحالة والمراجعة
            </Link>
          </div>
        )}

        {/* Contiguous Two-Column Purchase Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Media Gallery */}
          <div className="lg:col-span-6 space-y-3 lg:sticky lg:top-22">
            <div
              onClick={() => activeImage && !imgFailed && setIsLightboxOpen(true)}
              className={`aspect-square rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] relative group ${activeImage && !imgFailed ? 'cursor-zoom-in' : ''}`}
            >
              {activeImage && !imgFailed ? (
                <img
                  src={activeImage}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Store className="w-16 h-16 text-[#5C5B57] dark:text-zinc-600 opacity-40" />
                </div>
              )}

              {activeImage && !imgFailed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLightboxOpen(true);
                  }}
                  aria-label="تكبير الصورة"
                  className="absolute bottom-3 left-3 w-9 h-9 rounded-lg bg-white/90 dark:bg-[#131519]/90 border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] flex items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}

              {offerBadge ? (
                <span className="absolute top-3.5 right-3.5 bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-[11px] font-bold px-2.5 py-1 rounded-md">
                  {offerBadge}
                </span>
              ) : product.category === 'local' && (
                <span className="absolute top-3.5 right-3.5 bg-[#111214]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                  منتج محلي
                </span>
              )}

              <div className="absolute top-3.5 left-3.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => toggleFavorite(product.id)}
                  aria-label={isFavorite(product.id) ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                    isFavorite(product.id)
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-white/95 dark:bg-[#131519]/95 text-[#111214] dark:text-[#F4F4F2] border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isFavorite(product.id) ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="مشاركة المنتج"
                  className="w-10 h-10 flex items-center justify-center bg-white/95 dark:bg-[#131519]/95 text-[#111214] dark:text-[#F4F4F2] rounded-lg border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
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
                  {isOutOfStock ? 'نفدت الكمية' : `متوفر${effectiveStockLimit !== null ? ` (${effectiveStockLimit} وحدة)` : ''}`}
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
                {Number(product.ratingCount) > 0 && Number(product.averageRating) > 0 ? (
                  <>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {Number(product.averageRating).toFixed(1)}
                      </span>
                    </div>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{product.ratingCount} تقييم</span>
                  </>
                ) : (
                  <div className="flex items-center gap-1 text-[#5C5B57] dark:text-zinc-400">
                    <Star className="w-4 h-4" />
                    <span className="font-semibold">بدون تقييمات بعد</span>
                  </div>
                )}
              </div>

              <ProductPublisherMiniCard
                product={product}
                storeProfile={storeProfile}
                variant="detail"
                storePathPrefix={slug ? `/s/${slug}/store` : '/store'}
              />
            </div>

            {/* Price Ledger Line */}
            <div className="flex items-baseline justify-between flex-wrap gap-2 py-4 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div>
                <span className="text-xs text-[#5C5B57] dark:text-zinc-400 block mb-0.5">
                  {hasCrossedPrice ? 'السعر بعد الخصم' : 'السعر'}
                </span>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-3xl font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                      {effectivePrice.toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                  </div>
                  {hasCrossedPrice && (
                    <span className="text-base font-bold text-[#5C5B57] dark:text-zinc-500 line-through tabular-nums">
                      {effectiveOriginalPrice.toLocaleString()} ر.ي
                    </span>
                  )}
                  {offerDiscountPct > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 tabular-nums">
                      وفر {offerDiscountPct}% ({savingsAmount.toLocaleString()} ر.ي)
                    </span>
                  )}
                </div>
              </div>
              {isNoDelivery ? (
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Store className="w-4 h-4" />
                  <span>لا يوجد توصيل — الاستلام من المتجر فقط</span>
                </span>
              ) : hasOfferActive && product.offerType === 'free_delivery' ? (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  توصيل مجاني ضمن العرض
                </span>
              ) : product.deliveryFee > 0 ? (
                <span className="text-xs font-semibold text-[#5C5B57] dark:text-zinc-300 flex items-center gap-1.5 tabular-nums">
                  <Truck className="w-4 h-4" />
                  توصيل: {Number(product.deliveryFee).toLocaleString()} ر.ي
                </span>
              ) : null}
            </div>

            {/* Independent Variants Directory Shortcut (أصناف مستقلة) */}
            {availableVariants.length > 0 && (
              <div className="p-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowVariantsDrawer((v) => !v)}
                    className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] hover:opacity-80 transition-opacity"
                  >
                    <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${getThemeClasses('bg')}`}>
                      <Layers className="w-4 h-4" />
                    </span>
                    <div className="text-right">
                      <span className="block">أصناف مستقلة متوفرة ({availableVariants.length})</span>
                      <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 block">
                        اضغط على أي صنف للانتقال إلى قائمته الخاصة دون التأثير على هذا المنتج
                      </span>
                    </div>
                    {showVariantsDrawer ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowVariantsModal(true)}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>أصناف ({availableVariants.length})</span>
                  </button>
                </div>

                {showVariantsDrawer && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                    {availableVariants.map((variant) => {
                      const vImg = variant.image || product.image || product.images?.[0];
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => navigate(`${variantRouteBase}/${variant.id}`)}
                          className="p-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26] text-right flex items-center gap-2.5 transition-colors"
                        >
                          <div className="w-11 h-11 rounded-md overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] shrink-0 flex items-center justify-center">
                            {vImg ? (
                              <img src={vImg} alt={variant.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-[#5C5B57] opacity-40" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2] line-clamp-1">
                              {variant.name}
                            </p>
                            {variant.notes && (
                              <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400 line-clamp-1">
                                {variant.notes}
                              </p>
                            )}
                            <p className={`text-xs font-extrabold tabular-nums mt-0.5 ${getThemeClasses('price')}`}>
                              {Number(variant.price).toLocaleString()} ر.ي
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Active Offer & Add-ons Ledger */}
            {hasOfferActive && (
              <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {product.offerType === 'bonus' ? <Gift className="w-4 h-4 shrink-0" /> : <Percent className="w-4 h-4 shrink-0" />}
                    <span>{getOfferTypeLabel(product.offerType)}</span>
                    {product.offerTitle && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{product.offerTitle}</span>
                      </>
                    )}
                  </div>
                  {product.offerExpiresAt && (
                    <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                      ساري حتى {formatArabicDate(product.offerExpiresAt)}
                    </span>
                  )}
                </div>
                {product.offerExtras && (
                  <p className="text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] font-medium leading-relaxed">
                    الإضافات المشمولة: {product.offerExtras}
                  </p>
                )}
              </div>
            )}

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
              ) : isNoDelivery ? (
                <div className="rounded-lg p-5 border border-amber-300 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 space-y-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <Store className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">
                          حجز للاستلام من المتجر فقط (لا يوجد توصيل)
                        </h3>
                        <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                          يُحجز المنتج بدفع العربون وتحضر للمتجر للاستلام ودفع الباقي خلال المهلة
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 text-center py-3 border-y border-amber-200 dark:border-amber-800/50 bg-white/70 dark:bg-[#131519]/70 rounded-md">
                    <div className="border-e border-amber-200 dark:border-amber-800/50 px-2">
                      <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">قيمة العربون</span>
                      <span className="text-sm sm:text-base font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                        {depositAmount.toLocaleString()} ر.ي
                      </span>
                    </div>
                    <div className="border-e border-amber-200 dark:border-amber-800/50 px-2">
                      <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">الباقي بالمتجر</span>
                      <span className="text-sm sm:text-base font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {remainingDepositAmount.toLocaleString()} ر.ي
                      </span>
                    </div>
                    <div className="px-2">
                      <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">مدة الحضور</span>
                      <span className="text-sm sm:text-base font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {reservationDays} أيام
                      </span>
                    </div>
                  </div>

                  {(storeProfile?.address || storeProfile?.city || storeProfile?.whatsapp || storeProfile?.phone || storeProfile?.googleMapsUrl || storeProfile?.location || storeProfile?.coordinates) && (
                    <div className="p-3 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#111214] dark:text-zinc-200">
                        {(storeProfile?.address || storeProfile?.city) && (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                            <span>{[storeProfile?.city, storeProfile?.address].filter(Boolean).join(' — ')}</span>
                          </span>
                        )}
                        {(storeProfile?.whatsapp || storeProfile?.phone) && (
                          <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums" dir="ltr">
                            <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{storeProfile.whatsapp || storeProfile.phone}</span>
                          </span>
                        )}
                      </div>
                      {(storeProfile?.googleMapsUrl || storeProfile?.location || storeProfile?.coordinates) && (
                        <a
                          href={
                            storeProfile.googleMapsUrl ||
                            `https://www.google.com/maps?q=${(storeProfile.location || storeProfile.coordinates).lat},${(storeProfile.location || storeProfile.coordinates).lng}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-sky-700 dark:text-sky-300 hover:underline"
                        >
                          <span>موقع المتجر بالخريطة</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed font-semibold">
                    تنبيه: لا يتوفر توصيل لهذا المنتج. إذا لم تحضر للمتجر لاستلامه خلال ({reservationDays}) أيام، يُلغى الحجز تلقائياً ويذهب العربون للمتجر.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isPubliclyVisible) {
                        toast.error('هذا المنتج قيد المراجعة ولم يُنشر للعامة بعد');
                        return;
                      }
                      if (!user) { login(); return; }
                      setShowPreOrderModal(true);
                    }}
                    disabled={isOutOfStock || !isPubliclyVisible}
                    className={`w-full min-h-[48px] py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>
                      {!isPubliclyVisible
                        ? 'الحجز متاح بعد النشر للعامة'
                        : isOutOfStock
                          ? 'نفدت الكمية — الحجز غير متاح'
                          : user
                            ? `حجز للاستلام من المتجر الآن (${depositAmount.toLocaleString()} ر.ي)`
                            : 'سجل دخولك لحجز المنتج من المتجر'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {!isOutOfStock && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
                        <div className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                          <span>الكمية المطلوبة</span>
                          {inCartQty > 0 && (
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mr-2 tabular-nums">
                              (بالسلة: {inCartQty})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26]">
                          <button
                            type="button"
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            disabled={safeQuantity <= 1 || reachedCartMax}
                            aria-label="إنقاص الكمية"
                            className="w-9 h-9 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] transition-colors rounded-r-lg disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-10 text-center text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                            {reachedCartMax ? 0 : safeQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuantity((q) => {
                              const next = q + 1;
                              return remainingAddable !== null ? Math.min(next, remainingAddable) : next;
                            })}
                            disabled={reachedCartMax || (remainingAddable !== null && safeQuantity >= remainingAddable)}
                            aria-label="زيادة الكمية"
                            className="w-9 h-9 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] transition-colors rounded-l-lg disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {!reachedCartMax && safeQuantity > 1 && (
                        <div className="px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#5C5B57] dark:text-zinc-400">
                            الإجمالي لـ <span className="tabular-nums text-[#111214] dark:text-[#F4F4F2]">{safeQuantity}</span> قطع:
                          </span>
                          <div className="flex items-center gap-2.5 tabular-nums">
                            {savingsAmount > 0 && (
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                توفير {(savingsAmount * safeQuantity).toLocaleString()} ر.ي
                              </span>
                            )}
                            <span className={`font-extrabold ${getThemeClasses('price')}`}>
                              {(effectivePrice * safeQuantity).toLocaleString()} ر.ي
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPubliclyVisible) {
                          toast.error('هذا المنتج قيد المراجعة ولم يُنشر للعامة بعد');
                          return;
                        }
                        if (!user) { login(); return; }
                        addToCart(baseProductForPurchase, safeQuantity);
                      }}
                      disabled={isOutOfStock || reachedCartMax || !isPubliclyVisible}
                      className="w-full min-h-[46px] border border-[#111214] dark:border-[#F4F4F2] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>
                        {!isPubliclyVisible
                          ? 'غير منشور للعامة بعد'
                          : isOutOfStock
                            ? 'نفدت الكمية'
                            : reachedCartMax
                              ? 'أضفت كامل المتاح للسلة'
                              : (user ? 'أضف للسلة' : 'سجل دخولك للشراء')}
                      </span>
                    </button>

                    {!isOutOfStock && isPubliclyVisible && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) { login(); return; }
                          if (!reachedCartMax) {
                            addToCart(baseProductForPurchase, safeQuantity);
                          }
                          navigate(slug ? `/s/${slug}/cart` : '/cart');
                        }}
                        className={`w-full min-h-[46px] py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 text-sm ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>{reachedCartMax ? 'الانتقال للسلة وإتمام الطلب' : 'شراء وإتمام الآن'}</span>
                      </button>
                    )}
                  </div>
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

              {isPubliclyVisible && (
                <PriceRadarButton
                  productId={product.id}
                  productTitle={product.title}
                  productImage={product.images?.[0] || product.image || null}
                  storeId={product.ownerId || ''}
                  storeName={storeProfile?.name || product.ownerName || 'متجر'}
                  currentPrice={effectivePrice}
                  isOutOfStock={isOutOfStock}
                />
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
                  {isNoDelivery ? (
                    <Store className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <Truck className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                  )}
                  <div>
                    <span className="block font-bold text-[#111214] dark:text-[#F4F4F2] text-xs">
                      {isNoDelivery ? 'حجز واستلام من المتجر' : 'توصيل مباشر'}
                    </span>
                    <span className="text-[#5C5B57] dark:text-zinc-400 text-[11px]">
                      {isNoDelivery ? 'المدة محددة بالعربون' : 'استلام حتى بابك'}
                    </span>
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

            {/* Pre-Order Ledger (for delivery-enabled verified products) */}
            {canPreOrder && !isNoDelivery && (
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
                    if (!isPubliclyVisible) {
                      toast.error('هذا المنتج قيد المراجعة ولم يُنشر للعامة بعد');
                      return;
                    }
                    if (!user) { login(); return; }
                    setShowPreOrderModal(true);
                  }}
                  disabled={isOutOfStock || !isPubliclyVisible}
                  className={`w-full min-h-[44px] py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>{!isPubliclyVisible ? 'الحجز متاح بعد النشر للعامة' : isOutOfStock ? 'نفدت الكمية — الحجز غير متاح' : 'حجز مسبق للسلعة'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreOrderModal && (
        <Suspense fallback={null}>
          <PreOrderModal
            product={baseProductForPurchase}
            isOpen={showPreOrderModal}
            onClose={() => setShowPreOrderModal(false)}
          />
        </Suspense>
      )}

      {showVariantsModal && (
        <Suspense fallback={null}>
          <ProductVariantsModal
            product={product}
            isOpen={showVariantsModal}
            onClose={() => setShowVariantsModal(false)}
            onNavigateToVariant={(pid, vid) => {
              const target = slug ? `/s/${slug}/variant/${pid}/${vid}` : `/variant/${pid}/${vid}`;
              navigate(target);
            }}
          />
        </Suspense>
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
                          {formatArabicDate(review.createdAt)}
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

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <section className="border-t border-[#E5E2DA] dark:border-[#232730] pt-10 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                منتجات مشابهة قد تعجبك
              </h2>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-0.5">
                مختارات مقترحة من نفس القسم أو المتجر
              </p>
            </div>
            <Link
              to="/"
              className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition-colors"
            >
              تصفح المزيد
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
            {relatedProducts.map((item) => {
              const thumb = item.image || item.images?.[0];
              const relTarget = slug ? `/s/${slug}/product/${item.id}` : `/product/${item.id}`;
              return (
                <Link
                  key={item.id}
                  to={relTarget}
                  className="group rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-3 hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col gap-2.5"
                >
                  <div className="aspect-[4/5] rounded-lg overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA]/60 dark:border-[#232730]">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5C5B57]">
                        <ImageIcon className="w-7 h-7 opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {item.ownerName && (
                      <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 truncate">
                        {item.ownerName}
                      </p>
                    )}
                    <h3 className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] line-clamp-2 leading-snug">
                      {item.title}
                    </h3>
                    <p className={`text-xs sm:text-sm font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                      {Number(item.price || 0).toLocaleString()} ر.ي
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {isLightboxOpen && activeImage && !imgFailed && (
        <div
          className="fixed inset-0 z-[200] bg-black/92 backdrop-blur-sm flex flex-col items-center justify-between p-4 sm:p-6"
          onClick={() => setIsLightboxOpen(false)}
          dir="rtl"
        >
          <div className="w-full max-w-5xl flex items-center justify-between text-white">
            <span className="text-xs sm:text-sm font-bold truncate max-w-[70%]">{product.title}</span>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              aria-label="إغلاق المعرض"
              className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeImage}
              alt={product.title}
              referrerPolicy="no-referrer"
              className="max-h-[72vh] max-w-full object-contain rounded-lg"
            />
            {Array.isArray(product.images) && product.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const idx = product.images.indexOf(activeImage);
                    const prev = (idx - 1 + product.images.length) % product.images.length;
                    setActiveImage(product.images[prev]);
                  }}
                  aria-label="الصورة السابقة"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idx = product.images.indexOf(activeImage);
                    const next = (idx + 1) % product.images.length;
                    setActiveImage(product.images[next]);
                  }}
                  aria-label="الصورة التالية"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {Array.isArray(product.images) && product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-full pb-1" onClick={(e) => e.stopPropagation()}>
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`w-14 h-14 rounded-md overflow-hidden border-2 shrink-0 transition-opacity ${
                    activeImage === img ? 'border-white opacity-100' : 'border-white/25 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
