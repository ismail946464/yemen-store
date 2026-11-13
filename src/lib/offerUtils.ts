export type OfferType = 'discount' | 'bonus' | 'bundle' | 'free_delivery';

export function isProductOfferActive(product: any): boolean {
  if (!product) return false;
  const hasDiscountedOriginal =
    Number(product.originalPrice || 0) > Number(product.price || 0) &&
    Number(product.price || 0) > 0;
  const explicitOffer = Boolean(product.hasOffer);

  if (!explicitOffer && !hasDiscountedOriginal) return false;

  if (product.offerExpiresAt && String(product.offerExpiresAt).trim() !== '') {
    const exp = new Date(product.offerExpiresAt);
    if (!Number.isNaN(exp.getTime())) {
      exp.setHours(23, 59, 59, 999);
      if (exp.getTime() < Date.now()) return false;
    }
  }

  return true;
}

export function getProductDiscountPercent(product: any): number {
  if (!product) return 0;
  const orig = Number(product.originalPrice || 0);
  const price = Number(product.price || 0);
  if (orig > price && orig > 0) {
    return Math.round(((orig - price) / orig) * 100);
  }
  const explicit = Number(product.discountPercent || 0);
  return explicit > 0 && explicit <= 100 ? Math.round(explicit) : 0;
}

export function getOfferTypeLabel(offerType?: string): string {
  switch (offerType) {
    case 'bonus':
      return 'إضافة مجانية';
    case 'bundle':
      return 'عرض باقة';
    case 'free_delivery':
      return 'توصيل مجاني';
    case 'discount':
    default:
      return 'خصم خاص';
  }
}

export function getProductOfferBadgeText(product: any): string {
  if (!isProductOfferActive(product)) return '';
  const pct = getProductDiscountPercent(product);
  if (pct > 0) return `خصم ${pct}%`;
  if (product.offerType === 'free_delivery') return 'توصيل مجاني';
  if (product.offerType === 'bonus') return 'إضافة مجانية';
  if (product.offerType === 'bundle') return 'عرض باقة';
  if (product.offerTitle && String(product.offerTitle).trim()) {
    return String(product.offerTitle).trim();
  }
  return 'عرض خاص';
}
