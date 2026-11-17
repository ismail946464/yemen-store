import { collection, addDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export type ProductPublishStatus =
  | 'queued'
  | 'pending_review'
  | 'active'
  | 'rejected'
  | 'draft';

export const MASTER_ADMIN_UID = 'MQAwCYqFztd2PZbV1fRMxKRqoYX2';

export function isProductPubliclyActive(product: any): boolean {
  return Boolean(product) && product.status === 'active';
}

export function getProductStatusMeta(status?: string): {
  label: string;
  shortLabel: string;
  badgeClass: string;
} {
  switch (status) {
    case 'active':
      return {
        label: 'منشور للعامة (معتمد)',
        shortLabel: 'منشور للعامة',
        badgeClass:
          'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'pending_review':
      return {
        label: 'قيد مراجعة الإدارة',
        shortLabel: 'بانتظار المراجعة',
        badgeClass:
          'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
      };
    case 'queued':
      return {
        label: 'في قائمة انتظار المتجر',
        shortLabel: 'قائمة الانتظار',
        badgeClass:
          'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      };
    case 'rejected':
      return {
        label: 'مرفوض من الإدارة',
        shortLabel: 'مرفوض',
        badgeClass:
          'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
      };
    case 'draft':
    default:
      return {
        label: 'مسودة مخفية',
        shortLabel: 'مسودة',
        badgeClass:
          'bg-[#FAF9F6] text-[#5C5B57] border-[#E5E2DA] dark:bg-[#101216] dark:text-zinc-400 dark:border-[#232730]',
      };
  }
}

async function notifyAdminsForProductReview(product: any, storeName: string) {
  const adminIds = new Set<string>([MASTER_ADMIN_UID]);
  try {
    const adminsSnap = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'admin'))
    );
    adminsSnap.docs.forEach((d) => {
      if (d.id) adminIds.add(d.id);
    });
  } catch {
    // Fallback to master admin UID
  }

  const nowIso = new Date().toISOString();
  const title = `طلب مراجعة منتج جديد: ${(product.title || '').slice(0, 60)}`;
  const message = `أرسل متجر «${storeName || 'متجر مسجل'}» منتجاً (${product.title || 'منتج'}) بسعر ${Number(product.price || 0).toLocaleString('ar-YE')} ر.ي للمراجعة قبل النشر للعامة.`;

  await Promise.all(
    Array.from(adminIds).map((adminUid) =>
      addDoc(collection(db, 'notifications'), {
        userId: adminUid,
        title,
        message,
        type: 'system',
        read: false,
        actionUrl: '/admin?tab=product-review',
        createdAt: nowIso,
      }).catch(() => {})
    )
  );
}

async function notifyStoreModerationDecision(params: {
  ownerId: string;
  productTitle: string;
  approved: boolean;
  rejectionReason?: string;
}) {
  const { ownerId, productTitle, approved, rejectionReason } = params;
  if (!ownerId) return;

  const nowIso = new Date().toISOString();
  const title = approved
    ? `تم اعتماد ونشر منتجك: ${productTitle.slice(0, 60)}`
    : `تم رفض نشر المنتج: ${productTitle.slice(0, 60)}`;

  const message = approved
    ? `وافقت الإدارة على منتجك «${productTitle}» وتم نشره الآن للعامة في المتجر.`
    : `رفضت الإدارة نشر منتجك «${productTitle}». السبب: ${rejectionReason || 'يرجى مراجعة التفاصيل وإعادة الإرسال.'}`;

  await addDoc(collection(db, 'notifications'), {
    userId: ownerId,
    title,
    message,
    type: 'system',
    read: false,
    actionUrl: '/admin?tab=products',
    createdAt: nowIso,
  }).catch(() => {});
}

export async function submitProductForReviewAction(product: any, storeName: string) {
  if (!product?.id) throw new Error('معرف المنتج غير صالح');
  const nowIso = new Date().toISOString();

  await updateDoc(doc(db, 'products', product.id), {
    status: 'pending_review',
    moderationStatus: 'pending_review',
    rejectionReason: null,
    submittedForReviewAt: nowIso,
    updatedAt: nowIso,
  });

  await notifyAdminsForProductReview(product, storeName);
}

export async function moveProductToStoreQueueAction(productId: string) {
  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'products', productId), {
    status: 'queued',
    moderationStatus: 'queued',
    queuedAt: nowIso,
    updatedAt: nowIso,
  });
}

export async function approveAndPublishProductAction(product: any, adminUid: string) {
  if (!product?.id) throw new Error('معرف المنتج غير صالح');
  const nowIso = new Date().toISOString();

  await updateDoc(doc(db, 'products', product.id), {
    status: 'active',
    moderationStatus: 'approved',
    rejectionReason: null,
    reviewedAt: nowIso,
    reviewedBy: adminUid,
    updatedAt: nowIso,
  });

  if (product.ownerId && product.ownerId !== adminUid) {
    await notifyStoreModerationDecision({
      ownerId: product.ownerId,
      productTitle: product.title || 'منتج',
      approved: true,
    });
  }
}

export async function rejectProductAction(product: any, adminUid: string, reason: string) {
  if (!product?.id) throw new Error('معرف المنتج غير صالح');
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new Error('يرجى كتابة سبب الرفض ليتمكن المتجر من تعديل المنتج');
  }

  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'products', product.id), {
    status: 'rejected',
    moderationStatus: 'rejected',
    rejectionReason: cleanReason,
    reviewedAt: nowIso,
    reviewedBy: adminUid,
    updatedAt: nowIso,
  });

  if (product.ownerId && product.ownerId !== adminUid) {
    await notifyStoreModerationDecision({
      ownerId: product.ownerId,
      productTitle: product.title || 'منتج',
      approved: false,
      rejectionReason: cleanReason,
    });
  }
}
