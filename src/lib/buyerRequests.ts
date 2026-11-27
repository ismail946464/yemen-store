import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

export type FulfillmentPreference = 'any' | 'delivery' | 'store_pickup';
export type BuyerRequestStatus = 'open' | 'accepted' | 'closed';
export type RequestBidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface BuyerRequestItem {
  id: string;
  userId: string;
  userName: string;
  city: string;
  category: string;
  title: string;
  details: string;
  targetBudget: number | null;
  fulfillmentPreference: FulfillmentPreference;
  referenceImage: string | null;
  status: BuyerRequestStatus;
  acceptedBidId: string | null;
  acceptedStoreId: string | null;
  acceptedStoreName: string | null;
  acceptedPrice: number | null;
  bidsCount: number;
  lowestBidPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestBidItem {
  id: string;
  requestId: string;
  storeId: string;
  storeName: string;
  storeLogo: string;
  storeCity: string;
  storeVerified: boolean;
  price: number;
  deliveryIncluded: boolean;
  deliveryFee: number;
  deliveryEstimate: string;
  warrantyNote: string;
  productId: string | null;
  productTitle: string | null;
  status: RequestBidStatus;
  createdAt: string;
  updatedAt: string;
}

export const YEMEN_REQUEST_CITIES = [
  'صنعاء',
  'عدن',
  'تعز',
  'حضرموت',
  'إب',
  'الحديدة',
  'ذمار',
  'مأرب',
  'عمران',
  'صعدة',
  'لحج',
  'أبين',
  'شبوة',
  'المهرة',
  'حجة',
  'البيضاء',
  'الجوف',
  'سقطرى',
  'كل المحافظات',
];

export const REQUEST_CATEGORIES = [
  'الهواتف والملحقات',
  'الإلكترونيات والأجهزة',
  'الأزياء والملابس',
  'العطور والبخور',
  'منتجات محلية يمنية',
  'الساعات والإكسسوارات',
  'الأحذية والحقائب',
  'العناية والجمال',
  'المنزل والمطبخ',
  'سيارات وقطع غيار',
  'أدوية ومستلزمات طبية',
  'ألعاب وترفيه',
  'أخرى',
];

export function getFulfillmentLabel(pref?: FulfillmentPreference | string): string {
  if (pref === 'delivery') return 'توصيل للعنوان';
  if (pref === 'store_pickup') return 'استلام من المتجر';
  return 'توصيل أو استلام من المتجر';
}

export function getRequestStatusLabel(status: BuyerRequestStatus | string): string {
  if (status === 'accepted') return 'تم الاتفاق مع متجر';
  if (status === 'closed') return 'مغلق';
  return 'مفتوح لعروض المتاجر';
}

function sanitizeSafeDocPart(raw: string): string {
  const cleaned = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.slice(0, 60) || 'id';
}

export async function createBuyerRequest(input: {
  userId: string;
  userName: string;
  city: string;
  category: string;
  title: string;
  details?: string;
  targetBudget?: number | null;
  fulfillmentPreference?: FulfillmentPreference;
  referenceImage?: string | null;
}): Promise<string> {
  const nowIso = new Date().toISOString();
  const cleanTitle = String(input.title || '').trim().slice(0, 200);
  if (!cleanTitle) {
    throw new Error('يرجى كتابة اسم المنتج أو الطلب المطلوب');
  }

  const cleanBudget =
    input.targetBudget !== null &&
    input.targetBudget !== undefined &&
    Number.isFinite(Number(input.targetBudget)) &&
    Number(input.targetBudget) >= 0
      ? Math.round(Number(input.targetBudget))
      : null;

  const refImg =
    typeof input.referenceImage === 'string' &&
    input.referenceImage.trim().length > 0 &&
    input.referenceImage.length <= 850000
      ? input.referenceImage
      : null;

  const payload = {
    userId: String(input.userId || '').slice(0, 128),
    userName: String(input.userName || 'مشتري').trim().slice(0, 150) || 'مشتري',
    city: String(input.city || 'صنعاء').trim().slice(0, 80) || 'صنعاء',
    category: String(input.category || 'أخرى').trim().slice(0, 100) || 'أخرى',
    title: cleanTitle,
    details: String(input.details || '').trim().slice(0, 2000),
    targetBudget: cleanBudget,
    fulfillmentPreference: input.fulfillmentPreference || 'any',
    referenceImage: refImg,
    status: 'open' as BuyerRequestStatus,
    acceptedBidId: null,
    acceptedStoreId: null,
    acceptedStoreName: null,
    acceptedPrice: null,
    bidsCount: 0,
    lowestBidPrice: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const docRef = await addDoc(collection(db, 'buyerRequests'), payload);
  return docRef.id;
}

export async function submitStoreBidTransaction(input: {
  request: BuyerRequestItem;
  storeId: string;
  storeName: string;
  storeLogo?: string;
  storeCity?: string;
  storeVerified?: boolean;
  price: number;
  deliveryIncluded: boolean;
  deliveryFee?: number;
  deliveryEstimate?: string;
  warrantyNote?: string;
  productId?: string | null;
  productTitle?: string | null;
}): Promise<{ bidId: string; isUpdate: boolean }> {
  const { request, storeId } = input;
  if (!request?.id || !storeId) {
    throw new Error('بيانات الطلب أو المتجر غير مكتملة');
  }
  if (request.userId === storeId) {
    throw new Error('لا يمكنك تقديم عرض سعر على طلبك الشخصي');
  }
  const cleanPrice = Math.round(Number(input.price));
  if (!Number.isFinite(cleanPrice) || cleanPrice < 0) {
    throw new Error('يرجى إدخال سعر صحيح');
  }
  const cleanDeliveryFee = input.deliveryIncluded
    ? 0
    : Math.max(0, Math.round(Number(input.deliveryFee || 0)));

  const bidId = `${sanitizeSafeDocPart(request.id)}__${sanitizeSafeDocPart(storeId)}`;
  const reqRef = doc(db, 'buyerRequests', request.id);
  const bidRef = doc(db, 'requestBids', bidId);
  const nowIso = new Date().toISOString();

  const existingBidsSnap = await getDocs(
    query(collection(db, 'requestBids'), where('requestId', '==', request.id))
  );

  const txResult = await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) {
      throw new Error('الطلب غير موجود');
    }
    const reqData = reqSnap.data() as BuyerRequestItem;
    if (reqData.status !== 'open') {
      throw new Error('هذا الطلب مغلق أو تم الاتفاق فيه مسبقاً');
    }

    const prevBidSnap = await transaction.get(bidRef);
    const isUpdate = prevBidSnap.exists();
    const prevCreatedAt = isUpdate ? String(prevBidSnap.data()?.createdAt || nowIso) : nowIso;

    const cleanLogo =
      typeof input.storeLogo === 'string' && input.storeLogo.length <= 850000
        ? input.storeLogo
        : '';

    const bidPayload = {
      requestId: request.id,
      storeId: String(storeId).slice(0, 128),
      storeName: String(input.storeName || 'متجر').trim().slice(0, 200) || 'متجر',
      storeLogo: cleanLogo,
      storeCity: String(input.storeCity || '').trim().slice(0, 100),
      storeVerified: Boolean(input.storeVerified),
      price: cleanPrice,
      deliveryIncluded: Boolean(input.deliveryIncluded),
      deliveryFee: cleanDeliveryFee,
      deliveryEstimate: String(input.deliveryEstimate || 'خلال نفس اليوم').trim().slice(0, 120),
      warrantyNote: String(input.warrantyNote || '').trim().slice(0, 1000),
      productId: input.productId ? String(input.productId).slice(0, 128) : null,
      productTitle: input.productTitle ? String(input.productTitle).slice(0, 200) : null,
      status: 'pending' as RequestBidStatus,
      createdAt: prevCreatedAt,
      updatedAt: nowIso,
    };

    const otherPendingPrices = existingBidsSnap.docs
      .filter((d) => d.id !== bidId && d.data()?.status !== 'withdrawn' && d.data()?.status !== 'rejected')
      .map((d) => Number(d.data()?.price))
      .filter((n) => Number.isFinite(n));

    const allPrices = [...otherPendingPrices, cleanPrice];
    const nextLowest = allPrices.length > 0 ? Math.min(...allPrices) : cleanPrice;
    const nextCount = otherPendingPrices.length + 1;

    transaction.set(bidRef, bidPayload);
    transaction.update(reqRef, {
      bidsCount: nextCount,
      lowestBidPrice: nextLowest,
      updatedAt: nowIso,
    });

    return {
      isUpdate,
      buyerId: reqData.userId,
      requestTitle: reqData.title,
    };
  });

  if (txResult.buyerId && txResult.buyerId !== storeId) {
    const deliveryTxt = input.deliveryIncluded
      ? 'شامل التوصيل مجاناً'
      : cleanDeliveryFee > 0
        ? `رسوم التوصيل: ${cleanDeliveryFee.toLocaleString()} ر.ي`
        : 'استلام من المتجر';

    await addDoc(collection(db, 'notifications'), {
      userId: txResult.buyerId,
      title: txResult.isUpdate
        ? `تحديث عرض سعر على طلبك`
        : `عرض سعر جديد من متجر على طلبك`,
      message: `قدّم متجر «${input.storeName}» عرضاً بسعر ${cleanPrice.toLocaleString()} ر.ي (${deliveryTxt}) لطلبك: ${txResult.requestTitle}`,
      type: 'order',
      read: false,
      actionUrl: `/requests?id=${request.id}`,
      createdAt: nowIso,
    }).catch(() => {});
  }

  return { bidId, isUpdate: txResult.isUpdate };
}

