import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { Search, Store, ArrowRight, CheckCircle, MapPin, Star, PackageCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function StoreSearch() {
  const { getThemeClasses, isDarkMode } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const fetchAllStores = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'store'));
        const querySnapshot = await getDocs(q);
        const storeUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch specific store profiles to get banners/descriptions/ratings
        const profilesSnap = await getDocs(collection(db, 'storeProfiles'));
        const profiles = profilesSnap.docs.reduce((acc: any, doc) => {
          acc[doc.id] = doc.data();
          return acc;
        }, {});

        // Fetch products to compute real active product count for each store
        const productsSnap = await getDocs(collection(db, 'products'));
        const productCounts: Record<string, number> = {};
        productsSnap.docs.forEach(doc => {
          const p = doc.data();
          if (p.ownerId && p.status !== 'inactive' && p.status !== 'deleted') {
            productCounts[p.ownerId] = (productCounts[p.ownerId] || 0) + 1;
          }
        });

        // Fetch orders to compute real completed sales count for each store
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const salesCounts: Record<string, number> = {};
        ordersSnap.docs.forEach(doc => {
          const order = doc.data();
          if (order.status !== 'cancelled' && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              const owner = item.ownerId || item.storeId;
              if (owner) {
                salesCounts[owner] = (salesCounts[owner] || 0) + (Number(item.quantity) || 1);
              }
            });
          }
        });

        const combined = storeUsers.map(user => {
          const profile = profiles[user.id] || {};
          const isVerified = Boolean(profile.verified) && (!profile.verifiedUntil || profile.verifiedUntil === '' || new Date(profile.verifiedUntil).getTime() >= Date.now());
          return {
            ...user,
            profile,
            isVerified,
            productCount: productCounts[user.id] || 0,
            salesCount: salesCounts[user.id] || 0
          };
        });

        setStores(combined);
        setResults(combined);
      } catch (e) {
        console.error("Error fetching stores:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAllStores();
  }, []);

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setResults(stores);
      return;
    }

    const filtered = stores.filter(s => 
      s.name?.toLowerCase().includes(term) || 
      s.profile?.name?.toLowerCase().includes(term) ||
      s.profile?.description?.toLowerCase().includes(term)
    );
    setResults(filtered);
  }, [searchTerm, stores]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">ابحث عن متجرك المفضل</h1>
        <p className="text-gray-600 dark:text-gray-300 font-bold max-w-2xl mx-auto">تصفح المتاجر المعتمدة في منصتنا واحصل على أفضل المنتجات والخدمات الحقيقية</p>
      </div>

      <div className="relative max-w-2xl mx-auto">
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
          <Search className="h-6 w-6 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="ابحث باسم المتجر أو الوصف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`block w-full pr-12 pl-4 py-5 border-2 rounded-3xl text-lg shadow-xl outline-none transition-all text-right ${
            isDarkMode 
              ? 'bg-gray-800/90 border-gray-700 text-white placeholder-gray-500' 
              : 'bg-white border-gray-100 text-gray-900 placeholder-gray-400'
          } focus:ring-2 ${getThemeClasses('ring')} focus:${getThemeClasses('border')}`}
          dir="rtl"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${getThemeClasses('border')}`}></div>
          <p className="text-gray-500 font-bold">جاري البحث عن المتاجر...</p>
        </div>
      ) : results.length === 0 ? (
        <div className={`text-center py-20 rounded-3xl border-2 border-dashed max-w-2xl mx-auto ${isDarkMode ? 'bg-gray-900/60 border-gray-800 text-gray-400' : 'bg-white border-gray-100 text-gray-500'}`}>
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          </div>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>لم نجد أي متجر بهذا الاسم</h2>
          <p className="font-black mt-2">جرب البحث بكلمات أخرى أو تصفح المتاجر المتاحة</p>
          <button onClick={() => setSearchTerm('')} className={`mt-6 ${getThemeClasses('text')} font-bold hover:underline`}>عرض جميع المتاجر</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {results.map((store) => (
              <motion.div
                key={store.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`rounded-2xl border overflow-hidden transition-all group flex flex-col h-full ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-neutral-200 shadow-xs hover:border-neutral-300'
                }`}
              >
                {/* Store Header Image */}
                <div className="relative h-36 bg-neutral-100 overflow-hidden">
                  {store.profile?.bannerUrl ? (
                    <img src={store.profile.bannerUrl} alt={store.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  ) : (
                    <div className="w-full h-full bg-neutral-100 dark:bg-slate-800 flex items-center justify-center">
                       <Store className="w-12 h-12 text-neutral-300 dark:text-neutral-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
                </div>

                <div className="p-5 pt-0 relative flex-1 flex flex-col">
                  {/* Logo Overlay */}
                  <div className="flex justify-between items-start -mt-7 mb-3">
                    <div className="w-16 h-16 rounded-xl border-2 border-white dark:border-slate-900 overflow-hidden bg-white shadow-xs relative z-10">
                       {store.profile?.logoUrl || store.photoURL ? (
                         <img src={store.profile?.logoUrl || store.photoURL} alt="Logo" className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-white text-xl font-black">
                           {store.name?.charAt(0) || 'S'}
                         </div>
                       )}
                    </div>
                    {/* Unboxed Tabular Rating */}
                    <div className="pt-8 flex items-center gap-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span className="tabular-nums font-bold">
                        {store.profile?.averageRating && Number(store.profile.averageRating) > 0 
                          ? Number(store.profile.averageRating).toFixed(1) 
                          : 'جديد'}
                      </span>
                      {store.profile?.ratingCount && Number(store.profile.ratingCount) > 0 ? (
                        <span className="text-[10px] text-neutral-400 font-normal">({store.profile.ratingCount})</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Store Name & Verification Badge */}
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap" dir="rtl">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white group-hover:text-neutral-950">
                      {store.profile?.name || store.name}
                    </h3>
                    {store.isVerified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600" title="متجر موثق ومعتمد">
                        <CheckCircle className="w-3.5 h-3.5 fill-emerald-600 text-white" />
                        <span>موثق</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed mb-4 line-clamp-2 text-neutral-600 dark:text-neutral-400 font-medium">
                    {store.profile?.description || 'يقدم تشكيلة مختارة من المنتجات الموثوقة مع ضمان الشحن والتوصيل السريع.'}
                  </p>

                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-slate-800 pt-3 flex-wrap gap-2">
                       <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{store.profile?.address || store.profile?.city || 'اليمن'}</span>
                       </div>
                       <div className="flex items-center gap-2 text-[11px]">
                          <span>{store.productCount || 0} منتج</span>
                          {store.salesCount > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{store.salesCount} مبيعة</span>
                            </>
                          )}
                       </div>
                    </div>

                    <Link
                      to={`/store/${store.id}`}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition active:scale-95 shadow-xs"
                    >
                      <span>زيارة المتجر</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:-scale-x-100" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
