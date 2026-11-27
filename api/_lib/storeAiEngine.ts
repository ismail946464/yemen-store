/**
 * Standalone Store AI Engine for Yemen Store Platform (Server-side)
 * Mirrored intelligence engine supporting 30+ intents, Arabic synonym matching,
 * numeric budget extraction, conversational follow-up awareness, and rich payloads.
 */

export interface AssistantProduct {
  id: string;
  title: string;
  price: number;
  category?: string;
  image?: string;
  images?: string[];
  description?: string;
  ownerId?: string;
  ownerName?: string;
  ownerVerified?: boolean;
  stock?: number | null;
  deliveryFee?: number;
  depositAmount?: number;
  reservationDurationDays?: number;
  noDelivery?: boolean;
  hasOffer?: boolean;
  offerType?: string;
  originalPrice?: number;
  discountPercent?: number;
  offerTitle?: string;
  offerExtras?: string;
  offerExpiresAt?: string;
  averageRating?: number;
  ratingCount?: number;
  variants?: Array<{ id?: string; name?: string; price?: number }>;
}

export interface AssistantPromoHint {
  code: string;
  discountType: 'percent' | 'fixed' | string;
  discountValue: number;
  minOrderAmount?: number;
  expiresAt?: string;
}

export interface AssistantAction {
  label: string;
  route: string;
  kind?: 'primary' | 'secondary';
}

export interface AssistantComparisonRow {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  deliveryFee?: number;
  noDelivery?: boolean;
  depositAmount?: number;
  ownerName?: string;
  ownerVerified?: boolean;
  category?: string;
  stock?: number | null;
}

export interface AssistantStatItem {
  label: string;
  value: string;
}

export interface AssistantChatResponse {
  reply: string;
  products: AssistantProduct[];
  suggestedQuestions?: string[];
  actions?: AssistantAction[];
  comparisonRows?: AssistantComparisonRow[];
  promoHints?: AssistantPromoHint[];
  statsHighlight?: AssistantStatItem[];
  provider: 'standalone_store_ai' | 'gemini';
}

export interface StoreAiOptions {
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  activePromos?: AssistantPromoHint[];
  categories?: Array<{ name: string; slug?: string }>;
}

type IntentType =
  | 'out_of_bounds'
  | 'compare_products'
  | 'promo_coupons'
  | 'price_negotiation'
  | 'buyer_requests'
  | 'watchlist_radar'
  | 'product_qa'
  | 'cart_and_checkout'
  | 'wallet_fees_question'
  | 'transfer_verify_question'
  | 'preorder_deposit'
  | 'store_pickup'
  | 'payment_methods'
  | 'delivery_eta_question'
  | 'gps_location_question'
  | 'courier_contact_question'
  | 'courier_conditions_question'
  | 'courier_role'
  | 'shipping_delivery'
  | 'store_commission_question'
  | 'store_create_question'
  | 'store_verification'
  | 'order_delay_question'
  | 'order_cancel_return'
  | 'order_tracking'
  | 'complaint_suggestion'
  | 'contact_support'
  | 'categories_list'
  | 'offers_discounts'
  | 'catalog_popular'
  | 'thanks_bye'
  | 'greeting'
  | 'product_search';

interface PriceConstraint {
  max?: number;
  min?: number;
  sort?: 'asc' | 'desc' | 'rating' | 'newest';
}

interface ContextAnalysis {
  intent: IntentType;
  keywords: string[];
  matchedProducts: AssistantProduct[];
  priceConstraint?: PriceConstraint;
  wantsFreeDelivery?: boolean;
  wantsVerifiedOnly?: boolean;
}

const ARABIC_STOPWORDS = new Set([
  'في', 'من', 'على', 'الى', 'عن', 'مع', 'او', 'و', 'ثم', 'هل', 'ما', 'ماذا', 'كيف', 'كم',
  'متى', 'اين', 'لماذا', 'لي', 'لك', 'لنا', 'لهم', 'هو', 'هي', 'هم', 'هذا', 'هذه', 'ذلك',
  'تلك', 'الذي', 'التي', 'اريد', 'ابغى', 'ابحث', 'دور', 'ممكن', 'لو', 'سمحت', 'فضلك',
  'عندكم', 'يوجد', 'متوفر', 'متوفره', 'موجود', 'موجوده', 'بكم', 'سعر', 'اسعار', 'منتج',
  'منتجات', 'سلعه', 'سلع', 'شي', 'حاجة', 'افضل', 'احسن', 'اجمل', 'ارخص', 'اغلى', 'اقل',
  'اعلى', 'اكثر', 'فقط', 'جدا', 'تحت', 'فوق', 'بين', 'ريال', 'يمني', 'ر.ي', 'الف', 'الاف',
  'عرض', 'اعرض', 'وريني', 'اعطني', 'ابي', 'توصيل', 'لـ', 'الـ', 'بـ'
]);

const SYNONYM_GROUPS: string[][] = [
  ['هاتف', 'هواتف', 'جوال', 'جوالات', 'موبايل', 'تلفون', 'تليفون', 'ايفون', 'سامسونج', 'شاومي', 'ريدمي', 'هواوي', 'انفنكس', 'تكنو', 'اندرويد', 'ذكي'],
  ['عسل', 'سدر', 'دوعني', 'عصيمي', 'شمع', 'سمره', 'نحل', 'مراعي'],
  ['لابتوب', 'لابتوبات', 'كمبيوتر', 'حاسوب', 'ماك', 'ديل', 'لينوفو', 'اتش بي', 'hp', 'asus'],
  ['ساعه', 'ساعات', 'ذكية', 'سمارت', 'كاسيو', 'رولكس'],
  ['عطر', 'عطور', 'بخور', 'عود', 'مخلط', 'مسك', 'دهن', 'عنبريه'],
  ['ملابس', 'ازياء', 'ثوب', 'اثواب', 'عبايه', 'عبايات', 'قميص', 'تيشرت', 'بنطلون', 'فستان', 'جلابيه', 'معوز', 'كوت', 'جاكيت'],
  ['حذاء', 'احذيه', 'شوز', 'جزمه', 'صندل', 'شنطه', 'شنط', 'حقيبه', 'حقائب'],
  ['بن', 'قهوه', 'حرازي', 'يافعي', 'خولاني', 'موكا', 'اسبريسو'],
  ['جنبيه', 'جنابي', 'خنجر', 'تراثي', 'شال', 'عقيق'],
  ['منزل', 'مطبخ', 'اواني', 'ديكور', 'اثاث', 'غرفه', 'مكيف', 'ثلاجه', 'غساله', 'خلاط', 'كهربائيه'],
  ['العاب', 'قيمنق', 'بلايستيشن', 'سوني', 'يد', 'كنترولر', 'سماعه', 'سماعات', 'ايربودز'],
  ['عنايه', 'جمال', 'بشره', 'كريم', 'سيروم', 'مكياج', 'شعر', 'زيت'],
  ['شاحن', 'باوربانك', 'بطاريه', 'كيبل', 'كفر', 'جراب', 'سماعه', 'طاقة', 'شمسيه', 'لوح']
];

export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandTokenSynonyms(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token.startsWith('ال') && token.length > 3) {
    variants.add(token.slice(2));
  } else if (token.length >= 2) {
    variants.add(`ال${token}`);
  }
  for (const group of SYNONYM_GROUPS) {
    if (group.some((w) => token === w || (token.length >= 3 && (w.includes(token) || token.includes(w))))) {
      for (const w of group) variants.add(w);
    }
  }
  return Array.from(variants);
}

