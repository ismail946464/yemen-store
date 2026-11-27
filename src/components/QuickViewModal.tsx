import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  ShoppingCart,
  Heart,
  CheckCircle,
  Store,
  Plus,
  Minus,
  ExternalLink,
  Layers,
  BookmarkCheck,
  Image as ImageIcon,
  Bot,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import { buildBaseProductForCart, getAvailableProductVariants } from '../lib/variantUtils';
import { getStockLimit, isItemOutOfStock } from '../lib/stockUtils';
import { isProductOfferActive, getProductOfferBadgeText } from '../lib/offerUtils';

interface QuickViewModalProps {
  product: any | null;
  storeProfile?: any | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenVariants?: (product: any) => void;
  onOpenPreOrder?: (product: any) => void;
}

export default function QuickViewModal({
  product,
  storeProfile,
  isOpen,
  onClose,
  onOpenVariants,
  onOpenPreOrder,
}: QuickViewModalProps) {
  const {
    user,
    login,
    addToCart,
    cart,
    getThemeClasses,
    isFavorite,
    toggleFavorite,
    recordRecentlyViewed,
    openAiDrawer,
  } = useAppContext();

  const [fullProduct, setFullProduct] = useState<any | null>(product);
  const [activeImage, setActiveImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen || !product?.id) return;
    setFullProduct(product);
    setActiveImage(product.image || product.images?.[0] || '');
    setQuantity(1);
    recordRecentlyViewed(product.id);

    let cancelled = false;
    getDoc(doc(db, 'products', product.id))
      .then((snap) => {
        if (!cancelled && snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as any;
          setFullProduct(data);
          setActiveImage(data.images?.[0] || data.image || product.image || '');
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, product?.id]);

  if (!isOpen || !fullProduct) return null;

  const images: string[] = Array.isArray(fullProduct.images) && fullProduct.images.length > 0
    ? fullProduct.images
    : fullProduct.image
      ? [fullProduct.image]
      : [];
  const price = Number(fullProduct.price || 0);
  const originalPrice = Number(fullProduct.originalPrice || 0);
  const hasCrossedPrice = originalPrice > price;
  const offerBadge = isProductOfferActive(fullProduct) ? getProductOfferBadgeText(fullProduct) : '';
  const availableVariants = getAvailableProductVariants(fullProduct);
  const isNoDelivery = Boolean(fullProduct.noDelivery);
  const isVerified = Boolean(fullProduct.ownerVerified || storeProfile?.isVerified);
  const canPreOrder = isNoDelivery || (isVerified && (fullProduct.isPreOrderEnabled ?? true));

  const stockLimit = getStockLimit(fullProduct);
  const outOfStock = isItemOutOfStock(fullProduct);
  const inCartQty =
    cart.find(
      (item) =>
        (item.product?._cartKey ||
          (item.product?.selectedVariantId
            ? `${item.product.id}__variant__${item.product.selectedVariantId}`
            : item.product?.id)) === fullProduct.id
    )?.quantity || 0;
  const remainingAddable = stockLimit !== null ? Math.max(0, stockLimit - inCartQty) : null;
  const safeQuantity =
    remainingAddable !== null
      ? Math.max(1, Math.min(quantity, Math.max(1, remainingAddable)))
      : Math.max(1, quantity);
  const reachedMax = remainingAddable !== null && remainingAddable <= 0 && !outOfStock;
  const fav = isFavorite(fullProduct.id);

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      dir="rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] shadow-2xl"
      >
        <div className="sticky top-0 z-10 px-5 py-3.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-white/95 dark:bg-[#131519]/95 backdrop-blur-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#5C5B57] dark:text-zinc-400 truncate">
            <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">معاينة سريعة</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{fullProduct.category || 'منتج'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => toggleFavorite(fullProduct.id)}
              aria-label={fav ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                fav
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 hover:text-rose-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="w-9 h-9 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Media */}
          <div className="md:col-span-5 space-y-2.5">
            <div className="aspect-square rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] relative">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={fullProduct.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5C5B57] dark:text-zinc-500">
                  <ImageIcon className="w-10 h-10 opacity-40" />
                </div>
              )}
              {offerBadge && (
                <span className="absolute top-2.5 right-2.5 bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {offerBadge}
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {images.slice(0, 6).map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`w-14 h-14 rounded-md overflow-hidden border-2 shrink-0 transition-opacity ${
                      activeImage === img
                        ? `${getThemeClasses('border')} opacity-100`
                        : 'border-[#E5E2DA] dark:border-[#232730] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info & Actions */}
          <div className="md:col-span-7 space-y-4">
            <div className="space-y-1.5">
              {fullProduct.ownerName && (
                <Link
                  to={`/store/${fullProduct.ownerId}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C5B57] dark:text-zinc-300 hover:underline"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>{fullProduct.ownerName}</span>
                  {isVerified && <CheckCircle className={`w-3.5 h-3.5 ${getThemeClasses('verified')}`} />}
                </Link>
              )}

              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] leading-snug text-balance">
                {fullProduct.title}
              </h2>

              <div className="flex items-baseline gap-2.5 pt-1">
                <span className={`text-2xl font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                  {price.toLocaleString()} <span className="text-xs font-semibold text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                </span>
                {hasCrossedPrice && (
                  <span className="text-sm text-[#5C5B57] dark:text-zinc-500 line-through tabular-nums">
                    {originalPrice.toLocaleString()} ر.ي
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-300 leading-relaxed line-clamp-4">
              {fullProduct.description || 'لا توجد تفاصيل إضافية لهذا المنتج.'}
            </p>

            {/* Stock & Quantity */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
              <span className={`text-xs font-bold ${outOfStock ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {outOfStock
                  ? 'نفدت الكمية'
                  : stockLimit !== null
                    ? `متوفر (${stockLimit} وحدة)`
                    : 'متوفر بالمخزون'}
              </span>

              {!outOfStock && !isNoDelivery && (
                <div className="inline-flex items-center border border-[#E5E2DA] dark:border-[#232730] rounded-lg bg-[#FAF9F6] dark:bg-[#101216]">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2]"
                    aria-label="إنقاص الكمية"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-9 text-center text-xs font-extrabold tabular-nums text-[#111214] dark:text-[#F4F4F2]">
                    {safeQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) =>
                        remainingAddable !== null ? Math.min(remainingAddable, q + 1) : q + 1
                      )
                    }
                    className="w-9 h-9 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2]"
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {isNoDelivery ? (
                  <button
                    type="button"
                    disabled={outOfStock}
                    onClick={() => {
                      if (!user) {
                        login();
                        return;
                      }
                      onClose();
                      onOpenPreOrder?.(fullProduct);
                    }}
                    className="min-h-[44px] px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>حجز واستلام من المتجر</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={outOfStock || reachedMax}
                    onClick={() => {
                      if (!user) {
                        login();
                        return;
                      }
                      addToCart(buildBaseProductForCart(fullProduct), safeQuantity);
                      onClose();
                    }}
                    className={`min-h-[44px] px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>{outOfStock ? 'نفدت الكمية' : reachedMax ? 'بلغت الحد الأقصى' : user ? 'إضافة للسلة' : 'سجل دخولك للشراء'}</span>
                  </button>
                )}

                <Link
                  to={`/product/${fullProduct.id}`}
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>صفحة المنتج الكاملة</span>
                </Link>
              </div>

              {availableVariants.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVariants?.(fullProduct);
                  }}
                  className="w-full min-h-[40px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    <span>تصفح الأصناف المتوفرة</span>
                  </span>
                  <span className="tabular-nums text-[#5C5B57] dark:text-zinc-400">
                    {availableVariants.length} أصناف
                  </span>
                </button>
              )}

              {canPreOrder && !isNoDelivery && !outOfStock && onOpenPreOrder && (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      login();
                      return;
                    }
                    onClose();
                    onOpenPreOrder(fullProduct);
                  }}
                  className="w-full min-h-[40px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center justify-center gap-2"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>حجز مسبق بالعربون</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  openAiDrawer(`ما رأيك ومواصفات وتوصيل منتج: ${fullProduct.title}`);
                }}
                className="w-full min-h-[40px] px-4 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/45 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-center gap-2"
              >
                <Bot className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>اسأل المستشار الذكي عن هذا المنتج</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
