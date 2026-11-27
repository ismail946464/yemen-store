import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import {
  Search, Store, ArrowRight, CheckCircle, MapPin, Star,
  ShieldCheck, X, ArrowUpDown, LayoutGrid, ChevronRight, ChevronLeft,
  Pill, Building2, Wrench, Utensils, Laptop, Shirt, Car, Tag, Gavel
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StoreGridSkeleton } from '../components/Skeletons';
import { getAvailableProductVariants } from '../lib/variantUtils';
import { isItemOutOfStock } from '../lib/stockUtils';
import {
  StoreCategoryItem,
  sortStoreCategories,
  doesStoreMatchCategory,
  getAssignedStoreCategories
} from '../lib/storeCategories';
import { safeSessionGet, safeSessionSet } from '../lib/deviceSafe';

const STORE_CACHE_KEY = 'yemen_store_directory_v1';
const CACHE_TTL_MS = 60000;
const INITIAL_VISIBLE_STORES = 12;
const STORES_BATCH_SIZE = 12;

export const getStoreCategoryIcon = (iconOrName: string, className = 'w-3.5 h-3.5 shrink-0') => {
  const s = String(iconOrName || '').toLowerCase();
  if (s === 'pharmacy' || s.includes('صيدل') || s.includes('طب') || s.includes('pharm')) {
    return <Pill className={className} />;
  }
  if (s === 'mall' || s.includes('مول') || s.includes('مركز') || s.includes('mall')) {
    return <Building2 className={className} />;
  }
  if (s === 'mechanic' || s.includes('ميكان') || s.includes('صيان') || s.includes('ورشة') || s.includes('mech')) {
    return <Wrench className={className} />;
  }
  if (s === 'food' || s.includes('مطعم') || s.includes('كافيه') || s.includes('مأكول') || s.includes('food')) {
    return <Utensils className={className} />;
  }
  if (s === 'electronics' || s.includes('الكترون') || s.includes('إلكترون') || s.includes('اتصال')) {
    return <Laptop className={className} />;
  }
  if (s === 'fashion' || s.includes('ملابس') || s.includes('ازياء') || s.includes('أزياء')) {
    return <Shirt className={className} />;
  }
  if (s === 'car' || s.includes('سيار') || s.includes('قطع غيار')) {
    return <Car className={className} />;
  }
  if (s === 'store' || s.includes('محل') || s.includes('متجر')) {
    return <Store className={className} />;
  }
  return <Tag className={className} />;
};

