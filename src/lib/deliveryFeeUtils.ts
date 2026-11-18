import {
  collection,
  doc,
  addDoc,
  setDoc,
  runTransaction,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatArabicTime } from './deviceSafe';

export type DeliveryFeeApprovalStatus =
  | 'pending_customer'
  | 'accepted'
  | 'rejected'
  | 'expired';

export const SYSTEM_DELIVERY_SENDER_ID = 'system_delivery';

const expiringInFlight = new Set<string>();

export function computeOrderBaseSubtotal(data: any): number {
  if (typeof data?.subtotal === 'number' && !Number.isNaN(data.subtotal)) {
    return Math.max(0, Number(data.subtotal));
  }
  const total = Number(data?.total || 0);
  const fee = Number(data?.deliveryFee || 0);
  if (data?.isPreOrder) {
    return Math.max(0, total);
  }
  return Math.max(0, total - fee);
}

export function getRemainingMs(expiresAt?: string | null, nowMs: number = Date.now()): number {
  if (!expiresAt) return 0;
  const expMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expMs)) return 0;
  return Math.max(0, expMs - nowMs);
}

export function formatRemainingDuration(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

async function sendSystemNotificationAndMessage(params: {
  recipientId: string;
  title: string;
  notificationMessage: string;
  chatMessage: string;
  actionUrl: string;
}) {
  const { recipientId, title, notificationMessage, chatMessage, actionUrl } = params;
  if (!recipientId) return;

  const nowIso = new Date().toISOString();

  await addDoc(collection(db, 'notifications'), {
    userId: recipientId,
    title,
    message: notificationMessage,
    type: 'order',
    read: false,
    actionUrl,
    createdAt: nowIso
  }).catch((err) => {
    console.warn('Notice creating delivery fee notification:', err);
  });

  const participants = [SYSTEM_DELIVERY_SENDER_ID, recipientId].sort();
  const conversationId = participants.join('_');

  await addDoc(collection(db, 'messages'), {
    text: chatMessage,
    senderId: SYSTEM_DELIVERY_SENDER_ID,
    recipientId,
    conversationId,
    participants,
    isRead: false,
    createdAt: nowIso
  }).catch((err) => {
    console.warn('Notice sending system delivery message:', err);
  });

  await setDoc(
    doc(db, 'conversations', conversationId),
    {
      participants,
      lastMessage: notificationMessage.slice(0, 120),
      lastMessageAt: nowIso,
      unreadCount: {
        [recipientId]: increment(1)
      }
    },
    { merge: true }
  ).catch((err) => {
    console.warn('Notice updating system delivery conversation:', err);
  });
}

export async function proposeDeliveryFeeTransaction(params: {
  orderId: string;
  courierId: string;
  courierName: string;
  courierPhone?: string;
  proposedFee: number;
  acceptDurationMinutes: number;
}) {
  const {
    orderId,
    courierId,
    courierName,
    courierPhone = '',
    proposedFee,
    acceptDurationMinutes
  } = params;

  const cleanFee = Math.max(0, Math.round(Number(proposedFee)));
  const cleanMinutes = Math.max(1, Math.min(1440, Math.round(Number(acceptDurationMinutes))));

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAtIso = new Date(nowMs + cleanMinutes * 60_000).toISOString();

  const orderRef = doc(db, 'orders', orderId);

  const txResult = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef);
    if (!snap.exists()) {
      throw new Error('الطلب غير موجود');
    }

    const data = snap.data() as any;

    if (data.status === 'delivered' || data.deliveryStatus === 'delivered') {
      throw new Error('تم تسليم هذا الطلب مسبقاً');
    }
    if (data.status === 'cancelled' || data.status === 'reservation_expired') {
      throw new Error('هذا الطلب ملغي أو منتهي الصلاحية');
    }
    if (data.noDelivery === true || data.fulfillmentType === 'store_pickup' || data.deliveryStatus === 'store_pickup_only') {
      throw new Error('هذا الطلب لا يدعم التوصيل؛ الاستلام من المتجر نفسه فقط');
    }
    if (data.courierId && data.courierId !== '') {
      throw new Error('تم قبول هذا الطلب مسبقاً من قبل مندوب آخر');
    }

    const baseSubtotal = computeOrderBaseSubtotal(data);
    const projectedTotal = baseSubtotal + cleanFee;

    transaction.update(orderRef, {
      courierId,
      courierName: courierName || 'مندوب توصيل',
      courierPhone: courierPhone || '',
      subtotal: baseSubtotal,
      proposedDeliveryFee: cleanFee,
      deliveryFeeAcceptMinutes: cleanMinutes,
      deliveryFeeProposedAt: nowIso,
      deliveryFeeExpiresAt: expiresAtIso,
      deliveryFeeRespondedAt: null,
      deliveryFeeExpiredAt: null,
      deliveryFeeApprovalStatus: 'pending_customer',
      deliveryStatus: 'fee_pending_customer',
      status: 'processing'
    });

    return {
      customerId: data.userId as string,
      projectedTotal,
      baseSubtotal
    };
  });

  const feeLabel = cleanFee === 0 ? 'مجاناً (0 ر.ي)' : `${cleanFee.toLocaleString('ar-YE')} ر.ي`;
  const durationLabel =
    cleanMinutes >= 60 && cleanMinutes % 60 === 0
      ? `${cleanMinutes / 60} ${cleanMinutes / 60 === 1 ? 'ساعة' : 'ساعات'}`
      : `${cleanMinutes} دقيقة`;
  const deadlineText = formatArabicTime(expiresAtIso);

  if (txResult.customerId) {
    const notifTitle = `عرض رسوم توصيل للطلب #${orderId.slice(0, 8)}`;
    const notifMessage = `اقترح المندوب (${courierName}) رسوم توصيل ${feeLabel}. يرجى القبول أو الرفض خلال ${durationLabel} (حتى ${deadlineText}) وإلا سيعود الطلب للطلبات المتاحة.`;
    const chatMessage =
      `📦 إشعار نظام التوصيل — طلب رقم #${orderId.slice(0, 8)}\n` +
      `قام المندوب (${courierName}) بقبول طلبك وتحديد رسوم التوصيل التالية:\n` +
      `• رسوم التوصيل المقترحة: ${feeLabel}\n` +
      `• إجمالي الطلب بعد التوصيل: ${txResult.projectedTotal.toLocaleString('ar-YE')} ر.ي\n` +
      `• مهلة القبول المحددة: ${durationLabel} (تنتهي الساعة ${deadlineText})\n\n` +
      `يرجى التوجه إلى صفحة «طلباتي» لقبول أو رفض رسوم التوصيل قبل انتهاء المهلة، وفي حال عدم الموافقة سيتم إلغاء تعيين المندوب وإعادة الطلب للطلبات المتوفرة للتوصيل.`;

    await sendSystemNotificationAndMessage({
      recipientId: txResult.customerId,
      title: notifTitle,
      notificationMessage: notifMessage,
      chatMessage,
      actionUrl: '/orders'
    });
  }

  return { expiresAtIso, projectedTotal: txResult.projectedTotal };
}

