import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Store,
  Package,
  Clock,
  CheckCircle,
  ArrowLeft,
  Gavel,
  Heart,
  Bot,
  ShoppingBag,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import { safeLocalGet, safeLocalSet } from '../lib/deviceSafe';
import { getAvailableProductVariants } from '../lib/variantUtils';
import { isItemOutOfStock } from '../lib/stockUtils';

const RECENT_SEARCHES_KEY = 'yemen_store_recent_searches_v1';

interface CachedCatalog {
  products: any[];
  stores: any[];
  fetchedAt: number;
}

export default function CommandSearchModal() {
  const {
    isSearchPaletteOpen,
    openSearchPalette,
    closeSearchPalette,
    user,
    getThemeClasses,
  } = useAppContext();

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<CachedCatalog | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = safeLocalGet(RECENT_SEARCHES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
      }
    } catch {}
    return [];
  });

  // Global Ctrl+K / Cmd+K and Escape shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isSearchPaletteOpen) {
          closeSearchPalette();
        } else {
          openSearchPalette();
        }
      } else if (e.key === 'Escape' && isSearchPaletteOpen) {
        e.preventDefault();
        closeSearchPalette();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchPaletteOpen, openSearchPalette, closeSearchPalette]);

  // Autofocus & lazy load catalog (cached 3 minutes)
  useEffect(() => {
    if (!isSearchPaletteOpen) return;
    setTimeout(() => inputRef.current?.focus(), 40);

    const isFresh = catalog && Date.now() - catalog.fetchedAt < 180_000;
    if (isFresh) return;

    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDocs(query(collection(db, 'products'), where('status', '==', 'active'))),
      getDocs(collection(db, 'storeProfiles')),
    ])
      .then(([prodSnap, storeSnap]) => {
        if (cancelled) return;
        const products = prodSnap.docs
          .map((d) => {
            const raw = d.data() as any;
            return {
              id: d.id,
              title: raw.title || '',
              category: raw.category || '',
              price: Number(raw.price || 0),
              originalPrice: Number(raw.originalPrice || 0),
              image: raw.image || raw.images?.[0] || '',
              ownerId: raw.ownerId || '',
              ownerName: raw.ownerName || '',
              ownerVerified: Boolean(raw.ownerVerified),
              stock: raw.stock ?? null,
              available: raw.available !== false,
              variants: Array.isArray(raw.variants) ? raw.variants : [],
            };
          })
          .filter((p) => !isItemOutOfStock(p) || getAvailableProductVariants(p).length > 0);

        const nowMs = Date.now();
        const stores = storeSnap.docs
          .map((d) => {
            const raw = d.data() as any;
            const isVerified =
              Boolean(raw.verified) &&
              (!raw.verifiedUntil || raw.verifiedUntil === '' || new Date(raw.verifiedUntil).getTime() >= nowMs);
            return {
              id: d.id,
              name: raw.name || '',
              city: raw.city || '',
              district: raw.district || '',
              logoUrl: raw.logoUrl || '',
              isVerified,
              averageRating: Number(raw.averageRating || 0),
            };
          })
          .filter((s) => s.name.trim() !== '');

        setCatalog({ products, stores, fetchedAt: Date.now() });
      })
      .catch((err) => {
        console.warn('CommandSearch load notice:', err?.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSearchPaletteOpen]);

  const recordSearch = (term: string) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((t) => t !== clean)].slice(0, 6);
      safeLocalSet(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    safeLocalSet(RECENT_SEARCHES_KEY, '[]');
  };

  const normalizedTerm = searchTerm.trim().toLowerCase();

  const matchedProducts = useMemo(() => {
    if (!catalog || !normalizedTerm) return [];
    return catalog.products
      .filter((p) => {
        const inTitle = p.title.toLowerCase().includes(normalizedTerm);
        const inCat = p.category.toLowerCase().includes(normalizedTerm);
        const inStore = p.ownerName.toLowerCase().includes(normalizedTerm);
        const inVariant = p.variants.some((v: any) => String(v?.name || '').toLowerCase().includes(normalizedTerm));
        return inTitle || inCat || inStore || inVariant;
      })
      .slice(0, 8);
  }, [catalog, normalizedTerm]);

  const matchedStores = useMemo(() => {
    if (!catalog || !normalizedTerm) return [];
    return catalog.stores
      .filter((s) => {
        const inName = s.name.toLowerCase().includes(normalizedTerm);
        const inCity = s.city.toLowerCase().includes(normalizedTerm);
        const inDistrict = s.district.toLowerCase().includes(normalizedTerm);
        return inName || inCity || inDistrict;
      })
      .slice(0, 5);
  }, [catalog, normalizedTerm]);

  const goTo = (path: string, saveTerm?: string) => {
    if (saveTerm) recordSearch(saveTerm);
    closeSearchPalette();
    navigate(path);
  };

  if (!isSearchPaletteOpen) return null;

  const quickShortcuts = [
    { label: 'تصفح المتاجر', path: '/search-stores', icon: Store },
    { label: 'المفضلة والرادار', path: '/watchlist', icon: Heart },
    { label: 'اطلب تسعيرة', path: '/requests', icon: Gavel },
    ...(user ? [{ label: 'طلباتي وحجوزاتي', path: '/orders', icon: Package }] : []),
    { label: 'سلة المشتريات', path: '/cart', icon: ShoppingBag },
    { label: 'مساعد المتجر', path: '/contact?to=ai_assistant', icon: Bot },
  ];

  return (
    <div
      className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-xs flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 print:hidden"
      dir="rtl"
      onClick={closeSearchPalette}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
      >
        {/* Search Input Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#E5E2DA] dark:border-[#232730] flex items-center gap-3">
          <Search className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث فوراً عن منتج، صنف، أو اسم متجر أو مدينة..."
            className="flex-1 bg-transparent text-sm sm:text-base font-bold text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="مسح"
              className="p-1.5 rounded-lg text-[#5C5B57] hover:text-[#111214] dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={closeSearchPalette}
            className="px-2.5 py-1 rounded-md border border-[#E5E2DA] dark:border-[#232730] text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition-colors"
          >
            إغلاق
          </button>
        </div>

        {/* Results / Quick Links Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!normalizedTerm ? (
            <>
              {recentSearches.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>عمليات البحث الأخيرة</span>
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>مسح</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setSearchTerm(term)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 block">
                  وصول سريع للأقسام
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {quickShortcuts.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => goTo(item.path)}
                        className="p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-right flex items-center justify-between gap-2 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] truncate">
                          <Icon className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <ArrowLeft className="w-3.5 h-3.5 text-[#5C5B57] dark:text-zinc-500 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : loading && !catalog ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] animate-pulse" />
              ))}
            </div>
          ) : matchedProducts.length === 0 && matchedStores.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Search className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-50" />
              <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                لا توجد نتائج مطابقة لـ «{searchTerm}»
              </p>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
                جرب البحث باسم منتج عام أو اسم المدينة أو تصفح المتاجر مباشرة
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {matchedStores.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>متاجر مطابقة ({matchedStores.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchedStores.map((store) => (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => goTo(`/store/${store.id}`, searchTerm)}
                        className="p-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center gap-3 text-right transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center shrink-0">
                          {store.logoUrl ? (
                            <img src={store.logoUrl} alt={store.name} className="w-full h-full object-cover" />
                          ) : (
                            <Store className="w-4 h-4 text-[#5C5B57]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2] truncate">
                              {store.name}
                            </span>
                            {store.isVerified && (
                              <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${getThemeClasses('verified')}`} />
                            )}
                          </div>
                          {(store.city || store.district) && (
                            <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 truncate">
                              {[store.city, store.district].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <ArrowLeft className="w-3.5 h-3.5 text-[#5C5B57] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {matchedProducts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>المنتجات ({matchedProducts.length})</span>
                  </h3>
                  <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730] rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden">
                    {matchedProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => goTo(`/product/${product.id}`, searchTerm)}
                        className="w-full p-3 hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26] flex items-center justify-between gap-3 text-right transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-md overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] shrink-0 flex items-center justify-center">
                            {product.image ? (
                              <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-[#5C5B57] opacity-50" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] truncate">
                              {product.title}
                            </p>
                            <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 truncate">
                              {[product.category, product.ownerName].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs sm:text-sm font-extrabold tabular-nums shrink-0 ${getThemeClasses('price')}`}>
                          {product.price.toLocaleString()} ر.ي
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
