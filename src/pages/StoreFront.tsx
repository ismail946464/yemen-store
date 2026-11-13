import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShoppingCart, CheckCircle, Image as ImageIcon, ShieldAlert,
  BookmarkCheck, ChevronRight, ChevronLeft, LayoutGrid,
  Laptop, Smartphone, Shirt, Sparkles, MapPin, Watch,
  ShoppingBag, Heart, Home, Gamepad2, Tag, Search,
  SlidersHorizontal, X, ArrowUpDown, ShieldCheck, Percent
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import PreOrderModal from '../components/PreOrderModal';
import { ProductGridSkeleton } from '../components/Skeletons';
import { isProductOfferActive, getProductOfferBadgeText } from '../lib/offerUtils';

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
  if (s.includes('elect') || s.includes('الكترون') || s.includes('إلكترون') || s === '11') return <Laptop className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('phone') || s.includes('هاتف') || s.includes('جوال') || s.includes('تلفون')) return <Smartphone className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('fashion') || s.includes('ملابس') || s.includes('ازياء') || s.includes('أزياء')) return <Shirt className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('perfume') || s.includes('عطر') || s.includes('بخور') || s.includes('عود')) return <Sparkles className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('local') || s.includes('محلي') || s.includes('يمن')) return <MapPin className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('watch') || s.includes('ساع') || s.includes('اكسسوار')) return <Watch className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('shoe') || s.includes('bag') || s.includes('حقائب') || s.includes('أحذية') || s.includes('شنط')) return <ShoppingBag className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('beauty') || s.includes('جمال') || s.includes('عناية') || s.includes('مكياج')) return <Heart className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('home') || s.includes('منزل') || s.includes('مطبخ') || s.includes('اثاث')) return <Home className="w-3.5 h-3.5 shrink-0" />;
  if (s.includes('game') || s.includes('ألعاب') || s.includes('العاب') || s.includes('ترفيه')) return <Gamepad2 className="w-3.5 h-3.5 shrink-0" />;
  return <Tag className="w-3.5 h-3.5 shrink-0" />;
};

const ProductCardImage = ({ src, alt }: { src?: string; alt: string }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-500">
        <ImageIcon className="w-8 h-8 opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover group-hover/card:scale-[1.03] transition-transform duration-300"
    />
  );
};

