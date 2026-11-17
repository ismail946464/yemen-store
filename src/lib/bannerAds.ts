export const MAX_BANNER_ADS = 5;
export const BANNER_ROTATION_INTERVAL_MS = 30000; // 30 seconds

export interface BannerAdItem {
  id: string;
  title?: string;
  subtitle?: string | null;
  badgeText?: string | null;
  image: string;
  buttonText?: string | null;
  targetStoreId?: string | null;
  targetStoreName?: string | null;
  customLink?: string | null;
  order: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const sortBannerAds = (ads: BannerAdItem[]): BannerAdItem[] => {
  return [...ads].sort((a, b) => {
    const orderDiff = (Number(a.order) || 999) - (Number(b.order) || 999);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
};

export const getActiveBannerAds = (ads: BannerAdItem[]): BannerAdItem[] => {
  return sortBannerAds(ads)
    .filter((ad) => ad.active !== false && String(ad.image || '').trim().length > 0)
    .slice(0, MAX_BANNER_ADS);
};

export type ResolvedBannerAction =
  | { type: 'internal'; path: string }
  | { type: 'external'; url: string }
  | { type: 'scroll' };

export const resolveBannerAdAction = (ad: Pick<BannerAdItem, 'targetStoreId' | 'customLink'>): ResolvedBannerAction => {
  const storeId = String(ad.targetStoreId || '').trim();
  if (storeId) {
    return { type: 'internal', path: `/store/${storeId}` };
  }
  const link = String(ad.customLink || '').trim();
  if (link && link !== '#' && !link.startsWith('#')) {
    if (/^https?:\/\//i.test(link)) {
      return { type: 'external', url: link };
    }
    return { type: 'internal', path: link.startsWith('/') ? link : `/${link}` };
  }
  return { type: 'scroll' };
};
