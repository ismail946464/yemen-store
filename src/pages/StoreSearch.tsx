import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { Search, Store, ArrowRight, CheckCircle, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function StoreSearch() {
  const { getThemeClasses } = useAppContext();
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
        
        // Also fetch specific store profiles to get banners/descriptions
        const profilesSnap = await getDocs(collection(db, 'storeProfiles'));
        const profiles = profilesSnap.docs.reduce((acc: any, doc) => {
          acc[doc.id] = doc.data();
          return acc;
        }, {});

        const combined = storeUsers.map(user => ({
          ...user,
          profile: profiles[user.id] || {}
        }));

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
        <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight">ابحث عن متجرك المفضل</h1>
        <p className="text-gray-900 font-black max-w-2xl mx-auto">تصفح مئات المتاجر الموثقة في منصتنا واحصل على أفضل المنتجات والخدمات</p>
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
          className="block w-full pr-12 pl-4 py-5 bg-white border-2 border-gray-100 rounded-3xl text-lg shadow-xl shadow-gray-100/50 outline-none focus:border-blue-500 transition-all text-right"
          dir="rtl"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 font-bold">جاري البحث عن المتاجر...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10 text-gray-300" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">لم نجد أي متجر بهذا الاسم</h2>
          <p className="text-gray-900 font-black mt-2">جرب البحث بكلمات أخرى أو تصفح المتاجر المتاحة</p>
          <button onClick={() => setSearchTerm('')} className="mt-6 text-blue-600 font-bold hover:underline">عرض جميع المتاجر</button>
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
                className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full"
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
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                     {store.profile?.verified && (!store.profile?.verifiedUntil || store.profile?.verifiedUntil === '' || new Date(store.profile.verifiedUntil).getTime() >= Date.now()) && (
                       <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                         <CheckCircle className="w-3 h-3" />
                         موثق
                       </span>
                     )}
                  </div>
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
                    <div className="pt-10 flex items-center gap-1 text-yellow-500 bg-yellow-50 px-3 py-1 rounded-full shadow-sm border border-yellow-100">
                      <Star className="w-3 h-3 fill-yellow-500" />
                      <span className="text-xs font-black">4.9</span>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-gray-900 mb-2 group-hover:text-blue-600 transition">{store.profile?.name || store.name}</h3>
                  <p className="text-gray-900 text-sm leading-relaxed mb-6 line-clamp-2 italic font-bold">
                    {store.profile?.description || 'هذا المتجر لم يقم بإضافة وصف بعد، لكنه يقدم أفضل المنتجات والخدمات للعملاء.'}
                  </p>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-center gap-4 text-[10px] font-black text-gray-900 border-t border-gray-50 pt-4">
                       <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>اليمن، صنعاء</span>
                       </div>
                       <div className="flex items-center gap-1">
                          <Store className="w-3 h-3" />
                          <span>125 منتج</span>
                       </div>
                    </div>

                    <Link
                      to={`/store/${store.id}`}
                      className={`w-full flex items-center justify-center gap-3 py-4 rounded-[1.2rem] ${getThemeClasses('bg')} text-white font-bold transition shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-[0.98]`}
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
