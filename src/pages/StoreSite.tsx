import { useState, useEffect } from 'react';
import { ShoppingCart, Home, ShoppingBag, User as UserIcon, MessageSquare, Share2, Image as ImageIcon } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageLoadingSkeleton } from '../components/Skeletons';
import { isProductOfferActive, getProductOfferBadgeText } from '../lib/offerUtils';

export default function StoreSite() {
  const { slug } = useParams();
  const [activeTab, setActiveTab] = useState('all');
  const { addToCart, settings, getThemeClasses, login, cart } = useAppContext();
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
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

    const title = settings?.seoTitle || settings?.storeName || 'يمن ستور';
    const description = settings?.seoDescription || settings?.heroSubtitle || 'تسوق أفضل المنتجات اليمنية بأفضل الأسعار';

    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

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

  const offerProducts = products.filter(isProductOfferActive);

  const filteredProducts = activeTab === 'all'
    ? products
    : activeTab === 'offers'
      ? offerProducts
      : products.filter(p => {
          if (!p.category) return false;
          const target = activeTab.toLowerCase().trim();
          const pCat = String(p.category).toLowerCase().trim();
          const pSlug = String(p.categorySlug || '').toLowerCase().trim();
          return pCat === target || pSlug === target || (target === 'الكترونيات' && pCat.includes('الكترون')) || (pCat.includes(target) || target.includes(pCat));
        });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] dark:bg-[#0A0B0D] pt-4">
        <PageLoadingSkeleton />
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: settings?.storeName || 'متجري',
        text: settings?.heroSubtitle || 'تسوق الآن من أفضل المنتجات',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ الرابط لمشاركته');
    }
  };

  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className="min-h-screen bg-[#F6F5F0] dark:bg-[#0A0B0D] text-[#111214] dark:text-[#F4F4F2] pb-20" dir="rtl">
      {/* Brand Header */}
      <header className="bg-white/95 dark:bg-[#0A0B0D]/95 backdrop-blur-md border-b border-[#E5E2DA] dark:border-[#232730] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            {settings?.storeLogo ? (
              <img
                src={settings.storeLogo}
                alt={settings.storeName || 'Logo'}
                className="h-9 w-auto object-contain rounded-lg bg-white dark:bg-[#131519] p-1 border border-[#E5E2DA] dark:border-[#232730]"
              />
            ) : (
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getThemeClasses('bg')}`}>
                <ShoppingBag className="w-4.5 h-4.5" />
              </div>
            )}
            <span className="font-display font-extrabold text-base sm:text-lg truncate">
              {settings?.storeName || 'المتجر'}
            </span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              aria-label="مشاركة المتجر"
              className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-300 hover:text-[#111214] dark:hover:text-white rounded-lg border border-[#E5E2DA] dark:border-[#232730] transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Link
              to={`/s/${slug}/cart`}
              aria-label="سلة المشتريات"
              className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-300 hover:text-[#111214] dark:hover:text-white rounded-lg border border-[#E5E2DA] dark:border-[#232730] relative transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold tabular-nums rounded-md flex items-center justify-center border border-white dark:border-[#0A0B0D] ${getThemeClasses('bg')}`}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {settings?.showHeroBanner && settings?.heroBanner && (
        <section className="relative h-64 md:h-[26rem] w-full overflow-hidden border-b border-[#E5E2DA] dark:border-[#232730]">
          <img
            src={settings.heroBanner}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            alt={settings.heroTitle || 'واجهة المتجر'}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 flex flex-col justify-end md:justify-center items-start">
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="max-w-xl space-y-3">
                <p className="text-xs font-semibold text-white/80">تشكيلة مختارة بعناية</p>
                {settings.heroTitle && (
                  <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold text-white text-balance">
                    {settings.heroTitle}
                  </h2>
                )}
                {settings.heroSubtitle && (
                  <p className="text-white/85 text-sm md:text-base font-medium leading-relaxed">
                    {settings.heroSubtitle}
                  </p>
                )}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById('products-gallery')?.scrollIntoView({ behavior: 'smooth' })}
                    className="min-h-[44px] bg-white text-[#111214] hover:bg-[#F6F5F0] px-6 py-2.5 rounded-lg font-bold text-sm transition-colors"
                  >
                    ابدأ التسوق الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Catalog */}
      <main id="products-gallery" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Flush Underline Category Rail */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-[#E5E2DA] dark:border-[#232730]">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`min-h-[44px] whitespace-nowrap px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'all'
                ? `${getThemeClasses('border')} text-[#111214] dark:text-white font-bold`
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
            }`}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('offers')}
            className={`min-h-[44px] whitespace-nowrap px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'offers'
                ? `${getThemeClasses('border')} text-[#111214] dark:text-white font-bold`
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
            }`}
          >
            العروض ({offerProducts.length})
          </button>
          {categories.map(cat => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setActiveTab(cat.name)}
              className={`min-h-[44px] whitespace-nowrap px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                activeTab === cat.name
                  ? `${getThemeClasses('border')} text-[#111214] dark:text-white font-bold`
                  : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-8">
            <ShoppingBag className="w-10 h-10 text-[#5C5B57] dark:text-zinc-500 opacity-40 mb-3" />
            <h3 className="text-base font-bold mb-1">لا توجد منتجات</h3>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400">جرب تصفح قسم آخر أو العودة لعرض جميع المنتجات</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
            {filteredProducts.map((product) => {
              const titleText = product.title || product.name || 'منتج';
              const imageSrc = product.image || product.images?.[0];
              const hasOfferActive = isProductOfferActive(product);
              const offerBadge = hasOfferActive ? getProductOfferBadgeText(product) : '';
              const hasCrossedPrice = Number(product.originalPrice || 0) > Number(product.price || 0);

              return (
                <article
                  key={product.id}
                  onClick={() => navigate(`/s/${slug}/product/${product.id}`)}
                  className="group flex flex-col h-full cursor-pointer"
                >
                  <div className="aspect-[4/5] relative overflow-hidden rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] mb-3">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={titleText}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5C5B57] dark:text-zinc-500">
                        <ImageIcon className="w-8 h-8 opacity-40" />
                      </div>
                    )}
                    {offerBadge && (
                      <span className="absolute top-2.5 right-2.5 bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {offerBadge}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col flex-1 justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 block truncate">
                        {product.category || 'منتج'}
                      </span>
                      <h3 className="font-bold text-xs sm:text-sm line-clamp-2 mt-0.5 leading-snug">
                        {titleText}
                      </h3>
                      {hasOfferActive && (product.offerExtras || product.offerTitle) && (
                        <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 line-clamp-1 mt-0.5">
                          {product.offerExtras || product.offerTitle}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`text-sm sm:text-base font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                          {Number(product.price || 0).toLocaleString()} <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                        </span>
                        {hasCrossedPrice && (
                          <span className="text-[11px] text-[#5C5B57] dark:text-zinc-500 line-through tabular-nums">
                            {Number(product.originalPrice).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        aria-label="أضف للسلة"
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Mobile Nav Bar */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/95 dark:bg-[#0A0B0D]/95 backdrop-blur-md border-t border-[#E5E2DA] dark:border-[#232730] px-4 flex justify-around items-center h-14 z-50 md:hidden">
        <Link to={`/s/${slug}`} className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#111214] dark:text-white font-bold">
          <Home className="w-5 h-5" />
          <span className="text-[10px]">الرئيسية</span>
        </Link>
        <Link to={`/s/${slug}/cart`} className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white">
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px]">السلة</span>
        </Link>
        <Link to={`/s/${slug}/orders`} className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[10px]">طلباتي</span>
        </Link>
        <button type="button" onClick={login} className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white">
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px]">حسابي</span>
        </button>
      </nav>

      <footer className="border-t border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] py-12 mt-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-right">
            <h2 className="font-display text-lg font-extrabold">{settings?.storeName || 'المتجر'}</h2>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
              جميع الحقوق محفوظة © {new Date().getFullYear()} {settings?.storeName || 'يمن ستور'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/contact"
              className="min-h-[40px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold flex items-center gap-2 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>تواصل معنا</span>
            </Link>
            <Link
              to="/safety-guide"
              className="min-h-[40px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold flex items-center gap-2 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors"
            >
              <span>دليل الأمان</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
