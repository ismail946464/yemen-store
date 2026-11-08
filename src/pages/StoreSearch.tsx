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
                className={`rounded-[2.5rem] border overflow-hidden shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full ${getThemeClasses('cardBg')}`}
              >
                {/* Store Header Image */}
                <div className="relative h-40 bg-gray-200 overflow-hidden">
                  {store.profile?.bannerUrl ? (
                    <img src={store.profile.bannerUrl} alt={store.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-1000" />
                  ) : (
                    <div className={`w-full h-full ${getThemeClasses('bg')} opacity-10 flex items-center justify-center`}>
                       <Store className={`w-16 h-16 ${getThemeClasses('text')} opacity-10`} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                </div>

                <div className="p-6 pt-0 relative flex-1 flex flex-col">
                  {/* Logo Overlay */}
                  <div className="flex justify-between items-start -mt-8 mb-4">
                    <div className="w-20 h-20 rounded-2xl border-4 border-white overflow-hidden bg-white shadow-xl relative z-10">
                       {store.profile?.logoUrl || store.photoURL ? (
                         <img src={store.profile?.logoUrl || store.photoURL} alt="Logo" className="w-full h-full object-cover" />
                       ) : (
                         <div className={`w-full h-full flex items-center justify-center ${getThemeClasses('bg')} text-white text-2xl font-black`}>
                           {store.name?.charAt(0) || 'S'}
                         </div>
                       )}
                    </div>
                    {/* Actual Rating or 'جديد' */}
                    <div className="pt-10 flex items-center gap-1.5 text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full shadow-sm border border-yellow-200">
                      <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                      <span className="text-xs font-black">
                        {store.profile?.averageRating && Number(store.profile.averageRating) > 0 
                          ? Number(store.profile.averageRating).toFixed(1) 
                          : 'جديد'}
                      </span>
                      {store.profile?.ratingCount && Number(store.profile.ratingCount) > 0 ? (
                        <span className="text-[10px] text-gray-400 font-bold">({store.profile.ratingCount})</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Store Name & Verification Badge SIDE BY SIDE */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap" dir="rtl">
                    <h3 className={`text-xl font-black transition ${isDarkMode ? 'text-white' : 'text-gray-900'} group-hover:${getThemeClasses('text')}`}>
                      {store.profile?.name || store.name}
                    </h3>
                    {store.isVerified && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${getThemeClasses('bg')} text-white text-[11px] font-black shrink-0 shadow-sm`} title="متجر موثق ومعتمد رسمياً">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>موثق</span>
                      </span>
                    )}
                  </div>

                  <p className={`text-sm leading-relaxed mb-6 line-clamp-2 italic font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    {store.profile?.description || 'هذا المتجر لم يقم بإضافة وصف بعد، لكنه يقدم أفضل المنتجات والخدمات للعملاء.'}
                  </p>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-black text-gray-700 border-t border-gray-100 dark:border-gray-800 pt-4 flex-wrap gap-2">
                       <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{store.profile?.address || store.profile?.city || 'اليمن'}</span>
                       </div>
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-purple-700 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-purple-100 dark:border-purple-900/50">
                             <Store className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                             <span>{store.productCount || 0} منتج</span>
                          </div>
                          {store.salesCount > 0 && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${getThemeClasses('bgLight')} ${getThemeClasses('border')} ${getThemeClasses('textDark')}`}>
                               <PackageCheck className={`w-3 h-3 ${getThemeClasses('text')}`} />
                               <span>{store.salesCount} مبيعة</span>
                            </div>
                          )}
                       </div>
                    </div>

                    <Link
                      to={`/store/${store.id}`}
                      className={`w-full flex items-center justify-center gap-3 py-4 rounded-[1.2rem] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold transition shadow-lg hover:scale-[1.02] active:scale-[0.98]`}
                    >
                      <span>زيارة المتجر</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
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