export default function StoreFront() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const { addToCart, settings, getThemeClasses, user, login, isStore, isAdmin } = useAppContext();
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
        left: direction === 'right' ? 240 : -240,
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

  const offerProducts = useMemo(() => {
    return products
      .filter(isProductOfferActive)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  }, [products]);

  const filteredProducts = useMemo(() => {
    const activeCatObj = allAvailableCategories.find(c => c.slug === activeTab);
    const term = searchQuery.trim().toLowerCase();

    const list = products.filter(p => {
      if (activeTab === 'offers') {
        if (!isProductOfferActive(p)) return false;
      } else if (activeTab !== 'all' && !isProductInCategory(p, activeTab, activeCatObj?.name)) {
        return false;
      }
      if (verifiedOnly) {
        const ownerProf = p.ownerId ? storeProfiles[p.ownerId] : null;
        if (!Boolean(p.ownerVerified || ownerProf?.isVerified)) return false;
      }
      if (term) {
        const matchTitle = String(p.title || '').toLowerCase().includes(term);
        const matchCat = String(p.category || '').toLowerCase().includes(term);
        const matchStore = String(p.ownerName || '').toLowerCase().includes(term);
        const matchOffer = String(p.offerTitle || '').toLowerCase().includes(term) || String(p.offerExtras || '').toLowerCase().includes(term);
        if (!matchTitle && !matchCat && !matchStore && !matchOffer) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') {
      return [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortBy === 'price-desc') {
      return [...list].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    return [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [products, activeTab, allAvailableCategories, verifiedOnly, storeProfiles, searchQuery, sortBy]);

  const getCategoryProductCount = (categorySlug: string, categoryName: string) => {
    if (categorySlug === 'all') return products.length;
    if (categorySlug === 'offers') return offerProducts.length;
    return products.filter(p => isProductInCategory(p, categorySlug, categoryName)).length;
  };

  return (
    <div className="space-y-8">
      {/* Optional Store Hero Banner */}
      {settings?.showHeroBanner && settings?.heroBanner && (
        <section className="w-full rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] relative group min-h-[240px] md:min-h-[340px]">
          <img
            src={settings.heroBanner}
            alt={settings.heroTitle || settings.storeName || 'واجهات المتجر'}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 flex flex-col justify-end md:justify-center items-start p-6 sm:p-10 text-right">
            <div className="max-w-xl space-y-3">
              {(settings.heroTitle || settings.storeName) && (
                <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight text-balance">
                  {settings.heroTitle || settings.storeName}
                </h2>
              )}
              {settings.heroSubtitle && (
                <p className="text-sm sm:text-base text-white/85 font-medium leading-relaxed">
                  {settings.heroSubtitle}
                </p>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (settings?.heroLink && settings.heroLink.trim() !== '' && settings.heroLink !== '#' && !settings.heroLink.startsWith('#')) {
                      if (settings.heroLink.startsWith('http')) {
                        window.location.href = settings.heroLink;
                      } else {
                        navigate(settings.heroLink);
                      }
                    } else {
                      document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="bg-white text-[#111214] hover:bg-[#F6F5F0] min-h-[44px] px-6 py-2.5 rounded-lg font-bold text-sm transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>{settings.heroButtonText || 'استكشف المنتجات'}</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Store Offers Showcase Section (خانة العروض) */}
      {!isLoading && activeTab === 'all' && !searchQuery.trim() && !verifiedOnly && (
        <section id="offers-section" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
            <div className="flex items-center gap-2.5">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getThemeClasses('bg')}`}>
                <Percent className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                  العروض والخصومات
                </h2>
                <p className="text-[11px] sm:text-xs text-[#5C5B57] dark:text-zinc-400">
                  تخفيضات مباشرة وإضافات مجانية متاحة من المتاجر
                </p>
              </div>
            </div>

            {offerProducts.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('offers');
                  document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] inline-flex items-center gap-1.5 transition-colors"
              >
                <span>عرض كل العروض ({offerProducts.length})</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            ) : (isStore || isAdmin) ? (
              <Link
                to="/admin?tab=products"
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] inline-flex items-center gap-1.5 transition-colors"
              >
                <span>إضافة عرض لمنتج</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            ) : null}
          </div>

          {offerProducts.length === 0 ? (
            <div className="p-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs sm:text-sm font-medium text-[#5C5B57] dark:text-zinc-400">
                لا توجد عروض مفعّلة حالياً — ستظهر هنا تخفيضات المنتجات والهدايا المجانية فور إضافتها من المتاجر.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {offerProducts.slice(0, 4).map((product) => {
                const ownerProf = product.ownerId ? storeProfiles[product.ownerId] : null;
                const isStoreVerified = Boolean(product.ownerVerified || ownerProf?.isVerified);
                const badgeText = getProductOfferBadgeText(product);
                const hasCrossedPrice = Number(product.originalPrice || 0) > Number(product.price || 0);

                return (
                  <article
                    key={`offer-${product.id}`}
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="group/card rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-3 flex flex-col justify-between gap-3 cursor-pointer hover:border-[#111214]/40 dark:hover:border-zinc-500 transition-colors"
                  >
                    <div>
                      <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] mb-3">
                        <ProductCardImage src={product.image || product.images?.[0]} alt={product.title} />
                        {badgeText && (
                          <span className="absolute top-2 right-2 bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {badgeText}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 truncate">
                          <span className="truncate">{product.ownerName || 'متجر معتمد'}</span>
                          {isStoreVerified && <CheckCircle className={`w-3 h-3 shrink-0 ${getThemeClasses('verified')}`} />}
                        </div>
                        <h3 className="font-bold text-xs sm:text-sm line-clamp-1 text-[#111214] dark:text-[#F4F4F2]">
                          {product.title}
                        </h3>
                        {(product.offerExtras || product.offerTitle) && (
                          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 line-clamp-1">
                            {product.offerExtras || product.offerTitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`text-sm font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                          {Number(product.price || 0).toLocaleString()} ر.ي
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
                          e.preventDefault();
                          e.stopPropagation();
                          if (!user) { login(); return; }
                          addToCart(product);
                        }}
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                        title="إضافة إلى السلة"
                        aria-label="إضافة إلى السلة"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Storefront Header & Flush Underline Filter Rail */}
      <section id="products-section" className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-balance text-[#111214] dark:text-[#F4F4F2]">
              {settings?.storeName || 'يمن ستور'} — دليل المنتجات والمتاجر
            </h1>
            <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400">
              منتجات مختارة من متاجر موثقة مع توصيل مباشر وخيار الحجز المسبق بالعربون
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 lg:w-[460px] shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتج، قسم، أو متجر..."
                className="w-full min-h-[44px] pr-10 pl-8 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs sm:text-sm font-medium text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 outline-none focus:border-[#111214] dark:focus:border-zinc-400 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5C5B57] hover:text-[#111214] dark:hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Link
              to="/search-stores"
              className={`min-h-[44px] px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
            >
              <span>تصفح المتاجر</span>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Flush Horizontal Category Rail */}
        <div className="relative border-b border-[#E5E2DA] dark:border-[#232730]" dir="rtl">
          <div className="flex items-center justify-between gap-4">
            <div
              ref={categoriesScrollRef}
              className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth flex-1"
            >
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`shrink-0 min-h-[44px] flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'all'
                    ? `${getThemeClasses('border')} text-[#111214] dark:text-white font-bold`
                    : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>الكل</span>
                <span className="text-[11px] opacity-65 tabular-nums">({products.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('offers')}
                className={`shrink-0 min-h-[44px] flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'offers'
                    ? `${getThemeClasses('border')} text-[#111214] dark:text-white font-bold`
                    : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>العروض</span>
                <span className="text-[11px] opacity-65 tabular-nums">({offerProducts.length})</span>
              </button>

              {allAvailableCategories.map((c: any) => {
                const isActive = activeTab === c.slug || activeTab === c.name;
                const count = getCategoryProductCount(c.slug, c.name);
                return (
                  <button
                    type="button"
                    key={c.id || c.slug}
                    onClick={() => setActiveTab(c.slug)}
                    className={`shrink-0 min-h-[44px] flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? `${getThemeClasses('border')} text-[#111214] dark:text-white font-bold`
                        : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                    }`}
                  >
                    {getCategoryIcon(c.slug || c.name)}
                    <span>{c.name}</span>
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

        {/* Unboxed Secondary Toolbar: Count, Verified Toggle & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">
            {isLoading ? 'جاري التحميل...' : `عرض ${filteredProducts.length} منتج`}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setVerifiedOnly(v => !v)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                verifiedOnly
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>متاجر موثقة فقط</span>
            </button>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#5C5B57] dark:text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="ترتيب المنتجات"
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold outline-none cursor-pointer"
              >
                <option value="newest">الأحدث</option>
                <option value="price-asc">الأقل سعراً</option>
                <option value="price-desc">الأعلى سعراً</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Product Catalog Grid */}
      {isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-8">
          <SlidersHorizontal className="w-9 h-9 mx-auto mb-3 text-[#5C5B57] dark:text-zinc-500 opacity-50" />
          <p className="text-sm sm:text-base font-bold text-[#111214] dark:text-[#F4F4F2]">لا توجد منتجات مطابقة لبحثك حالياً</p>
          <p className="text-xs mt-1 text-[#5C5B57] dark:text-zinc-400">جرب تغيير القسم أو إزالة فلاتر البحث</p>
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setSearchQuery('');
              setVerifiedOnly(false);
            }}
            className={`mt-4 min-h-[40px] px-5 py-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} font-bold text-xs transition-colors`}
          >
            إعادة تعيين وعرض الكل
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
          {filteredProducts.map((product) => {
            const ownerProf = product.ownerId ? storeProfiles[product.ownerId] : null;
            const isStoreVerified = Boolean(product.ownerVerified || ownerProf?.isVerified);
            const canPreOrder = isStoreVerified && (product.isPreOrderEnabled ?? true);
            const depositAmt = (product.depositAmount && Number(product.depositAmount) > 0)
              ? Number(product.depositAmount)
              : Math.max(1000, Math.round(Number(product.price) * 0.2));
            const hasOfferActive = isProductOfferActive(product);
            const offerBadge = hasOfferActive ? getProductOfferBadgeText(product) : '';
            const hasCrossedPrice = Number(product.originalPrice || 0) > Number(product.price || 0);

            return (
              <article
                key={product.id}
                onClick={() => navigate(`/product/${product.id}`)}
                className="group/card flex flex-col h-full cursor-pointer"
              >
                {/* Matte Product Media Frame */}
                <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] mb-3">
                  <ProductCardImage src={product.image || product.images?.[0]} alt={product.title} />

                  {offerBadge ? (
                    <span className="absolute top-2.5 right-2.5 bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {offerBadge}
                    </span>
                  ) : (product.category === 'local' || (product.category && String(product.category).includes('محلي'))) && (
                    <span className="absolute top-2.5 right-2.5 bg-[#111214]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      منتج محلي
                    </span>
                  )}

                  {product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0 && (
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-10">
                      <span className="text-white font-bold text-xs bg-[#111214] px-3 py-1 rounded-md">نفدت الكمية</span>
                    </div>
                  )}
                </div>

                {/* Unboxed Clean Product Typography */}
                <div className="flex-1 flex flex-col justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 truncate" onClick={(e) => e.stopPropagation()}>
                      {product.ownerId ? (
                        <Link to={`/store/${product.ownerId}`} className="inline-flex items-center gap-1 hover:text-[#111214] dark:hover:text-white truncate">
                          <span className="truncate">{product.ownerName || 'متجر معتمد'}</span>
                          {isStoreVerified && <CheckCircle className={`w-3 h-3 shrink-0 ${getThemeClasses('verified')}`} />}
                        </Link>
                      ) : (
                        <span className="truncate">{product.category || 'منتج'}</span>
                      )}
                      {ownerProf?.averageRating ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums shrink-0">★ {Number(ownerProf.averageRating).toFixed(1)}</span>
                        </>
                      ) : null}
                    </div>

                    <h3 className="font-bold text-xs sm:text-sm line-clamp-2 text-[#111214] dark:text-[#F4F4F2] leading-snug">
                      {product.title}
                    </h3>

                    {hasOfferActive && (product.offerExtras || product.offerTitle) && (
                      <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 line-clamp-1">
                        {product.offerExtras || product.offerTitle}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-1.5">
                    <div className="flex items-center justify-between gap-2">
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

                      {user ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          disabled={product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 disabled:opacity-30 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                          title="إضافة إلى السلة"
                          aria-label="إضافة إلى السلة"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            login();
                          }}
                          className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors"
                        >
                          شراء
                        </button>
                      )}
                    </div>

                    {canPreOrder && (
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
                        className="w-full min-h-[34px] py-1.5 px-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[11px] flex items-center justify-between transition-colors text-[#111214] dark:text-[#F4F4F2]"
                      >
                        <span className="flex items-center gap-1 font-semibold text-[#5C5B57] dark:text-zinc-300">
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          <span>حجز مسبق</span>
                        </span>
                        <span className="font-bold tabular-nums">
                          {depositAmt.toLocaleString()} ر.ي
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Quiet Editorial Footer Link */}
      <footer className="mt-10 pt-6 border-t border-[#E5E2DA] dark:border-[#232730] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
        <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
          جميع المعاملات تخضع لإرشادات الأمان والتحقق الخاصة بالمنصة.
        </p>
        <Link
          to="/safety-guide"
          className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-rose-700 dark:text-rose-400 font-bold text-xs transition-colors"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>دليل الأمان ومكافحة الاحتيال</span>
        </Link>
      </footer>

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
