import React, { Suspense, lazy, memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShoppingCart, Image as ImageIcon,
  BookmarkCheck, ChevronRight, ChevronLeft, LayoutGrid,
  Laptop, Smartphone, Shirt, Sparkles, MapPin, Watch,
  ShoppingBag, Heart, Home, Gamepad2, Tag, Search,
  SlidersHorizontal, X, ArrowUpDown, ShieldCheck, Percent, Layers, Store, Gavel, Eye, Columns2, UserCheck
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import ProductPublisherMiniCard from '../components/ProductPublisherMiniCard';
import HeroBannerAds from '../components/HeroBannerAds';
import { ProductGridSkeleton } from '../components/Skeletons';
import { isProductOfferActive, getProductOfferBadgeText } from '../lib/offerUtils';
import { getAvailableProductVariants, buildBaseProductForCart } from '../lib/variantUtils';
import { getStockLimit, isItemOutOfStock, calculateSafeDeposit } from '../lib/stockUtils';

const PreOrderModal = lazy(() => import('../components/PreOrderModal'));
const ProductVariantsModal = lazy(() => import('../components/ProductVariantsModal'));
const QuickViewModal = lazy(() => import('../components/QuickViewModal'));

const INITIAL_VISIBLE_PRODUCTS = 24;
const PRODUCTS_BATCH_SIZE = 24;

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

const ProductCardImage = ({ src, secondarySrc, alt }: { src?: string; secondarySrc?: string; alt: string }) => {
  const [failed, setFailed] = useState(false);
  const [secFailed, setSecFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-500">
        <ImageIcon className="w-8 h-8 opacity-50" />
      </div>
    );
  }
  return (
    <div className="relative w-full h-full">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover group-hover/card:scale-[1.03] transition-transform duration-300"
      />
      {secondarySrc && !secFailed && (
        <img
          src={secondarySrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setSecFailed(true)}
          className="hidden sm:block absolute inset-0 w-full h-full object-cover opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"
        />
      )}
    </div>
  );
};

