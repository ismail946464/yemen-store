import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Store, Tag, Bot, ShieldCheck, ArrowDown } from 'lucide-react';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import {
  BannerAdItem,
  BANNER_ROTATION_INTERVAL_MS,
  getActiveBannerAds,
  resolveBannerAdAction
} from '../lib/bannerAds';

interface HeroBannerAdsProps {
  onFallbackScroll?: () => void;
  className?: string;
  totalProducts?: number;
  verifiedStoresCount?: number;
  activeOffersCount?: number;
}

let bannerAdsMemoryCache: BannerAdItem[] | null = null;

export default function HeroBannerAds({
  onFallbackScroll,
  className = '',
  totalProducts = 0,
  verifiedStoresCount = 0,
  activeOffersCount = 0,
}: HeroBannerAdsProps) {
  const { settings, getThemeClasses, openAiDrawer } = useAppContext();
  const navigate = useNavigate();

  const [bannerAds, setBannerAds] = useState<BannerAdItem[]>(() => bannerAdsMemoryCache || []);
  const [loadedAds, setLoadedAds] = useState(() => Boolean(bannerAdsMemoryCache));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const hasInitializedRandomStartRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'bannerAds'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BannerAdItem[];
        bannerAdsMemoryCache = list;
        setBannerAds(list);
        setLoadedAds(true);
      },
      (err) => {
        console.warn('BannerAds listener notice:', err.message);
        setLoadedAds(true);
      }
    );
    return () => unsub();
  }, []);

  const activeAds = useMemo(() => getActiveBannerAds(bannerAds), [bannerAds]);

  // Pick a random initial ad when customer opens the storefront, then clamp if list shrinks
  useEffect(() => {
    if (!loadedAds) return;
    if (activeAds.length === 0) {
      hasInitializedRandomStartRef.current = false;
      setCurrentIndex(0);
      return;
    }
    if (!hasInitializedRandomStartRef.current) {
      const randomStart = Math.floor(Math.random() * activeAds.length);
      setCurrentIndex(randomStart);
      hasInitializedRandomStartRef.current = true;
    } else if (currentIndex >= activeAds.length) {
      setCurrentIndex(0);
    }
  }, [loadedAds, activeAds.length, currentIndex]);

  // Rotate in order every 30 seconds starting from the random initial ad (pauses on hover or hidden tab)
  useEffect(() => {
    if (activeAds.length <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setCurrentIndex((prev) => (prev + 1) % activeAds.length);
    }, BANNER_ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeAds.length, currentIndex, isPaused]);

  // Respect Admin global toggle
  if (settings?.showHeroBanner === false) {
    return null;
  }

  // Fallback to legacy single banner or refined architectural showcase if no bannerAds are active yet
  if (activeAds.length === 0) {
    if (!settings?.heroBanner) {
      return (
        <section
          dir="rtl"
          className={`w-full rounded-xl overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] relative ${className}`}
        >
          {/* Subtle Yemeni Architectural Geometric Lattice Motif */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-1/2 max-w-[420px] text-[#111214]/[0.035] dark:text-white/[0.04]"
            viewBox="0 0 400 300"
            fill="none"
          >
            <pattern id="yemen-lattice" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M24 0L48 24L24 48L0 24Z" stroke="currentColor" strokeWidth="1" />
              <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="1" />
              <path d="M0 0L48 48M48 0L0 48" stroke="currentColor" strokeWidth="0.6" />
            </pattern>
            <rect width="400" height="300" fill="url(#yemen-lattice)" />
          </svg>

          <div className="relative z-10 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            <div className="lg:col-span-8 space-y-3.5 text-right">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5C5B57] dark:text-zinc-400">
                <span>{settings?.storeName || 'متجر محيط'}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>تجارة موثوقة وتوصيل مباشر</span>
                </span>
              </div>

              <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-balance text-[#111214] dark:text-[#F4F4F2] leading-[1.2]">
                {settings?.heroTitle || 'وجهتك المختارة للمتاجر اليمنية الموثقة والمنتجات الأصيلة'}
              </h2>

              <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 leading-relaxed max-w-2xl">
                {settings?.heroSubtitle || 'تصفح المنتجات حسب الميزانية أو المدينة، تفاوض مباشرة على السعر، احجز بالعربون بأمان، أو استعن بمستشار المتجر الذكي لاختيار الأنسب لك في ثوانٍ.'}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onFallbackScroll?.()}
                  className={`min-h-[44px] px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  <span>{settings?.heroButtonText || 'تصفح الكتالوج'}</span>
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openAiDrawer()}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors"
                >
                  <Bot className="w-4 h-4" />
                  <span>اسأل المستشار الذكي</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 grid grid-cols-3 lg:grid-cols-1 gap-2.5">
              <div className="p-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1">
                <span className="text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400">منتجات نشطة</span>
                <span className={`text-lg sm:text-xl font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                  {totalProducts.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1">
                <span className="text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400">متاجر موثقة</span>
                <span className="text-lg sm:text-xl font-extrabold tabular-nums text-[#111214] dark:text-[#F4F4F2]">
                  {verifiedStoresCount.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1">
                <span className="text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400">عروض وتخفيضات</span>
                <span className="text-lg sm:text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {activeOffersCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </section>
      );
    }

    const handleLegacyAction = () => {
      const link = String(settings?.heroLink || '').trim();
      if (link && link !== '#' && !link.startsWith('#')) {
        if (/^https?:\/\//i.test(link)) {
          window.location.href = link;
        } else {
          navigate(link);
        }
      } else if (onFallbackScroll) {
        onFallbackScroll();
      }
    };

    return (
      <section
        onClick={handleLegacyAction}
        className={`w-full rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] relative group min-h-[240px] md:min-h-[340px] cursor-pointer ${className}`}
      >
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleLegacyAction();
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
    );
  }

  const safeIndex = currentIndex >= 0 && currentIndex < activeAds.length ? currentIndex : 0;
  const currentAd = activeAds[safeIndex];

  const handleAdClick = () => {
    const action = resolveBannerAdAction(currentAd);
    if (action.type === 'external') {
      window.location.href = action.url;
    } else if (action.type === 'internal') {
      navigate(action.path);
    } else if (onFallbackScroll) {
      onFallbackScroll();
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeAds.length) % activeAds.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeAds.length);
  };

  const ctaLabel =
    String(currentAd.buttonText || '').trim() ||
    (currentAd.targetStoreName ? `زيارة ${currentAd.targetStoreName}` : currentAd.targetStoreId ? 'زيارة المتجر' : 'استكشف العرض');

  return (
    <section
      onClick={handleAdClick}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current === null || activeAds.length <= 1) return;
        const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartXRef.current;
        touchStartXRef.current = null;
        if (Math.abs(deltaX) > 45) {
          if (deltaX > 0) {
            setCurrentIndex((prev) => (prev + 1) % activeAds.length);
          } else {
            setCurrentIndex((prev) => (prev - 1 + activeAds.length) % activeAds.length);
          }
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAdClick();
        }
      }}
      aria-label={currentAd.title || currentAd.targetStoreName || 'مساحة إعلانية'}
      className={`w-full rounded-xl overflow-hidden border border-[#E5E2DA] dark:border-[#232730] shadow-xs relative group min-h-[250px] md:min-h-[360px] cursor-pointer select-none ${className}`}
      dir="rtl"
    >
      <img
        key={currentAd.id}
        src={currentAd.image}
        alt={currentAd.title || currentAd.targetStoreName || 'إعلان متجر'}
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 flex flex-col justify-end md:justify-center items-start p-6 sm:p-10 pb-10 sm:pb-10 text-right">
        <div className="max-w-xl space-y-2.5 sm:space-y-3">
          {(currentAd.badgeText || currentAd.targetStoreName) && (
            <div className="flex flex-wrap items-center gap-2">
              {currentAd.badgeText && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/55 border border-white/25 text-white text-[11px] font-bold">
                  <Tag className="w-3 h-3" />
                  <span>{currentAd.badgeText}</span>
                </span>
              )}
              {currentAd.targetStoreName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/55 border border-white/15 text-white/95 text-[11px] font-bold">
                  <Store className="w-3 h-3" />
                  <span>{currentAd.targetStoreName}</span>
                </span>
              )}
            </div>
          )}

          {currentAd.title && (
            <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight text-balance drop-shadow-xs">
              {currentAd.title}
            </h2>
          )}

          {currentAd.subtitle && (
            <p className="text-sm sm:text-base text-white/85 font-medium leading-relaxed line-clamp-2">
              {currentAd.subtitle}
            </p>
          )}

          <div className="pt-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAdClick();
              }}
              className="bg-white text-[#111214] hover:bg-[#F6F5F0] min-h-[44px] px-6 py-2.5 rounded-lg font-bold text-sm transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>{ctaLabel}</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Carousel Controls & Ordered Indicators */}
      {activeAds.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="الإعلان السابق"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-black/45 hover:bg-black/70 text-white border border-white/20 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="الإعلان التالي"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-black/45 hover:bg-black/70 text-white border border-white/20 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/65 px-3 py-1.5 rounded-lg border border-white/15 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-bold text-white/85 tabular-nums ml-1">
              {safeIndex + 1}/{activeAds.length}
            </span>
            {activeAds.map((ad, idx) => (
              <button
                key={ad.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                aria-label={`عرض الإعلان ${idx + 1}: ${ad.title || ad.targetStoreName || ''}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === safeIndex ? 'w-7 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