function extractBudgetConstraint(normQuery: string): PriceConstraint | undefined {
  const constraint: PriceConstraint = {};
  let hasAny = false;

  const parseNum = (numStr: string, hasThousandWord: boolean): number => {
    const clean = Number(numStr.replace(/,/g, ''));
    if (!Number.isFinite(clean) || clean <= 0) return 0;
    return hasThousandWord && clean < 1000 ? clean * 1000 : clean;
  };

  const rangeMatch = normQuery.match(/(?:بين|من)\s+(\d+)\s*(الف|الاف)?\s+(?:و|الي|الى|حتى|-)\s+(\d+)\s*(الف|الاف)?/);
  if (rangeMatch) {
    const v1 = parseNum(rangeMatch[1], Boolean(rangeMatch[2]));
    const v2 = parseNum(rangeMatch[3], Boolean(rangeMatch[4]));
    if (v1 > 0 && v2 > 0) {
      constraint.min = Math.min(v1, v2);
      constraint.max = Math.max(v1, v2);
      hasAny = true;
    }
  }

  if (!hasAny) {
    const maxMatch = normQuery.match(/(?:اقل من|تحت|حدود|بحدود|ميزانيتي|لا يتجاوز|ما يزيد عن|بسعر)\s+(\d+)\s*(الف|الاف)?/);
    if (maxMatch) {
      const val = parseNum(maxMatch[1], Boolean(maxMatch[2]));
      if (val > 0) {
        if (normQuery.includes('بحدود') || normQuery.includes('حوالي')) {
          constraint.min = Math.round(val * 0.6);
          constraint.max = Math.round(val * 1.25);
        } else {
          constraint.max = val;
        }
        hasAny = true;
      }
    }
  }

  const minMatch = normQuery.match(/(?:فوق|اكثر من|اعلى من|من)\s+(\d+)\s*(الف|الاف)?/);
  if (minMatch && !rangeMatch && constraint.min === undefined) {
    const val = parseNum(minMatch[1], Boolean(minMatch[2]));
    if (val > 0 && !normQuery.includes('اقل من')) {
      constraint.min = val;
      hasAny = true;
    }
  }

  if (normQuery.includes('ارخص') || normQuery.includes('اقل سعر') || normQuery.includes('الاقتصادي')) {
    constraint.sort = 'asc';
    hasAny = true;
  } else if (normQuery.includes('اغلى') || normQuery.includes('فاخر') || normQuery.includes('فخم')) {
    constraint.sort = 'desc';
    hasAny = true;
  } else if (normQuery.includes('اعلى تقييم') || normQuery.includes('الاكثر تقييما')) {
    constraint.sort = 'rating';
    hasAny = true;
  }

  return hasAny ? constraint : undefined;
}

function getEffectiveDeposit(p: AssistantProduct): number {
  const safePrice = Math.max(0, Math.round(Number(p.price || 0)));
  const rawDep = Number(p.depositAmount || 0);
  if (safePrice <= 0) return 0;
  return Math.min(safePrice, rawDep > 0 ? Math.round(rawDep) : Math.max(1000, Math.round(safePrice * 0.2)));
}

function inferProductsFromHistory(
  catalog: AssistantProduct[],
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
): AssistantProduct[] {
  if (!history || history.length === 0 || catalog.length === 0) return [];
  const combined = normalizeArabic(history.slice(-4).map((h) => h.text).join(' '));
  if (!combined) return [];
  const mentioned = catalog.filter((p) => {
    const tNorm = normalizeArabic(p.title || '');
    return tNorm.length >= 3 && combined.includes(tNorm);
  });
  return mentioned.slice(0, 6);
}

function findRelevantProducts(
  normQuery: string,
  catalog: AssistantProduct[],
  meaningfulTokens: string[],
  constraint?: PriceConstraint,
  wantsFreeDelivery?: boolean,
  wantsVerifiedOnly?: boolean
): AssistantProduct[] {
  let pool = [...catalog];

  if (constraint?.min !== undefined) {
    pool = pool.filter((p) => Number(p.price || 0) >= constraint.min!);
  }
  if (constraint?.max !== undefined) {
    pool = pool.filter((p) => Number(p.price || 0) <= constraint.max!);
  }
  if (wantsFreeDelivery) {
    pool = pool.filter((p) => !p.noDelivery && Number(p.deliveryFee || 0) === 0);
  }
  if (wantsVerifiedOnly) {
    pool = pool.filter((p) => Boolean(p.ownerVerified));
  }

  if (meaningfulTokens.length === 0 && (constraint || wantsFreeDelivery || wantsVerifiedOnly)) {
    const sorted = [...pool].sort((a, b) => {
      if (constraint?.sort === 'asc') return Number(a.price || 0) - Number(b.price || 0);
      if (constraint?.sort === 'desc') return Number(b.price || 0) - Number(a.price || 0);
      if (constraint?.sort === 'rating') return Number(b.averageRating || 0) - Number(a.averageRating || 0);
      return Number(b.ownerVerified ? 1 : 0) - Number(a.ownerVerified ? 1 : 0);
    });
    return sorted.slice(0, 6);
  }

  const scored = pool.map((p) => {
    let score = 0;
    const titleNorm = normalizeArabic(p.title || '');
    const descNorm = normalizeArabic(p.description || '');
    const catNorm = normalizeArabic(p.category || '');
    const ownerNorm = normalizeArabic(p.ownerName || '');
    const variantNorm = normalizeArabic(
      Array.isArray(p.variants) ? p.variants.map((v) => v?.name || '').join(' ') : ''
    );

    if (normQuery.length >= 3 && titleNorm.includes(normQuery)) score += 25;
    if (normQuery.length >= 3 && catNorm.includes(normQuery)) score += 15;
    if (normQuery.length >= 3 && descNorm.includes(normQuery)) score += 8;

    for (const token of meaningfulTokens) {
      if (token.length < 2) continue;
      const expanded = expandTokenSynonyms(token);
      let tokenMatched = false;

      if (titleNorm.includes(token)) {
        score += 10;
        tokenMatched = true;
      } else if (expanded.some((syn) => titleNorm.includes(syn))) {
        score += 6;
        tokenMatched = true;
      }

      if (catNorm.includes(token)) {
        score += 7;
        tokenMatched = true;
      } else if (expanded.some((syn) => catNorm.includes(syn))) {
        score += 5;
        tokenMatched = true;
      }

      if (variantNorm.includes(token) || expanded.some((syn) => variantNorm.includes(syn))) {
        score += 5;
        tokenMatched = true;
      }

      if (ownerNorm.includes(token)) {
        score += 5;
        tokenMatched = true;
      }

      if (descNorm.includes(token) || (!tokenMatched && expanded.some((syn) => descNorm.includes(syn)))) {
        score += 3;
      }
    }

    if (score > 0) {
      if (p.ownerVerified) score += 1.5;
      if (p.hasOffer || Number(p.originalPrice || 0) > Number(p.price || 0)) score += 1;
      if (p.stock && p.stock > 0) score += 0.5;
    }

    return { product: p, score };
  });

  let matching = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);

  if (constraint?.sort === 'asc') {
    matching = [...matching].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (constraint?.sort === 'desc') {
    matching = [...matching].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (constraint?.sort === 'rating') {
    matching = [...matching].sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0));
  }

  return matching.slice(0, 6);
}

