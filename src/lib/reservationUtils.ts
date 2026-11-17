import { collection, addDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { getStockLimit } from './stockUtils';

export function isStorePickupOnlyOrder(order: any): boolean {
  return Boolean(
    order?.noDelivery ||
      order?.fulfillmentType === 'store_pickup' ||
      order?.deliveryStatus === 'store_pickup_only'
  );
}

export function isStorePickupOnlyProduct(product: any): boolean {
  return Boolean(product?.noDelivery);
}

/**
 * Atomically expires an overdue pre-order reservation:
 * - Verifies reservation status is still active (`reserved` or `deposit_paid`) and past `reservationExpiresAt`
 * - Marks status as `reservation_expired`, `depositForfeited: true` (forfeited to store)
 * - Restores reserved product/variant stock inside the same transaction
 * - Notifies both the customer and the store owner
 */
export async function expireReservationTransaction(orderId: string): Promise<{ expired: boolean }> {
  if (!orderId) return { expired: false };

  const orderRef = doc(db, 'orders', orderId);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  try {
    const result = await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) {
        return { expired: false as const };
      }

      const data = orderSnap.data() as Record<string, any>;
      const isPreOrder = Boolean(data.isPreOrder || data.orderType === 'preorder');
      if (!isPreOrder) {
        return { expired: false as const };
      }

      if (data.status !== 'reserved' && data.status !== 'deposit_paid') {
        return { expired: false as const };
      }

      if (!data.reservationExpiresAt) {
        return { expired: false as const };
      }

      const expiresMs = new Date(data.reservationExpiresAt).getTime();
      if (!Number.isFinite(expiresMs) || expiresMs > nowMs) {
        return { expired: false as const };
      }

      const shouldRestoreStock = Boolean(data.stockDeducted && !data.stockRestored);
      const items: any[] = Array.isArray(data.items) ? data.items : [];
      const uniquePids = shouldRestoreStock
        ? Array.from(new Set(items.map((it) => String(it?.productId || it?.id || '')).filter(Boolean)))
        : [];

      // Read all product documents BEFORE performing any transaction writes
      const productReads = await Promise.all(
        uniquePids.map(async (pid) => {
          const ref = doc(db, 'products', pid);
          const snap = await tx.get(ref);
          return { pid, ref, snap };
        })
      );

      for (const { pid, ref, snap } of productReads) {
        if (!snap.exists()) continue;
        const prodData = snap.data() as Record<string, any>;
        const matchingLines = items.filter((it) => String(it?.productId || it?.id || '') === pid);

        let baseAdd = 0;
        const variantAdds = new Map<string, number>();

        for (const line of matchingLines) {
          const qty = Math.max(1, Math.floor(Number(line?.quantity) || 1));
          if (line?.variantId) {
            const vid = String(line.variantId);
            variantAdds.set(vid, (variantAdds.get(vid) || 0) + qty);
          } else {
            baseAdd += qty;
          }
        }

        let baseTouched = false;
        let variantsTouched = false;
        let nextBaseStock: number | null | undefined = prodData.stock;
        const nextVariants = Array.isArray(prodData.variants)
          ? prodData.variants.map((v: any) => ({ ...v }))
          : [];

        if (baseAdd > 0) {
          const currentBaseLimit = getStockLimit({ stock: nextBaseStock });
          if (currentBaseLimit !== null) {
            nextBaseStock = currentBaseLimit + baseAdd;
            baseTouched = true;
          }
        }

        for (const [vid, addQty] of variantAdds.entries()) {
          const vIdx = nextVariants.findIndex((v: any) => String(v?.id) === vid);
          if (vIdx !== -1) {
            const vLimit = getStockLimit(nextVariants[vIdx]);
            if (vLimit !== null) {
              nextVariants[vIdx] = {
                ...nextVariants[vIdx],
                stock: vLimit + addQty,
              };
              variantsTouched = true;
            }
          }
        }

        if (baseTouched || variantsTouched) {
          const productPayload: Record<string, any> = { updatedAt: nowIso };
          if (baseTouched) {
            productPayload.stock = nextBaseStock;
            productPayload.available = true;
          }
          if (variantsTouched) {
            productPayload.variants = nextVariants;
          }
          tx.update(ref, productPayload);
        }
      }

      const orderUpdate: Record<string, any> = {
        status: 'reservation_expired',
        reservationStatus: 'expired_forfeited',
        depositForfeited: true,
        depositForfeitedAt: nowIso,
      };
      if (shouldRestoreStock) {
        orderUpdate.stockRestored = true;
      }

      tx.update(orderRef, orderUpdate);

      const firstItemTitle = items[0]?.title || 'المنتج المحجوز';
      return {
        expired: true as const,
        userId: String(data.userId || ''),
        storeId: String(data.storeId || ''),
        storeName: String(data.storeName || 'المتجر'),
        customerName: String(data.customerName || 'العميل'),
        depositAmount: Number(data.depositAmount || 0),
        durationDays: Number(data.reservationDurationDays || 3),
        productTitle: String(firstItemTitle),
        isPickupOnly: isStorePickupOnlyOrder(data),
      };
    });

    if (!result.expired) {
      return { expired: false };
    }

    const depositTxt = result.depositAmount.toLocaleString('ar-YE');

    if (result.userId) {
      await addDoc(collection(db, 'notifications'), {
        userId: result.userId,
        title: `انتهت مهلة الحجز وذهب العربون (#${orderId.slice(0, 8)})`,
        message: result.isPickupOnly
          ? `انتهت مهلة الحضور للاستلام من متجر «${result.storeName}» (${result.durationDays} أيام) للمنتج «${result.productTitle}». تم إلغاء الحجز واحتساب العربون (${depositTxt} ر.ي) للمتجر.`
          : `انتهت مهلة استكمال حجز «${result.productTitle}» (${result.durationDays} أيام). تم إلغاء الحجز واحتساب العربون (${depositTxt} ر.ي) لمتجر «${result.storeName}».`,
        type: 'order',
        createdAt: nowIso,
        read: false,
        actionUrl: '/orders',
      }).catch(() => {});
    }

    if (result.storeId && result.storeId !== 'global' && result.storeId !== result.userId) {
      await addDoc(collection(db, 'notifications'), {
        userId: result.storeId,
        title: `انتهت مهلة حجز — احتساب العربون للمتجر (#${orderId.slice(0, 8)})`,
        message: `لم يحضر العميل «${result.customerName}» لاستلام/استكمال حجز «${result.productTitle}» خلال ${result.durationDays} أيام. تم إلغاء الحجز وإعادة الكمية للمخزون واحتساب العربون (${depositTxt} ر.ي) للمتجر.`,
        type: 'order',
        createdAt: nowIso,
        read: false,
        actionUrl: '/admin?tab=orders',
      }).catch(() => {});
    }

    return { expired: true };
  } catch (err) {
    console.warn('Reservation expiry transaction notice:', err);
    return { expired: false };
  }
}