export async function respondToDeliveryFeeTransaction(params: {
  orderId: string;
  customerId: string;
  action: 'accept' | 'reject';
}) {
  const { orderId, customerId, action } = params;
  const orderRef = doc(db, 'orders', orderId);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const txResult = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef);
    if (!snap.exists()) {
      throw new Error('الطلب غير موجود');
    }

    const data = snap.data() as any;
    if (data.userId !== customerId) {
      throw new Error('غير مصرح لك بتعديل هذا الطلب');
    }
    if (data.deliveryFeeApprovalStatus !== 'pending_customer') {
      throw new Error('لا يوجد عرض رسوم توصيل معلق لهذا الطلب حالياً');
    }

    const expiresMs = data.deliveryFeeExpiresAt ? new Date(data.deliveryFeeExpiresAt).getTime() : 0;
    const isTimedOut = expiresMs > 0 && nowMs >= expiresMs;

    if (action === 'accept' && isTimedOut) {
      transaction.update(orderRef, {
        courierId: null,
        courierName: null,
        courierPhone: null,
        proposedDeliveryFee: null,
        deliveryFeeAcceptMinutes: null,
        deliveryFeeProposedAt: null,
        deliveryFeeExpiresAt: null,
        deliveryFeeExpiredAt: nowIso,
        deliveryFeeApprovalStatus: 'expired',
        deliveryStatus: 'pending_pickup',
        status: data.isPreOrder ? 'reserved' : 'pending'
      });

      return {
        outcome: 'expired' as const,
        courierId: data.courierId as string,
        customerName: data.customerName as string,
        proposedFee: Number(data.proposedDeliveryFee || 0)
      };
    }

    const proposedFee = Math.max(0, Number(data.proposedDeliveryFee || 0));
    const baseSubtotal = computeOrderBaseSubtotal(data);

    if (action === 'accept') {
      const updatedTotal = baseSubtotal + proposedFee;
      const updates: Record<string, any> = {
        subtotal: baseSubtotal,
        deliveryFee: proposedFee,
        total: updatedTotal,
        deliveryFeeApprovalStatus: 'accepted',
        deliveryFeeRespondedAt: nowIso,
        deliveryStatus: 'assigned',
        status: 'processing'
      };

      if (data.isPreOrder) {
        const depositPaid = Number(data.depositAmount || 0);
        updates.remainingAmount = Math.max(0, updatedTotal - depositPaid);
      }

      transaction.update(orderRef, updates);

      return {
        outcome: 'accepted' as const,
        courierId: data.courierId as string,
        customerName: data.customerName as string,
        proposedFee,
        updatedTotal
      };
    } else {
      transaction.update(orderRef, {
        courierId: null,
        courierName: null,
        courierPhone: null,
        proposedDeliveryFee: null,
        deliveryFeeAcceptMinutes: null,
        deliveryFeeProposedAt: null,
        deliveryFeeExpiresAt: null,
        deliveryFeeRespondedAt: nowIso,
        deliveryFeeApprovalStatus: 'rejected',
        deliveryStatus: 'pending_pickup',
        status: data.isPreOrder ? 'reserved' : 'pending'
      });

      return {
        outcome: 'rejected' as const,
        courierId: data.courierId as string,
        customerName: data.customerName as string,
        proposedFee
      };
    }
  });

  if (txResult.courierId) {
    const feeLabel =
      txResult.proposedFee === 0
        ? 'مجاناً (0 ر.ي)'
        : `${txResult.proposedFee.toLocaleString('ar-YE')} ر.ي`;

    if (txResult.outcome === 'accepted') {
      await sendSystemNotificationAndMessage({
        recipientId: txResult.courierId,
        title: `تم قبول رسوم التوصيل للطلب #${orderId.slice(0, 8)}`,
        notificationMessage: `وافق العميل (${txResult.customerName || 'العميل'}) على رسوم التوصيل (${feeLabel}). يمكنك الآن التوجه للمتجر لاستلام الطلب.`,
        chatMessage:
          `✅ إشعار نظام التوصيل — طلب رقم #${orderId.slice(0, 8)}\n` +
          `وافق العميل (${txResult.customerName || 'العميل'}) على رسوم التوصيل المقترحة (${feeLabel}).\n` +
          `يمكنك الآن التوجه إلى المتجر وتأكيد الاستلام من بوابة التوصيل.`,
        actionUrl: '/delivery'
      });
    } else if (txResult.outcome === 'rejected') {
      await sendSystemNotificationAndMessage({
        recipientId: txResult.courierId,
        title: `رفض العميل رسوم التوصيل للطلب #${orderId.slice(0, 8)}`,
        notificationMessage: `رفض العميل رسوم التوصيل المقترحة (${feeLabel}) وتمت إعادة الطلب إلى قائمة الطلبات المتوفرة للتوصيل.`,
        chatMessage:
          `❌ إشعار نظام التوصيل — طلب رقم #${orderId.slice(0, 8)}\n` +
          `رفض العميل (${txResult.customerName || 'العميل'}) رسوم التوصيل المقترحة (${feeLabel}).\n` +
          `تم إلغاء تعيين الطلب لك وإعادته تلقائياً إلى قائمة الطلبات المتوفرة للتوصيل.`,
        actionUrl: '/delivery'
      });
    } else {
      await sendSystemNotificationAndMessage({
        recipientId: txResult.courierId,
        title: `انتهت مهلة قبول التوصيل #${orderId.slice(0, 8)}`,
        notificationMessage: `انتهت مهلة قبول العميل لرسوم التوصيل (${feeLabel}) وتمت إعادة الطلب إلى قائمة الطلبات المتاحة.`,
        chatMessage:
          `⏳ إشعار نظام التوصيل — طلب رقم #${orderId.slice(0, 8)}\n` +
          `انتهت المهلة المحددة دون موافقة العميل على رسوم التوصيل (${feeLabel}).\n` +
          `تم إلغاء القبول وإعادة الطلب إلى قائمة الطلبات المتوفرة للتوصيل.`,
        actionUrl: '/delivery'
      });
    }
  }

  return txResult;
}