const StoreFrontProductCard = memo(function StoreFrontProductCard({
  product,
  ownerProf,
  inCartQty,
  themeClasses,
  hasUser,
  isFav,
  onNavigate,
  onLogin,
  onAddToCart,
  onOpenPreOrder,
  onOpenVariants,
  onToggleFavorite,
  onQuickView,
}: {
  product: any;
  ownerProf: any;
  inCartQty: number;
  themeClasses: { price: string; bg: string; hover: string };
  hasUser: boolean;
  isFav: boolean;
  onNavigate: (path: string) => void;
  onLogin: () => void;
  onAddToCart: (p: any) => void;
  onOpenPreOrder: (p: any) => void;
  onOpenVariants: (p: any) => void;
  onToggleFavorite: (id: string) => void;
  onQuickView: (p: any) => void;
}) {
  const isStoreVerified = Boolean(product.ownerVerified || ownerProf?.isVerified);
  const isNoDelivery = Boolean(product.noDelivery);
  const canPreOrder = isNoDelivery || (isStoreVerified && (product.isPreOrderEnabled ?? true));
  const depositAmt = calculateSafeDeposit(Number(product.price || 0), product.depositAmount);
  const hasOfferActive = isProductOfferActive(product);
  const offerBadge = hasOfferActive ? getProductOfferBadgeText(product) : '';
  const hasCrossedPrice = Number(product.originalPrice || 0) > Number(product.price || 0);
  const savePct = hasCrossedPrice && Number(product.originalPrice) > 0
    ? Math.round(((Number(product.originalPrice) - Number(product.price || 0)) / Number(product.originalPrice)) * 100)
    : 0;
  const availableVariants = getAvailableProductVariants(product);
  const baseOutOfStock = isItemOutOfStock(product);
  const fullyOutOfStock = baseOutOfStock && availableVariants.length === 0;
  const stockLimit = getStockLimit(product);
  const baseAtCartMax = baseOutOfStock || (stockLimit !== null && inCartQty >= stockLimit);

  return (
    <article
      onClick={() => onNavigate(`/product/${product.id}`)}
      className="group/card flex flex-col h-full cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
    >
      {/* Matte Product Media Frame */}
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] group-hover/card:border-[#111214]/25 dark:group-hover/card:border-zinc-600 shadow-none group-hover/card:shadow-md transition-all duration-200 mb-3">
        <ProductCardImage
          src={product.image || product.images?.[0]}
          secondarySrc={product.secondaryImage}
          alt={product.title}
        />

        {offerBadge ? (
          <span className="absolute top-2.5 right-2.5 bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
            {offerBadge}
          </span>
        ) : savePct > 0 ? (
          <span className="absolute top-2.5 right-2.5 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums shadow-xs">
            خصم {savePct}%
          </span>
        ) : (product.category === 'local' || (product.category && String(product.category).includes('محلي'))) && (
          <span className="absolute top-2.5 right-2.5 bg-[#111214]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            منتج محلي
          </span>
        )}

        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(product.id);
            }}
            aria-label={isFav ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
            className={`w-8 h-8 rounded-lg border backdrop-blur-md flex items-center justify-center transition-colors ${
              isFav
                ? 'bg-rose-600 border-rose-600 text-white'
                : 'bg-white/85 dark:bg-[#131519]/85 border-[#E5E2DA]/80 dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300 hover:text-rose-600'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickView(product);
            }}
            aria-label="معاينة سريعة"
            className="w-8 h-8 rounded-lg border border-[#E5E2DA]/80 dark:border-[#232730] bg-white/85 dark:bg-[#131519]/85 backdrop-blur-md text-[#111214] dark:text-zinc-200 hover:bg-white dark:hover:bg-[#1C1F26] flex items-center justify-center transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        {fullyOutOfStock && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-10">
            <span className="text-white font-bold text-xs bg-[#111214] px-3 py-1 rounded-md">نفدت الكمية</span>
          </div>
        )}
      </div>

      {/* Unboxed Clean Product Typography */}
      <div className="flex-1 flex flex-col justify-between gap-2">
        <div className="space-y-1">
          <ProductPublisherMiniCard
            product={product}
            storeProfile={ownerProf}
            variant="compact"
          />

          <h3 className="font-bold text-xs sm:text-sm line-clamp-2 text-[#111214] dark:text-[#F4F4F2] leading-snug">
            {product.title}
          </h3>

          {isNoDelivery && (
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 line-clamp-1">
              <Store className="w-3 h-3 shrink-0" />
              <span>لا يوجد توصيل · استلام من المتجر فقط</span>
            </p>
          )}

          {hasOfferActive && (product.offerExtras || product.offerTitle) && (
            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 line-clamp-1">
              {product.offerExtras || product.offerTitle}
            </p>
          )}
        </div>

        <div className="space-y-2 pt-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={`text-sm sm:text-base font-extrabold tabular-nums ${themeClasses.price}`}>
                {Number(product.price || 0).toLocaleString()} <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
              </span>
              {hasCrossedPrice && (
                <span className="text-[11px] text-[#5C5B57] dark:text-zinc-500 line-through tabular-nums">
                  {Number(product.originalPrice).toLocaleString()}
                </span>
              )}
            </div>

            {isNoDelivery ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!hasUser) {
                    onLogin();
                    return;
                  }
                  onOpenPreOrder(product);
                }}
                disabled={baseOutOfStock}
                className="w-9 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                title={baseOutOfStock ? 'نفدت الكمية' : 'حجز للاستلام من المتجر (لا يوجد توصيل)'}
                aria-label="حجز للاستلام من المتجر"
              >
                <BookmarkCheck className="h-4 w-4" />
              </button>
            ) : hasUser ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddToCart(buildBaseProductForCart(product));
                }}
                disabled={baseOutOfStock || baseAtCartMax}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${themeClasses.bg} ${themeClasses.hover}`}
                title={baseOutOfStock ? 'نفدت الكمية من المنتج الأساسي' : baseAtCartMax ? 'بلغت الحد الأقصى المتاح بالمخزون' : 'إضافة إلى السلة'}
                aria-label="إضافة إلى السلة"
              >
                <ShoppingCart className="h-4 w-4" />
                {inCartQty > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded bg-emerald-600 text-white text-[9px] font-extrabold tabular-nums flex items-center justify-center border border-white dark:border-[#131519]">
                    {inCartQty}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onLogin();
                }}
                className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors"
              >
                شراء
              </button>
            )}
          </div>

          {availableVariants.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenVariants(product);
              }}
              className="w-full min-h-[34px] py-1.5 px-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-[11px] font-bold flex items-center justify-between transition-colors text-[#111214] dark:text-[#F4F4F2]"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>أصناف</span>
              </span>
              <span className="tabular-nums text-[#5C5B57] dark:text-zinc-400">
                {availableVariants.length} متاح
              </span>
            </button>
          )}

          {canPreOrder && !baseOutOfStock && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!hasUser) {
                  onLogin();
                  return;
                }
                onOpenPreOrder(product);
              }}
              className="w-full min-h-[34px] py-1.5 px-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[11px] flex items-center justify-between transition-colors text-[#111214] dark:text-[#F4F4F2]"
            >
              <span className="flex items-center gap-1 font-semibold text-[#5C5B57] dark:text-zinc-300">
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>{isNoDelivery ? `حجز للمتجر (${product.reservationDurationDays || 3}أ)` : 'حجز مسبق'}</span>
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
});

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

