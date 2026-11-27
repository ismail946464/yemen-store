import React, { useState } from 'react';
import {
  Handshake,
  CheckCircle2,
  XCircle,
  Package,
  Clock,
  MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../AppContext';
import {
  PriceOfferItem,
  getPriceOfferStatusLabel,
  respondToPriceOffer,
} from '../lib/priceOffers';
import { formatArabicDate, formatArabicTime } from '../lib/deviceSafe';

export default function PriceOffersInbox({
  offers,
}: {
  offers: PriceOfferItem[];
}) {
  const { getThemeClasses } = useAppContext();
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  const filtered = offers.filter((o) => {
    if (filter === 'pending') return o.status === 'pending';
    if (filter === 'resolved') return o.status !== 'pending';
    return true;
  });

  const handleDecision = async (offer: PriceOfferItem, decision: 'accepted' | 'rejected') => {
    setBusyId(offer.id);
    try {
      await respondToPriceOffer({
        offer,
        decision,
        storeReply: replyMap[offer.id] || '',
      });
      toast.success(
        decision === 'accepted'
          ? 'تم قبول عرض السعر وإشعار العميل لإضافته للسلة'
          : 'تم رفض العرض وإرسال الرد للعميل'
      );
    } catch {
      toast.error('تعذر حفظ القرار، يرجى المحاولة مرة أخرى');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: `الكل (${offers.length})` },
            { id: 'pending', label: `بانتظار الرد (${offers.filter((o) => o.status === 'pending').length})` },
            { id: 'resolved', label: `تم الرد (${offers.filter((o) => o.status !== 'pending').length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id as any)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors tabular-nums ${
                filter === t.id
                  ? `${getThemeClasses('bg')} border-transparent`
                  : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-10 text-center space-y-2">
          <Handshake className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-50" />
          <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">لا توجد عروض تفاوض في هذا القسم</p>
          <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
            عندما يقدّم العملاء عروض أسعار على منتجاتك ستظهر هنا للقبول أو الرفض الفوري
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((offer) => {
            const discountPct =
              offer.originalPrice > 0
                ? Math.round(((offer.originalPrice - offer.offeredPrice) / offer.originalPrice) * 100)
                : 0;
            const totalOffered = Number(offer.offeredPrice || 0) * Math.max(1, Number(offer.quantity || 1));

            return (
              <div
                key={offer.id}
                className="rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-4 space-y-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] shrink-0 flex items-center justify-center">
                      {offer.productImage ? (
                        <img src={offer.productImage} alt={offer.productTitle} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-[#5C5B57] opacity-50" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2] line-clamp-1">
                        {offer.productTitle}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-0.5 tabular-nums">
                        <span className="font-bold text-[#111214] dark:text-zinc-200">{offer.buyerName}</span>
                        <span aria-hidden="true">·</span>
                        <span>الكمية: {offer.quantity}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatArabicDate(offer.createdAt)} {formatArabicTime(offer.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold flex items-center gap-1 ${
                      offer.status === 'accepted' || offer.status === 'used'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : offer.status === 'rejected'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{getPriceOfferStatusLabel(offer.status)}</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] divide-x divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730] text-center">
                  <div className="p-2.5">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">السعر الأصلي</span>
                    <span className="text-xs sm:text-sm font-bold text-[#5C5B57] dark:text-zinc-300 line-through tabular-nums">
                      {Number(offer.originalPrice).toLocaleString()} ر.ي
                    </span>
                  </div>
                  <div className="p-2.5">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">السعر المقترح للقطعة</span>
                    <span className={`text-xs sm:text-sm font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                      {Number(offer.offeredPrice).toLocaleString()} ر.ي {discountPct > 0 ? `(-${discountPct}%)` : ''}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">إجمالي العرض ({offer.quantity})</span>
                    <span className="text-xs sm:text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                      {totalOffered.toLocaleString()} ر.ي
                    </span>
                  </div>
                </div>

                {offer.note && (
                  <div className="text-xs text-[#5C5B57] dark:text-zinc-300 bg-[#FAF9F6] dark:bg-[#101216] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#5C5B57]" />
                    <span>ملاحظة المشتري: {offer.note}</span>
                  </div>
                )}

                {offer.status === 'pending' ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={replyMap[offer.id] || ''}
                      onChange={(e) => setReplyMap((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                      placeholder="رد أو ملاحظة اختيارية للعميل..."
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-medium text-[#111214] dark:text-[#F4F4F2] outline-none"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === offer.id}
                        onClick={() => handleDecision(offer, 'accepted')}
                        className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>قبول العرض</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === offer.id}
                        onClick={() => handleDecision(offer, 'rejected')}
                        className="min-h-[40px] px-3.5 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-[#131519] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رفض</span>
                      </button>
                    </div>
                  </div>
                ) : offer.storeReply ? (
                  <p className="text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400">
                    رد المتجر: {offer.storeReply}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
