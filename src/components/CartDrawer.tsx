import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, Image as ImageIcon, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../AppContext';
import { safeCopyText } from '../lib/deviceSafe';

export default function CartDrawer() {
  const {
    isCartDrawerOpen,
    closeCartDrawer,
    cart,
    cartTotal,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    getThemeClasses,
  } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCartDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCartDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCartDrawerOpen, closeCartDrawer]);

  if (!isCartDrawerOpen) return null;

  const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const handleCopyCartSummary = async () => {
    if (cart.length === 0) return;
    const lines = [
      '🛒 قائمة المشتريات:',
      ...cart.map((item, idx) => {
        const p = item.product;
        const unit = Number(p?.price || 0);
        const qty = item.quantity || 1;
        const variant = p?.selectedVariantName ? ` (${p.selectedVariantName})` : '';
        return `${idx + 1}. ${p?.title || 'منتج'}${variant} × ${qty} = ${(unit * qty).toLocaleString()} ر.ي`;
      }),
      `——————————`,
      `الإجمالي المبدئي: ${cartTotal.toLocaleString()} ر.ي`,
    ];
    const ok = await safeCopyText(lines.join('\n'));
    if (ok) {
      toast.success('تم نسخ ملخص السلة للمشاركة');
    } else {
      toast.error('تعذر نسخ ملخص السلة');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/55 backdrop-blur-xs flex justify-end"
      dir="rtl"
      onClick={closeCartDrawer}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        aria-label="سلة المشتريات السريعة"
        className="w-full max-w-md h-full bg-white dark:bg-[#131519] border-r border-[#E5E2DA] dark:border-[#232730] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${getThemeClasses('bg')}`}>
              <ShoppingBag className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="font-display text-base font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                سلة المشتريات
              </h2>
              <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                {totalCount > 0 ? `${totalCount} منتج في السلة` : 'السلة فارغة حالياً'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCartDrawer}
            aria-label="إغلاق السلة"
            className="w-9 h-9 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] hover:text-[#111214] dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center space-y-3 py-12">
              <div className="w-14 h-14 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400">
                <ShoppingBag className="w-7 h-7 opacity-60" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">سلتك فارغة حتى الآن</p>
                <p className="text-xs text-[#5C5B57] dark:text-zinc-400 max-w-xs">
                  أضف المنتجات التي تعجبك لمراجعتها وإتمام الطلب في أي وقت.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCartDrawer}
                className={`min-h-[40px] px-5 py-2 rounded-lg text-xs font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                متابعة التسوق
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const p = item.product;
              const key =
                p?._cartKey ||
                (p?.selectedVariantId ? `${p.id}__variant__${p.selectedVariantId}` : p?.id);
              const thumb = p?.image || p?.images?.[0];
              const unitPrice = Number(p?.price || 0);
              const lineTotal = unitPrice * (item.quantity || 1);

              return (
                <div
                  key={key}
                  className="p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex gap-3 items-start"
                >
                  <Link
                    to={`/product/${p.id}`}
                    onClick={closeCartDrawer}
                    className="w-16 h-16 rounded-md overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] shrink-0 flex items-center justify-center"
                  >
                    {thumb ? (
                      <img src={thumb} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[#5C5B57] opacity-50" />
                    )}
                  </Link>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/product/${p.id}`}
                        onClick={closeCartDrawer}
                        className="text-xs sm:text-sm font-bold text-[#111214] dark:text-[#F4F4F2] line-clamp-1 hover:underline"
                      >
                        {p.title}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeFromCart(key)}
                        aria-label="إزالة المنتج"
                        className="text-[#5C5B57] hover:text-rose-600 p-1 shrink-0 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {p.selectedVariantName && (
                      <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
                        الصنف: {p.selectedVariantName}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="inline-flex items-center border border-[#E5E2DA] dark:border-[#232730] rounded-md bg-white dark:bg-[#131519]">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(key, (item.quantity || 1) - 1)}
                          className="w-7 h-7 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2]"
                          aria-label="إنقاص"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-extrabold tabular-nums text-[#111214] dark:text-[#F4F4F2]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(key, (item.quantity || 1) + 1)}
                          className="w-7 h-7 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2]"
                          aria-label="زيادة"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className={`text-xs sm:text-sm font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                        {lineTotal.toLocaleString()} ر.ي
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-[#5C5B57] dark:text-zinc-400">الإجمالي المبدئي</span>
              <span className={`text-lg font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                {cartTotal.toLocaleString()} ر.ي
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  closeCartDrawer();
                  navigate('/cart');
                }}
                className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                <span>إتمام الطلب والدفع</span>
                <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
              </button>

              <button
                type="button"
                onClick={handleCopyCartSummary}
                aria-label="نسخ ملخص السلة للمشاركة"
                title="نسخ ملخص السلة"
                className="min-h-[44px] px-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold flex items-center justify-center transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={clearCart}
                aria-label="إفراغ السلة"
                title="إفراغ السلة"
                className="min-h-[44px] px-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] hover:text-rose-600 text-xs font-bold transition-colors"
              >
                تفريغ
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
