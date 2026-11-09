import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, CheckCircle, Image as ImageIcon, ShieldAlert, 
  BookmarkCheck, ChevronRight, ChevronLeft, LayoutGrid, 
  Laptop, Smartphone, Shirt, Sparkles, MapPin, Watch, 
  ShoppingBag, Heart, Home, Gamepad2, Layers, Tag
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import PreOrderModal from '../components/PreOrderModal';

const DEFAULT_CATEGORIES = [
  { id: 'cat-electronics', name: 'الإلكترونيات والأجهزة', slug: 'electronics', icon: 'laptop' },
  { id: 'cat-phones', name: 'الهواتف والملحقات', slug: 'phones', icon: 'smartphone' },
  { id: 'cat-fashion', name: 'الأزياء والملابس', slug: 'fashion', icon: 'shirt' },
  { id: 'cat-perfumes', name: 'العطور والبخور', slug: 'perfumes', icon: 'sparkles' },
  { id: 'cat-local', name: 'منتجات محلية يمنية', slug: 'local', icon: 'map-pin' },
  { id: 'cat-watches', name: 'الساعات والإكسسوارات', slug: 'watches', icon: 'watch' },
  { id: 'cat-shoes', name: 'الأحذية والحقائب', slug: 'shoes-bags', icon: 'shopping-bag' },
  { id: 'cat-beauty', name: 'العناية والجمال', slug: 'beauty', icon: 'heart' },
  { id: 'cat-home', name: 'المنزل والمطبخ', slug: 'home', icon: 'home' },
  { id: 'cat-gaming', name: 'ألعاب وترفيه', slug: 'gaming', icon: 'gamepad' }
];

const getCategoryIcon = (slugOrName: string) => {
  const s = String(slugOrName || '').toLowerCase();
  if (s.includes('elect') || s.includes('الكترون') || s.includes('إلكترون') || s === '11') return <Laptop className="w-5 h-5 shrink-0" />;
  if (s.includes('phone') || s.includes('هاتف') || s.includes('جوال') || s.includes('تلفون')) return <Smartphone className="w-5 h-5 shrink-0" />;
  if (s.includes('fashion') || s.includes('ملابس') || s.includes('ازياء') || s.includes('أزياء')) return <Shirt className="w-5 h-5 shrink-0" />;
  if (s.includes('perfume') || s.includes('عطر') || s.includes('بخور') || s.includes('عود')) return <Sparkles className="w-5 h-5 shrink-0 text-amber-500" />;
  if (s.includes('local') || s.includes('محلي') || s.includes('يمن')) return <MapPin className="w-5 h-5 shrink-0 text-emerald-500" />;
  if (s.includes('watch') || s.includes('ساع') || s.includes('اكسسوار')) return <Watch className="w-5 h-5 shrink-0" />;
  if (s.includes('shoe') || s.includes('bag') || s.includes('حقائب') || s.includes('أحذية') || s.includes('شنط')) return <ShoppingBag className="w-5 h-5 shrink-0" />;
  if (s.includes('beauty') || s.includes('جمال') || s.includes('عناية') || s.includes('مكياج')) return <Heart className="w-5 h-5 shrink-0 text-rose-500" />;
  if (s.includes('home') || s.includes('منزل') || s.includes('مطبخ') || s.includes('اثاث')) return <Home className="w-5 h-5 shrink-0" />;
  if (s.includes('game') || s.includes('ألعاب') || s.includes('العاب') || s.includes('ترفيه')) return <Gamepad2 className="w-5 h-5 shrink-0" />;
  return <Tag className="w-5 h-5 shrink-0" />;
};

