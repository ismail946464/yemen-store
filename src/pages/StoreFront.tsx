import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, CheckCircle, Image as ImageIcon, ShieldAlert, 
  BookmarkCheck, ChevronRight, ChevronLeft, LayoutGrid, 
  Laptop, Smartphone, Shirt, Sparkles, MapPin, Watch, 
  ShoppingBag, Heart, Home, Gamepad2, Layers, Tag, Search, Bot
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
      <div id="products-section" className={`rounded-2xl sm:rounded-3xl p-6 sm:p-10 border flex flex-col items-center text-center space-y-6 transition-colors shadow-2xs ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-neutral-200'
      }`}>
        <div className="max-w-2xl space-y-2">
          <h1 className={`text-2xl sm:text-4xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
            أهلاً بك في {settings?.storeName || 'يمن ستور'}
          </h1>
          <p className={`text-sm sm:text-base font-normal max-w-xl mx-auto ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
            سوق مركزي يضم نخبة المتاجر الموثقة والمنتجات الأصلية مع خدمات التوصيل والحجز المسبق المعتمد.
          </p>
        </div>

        <div className="w-full max-w-xl flex flex-col sm:flex-row gap-2.5">
          <Link 
            to="/search-stores" 
            className={`flex-1 flex items-center justify-between border px-4 py-3 rounded-xl transition duration-150 ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-200' 
                : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
            }`}
          >
            <span className="text-sm font-semibold">ابحث عن المتاجر والمنتجات...</span>
            <Search className="w-4 h-4 text-neutral-400" />
          </Link>

          <Link 
            to="/contact?to=ai_assistant" 
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition border ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                : 'bg-neutral-900 hover:bg-black text-white border-neutral-900 shadow-xs'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>مستشار المتجر</span>
          </Link>
        </div>

        {/* Horizontal Scrollable Categories Bar */}
        <div className="w-full relative pt-2" dir="rtl">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-neutral-500" />
              <h3 className={`text-sm sm:text-base font-bold ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                الأقسام والتصنيفات
              </h3>
            </div>

            {/* Scroll navigation arrows */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollCategories('right')}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition active:scale-90 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
                title="تمرير لليمين"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCategories('left')}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition active:scale-90 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
                title="تمرير لليسار"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Horizontal Scrolling Track */}
          <div 
            ref={categoriesScrollRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 -mx-1"
          >
            {/* "الكل" Option */}
            <button
              onClick={() => setActiveTab('all')}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 border select-none active:scale-95 ${
                activeTab === 'all'
                  ? (isDarkMode ? 'bg-white text-neutral-900 border-white shadow-xs' : 'bg-neutral-900 text-white border-neutral-900 shadow-xs')
                  : (isDarkMode ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800' : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200')
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="whitespace-nowrap">جميع الأقسام</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                activeTab === 'all' 
                  ? (isDarkMode ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-800 text-white') 
                  : (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-neutral-200 text-neutral-600')
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
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 border select-none active:scale-95 ${
                    isActive
                      ? (isDarkMode ? 'bg-white text-neutral-900 border-white shadow-xs' : 'bg-neutral-900 text-white border-neutral-900 shadow-xs')
                      : (isDarkMode ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800' : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200')
                  }`}
                >
                  <div className="shrink-0">
                    {getCategoryIcon(c.slug || c.name)}
                  </div>
                  <span className="whitespace-nowrap">{c.name}</span>
                  {count > 0 && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      isActive 
                        ? (isDarkMode ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-800 text-white') 
                        : (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-neutral-200 text-neutral-600')
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
               initial={{ opacity: 0, y: 15 }}
               animate={{ opacity: 1, y: 0 }}
               onClick={() => navigate(`/product/${product.id}`)}
               className={`rounded-2xl border overflow-hidden hover:border-neutral-400 dark:hover:border-slate-600 transition-all duration-200 flex flex-col h-full group cursor-pointer active:scale-[0.99] relative shadow-2xs ${
                 isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-neutral-200'
               }`}
             >
              {/* Clean Store Header */}
              {product.ownerId && (
                <div 
                  className={`px-3 py-2 flex items-center justify-between border-b ${
                    isDarkMode ? 'bg-slate-850/50 border-slate-800' : 'bg-neutral-50/70 border-neutral-100'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link to={`/store/${product.ownerId}`} className="flex items-center gap-1.5 min-w-0 group/store">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-neutral-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-slate-800 text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
                      {product.ownerPhotoURL ? (
                        <img src={product.ownerPhotoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (product.ownerName?.charAt(0) || 'م')
                      )}
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-bold text-xs truncate text-neutral-900 dark:text-white transition group-hover/store:text-neutral-600">
                        {product.ownerName || 'متجر معتمد'}
                      </span>
                      {isStoreVerified && (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" title="متجر موثق ومعتمد" />
                      )}
                    </div>
                  </Link>

                  <div className="text-[11px] font-medium text-neutral-500 tabular-nums shrink-0">
                     ★ {ownerProf?.averageRating ? Number(ownerProf.averageRating).toFixed(1) : '5.0'}
                  </div>
                </div>
              )}

              {/* Product Image Area */}
              <div className="relative aspect-square overflow-hidden bg-neutral-50 dark:bg-slate-800/40 m-2 rounded-xl group/img">
                {product.image ? (
                  <img 
                    src={product.image} 
                    alt={product.title} 
                    className="w-full h-full object-cover group-hover/img:scale-103 transition duration-300" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-slate-800 text-neutral-400">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}

                {/* Quiet Local Tag */}
                {(product.category === 'local' || (product.category && String(product.category).includes('محلي'))) && (
                  <div className="absolute top-2 right-2 bg-neutral-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                    محلي 🇾🇪
                  </div>
                )}

                {/* Out of Stock Overlay */}
                {product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0 && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-20">
                    <span className="text-white font-bold text-xs bg-neutral-900/90 px-3 py-1 rounded-lg">نفذت الكمية</span>
                  </div>
                )}
              </div>

              {/* Product Content */}
              <div className="px-3 pb-3 flex-1 flex flex-col justify-between gap-1.5">
                <div>
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block truncate">
                    {product.category || 'منتج'}
                  </span>
                  <h3 className="font-bold text-xs sm:text-sm line-clamp-1 text-neutral-950 dark:text-white leading-snug">
                    {product.title}
                  </h3>
                </div>

                {/* Price & Quick Cart Row */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-slate-800 mt-auto">
                  <div className="flex flex-col">
                    <span className="text-sm sm:text-base font-bold text-neutral-950 dark:text-white tabular-nums leading-tight">
                      {product.price.toLocaleString()} <span className="text-[10px] font-normal text-neutral-500">ر.ي</span>
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
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all bg-neutral-900 hover:bg-black text-white active:scale-90 shrink-0 disabled:opacity-30 shadow-xs"
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
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition bg-neutral-100 hover:bg-neutral-200 text-neutral-800 dark:bg-slate-800 dark:text-slate-200"
                    >
                      شراء
                    </button>
                  )}
                </div>

                {/* Pre-Order (حجز مسبق) Button Under Product */}
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
                      className="w-full py-1 px-2 rounded-lg border border-neutral-200 dark:border-slate-700 bg-neutral-50 dark:bg-slate-800 hover:bg-neutral-100 text-[10px] sm:text-xs flex items-center justify-between transition text-neutral-800 dark:text-neutral-200"
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        <BookmarkCheck className="w-3 h-3 text-neutral-600 dark:text-neutral-400" />
                        <span>حجز مسبق</span>
                      </div>
                      <span className="text-[10px] font-bold text-neutral-900 dark:text-white tabular-nums">
                        عربون: {((product.depositAmount && Number(product.depositAmount) > 0) ? Number(product.depositAmount) : Math.max(1000, Math.round(Number(product.price) * 0.2))).toLocaleString()} ر.ي
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