export default function StoreSearch() {
  const { getThemeClasses } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating-desc' | 'products-desc' | 'newest'>('rating-desc');
  const [stores, setStores] = useState<any[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_STORES);

  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.scrollBy({
        left: direction === 'right' ? 240 : -240,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const unsubStoreCats = onSnapshot(
      collection(db, 'storeCategories'),
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as StoreCategoryItem[];
        setStoreCategories(sortStoreCategories(list));
      },
      (err) => {
        console.warn('StoreCategories listener notice:', err.message);
      }
    );

    return () => unsubStoreCats();
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchAllStores = async () => {
      try {
        const cachedRaw = safeSessionGet(STORE_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.ts && Date.now() - cached.ts < CACHE_TTL_MS && Array.isArray(cached.data)) {
            if (mounted) {
              setStores(cached.data);
              setLoading(false);
            }
            return;
          }
        }

        const [usersSnap, profilesSnap, productsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'store'))),
          getDocs(collection(db, 'storeProfiles')),
          getDocs(query(collection(db, 'products'), where('status', '==', 'active')))
        ]);

        const storeUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const profiles = profilesSnap.docs.reduce((acc: any, doc) => {
          acc[doc.id] = doc.data();
          return acc;
        }, {});

        const productCounts: Record<string, number> = {};
        productsSnap.docs.forEach(doc => {
          const p = doc.data();
          if (p.ownerId && (!isItemOutOfStock(p) || getAvailableProductVariants(p).length > 0)) {
            productCounts[p.ownerId] = (productCounts[p.ownerId] || 0) + 1;
          }
        });

        const combined = storeUsers.map(user => {
          const profile = profiles[user.id] || {};
          const isVerified = Boolean(profile.verified) && (!profile.verifiedUntil || profile.verifiedUntil === '' || new Date(profile.verifiedUntil).getTime() >= Date.now());
          return {
            ...user,
            profile,
            isVerified,
            productCount: productCounts[user.id] || 0
          };
        });

        combined.sort((a, b) => {
          if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
          return (b.productCount || 0) - (a.productCount || 0);
        });

        safeSessionSet(STORE_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: combined }));

        if (mounted) {
          setStores(combined);
        }
      } catch (e) {
        console.error("Error fetching stores:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAllStores();
    return () => { mounted = false; };
  }, []);

  // Reset active category if it was deleted by admin
  useEffect(() => {
    if (activeCategoryId !== 'all' && storeCategories.length > 0 && !storeCategories.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId('all');
    } else if (activeCategoryId !== 'all' && storeCategories.length === 0) {
      setActiveCategoryId('all');
    }
  }, [storeCategories, activeCategoryId]);

  const activeCategoryObj = useMemo(
    () => storeCategories.find((c) => c.id === activeCategoryId) || null,
    [storeCategories, activeCategoryId]
  );

  const results = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = stores.filter(s => {
      if (verifiedOnly && !s.isVerified) return false;
      if (activeCategoryObj && !doesStoreMatchCategory(s.profile, activeCategoryObj)) return false;
      if (!term) return true;
      const assignedCats = getAssignedStoreCategories(s.profile, storeCategories);
      const matchAssignedCat = assignedCats.some((c) => String(c.name || '').toLowerCase().includes(term));
      return (
        matchAssignedCat ||
        String(s.name || '').toLowerCase().includes(term) ||
        String(s.profile?.name || '').toLowerCase().includes(term) ||
        String(s.profile?.city || '').toLowerCase().includes(term) ||
        String(s.profile?.district || '').toLowerCase().includes(term) ||
        String(s.profile?.address || '').toLowerCase().includes(term) ||
        String(s.profile?.landmark || '').toLowerCase().includes(term) ||
        String(s.profile?.description || '').toLowerCase().includes(term)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'products-desc') {
        return (b.productCount || 0) - (a.productCount || 0);
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt || b.profile?.updatedAt || 0).getTime() - new Date(a.createdAt || a.profile?.updatedAt || 0).getTime();
      }
      const rDiff = Number(b.profile?.averageRating || 0) - Number(a.profile?.averageRating || 0);
      if (rDiff !== 0) return rDiff;
      if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
      return (b.productCount || 0) - (a.productCount || 0);
    });
  }, [searchTerm, stores, verifiedOnly, activeCategoryObj, storeCategories, sortBy]);

  const categoryStoreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of storeCategories) {
      counts[cat.id] = 0;
    }
    for (const s of stores) {
      for (const cat of storeCategories) {
        if (doesStoreMatchCategory(s.profile, cat)) {
          counts[cat.id] = (counts[cat.id] || 0) + 1;
        }
      }
    }
    return counts;
  }, [stores, storeCategories]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_STORES);
  }, [searchTerm, verifiedOnly, activeCategoryId, sortBy]);

  const visibleResults = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount]
  );
  const hasMoreStores = visibleCount < results.length;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMoreStores || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + STORES_BATCH_SIZE, results.length));
        }
      },
      { rootMargin: '320px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreStores, results.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E2DA] dark:border-[#232730] pb-6">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight">
            دليل المتاجر المعتمدة
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400">
            تصفح المتاجر المحلية، قارن التقييمات، وتواصل مع البائعين مباشرة
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 md:w-[540px]">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-[#5C5B57] dark:text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث باسم المتجر، المدينة، أو الوصف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full min-h-[44px] pr-10 pl-8 py-2.5 border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 rounded-lg text-xs sm:text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400 transition-colors text-right"
              dir="rtl"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="مسح البحث"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5C5B57] hover:text-[#111214] dark:hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setVerifiedOnly(v => !v)}
              className={`flex-1 sm:flex-none min-h-[44px] px-3.5 py-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                verifiedOnly
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>الموثقة فقط</span>
            </button>

            <Link
              to="/requests"
              className={`flex-1 sm:flex-none min-h-[44px] px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
            >
              <Gavel className="w-4 h-4" />
              <span>اطلب تسعيرة</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Horizontal Admin-Managed Store Categories Rail */}
      {storeCategories.length > 0 && (
        <div className="relative border-b border-[#E5E2DA] dark:border-[#232730]" dir="rtl">
          <div className="flex items-center justify-between gap-4">
            <div
              ref={categoriesScrollRef}
              className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth flex-1"
            >
              <button
                type="button"
                onClick={() => setActiveCategoryId('all')}
                className={`shrink-0 min-h-[44px] flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeCategoryId === 'all'
                    ? `${getThemeClasses('border')} text-[#111214] dark:text-white font-bold`
                    : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>الكل</span>
                <span className="text-[11px] opacity-65 tabular-nums">({stores.length})</span>
              </button>

              {storeCategories.map((cat) => {
                const isActive = activeCategoryId === cat.id;
                const count = categoryStoreCounts[cat.id] || 0;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`shrink-0 min-h-[44px] flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? `${getThemeClasses('border')} text-[#111214] dark:text-white font-bold`
                        : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                    }`}
                  >
                    {getStoreCategoryIcon(cat.icon || cat.name)}
                    <span>{cat.name}</span>
                    {count > 0 && <span className="text-[11px] opacity-65 tabular-nums">({count})</span>}
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:flex items-center gap-1 shrink-0 pb-1">
              <button
                type="button"
                onClick={() => scrollCategories('right')}
                aria-label="تمرير لليمين"
                className="w-8 h-8 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollCategories('left')}
                aria-label="تمرير لليسار"
                className="w-8 h-8 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Count & Sort-Only Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3" dir="rtl">
        <div className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">
          {loading ? 'جاري التحميل...' : `عرض ${results.length} متجر`}
        </div>

        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#5C5B57] dark:text-zinc-400" />
          <span className="text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400 hidden sm:inline">الترتيب حسب:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="الترتيب حسب"
            className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold outline-none cursor-pointer"
          >
            <option value="rating-desc">الأعلى تقييماً</option>
            <option value="products-desc">الأكثر منتجات</option>
            <option value="newest">الأحدث</option>
          </select>
        </div>
      </div>

      {loading ? (
        <StoreGridSkeleton count={6} />
      ) : results.length === 0 ? (
        <div className="text-center py-16 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] max-w-xl mx-auto p-8 text-[#5C5B57] dark:text-zinc-400">
          <Store className="w-9 h-9 mx-auto mb-3 opacity-40" />
          <h2 className="text-lg font-bold text-[#111214] dark:text-[#F4F4F2]">لم نجد أي متجر مطابق</h2>
          <p className="text-xs mt-1">جرب البحث باسم آخر أو تغيير التصنيف</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setVerifiedOnly(false);
              setActiveCategoryId('all');
            }}
            className={`mt-5 min-h-[40px] px-5 py-2 rounded-lg text-xs font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            عرض جميع المتاجر
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleResults.map((store) => {
              const assignedCats = getAssignedStoreCategories(store.profile, storeCategories);
              return (
              <article
                key={store.id}
                className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden hover:border-[#111214]/40 dark:hover:border-zinc-500 transition-colors group flex flex-col h-full"
              >
                <div className="relative h-36 bg-[#EFEDE6] dark:bg-[#1C1F26] overflow-hidden">
                  {store.profile?.bannerUrl ? (
                    <img
                      src={store.profile.bannerUrl}
                      alt={store.profile?.name || store.name}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store className="w-9 h-9 text-[#5C5B57] dark:text-zinc-600 opacity-50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </div>

                <div className="p-5 pt-0 relative flex-1 flex flex-col">
                  <div className="flex justify-between items-end -mt-7 mb-3">
                    <div className="w-14 h-14 rounded-lg border-2 border-white dark:border-[#131519] overflow-hidden bg-white dark:bg-[#1C1F26] relative z-10 shrink-0">
                      {store.profile?.logoUrl || store.photoURL ? (
                        <img
                          src={store.profile?.logoUrl || store.photoURL}
                          alt={store.profile?.name || store.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-base font-extrabold">
                          {(store.profile?.name || store.name || 'S').charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-[#5C5B57] dark:text-zinc-300 pb-0.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span className="tabular-nums font-bold text-[#111214] dark:text-[#F4F4F2]">
                        {store.profile?.averageRating && Number(store.profile.averageRating) > 0
                          ? `${Number(store.profile.averageRating).toFixed(1)}/10`
                          : 'جديد'}
                      </span>
                      {store.profile?.ratingCount && Number(store.profile.ratingCount) > 0 ? (
                        <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-normal tabular-nums">({store.profile.ratingCount})</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <h2 className="text-base font-bold text-[#111214] dark:text-[#F4F4F2]">
                      {store.profile?.name || store.name}
                    </h2>
                    {store.isVerified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400" title="متجر موثق ومعتمد">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>موثق</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed mb-3 line-clamp-2 text-[#5C5B57] dark:text-zinc-400">
                    {store.profile?.description || 'تشكيلة مختارة من المنتجات الموثوقة مع توصيل مباشر.'}
                  </p>

                  {assignedCats.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {assignedCats.map((cat) => (
                        <span
                          key={cat.id}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF9F6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-zinc-200"
                        >
                          {getStoreCategoryIcon(cat.icon || cat.name, 'w-2.5 h-2.5 opacity-75 shrink-0')}
                          <span>{cat.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#5C5B57] dark:text-zinc-400 border-t border-[#E5E2DA] dark:border-[#232730] pt-3 gap-2">
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {[store.profile?.city, store.profile?.district, store.profile?.address]
                            .map((v: any) => String(v || '').trim())
                            .filter(Boolean)
                            .join(' - ') || 'اليمن'}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums shrink-0">
                        {store.productCount || 0} منتج
                      </span>
                    </div>

                    <Link
                      to={`/store/${store.id}`}
                      className={`w-full min-h-[42px] flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                    >
                      <span>زيارة المتجر</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:-scale-x-100" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
          </div>

          {hasMoreStores && (
            <div ref={loadMoreRef} className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + STORES_BATCH_SIZE, results.length))}
                className="min-h-[42px] px-6 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] transition-colors"
              >
                عرض المزيد ({results.length - visibleResults.length} متجر متبقٍ)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
