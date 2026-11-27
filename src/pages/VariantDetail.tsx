import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import {
  ShoppingCart,
  ShoppingBag,
  ArrowRight,
  Layers,
  Store,
  CheckCircle,
  Truck,
  ShieldCheck,
  MessageCircle,
  BookmarkCheck,
  PackageX,
  Plus,
  Minus,
  Image as ImageIcon,
  MapPin,
  Phone,
  ExternalLink,
  Heart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PreOrderModal from '../components/PreOrderModal';
import ProductPublisherMiniCard from '../components/ProductPublisherMiniCard';
import PriceRadarButton from '../components/PriceRadarButton';
import { ProductDetailSkeleton } from '../components/Skeletons';
import {
  ProductVariant,
  getProductVariants,
  getAvailableProductVariants,
  buildProductForVariantCart,
} from '../lib/variantUtils';
import { getStockLimit, isItemOutOfStock, calculateSafeDeposit } from '../lib/stockUtils';

export default function VariantDetail() {
  const { productId, variantId, slug } = useParams<{
    productId: string;
    variantId: string;
    slug?: string;
  }>();
  const navigate = useNavigate();
  const { addToCart, cart, getThemeClasses, user, isAdmin, login, isFavorite, toggleFavorite, recordRecentlyViewed } = useAppContext();

  const [product, setProduct] = useState<any>(null);
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showPreOrderModal, setShowPreOrderModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadVariantData() {
      if (!productId || !variantId) {
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setImgFailed(false);
      setQuantity(1);

      try {
        const snap = await getDoc(doc(db, 'products', productId));
        if (!isMounted) return;

        if (!snap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const data = snap.data();

        const fullProduct = { id: snap.id, ...data };
        const variants = getProductVariants(fullProduct);
        const foundVariant = variants.find((v) => String(v.id) === String(variantId));

        if (!foundVariant) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setProduct(fullProduct);
        setNotFound(false);
        recordRecentlyViewed(fullProduct.id);

        if (data.ownerId) {
          const storeSnap = await getDoc(doc(db, 'storeProfiles', data.ownerId));
          if (isMounted && storeSnap.exists()) {
            setStoreProfile(storeSnap.data());
          }
        }
      } catch (err) {
        console.error('VariantDetail load error:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadVariantData();
    return () => {
      isMounted = false;
    };
  }, [productId, variantId]);

  if (loading) return <ProductDetailSkeleton />;

  const allVariants = product ? getProductVariants(product) : [];
  const variant: ProductVariant | null =
    allVariants.find((v) => String(v.id) === String(variantId)) || null;
  const isPubliclyVisible = product?.status === 'active';
  const canBypassVisibility = Boolean(product && (isAdmin || (user?.uid && user.uid === product.ownerId)));

  if (notFound || !product || !variant || (!isPubliclyVisible && !canBypassVisibility)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-12" dir="rtl">
        <div className="w-16 h-16 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-300 flex items-center justify-center mb-5 border border-[#E5E2DA] dark:border-[#232730]">
          <PackageX className="w-8 h-8" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] mb-2">
          هذا الصنف غير متوفر حالياً
        </h2>
        <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
          ربما تم نفاد الكمية أو حذف الصنف من قائمة المتجر. يمكنك العودة لتصفح المتجر.
        </p>
        <Link
          to={slug ? `/s/${slug}` : '/'}
          className={`min-h-[42px] px-6 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-colors inline-flex items-center gap-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>العودة للمتجر</span>
        </Link>
      </div>
    );
  }

  // Strictly isolated variant purchase data (independent from base product price & stock)
  const variantCartItem = buildProductForVariantCart(product, variant);
  const unitPrice = Number(variant.price || 0);
  const origPrice = Number(variant.originalPrice || 0);
  const hasCrossedPrice = origPrice > unitPrice;
  const savingsAmount = hasCrossedPrice ? origPrice - unitPrice : 0;
  const discountPct = hasCrossedPrice ? Math.round((savingsAmount / origPrice) * 100) : 0;

  const stockLimit = getStockLimit(variant);
  const isOutOfStock = isItemOutOfStock(variant);
  const vCartKey = `${product.id}__variant__${variant.id}`;
  const inCartQty =
    cart.find(
      (item) =>
        (item.product?._cartKey ||
          (item.product?.selectedVariantId
            ? `${item.product.id}__variant__${item.product.selectedVariantId}`
            : item.product?.id)) === vCartKey
    )?.quantity || 0;
  const remainingAddable = stockLimit !== null ? Math.max(0, stockLimit - inCartQty) : null;
  const safeQuantity =
    remainingAddable !== null
      ? Math.max(1, Math.min(quantity, Math.max(1, remainingAddable)))
      : Math.max(1, quantity);
  const reachedCartMax = remainingAddable !== null && remainingAddable <= 0 && !isOutOfStock;

  const displayImage = variant.image || product.image || product.images?.[0] || '';
  const isStoreVerified = Boolean(
    product?.ownerVerified ||
      (storeProfile &&
        Boolean(storeProfile.verified) &&
        (!storeProfile.verifiedUntil ||
          storeProfile.verifiedUntil === '' ||
          new Date(storeProfile.verifiedUntil).getTime() >= Date.now()))
  );
  const isNoDelivery = Boolean(product?.noDelivery);
  const canPreOrder = isNoDelivery || (isStoreVerified && (product?.isPreOrderEnabled ?? true));
  const depositAmount = calculateSafeDeposit(unitPrice, product.depositAmount);
  const remainingDepositAmount = Math.max(0, unitPrice - depositAmount);
  const reservationDays = Math.max(1, Number(product.reservationDurationDays) || 3);

  const siblingVariants = getAvailableProductVariants(product).filter(
    (v) => String(v.id) !== String(variant.id)
  );
  const variantRouteBase = slug ? `/s/${slug}/variant/${product.id}` : `/variant/${product.id}`;
  const cartRoute = slug ? `/s/${slug}/cart` : '/cart';

  return (
    <div className="py-2 sm:py-4 space-y-10" dir="rtl">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#5C5B57] dark:text-zinc-400">
              <Layers className="w-4 h-4" />
              <span>قائمة خاصة بالصنف</span>
            </div>
            <button
              type="button"
              onClick={() => toggleFavorite(product.id)}
              aria-label={isFavorite(product.id) ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
              className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                isFavorite(product.id)
                  ? 'bg-rose-600 border-rose-600 text-white'
                  : 'border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-300 hover:text-rose-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite(product.id) ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {!isPubliclyVisible && canBypassVisibility && (
          <div className="mb-6 p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center justify-between gap-3 flex-wrap">
            <span>معاينة داخلية — المنتج غير منشور للعامة حالياً ولا يمكن شراء الصنف.</span>
            <Link
              to="/admin?tab=products"
              className="px-3 py-1.5 rounded-md bg-amber-900 text-white dark:bg-amber-400 dark:text-[#111214] text-[11px] font-bold hover:opacity-90 transition-opacity"
            >
              إدارة الحالة والمراجعة
            </Link>
          </div>
        )}

        {/* Dedicated Variant Purchase Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Variant Image Frame */}
          <div className="lg:col-span-6 lg:sticky lg:top-22">
            <div className="aspect-square rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] relative">
              {displayImage && !imgFailed ? (
                <img
                  src={displayImage}
                  alt={variant.name}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#5C5B57] dark:text-zinc-500">
                  <ImageIcon className="w-14 h-14 opacity-40" />
                  <span className="text-xs font-bold">{variant.name}</span>
                </div>
              )}

              {discountPct > 0 && (
                <span className="absolute top-3.5 right-3.5 bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-[11px] font-bold px-2.5 py-1 rounded-md tabular-nums">
                  وفر {discountPct}%
                </span>
              )}
            </div>
          </div>

          {/* Standalone Variant Purchase Module */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3 border-b border-[#E5E2DA] dark:border-[#232730] pb-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5C5B57] dark:text-zinc-400">
                <span>صنف مستقل</span>
                <span aria-hidden="true">·</span>
                <span className={isOutOfStock ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}>
                  {isOutOfStock ? 'نفدت الكمية' : `متوفر${stockLimit !== null ? ` (${stockLimit} وحدة)` : ''}`}
                </span>
                {product.ownerId && (
                  <>
                    <span aria-hidden="true">·</span>
                    <Link
                      to={`/store/${product.ownerId}`}
                      className="inline-flex items-center gap-1 text-[#111214] dark:text-[#F4F4F2] hover:underline"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>{product.ownerName || 'المتجر الناشر'}</span>
                      {isStoreVerified && <CheckCircle className={`w-3.5 h-3.5 ${getThemeClasses('verified')}`} />}
                    </Link>
                  </>
                )}
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight text-balance leading-snug">
                {variant.name}
              </h1>

              {product.title && (
                <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium">
                  ضمن قائمة أصناف: {product.title}
                </p>
              )}

              <ProductPublisherMiniCard
                product={product}
                storeProfile={storeProfile}
                variant="detail"
                storePathPrefix={slug ? `/s/${slug}/store` : '/store'}
              />
            </div>

            {/* Standalone Price Ledger Line */}
            <div className="flex items-baseline justify-between flex-wrap gap-2 py-4 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div>
                <span className="text-xs text-[#5C5B57] dark:text-zinc-400 block mb-0.5">
                  سعر الصنف المستقل
                </span>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-3xl font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                      {unitPrice.toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                  </div>
                  {hasCrossedPrice && (
                    <span className="text-base font-bold text-[#5C5B57] dark:text-zinc-500 line-through tabular-nums">
                      {origPrice.toLocaleString()} ر.ي
                    </span>
                  )}
                  {discountPct > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 tabular-nums">
                      وفر {discountPct}% ({savingsAmount.toLocaleString()} ر.ي)
                    </span>
                  )}
                </div>
              </div>

              {isNoDelivery ? (
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Store className="w-4 h-4" />
                  <span>لا يوجد توصيل — الاستلام من المتجر فقط</span>
                </span>
              ) : product.deliveryFee > 0 ? (
                <span className="text-xs font-semibold text-[#5C5B57] dark:text-zinc-300 flex items-center gap-1.5 tabular-nums">
                  <Truck className="w-4 h-4" />
                  <span>توصيل: {Number(product.deliveryFee).toLocaleString()} ر.ي</span>
                </span>
              ) : null}
            </div>

            {/* Standalone Quantity Stepper & Actions */}
            <div className="space-y-2.5">
              {isNoDelivery ? (
                <div className="rounded-lg p-5 border border-amber-300 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <Store className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">
                        حجز الصنف للاستلام من المتجر فقط (لا يوجد توصيل)
                      </h3>
                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                        يُحجز الصنف بدفع العربون وتحضر للمتجر للاستلام وسداد الباقي خلال المهلة
                      </p>
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
                    تنبيه: لا يتوفر توصيل لهذا الصنف. إذا لم تحضر للمتجر للاستلام خلال ({reservationDays}) أيام، يُلغى الحجز تلقائياً ويذهب العربون للمتجر.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isPubliclyVisible) {
                        toast.error('هذا المنتج قيد المراجعة ولم يُنشر للعامة بعد');
                        return;
                      }
                      if (!user) {
                        login();
                        return;
                      }
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
                            ? `حجز الصنف للاستلام من المتجر (${depositAmount.toLocaleString()} ر.ي)`
                            : 'سجل دخولك لحجز الصنف من المتجر'}
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  {!isOutOfStock && (
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
                          onClick={() =>
                            setQuantity((q) => {
                              const next = q + 1;
                              return remainingAddable !== null ? Math.min(next, remainingAddable) : next;
                            })
                          }
                          disabled={reachedCartMax || (remainingAddable !== null && safeQuantity >= remainingAddable)}
                          aria-label="زيادة الكمية"
                          className="w-9 h-9 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] transition-colors rounded-l-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                        if (!user) {
                          login();
                          return;
                        }
                        addToCart(variantCartItem, safeQuantity);
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
                              : user
                                ? 'أضف الصنف للسلة'
                                : 'سجل دخولك للشراء'}
                      </span>
                    </button>

                    {!isOutOfStock && isPubliclyVisible && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            login();
                            return;
                          }
                          if (!reachedCartMax) {
                            addToCart(variantCartItem, safeQuantity);
                          }
                          navigate(cartRoute);
                        }}
                        className={`w-full min-h-[46px] py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 text-sm ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>{reachedCartMax ? 'الانتقال للسلة وإتمام الطلب' : 'شراء الصنف الآن'}</span>
                      </button>
                    )}
                  </div>
                </>
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
                  productTitle={`${product.title} — ${variant.name}`}
                  productImage={displayImage || null}
                  storeId={product.ownerId || ''}
                  storeName={storeProfile?.name || product.ownerName || 'متجر'}
                  currentPrice={unitPrice}
                  isOutOfStock={isOutOfStock}
                />
              )}
            </div>

            {/* Variant Notes & Specs */}
            <div className="space-y-4 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">مواصفات الصنف</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#5C5B57] dark:text-zinc-300">
                  {variant.notes || 'لا توجد ملاحظات إضافية مسجلة لهذا الصنف.'}
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

            {/* Pre-Order for this standalone Variant (for delivery-enabled verified products) */}
            {canPreOrder && !isNoDelivery && (
              <div className="rounded-lg p-5 border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <BookmarkCheck className="w-5 h-5 text-[#111214] dark:text-[#F4F4F2] shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">حجز مسبق للصنف بعربون</h3>
                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">احتفظ بهذا الصنف باسمك لمدة محددة</p>
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

                <button
                  type="button"
                  onClick={() => {
                    if (!isPubliclyVisible) {
                      toast.error('هذا المنتج قيد المراجعة ولم يُنشر للعامة بعد');
                      return;
                    }
                    if (!user) {
                      login();
                      return;
                    }
                    setShowPreOrderModal(true);
                  }}
                  disabled={isOutOfStock || !isPubliclyVisible}
                  className={`w-full min-h-[44px] py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>{!isPubliclyVisible ? 'الحجز متاح بعد النشر للعامة' : isOutOfStock ? 'نفدت الكمية — الحجز غير متاح' : 'حجز مسبق للصنف'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sibling Variants Strip */}
      {siblingVariants.length > 0 && (
        <section className="border-t border-[#E5E2DA] dark:border-[#232730] pt-8 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-[#111214] dark:text-[#F4F4F2]">
              أصناف أخرى متوفرة ({siblingVariants.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {siblingVariants.map((sib) => {
              const sibImg = sib.image || product.image || product.images?.[0];
              const sibStock = getStockLimit(sib);
              return (
                <button
                  key={sib.id}
                  type="button"
                  onClick={() => navigate(`${variantRouteBase}/${sib.id}`)}
                  className="p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26] text-right flex items-center gap-3 transition-colors"
                >
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] shrink-0 flex items-center justify-center">
                    {sibImg ? (
                      <img src={sibImg} alt={sib.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-[#5C5B57] opacity-40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] line-clamp-1">
                      {sib.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className={`font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                        {Number(sib.price || 0).toLocaleString()} ر.ي
                      </span>
                      {sibStock !== null && (
                        <span className="text-[10px] font-semibold text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                          · المتاح: {sibStock}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {showPreOrderModal && (
        <PreOrderModal
          product={variantCartItem}
          isOpen={showPreOrderModal}
          onClose={() => setShowPreOrderModal(false)}
        />
      )}
    </div>
  );
}