function analyzeContext(
  userQuery: string,
  catalog: AssistantProduct[],
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
): ContextAnalysis {
  const normQuery = normalizeArabic(userQuery);
  const rawTokens = normQuery.split(/\s+/).filter((t) => t.length > 1);
  const meaningfulTokens = rawTokens.filter(
    (t) => !ARABIC_STOPWORDS.has(t) && !/^\d+$/.test(t)
  );
  const priceConstraint = extractBudgetConstraint(normQuery);
  const wantsFreeDelivery =
    normQuery.includes('توصيل مجاني') ||
    normQuery.includes('شحن مجاني') ||
    normQuery.includes('بدون رسوم توصيل');
  const wantsVerifiedOnly =
    normQuery.includes('متاجر موثقه') || normQuery.includes('موثق فقط');

  const outOfBoundsWords = [
    'برمجه', 'كود بايثون', 'جافا سكريبت', 'سياسه', 'انتخابات', 'عاصمه فرنسا',
    'طبخ البيتزا', 'فيزياء', 'كيمياء', 'ترجم انجليزي', 'طقس العالم', 'مباراه اليوم'
  ];
  if (outOfBoundsWords.some((w) => normQuery.includes(w))) {
    return { intent: 'out_of_bounds', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    /^(شكرا|شكراً|يسلمو|مشكور|يعطيك العافيه|تسلم|ممتاز|رائع|جميل)/.test(normQuery) &&
    rawTokens.length <= 5
  ) {
    return { intent: 'thanks_bye', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    /^(مرحبا|اهلا|اهلين|السلام عليكم|وعليكم السلام|سلام|صباح الخير|مساء الخير|هلا)/.test(normQuery) &&
    rawTokens.length <= 4
  ) {
    return {
      intent: 'greeting',
      keywords: meaningfulTokens,
      matchedProducts: catalog.slice(0, 4)
    };
  }

  const matchedForQuery = findRelevantProducts(
    normQuery,
    catalog,
    meaningfulTokens,
    priceConstraint,
    wantsFreeDelivery,
    wantsVerifiedOnly
  );
  const historyProducts = inferProductsFromHistory(catalog, history);

  if (
    normQuery.includes('قارن') ||
    normQuery.includes('مقارنه') ||
    normQuery.includes('ايهما افضل') ||
    normQuery.includes('الفرق بين')
  ) {
    const comparePool =
      matchedForQuery.length >= 2
        ? matchedForQuery.slice(0, 4)
        : historyProducts.length >= 2
          ? historyProducts.slice(0, 4)
          : catalog.slice(0, 3);
    return {
      intent: 'compare_products',
      keywords: meaningfulTokens,
      matchedProducts: comparePool
    };
  }

  if (
    normQuery.includes('كوبون') ||
    normQuery.includes('كود خصم') ||
    normQuery.includes('اكواد') ||
    normQuery.includes('برومو') ||
    normQuery.includes('قسيمه')
  ) {
    return { intent: 'promo_coupons', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('تفاوض') ||
    normQuery.includes('مفاوضه') ||
    normQuery.includes('ساوم') ||
    normQuery.includes('مكاسره') ||
    normQuery.includes('اقدم عرض سعر') ||
    normQuery.includes('اقترح سعر')
  ) {
    return {
      intent: 'price_negotiation',
      keywords: meaningfulTokens,
      matchedProducts: matchedForQuery.length > 0 ? matchedForQuery.slice(0, 4) : historyProducts.slice(0, 3)
    };
  }

  if (
    normQuery.includes('تسعيره') ||
    normQuery.includes('اطلب تسعير') ||
    normQuery.includes('طلبات المشترين') ||
    normQuery.includes('توفير السلع') ||
    normQuery.includes('سلعه غير موجوده') ||
    normQuery.includes('طلب مخصص')
  ) {
    return { intent: 'buyer_requests', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('رادار') ||
    normQuery.includes('تنبيه السعر') ||
    normQuery.includes('مراقبه السعر') ||
    normQuery.includes('قائمه المفضله') ||
    (normQuery.includes('المفضله') && !normQuery.includes('منتجات'))
  ) {
    return { intent: 'watchlist_radar', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('اسال التاجر') ||
    normQuery.includes('اسئله المنتج') ||
    normQuery.includes('استفسار عام') ||
    normQuery.includes('تقييمات المنتج')
  ) {
    return { intent: 'product_qa', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('رسوم اضافيه') ||
    normQuery.includes('عموله عند الدفع') ||
    normQuery.includes('ضريبه المحفظه')
  ) {
    return { intent: 'wallet_fees_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('اتاكد من وصول') ||
    normQuery.includes('وصول حوالتي') ||
    normQuery.includes('تاكيد الحواله') ||
    normQuery.includes('تاكيد السند')
  ) {
    return { intent: 'transfer_verify_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('سله المشتريات') ||
    normQuery.includes('السله') ||
    normQuery.includes('اتمام الطلب') ||
    normQuery.includes('كيف اشتري') ||
    normQuery.includes('اطلب احد منتجات')
  ) {
    return { intent: 'cart_and_checkout', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('استلام من المتجر') ||
    normQuery.includes('استلم بنفسي') ||
    normQuery.includes('استلام الطلب بنفسي') ||
    normQuery.includes('مقر المتجر') ||
    normQuery.includes('بدون توصيل')
  ) {
    const pickupItems = catalog.filter((p) => Boolean(p.noDelivery));
    return {
      intent: 'store_pickup',
      keywords: meaningfulTokens,
      matchedProducts: pickupItems.slice(0, 4)
    };
  }

  if (
    normQuery.includes('عربون') ||
    normQuery.includes('حجز') ||
    normQuery.includes('احجز') ||
    normQuery.includes('حجوزات')
  ) {
    const targetProducts =
      matchedForQuery.length > 0
        ? matchedForQuery.slice(0, 4)
        : historyProducts.length > 0
          ? historyProducts.slice(0, 4)
          : catalog.filter((p) => !p.noDelivery || p.depositAmount).slice(0, 4);
    return {
      intent: 'preorder_deposit',
      keywords: meaningfulTokens,
      matchedProducts: targetProducts
    };
  }

  if (
    normQuery.includes('شروط العمل كمندوب') ||
    normQuery.includes('شروط المندوب') ||
    normQuery.includes('اين اجد بوابه التوصيل')
  ) {
    return { intent: 'courier_conditions_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('اتواصل مع مندوب') ||
    normQuery.includes('رقم المندوب') ||
    normQuery.includes('مراسله المندوب')
  ) {
    return { intent: 'courier_contact_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('تاخر طلبي') ||
    normQuery.includes('تاخر الطلب') ||
    normQuery.includes('لم يصل الطلب')
  ) {
    return { intent: 'order_delay_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('المده المستغرقه') ||
    normQuery.includes('كم يستغرق') ||
    normQuery.includes('متى يوصل') ||
    normQuery.includes('وقت التوصيل') ||
    normQuery.includes('مده التوصيل')
  ) {
    return { intent: 'delivery_eta_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('موقعي بدقه') ||
    normQuery.includes('على الخريطه') ||
    normQuery.includes('gps') ||
    normQuery.includes('تحديد موقع')
  ) {
    return { intent: 'gps_location_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('عموله المنصه') ||
    normQuery.includes('نسبه المنصه') ||
    normQuery.includes('رسوم المتاجر')
  ) {
    return { intent: 'store_commission_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('انشئ حساب متجر') ||
    normQuery.includes('فتح متجر') ||
    normQuery.includes('انشاء متجر') ||
    normQuery.includes('اضيف منتجاتي') ||
    normQuery.includes('حساب تاجر')
  ) {
    return { intent: 'store_create_question', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('شكوى') ||
    normQuery.includes('اقتراح') ||
    normQuery.includes('ابلاغ') ||
    normQuery.includes('بلاغ')
  ) {
    return { intent: 'complaint_suggestion', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('الغاء الطلب') ||
    normQuery.includes('استرجاع') ||
    normQuery.includes('استبدال') ||
    normQuery.includes('ارجاع')
  ) {
    return { intent: 'order_cancel_return', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('دفع') ||
    normQuery.includes('كريمي') ||
    normQuery.includes('جوالي') ||
    normQuery.includes('جيب') ||
    normQuery.includes('ون كاش') ||
    normQuery.includes('محفظه') ||
    normQuery.includes('محافظ') ||
    normQuery.includes('تحويل') ||
    normQuery.includes('سند') ||
    normQuery.includes('اشعار') ||
    normQuery.includes('عند الاستلام') ||
    normQuery.includes('حساب بنكي')
  ) {
    return { intent: 'payment_methods', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('مندوب') ||
    normQuery.includes('توصيل طلبات') ||
    normQuery.includes('رتبه توصيل') ||
    normQuery.includes('بوابه التوصيل')
  ) {
    return { intent: 'courier_role', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('شحن') ||
    normQuery.includes('توصيل') ||
    normQuery.includes('لصنعاء') ||
    normQuery.includes('لعدن') ||
    normQuery.includes('للمحافظات')
  ) {
    if (wantsFreeDelivery && matchedForQuery.length > 0) {
      return {
        intent: 'offers_discounts',
        keywords: meaningfulTokens,
        matchedProducts: matchedForQuery,
        wantsFreeDelivery: true
      };
    }
    const target = matchedForQuery.length > 0 ? matchedForQuery : historyProducts;
    return {
      intent: 'shipping_delivery',
      keywords: meaningfulTokens,
      matchedProducts: target.slice(0, 4)
    };
  }

  if (
    normQuery.includes('تتبع') ||
    normQuery.includes('طلبي') ||
    normQuery.includes('طلباتي') ||
    normQuery.includes('وين وصل') ||
    normQuery.includes('حاله الطلب')
  ) {
    return { intent: 'order_tracking', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('توثيق') ||
    normQuery.includes('المتاجر الموثقه') ||
    normQuery.includes('شاره التوثيق') ||
    normQuery.includes('سجل تجاري')
  ) {
    return { intent: 'store_verification', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('تواصل') ||
    normQuery.includes('اداره') ||
    normQuery.includes('رقم هاتف') ||
    normQuery.includes('خدمه العملاء') ||
    normQuery.includes('واتساب المتجر') ||
    normQuery.includes('مراسله')
  ) {
    return { intent: 'contact_support', keywords: meaningfulTokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('اقسام') ||
    normQuery.includes('تصنيفات') ||
    normQuery.includes('فئات') ||
    normQuery.includes('انواع المنتجات')
  ) {
    return { intent: 'categories_list', keywords: meaningfulTokens, matchedProducts: catalog.slice(0, 4) };
  }

  if (
    normQuery.includes('عروض') ||
    normQuery.includes('تخفيض') ||
    normQuery.includes('تخفيضات') ||
    normQuery.includes('خصم') ||
    normQuery.includes('خصومات') ||
    normQuery.includes('هديه') ||
    normQuery.includes('صفقات')
  ) {
    const offerItems = catalog.filter(
      (p) =>
        Boolean(p.hasOffer) ||
        Number(p.originalPrice || 0) > Number(p.price || 0) ||
        (!p.noDelivery && Number(p.deliveryFee || 0) === 0)
    );
    return {
      intent: 'offers_discounts',
      keywords: meaningfulTokens,
      matchedProducts: offerItems.slice(0, 6)
    };
  }

  if (
    normQuery.includes('الاكثر طلبا') ||
    normQuery.includes('الاكثر مبيعا') ||
    normQuery.includes('احدث المنتجات') ||
    normQuery.includes('جميع المنتجات') ||
    normQuery.includes('كل المنتجات') ||
    normQuery.includes('منتجات المتوفره') ||
    normQuery.includes('المزيد من المنتجات') ||
    normQuery.includes('وش عندكم') ||
    normQuery.includes('ايش تبيعوا') ||
    normQuery.includes('مختارات')
  ) {
    let pickPool = [...catalog];
    if (normQuery.includes('المزيد') && historyProducts.length > 0) {
      const seenIds = new Set(historyProducts.map((h) => h.id));
      const sameCat = historyProducts[0]?.category;
      const similar = catalog.filter((p) => !seenIds.has(p.id) && p.category === sameCat);
      pickPool = similar.length > 0 ? similar : catalog.filter((p) => !seenIds.has(p.id));
      if (pickPool.length === 0) pickPool = catalog;
    } else if (normQuery.includes('الاكثر طلبا') || normQuery.includes('مبيعا')) {
      pickPool = [...catalog].sort(
        (a, b) =>
          (Number(b.ratingCount || 0) * 2 + Number(b.averageRating || 0) + (b.ownerVerified ? 2 : 0)) -
          (Number(a.ratingCount || 0) * 2 + Number(a.averageRating || 0) + (a.ownerVerified ? 2 : 0))
      );
    }
    return {
      intent: 'catalog_popular',
      keywords: meaningfulTokens,
      matchedProducts: pickPool.slice(0, 6)
    };
  }

  return {
    intent: 'product_search',
    keywords: meaningfulTokens,
    matchedProducts: matchedForQuery,
    priceConstraint,
    wantsFreeDelivery,
    wantsVerifiedOnly
  };
}

function buildComparisonRows(products: AssistantProduct[]): AssistantComparisonRow[] {
  return products.slice(0, 4).map((p) => ({
    id: p.id,
    title: p.title,
    price: Number(p.price || 0),
    originalPrice: Number(p.originalPrice || 0) > Number(p.price || 0) ? Number(p.originalPrice) : undefined,
    deliveryFee: p.noDelivery ? undefined : Number(p.deliveryFee || 0),
    noDelivery: Boolean(p.noDelivery),
    depositAmount: getEffectiveDeposit(p),
    ownerName: p.ownerName || '',
    ownerVerified: Boolean(p.ownerVerified),
    category: p.category || '',
    stock: p.stock ?? null,
  }));
}

export function runStandaloneStoreAi(
  userQuery: string,
  catalog: AssistantProduct[],
  settings?: any,
  options?: StoreAiOptions
): AssistantChatResponse {
  const storeName = settings?.storeName || 'متجر محيط';
  const activePromos = Array.isArray(options?.activePromos) ? options!.activePromos! : [];
  const analysis = analyzeContext(userQuery, catalog, options?.history);

  switch (analysis.intent) {
    case 'out_of_bounds': {
      return {
        reply: `أنا مستشار "${storeName}" المخصص حصرياً لخدمتك في التسوق داخل المنصة.\n\nيمكنني مساعدتك فوراً في:\n• البحث عن المنتجات بالاسم أو القسم أو الميزانية المحددة.\n• مقارنة الأسعار ورسوم التوصيل والعربون بين المنتجات.\n• إيجاد العروض النشطة وكوبونات الخصم المتاحة.\n• تتبع طلباتك، التفاوض على الأسعار، أو طلب تسعيرة خاصة.\n\nما المنتج أو الخدمة التي تبحث عنها في المتجر الآن؟`,
        products: catalog.slice(0, 3),
        suggestedQuestions: [
          'ما هي المنتجات الأكثر طلباً؟',
          'عرض أحدث العروض والخصومات',
          'ما هي أقسام المتجر الرئيسية؟'
        ],
        actions: [{ label: 'اطلب تسعيرة خاصة', route: '/requests', kind: 'secondary' }],
        provider: 'standalone_store_ai'
      };
    }

    case 'thanks_bye': {
      return {
        reply: `العفو، يسعدني دائماً خدمتك في ${storeName}! إذا احتجت البحث عن أي سلعة أو مقارنة الأسعار أو متابعة طلبك في أي وقت فأنا جاهز لمساعدتك فوراً.`,
        products: [],
        suggestedQuestions: [
          'عرض أحدث العروض والخصومات',
          'متابعة حالة طلباتي',
          'الذهاب لسلة المشتريات'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'greeting': {
      const verifiedCount = catalog.filter((p) => p.ownerVerified).length;
      return {
        reply: `أهلاً بك في ${storeName}! يسعدني مساعدتك اليوم.\n\nلدينا حالياً ${catalog.length} منتج متاح للتصفح والشراء الفوري (${verifiedCount} منها من متاجر موثقة). اكتب لي اسم السلعة، أو ميزانيتك (مثلاً: «هواتف أقل من 100 ألف»)، أو اختر من الاقتراحات السريعة أدناه:`,
        products: analysis.matchedProducts,
        statsHighlight: [
          { label: 'منتجات متاحة', value: `${catalog.length}` },
          { label: 'متاجر موثقة', value: `${verifiedCount}` },
          ...(activePromos.length > 0 ? [{ label: 'كوبونات نشطة', value: `${activePromos.length}` }] : [])
        ],
        suggestedQuestions: [
          'ما هي المنتجات الأكثر طلباً؟',
          'عرض العروض والتخفيضات الحالية',
          'هل يوجد كوبونات خصم نشطة؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'compare_products': {
      const items = analysis.matchedProducts;
      if (items.length >= 2) {
        const sortedByPrice = [...items].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        const cheapest = sortedByPrice[0];
        const mostExpensive = sortedByPrice[sortedByPrice.length - 1];
        const diff = Number(mostExpensive.price || 0) - Number(cheapest.price || 0);
        return {
          reply: `إليك مقارنة دقيقة بين ${items.length} منتجات من كتالوج ${storeName}:\n\n• الخيار الأقل سعراً: "${cheapest.title}" بسعر ${Number(cheapest.price).toLocaleString()} ر.ي.\n• فارق السعر بين الأعلى والأقل: ${diff.toLocaleString()} ر.ي.\n• يمكنك مراجعة الجدول أدناه للمقارنة في السعر، التوصيل، العربون، وحالة التوثيق قبل اتخاذ قرارك:`,
          products: items,
          comparisonRows: buildComparisonRows(items),
          suggestedQuestions: [
            `أريد تفاصيل أكثر عن ${cheapest.title}`,
            'كيف أفاوض التاجر على السعر؟',
            'عرض منتجات في نفس القسم'
          ],
          provider: 'standalone_store_ai'
        };
      }
      return {
        reply: `لعمل مقارنة دقيقة، اكتب لي أسماء المنتجات أو القسم الذي تود المقارنة فيه (مثلاً: «قارن بين أرخص الهواتف» أو «قارن بين أنواع العسل»).`,
        products: catalog.slice(0, 4),
        suggestedQuestions: [
          'قارن بين المنتجات الأكثر طلباً',
          'ما هي أقسام المتجر الرئيسية؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'promo_coupons': {
      if (activePromos.length > 0) {
        const lines = activePromos.slice(0, 5).map((c) => {
          const valLabel = c.discountType === 'percent' ? `خصم ${c.discountValue}%` : `خصم ${Number(c.discountValue).toLocaleString()} ر.ي`;
          const minNote = c.minOrderAmount && c.minOrderAmount > 0 ? ` (للطلبات فوق ${Number(c.minOrderAmount).toLocaleString()} ر.ي)` : '';
          return `• الكود: ${c.code} — ${valLabel}${minNote}`;
        }).join('\n');
        return {
          reply: `تتوفر حالياً ${activePromos.length} أكواد خصم فعالة في ${storeName}:\n\n${lines}\n\nانسخ أي كود أدناه وألصقه في خانة «كود الخصم» داخل صفحة السلة ليُخصم المبلغ تلقائياً من فاتورتك!`,
          products: [],
          promoHints: activePromos.slice(0, 5),
          actions: [{ label: 'فتح سلة المشتريات', route: '/cart', kind: 'primary' }],
          suggestedQuestions: [
            'عرض المنتجات التي عليها عروض',
            'كيف يعمل التفاوض على السعر؟',
            'ما هي طرق الدفع المتاحة؟'
          ],
          provider: 'standalone_store_ai'
        };
      }
      return {
        reply: `يمكنك استخدام أكواد الخصم (الكوبونات) مباشرة في صفحة «سلة المشتريات» عبر إدخال الكود في خانة «كود الخصم» والضغط على «تطبيق» ليتم احتساب الخصم فوراً قبل تأكيد الطلب.\n\nحالياً لا توجد كوبونات عامة منشورة، لكن يمكنك الاستفادة من العروض والخصومات المباشرة على المنتجات أو استخدام ميزة «تفاوض على السعر» داخل صفحة أي منتج!`,
        products: catalog.filter((p) => p.hasOffer || Number(p.originalPrice || 0) > Number(p.price || 0)).slice(0, 4),
        actions: [
          { label: 'الذهاب للسلة', route: '/cart', kind: 'primary' },
          { label: 'اطلب تسعيرة خاصة', route: '/requests', kind: 'secondary' }
        ],
        suggestedQuestions: [
          'كيف أتفاوض على السعر مع التاجر؟',
          'عرض العروض والتخفيضات الحالية'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'price_negotiation': {
      const target = analysis.matchedProducts[0];
      const prodLine = target
        ? `\n\nمثال على "${target.title}" (سعره الحالي ${Number(target.price).toLocaleString()} ر.ي): يمكنك فتح صفحته والضغط على «تفاوض على السعر» لتقديم سعرك المقترح.`
        : '';
      return {
        reply: `ميزة التفاوض المباشر على السعر في ${storeName}:\n\nتتيح لك تقديم عرض سعر مخصص للتاجر على أي منتج متاح للتوصيل:\n1. افتح صفحة المنتج واضغط على زر «تفاوض على السعر (قدّم عرضك للمتجر)».\n2. أدخل السعر المقترح والكمية المطلوبة مع أي ملاحظة للتاجر.\n3. يصلك إشعار فوري عند قبول العرض، وتجد جميع عروضك في صفحة «طلباتي ← تبويب عروض الأسعار» مع زر لإضافتها للسلة بالسعر المتفق عليه فوراً.${prodLine}`,
        products: analysis.matchedProducts,
        actions: [
          { label: 'متابعة عروض الأسعار في طلباتي', route: '/orders', kind: 'primary' }
        ],
        suggestedQuestions: [
          'هل يوجد كوبونات خصم إضافية؟',
          'كيف أستخدم رادار الأسعار؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'buyer_requests': {
      return {
        reply: `خدمة «اطلب تسعيرة» (سوق طلبات المشترين) في ${storeName}:\n\nإذا لم تجد السلعة المطلوبة أو أردت الحصول على أفضل عرض سعر من عدة متاجر موثقة:\n1. انتقل إلى صفحة «اطلب تسعيرة» واكتب اسم السلعة والمواصفات والميزانية التقريبية.\n2. يصل طلبك فوراً للمتاجر المتخصصة فتتنافس لتقديم أفضل سعر وتوصيل لك.\n3. تختار العرض الأنسب لك وتنتقل للشراء مباشرة.`,
        products: [],
        actions: [{ label: 'فتح صفحة اطلب تسعيرة الآن', route: '/requests', kind: 'primary' }],
        suggestedQuestions: [
          'كيف أتفاوض على سعر منتج موجود؟',
          'تصفح المتاجر الموثقة في المنصة'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'watchlist_radar': {
      return {
        reply: `رادار الأسعار وقائمة المفضلة في ${storeName}:\n\n• يمكنك حفظ أي منتج بالضغط على أيقونة القلب للرجوع إليه لاحقاً.\n• تفعيل «رادار السعر» داخل صفحة المنتج ينبهك تلقائياً فور انخفاض سعر السلعة عن حدك المستهدف أو عند توفر المخزون من جديد.\n• تتابع كافة المنتجات المراقبة من صفحة «المفضلة والرادار».`,
        products: [],
        actions: [{ label: 'فتح المفضلة والرادار', route: '/watchlist', kind: 'primary' }],
        suggestedQuestions: [
          'عرض أحدث المنتجات المتوفرة',
          'عرض العروض والتخفيضات الحالية'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'product_qa': {
      return {
        reply: `الأسئلة والأجوبة العامة والتقييمات:\n\nفي أسفل صفحة كل منتج تجد قسمين متكاملين:\n1. التقييمات والآراء: تقييمات حقيقية بالنجوم والتعليقات من المشترين.\n2. الأسئلة والأجوبة: اطرح سؤالك العام عن المواصفات أو الضمان أو المقاسات ليظهر للجميع ويجيب عليه صاحب المتجر رسمياً مع إشعار فوري لك عند الرد.`,
        products: [],
        suggestedQuestions: [
          'كيف أتفاوض على السعر مع التاجر؟',
          'عرض المنتجات الأعلى تقييماً'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'cart_and_checkout': {
      return {
        reply: `خطوات إتمام الشراء من سلة المشتريات:\n\n1. أضف المنتجات المطلوبة للسلة (وحدد الكمية أو الصنف المناسب).\n2. افتح صفحة السلة وأدخل كود الخصم إن وُجد.\n3. اختر طريقة الدفع (نقداً عند الاستلام أو عبر الكريمي / جوالي / جيب / ون كاش مع إرفاق سند التحويل).\n4. حدد موقعك على الخريطة بدقة واضغط «تأكيد الطلب» ليبدأ التجهيز فوراً.`,
        products: [],
        actions: [{ label: 'الانتقال إلى سلة المشتريات', route: '/cart', kind: 'primary' }],
        suggestedQuestions: [
          'هل يوجد كوبونات خصم نشطة؟',
          'ما هي المحافظ الإلكترونية المعتمدة؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'wallet_fees_question': {
      return {
        reply: `لا تفرض منصة ${storeName} أي رسوم أو عمولات إضافية على المشتري عند الدفع عبر المحافظ الإلكترونية أو بنك الكريمي؛ تدفع فقط قيمة الطلب ورسوم التوصيل الموضحة في الفاتورة قبل التأكيد (وقد تُطبّق فقط رسوم التحويل المعتادة الخاصة بتطبيق محفظتك أو البنك نفسه).`,
        products: [],
        actions: [{ label: 'فتح سلة المشتريات', route: '/cart', kind: 'secondary' }],
        suggestedQuestions: [
          'كيف أتأكد من وصول حوالتي للمتجر؟',
          'ما هي المحافظ الإلكترونية المعتمدة؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'transfer_verify_question': {
      return {
        reply: `لتأكيد وصول حوالتك بسرعة وأمان:\n\n1. بعد التحويل من تطبيقك (الكريمي، جوالي، جيب، إلخ) التقط صورة واضحة لسند الإشعار وأرفقها عند تأكيد الطلب في السلة.\n2. يتحول طلبك إلى «بانتظار التأكيد»، ويراجعه المتجر أو الإدارة فورياً ويغيّر حالته إلى «جاري التجهيز» مع إشعار يصلك مباشرة.\n3. في حال تأخر التحديث، يمكنك مراسلة المتجر أو الإدارة من صفحة المحادثات وتزويدهم برقم الطلب.`,
        products: [],
        actions: [
          { label: 'مراجعة حالة طلباتي', route: '/orders', kind: 'primary' },
          { label: 'مراسلة الإدارة', route: '/contact?to=admin', kind: 'secondary' }
        ],
        suggestedQuestions: [
          'الذهاب إلى صفحة طلباتي الآن',
          'كيف أتواصل مع المتجر؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'store_pickup': {
      const pickupCount = analysis.matchedProducts.length;
      return {
        reply: pickupCount > 0
          ? `نعم، يوجد في ${storeName} منتجات تدعم الاستلام المباشر من مقر المتجر (بدون رسوم توصيل) عبر نظام «حجز للاستلام من المتجر»:\n\n• تدفع عربوناً لضمان حفظ السلعة باسمك طوال مدة الحجز (عادة 3 إلى 5 أيام).\n• يظهر لك عنوان المتجر ورقم الهاتف وموقع خرائط Google في بطاقة المنتج وتفاصيل الحجز.\n• تحضر للمتجر خلال المهلة، تفحص السلعة وتدفع المبلغ المتبقي وتستلمها يداً بيد.`
          : `نعم، المتاجر التي تفعل خيار «الاستلام من المتجر» توفر لك عنوان المتجر وموقعه الدقيق على الخريطة في صفحة المنتج وصفحة تفاصيل الطلب، كما يمكنك التواصل مع التاجر مباشرة عبر المحادثات لترتيب الاستلام الشخصي من مقر المتجر بدون رسوم توصيل.`,
        products: analysis.matchedProducts,
        suggestedQuestions: [
          'كيف يعمل نظام الحجز ودفع العربون؟',
          'تصفح المتاجر الموثقة وعناوينها'
        ],
        actions: [{ label: 'تصفح المتاجر وعناوينها', route: '/search-stores', kind: 'secondary' }],
        provider: 'standalone_store_ai'
      };
    }

    case 'preorder_deposit': {
      let productContext = '';
      let stats: AssistantStatItem[] | undefined;
      if (analysis.matchedProducts.length > 0) {
        const p = analysis.matchedProducts[0];
        const safePrice = Math.max(0, Math.round(Number(p.price || 0)));
        const deposit = getEffectiveDeposit(p);
        const remaining = Math.max(0, safePrice - deposit);
        const days = p.reservationDurationDays || 3;
        productContext = `\n\nحسبة العربون لمنتج "${p.title}":\n• السعر الكلي: ${safePrice.toLocaleString()} ر.ي\n• العربون المطلوب للحجز: ${deposit.toLocaleString()} ر.ي\n• المتبقي عند الاستلام: ${remaining.toLocaleString()} ر.ي\n• مهلة الاستلام: ${days} أيام`;
        stats = [
          { label: 'السعر الإجمالي', value: `${safePrice.toLocaleString()} ر.ي` },
          { label: 'العربون المطلوب', value: `${deposit.toLocaleString()} ر.ي` },
          { label: 'المتبقي عند الاستلام', value: `${remaining.toLocaleString()} ر.ي` }
        ];
      }

      return {
        reply: `نظام الحجز المسبق ودفع العربون في ${storeName}:\n\nيتيح لك تثبيت السلعة باسمك ومنع بيعها لغيرك:\n1. تسدد عربوناً محدداً (عادة 20% من السعر أو المبلغ الظاهر في صفحة المنتج) عبر المحافظ المعتمدة.\n2. تُجمّد السلعة باسمك خلال فترة الحجز (من 3 إلى 5 أيام).\n3. عند الاستلام (من المندوب أو مقر المتجر) تدفع باقي القيمة فقط.\n4. في حال انتهاء المهلة دون استلام أو تواصل منك، يحق للمتجر إلغاء الحجز والاحتفاظ بالعربون كتعويض.${productContext}`,
        products: analysis.matchedProducts,
        statsHighlight: stats,
        suggestedQuestions: [
          'هل يوجد رسوم إضافية عند الدفع بالمحفظة؟',
          'كيف أتأكد من وصول حوالتي للمتجر؟',
          'عرض منتجات الاستلام من المتجر'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'payment_methods': {
      return {
        reply: `طرق السداد المعتمدة في ${storeName}:\n\n1. الدفع نقداً عند الاستلام (COD): تدفع عند استلام الطلب وفحصه من المندوب.\n2. المحافظ الإلكترونية والحوالات البنكية:\n• بنك الكريمي (حساب / كريمي كاش)\n• محفظة جوالي (Jawali)\n• محفظة جيب (Jeeb)\n• ون كاش وكاش إكسبرس\n\nتختار وسيلة الدفع في صفحة السلة، فتظهر لك أرقام الحسابات الرسمية للمتجر مع إمكانية رفع صورة سند التحويل مباشرة.`,
        products: [],
        actions: [{ label: 'فتح سلة المشتريات', route: '/cart', kind: 'secondary' }],
        suggestedQuestions: [
          'هل يوجد رسوم إضافية عند الدفع بالمحفظة؟',
          'كيف أتأكد من وصول حوالتي للمتجر؟',
          'هل يوجد كوبونات خصم نشطة؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'delivery_eta_question': {
      return {
        reply: `المدة المتوقعة لوصول الطلبات في ${storeName}:\n\n• داخل نفس المدينة (مثل صنعاء، عدن، تعز، المكلا، الحديدة، إب): عادة خلال 2 إلى 24 ساعة من تأكيد التجهيز.\n• بين المحافظات اليمنية: من يوم إلى 3 أيام عمل حسب المسافة وشركة النقل المعتمدة.\n\nتتغير حالة طلبك لحظة بلحظة في صفحة «طلباتي» فور خروج المندوب للتسليم.`,
        products: [],
        actions: [{ label: 'متابعة طلباتي الآن', route: '/orders', kind: 'primary' }],
        suggestedQuestions: [
          'ماذا أفعل إذا تأخر طلبي عن الموعد؟',
          'كيف أتواصل مع مندوب التوصيل؟',
          'كيف أحدد موقعي بدقة على الخريطة؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'order_delay_question': {
      return {
        reply: `إذا تأخر طلبك عن الموعد المتوقع، اتبع هذه الخطوات السريعة:\n\n1. افتح صفحة «طلباتي» وتحقق من آخر تحديث لحالة الطلب أو إن كان بانتظار موافقتك على رسوم التوصيل المقترحة.\n2. اضغط على «مراسلة المتجر» للاستفسار الفوري عن حالة الشحنة.\n3. إذا لم تستلم رداً خلال ساعات، راسل «إدارة المتجر» وزوّدها برقم الطلب للمتابعة الفورية وضمان حقك.`,
        products: [],
        actions: [
          { label: 'فحص طلباتي', route: '/orders', kind: 'primary' },
          { label: 'مراسلة الإدارة', route: '/contact?to=admin', kind: 'secondary' }
        ],
        suggestedQuestions: [
          'كيف أتواصل مع مندوب التوصيل؟',
          'ما هي سياسة إلغاء الطلب والاسترجاع؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'gps_location_question': {
      return {
        reply: `لتحديد موقعك بدقة عند إتمام الطلب:\n\n1. في صفحة «سلة المشتريات» عند تعبئة بيانات التوصيل، اضغط على زر «تحديد موقعي الحالي بالـ GPS» للسماح للمتصفح بالتقاط إحداثياتك تلقائياً.\n2. أو حرك الدبوس على الخريطة التفاعلية واكتب اسم الحي وأقرب معلم بارز.\n3. يساعد الموقع الدقيق المندوب في الوصول لباب منزلك بأسرع وقت دون تأخير.`,
        products: [],
        actions: [{ label: 'فتح سلة المشتريات', route: '/cart', kind: 'secondary' }],
        suggestedQuestions: [
          'كم المدة المستغرقة لوصول الطلب؟',
          'هل يمكنني استلام الطلب بنفسي من مقر المتجر؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'courier_contact_question': {
      return {
        reply: `للتواصل مع مندوب التوصيل الخاص بطلبك:\n\nبمجرد قبول المندوب لتوصيل طلبك وتغيير حالته إلى «في الطريق مع المندوب»، يظهر اسمه ورقم هاتفه للتواصل المباشر داخل بطاقة الطلب في صفحة «طلباتي».`,
        products: [],
        actions: [{ label: 'فتح صفحة طلباتي', route: '/orders', kind: 'primary' }],
        suggestedQuestions: [
          'ماذا أفعل إذا تأخر طلبي عن الموعد؟',
          'كم المدة المستغرقة لوصول الطلب؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'courier_conditions_question': {
      return {
        reply: `شروط الانضمام والعمل كمندوب توصيل في ${storeName}:\n\n1. امتلاك وسيلة نقل مناسبة (دراجة نارية أو سيارة) وهاتف يدعم الـ GPS وخرائط Google.\n2. الالتزام بمواعيد الاستلام من المتاجر والتسليم للعملاء مع الحفاظ على سلامة الطرود.\n3. تقديم بيانات الهوية ورقم التواصل لإدارة المنصة لتفعيل رتبة «مندوب توصيل» على حسابك.\n\nبعد التفعيل يظهر لك تبويب «التوصيل» تلقائياً في الشريط العلوي للوصول إلى «بوابة التوصيل».`,
        products: [],
        actions: [{ label: 'مراسلة الإدارة لطلب التفعيل', route: '/contact?to=admin', kind: 'primary' }],
        suggestedQuestions: [
          'كيف تعمل بوابة التوصيل للمندوبين؟',
          'مراسلة الإدارة الآن'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'courier_role': {
      return {
        reply: `بوابة مندوب التوصيل في ${storeName}:\n\n• تتيح للمندوبين المعتمدين استعراض الطلبات الجاهزة للشحن، قبول التوصيل، ومشاهدة مسار خرائط Google من المتجر إلى موقع العميل.\n• لطلب الانضمام أو تفعيل رتبة مندوب، تواصل مع الإدارة عبر المحادثات.`,
        products: [],
        actions: [{ label: 'مراسلة الإدارة للانضمام كمندوب', route: '/contact?to=admin', kind: 'primary' }],
        suggestedQuestions: [
          'ما هي شروط العمل كمندوب في المنصة؟',
          'كيف أحدد موقعي بدقة على الخريطة؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'shipping_delivery': {
      const target = analysis.matchedProducts[0];
      if (target) {
        const feeText = target.noDelivery
          ? 'هذا المنتج متاح للاستلام المباشر من مقر المتجر فقط (لا يوجد شحن/توصيل).'
          : Number(target.deliveryFee || 0) === 0
            ? 'يتوفر له توصيل مجاني ضمن العرض أو حسب نطاق المدينة.'
            : `رسوم التوصيل المحددة له: ${Number(target.deliveryFee).toLocaleString()} ر.ي.`;
        return {
          reply: `تفاصيل التوصيل لمنتج "${target.title}":\n\n• ${feeText}\n• التغطية تشمل المدن الرئيسية وكافة المحافظات اليمنية مع تتبع مباشر في صفحة طلباتي.\n• يمكنك تحديد موقعك بالـ GPS عند إتمام الطلب في السلة.`,
          products: analysis.matchedProducts,
          actions: [{ label: 'فتح صفحة المنتج', route: `/product/${target.id}`, kind: 'primary' }],
          suggestedQuestions: [
            `كيف أحجز ${target.title} بالعربون؟`,
            'كم المدة المستغرقة لوصول الطلب؟'
          ],
          provider: 'standalone_store_ai'
        };
      }

      return {
        reply: `خدمات الشحن والتوصيل في ${storeName}:\n\n• نوفر توصيلاً داخل المدن الرئيسية (صنعاء، عدن، تعز، الحديدة، المكلا، إب، ذمار) ولجميع المحافظات.\n• تظهر أجور التوصيل بوضوح في كل منتج وفي فاتورة السلة قبل الدفع، كما توجد منتجات بعرض «توصيل مجاني» وأخرى مخصصة للاستلام من مقر المتجر.\n• يدعم النظام تحديد الموقع بالـ GPS وتتبع حالة الشحنة خطوة بخطوة.`,
        products: catalog.filter((p) => !p.noDelivery && Number(p.deliveryFee || 0) === 0).slice(0, 4),
        suggestedQuestions: [
          'كم المدة المستغرقة لوصول الطلب؟',
          'هل يمكنني استلام الطلب بنفسي من مقر المتجر؟',
          'عرض منتجات التوصيل المجاني'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'store_commission_question': {
      return {
        reply: `نظام الاشتراك والعمولة للمتاجر في ${storeName}:\n\nتعتمد المنصة اتفاقيات ميسرة للتجار وأصحاب المتاجر (باقات شهرية أو نسبة متفق عليها حسب فئة النشاط وحجم المبيعات) مع إتاحة لوحة تحكم متكاملة لإدارة المنتجات، العروض، التفاوض، والمبيعات.\n\nلمعرفة تفاصيل الباقة المناسبة لنشاطك التجاري أو تفعيل متجرك، تواصل مباشرة مع إدارة المنصة.`,
        products: [],
        actions: [{ label: 'التواصل مع الإدارة', route: '/contact?to=admin', kind: 'primary' }],
        suggestedQuestions: [
          'كيف أنشئ حساب متجر جديد؟',
          'كيف أحصل على شارة التوثيق؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'store_create_question': {
      return {
        reply: `خطوات فتح متجر وبدء البيع في ${storeName}:\n\n1. أنشئ حسابك وسجل الدخول إلى المنصة.\n2. تواصل مع إدارة المنصة عبر المحادثات لترقية حسابك إلى «حساب متجر» وتقديم بيانات نشاطك (اسم المتجر، المدينة، العنوان، وأرقام التواصل).\n3. بعد التفعيل تظهر لك «لوحة الإدارة» لإضافة منتجاتك، تفعيل العروض، كوبونات الخصم، واستقبال طلبات المشترين والمزايدة في «اطلب تسعيرة».`,
        products: [],
        actions: [
          { label: 'مراسلة الإدارة لفتح متجر', route: '/contact?to=admin', kind: 'primary' },
          { label: 'تصفح المتاجر الحالية', route: '/search-stores', kind: 'secondary' }
        ],
        suggestedQuestions: [
          'ما هي عمولة المنصة على المبيعات؟',
          'كيف أحصل على شارة التوثيق؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'store_verification': {
      return {
        reply: `المتاجر الموثقة وشارة الاعتماد في ${storeName}:\n\n• شارة التوثيق تعني أن إدارة المنصة تحققت رسمياً من هوية التاجر وموقعه وسجل نشاطه لضمان موثوقية المعاملات.\n• المتاجر الموثقة يمكنها أيضاً تفعيل خدمة الحجز المسبق بالعربون.\n• يمكنك تصفح قائمة المتاجر والفلترة حسب «المتاجر الموثقة فقط» بسهولة.`,
        products: [],
        actions: [
          { label: 'تصفح دليل المتاجر', route: '/search-stores', kind: 'primary' },
          { label: 'دليل التسوق الآمن', route: '/safety-guide', kind: 'secondary' }
        ],
        suggestedQuestions: [
          'كيف أنشئ حساب متجر جديد؟',
          'ما هي عمولة المنصة على المبيعات؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'order_cancel_return': {
      return {
        reply: `سياسة إلغاء الطلبات والاسترجاع في ${storeName}:\n\n• إلغاء الطلب: يمكنك إلغاء الطلب مجاناً ما دام في حالة «قيد الانتظار» وقبل بدء الشحن.\n• الاسترجاع والاستبدال: إذا وصلك منتج مختلف عن الوصف أو به عيب مصنعي، تواصل فوراً مع المتجر أو الإدارة عبر المحادثات مع إرفاق صورة لضمان معالجة الطلب أو استرداد المبلغ.\n• لمزيد من الضوابط التفصيلية راجع دليل التسوق الآمن.`,
        products: [],
        actions: [
          { label: 'مراجعة طلباتي', route: '/orders', kind: 'primary' },
          { label: 'دليل التسوق الآمن', route: '/safety-guide', kind: 'secondary' }
        ],
        suggestedQuestions: [
          'تقديم شكوى أو اقتراح',
          'الذهاب إلى صفحة طلباتي الآن'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'order_tracking': {
      return {
        reply: `متابعة حالة طلباتك وحجوزاتك في ${storeName}:\n\nافتح صفحة «طلباتي» لمشاهدة المسار المباشر لكل طلب:\n• قيد الانتظار: بانتظار تأكيد المتجر أو التحقق من السند.\n• جاري التجهيز: يتم تحضير وتغليف طلبك.\n• في الطريق مع المندوب: الشحنة خرجت للتوصيل ويظهر لك المندوب.\n• تم التسليم: اكتمل الطلب وتتوفر فاتورة رسمية قابلة للطباعة.`,
        products: [],
        actions: [{ label: 'فتح صفحة طلباتي', route: '/orders', kind: 'primary' }],
        suggestedQuestions: [
          'ماذا أفعل إذا تأخر طلبي عن الموعد؟',
          'كيف أتواصل مع مندوب التوصيل؟',
          'ما هي سياسة إلغاء الطلب والاسترجاع؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'complaint_suggestion': {
      return {
        reply: `تقديم شكوى، بلاغ، أو اقتراح لتحسين ${storeName}:\n\nنأخذ كل ملاحظة بجدية تامة لحماية حقوق المشترين والمتاجر:\n• اضغط «مراسلة الإدارة» أدناه واكتب تفاصيل الشكوى أو رقم الطلب مع إرفاق أي صور داعمة.\n• سيتولى فريق الرقابة والدعم مراجعة الموضوع وحلّه معك ومع التاجر بأسرع وقت.`,
        products: [],
        actions: [
          { label: 'مراسلة الإدارة فوراً', route: '/contact?to=admin', kind: 'primary' },
          { label: 'دليل حماية المشتري', route: '/safety-guide', kind: 'secondary' }
        ],
        suggestedQuestions: [
          'ماذا أفعل إذا تأخر طلبي عن الموعد؟',
          'تصفح المتاجر الموثقة'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'contact_support': {
      const adminContacts = settings?.adminContacts || [];
      const primaryPhone = String(adminContacts[0]?.phone || '').trim();
      const phoneLine = primaryPhone ? `\n• رقم الدعم المباشر: ${primaryPhone}` : '';
      return {
        reply: `مركز الدعم وخدمة العملاء في ${storeName}:\n\n• يمكنك التحدث مباشرة مع «إدارة المتجر» من القائمة الجانبية في صفحة المحادثات الحالية أو عبر الزر أدناه.${phoneLine}\n• متاحون يومياً لحل مشاكل الطلبات، توثيق المتاجر، وتفعيل مناديب التوصيل.`,
        products: [],
        actions: [{ label: 'فتح محادثة الإدارة', route: '/contact?to=admin', kind: 'primary' }],
        suggestedQuestions: [
          'تقديم شكوى أو اقتراح',
          'ما هي شروط العمل كمندوب في المنصة؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'categories_list': {
      const catCounts = new Map<string, { count: number; minPrice: number }>();
      for (const p of catalog) {
        const catName = String(p.category || 'أقسام عامة').trim();
        const prev = catCounts.get(catName) || { count: 0, minPrice: Infinity };
        catCounts.set(catName, {
          count: prev.count + 1,
          minPrice: Math.min(prev.minPrice, Number(p.price || 0))
        });
      }
      const sortedCats = Array.from(catCounts.entries()).sort((a, b) => b[1].count - a[1].count);
      const listText = sortedCats.length > 0
        ? sortedCats
            .slice(0, 10)
            .map(([name, info]) => `• ${name}: ${info.count} منتج (تبدأ من ${info.minPrice.toLocaleString()} ر.ي)`)
            .join('\n')
        : '• الإلكترونيات والهواتف\n• المنتجات المحلية والعسل والبن\n• الأزياء والعطور والساعات\n• المنزل والمطبخ';

      const topCat = sortedCats[0]?.[0];
      return {
        reply: `أقسام ${storeName} المتاحة حالياً (${sortedCats.length} أقسام):\n\n${listText}\n\nاكتب لي اسم أي قسم أو اضغط على الاقتراحات لأعرض لك منتجاته بالأسعار فوراً:`,
        products: analysis.matchedProducts,
        suggestedQuestions: [
          ...(topCat ? [`عرض منتجات قسم ${topCat}`] : []),
          'عرض أحدث العروض والخصومات',
          'ما هي المنتجات الأكثر طلباً؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'offers_discounts': {
      const offerProds = analysis.matchedProducts;
      if (offerProds.length > 0) {
        return {
          reply: `إليك ${offerProds.length} منتجات بعروض خاصة أو تخفيضات نشطة حالياً في ${storeName}:\n\nيمكنك المعاينة أو الإضافة المباشرة للسلة من البطاقات أدناه:`,
          products: offerProds,
          suggestedQuestions: [
            'هل يوجد كوبونات خصم نشطة؟',
            'قارن بين هذه المنتجات',
            'عرض جميع المنتجات المتوفرة'
          ],
          provider: 'standalone_store_ai'
        };
      }
      return {
        reply: `لا توجد منتجات بشارة عرض ترويجي خاص في هذه اللحظة، لكن تتوفر لدينا منتجات بأسعار منافسة وخيارات «تفاوض على السعر» داخل صفحة كل منتج. إليك أحدث المختارات:`,
        products: catalog.slice(0, 4),
        suggestedQuestions: [
          'هل يوجد كوبونات خصم نشطة؟',
          'كيف أتفاوض على السعر مع التاجر؟',
          'أرخص المنتجات المتوفرة'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'catalog_popular': {
      const picks = analysis.matchedProducts;
      if (picks.length === 0) {
        return {
          reply: `الكتالوج قيد التحديث حالياً ولا توجد منتجات نشطة في هذه اللحظة. يمكنك نشر طلبك في «اطلب تسعيرة» لتصلك عروض المتاجر مباشرة.`,
          products: [],
          actions: [{ label: 'اطلب تسعيرة الآن', route: '/requests', kind: 'primary' }],
          provider: 'standalone_store_ai'
        };
      }
      const prices = catalog.map((p) => Number(p.price || 0)).filter((n) => n > 0);
      const minAll = prices.length ? Math.min(...prices) : 0;
      const maxAll = prices.length ? Math.max(...prices) : 0;
      return {
        reply: `إليك أبرز المختارات من كتالوج ${storeName} (عرض ${picks.length} من أصل ${catalog.length} منتج متاح):\n\nيمكنك الضغط على أي بطاقة لفتح المنتج أو إضافته للسلة مباشرة:`,
        products: picks,
        statsHighlight: [
          { label: 'إجمالي المتوفر', value: `${catalog.length} منتج` },
          ...(minAll > 0 ? [{ label: 'الأسعار تبدأ من', value: `${minAll.toLocaleString()} ر.ي` }] : []),
          ...(maxAll > minAll ? [{ label: 'أعلى سعر', value: `${maxAll.toLocaleString()} ر.ي` }] : [])
        ],
        suggestedQuestions: [
          'قارن بين هذه المنتجات',
          'ما هي أقسام المتجر الرئيسية؟',
          'أرخص المنتجات المتوفرة'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'product_search':
    default: {
      const prods = analysis.matchedProducts;
      if (prods.length > 0) {
        const prices = prods.map((p) => Number(p.price || 0));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceSummary =
          minPrice === maxPrice
            ? `بسعر ${minPrice.toLocaleString()} ر.ي`
            : `بأسعار من ${minPrice.toLocaleString()} إلى ${maxPrice.toLocaleString()} ر.ي`;

        const budgetNote = analysis.priceConstraint?.max
          ? ` ضمن ميزانية حتى ${analysis.priceConstraint.max.toLocaleString()} ر.ي`
          : '';

        return {
          reply: `وجدت لك ${prods.length} خيارات مناسبة لطلبك${budgetNote} (${priceSummary}):\n\nيمكنك إضافة أي منتج للسلة مباشرة أو فتح صفحته للمعاينة والتفاوض على السعر:`,
          products: prods,
          suggestedQuestions: [
            ...(prods.length >= 2 ? ['قارن بين هذه المنتجات'] : []),
            `هل يتوفر توصيل لـ ${prods[0].title}؟`,
            `كيف أحجز ${prods[0].title} بالعربون؟`
          ],
          provider: 'standalone_store_ai'
        };
      }

      const availableCats = Array.from(
        new Set(catalog.map((p) => String(p.category || '').trim()).filter(Boolean))
      ).slice(0, 6);
      const catsLine = availableCats.length > 0
        ? `\n\nالأقسام المتوفرة حالياً في المتجر: ${availableCats.join(' · ')}`
        : '';

      const constraintNote = analysis.priceConstraint?.max
        ? ` ضمن ميزانية ${analysis.priceConstraint.max.toLocaleString()} ر.ي`
        : '';

      return {
        reply: `لم أجد منتجاً يطابق «${userQuery}»${constraintNote} بالضبط في الكتالوج اللحظي.${catsLine}\n\nنصيحة سريعة: يمكنك نشر طلبك في «اطلب تسعيرة» لتتسابق المتاجر على توفير السلعة لك بالسعر الذي يناسبك، أو تصفح أقرب الخيارات أدناه:`,
        products: catalog.slice(0, 4),
        actions: [
          { label: 'اطلب تسعيرة من المتاجر', route: '/requests', kind: 'primary' },
          { label: 'تصفح المتاجر', route: '/search-stores', kind: 'secondary' }
        ],
        suggestedQuestions: [
          'ما هي أقسام المتجر الرئيسية؟',
          'أرخص المنتجات المتوفرة',
          'عرض أحدث العروض والخصومات'
        ],
        provider: 'standalone_store_ai'
      };
    }
  }
}