export default function StoreFront() {
  const [activeTab, setActiveTab] = useState('all');
  const { addToCart, isAdmin, settings, getThemeClasses, user, login, isDarkMode } = useAppContext();
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [storeProfiles, setStoreProfiles] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPreOrderProduct, setSelectedPreOrderProduct] = useState<any | null>(null);

  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.scrollBy({
        left: direction === 'right' ? 260 : -260,
        behavior: 'smooth'
      });
    }
  };

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
      if (!snap.empty) {
        setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    }, (err) => {
      console.warn('StoreFront categories listener notice (handled):', err.message);
    });

    const unsubProfiles = onSnapshot(collection(db, 'storeProfiles'), (snap) => {
      const pMap: Record<string, any> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        const isVer = Boolean(data.verified) && (!data.verifiedUntil || data.verifiedUntil === '' || new Date(data.verifiedUntil).getTime() >= Date.now());
        pMap[doc.id] = { ...data, isVerified: isVer };
      });
      setStoreProfiles(pMap);
    }, (err) => {
      console.warn('StoreProfiles listener notice:', err.message);
    });

    return () => {
      unsubProducts();
      unsubCats();
      unsubProfiles();
    };
  }, []);

  const allAvailableCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const isProductInCategory = (product: any, catSlug: string, catName?: string) => {
    if (!product) return false;
    if (catSlug === 'all') return true;
    const pCat = String(product.category || '').toLowerCase().trim();
    const pCatSlug = String(product.categorySlug || '').toLowerCase().trim();
    const targetSlug = String(catSlug).toLowerCase().trim();
    const targetName = String(catName || '').toLowerCase().trim();

    if (targetSlug && (pCatSlug === targetSlug || pCat === targetSlug)) return true;
    if (targetName && pCat === targetName) return true;

    // Fuzzy matching for Arabic terms and variations
    if (targetSlug === 'electronics' && (pCat.includes('الكترون') || pCat.includes('إلكترون') || pCat === '11')) return true;
    if (targetSlug === 'phones' && (pCat.includes('هاتف') || pCat.includes('جوال') || pCat.includes('ايفون') || pCat.includes('سامسونج') || pCat.includes('تلفون'))) return true;
    if (targetSlug === 'fashion' && (pCat.includes('ملابس') || pCat.includes('ازياء') || pCat.includes('أزياء') || pCat.includes('ثوب') || pCat.includes('قميص') || pCat.includes('فستان'))) return true;
    if (targetSlug === 'perfumes' && (pCat.includes('عطر') || pCat.includes('بخور') || pCat.includes('عود') || pCat.includes('مخلط'))) return true;
    if (targetSlug === 'local' && (pCat.includes('محلي') || pCat.includes('يمن') || pCat.includes('عسل') || pCat.includes('بن') || pCat.includes('جنبية'))) return true;
    if (targetSlug === 'watches' && (pCat.includes('ساع') || pCat.includes('نظار') || pCat.includes('اكسسوار'))) return true;
    if (targetSlug === 'shoes-bags' && (pCat.includes('حذاء') || pCat.includes('احذية') || pCat.includes('أحذية') || pCat.includes('شنط') || pCat.includes('حقائب'))) return true;
    if (targetSlug === 'beauty' && (pCat.includes('عناية') || pCat.includes('مكياج') || pCat.includes('جمال') || pCat.includes('بشرة'))) return true;
    if (targetSlug === 'home' && (pCat.includes('منزل') || pCat.includes('مطبخ') || pCat.includes('أواني') || pCat.includes('اثاث'))) return true;
    if (targetSlug === 'gaming' && (pCat.includes('العاب') || pCat.includes('ألعاب') || pCat.includes('ترفيه') || pCat.includes('بلايستيشن') || pCat.includes('قيمنق'))) return true;

    return false;
  };

  const filteredProducts = activeTab === 'all' 
    ? products 
    : products.filter(p => isProductInCategory(p, activeTab, allAvailableCategories.find(c => c.slug === activeTab)?.name));

  const getCategoryProductCount = (categorySlug: string, categoryName: string) => {
    if (categorySlug === 'all') return products.length;
    return products.filter(p => isProductInCategory(p, categorySlug, categoryName)).length;
  };

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

      {/* Main Store Banner & Search Store Section */}
      <div id="products-section" className={`rounded-[3.5rem] p-8 md:p-14 shadow-sm border flex flex-col items-center text-center space-y-8 animate-in fade-in duration-700 transition-colors ${getThemeClasses('cardBg')}`}>
        <div className="max-w-3xl space-y-3">
          <h1 className={`text-3xl md:text-5xl font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>أهلاً بك في {settings?.storeName || 'يمن ستور'}</h1>
          <p className={`text-base md:text-lg font-black max-w-2xl mx-auto ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>اكتشف أفضل العروض والمنتجات الموثقة من نخبة المتاجر المعتمدة في {settings?.storeName || 'يمن ستور'}</p>
        </div>

        <div className="w-full max-w-2xl flex flex-col sm:flex-row gap-3">
          <Link 
            to="/search-stores" 
            className={`flex-1 group flex flex-row-reverse items-center justify-between border p-3 pl-6 rounded-[2rem] shadow-sm transition-all duration-300 ${
              isDarkMode ? 'bg-gray-800/80 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-400'
            }`}
          >
            <div className={`p-2.5 rounded-2xl border shadow-sm transition group-hover:scale-110 ${getThemeClasses('bgLight')} ${getThemeClasses('border')} ${getThemeClasses('text')}`}>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
            </div>
            <span className={`text-sm md:text-base font-black transition ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>ابحث عن متاجر موثقة</span>
          </Link>

          <Link 
            to="/contact?to=ai_assistant" 
            className={`flex-1 group flex flex-row-reverse items-center justify-between border p-3 pl-6 rounded-[2rem] shadow-sm transition-all duration-300 ${
              isDarkMode 
                ? 'bg-purple-950/40 border-purple-800/60 hover:border-purple-500' 
                : 'bg-purple-50/80 border-purple-200 hover:border-purple-300'
            }`}
          >
            <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md transition group-hover:scale-110">
               <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-right">
              <span className={`text-sm md:text-base font-black transition block ${isDarkMode ? 'text-purple-200' : 'text-purple-900'}`}>مساعد {settings?.storeName || 'يمن ستور'} الذكي</span>
              <span className="text-[11px] font-bold text-purple-500/80 block">بحث فوري بالذكاء الاصطناعي ✦</span>
            </div>
          </Link>
        </div>

        {/* Horizontal Scrollable Categories Bar (ترتيب أفقي من اليمين مع إمكانية التمرير) */}
        <div className="w-full relative pt-4" dir="rtl">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <Layers className={`w-5 h-5 ${getThemeClasses('text')}`} />
              <h3 className={`text-base md:text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                أقسام وتصنيفات المتجر
              </h3>
              <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
                (اسحب أو اضغط للتنقل بين الأقسام)
              </span>
            </div>

            {/* Scroll navigation arrows */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollCategories('right')}
                className={`w-9 h-9 rounded-2xl border flex items-center justify-center transition active:scale-90 ${
                  isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-white' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm'
                }`}
                title="تمرير لليمين"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollCategories('left')}
                className={`w-9 h-9 rounded-2xl border flex items-center justify-center transition active:scale-90 ${
                  isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-white' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm'
                }`}
                title="تمرير لليسار"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Horizontal Scrolling Track */}
          <div 
            ref={categoriesScrollRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth py-3 px-1 -mx-1"
          >
            {/* "الكل" Option */}
            <button
              onClick={() => setActiveTab('all')}
              className={`shrink-0 flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-sm transition-all duration-300 border-2 select-none active:scale-95 ${
                activeTab === 'all'
                  ? `${getThemeClasses('activeTab')} ${getThemeClasses('border')} shadow-lg ring-2`
                  : isDarkMode
                    ? 'bg-gray-800/90 text-gray-300 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                    : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-sm'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                <LayoutGrid className="w-4 h-4" />
              </div>
              <span className="whitespace-nowrap">جميع الأقسام</span>
              <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {products.length}
              </span>
            </button>

            {/* Dynamic categories list */}
            {allAvailableCategories.map((c: any) => {
              const isActive = activeTab === c.slug || activeTab === c.name;
              const count = getCategoryProductCount(c.slug, c.name);

              return (
                <button
                  key={c.id || c.slug}
                  onClick={() => setActiveTab(c.slug)}
                  className={`shrink-0 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl font-black text-sm transition-all duration-300 border-2 select-none active:scale-95 ${
                    isActive
                      ? `${getThemeClasses('activeTab')} ${getThemeClasses('border')} shadow-lg ring-2 scale-[1.02]`
                      : isDarkMode
                        ? 'bg-gray-800/90 text-gray-300 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-sm'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/20 text-white' : `bg-gray-100 dark:bg-gray-700 ${getThemeClasses('text')}`}`}>
                    {getCategoryIcon(c.slug || c.name)}
                  </div>
                  <span className="whitespace-nowrap">{c.name}</span>
                  {count > 0 && (
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : `${getThemeClasses('bgLight')} ${getThemeClasses('textDark')} border border-current/20`
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Products Section */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-500 font-bold">جاري تحميل المنتجات...</div>
      ) : filteredProducts.length === 0 ? (
        <div className={`text-center py-20 rounded-3xl border border-dashed p-8 ${isDarkMode ? 'border-gray-800 bg-gray-900/50 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-base font-black">لا توجد منتجات متوفرة حالياً في هذا القسم.</p>
          <button 
            onClick={() => setActiveTab('all')} 
            className={`mt-4 px-6 py-2.5 rounded-xl ${getThemeClasses('bg')} ${getThemeClasses('hover')} font-black text-xs transition`}
          >
            عرض جميع المنتجات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
          {filteredProducts.map((product) => {
            const ownerProf = product.ownerId ? storeProfiles[product.ownerId] : null;
            const isStoreVerified = Boolean(product.ownerVerified || ownerProf?.isVerified);
            const canPreOrder = isStoreVerified && (product.isPreOrderEnabled ?? true);

            return (
             <motion.div 
               key={product.id} 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               onClick={() => navigate(`/product/${product.id}`)}
               className={`rounded-2xl sm:rounded-3xl border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full group cursor-pointer active:scale-[0.98] relative ${
                 getThemeClasses('cardBg')
               } hover:border-current/30 shadow-sm`}
             >
              {/* Compact Store Header */}
              {product.ownerId && (
                <div 
                  className={`px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between border-b ${
                    isDarkMode ? 'bg-black/20 border-white/5' : 'bg-black/[0.02] border-black/5'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link to={`/store/${product.ownerId}`} className="flex items-center gap-1.5 min-w-0 group/store">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-yellow-500 shrink-0">
                      <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center text-[9px] font-black ${
                        isDarkMode ? 'border-gray-800 bg-gray-800 text-gray-300' : 'border-white bg-white text-gray-700'
                      }`}>
                        {product.ownerPhotoURL ? (
                          <img src={product.ownerPhotoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (product.ownerName?.charAt(0) || 'م')
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`font-black text-[11px] sm:text-xs truncate transition group-hover/store:opacity-80 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {product.ownerName || 'متجر معتمد'}
                      </span>
                      {isStoreVerified && (
                        <CheckCircle className={`w-3.5 h-3.5 ${getThemeClasses('verified')} shrink-0`} title="متجر موثق ومعتمد رسمياً" />
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-0.5 text-[10px] font-black text-amber-500 shrink-0">
                     <span>★</span>
                     <span>{ownerProf?.averageRating ? Number(ownerProf.averageRating).toFixed(1) : '5.0'}</span>
                  </div>
                </div>
              )}

              {/* Product Image Area */}
              <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800/40 m-2 sm:m-2.5 rounded-xl sm:rounded-2xl group/img">
                {product.image ? (
                  <img 
                    src={product.image} 
                    alt={product.title} 
                    className="w-full h-full object-cover group-hover/img:scale-105 transition duration-500" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800/60">
                    <ImageIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  </div>
                )}

                {/* Local Badge */}
                {(product.category === 'local' || (product.category && String(product.category).includes('محلي'))) && (
                  <div className="absolute top-1.5 right-1.5 bg-[#facc15] text-[#422006] text-[9px] font-black px-2 py-0.5 rounded-lg shadow-md z-10">
                    محلي 🇾🇪
                  </div>
                )}

                {/* Out of Stock Overlay */}
                {product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0 && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20">
                    <span className="text-white font-black text-[10px] sm:text-xs bg-red-600 px-2.5 py-1 rounded-xl">نفذت الكمية</span>
                  </div>
                )}
              </div>

              {/* Product Content */}
              <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3 flex-1 flex flex-col justify-between gap-1 sm:gap-1.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md truncate max-w-[100px] ${
                      isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {product.category}
                    </span>
                  </div>
                  <h3 className={`font-black text-xs sm:text-sm line-clamp-1 group-hover:opacity-80 transition leading-snug ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {product.title}
                  </h3>
                </div>

                {/* Price & Quick Cart Row */}
                <div className={`flex items-center justify-between pt-1 border-t mt-auto ${
                  isDarkMode ? 'border-gray-800' : 'border-gray-50'
                }`}>
                  <div className="flex flex-col">
                    <span className={`text-xs sm:text-base font-black ${getThemeClasses('price')} leading-tight`}>
                      {product.price.toLocaleString()} <span className="text-[10px] opacity-70">ر.ي</span>
                    </span>
                  </div>

                  {user ? (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      disabled={product.stock !== undefined && Number(product.stock) <= 0}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shadow-sm transition-all disabled:opacity-30 ${
                        getThemeClasses('bg')
                      } ${getThemeClasses('hover')} active:scale-90 shrink-0`}
                      title="أضف للسلة"
                    >
                      <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        login();
                      }}
                      className={`px-2 py-1 rounded-xl text-[9px] font-black transition ${
                        isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      شراء
                    </button>
                  )}
                </div>

                {/* Pre-Order (حجز مسبق) Button Under Product - ONLY FOR VERIFIED STORES */}
                {canPreOrder && (
                  <div className="pt-1">
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
                      className={`w-full py-1.5 px-2 rounded-xl border text-[10px] sm:text-xs flex items-center justify-between transition active:scale-95 shadow-xs ${getThemeClasses('bgLight')} ${getThemeClasses('border')} ${getThemeClasses('textDark')}`}
                    >
                      <div className="flex items-center gap-1">
                        <BookmarkCheck className={`w-3.5 h-3.5 ${getThemeClasses('text')}`} />
                        <span className="font-black">حجز مسبق</span>
                      </div>
                      <span className={`text-[9px] font-black ${getThemeClasses('price')}`}>
                        {((product.depositAmount && Number(product.depositAmount) > 0) ? Number(product.depositAmount) : Math.max(1000, Math.round(Number(product.price) * 0.2))).toLocaleString()} ريال
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
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