export async function expireDeliveryFeeProposalTransaction(orderId: string): Promise<{ expired: boolean }> {
  if (!orderId || expiringInFlight.has(orderId)) {
    return { expired: false };
  }

  expiringInFlight.add(orderId);
  try {
    const orderRef = doc(db, 'orders', orderId);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const txResult = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(orderRef);
      if (!snap.exists()) {
        return { expired: false as const };
      }

      const data = snap.data() as any;
      if (data.deliveryFeeApprovalStatus !== 'pending_customer') {
        return { expired: false as const };
      }

      const expiresMs = data.deliveryFeeExpiresAt ? new Date(data.deliveryFeeExpiresAt).getTime() : 0;
      if (!expiresMs || nowMs < expiresMs) {
        return { expired: false as const };
      }

      transaction.update(orderRef, {
        courierId: null,
        courierName: null,
        courierPhone: null,
        proposedDeliveryFee: null,
        deliveryFeeAcceptMinutes: null,
        deliveryFeeProposedAt: null,
        deliveryFeeExpiresAt: null,
        deliveryFeeExpiredAt: nowIso,
        deliveryFeeApprovalStatus: 'expired',
        deliveryStatus: 'pending_pickup',
        status: data.isPreOrder ? 'reserved' : 'pending'
      });

      return {
        expired: true as const,
        courierId: data.courierId as string,
        customerId: data.userId as string,
        courierName: data.courierName as string,
        proposedFee: Number(data.proposedDeliveryFee || 0)
      };
    });

    if (txResult.expired) {
      const feeLabel =
        txResult.proposedFee === 0
          ? 'مجاناً (0 ر.ي)'
          : `${txResult.proposedFee.toLocaleString('ar-YE')} ر.ي`;

      if (txResult.courierId) {
        await sendSystemNotificationAndMessage({
          recipientId: txResult.courierId,
          title: `انتهت مهلة قبول التوصيل للطلب #${orderId.slice(0, 8)}`,
          notificationMessage: `لم يقم العميل بقبول رسوم التوصيل (${feeLabel}) قبل انتهاء المهلة، فتم إلغاء القبول وإعادة الطلب للطلبات المتاحة.`,
          chatMessage:
            `⏳ إشعار نظام التوصيل — طلب رقم #${orderId.slice(0, 8)}\n` +
            `انتهت المهلة المحددة لقبول العميل رسوم التوصيل (${feeLabel}).\n` +
            `تم إلغاء قبولك للطلب تلقائياً وإعادته إلى قائمة الطلبات المتوفرة للتوصيل.`,
          actionUrl: '/delivery'
        });
      }

      if (txResult.customerId) {
        await sendSystemNotificationAndMessage({
          recipientId: txResult.customerId,
          title: `انتهت مهلة قبول رسوم التوصيل #${orderId.slice(0, 8)}`,
          notificationMessage: `انتهت المدة المحددة لقبول عرض رسوم التوصيل (${feeLabel}) من المندوب (${txResult.courierName || 'المندوب'})، وعاد الطلب لقائمة الطلبات المتوفرة.`,
          chatMessage:
            `⏳ إشعار نظام التوصيل — طلب رقم #${orderId.slice(0, 8)}\n` +
            `انتهت مهلة القبول المحددة لعرض رسوم التوصيل (${feeLabel}) المقدم من المندوب (${txResult.courierName || 'المندوب'}).\n` +
            `تم إلغاء تعيين المندوب وإعادة طلبك لقائمة الطلبات المتوفرة للتوصيل ليتمكن مندوب آخر من التقدم بعرض جديد.`,
          actionUrl: '/orders'
        });
      }
    }

    return { expired: txResult.expired };
  } catch (err) {
    console.warn(`Expiry check notice for order ${orderId}:`, err);
    return { expired: false };
  } finally {
    expiringInFlight.delete(orderId);
  }
}

