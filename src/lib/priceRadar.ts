import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ProductWatcherItem {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  productTitle: string;
  productImage: string | null;
  storeId: string;
  storeName: string;
  targetPrice: number | null;
  watchPriceDrop: boolean;
  watchRestock: boolean;
  lastKnownPrice: number;
  wasOutOfStock: boolean;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function sanitizeDocPart(raw: string): string {
  const cleaned = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.slice(0, 60) || 'id';
}

export function buildWatcherDocId(userId: string, productId: string): string {
  return `${sanitizeDocPart(userId)}__${sanitizeDocPart(productId)}`;
}

export async function upsertProductWatch(input: {
  userId: string;
  userName: string;
  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeId?: string;
  storeName?: string;
  targetPrice?: number | null;
  watchPriceDrop: boolean;
  watchRestock: boolean;
  currentPrice: number;
  isOutOfStock: boolean;
  existingCreatedAt?: string;
}): Promise<string> {
  if (!input.userId || !input.productId) {
    throw new Error('بيانات المستخدم أو المنتج غير مكتملة');
  }
  if (!input.watchPriceDrop && !input.watchRestock) {
    throw new Error('يرجى اختيار نوع تنبيه واحد على الأقل');
  }

  const watchId = buildWatcherDocId(input.userId, input.productId);
  const nowIso = new Date().toISOString();

  const cleanTarget =
    input.targetPrice !== null &&
    input.targetPrice !== undefined &&
    Number.isFinite(Number(input.targetPrice)) &&
    Number(input.targetPrice) > 0
      ? Math.round(Number(input.targetPrice))
      : null;

  const cleanImage =
    typeof input.productImage === 'string' &&
    input.productImage.trim().length > 0 &&
    input.productImage.length <= 850000
      ? input.productImage
      : null;

  const payload = {
    userId: String(input.userId).slice(0, 128),
    userName: String(input.userName || 'عميل').trim().slice(0, 150) || 'عميل',
    productId: String(input.productId).slice(0, 128),
    productTitle: String(input.productTitle || 'منتج').trim().slice(0, 200) || 'منتج',
    productImage: cleanImage,
    storeId: String(input.storeId || '').slice(0, 128),
    storeName: String(input.storeName || 'متجر').trim().slice(0, 200),
    targetPrice: cleanTarget,
    watchPriceDrop: Boolean(input.watchPriceDrop),
    watchRestock: Boolean(input.watchRestock),
    lastKnownPrice: Math.max(0, Math.round(Number(input.currentPrice || 0))),
    wasOutOfStock: Boolean(input.isOutOfStock),
    triggeredAt: null,
    createdAt: input.existingCreatedAt || nowIso,
    updatedAt: nowIso,
  };

  await setDoc(doc(db, 'productWatchers', watchId), payload);
  return watchId;
}

export async function removeProductWatch(userId: string, productId: string): Promise<void> {
  if (!userId || !productId) return;
  const watchId = buildWatcherDocId(userId, productId);
  await deleteDoc(doc(db, 'productWatchers', watchId));
}

export async function notifyWatchersOnProductUpdate(params: {
  productId: string;
  productTitle: string;
  storeName: string;
  prevPrice: number;
  nextPrice: number;
  prevOutOfStock: boolean;
  nextOutOfStock: boolean;
}): Promise<number> {
  const { productId, productTitle, storeName, prevPrice, nextPrice, prevOutOfStock, nextOutOfStock } = params;
  if (!productId) return 0;

  try {
    const snap = await getDocs(
      query(collection(db, 'productWatchers'), where('productId', '==', productId))
    );
    if (snap.empty) return 0;

    const nowIso = new Date().toISOString();
    let notified = 0;

    await Promise.all(
      snap.docs.map(async (wDoc) => {
        const w = wDoc.data() as ProductWatcherItem;
        if (!w.userId) return;

        const baselinePrice =
          prevPrice > 0 && prevPrice !== nextPrice
            ? prevPrice
            : Number(w.lastKnownPrice || 0);
        const baselineOos =
          prevOutOfStock !== nextOutOfStock
            ? prevOutOfStock
            : Boolean(w.wasOutOfStock);

        const priceDropped = nextPrice > 0 && baselinePrice > 0 && nextPrice < baselinePrice;
        const restocked = baselineOos && !nextOutOfStock;

        const targetMatched =
          w.watchPriceDrop &&
          priceDropped &&
          (w.targetPrice === null || w.targetPrice === undefined || nextPrice <= Number(w.targetPrice));

        const restockMatched = w.watchRestock && restocked;

        if (!targetMatched && !restockMatched) {
          if (Math.round(nextPrice) !== Number(w.lastKnownPrice || 0) || Boolean(nextOutOfStock) !== Boolean(w.wasOutOfStock)) {
            await updateDoc(wDoc.ref, {
              lastKnownPrice: Math.max(0, Math.round(nextPrice)),
              wasOutOfStock: Boolean(nextOutOfStock),
              updatedAt: nowIso,
            }).catch(() => {});
          }
          return;
        }

        const reasons: string[] = [];
        if (targetMatched) {
          reasons.push(
            `انخفض السعر من ${Math.round(baselinePrice).toLocaleString()} إلى ${Math.round(nextPrice).toLocaleString()} ر.ي`
          );
        }
        if (restockMatched) {
          reasons.push('توفر المنتج الآن في المخزون');
        }

        await addDoc(collection(db, 'notifications'), {
          userId: w.userId,
          title: `تنبيه رادار الأسعار: ${String(productTitle || '').slice(0, 80)}`,
          message: `${reasons.join(' و')} لدى «${storeName || 'المتجر'}». اطلبه الآن قبل نفاد الكمية.`,
          type: 'order',
          read: false,
          actionUrl: `/product/${productId}`,
          createdAt: nowIso,
        }).catch(() => {});

        await updateDoc(wDoc.ref, {
          lastKnownPrice: Math.max(0, Math.round(nextPrice)),
          wasOutOfStock: Boolean(nextOutOfStock),
          triggeredAt: nowIso,
          updatedAt: nowIso,
        }).catch(() => {});

        notified += 1;
      })
    );

    return notified;
  } catch (err) {
    console.warn('Watcher notification notice:', err);
    return 0;
  }
}
