import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export type CouponDiscountType = 'percent' | 'fixed';

export interface PromoCodeItem {
  id: string;
  code: string;
  title: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  storeId: string;
  storeName: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function normalizeCouponCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 40);
}

export function generateRandomCouponCode(prefix = 'YEMEN'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return normalizeCouponCode(`${prefix}${suffix}`);
}

export function computeCouponDiscount(coupon: PromoCodeItem, subtotal: number): number {
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  if (safeSubtotal <= 0) return 0;

  let discount = 0;
  if (coupon.discountType === 'percent') {
    const pct = Math.max(0, Math.min(100, Number(coupon.discountValue || 0)));
    discount = Math.round((safeSubtotal * pct) / 100);
    if (coupon.maxDiscountAmount && Number(coupon.maxDiscountAmount) > 0) {
      discount = Math.min(discount, Math.round(Number(coupon.maxDiscountAmount)));
    }
  } else {
    discount = Math.round(Math.max(0, Number(coupon.discountValue || 0)));
  }

  return Math.min(safeSubtotal, Math.max(0, discount));
}

export function validateCouponForCart(params: {
  coupon: PromoCodeItem;
  subtotal: number;
  cartStoreId: string;
  hasMultipleStores?: boolean;
}): { valid: boolean; reason?: string; discountAmount: number } {
  const { coupon, subtotal, cartStoreId, hasMultipleStores } = params;

  if (!coupon.active) {
    return { valid: false, reason: 'هذا الكوبون متوقف حالياً', discountAmount: 0 };
  }

  if (coupon.expiresAt) {
    const expMs = new Date(coupon.expiresAt).getTime();
    if (!Number.isNaN(expMs) && expMs < Date.now()) {
      return { valid: false, reason: 'انتهت صلاحية هذا الكوبون', discountAmount: 0 };
    }
  }

  if (coupon.maxUses !== null && coupon.maxUses !== undefined && Number(coupon.usedCount || 0) >= Number(coupon.maxUses)) {
    return { valid: false, reason: 'تم استنفاد الحد الأقصى لاستخدام هذا الكوبون', discountAmount: 0 };
  }

  if (coupon.storeId !== 'global') {
    if (hasMultipleStores) {
      return {
        valid: false,
        reason: `هذا الكوبون مخصص لمتجر «${coupon.storeName || 'محدد'}» فقط — يرجى الشراء من نفس المتجر لاستخدامه`,
        discountAmount: 0,
      };
    }
    if (coupon.storeId !== cartStoreId) {
      return {
        valid: false,
        reason: `هذا الكوبون ساري فقط لدى متجر «${coupon.storeName || 'المتجر المصدر'}»`,
        discountAmount: 0,
      };
    }
  }

  const minSpend = Math.max(0, Number(coupon.minOrderAmount || 0));
  if (subtotal < minSpend) {
    return {
      valid: false,
      reason: `الحد الأدنى لاستخدام هذا الكوبون هو ${minSpend.toLocaleString()} ر.ي`,
      discountAmount: 0,
    };
  }

  const discountAmount = computeCouponDiscount(coupon, subtotal);
  if (discountAmount <= 0) {
    return { valid: false, reason: 'قيمة الخصم لهذا الكوبون غير صالحة على إجمالي السلة', discountAmount: 0 };
  }

  return { valid: true, discountAmount };
}

export async function findPromoCodeByCode(rawCode: string): Promise<PromoCodeItem | null> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;
  try {
    const snap = await getDocs(query(collection(db, 'promoCodes'), where('code', '==', code)));
    if (snap.empty) return null;
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PromoCodeItem));
    const activeMatch = docs.find((c) => c.active);
    return activeMatch || docs[0];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'promoCodes', auth);
    return null;
  }
}

export async function createPromoCode(input: {
  code: string;
  title?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  maxUses?: number | null;
  storeId: string;
  storeName: string;
  expiresAt?: string | null;
}): Promise<string> {
  const code = normalizeCouponCode(input.code);
  if (!code || code.length < 3) {
    throw new Error('يرجى كتابة كود كوبون لا يقل عن 3 أحرف إنجليزية أو أرقام');
  }

  const discountValue = Math.round(Number(input.discountValue || 0));
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new Error('يرجى إدخال قيمة خصم صحيحة أكبر من صفر');
  }
  if (input.discountType === 'percent' && discountValue > 100) {
    throw new Error('نسبة الخصم لا يمكن أن تتجاوز 100%');
  }

  // Ensure code is not duplicated in same store/global
  const existing = await getDocs(
    query(collection(db, 'promoCodes'), where('code', '==', code))
  );
  const conflict = existing.docs.find((d) => {
    const sId = d.data()?.storeId;
    return sId === input.storeId || sId === 'global' || input.storeId === 'global';
  });
  if (conflict) {
    throw new Error(`الكود «${code}» مستخدم مسبقاً، يرجى اختيار كود مختلف`);
  }

  const nowIso = new Date().toISOString();
  const payload = {
    code,
    title: String(input.title || '').trim().slice(0, 150) || `خصم ${discountValue}${input.discountType === 'percent' ? '%' : ' ر.ي'}`,
    discountType: input.discountType,
    discountValue,
    minOrderAmount: Math.max(0, Math.round(Number(input.minOrderAmount || 0))),
    maxDiscountAmount:
      input.discountType === 'percent' && input.maxDiscountAmount && Number(input.maxDiscountAmount) > 0
        ? Math.round(Number(input.maxDiscountAmount))
        : null,
    maxUses:
      input.maxUses && Number(input.maxUses) >= 1
        ? Math.round(Number(input.maxUses))
        : null,
    usedCount: 0,
    storeId: String(input.storeId || 'global').slice(0, 128),
    storeName: String(input.storeName || 'المنصة').trim().slice(0, 200),
    active: true,
    expiresAt: input.expiresAt ? String(input.expiresAt).slice(0, 100) : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const ref = await addDoc(collection(db, 'promoCodes'), payload);
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'promoCodes', auth);
    throw err;
  }
}

export async function togglePromoCodeActive(couponId: string, nextActive: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'promoCodes', couponId), {
      active: nextActive,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `promoCodes/${couponId}`, auth);
  }
}

export async function deletePromoCode(couponId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'promoCodes', couponId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `promoCodes/${couponId}`, auth);
  }
}

export async function redeemCouponTransaction(couponId: string): Promise<void> {
  const couponRef = doc(db, 'promoCodes', couponId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(couponRef);
    if (!snap.exists()) {
      throw new Error('كود الخصم لم يعد متاحاً');
    }
    const data = snap.data() as PromoCodeItem;
    if (!data.active) {
      throw new Error('تم إيقاف كود الخصم قبل إتمام الطلب');
    }
    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      throw new Error('انتهت صلاحية كود الخصم');
    }
    const used = Number(data.usedCount || 0);
    if (data.maxUses !== null && data.maxUses !== undefined && used >= Number(data.maxUses)) {
      throw new Error('نفدت مرات استخدام هذا الكوبون');
    }
    tx.update(couponRef, {
      usedCount: used + 1,
      updatedAt: new Date().toISOString(),
    });
  });
}
