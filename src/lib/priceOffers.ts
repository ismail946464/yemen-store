import {
  addDoc,
  collection,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export type PriceOfferStatus = 'pending' | 'accepted' | 'rejected' | 'used';

export interface PriceOfferItem {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string | null;
  storeId: string;
  storeName: string;
  buyerId: string;
  buyerName: string;
  originalPrice: number;
  offeredPrice: number;
  quantity: number;
  note: string;
  storeReply: string | null;
  status: PriceOfferStatus;
  createdAt: string;
  updatedAt: string;
}

export function getPriceOfferStatusLabel(status: PriceOfferStatus | string): string {
  switch (status) {
    case 'accepted':
      return 'تمت الموافقة على العرض';
    case 'rejected':
      return 'مرفوض من المتجر';
    case 'used':
      return 'تم إتمام الشراء به';
    default:
      return 'بانتظار رد المتجر';
  }
}

export async function submitPriceOffer(input: {
  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeId: string;
  storeName: string;
  buyerId: string;
  buyerName: string;
  originalPrice: number;
  offeredPrice: number;
  quantity: number;
  note?: string;
}): Promise<string> {
  const cleanOffered = Math.round(Number(input.offeredPrice || 0));
  const cleanOriginal = Math.round(Number(input.originalPrice || 0));
  const cleanQty = Math.max(1, Math.min(500, Math.round(Number(input.quantity || 1))));

  if (!input.productId || !input.storeId || !input.buyerId) {
    throw new Error('بيانات المنتج أو المستخدم غير مكتملة');
  }
  if (!Number.isFinite(cleanOffered) || cleanOffered <= 0) {
    throw new Error('يرجى إدخال سعر مقترح صحيح أكبر من صفر');
  }
  if (cleanOriginal > 0 && cleanOffered >= cleanOriginal) {
    throw new Error('السعر المقترح للتفاوض يجب أن يكون أقل من السعر الأصلي');
  }

  const nowIso = new Date().toISOString();
  const cleanImg =
    typeof input.productImage === 'string' &&
    input.productImage.trim().length > 0 &&
    input.productImage.length <= 850000
      ? input.productImage
      : null;

  const payload = {
    productId: String(input.productId).slice(0, 128),
    productTitle: String(input.productTitle || 'منتج').trim().slice(0, 200),
    productImage: cleanImg,
    storeId: String(input.storeId).slice(0, 128),
    storeName: String(input.storeName || 'المتجر').trim().slice(0, 200),
    buyerId: String(input.buyerId).slice(0, 128),
    buyerName: String(input.buyerName || 'عميل').trim().slice(0, 150),
    originalPrice: Math.max(0, cleanOriginal),
    offeredPrice: cleanOffered,
    quantity: cleanQty,
    note: String(input.note || '').trim().slice(0, 1000),
    storeReply: null,
    status: 'pending' as PriceOfferStatus,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const docRef = await addDoc(collection(db, 'priceOffers'), payload);

    await addDoc(collection(db, 'notifications'), {
      userId: payload.storeId,
      title: `عرض تفاوض جديد: ${payload.productTitle.slice(0, 60)}`,
      message: `اقترح ${payload.buyerName} سعر ${cleanOffered.toLocaleString()} ر.ي للقطعة (${cleanQty} قطعة) بدلاً من ${cleanOriginal.toLocaleString()} ر.ي.`,
      type: 'order',
      read: false,
      actionUrl: '/admin?tab=orders',
      createdAt: nowIso,
    }).catch(() => {});

    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'priceOffers', auth);
    throw err;
  }
}

export async function respondToPriceOffer(params: {
  offer: PriceOfferItem;
  decision: 'accepted' | 'rejected';
  storeReply?: string;
}): Promise<void> {
  const { offer, decision, storeReply } = params;
  const nowIso = new Date().toISOString();
  const cleanReply = String(storeReply || '').trim().slice(0, 1000) || null;

  try {
    await updateDoc(doc(db, 'priceOffers', offer.id), {
      status: decision,
      storeReply: cleanReply,
      updatedAt: nowIso,
    });

    await addDoc(collection(db, 'notifications'), {
      userId: offer.buyerId,
      title:
        decision === 'accepted'
          ? `تمت الموافقة على عرض سعرك: ${offer.productTitle.slice(0, 50)}`
          : `رد المتجر على عرض السعر: ${offer.productTitle.slice(0, 50)}`,
      message:
        decision === 'accepted'
          ? `وافق متجر «${offer.storeName}» على سعرك المقترح (${Number(offer.offeredPrice).toLocaleString()} ر.ي × ${offer.quantity}). افتح صفحة طلباتي لإضافته للسلة بالسعر الجديد!`
          : `اعتذر متجر «${offer.storeName}» عن السعر المقترح${cleanReply ? `: ${cleanReply}` : '.'}`,
      type: 'order',
      read: false,
      actionUrl: '/orders',
      createdAt: nowIso,
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `priceOffers/${offer.id}`, auth);
    throw err;
  }
}

export async function markPriceOfferUsed(offerId: string): Promise<void> {
  if (!offerId) return;
  try {
    await updateDoc(doc(db, 'priceOffers', offerId), {
      status: 'used',
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Non-blocking status sync
  }
}
