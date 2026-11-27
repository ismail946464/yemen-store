import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Image as ImageIcon,
  Copy,
  Ticket,
  Check,
  Bot,
  Store,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import { safeCopyText } from '../lib/deviceSafe';
import {
  PromoCodeItem,
  computeCouponDiscount,
  normalizeCouponCode,
  validateCouponForCart,
} from '../lib/coupons';

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
    openAiDrawer,
  } = useAppContext();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<PromoCodeItem | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);
  const [activeCoupons, setActiveCoupons] = useState<PromoCodeItem[]>([]);

  useEffect(() => {
    if (!isCartDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCartDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCartDrawerOpen, closeCartDrawer]);

  useEffect(() => {
    if (!isCartDrawerOpen || cart.length === 0) return;
    const unsub = onSnapshot(
      query(collection(db, 'promoCodes'), where('active', '==', true), limit(15)),
      (snap) => {
        const nowMs = Date.now();
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as PromoCodeItem))
          .filter((c) => !c.expiresAt || new Date(c.expiresAt).getTime() >= nowMs)
          .filter((c) => c.maxUses === null || c.maxUses === undefined || Number(c.usedCount || 0) < Number(c.maxUses));
        setActiveCoupons(items);
      },
      () => {}
    );
    return () => unsub();
  }, [isCartDrawerOpen, cart.length]);

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('yemen_pending_coupon');
      if (pending && !couponInput) {
        setCouponInput(pending);
      }
    } catch {}
  }, [isCartDrawerOpen]);

  const { totalCount, totalSavings, distinctStoresCount, hasPickupOnly } = useMemo(() => {
    let count = 0;
    let savings = 0;
    const stores = new Set<string>();
    let pickup = false;
    for (const item of cart) {
      const q = item.quantity || 1;
      count += q;
      const p = item.product || {};
      const unit = Number(p.price || 0);
      const orig = Number(p.originalPrice || 0);
      if (orig > unit) {
        savings += (orig - unit) * q;
      }
      stores.add(p.ownerId || 'global');
      if (p.noDelivery) pickup = true;
    }
    return {
      totalCount: count,
      totalSavings: savings,
      distinctStoresCount: stores.size,
      hasPickupOnly: pickup,
    };
  }, [cart]);

  const activeCartStoreId = cart[0]?.product?.ownerId || 'global';
  const hasMultipleStores = distinctStoresCount > 1;

  const eligibleCoupons = useMemo(
    () =>
      activeCoupons.filter(
        (c) => c.storeId === 'global' || (!hasMultipleStores && c.storeId === activeCartStoreId)
      ),
    [activeCoupons, hasMultipleStores, activeCartStoreId]
  );

  const couponDiscount = useMemo(() => {
    if (!appliedCoupon || cartTotal <= 0) return 0;
    const check = validateCouponForCart({
      coupon: appliedCoupon,
      subtotal: cartTotal,
      cartStoreId: activeCartStoreId,
      hasMultipleStores,
    });
    return check.valid ? check.discountAmount : 0;
  }, [appliedCoupon, cartTotal, activeCartStoreId, hasMultipleStores]);

  const finalEstimate = Math.max(0, cartTotal - couponDiscount);

  if (!isCartDrawerOpen) return null;

  const handleTestCoupon = (raw: string) => {
    const clean = normalizeCouponCode(raw);
    if (!clean) {
      setCouponFeedback('أدخل كود الخصم أولاً');
      return;
    }
    const found = activeCoupons.find((c) => normalizeCouponCode(c.code) === clean);
    if (!found) {
      setCouponFeedback('الكود غير موجود أو منتهي الصلاحية');
      setAppliedCoupon(null);
      return;
    }
    const check = validateCouponForCart({
      coupon: found,
      subtotal: cartTotal,
      cartStoreId: activeCartStoreId,
      hasMultipleStores,
    });
    if (!check.valid) {
      setCouponFeedback(check.reason || 'غير قابل للتطبيق على هذه السلة');
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(found);
    setCouponInput(found.code);
    setCouponFeedback(null);
    try {
      sessionStorage.setItem('yemen_pending_coupon', found.code);
    } catch {}
    toast.success(`سيتم خصم ${computeCouponDiscount(found, cartTotal).toLocaleString()} ر.ي عند الدفع`);
  };

  const handleCopyCartSummary = async () => {
    if (cart.length === 0) return;
    const lines = [
      'قائمة المشتريات:',
      ...cart.map((item, idx) => {
        const p = item.product;
        const unit = Number(p?.price || 0);
        const qty = item.quantity || 1;
        const variant = p?.selectedVariantName ? ` (${p.selectedVariantName})` : '';
        return `${idx + 1}. ${p?.title || 'منتج'}${variant} × ${qty} = ${(unit * qty).toLocaleString()} ر.ي`;
      }),
      '——————————',
      `الإجمالي: ${finalEstimate.toLocaleString()} ر.ي`,
      ...(couponDiscount > 0 && appliedCoupon ? [`كوبون (${appliedCoupon.code}): -${couponDiscount.toLocaleString()} ر.ي`] : []),
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
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                <span>{totalCount > 0 ? `${totalCount} منتج` : 'السلة فارغة حالياً'}</span>
                {distinctStoresCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>من {distinctStoresCount} {distinctStoresCount === 1 ? 'متجر' : 'متاجر'}</span>
                  </>
                )}
              </div>
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

        {/* Real Savings & Store Info Strip */}
        {cart.length > 0 && (totalSavings > 0 || hasPickupOnly || hasMultipleStores) && (
          <div className="px-5 py-2.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            {totalSavings > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                <Tag className="w-3.5 h-3.5" />
                <span>وفرت في هذه السلة {totalSavings.toLocaleString()} ر.ي</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-[#5C5B57] dark:text-zinc-400">
                <Store className="w-3.5 h-3.5" />
                <span>{hasMultipleStores ? 'الطلب من عدة متاجر' : 'الطلب من متجر واحد'}</span>
              </span>
            )}
            {hasPickupOnly && (
              <span className="font-bold text-amber-700 dark:text-amber-400">
                يوجد منتج استلام من المتجر
              </span>
            )}
          </div>
        )}

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
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={closeCartDrawer}
                  className={`min-h-[40px] px-5 py-2 rounded-lg text-xs font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  متابعة التسوق
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeCartDrawer();
                    openAiDrawer('ما هي المنتجات الأكثر طلباً؟');
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] inline-flex items-center gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>اقترح لي منتجات</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {cart.map((item) => {
                const p = item.product;
                const key =
                  p?._cartKey ||
                  (p?.selectedVariantId ? `${p.id}__variant__${p.selectedVariantId}` : p?.id);
                const thumb = p?.image || p?.images?.[0];
                const unitPrice = Number(p?.price || 0);
                const origPrice = Number(p?.originalPrice || 0);
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

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
                        {p.ownerName && <span>{p.ownerName}</span>}
                        {p.selectedVariantName && (
                          <>
                            {p.ownerName && <span aria-hidden="true">·</span>}
                            <span>الصنف: {p.selectedVariantName}</span>
                          </>
                        )}
                      </div>

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

                        <div className="text-left tabular-nums">
                          {origPrice > unitPrice && (
                            <span className="block text-[10px] line-through text-[#5C5B57] dark:text-zinc-500">
                              {(origPrice * (item.quantity || 1)).toLocaleString()}
                            </span>
                          )}
                          <span className={`text-xs sm:text-sm font-extrabold ${getThemeClasses('price')}`}>
                            {lineTotal.toLocaleString()} ر.ي
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quick Coupon Preview & Consultation */}
              <div className="p-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>فحص كود الخصم قبل الدفع</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const itemNames = cart.slice(0, 3).map((i) => i.product?.title).filter(Boolean).join('، ');
                      closeCartDrawer();
                      openAiDrawer(`لدي بالسلة (${itemNames}) بإجمالي ${cartTotal.toLocaleString()} ر.ي، هل يوجد كوبون خصم مناسب أو نصيحة للشراء؟`);
                    }}
                    className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-300 hover:text-[#111214] dark:hover:text-white inline-flex items-center gap-1"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>استشارة السلة</span>
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponFeedback(null);
                    }}
                    placeholder="أدخل كود الخصم..."
                    dir="ltr"
                    className="flex-1 min-h-[36px] px-3 py-1 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-mono font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleTestCoupon(couponInput)}
                    className="min-h-[36px] px-3 py-1 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2]"
                  >
                    تحقق
                  </button>
                </div>

                {couponFeedback && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{couponFeedback}</p>
                )}

                {appliedCoupon && couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>كود {appliedCoupon.code} صالح</span>
                    </span>
                    <span>خصم -{couponDiscount.toLocaleString()} ر.ي</span>
                  </div>
                )}

                {eligibleCoupons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {eligibleCoupons.slice(0, 3).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleTestCoupon(c.code)}
                        className="px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300"
                      >
                        {c.code} (-{c.discountType === 'percent' ? `${c.discountValue}%` : `${c.discountValue} ر.ي`})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-3">
            <div className="space-y-1">
              {couponDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                  <span>تقدير خصم الكوبون</span>
                  <span>-{couponDiscount.toLocaleString()} ر.ي</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-[#5C5B57] dark:text-zinc-400">
                  {couponDiscount > 0 ? 'الصافي المبدئي' : 'الإجمالي المبدئي'}
                </span>
                <span className={`text-lg font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                  {finalEstimate.toLocaleString()} ر.ي
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (appliedCoupon?.code) {
                    try {
                      sessionStorage.setItem('yemen_pending_coupon', appliedCoupon.code);
                    } catch {}
                  }
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