export async function acceptStoreBidTransaction(params: {
  request: BuyerRequestItem;
  bid: RequestBidItem;
  buyerId: string;
  buyerName: string;
}): Promise<void> {
  const { request, bid, buyerId, buyerName } = params;
  if (!request?.id || !bid?.id || !buyerId) {
    throw new Error('بيانات القبول غير مكتملة');
  }
  if (request.userId !== buyerId) {
    throw new Error('صاحب الطلب فقط يمكنه قبول العرض');
  }

  const reqRef = doc(db, 'buyerRequests', request.id);
  const bidRef = doc(db, 'requestBids', bid.id);
  const nowIso = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqRef);
    const bidSnap = await transaction.get(bidRef);
    if (!reqSnap.exists() || !bidSnap.exists()) {
      throw new Error('الطلب أو العرض غير موجود');
    }
    const reqData = reqSnap.data() as BuyerRequestItem;
    if (reqData.status !== 'open') {
      throw new Error('تم إغلاق هذا الطلب أو قبول عرض آخر مسبقاً');
    }

    transaction.update(reqRef, {
      status: 'accepted',
      acceptedBidId: bid.id,
      acceptedStoreId: bid.storeId,
      acceptedStoreName: bid.storeName,
      acceptedPrice: bid.price,
      updatedAt: nowIso,
    });

    transaction.update(bidRef, {
      status: 'accepted',
      updatedAt: nowIso,
    });
  });

  const deliveryLabel = bid.deliveryIncluded
    ? 'شامل التوصيل مجاناً'
    : bid.deliveryFee > 0
      ? `رسوم التوصيل ${bid.deliveryFee.toLocaleString()} ر.ي`
      : 'بدون توصيل إضافي';

  const summaryText =
    `✅ تم قبول عرض متجركم على طلب التسعيرة:\n` +
    `• الطلب: ${request.title}\n` +
    `• السعر المتفق عليه: ${Number(bid.price || 0).toLocaleString()} ر.ي (${deliveryLabel})\n` +
    (bid.warrantyNote ? `• الضمان والملاحظات: ${bid.warrantyNote}\n` : '') +
    `• العميل: ${buyerName || request.userName}\n` +
    `يسعدني تنسيق إتمام الشراء والاستلام معكم الآن.`;

  await addDoc(collection(db, 'notifications'), {
    userId: bid.storeId,
    title: `مبروك! تم قبول عرضك لطلب "${request.title.slice(0, 50)}"`,
    message: `وافق العميل ${buyerName || request.userName} على عرض سعرك (${Number(bid.price || 0).toLocaleString()} ر.ي). افتح الرسائل لإتمام التنسيق.`,
    type: 'order',
    read: false,
    actionUrl: `/contact?to=${buyerId}`,
    createdAt: nowIso,
  }).catch(() => {});

  const participants = [buyerId, bid.storeId].sort();
  const conversationId = participants.join('_');

  await addDoc(collection(db, 'messages'), {
    text: summaryText,
    senderId: buyerId,
    recipientId: bid.storeId,
    conversationId,
    participants,
    isRead: false,
    createdAt: nowIso,
  }).catch(() => {});

  await setDoc(
    doc(db, 'conversations', conversationId),
    {
      participants,
      lastMessage: `قبول عرض تسعيرة: ${request.title}`.slice(0, 120),
      lastMessageAt: nowIso,
      unreadCount: {
        [bid.storeId]: increment(1),
      },
    },
    { merge: true }
  ).catch(() => {});
}

export async function updateBuyerRequestStatus(
  requestId: string,
  nextStatus: 'open' | 'closed'
): Promise<void> {
  await updateDoc(doc(db, 'buyerRequests', requestId), {
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteBuyerRequestWithBids(requestId: string): Promise<void> {
  const bidsSnap = await getDocs(
    query(collection(db, 'requestBids'), where('requestId', '==', requestId))
  );
  await Promise.all(bidsSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  await deleteDoc(doc(db, 'buyerRequests', requestId));
}
