import { useState, useEffect } from 'react';
import { ShoppingCart, CheckCircle, Image as ImageIcon, ShieldAlert, BookmarkCheck } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import PreOrderModal from '../components/PreOrderModal';

export default function StoreFront() {
  const [activeTab, setActiveTab] = useState('all');
  const { addToCart, isAdmin, settings, getThemeClasses, user, login } = useAppContext();
  const navigate = useNavigate();
  const themeColor = settings?.storeTheme || 'green';
  const { isDarkMode } = useAppContext();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPreOrderProduct, setSelectedPreOrderProduct] = useState<any | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('status', '==', 'active'));
    const unsubProducts = onSnapshot(q, (snap) => {
      const productsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setProducts(productsData.filter(p => p.stock === undefined || p.stock === null || Number(p.stock) > 0));
      setIsLoading(false);
    }, (err) => {
      console.warn('StoreFront products listener notice (handled):', err.message);
      setIsLoading(false);
    });

    const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn('StoreFront categories listener notice (handled):', err.message);
    });

    return () => {
      unsubProducts();
      unsubCats();
    };
  }, []);

  const filteredProducts = activeTab === 'all' 
    ? products 
    : products.filter(p => p.category === activeTab);

  return (
    <div className="space-y-6">
      {settings?.showHeroBanner && settings?.heroBanner && (
        <div className="w-full -mt-2 mb-6 rounded-3xl overflow-hidden shadow-2xl border border-gray-100 relative group min-h-[220px] md:min-h-[350px]">
           <img 
             src={settings.heroBanner} 
             alt="Store Banner" 
             className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
           />
           <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent flex flex-col justify-center items-center p-6 text-center">
              <div className="max-w-2xl space-y-4 animate-in fade-in zoom-in duration-700 pointer-events-auto">
                {settings.heroTitle && (
                  <h2 className="text-3xl md:text-6xl font-bold text-white drop-shadow-2xl tracking-tight">
                    {settings.heroTitle}
                  </h2>
                )}
                {settings.heroSubtitle && (
                  <p className="text-sm md:text-xl text-white/90 font-medium drop-shadow-lg !mt-2">
                    {settings.heroSubtitle}
                  </p>
                )}
                
                <div className="pt-6">
                  <button 
                    onClick={() => {
                      if (settings?.heroLink && settings.heroLink.trim() !== '' && settings.heroLink !== '#' && !settings.heroLink.startsWith('#')) {
                        if (settings.heroLink.startsWith('http')) {
                          window.open(settings.heroLink, '_blank');
                        } else {
                          navigate(settings.heroLink);
                        }
                      } else {
                        const el = document.getElementById('products-section');
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth' });
                        }
                      }
                    }}
                    className={`${getThemeClasses('bg')} text-white px-8 py-3.5 md:px-10 md:py-4 rounded-2xl font-black text-sm md:text-base transition shadow-2xl hover:scale-105 active:scale-95 inline-flex items-center gap-2 cursor-pointer`}
                  >
                    <span>{settings.heroButtonText || 'استكشف المجموعة'}</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>

                {(!settings.heroTitle && !settings.heroSubtitle && !settings.heroButtonText) && (
                   <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow-md">
                     {settings.storeName}
                   </h2>
                )}
              </div>
           </div>
           
           {/* Visual accent */}
           <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${getThemeClasses('bg')} opacity-50`}></div>
        </div>
      )}

    <div id="products-section" className={`rounded-[4rem] p-12 md:p-24 shadow-sm border flex flex-col items-center text-center space-y-12 animate-in fade-in duration-700 transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}>
        <div className="max-w-3xl space-y-4">
          <h1 className={`text-4xl md:text-6xl font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>أهلاً بك في يمن ستور</h1>
          <p className={`text-lg md:text-xl font-black max-w-2xl mx-auto ${isDarkMode ? 'text-gray-300' : 'text-slate-900'}`}>اكتشف أفضل العروض والمنتجات الموثقة في مكان واحد</p>
        </div>

        <div className="w-full max-w-2xl">
          <Link 
            to="/search-stores" 
            className={`group flex flex-row-reverse items-center justify-between border p-3 pl-8 rounded-[2rem] shadow-2xl shadow-black/5 transition-all duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-blue-900' : 'bg-white border-gray-100 hover:border-blue-100'}`}
          >
            <div className={`p-3 rounded-2xl border shadow-sm transition group-hover:scale-110 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-blue-400' : 'bg-white border-gray-50 text-blue-600'}`}>
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
            </div>
            <span className={`text-lg md:text-xl font-black transition ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}>ابحث عن متاجر أخرى</span>
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-4 w-full">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-10 py-4 rounded-2xl text-lg font-black transition-all ${
              activeTab === 'all' 
                ? `bg-black text-white shadow-xl shadow-black/20 ${isDarkMode ? 'bg-blue-600 text-white' : 'bg-black text-white'}` 
                : `${isDarkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-slate-50 text-slate-900 hover:bg-slate-100'}`
            }`}
          >
            الكل
          </button>
          {categories.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setActiveTab(c.slug)}
              className={`px-10 py-4 rounded-2xl text-lg font-black transition-all ${
                activeTab === c.slug 
                  ? `bg-black text-white shadow-xl shadow-black/20 ${isDarkMode ? 'bg-blue-600 text-white' : 'bg-black text-white'}` 
                  : `${isDarkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-slate-50 text-slate-900 hover:bg-slate-100'}`
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
    </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-500">جاري تحميل المنتجات...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">لا توجد منتجات حالياً. {isAdmin ? 'قم بإضافة منتجات من لوحة التحكم.' : ''}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
             <motion.div 
               key={product.id} 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               className={`rounded-[2.5rem] border overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col h-full group ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}
             >
              {/* Store Header matching screenshot exactly */}
              {product.ownerId && (
                <div className={`p-4 flex items-center justify-between px-6 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
                  <Link to={`/store/${product.ownerId}`} className="flex items-center gap-3 group/store">
                    <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-yellow-500">
                      <div className={`w-full h-full rounded-full overflow-hidden border-2 bg-gray-50 ${isDarkMode ? 'border-gray-800 bg-gray-800' : 'border-white'}`}>
                        {product.ownerPhotoURL ? (
                          <img src={product.ownerPhotoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${getThemeClasses('bg')} text-white text-xs font-black`}>
                            {product.ownerName?.charAt(0) || 'S'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{product.ownerName}</span>
                        {product.ownerVerified && <CheckCircle className="w-3.5 h-3.5 text-blue-500 fill-white" />}
                      </div>
                      <span className={`text-[10px] font-extrabold ${isDarkMode ? 'text-gray-500' : 'text-gray-900'}`}>{product.ownerVerified ? 'متجر موثق' : 'متجر نظامي'}</span>
                    </div>
                  </Link>
                  <Link 
                    to={`/store/${product.ownerId}`} 
                    className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    زيارة
                  </Link>
                </div>
              )}

              <Link to={`/product/${product.id}`} className="relative aspect-square overflow-hidden bg-gray-50 block">
                <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                  {(product.image || (product.images && product.images[0])) ? (
                    <img 
                      src={product.image || product.images[0]} 
                      alt={product.title} 
                      className="w-full h-full object-cover transition duration-700 group-hover:scale-110" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <ImageIcon className="w-12 h-12 text-gray-200" />
                    </div>
                  )}
                  {product.category === 'local' && (
                    <div className="absolute top-4 right-4 bg-[#facc15] text-[#422006] text-[11px] font-black px-4 py-2 rounded-xl shadow-lg z-10">منتج محلي</div>
                  )}
                </div>
                {product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0 && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20">
                    <span className="bg-white text-black px-6 py-2 rounded-full text-xs font-black shadow-2xl">نفذت الكمية</span>
                  </div>
                )}
              </Link>
              
              <div className="p-6 flex flex-col flex-1 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <Link to={`/product/${product.id}`} className="flex-1">
                      <h3 className={`font-black text-xl leading-tight hover:text-blue-600 transition line-clamp-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>{product.title}</h3>
                    </Link>
                  </div>
                  <p className={`text-xs font-bold line-clamp-2 h-9 leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-800'}`}>{product.description}</p>
                </div>

                <div className={`flex items-center justify-between mt-auto pt-4 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-50'}`}>
                   <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-900'}`}>السعر الحالي</span>
                      <span className="text-blue-600 dark:text-blue-400 font-black text-2xl tracking-tighter">{product.price.toLocaleString()} <span className={`text-sm font-black opacity-60 ${isDarkMode ? 'text-gray-400' : 'text-gray-900'}`}>ريال</span></span>
                   </div>
                   
                   {user ? (
                     <button 
                       onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         addToCart(product);
                       }}
                       disabled={product.stock !== undefined && Number(product.stock) <= 0}
                       className={`w-14 h-14 rounded-3xl flex items-center justify-center shadow-xl transition-all disabled:opacity-30 ${isDarkMode ? 'bg-blue-600 text-white shadow-blue-950/40 hover:scale-110' : 'bg-black text-white shadow-black/10 hover:scale-110'}`}
                       title="إضافة للسلة للشراء الفوري"
                     >
                       <ShoppingCart className="h-6 w-6" />
                     </button>
                   ) : (
                     <button 
                       onClick={login}
                       className={`px-6 py-3 rounded-2xl text-[10px] font-black transition ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-750' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                     >
                       دخول للشراء
                     </button>
                   )}
                </div>

                {/* Pre-Order (حجز مسبق) Button Under Product */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!user) {
                        login();
                        return;
                      }
                      setSelectedPreOrderProduct(product);
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-black text-xs flex items-center justify-between transition-all duration-200 active:scale-95 group/preorder shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover/preorder:scale-110 transition-transform" />
                      <span className="font-black text-sm">حجز مسبق</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      <span>عربون: {((product.depositAmount && Number(product.depositAmount) > 0) ? Number(product.depositAmount) : Math.max(1000, Math.round(Number(product.price) * 0.2))).toLocaleString()} ريال</span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-amber-800 dark:text-amber-400">مهلة {product.reservationDurationDays || 3} أيام</span>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Red Safety & Anti-Fraud Guide Link Button */}
      <div className="mt-14 mb-8 pt-8 border-t border-gray-150 dark:border-gray-800 flex flex-col items-center justify-center text-center">
        <Link 
          to="/safety-guide" 
          className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border-2 border-red-500/30 hover:border-red-500 text-red-600 dark:text-red-400 font-black text-sm sm:text-base shadow-lg shadow-red-500/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
        >
          <div className="w-8 h-8 rounded-xl bg-red-600/10 dark:bg-red-600/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <span className="text-red-600 dark:text-red-400 font-black tracking-tight">
            دليل الأمان والمصداقية ومكافحة الاحتيال
          </span>
        </Link>
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mt-2">
          اضغط هنا لفتح صفحة التنبيهات والإرشادات الأمنية وشروط الحماية الرسمية
        </span>
      </div>

      {/* Pre-Order Reservation Modal */}
      {selectedPreOrderProduct && (
        <PreOrderModal
          product={selectedPreOrderProduct}
          isOpen={!!selectedPreOrderProduct}
          onClose={() => setSelectedPreOrderProduct(null)}
        />
      )}
    </div>
  );
}