export async function withdrawDeliveryFeeProposalTransaction(params: {
  orderId: string;
  courierId: string;
}) {
  const { orderId, courierId } = params;
  const orderRef = doc(db, 'orders', orderId);
  const nowIso = new Date().toISOString();

  const txResult = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(orderRef);
    if (!snap.exists()) {
      throw new Error('الطلب غير موجود');
    }

    const data = snap.data() as any;
    if (data.courierId !== courierId) {
      throw new Error('هذا الطلب غير معين لك');
    }
    if (data.deliveryFeeApprovalStatus !== 'pending_customer') {
      throw new Error('لا يمكن سحب العرض بعد تغير حالة الموافقة');
    }

    transaction.update(orderRef, {
      courierId: null,
      courierName: null,
      courierPhone: null,
      proposedDeliveryFee: null,
      deliveryFeeAcceptMinutes: null,
      deliveryFeeProposedAt: null,
      deliveryFeeExpiresAt: null,
      deliveryFeeRespondedAt: nowIso,
      deliveryFeeApprovalStatus: 'rejected',
      deliveryStatus: 'pending_pickup',
      status: data.isPreOrder ? 'reserved' : 'pending'
    });

    return {
      customerId: data.userId as string,
      courierName: data.courierName as string
    };
  });

  if (txResult.customerId) {
    await sendSystemNotificationAndMessage({
      recipientId: txResult.customerId,
      title: `تم سحب عرض التوصيل للطلب #${orderId.slice(0, 8)}`,
      notificationMessage: `قام المندوب (${txResult.courierName || 'المندوب'}) بإلغاء عرض التوصيل وعاد الطلب لقائمة الطلبات المتوفرة للتوصيل.`,
      chatMessage:
        `ℹ️ إشعار نظام التوصيل — طلب رقم #${orderId.slice(0, 8)}\n` +
        `قام المندوب (${txResult.courierName || 'المندوب'}) بسحب طلب استلام التوصيل وعاد الطلب تلقائياً إلى قائمة الطلبات المتوفرة للتوصيل.`,
      actionUrl: '/orders'
    });
  }
}
