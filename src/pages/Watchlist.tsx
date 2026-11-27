import React, { useEffect, useState } from 'react';
import { BellRing, Trash2, ExternalLink, TrendingDown, PackageCheck, ArrowRight, Heart, ShoppingBag, Store, CheckCircle, UserCheck, MapPin } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import { ProductWatcherItem, removeProductWatch } from '../lib/priceRadar';
import { formatArabicDate } from '../lib/deviceSafe';
import { isItemOutOfStock } from '../lib/stockUtils';

export default function Watchlist() {
  const { user, getThemeClasses, openLoginModal, favoriteIds, toggleFavorite, followedStoreIds, toggleFollowStore } = useAppContext();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'radar' | 'favorites' | 'stores'>('radar');
  const [watchers, setWatchers] = useState<ProductWatcherItem[]>([]);
  const [liveProducts, setLiveProducts] = useState<Record<string, any>>({});
  const [favProducts, setFavProducts] = useState<any[]>([]);
  const [followedStores, setFollowedStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setWatchers([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'productWatchers'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as ProductWatcherItem))
          .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        setWatchers(list);
        setLoading(false);

        const uniqueIds = Array.from(new Set(list.map((w) => w.productId).filter(Boolean)));
        const nextMap: Record<string, any> = {};
        await Promise.all(
          uniqueIds.map(async (pid) => {
            try {
              const pSnap = await getDoc(doc(db, 'products', pid));
              if (pSnap.exists()) {
                nextMap[pid] = { id: pSnap.id, ...pSnap.data() };
              }
            } catch {
              // ignore fetch failure
            }
          })
        );
        setLiveProducts(nextMap);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (favoriteIds.length === 0) {
      setFavProducts([]);
      return;
    }
    let cancelled = false;
    setLoadingFavs(true);
    Promise.all(
      favoriteIds.slice(0, 60).map(async (pid) => {
        try {
          const snap = await getDoc(doc(db, 'products', pid));
          if (snap.exists()) {
            return { id: snap.id, ...snap.data() };
          }
        } catch {}
        return null;
      })
    )
      .then((items) => {
        if (!cancelled) {
          setFavProducts(items.filter(Boolean));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFavs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [favoriteIds]);

  useEffect(() => {
    if (followedStoreIds.length === 0) {
      setFollowedStores([]);
      return;
    }
    let cancelled = false;
    setLoadingStores(true);
    Promise.all(
      followedStoreIds.slice(0, 60).map(async (sid) => {
        try {
          const snap = await getDoc(doc(db, 'storeProfiles', sid));
          if (snap.exists()) {
            return { id: snap.id, ...snap.data() };
          }
        } catch {}
        return null;
      })
    )
      .then((items) => {
        if (!cancelled) setFollowedStores(items.filter(Boolean));
      })
      .finally(() => {
        if (!cancelled) setLoadingStores(false);
      });
    return () => {
      cancelled = true;
    };
  }, [followedStoreIds]);

  const handleRemove = async (w: ProductWatcherItem) => {
    if (!user?.uid) return;
    try {
      await removeProductWatch(user.uid, w.productId);
      toast.success('تمت إزالة المنتج من قائمة الرادار');
    } catch {
      toast.error('تعذر إزالة المراقبة');
    }
  };

  return (
    <div className="space-y-6 pb-16" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E2DA] dark:border-[#232730] pb-5">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white mb-1"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight">
            المفضلة ورادار الأسعار
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400">
            تتبع المنتجات المفضلة لديك أو راقب انخفاض أسعارها وتوفرها بالمخزون
          </p>
        </div>

        <Link
          to="/"
          className="min-h-[42px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center gap-1.5"
        >
          <span>تصفح المنتجات</span>
        </Link>
      </div>

      {/* Segmented Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-[#E5E2DA] dark:border-[#232730] pb-3">
        <button
          type="button"
          onClick={() => setTab('radar')}
          className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'radar'
              ? `${getThemeClasses('bg')} ${getThemeClasses('hover')}`
              : 'border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-400'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span>رادار الأسعار ({watchers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('favorites')}
          className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'favorites'
              ? `${getThemeClasses('bg')} ${getThemeClasses('hover')}`
              : 'border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-400'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>المنتجات المفضلة ({favoriteIds.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('stores')}
          className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'stores'
              ? `${getThemeClasses('bg')} ${getThemeClasses('hover')}`
              : 'border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-400'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>متاجر أتابعها ({followedStoreIds.length})</span>
        </button>
      </div>

      {tab === 'stores' ? (
        loadingStores ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 rounded-lg skeleton-shimmer border border-[#E5E2DA] dark:border-[#232730]" />
            ))}
          </div>
        ) : followedStores.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-xl border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-3">
            <Store className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-60" />
            <p className="font-display font-bold text-sm sm:text-base text-[#111214] dark:text-[#F4F4F2]">
              لا تتابع أي متاجر بعد
            </p>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 max-w-md mx-auto">
              افتح صفحة أي متجر واضغط على «متابعة المتجر» للوصول السريع لمنتجاته وتصفيتها في الرئيسية.
            </p>
            <Link
              to="/search-stores"
              className={`inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2 rounded-lg text-xs font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
            >
              تصفح المتاجر
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {followedStores.map((st: any) => {
              const isVer = Boolean(st.verified) && (!st.verifiedUntil || st.verifiedUntil === '' || new Date(st.verifiedUntil).getTime() >= Date.now());
              return (
                <div
                  key={st.id}
                  className="rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <Link
                      to={`/store/${st.id}`}
                      className="w-14 h-14 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] shrink-0 flex items-center justify-center"
                    >
                      {st.logoUrl ? (
                        <img src={st.logoUrl} alt={st.name} className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-6 h-6 text-[#5C5B57] opacity-50" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        to={`/store/${st.id}`}
                        className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2] hover:underline flex items-center gap-1"
                      >
                        <span className="truncate">{st.name || 'متجر'}</span>
                        {isVer && <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${getThemeClasses('verified')}`} />}
                      </Link>
                      {(st.city || st.district) && (
                        <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{[st.city, st.district].filter(Boolean).join(' · ')}</span>
                        </p>
                      )}
                      {st.description && (
                        <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 line-clamp-2">
                          {st.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                    <Link
                      to={`/store/${st.id}`}
                      className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>زيارة المتجر</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleFollowStore(st.id, st.name)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إلغاء المتابعة</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === 'favorites' ? (
        loadingFavs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 rounded-lg skeleton-shimmer border border-[#E5E2DA] dark:border-[#232730]" />
            ))}
          </div>
        ) : favProducts.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-xl border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-3">
            <Heart className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-60" />
            <p className="font-display font-bold text-sm sm:text-base text-[#111214] dark:text-[#F4F4F2]">
              قائمة المفضلة فارغة حالياً
            </p>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 max-w-md mx-auto">
              اضغط على أيقونة القلب على أي منتج لحفظه هنا والرجوع إليه بسهولة لاحقاً.
            </p>
            <Link
              to="/"
              className={`inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2 rounded-lg text-xs font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
            >
              استكشف المنتجات
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favProducts.map((item: any) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <Link
                    to={`/product/${item.id}`}
                    className="w-16 h-16 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] shrink-0"
                  >
                    {item.image || item.images?.[0] ? (
                      <img
                        src={item.image || item.images?.[0]}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5C5B57]">
                        <ShoppingBag className="w-5 h-5 opacity-40" />
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 block truncate">
                      {item.ownerName || item.category || 'متجر'}
                    </span>
                    <Link
                      to={`/product/${item.id}`}
                      className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2] hover:underline line-clamp-2"
                    >
                      {item.title}
                    </Link>
                    <p className={`text-sm font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                      {Number(item.price || 0).toLocaleString()} ر.ي
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                  <Link
                    to={`/product/${item.id}`}
                    className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>عرض المنتج</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(item.id)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إزالة</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : !user ? (
        <div className="min-h-[45vh] flex flex-col items-center justify-center text-center px-4 space-y-4 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
          <div className="w-14 h-14 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400">
            <BellRing className="w-6 h-6" />
          </div>
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">
            سجل دخولك لتفعيل رادار الأسعار
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 max-w-md">
            احصل على إشعارات فورية عند انخفاض أسعار المنتجات التي تراقبها أو عودة توفرها في المخزون.
          </p>
          <button
            type="button"
            onClick={() => openLoginModal()}
            className={`min-h-[44px] px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            تسجيل الدخول
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-32 rounded-lg skeleton-shimmer border border-[#E5E2DA] dark:border-[#232730]" />
          ))}
        </div>
      ) : watchers.length === 0 ? (
        <div className="text-center py-14 px-4 rounded-xl border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-3">
          <BellRing className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-60" />
          <p className="font-display font-bold text-sm sm:text-base text-[#111214] dark:text-[#F4F4F2]">
            قائمة المراقبة فارغة حالياً
          </p>
          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 max-w-md mx-auto">
            ادخل إلى أي منتج واضغط على زر «نبّهني إذا نزل السعر» ليصلك تنبيه فوري عند انخفاض سعره أو توفره.
          </p>
          <Link
            to="/"
            className={`inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2 rounded-lg text-xs font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            استكشف المنتجات
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {watchers.map((w) => {
            const live = liveProducts[w.productId];
            const currentPrice = live ? Number(live.price || 0) : Number(w.lastKnownPrice || 0);
            const isOutNow = live ? isItemOutOfStock(live) : w.wasOutOfStock;
            const priceDroppedNow = live && currentPrice > 0 && currentPrice < w.lastKnownPrice;
            const targetReached =
              w.targetPrice !== null && currentPrice > 0 && currentPrice <= Number(w.targetPrice);
            const restockedNow = w.wasOutOfStock && live && !isOutNow;

            return (
              <div
                key={w.id}
                className="rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3.5">
                  <Link
                    to={`/product/${w.productId}`}
                    className="w-16 h-16 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] shrink-0"
                  >
                    {w.productImage || live?.images?.[0] ? (
                      <img
                        src={live?.images?.[0] || w.productImage || ''}
                        alt={w.productTitle}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5C5B57]">
                        <BellRing className="w-5 h-5 opacity-40" />
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#5C5B57] dark:text-zinc-400">
                      <span>{w.storeName || 'متجر'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatArabicDate(w.updatedAt)}</span>
                    </div>

                    <Link
                      to={`/product/${w.productId}`}
                      className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2] hover:underline line-clamp-1"
                    >
                      {live?.title || w.productTitle}
                    </Link>

                    <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                      <span className={`font-extrabold ${getThemeClasses('price')}`}>
                        السعر الحالي: {currentPrice.toLocaleString()} ر.ي
                      </span>
                      {w.targetPrice && (
                        <span className="text-[#5C5B57] dark:text-zinc-400 font-semibold">
                          السعر المستهدف: {Number(w.targetPrice).toLocaleString()} ر.ي
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5">
                      {w.watchPriceDrop && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>تنبيه نزول السعر</span>
                        </span>
                      )}
                      {w.watchRestock && (
                        <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 font-semibold">
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>تنبيه التوفر بالمخزون</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {(targetReached || priceDroppedNow || restockedNow || w.triggeredAt) && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    {restockedNow
                      ? 'توفر المنتج الآن في المخزون!'
                      : targetReached
                        ? 'وصل السعر إلى هدفك المحدد!'
                        : 'انخفض سعر المنتج أو تم إطلاق تنبيه جديد لك.'}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                  <Link
                    to={`/product/${w.productId}`}
                    className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>عرض المنتج</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleRemove(w)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إلغاء المراقبة</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
