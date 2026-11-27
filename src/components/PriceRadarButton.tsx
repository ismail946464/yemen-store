import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, Check, X, TrendingDown, PackageCheck } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import {
  ProductWatcherItem,
  removeProductWatch,
  upsertProductWatch,
} from '../lib/priceRadar';

interface PriceRadarButtonProps {
  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeId?: string;
  storeName?: string;
  currentPrice: number;
  isOutOfStock: boolean;
}

export default function PriceRadarButton({
  productId,
  productTitle,
  productImage,
  storeId,
  storeName,
  currentPrice,
  isOutOfStock,
}: PriceRadarButtonProps) {
  const { user, userData, getThemeClasses, openLoginModal } = useAppContext();

  const [watchersCount, setWatchersCount] = useState(0);
  const [myWatch, setMyWatch] = useState<ProductWatcherItem | null>(null);
  const [openModal, setOpenModal] = useState(false);

  const [watchPriceDrop, setWatchPriceDrop] = useState(true);
  const [watchRestock, setWatchRestock] = useState(isOutOfStock);
  const [useTargetPrice, setUseTargetPrice] = useState(false);
  const [targetPriceInput, setTargetPriceInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!productId) return;
    const q = query(collection(db, 'productWatchers'), where('productId', '==', productId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWatchersCount(snap.size);
        if (user?.uid) {
          const mineDoc = snap.docs.find((d) => d.data()?.userId === user.uid);
          if (mineDoc) {
            setMyWatch({ id: mineDoc.id, ...mineDoc.data() } as ProductWatcherItem);
          } else {
            setMyWatch(null);
          }
        } else {
          setMyWatch(null);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [productId, user?.uid]);

  const handleOpen = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (myWatch) {
      setWatchPriceDrop(myWatch.watchPriceDrop);
      setWatchRestock(myWatch.watchRestock);
      setUseTargetPrice(myWatch.targetPrice !== null && myWatch.targetPrice > 0);
      setTargetPriceInput(myWatch.targetPrice ? String(myWatch.targetPrice) : '');
    } else {
      setWatchPriceDrop(true);
      setWatchRestock(isOutOfStock);
      const suggested = currentPrice > 0 ? Math.max(100, Math.round(currentPrice * 0.9)) : '';
      setUseTargetPrice(false);
      setTargetPriceInput(String(suggested));
    }
    setOpenModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openLoginModal();
      return;
    }
    if (!watchPriceDrop && !watchRestock) {
      toast.error('اختر تنبيه نزول السعر أو تنبيه التوفر بالمخزون');
      return;
    }

    let parsedTarget: number | null = null;
    if (watchPriceDrop && useTargetPrice) {
      const n = Number(targetPriceInput);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error('أدخل سعراً مستهدفاً صحيحاً');
        return;
      }
      parsedTarget = Math.round(n);
    }

    setSaving(true);
    try {
      await upsertProductWatch({
        userId: user.uid,
        userName: userData?.name || user.displayName || 'عميل',
        productId,
        productTitle,
        productImage: productImage || null,
        storeId: storeId || '',
        storeName: storeName || 'متجر',
        targetPrice: parsedTarget,
        watchPriceDrop,
        watchRestock,
        currentPrice,
        isOutOfStock,
        existingCreatedAt: myWatch?.createdAt,
      });
      toast.success('تم تفعيل رادار التنبيهات! سيصلك إشعار فوري عند التحديث.');
      setOpenModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'تعذر حفظ التنبيه');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await removeProductWatch(user.uid, productId);
      toast.success('تم إيقاف المراقبة لهذا المنتج');
      setOpenModal(false);
    } catch {
      toast.error('تعذر إلغاء المراقبة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleOpen}
          className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-bold inline-flex items-center gap-2 transition-colors ${
            myWatch
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
              : 'border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
          }`}
        >
          <BellRing className="w-3.5 h-3.5 shrink-0" />
          <span>
            {myWatch
              ? myWatch.targetPrice
                ? `رادار نشط · عند ${Number(myWatch.targetPrice).toLocaleString()} ر.ي`
                : 'رادار السعر والتوفر نشط'
              : isOutOfStock
                ? 'نبّهني عند التوفر بالمخزون'
                : 'نبّهني إذا نزل السعر'}
          </span>
        </button>

        <div className="flex items-center gap-2.5 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
          {watchersCount > 0 && (
            <span className="tabular-nums">يراقبه {watchersCount} مهتم</span>
          )}
          {user && (
            <Link to="/watchlist" className="font-bold text-[#111214] dark:text-[#F4F4F2] hover:underline">
              قائمة الرادار
            </Link>
          )}
        </div>
      </div>

      {openModal && (
        <div
          className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setOpenModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-base text-[#111214] dark:text-[#F4F4F2]">
                  رادار الأسعار وتنبيهات التوفر
                </h3>
                <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 truncate max-w-[280px]">
                  {productTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="w-9 h-9 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between text-xs">
                <span className="text-[#5C5B57] dark:text-zinc-400 font-medium">السعر الحالي</span>
                <span className="font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                  {Number(currentPrice || 0).toLocaleString()} ر.ي
                </span>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] cursor-pointer hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition-colors">
                  <input
                    type="checkbox"
                    checked={watchPriceDrop}
                    onChange={(e) => setWatchPriceDrop(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-600"
                  />
                  <div className="space-y-1 flex-1">
                    <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تنبيهي عند انخفاض السعر</span>
                    </span>
                    <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                      يصلك إشعار مباشر فور تخفيض المتجر للسعر أو إضافة خصم.
                    </p>
                  </div>
                </label>

                {watchPriceDrop && (
                  <div className="pr-4 space-y-2">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useTargetPrice}
                        onChange={(e) => setUseTargetPrice(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span>تحديد سعر مستهدف محدد (اختياري)</span>
                    </label>
                    {useTargetPrice && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={targetPriceInput}
                          onChange={(e) => setTargetPriceInput(e.target.value)}
                          placeholder="أدخل السعر المطلوب بالر.ي"
                          className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-bold tabular-nums text-[#111214] dark:text-[#F4F4F2] outline-none"
                        />
                        <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400">ر.ي أو أقل</span>
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] cursor-pointer hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition-colors">
                  <input
                    type="checkbox"
                    checked={watchRestock}
                    onChange={(e) => setWatchRestock(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-600"
                  />
                  <div className="space-y-1 flex-1">
                    <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                      <PackageCheck className="w-3.5 h-3.5 text-sky-600" />
                      <span>تنبيهي فور توفر الكمية بالمخزون</span>
                    </span>
                    <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                      مفيد عند نفاد الكمية ليتم إشعارك بمجرد إعادة التوفير.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                {myWatch ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleRemove}
                    className="min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1.5"
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    <span>إلغاء التنبيه</span>
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenModal(false)}
                    className="min-h-[42px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#5C5B57] dark:text-zinc-400"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`min-h-[42px] px-5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{saving ? 'جاري الحفظ...' : myWatch ? 'تحديث التنبيه' : 'تفعيل الرادار'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
