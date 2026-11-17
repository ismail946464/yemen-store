import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

export interface StockLineItem {
  productId: string;
  variantId?: string | null;
  variantName?: string | null;
  title?: string;
  quantity: number;
}

/**
 * Returns the maximum purchasable integer stock limit, or null when stock is unlimited.
 */
export function getStockLimit(item: { stock?: any } | null | undefined): number | null {
  if (!item) return null;
  const raw = item.stock;
  if (raw === undefined || raw === null || raw === '') return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.floor(num));
}

/**
 * True when an item is explicitly disabled or has a finite stock of 0.
 */
export function isItemOutOfStock(item: { stock?: any; available?: any } | null | undefined): boolean {
  if (!item) return true;
  if (item.available === false) return true;
  const limit = getStockLimit(item);
  return limit !== null && limit <= 0;
}

/**
 * Computes a realistic pre-order deposit that never exceeds the item price.
 */
export function calculateSafeDeposit(price: number, customDeposit?: number | null): number {
  const safePrice = Math.max(0, Math.round(Number(price) || 0));
  if (safePrice <= 0) return 0;
  const parsedCustom = customDeposit !== undefined && customDeposit !== null && customDeposit !== ('' as any)
    ? Number(customDeposit)
    : 0;
  if (Number.isFinite(parsedCustom) && parsedCustom > 0) {
    return Math.min(safePrice, Math.round(parsedCustom));
  }
  return Math.min(safePrice, Math.max(1000, Math.round(safePrice * 0.2)));
}

/**
 * Atomically validates and decrements product/variant stock in Firestore inside a transaction.
 * Throws a user-friendly Arabic Error if any requested item lacks sufficient stock.
 */
export async function reserveStockTransaction(items: StockLineItem[]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;

  const groupedByProduct = new Map<string, StockLineItem[]>();
  for (const item of items) {
    const pid = item.productId;
    if (!pid) continue;
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const list = groupedByProduct.get(pid) || [];
    list.push({ ...item, quantity: qty });
    groupedByProduct.set(pid, list);
  }

  const productIds = Array.from(groupedByProduct.keys());
  if (productIds.length === 0) return;

  await runTransaction(db, async (tx) => {
    // 1. Read all unique product documents first
    const snapshots = await Promise.all(
      productIds.map(async (pid) => {
        const ref = doc(db, 'products', pid);
        const snap = await tx.get(ref);
        return { pid, ref, snap };
      })
    );

    const pendingUpdates: Array<{ ref: ReturnType<typeof doc>; payload: Record<string, any> }> = [];

    for (const { pid, ref, snap } of snapshots) {
      if (!snap.exists()) {
        const first = groupedByProduct.get(pid)?.[0];
        throw new Error(`المنتج «${first?.title || pid}» لم يعد متوفراً في المتجر`);
      }

      const prodData = snap.data() as Record<string, any>;
      if (prodData.status === 'draft') {
        throw new Error(`المنتج «${prodData.title || pid}» غير متاح للشراء حالياً`);
      }

      const lines = groupedByProduct.get(pid) || [];
      let nextBaseStock: number | null | undefined = prodData.stock;
      let nextAvailable = prodData.available;
      let baseTouched = false;
      let variantsTouched = false;
      const nextVariants = Array.isArray(prodData.variants)
        ? prodData.variants.map((v: any) => ({ ...v }))
        : [];

      // Aggregate requested quantity per variant vs base product
      const variantReqTotals = new Map<string, { qty: number; name?: string | null }>();
      let baseReqTotal = 0;

      for (const line of lines) {
        if (line.variantId) {
          const prev = variantReqTotals.get(line.variantId) || { qty: 0, name: line.variantName };
          variantReqTotals.set(line.variantId, {
            qty: prev.qty + line.quantity,
            name: line.variantName || prev.name,
          });
        } else {
          baseReqTotal += line.quantity;
        }
      }

      if (baseReqTotal > 0) {
        const currentBaseLimit = getStockLimit({ stock: nextBaseStock });
        if (prodData.available === false) {
          throw new Error(`نفدت الكمية المتوفرة من «${prodData.title || 'المنتج'}»`);
        }
        if (currentBaseLimit !== null) {
          if (currentBaseLimit < baseReqTotal) {
            throw new Error(
              currentBaseLimit <= 0
                ? `نفدت الكمية المتوفرة من «${prodData.title || 'المنتج'}»`
                : `الكمية المطلوبة من «${prodData.title || 'المنتج'}» (${baseReqTotal}) تتجاوز المتاح بالمخزون (${currentBaseLimit})`
            );
          }
          nextBaseStock = Math.max(0, currentBaseLimit - baseReqTotal);
          nextAvailable = nextBaseStock > 0;
          baseTouched = true;
        }
      }

      for (const [variantId, req] of variantReqTotals.entries()) {
        const vIdx = nextVariants.findIndex((v: any) => String(v?.id) === String(variantId));
        if (vIdx === -1) {
          throw new Error(`الصنف «${req.name || variantId}» لم يعد متاحاً`);
        }
        const variant = nextVariants[vIdx];
        if (variant.available === false) {
          throw new Error(`الصنف «${variant.name || req.name || ''}» غير متوفر حالياً`);
        }
        const vLimit = getStockLimit(variant);
        if (vLimit !== null) {
          if (vLimit < req.qty) {
            throw new Error(
              vLimit <= 0
                ? `نفدت الكمية المتوفرة من صنف «${variant.name}»`
                : `الكمية المطلوبة من صنف «${variant.name}» (${req.qty}) تتجاوز المتاح (${vLimit})`
            );
          }
          nextVariants[vIdx] = {
            ...variant,
            stock: Math.max(0, vLimit - req.qty),
          };
          variantsTouched = true;
        }
      }

      if (baseTouched || variantsTouched) {
        const updatePayload: Record<string, any> = {
          updatedAt: new Date().toISOString(),
        };
        if (baseTouched) {
          updatePayload.stock = nextBaseStock;
          updatePayload.available = nextAvailable;
        }
        if (variantsTouched) {
          updatePayload.variants = nextVariants;
        }
        pendingUpdates.push({ ref, payload: updatePayload });
      }
    }

    // 2. Apply all writes after all reads succeeded
    for (const { ref, payload } of pendingUpdates) {
      tx.update(ref, payload);
    }
  });
}

