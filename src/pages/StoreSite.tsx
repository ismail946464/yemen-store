import { useState, useEffect } from 'react';
import { ShoppingCart, CheckCircle, Home, ShoppingBag, User as UserIcon, MessageSquare, PhoneCall, Share2 } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function StoreSite() {
  const { slug } = useParams();
  const [activeTab, setActiveTab] = useState('all');
  const { addToCart, settings, getThemeClasses, user, login, cart } = useAppContext();
  const navigate = useNavigate();
  const themeColor = settings?.storeTheme || 'green';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // In a real multi-tenant app, we would fetch settings for this specific slug
        // For now, we assume the global settings apply to this store
        const [prodSnap, catSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'categories'))
        ]);
        
        setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Error loading products", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
    
    // Set document title and SEO meta tags
    const title = settings?.seoTitle || settings?.storeName || 'Yemani Market';
    const description = settings?.seoDescription || settings?.heroSubtitle || 'تسوق أفضل المنتجات اليمنية بأفضل الأسعار';
    
    document.title = title;
    
    // Update description meta
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // Update keywords meta
    if (settings?.seoKeywords) {
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (!metaKeywords) {
        metaKeywords = document.createElement('meta');
        metaKeywords.setAttribute('name', 'keywords');
        document.head.appendChild(metaKeywords);
      }
      metaKeywords.setAttribute('content', settings.seoKeywords);
    }
  }, [settings]);

  const filteredProducts = activeTab === 'all' 
    ? products 
    : products.filter(p => {
        if (!p.category) return false;
        const target = activeTab.toLowerCase().trim();
        const pCat = String(p.category).toLowerCase().trim();
        const pSlug = String(p.categorySlug || '').toLowerCase().trim();
        return pCat === target || pSlug === target || (target === 'الكترونيات' && pCat.includes('الكترون')) || (pCat.includes(target) || target.includes(pCat));
      });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${getThemeClasses('border')}`}></div>
          <p className="text-gray-500 font-bold animate-pulse">جاري تحميل المتجر...</p>
        </div>
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: settings?.storeName || 'متجري',
        text: settings?.heroSubtitle || 'تسوق الآن من أفضل المنتجات',
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ الرابط لمشاركته');
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20 font-sans" dir="rtl">
      {/* Brand Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-50 sticky top-0 z-50 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              {settings?.storeLogo ? (
                <img src={settings.storeLogo} alt="Logo" className="h-10 sm:h-12 w-auto object-contain rounded-xl bg-white p-1 shadow-sm border border-gray-100 group-hover:scale-105 transition" />
              ) : (
                <div className={`${getThemeClasses('bg')} p-2.5 rounded-2xl shadow-lg text-white group-hover:rotate-3 transition`}>
                  <ShoppingBag className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="flex flex-col leading-tight">
              <h1 className="font-black text-lg sm:text-xl text-gray-900 group-hover:text-blue-600 transition">{settings?.storeName || 'المتجر'}</h1>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider opacity-60">تسوق بأمان</span>
            </div>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={handleShare} className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition border border-gray-100">
              <Share2 className="w-5 h-5" />
            </button>
            <Link to={`/s/${slug}/cart`} className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition border border-gray-100 relative group">
              <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
                  {cart.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {settings?.showHeroBanner && settings?.heroBanner && (
        <section className="relative h-60 md:h-[28rem] w-full overflow-hidden bg-white mb-8">
          <div className="absolute inset-0 bg-white">
            <img 
              src={settings.heroBanner} 
              className="w-full h-full object-cover opacity-90 scale-105"
              alt="Hero"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-white via-white/40 to-transparent"></div>
          </div>
          <div className="relative h-full max-w-7xl mx-auto px-6 sm:px-8 flex flex-col justify-center items-start">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-xl"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black mb-6 shadow-xl shadow-blue-500/20">
                <CheckCircle className="w-3.5 h-3.5" />
                منتجات مختارة بعناية
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-black mb-4 leading-tight drop-shadow-sm">{settings.heroTitle}</h2>
              <p className="text-gray-800 text-sm md:text-lg font-bold max-w-lg mb-8 leading-relaxed">{settings.heroSubtitle}</p>
              <button onClick={() => {
                const gallery = document.getElementById('products-gallery');
                gallery?.scrollIntoView({ behavior: 'smooth' });
              }} className="bg-black text-white px-8 py-4 rounded-[2rem] font-black text-sm shadow-2xl shadow-black/10 hover:translate-y-[-4px] transition active:translate-y-0">
                ابدأ التسوق الآن
              </button>
            </motion.div>
          </div>
        </section>
      )}

      {/* Content */}
      <main id="products-gallery" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Categories Bar */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar mb-10 sticky top-20 bg-white/90 backdrop-blur-md z-40 pt-4">
          <button
            onClick={() => setActiveTab('all')}
            className={`whitespace-nowrap px-8 py-3.5 rounded-[1.75rem] font-black text-xs transition-all border-2 ${activeTab === 'all' ? `bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-500/20 scale-105` : 'bg-white text-gray-900 border-gray-100 hover:border-gray-200'}`}
          >
            الكل
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.name)}
              className={`whitespace-nowrap px-8 py-3.5 rounded-[1.75rem] font-black text-xs transition-all border-2 ${activeTab === cat.name ? `bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-500/20 scale-105` : 'bg-white text-gray-900 border-gray-100 hover:border-gray-200'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {filteredProducts.map((product) => (
            <motion.div 
              layout
              key={product.id} 
              className="bg-white rounded-[2.5rem] border border-gray-50 shadow-sm overflow-hidden group hover:shadow-2xl hover:shadow-black/5 transition-all duration-500 h-full flex flex-col cursor-pointer relative"
              onClick={() => navigate(`/s/${slug}/product/${product.id}`)}
            >
               <div className="aspect-[4/5] relative overflow-hidden bg-gray-50 p-2">
                <div className="w-full h-full rounded-[2rem] overflow-hidden">
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-700" 
                  />
                </div>
                
                <div className="absolute top-4 right-4 z-10">
                   <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl text-[10px] font-black text-gray-900 shadow-sm border border-white/50">
                      {product.category}
                   </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-500"></div>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(product);
                  }}
                  className="absolute bottom-6 left-6 right-6 bg-white text-gray-900 py-3.5 rounded-2xl font-black text-xs shadow-2xl shadow-black/20 transform translate-y-20 group-hover:translate-y-0 transition-all duration-500 flex items-center justify-center gap-2 hover:bg-gray-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  أضف للسلة
                </button>
              </div>
              <div className="p-6 pt-2 flex flex-col flex-1">
                <h3 className="font-black text-black group-hover:opacity-80 transition-colors line-clamp-1 mb-2 text-lg">{product.name}</h3>
                <p className="text-xs text-gray-700 mb-6 line-clamp-2 leading-relaxed font-bold">{product.description}</p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">السعر</span>
                    <span className={`text-xl font-black ${getThemeClasses('price')}`}>
                      {product.price.toLocaleString()} <span className="text-xs font-black text-gray-500 mr-0.5">ر.ي</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-gray-100 p-8 rounded-full mb-6">
              <ShoppingBag className="w-16 h-16 text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">لا توجد منتجات</h3>
            <p className="text-gray-500">جرب البحث عن شيء آخر أو تصفح الأقسام الأخرى</p>
          </div>
        )}
      </main>

      {/* Mobile Nav Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-gray-100 p-3 px-8 flex justify-between items-center z-50 md:hidden shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] rounded-t-[2.5rem]">
         <Link to={`/store-site/${slug}`} className="flex flex-col items-center gap-1 text-blue-600 transition scale-110">
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-black">الرئيسية</span>
         </Link>
         <Link to={`/s/${slug}/cart`} className="flex flex-col items-center gap-1 text-gray-300 hover:text-gray-900 transition">
            <ShoppingCart className="w-6 h-6" />
            <span className="text-[10px] font-black">السلة</span>
         </Link>
         <Link to={`/s/${slug}/orders`} className="flex flex-col items-center gap-1 text-gray-300 hover:text-gray-900 transition">
            <ShoppingBag className="w-6 h-6" />
            <span className="text-[10px] font-black">طلباتي</span>
         </Link>
         <button onClick={login} className="flex flex-col items-center gap-1 text-gray-300 hover:text-gray-900 transition">
            <UserIcon className="w-6 h-6" />
            <span className="text-[10px] font-black">حسابي</span>
         </button>
      </div>

      <footer className="bg-white border-t border-gray-50 py-20 mt-20 px-8 text-center">
          <div className="flex flex-col items-center max-w-2xl mx-auto">
            <div className={`w-16 h-16 ${getThemeClasses('bg')} rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl shadow-blue-500/20`}>
               <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black mb-4 text-gray-900">{settings?.storeName}</h2>
                <p className="text-gray-900 font-black mb-10 leading-relaxed">نحن نسعى دائماً لتقديم أفضل تجربة تسوق لعملائنا في جميع أنحاء اليمن.</p>
            
            <div className="flex justify-center gap-4 mb-12">
               <a href="#" className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-400 hover:bg-blue-600 hover:text-white transition shadow-sm">
                  <MessageSquare className="w-5 h-5" />
               </a>
               <a href="#" className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-400 hover:bg-green-600 hover:text-white transition shadow-sm">
                  <PhoneCall className="w-5 h-5" />
               </a>
            </div>
            
            <div className="w-full h-[1px] bg-gray-100 mb-8"></div>
            <p className="text-gray-900 text-xs font-black tracking-widest uppercase">جميع الحقوق محفوظة © 2026 {settings?.storeName}</p>
          </div>
      </footer>
</div>
  );
}