export default function StoreFront() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'rating-desc'>('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [wideGrid, setWideGrid] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PRODUCTS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'delivery' | 'pickup'>('all');
  const [followedOnly, setFollowedOnly] = useState(false);

  const {
    addToCart,
    cart,
    settings,
    getThemeClasses,
    user,
    login,
    favoriteIds,
    toggleFavorite,
    recentlyViewedIds,
    followedStoreIds,
  } = useAppContext();
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [storeProfiles, setStoreProfiles] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPreOrderProduct, setSelectedPreOrderProduct] = useState<any | null>(null);
  const [variantsModalProduct, setVariantsModalProduct] = useState<any | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null);

  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const lastProfileSigRef = useRef<string>('');

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
      const productsData: any[] = [];
      snap.docs.forEach((d) => {
        const raw = d.data() as any;
        const primaryImg = raw.image || raw.images?.[0] || '';
        const secondCandidate = Array.isArray(raw.images)
          ? raw.images.find((img: unknown) => typeof img === 'string' && img && img !== primaryImg)
          : '';
        const p = {
          ...raw,
          id: d.id,
          // Keep only primary (+ compact secondary hover preview) in storefront grid state
          image: primaryImg,
          secondaryImage: secondCandidate && secondCandidate.length < 150000 ? secondCandidate : undefined,
          images: undefined,
        };
        if (!isItemOutOfStock(p) || getAvailableProductVariants(p).length > 0) {
          productsData.push(p);
        }
      });
      setProducts(productsData);
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
      const sigParts: string[] = [];
      const nowMs = Date.now();
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const isVer = Boolean(data.verified) && (!data.verifiedUntil || data.verifiedUntil === '' || new Date(data.verifiedUntil).getTime() >= nowMs);
        // Project only fields needed by StoreFront cards (omits heavy bannerUrl & ignores lastSeen churn)
        pMap[docSnap.id] = {
          name: data.name || '',
          logoUrl: data.logoUrl || '',
          verified: Boolean(data.verified),
          verifiedUntil: data.verifiedUntil || '',
          isVerified: isVer,
          averageRating: data.averageRating || 0,
          averageCredibility: data.averageCredibility || 0,
          city: data.city || '',
          district: data.district || '',
          address: data.address || '',
          landmark: data.landmark || '',
          workingHours: data.workingHours || '',
          googleMapsUrl: data.googleMapsUrl || '',
          location: data.location || null,
          coordinates: data.coordinates || null,
        };
        sigParts.push(`${docSnap.id}:${data.name || ''}:${isVer}:${data.averageRating || 0}:${data.city || ''}:${(data.logoUrl || '').length}`);
      });
      const sig = sigParts.join('|');
      if (sig !== lastProfileSigRef.current) {
        lastProfileSigRef.current = sig;
        setStoreProfiles(pMap);
      }
    }, (err) => {
      console.warn('StoreProfiles listener notice:', err.message);
    });

    return () => {
      unsubProducts();
      unsubCats();
      unsubProfiles();
    };
  }, []);

  const allAvailableCategories = useMemo(
    () => (categories.length > 0 ? categories : DEFAULT_CATEGORIES),
    [categories]
  );

  const offerProducts = useMemo(() => {
    return products
      .filter(isProductOfferActive)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of allAvailableCategories) {
      counts[c.slug] = 0;
    }
    for (const p of products) {
      for (const c of allAvailableCategories) {
        if (isProductInCategory(p, c.slug, c.name)) {
          counts[c.slug] = (counts[c.slug] || 0) + 1;
        }
      }
    }
    return counts;
  }, [products, allAvailableCategories]);

  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      const key = item.product?._cartKey || (item.product?.selectedVariantId ? `${item.product.id}__variant__${item.product.selectedVariantId}` : item.product?.id);
      if (key) map[key] = item.quantity || 0;
    }
    return map;
  }, [cart]);

  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    Object.values(storeProfiles).forEach((prof: any) => {
      const c = String(prof?.city || '').trim();
      if (c) citySet.add(c);
    });
    return Array.from(citySet).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [storeProfiles]);

  const activeAdvFiltersCount = useMemo(() => {
    let count = 0;
    if (minPrice.trim() !== '') count += 1;
    if (maxPrice.trim() !== '') count += 1;
    if (cityFilter !== 'all') count += 1;
    if (deliveryFilter !== 'all') count += 1;
    if (followedOnly) count += 1;
    return count;
  }, [minPrice, maxPrice, cityFilter, deliveryFilter, followedOnly]);

  const filteredProducts = useMemo(() => {
    const activeCatObj = allAvailableCategories.find(c => c.slug === activeTab);
    const term = searchQuery.trim().toLowerCase();
    const minP = minPrice.trim() !== '' ? Number(minPrice) : null;
    const maxP = maxPrice.trim() !== '' ? Number(maxPrice) : null;

    const list = products.filter(p => {
      if (activeTab === 'offers') {
        if (!isProductOfferActive(p)) return false;
      } else if (activeTab !== 'all' && !isProductInCategory(p, activeTab, activeCatObj?.name)) {
        return false;
      }
      const ownerProf = p.ownerId ? storeProfiles[p.ownerId] : null;
      const isStoreVerified = Boolean(p.ownerVerified || ownerProf?.isVerified);
      if (verifiedOnly && !isStoreVerified) return false;
      if (favoritesOnly && !favoriteIds.includes(p.id)) return false;
      if (followedOnly && (!p.ownerId || !followedStoreIds.includes(p.ownerId))) return false;
      if (deliveryFilter === 'delivery' && Boolean(p.noDelivery)) return false;
      if (deliveryFilter === 'pickup' && !p.noDelivery) return false;
      if (cityFilter !== 'all') {
        const storeCity = String(ownerProf?.city || '').trim();
        if (storeCity !== cityFilter) return false;
      }
      const priceVal = Number(p.price || 0);
      if (minP !== null && !Number.isNaN(minP) && priceVal < minP) return false;
      if (maxP !== null && !Number.isNaN(maxP) && priceVal > maxP) return false;
      if (term) {
        const matchTitle = String(p.title || '').toLowerCase().includes(term);
        const matchCat = String(p.category || '').toLowerCase().includes(term);
        const matchStore = String(p.ownerName || '').toLowerCase().includes(term);
        const matchOffer = String(p.offerTitle || '').toLowerCase().includes(term) || String(p.offerExtras || '').toLowerCase().includes(term);
        const matchVariant = Array.isArray(p.variants) && p.variants.some((v: any) => String(v?.name || '').toLowerCase().includes(term));
        if (!matchTitle && !matchCat && !matchStore && !matchOffer && !matchVariant) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') {
      return [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortBy === 'price-desc') {
      return [...list].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    if (sortBy === 'rating-desc') {
      return [...list].sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0));
    }
    return [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [products, activeTab, allAvailableCategories, verifiedOnly, favoritesOnly, favoriteIds, followedOnly, followedStoreIds, deliveryFilter, cityFilter, minPrice, maxPrice, storeProfiles, searchQuery, sortBy]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_PRODUCTS);
  }, [activeTab, searchQuery, verifiedOnly, favoritesOnly, followedOnly, deliveryFilter, cityFilter, minPrice, maxPrice, sortBy]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );
  const hasMoreProducts = visibleCount < filteredProducts.length;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMoreProducts || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PRODUCTS_BATCH_SIZE, filteredProducts.length));
        }
      },
      { rootMargin: '320px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreProducts, filteredProducts.length]);

  const cardThemeClasses = useMemo(
    () => ({
      price: getThemeClasses('price'),
      bg: getThemeClasses('bg'),
      hover: getThemeClasses('hover'),
    }),
    [getThemeClasses]
  );

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);
  const handleOpenPreOrder = useCallback((p: any) => setSelectedPreOrderProduct(p), []);
  const handleOpenVariants = useCallback((p: any) => setVariantsModalProduct(p), []);
  const handleQuickView = useCallback((p: any) => setQuickViewProduct(p), []);

  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewedIds
        .map((id) => products.find((p) => p.id === id))
        .filter(Boolean)
        .slice(0, 8),
    [recentlyViewedIds, products]
  );

  return (
    <div className="space-y-8">
      {/* Admin-Managed 5-Slot Advertising Hero Banner */}
      <HeroBannerAds
        onFallbackScroll={() => {
          document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 lg:w-[560px] shrink-0">
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

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/requests"
                className="flex-1 sm:flex-none min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Gavel className="w-4 h-4" />
                <span>اطلب تسعيرة</span>
              </Link>

              <Link
                to="/search-stores"
                className={`flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                <span>تصفح المتاجر</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
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
                const count = categoryCounts[c.slug] || 0;
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
              onClick={() => setFavoritesOnly(v => !v)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                favoritesOnly
                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
              <span>المفضلة{favoriteIds.length > 0 ? ` (${favoriteIds.length})` : ''}</span>
            </button>

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

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(v => !v)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                showAdvancedFilters || activeAdvFiltersCount > 0
                  ? `${getThemeClasses('badge')}`
                  : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>فلاتر متقدمة</span>
              {activeAdvFiltersCount > 0 && (
                <span className="tabular-nums font-extrabold">({activeAdvFiltersCount})</span>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#5C5B57] dark:text-zinc-400" />
              <span className="text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400 hidden sm:inline">الترتيب حسب:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="الترتيب حسب"
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold outline-none cursor-pointer"
              >
                <option value="newest">الأحدث</option>
                <option value="price-asc">الأقل سعراً</option>
                <option value="price-desc">الأعلى سعراً</option>
                <option value="rating-desc">الأعلى تقييماً</option>
              </select>
            </div>

            <div className="hidden sm:inline-flex items-center p-0.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
              <button
                type="button"
                onClick={() => setWideGrid(false)}
                title="عرض شبكي قياسي"
                aria-label="عرض شبكي قياسي"
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  !wideGrid
                    ? `${getThemeClasses('bg')}`
                    : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setWideGrid(true)}
                title="عرض معرض واسع"
                aria-label="عرض معرض واسع"
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  wideGrid
                    ? `${getThemeClasses('bg')}`
                    : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Filter Drawer (Budget, City, Delivery Mode, Followed Stores) */}
        {showAdvancedFilters && (
          <div className="p-4 sm:p-5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
              <span className="text-xs sm:text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4" />
                <span>تخصيص الميزانية والمدينة وطريقة الاستلام</span>
              </span>
              {activeAdvFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                    setCityFilter('all');
                    setDeliveryFilter('all');
                    setFollowedOnly(false);
                  }}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  مسح الفلاتر المتقدمة
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Price Range + Quick Budget Presets */}
              <div className="md:col-span-5 space-y-2">
                <label className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 block">
                  نطاق السعر (ر.ي)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="من (ر.ي)"
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none tabular-nums"
                  />
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="إلى (ر.ي)"
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none tabular-nums"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'أقل من 5,000', min: '', max: '5000' },
                    { label: '5,000 - 25,000', min: '5000', max: '25000' },
                    { label: '25,000 - 100,000', min: '25000', max: '100000' },
                    { label: 'أعلى من 100,000', min: '100000', max: '' },
                  ].map((preset) => {
                    const active = minPrice === preset.min && maxPrice === preset.max;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setMinPrice(active ? '' : preset.min);
                          setMaxPrice(active ? '' : preset.max);
                        }}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-bold tabular-nums transition-colors ${
                          active
                            ? `${getThemeClasses('bg')} border-transparent`
                            : 'bg-[#FAF9F6] dark:bg-[#101216] border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300 hover:text-[#111214] dark:hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* City Filter */}
              <div className="md:col-span-3 space-y-2">
                <label className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 block">
                  المحافظة / المدينة
                </label>
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none cursor-pointer"
                >
                  <option value="all">جميع المدن</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Delivery Mode & Followed Stores */}
              <div className="md:col-span-4 space-y-2">
                <label className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 block">
                  طريقة الاستلام والمتابعة
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'delivery', label: 'يدعم التوصيل' },
                    { id: 'pickup', label: 'استلام من المتجر' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDeliveryFilter(opt.id as any)}
                      className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-bold transition-colors ${
                        deliveryFilter === opt.id
                          ? `${getThemeClasses('bg')} border-transparent`
                          : 'bg-[#FAF9F6] dark:bg-[#101216] border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}

                  {followedStoreIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFollowedOnly(v => !v)}
                      className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        followedOnly
                          ? `${getThemeClasses('bg')} border-transparent`
                          : 'bg-[#FAF9F6] dark:bg-[#101216] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-zinc-200'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>متاجر أتابعها ({followedStoreIds.length})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
              setFavoritesOnly(false);
              setFollowedOnly(false);
              setMinPrice('');
              setMaxPrice('');
              setCityFilter('all');
              setDeliveryFilter('all');
            }}
            className={`mt-4 min-h-[40px] px-5 py-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} font-bold text-xs transition-colors`}
          >
            إعادة تعيين وعرض الكل
          </button>
        </div>
      ) : (
        <>
          <div className={`grid gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 ${
            wideGrid ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          }`}>
            {visibleProducts.map((product) => (
              <StoreFrontProductCard
                key={product.id}
                product={product}
                ownerProf={product.ownerId ? storeProfiles[product.ownerId] : null}
                inCartQty={cartQtyMap[product.id] || 0}
                themeClasses={cardThemeClasses}
                hasUser={Boolean(user)}
                isFav={favoriteIds.includes(product.id)}
                onNavigate={handleNavigate}
                onLogin={login}
                onAddToCart={addToCart}
                onOpenPreOrder={handleOpenPreOrder}
                onOpenVariants={handleOpenVariants}
                onToggleFavorite={toggleFavorite}
                onQuickView={handleQuickView}
              />
            ))}
          </div>

          {hasMoreProducts && (
            <div ref={loadMoreRef} className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + PRODUCTS_BATCH_SIZE, filteredProducts.length))}
                className="min-h-[42px] px-6 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] transition-colors"
              >
                عرض المزيد ({filteredProducts.length - visibleProducts.length} منتج متبقٍ)
              </button>
            </div>
          )}
        </>
      )}

      {recentlyViewedProducts.length > 0 && (
        <section className="pt-6 border-t border-[#E5E2DA] dark:border-[#232730] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#111214] dark:text-[#F4F4F2]">
              شاهدته مؤخراً
            </h2>
            <Link
              to="/watchlist"
              className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition-colors"
            >
              المفضلة والرادار
            </Link>
          </div>
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1">
            {recentlyViewedProducts.map((item: any) => (
              <Link
                key={item.id}
                to={`/product/${item.id}`}
                className="w-36 sm:w-44 shrink-0 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-2.5 hover:border-[#111214]/40 dark:hover:border-zinc-500 transition-colors space-y-2"
              >
                <div className="aspect-square rounded-md overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26]">
                  <ProductCardImage src={item.image || item.images?.[0]} alt={item.title} />
                </div>
                <p className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2] line-clamp-1">
                  {item.title}
                </p>
                <p className={`text-xs font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                  {Number(item.price || 0).toLocaleString()} ر.ي
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quiet Editorial Footer Link */}
      <footer className="mt-10 pt-6 border-t border-[#E5E2DA] dark:border-[#232730] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
        <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
          تسوق بثقة مع إرشادات جودة الخدمة وحماية المشتري داخل المنصة.
        </p>
        <Link
          to="/safety-guide"
          className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>دليل التسوق الآمن وحماية المشتري</span>
        </Link>
      </footer>

      {quickViewProduct && (
        <Suspense fallback={null}>
          <QuickViewModal
            product={quickViewProduct}
            storeProfile={quickViewProduct.ownerId ? storeProfiles[quickViewProduct.ownerId] : null}
            isOpen={!!quickViewProduct}
            onClose={() => setQuickViewProduct(null)}
            onOpenVariants={handleOpenVariants}
            onOpenPreOrder={handleOpenPreOrder}
          />
        </Suspense>
      )}

      {selectedPreOrderProduct && (
        <Suspense fallback={null}>
          <PreOrderModal
            product={buildBaseProductForCart(selectedPreOrderProduct)}
            isOpen={!!selectedPreOrderProduct}
            onClose={() => setSelectedPreOrderProduct(null)}
          />
        </Suspense>
      )}

      {variantsModalProduct && (
        <Suspense fallback={null}>
          <ProductVariantsModal
            product={variantsModalProduct}
            isOpen={!!variantsModalProduct}
            onClose={() => setVariantsModalProduct(null)}
            onNavigateToVariant={(pid, vid) => navigate(`/variant/${pid}/${vid}`)}
          />
        </Suspense>
      )}
    </div>
  );
}