/**
 * Restores previously deducted stock when an order fails after reservation or is cancelled.
 */
export async function restoreStockTransaction(items: StockLineItem[]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;

  const groupedByProduct = new Map<string, StockLineItem[]>();
  for (const item of items) {
    const pid = item.productId;
    if (!pid) continue;
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const list = groupedByProduct.get(pid) || [];
    list.push({ ...item, quantity: qty });
    groupedByProduct.set(pid, list);
  }

  const productIds = Array.from(groupedByProduct.keys());
  if (productIds.length === 0) return;

  await runTransaction(db, async (tx) => {
    const snapshots = await Promise.all(
      productIds.map(async (pid) => {
        const ref = doc(db, 'products', pid);
        const snap = await tx.get(ref);
        return { pid, ref, snap };
      })
    );

    const pendingUpdates: Array<{ ref: ReturnType<typeof doc>; payload: Record<string, any> }> = [];

    for (const { pid, ref, snap } of snapshots) {
      if (!snap.exists()) continue;
      const prodData = snap.data() as Record<string, any>;
      const lines = groupedByProduct.get(pid) || [];

      let nextBaseStock: number | null | undefined = prodData.stock;
      let baseTouched = false;
      let variantsTouched = false;
      const nextVariants = Array.isArray(prodData.variants)
        ? prodData.variants.map((v: any) => ({ ...v }))
        : [];

      let baseAdd = 0;
      const variantAdds = new Map<string, number>();

      for (const line of lines) {
        if (line.variantId) {
          variantAdds.set(line.variantId, (variantAdds.get(line.variantId) || 0) + line.quantity);
        } else {
          baseAdd += line.quantity;
        }
      }

      if (baseAdd > 0) {
        const currentBaseLimit = getStockLimit({ stock: nextBaseStock });
        if (currentBaseLimit !== null) {
          nextBaseStock = currentBaseLimit + baseAdd;
          baseTouched = true;
        }
      }

      for (const [variantId, addQty] of variantAdds.entries()) {
        const vIdx = nextVariants.findIndex((v: any) => String(v?.id) === String(variantId));
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
        const updatePayload: Record<string, any> = {
          updatedAt: new Date().toISOString(),
        };
        if (baseTouched) {
          updatePayload.stock = nextBaseStock;
          updatePayload.available = true;
        }
        if (variantsTouched) {
          updatePayload.variants = nextVariants;
        }
        pendingUpdates.push({ ref, payload: updatePayload });
      }
    }

    for (const { ref, payload } of pendingUpdates) {
      tx.update(ref, payload);
    }
  });
}
