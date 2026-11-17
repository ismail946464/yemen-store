import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Layers, ShoppingCart, Store, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { useAppContext } from '../AppContext';
import {
  ProductVariant,
  getAvailableProductVariants,
  buildProductForVariantCart,
} from '../lib/variantUtils';
import { getStockLimit } from '../lib/stockUtils';

interface ProductVariantsModalProps {
  product: any | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToVariant?: (productId: string, variantId: string) => void;
}

export default function ProductVariantsModal({
  product,
  isOpen,
  onClose,
  onNavigateToVariant,
}: ProductVariantsModalProps) {
  const { addToCart, cart, user, login, getThemeClasses } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const availableVariants = getAvailableProductVariants(product);

  const handleOpenVariantPage = (variant: ProductVariant) => {
    onClose();
    if (onNavigateToVariant) {
      onNavigateToVariant(product.id, variant.id);
    } else {
      navigate(`/variant/${product.id}/${variant.id}`);
    }
  };

  const handleAddVariant = (e: React.MouseEvent, variant: ProductVariant) => {
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    addToCart(buildProductForVariantCart(product, variant));
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[1200] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={`أصناف ${product.title || 'المنتج'}`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[82dvh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E2DA] dark:border-[#232730] flex items-start justify-between gap-3 bg-[#FAF9F6] dark:bg-[#101216] shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getThemeClasses('bg')}`}>
              <Layers className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-base sm:text-lg font-extrabold truncate">
                  الأصناف المتاحة ({availableVariants.length})
                </h3>
              </div>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400 truncate mt-0.5">
                اضغط على أي صنف للانتقال إلى قائمته الخاصة المستقلة
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400 mt-1">
                <Store className="w-3 h-3 shrink-0" />
                <span className="truncate">أصناف من: {product.ownerName || 'نفس المتجر الناشر'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Variants List */}
        <div className="p-4 sm:p-5 overflow-y-auto divide-y divide-[#E5E2DA] dark:divide-[#232730] flex-1 min-h-0">
          {availableVariants.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Layers className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-40" />
              <p className="text-sm font-bold">لا توجد أصناف متوفرة حالياً</p>
            </div>
          ) : (
            availableVariants.map((variant) => {
              const imgUrl = variant.image || product.image || product.images?.[0];
              const hasCrossed = Number(variant.originalPrice || 0) > Number(variant.price || 0);
              const vCartKey = `${product.id}__variant__${variant.id}`;
              const inCartQty = cart.find(
                (c) => (c.product?._cartKey || (c.product?.selectedVariantId ? `${c.product.id}__variant__${c.product.selectedVariantId}` : c.product?.id)) === vCartKey
              )?.quantity || 0;
              const stockLimit = getStockLimit(variant);
              const reachedMax = stockLimit !== null && inCartQty >= stockLimit;

              return (
                <div
                  key={variant.id}
                  onClick={() => handleOpenVariantPage(variant)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenVariantPage(variant);
                    }
                  }}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF9F6] dark:hover:bg-[#101216] rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] shrink-0 flex items-center justify-center">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={variant.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#5C5B57] opacity-40" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] line-clamp-1">
                        {variant.name}
                      </h4>
                      {variant.notes && (
                        <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 line-clamp-2">
                          {variant.notes}
                        </p>
                      )}
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`text-sm font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                          {Number(variant.price).toLocaleString()} ر.ي
                        </span>
                        {hasCrossed && (
                          <span className="text-[11px] text-[#5C5B57] dark:text-zinc-500 line-through tabular-nums">
                            {Number(variant.originalPrice).toLocaleString()}
                          </span>
                        )}
                        {stockLimit !== null && (
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            · متوفر ({stockLimit})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenVariantPage(variant);
                      }}
                      title="الانتقال إلى قائمة الصنف الخاصة"
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>عرض الصنف</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleAddVariant(e, variant)}
                      disabled={reachedMax}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{reachedMax ? `أقصى كمية (${stockLimit})` : inCartQty > 0 ? `أضف (${inCartQty} بالسلة)` : 'أضف'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
