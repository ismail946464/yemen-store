import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { Search, Store, ArrowRight, CheckCircle, MapPin, Star, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StoreGridSkeleton } from '../components/Skeletons';

const STORE_CACHE_KEY = 'yemen_store_directory_v1';
const CACHE_TTL_MS = 60000;

export default function StoreSearch() {
  const { getThemeClasses } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchAllStores = async () => {
      try {
        const cachedRaw = sessionStorage.getItem(STORE_CACHE_KEY);
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
          if (p.ownerId && (p.stock === undefined || p.stock === null || Number(p.stock) > 0)) {
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

        try {
          sessionStorage.setItem(STORE_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: combined }));
        } catch {}

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

  const results = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return stores.filter(s => {
      if (verifiedOnly && !s.isVerified) return false;
      if (!term) return true;
      return (
        String(s.name || '').toLowerCase().includes(term) ||
        String(s.profile?.name || '').toLowerCase().includes(term) ||
        String(s.profile?.city || '').toLowerCase().includes(term) ||
        String(s.profile?.description || '').toLowerCase().includes(term)
      );
    });
  }, [searchTerm, stores, verifiedOnly]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E2DA] dark:border-[#232730] pb-6">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight">
            دليل المتاجر المعتمدة
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400">
            تصفح المتاجر المحلية، قارن التقييمات، وتواصل مع البائعين مباشرة
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 md:w-[440px]">
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

          <button
            type="button"
            onClick={() => setVerifiedOnly(v => !v)}
            className={`min-h-[44px] px-3.5 py-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              verifiedOnly
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>الموثقة فقط</span>
          </button>
        </div>
      </div>

      {loading ? (
        <StoreGridSkeleton count={6} />
      ) : results.length === 0 ? (
        <div className="text-center py-16 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] max-w-xl mx-auto p-8 text-[#5C5B57] dark:text-zinc-400">
          <Store className="w-9 h-9 mx-auto mb-3 opacity-40" />
          <h2 className="text-lg font-bold text-[#111214] dark:text-[#F4F4F2]">لم نجد أي متجر مطابق</h2>
          <p className="text-xs mt-1">جرب البحث باسم آخر أو إزالة فلتر التوثيق</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setVerifiedOnly(false);
            }}
            className={`mt-5 min-h-[40px] px-5 py-2 rounded-lg text-xs font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            عرض جميع المتاجر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((store) => (
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
                        ? Number(store.profile.averageRating).toFixed(1)
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

                <p className="text-xs leading-relaxed mb-4 line-clamp-2 text-[#5C5B57] dark:text-zinc-400">
                  {store.profile?.description || 'تشكيلة مختارة من المنتجات الموثوقة مع توصيل مباشر.'}
                </p>

                <div className="mt-auto space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#5C5B57] dark:text-zinc-400 border-t border-[#E5E2DA] dark:border-[#232730] pt-3 gap-2">
                    <div className="flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{store.profile?.address || store.profile?.city || 'اليمن'}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
