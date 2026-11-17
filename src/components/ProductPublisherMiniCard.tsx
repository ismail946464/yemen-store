import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, MapPin, ShieldCheck, Star, Store, ArrowLeft, Clock, ExternalLink } from 'lucide-react';
import { useAppContext } from '../AppContext';

export interface ProductPublisherMiniCardProps {
  product: any;
  storeProfile?: any;
  variant?: 'compact' | 'detail';
  storePathPrefix?: string;
}

export function formatProductPublishDate(product: any, style: 'short' | 'full' = 'short'): string {
  const rawDate = product?.reviewedAt || product?.createdAt || product?.updatedAt;
  if (!rawDate) return '';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return '';
    if (style === 'short') {
      return d.toLocaleDateString('ar-YE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return d.toLocaleString('ar-YE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function ProductPublisherMiniCard({
  product,
  storeProfile,
  variant = 'compact',
  storePathPrefix = '/store',
}: ProductPublisherMiniCardProps) {
  const { settings, getThemeClasses } = useAppContext();
  const [logoFailed, setLogoFailed] = useState(false);

  if (!product) return null;

  const ownerId = product.ownerId || '';
  const isVerified = Boolean(
    storeProfile?.isVerified ??
      (storeProfile?.verified &&
        (!storeProfile?.verifiedUntil ||
          storeProfile.verifiedUntil === '' ||
          new Date(storeProfile.verifiedUntil).getTime() >= Date.now())) ??
      product.ownerVerified
  );

  const storeName =
    storeProfile?.name ||
    product.ownerName ||
    settings?.storeName ||
    'متجر معتمد';

  const storeLogo =
    (!logoFailed && (storeProfile?.logoUrl || product.ownerPhotoURL || (!ownerId ? settings?.storeLogo : ''))) ||
    '';

  const avgRating = Number(storeProfile?.averageRating || 0);
  const avgCredibility = Number(storeProfile?.averageCredibility || 0);
  const storeCity = String(storeProfile?.city || '').trim();
  const fullAddress = [storeProfile?.city, storeProfile?.district, storeProfile?.address]
    .map((v: any) => String(v || '').trim())
    .filter(Boolean)
    .join(' — ');
  const landmark = String(storeProfile?.landmark || '').trim();
  const workingHours = String(storeProfile?.workingHours || '').trim();
  const lat = storeProfile?.location?.lat ?? storeProfile?.coordinates?.lat;
  const lng = storeProfile?.location?.lng ?? storeProfile?.coordinates?.lng;
  const rawMapUrl = String(storeProfile?.googleMapsUrl || '').trim();
  const safeMapUrl = rawMapUrl && /^https?:\/\//i.test(rawMapUrl) ? rawMapUrl : '';
  const mapHref = safeMapUrl || (lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : '');
  const publishDateShort = formatProductPublishDate(product, 'short');
  const publishDateFull = formatProductPublishDate(product, 'full');

  const storeLink = ownerId ? `${storePathPrefix}/${ownerId}` : null;

  if (variant === 'compact') {
    const StoreRowContent = (
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] flex items-center justify-center shrink-0">
            {storeLogo ? (
              <img
                src={storeLogo}
                alt={storeName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Store className="w-2.5 h-2.5 text-[#5C5B57] dark:text-zinc-400" />
            )}
          </div>
          <span className="text-[11px] font-bold text-[#111214] dark:text-[#F4F4F2] truncate">
            {storeName}
          </span>
          {isVerified && (
            <CheckCircle className={`w-3 h-3 shrink-0 ${getThemeClasses('verified')}`} />
          )}
        </div>
        {avgRating > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
            <Star className="w-2.5 h-2.5 fill-current" />
            <span>{avgRating.toFixed(1)}</span>
          </span>
        )}
      </div>
    );

    return (
      <div
        className="space-y-1 pb-1"
        onClick={(e) => {
          if (storeLink) e.stopPropagation();
        }}
      >
        {storeLink ? (
          <Link
            to={storeLink}
            className="block hover:opacity-80 transition-opacity"
            title={`عرض متجر ${storeName}`}
          >
            {StoreRowContent}
          </Link>
        ) : (
          StoreRowContent
        )}

        {(publishDateShort || storeCity) && (
          <div className="flex items-center justify-between gap-1.5 text-[10px] font-medium text-[#5C5B57] dark:text-zinc-400">
            {publishDateShort ? (
              <span className="inline-flex items-center gap-1 truncate tabular-nums">
                <Calendar className="w-2.5 h-2.5 shrink-0 opacity-80" />
                <span>نُشر {publishDateShort}</span>
              </span>
            ) : (
              <span />
            )}
            {storeCity && (
              <span className="inline-flex items-center gap-0.5 truncate shrink-0 max-w-[45%]">
                <MapPin className="w-2.5 h-2.5 shrink-0 opacity-80" />
                <span className="truncate">{storeCity}</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Detail card variant (for ProductDetail & VariantDetail)
  return (
    <div className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex items-center justify-center shrink-0">
            {storeLogo ? (
              <img
                src={storeLogo}
                alt={storeName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Store className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400" />
            )}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] truncate">
                {storeName}
              </span>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className={`w-3.5 h-3.5 ${getThemeClasses('verified')}`} />
                  <span>متجر موثق</span>
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-[#5C5B57] dark:text-zinc-400">
                  متجر مسجل
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
              {avgRating > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums text-amber-600 dark:text-amber-400 font-bold">
                  <Star className="w-3 h-3 fill-current" />
                  <span>{avgRating.toFixed(1)}/10</span>
                </span>
              )}
              {avgCredibility > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>مصداقية {avgCredibility.toFixed(1)}/10</span>
                </span>
              )}
              {storeCity && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>{storeCity}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {storeLink && (
          <Link
            to={storeLink}
            className="px-3 py-1.5 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[11px] font-bold text-[#111214] dark:text-[#F4F4F2] inline-flex items-center gap-1 shrink-0 transition-colors"
          >
            <span>زيارة المتجر</span>
            <ArrowLeft className="w-3 h-3" />
          </Link>
        )}
      </div>

      {(fullAddress || landmark || workingHours || mapHref) && (
        <div className="pt-2 border-t border-[#E5E2DA] dark:border-[#232730] space-y-1.5 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-300">
          {(fullAddress || mapHref) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {fullAddress && (
                <span className="inline-flex items-start gap-1.5 text-[#111214] dark:text-[#F4F4F2] font-semibold">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-80" />
                  <span>{fullAddress}</span>
                </span>
              )}
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  <span>الموقع على الخريطة</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          {(landmark || workingHours) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5C5B57] dark:text-zinc-400">
              {landmark && <span>أقرب معلم: {landmark}</span>}
              {workingHours && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>{workingHours}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {(publishDateFull || product.category) && (
        <div className="pt-2 border-t border-[#E5E2DA] dark:border-[#232730] flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
          {publishDateFull && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>تاريخ نشر المنتج: {publishDateFull}</span>
            </span>
          )}
          {product.category && (
            <span className="text-[11px] font-semibold text-[#111214] dark:text-[#F4F4F2]">
              القسم: {product.category}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
