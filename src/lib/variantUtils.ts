export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  stock?: number | null;
  image?: string;
  notes?: string;
  storeId: string;
  available?: boolean;
}

/**
 * Returns only standalone variants belonging strictly to the publishing store (product.ownerId).
 */
export function getProductVariants(product: any): ProductVariant[] {
  if (!product || !Array.isArray(product.variants)) return [];
  const ownerId = product.ownerId || '';
  return product.variants
    .filter((v: any) => v && typeof v === 'object' && String(v.name || '').trim().length > 0)
    .filter((v: any) => !ownerId || !v.storeId || v.storeId === ownerId)
    .map((v: any, idx: number) => ({
      id: String(v.id || `var_${idx}_${String(v.name).slice(0, 10)}`),
      name: String(v.name || '').trim(),
      price: Number(v.price) > 0 ? Number(v.price) : Number(product.price || 0),
      originalPrice: v.originalPrice !== undefined && v.originalPrice !== null && v.originalPrice !== ''
        ? Number(v.originalPrice)
        : null,
      stock: v.stock === undefined || v.stock === null || v.stock === '' ? null : Number(v.stock),
      image: typeof v.image === 'string' ? v.image : '',
      notes: typeof v.notes === 'string' ? v.notes.trim() : '',
      storeId: String(v.storeId || ownerId || 'global'),
      available: v.available !== false,
    }));
}

/**
 * Returns only currently available (in-stock and enabled) variants of a product.
 */
export function getAvailableProductVariants(product: any): ProductVariant[] {
  return getProductVariants(product).filter(
    (v) => v.available !== false && (v.stock === null || v.stock === undefined || Number(v.stock) > 0)
  );
}

export function hasAvailableProductVariants(product: any): boolean {
  return getAvailableProductVariants(product).length > 0;
}

/**
 * Builds a clean, standalone cart-ready object for the base product itself
 * with zero interference from any product variants.
 */
export function buildBaseProductForCart(product: any): any {
  const {
    variants: _ignoredVariants,
    selectedVariantId: _ignoredVid,
    selectedVariantName: _ignoredVName,
    selectedVariantNotes: _ignoredVNotes,
    ...baseRest
  } = product || {};

  return {
    ...baseRest,
    noDelivery: Boolean(product?.noDelivery),
    price: Number(product?.price || 0),
    originalPrice: product?.originalPrice ? Number(product.originalPrice) : null,
    stock: product?.stock === undefined || product?.stock === null || product?.stock === ''
      ? null
      : Math.max(0, Math.floor(Number(product.stock))),
    available: product?.available !== false,
    _cartKey: product?.id,
  };
}

/**
 * Builds an independent cart-ready product object for a specific chosen variant,
 * completely isolated from the base product's price, crossed price, and stock.
 */
export function buildProductForVariantCart(product: any, variant: ProductVariant): any {
  const unitPrice = Number(variant.price) || 0;
  const variantImage = variant.image || product.image || (product.images && product.images[0]) || '';
  const variantStock = variant.stock === undefined || variant.stock === null
    ? null
    : Math.max(0, Math.floor(Number(variant.stock)));
  const hasVariantOffer = Boolean(variant.originalPrice && Number(variant.originalPrice) > unitPrice);
  return {
    id: product.id,
    title: product.title,
    category: product.category,
    ownerId: product.ownerId,
    ownerName: product.ownerName,
    ownerVerified: product.ownerVerified,
    noDelivery: Boolean(product.noDelivery),
    deliveryFee: product.noDelivery ? 0 : product.deliveryFee,
    offerType: hasVariantOffer ? 'discount' : null,
    hasOffer: hasVariantOffer,
    offerExpiresAt: null,
    isPreOrderEnabled: product.noDelivery ? true : product.isPreOrderEnabled,
    reservationDurationDays: product.reservationDurationDays,
    depositAmount: product.depositAmount,
    reservationTerms: product.reservationTerms,
    price: unitPrice,
    originalPrice: variant.originalPrice && Number(variant.originalPrice) > unitPrice
      ? Number(variant.originalPrice)
      : null,
    image: variantImage,
    stock: variantStock,
    available: variant.available !== false && (variantStock === null || variantStock > 0),
    selectedVariantId: variant.id,
    selectedVariantName: variant.name,
    selectedVariantNotes: variant.notes || '',
    _cartKey: `${product.id}__variant__${variant.id}`,
  };
}
