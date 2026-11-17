import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Store, Tag } from 'lucide-react';
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
}

export default function HeroBannerAds({ onFallbackScroll, className = '' }: HeroBannerAdsProps) {
  const { settings } = useAppContext();
  const navigate = useNavigate();

  const [bannerAds, setBannerAds] = useState<BannerAdItem[]>([]);
  const [loadedAds, setLoadedAds] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasInitializedRandomStartRef = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'bannerAds'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BannerAdItem[];
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

  // Rotate in order every 30 seconds starting from the random initial ad
  useEffect(() => {
    if (activeAds.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeAds.length);
    }, BANNER_ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeAds.length, currentIndex]);

  // Respect Admin global toggle
  if (settings?.showHeroBanner === false) {
    return null;
  }

  // Fallback to legacy single banner if no bannerAds are active yet
  if (activeAds.length === 0) {
    if (!settings?.showHeroBanner || !settings?.heroBanner) {
      return null;
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
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAdClick();
        }
      }}
      aria-label={currentAd.title || currentAd.targetStoreName || 'مساحة إعلانية'}
      className={`w-full rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] relative group min-h-[240px] md:min-h-[340px] cursor-pointer select-none ${className}`}
      dir="rtl"
    >
      <img
        key={currentAd.id}
        src={currentAd.image}
        alt={currentAd.title || currentAd.targetStoreName || 'إعلان متجر'}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-[1.02]"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 flex flex-col justify-end md:justify-center items-start p-6 sm:p-10 pb-10 sm:pb-10 text-right">
        <div className="max-w-xl space-y-2.5 sm:space-y-3">
          {(currentAd.badgeText || currentAd.targetStoreName) && (
            <div className="flex flex-wrap items-center gap-2">
              {currentAd.badgeText && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/15 backdrop-blur-xs border border-white/25 text-white text-[11px] font-bold">
                  <Tag className="w-3 h-3" />
                  <span>{currentAd.badgeText}</span>
                </span>
              )}
              {currentAd.targetStoreName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/45 backdrop-blur-xs border border-white/15 text-white/95 text-[11px] font-bold">
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
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-white/15 z-20"
            onClick={(e) => e.stopPropagation()}
          >
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
                  idx === safeIndex ? 'w-6 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
