import React, { useEffect, useState } from 'react';
import {
  Ticket,
  Plus,
  Copy,
  Trash2,
  Power,
  Sparkles,
  Check,
  Percent,
  Banknote,
  Calendar,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import {
  CouponDiscountType,
  PromoCodeItem,
  createPromoCode,
  deletePromoCode,
  generateRandomCouponCode,
  normalizeCouponCode,
  togglePromoCodeActive,
} from '../lib/coupons';
import { formatArabicDate, safeCopyText } from '../lib/deviceSafe';

export default function CouponManager({
  storeId,
  storeName,
  isMasterView = false,
}: {
  storeId: string;
  storeName: string;
  isMasterView?: boolean;
}) {
  const { getThemeClasses } = useAppContext();
  const [coupons, setCoupons] = useState<PromoCodeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [discountType, setDiscountType] = useState<CouponDiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [scopeGlobal, setScopeGlobal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const q = isMasterView
      ? query(collection(db, 'promoCodes'))
      : query(collection(db, 'promoCodes'), where('storeId', '==', storeId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as PromoCodeItem))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setCoupons(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [storeId, isMasterView]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetStoreId = isMasterView && scopeGlobal ? 'global' : storeId;
    const targetStoreName = targetStoreId === 'global' ? 'جميع متاجر المنصة' : storeName;

    setSaving(true);
    try {
      await createPromoCode({
        code,
        title,
        discountType,
        discountValue: Number(discountValue || 0),
        minOrderAmount: Number(minOrderAmount || 0),
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        storeId: targetStoreId,
        storeName: targetStoreName,
      });
      toast.success('تم إنشاء كوبون الخصم بنجاح');
      setCode('');
      setTitle('');
      setMaxDiscountAmount('');
      setMaxUses('');
      setExpiresAt('');
    } catch (err: any) {
      toast.error(err?.message || 'تعذر إنشاء الكوبون');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (item: PromoCodeItem) => {
    const ok = await safeCopyText(item.code);
    if (ok) {
      setCopiedId(item.id);
      toast.success(`تم نسخ الكود: ${item.code}`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Create New Coupon Form */}
      <form
        onSubmit={handleCreate}
        className="p-5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getThemeClasses('bg')}`}>
              <Ticket className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                إنشاء كود خصم جديد
              </h3>
              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                يُطبق تلقائياً في سلة المشتريات ويُظهر للعملاء كقسيمة متاحة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCode(generateRandomCouponCode(isMasterView && scopeGlobal ? 'ALL' : 'SAVE'))}
            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>توليد كود تلقائي</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
              كود الخصم (إنجليزي وأرقام) *
            </label>
            <input
              type="text"
              required
              dir="ltr"
              value={code}
              onChange={(e) => setCode(normalizeCouponCode(e.target.value))}
              placeholder="مثال: YEMEN20"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-mono font-extrabold text-[#111214] dark:text-[#F4F4F2] uppercase outline-none focus:border-[#111214] dark:focus:border-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
              عنوان العرض (يظهر للمشتري)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: خصم نهاية الأسبوع"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
              نوع الخصم
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`min-h-[42px] px-2.5 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  discountType === 'percent'
                    ? `${getThemeClasses('bg')} border-transparent`
                    : 'bg-[#FAF9F6] dark:bg-[#101216] border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>نسبة %</span>
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`min-h-[42px] px-2.5 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  discountType === 'fixed'
                    ? `${getThemeClasses('bg')} border-transparent`
                    : 'bg-[#FAF9F6] dark:bg-[#101216] border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>مبلغ ثابت</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
              {discountType === 'percent' ? 'نسبة الخصم (%) *' : 'قيمة الخصم (ر.ي) *'}
            </label>
            <input
              type="number"
              required
              min="1"
              max={discountType === 'percent' ? 100 : undefined}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
              الحد الأدنى للطلب (ر.ي)
            </label>
            <input
              type="number"
              min="0"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              placeholder="0 (بدون حد أدنى)"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums outline-none"
            />
          </div>

          {discountType === 'percent' ? (
            <div>
              <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                سقف الخصم الأقصى (ر.ي — اختياري)
              </label>
              <input
                type="number"
                min="0"
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="مثال: 5000"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                الحد الأقصى للاستخدام (اختياري)
              </label>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="مثال: 50 مرة"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums outline-none"
              />
            </div>
          )}

          {discountType === 'percent' && (
            <div>
              <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                الحد الأقصى للاستخدام (اختياري)
              </label>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="مثال: 50 مرة"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
              تاريخ الانتهاء (اختياري)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
            />
          </div>

          {isMasterView && (
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#111214] dark:text-[#F4F4F2] select-none">
                <input
                  type="checkbox"
                  checked={scopeGlobal}
                  onChange={(e) => setScopeGlobal(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#111214]"
                />
                <span>كوبون عام يسري على جميع المتاجر</span>
              </label>
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className={`min-h-[42px] px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ...' : 'إضافة وتفعيل الكوبون'}</span>
          </button>
        </div>
      </form>

      {/* Active & Past Coupons List */}
      <div className="rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2]">
            الكوبونات المسجلة ({coupons.length})
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-[#5C5B57] dark:text-zinc-400">
            جاري تحميل الكوبونات...
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Ticket className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-50" />
            <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">لا توجد كوبونات خصم بعد</p>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
              أنشئ أول كود خصم من النموذج أعلاه لتشجيع العملاء على إتمام الطلبات
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
            {coupons.map((c) => {
              const expired = Boolean(c.expiresAt && new Date(c.expiresAt).getTime() < Date.now());
              const exhausted = c.maxUses !== null && c.maxUses !== undefined && c.usedCount >= c.maxUses;

              return (
                <div
                  key={c.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6]/60 dark:hover:bg-[#101216]/60 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        dir="ltr"
                        className="font-mono text-sm font-extrabold tracking-wider px-2.5 py-0.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2]"
                      >
                        {c.code}
                      </span>
                      <span className={`text-xs font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                        {c.discountType === 'percent'
                          ? `خصم ${c.discountValue}%`
                          : `خصم ${Number(c.discountValue).toLocaleString()} ر.ي`}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          !c.active || expired || exhausted
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        · {expired ? 'منتهي الصلاحية' : exhausted ? 'اكتمل الحد' : c.active ? 'مفعل' : 'متوقف'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                      <span>{c.title}</span>
                      <span aria-hidden="true">·</span>
                      <span>{c.storeId === 'global' ? 'عام على المنصة' : c.storeName}</span>
                      {c.minOrderAmount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>أدنى طلب: {Number(c.minOrderAmount).toLocaleString()} ر.ي</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        الاستخدام: {c.usedCount}
                        {c.maxUses ? ` / ${c.maxUses}` : ''}
                      </span>
                      {c.expiresAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            ينتهي {formatArabicDate(c.expiresAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(c)}
                      title="نسخ الكود"
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1"
                    >
                      {copiedId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>نسخ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        togglePromoCodeActive(c.id, !c.active).then(() =>
                          toast.success(c.active ? 'تم إيقاف الكوبون' : 'تم تفعيل الكوبون')
                        )
                      }
                      title={c.active ? 'إيقاف الكوبون' : 'تفعيل الكوبون'}
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                        c.active
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deletePromoCode(c.id).then(() => toast.success('تم حذف الكوبون'))
                      }
                      title="حذف الكوبون"
                      className="w-9 h-9 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
