import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Edit,
  Store,
  Package,
  Layers,
  Percent,
  BookmarkCheck,
  AlertTriangle,
  ExternalLink,
  RotateCcw,
  Image as ImageIcon,
  BadgeCheck,
} from 'lucide-react';
import { getProductVariants } from '../lib/variantUtils';
import { getProductStatusMeta } from '../lib/productModerationUtils';
import { isProductOfferActive, getOfferTypeLabel } from '../lib/offerUtils';

interface ProductSafetyModalProps {
  product: any | null;
  storeName: string;
  storeVerified?: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (product: any) => void;
  onSubmitForReview: (product: any) => Promise<void>;
  onApproveAndPublish: (product: any) => Promise<void>;
  onReject: (product: any, reason: string) => Promise<void>;
  onMoveToQueue: (product: any) => Promise<void>;
}

const REJECTION_PRESETS = [
  'بيانات أو وصف المنتج غير مكتمل',
  'الصور غير واضحة أو غير مطابقة للمنتج',
  'السعر غير منطقي أو يحتاج توضيحاً',
  'المنتج مخالف لسياسة وشروط النشر في المتجر',
];

export default function ProductSafetyModal({
  product,
  storeName,
  storeVerified,
  isAdmin,
  onClose,
  onEdit,
  onSubmitForReview,
  onApproveAndPublish,
  onReject,
  onMoveToQueue,
}: ProductSafetyModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedPreviewImg, setSelectedPreviewImg] = useState<string>('');

  useEffect(() => {
    if (product) {
      setRejectionReason(product.rejectionReason || '');
      const imgs: string[] = Array.isArray(product.images)
        ? product.images.filter(Boolean)
        : product.image
          ? [product.image]
          : [];
      setSelectedPreviewImg(imgs[0] || '');
    }
  }, [product]);

  if (!product) return null;

  const statusMeta = getProductStatusMeta(product.status);
  const images: string[] = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : product.image
      ? [product.image]
      : [];
  const variants = getProductVariants(product);
  const hasOffer = isProductOfferActive(product) || Boolean(product.hasOffer);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[125] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#111214] dark:text-[#F4F4F2]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-base sm:text-lg font-bold truncate">
                  فحص ومعاينة كافة تفاصيل المنتج
                </h3>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
                مراجعة شاملة لجميع البيانات والصور والأسعار والأصناف قبل الإرسال والنشر للعامة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* 3-Step Safety Pipeline Indicator */}
          <div className="grid grid-cols-3 border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden bg-[#FAF9F6] dark:bg-[#101216] divide-x divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730] text-center text-[11px] font-bold">
            <div
              className={`p-2.5 flex items-center justify-center gap-1.5 ${
                product.status === 'queued'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                  : 'text-[#5C5B57] dark:text-zinc-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>1. قائمة انتظار المتجر</span>
            </div>
            <div
              className={`p-2.5 flex items-center justify-center gap-1.5 ${
                product.status === 'pending_review'
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300'
                  : 'text-[#5C5B57] dark:text-zinc-400'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>2. مراجعة الإدارة</span>
            </div>
            <div
              className={`p-2.5 flex items-center justify-center gap-1.5 ${
                product.status === 'active'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                  : product.status === 'rejected'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    : 'text-[#5C5B57] dark:text-zinc-400'
              }`}
            >
              {product.status === 'rejected' ? (
                <>
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>مرفوض</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>3. منشور للعامة</span>
                </>
              )}
            </div>
          </div>

          {/* Previous Rejection Notice */}
          {product.status === 'rejected' && product.rejectionReason && (
            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-800 dark:text-rose-200">سبب الرفض من الإدارة:</p>
                <p className="text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">{product.rejectionReason}</p>
              </div>
            </div>
          )}

          {/* Store Publisher Strip */}
          <div className="p-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
              <span className="text-[#5C5B57] dark:text-zinc-400 font-medium">المتجر الناشر:</span>
              <span className="font-bold">{storeName || 'متجر مسجل'}</span>
              {storeVerified && <BadgeCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
            </div>
            <div className="text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">
              {product.submittedForReviewAt
                ? `أُرسل للمراجعة: ${new Date(product.submittedForReviewAt).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' })}`
                : product.createdAt
                  ? `أُنشئ: ${new Date(product.createdAt).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' })}`
                  : ''}
            </div>
          </div>

          {/* Product Images & Core Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Images Gallery */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold block">الصور المرفقة ({images.length})</span>
              <div className="aspect-square rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] overflow-hidden flex items-center justify-center">
                {selectedPreviewImg ? (
                  <img src={selectedPreviewImg} alt={product.title} className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-[#5C5B57] dark:text-zinc-500">
                    <ImageIcon className="w-8 h-8 opacity-50" />
                    <span className="text-xs font-medium">لا توجد صور مرفوعة</span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedPreviewImg(img)}
                      className={`w-14 h-14 rounded-md overflow-hidden border shrink-0 transition ${
                        selectedPreviewImg === img
                          ? 'border-[#111214] dark:border-[#F4F4F2] ring-1 ring-[#111214] dark:ring-[#F4F4F2]'
                          : 'border-[#E5E2DA] dark:border-[#232730] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Core Product Metadata */}
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400">اسم المنتج</span>
                <h4 className="font-display text-lg font-extrabold mt-0.5 leading-snug">{product.title || '—'}</h4>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">السعر الحالي</span>
                  <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {Number(product.price || 0).toLocaleString('ar-YE')} ر.ي
                  </span>
                  {Number(product.originalPrice || 0) > Number(product.price || 0) && (
                    <span className="block text-[10px] line-through text-[#5C5B57] dark:text-zinc-500 tabular-nums">
                      {Number(product.originalPrice).toLocaleString('ar-YE')} ر.ي
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">الكمية بالمخزون</span>
                  <span className="font-extrabold text-sm tabular-nums">
                    {product.stock === null || product.stock === undefined ? 'غير محدود' : `${product.stock} وحدة`}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">التصنيف</span>
                  <span className="font-bold">{product.category || 'عام'}</span>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">الحجز المسبق (عربون)</span>
                  <span className="font-bold flex items-center gap-1">
                    <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    {product.isPreOrderEnabled || product.noDelivery
                      ? `مفعل (${product.depositAmount ? `${Number(product.depositAmount).toLocaleString('ar-YE')} ر.ي` : '20%'} · ${product.reservationDurationDays || 3} أيام)`
                      : 'غير مفعل'}
                  </span>
                </div>

                <div className="col-span-2 p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216]">
                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block mb-0.5">نظام التوصيل والاستلام</span>
                  {product.noDelivery ? (
                    <div className="space-y-1">
                      <span className="font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 shrink-0" />
                        <span>لا يوجد توصيل — الحجز والاستلام من المتجر نفسه فقط</span>
                      </span>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                        مهلة الحضور للاستلام: {product.reservationDurationDays || 3} أيام — وفي حال عدم حضور العميل للاستلام يذهب العربون للمتجر.
                      </p>
                    </div>
                  ) : (
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      توصيل متاح للعملاء (شراء عبر السلة أو حجز مسبق)
                    </span>
                  )}
                </div>
              </div>

              {/* Offer Details */}
              {hasOffer && (
                <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                    <Percent className="w-3.5 h-3.5" />
                    <span>العرض المرفق: {getOfferTypeLabel(product.offerType)}</span>
                  </div>
                  {product.offerTitle && <p className="font-medium">عنوان العرض: {product.offerTitle}</p>}
                  {product.offerExtras && <p className="text-[#5C5B57] dark:text-zinc-300">إضافات العرض: {product.offerExtras}</p>}
                  {product.offerExpiresAt && (
                    <p className="text-[11px] tabular-nums">
                      ينتهي في: {new Date(product.offerExpiresAt).toLocaleDateString('ar-YE')}
                    </p>
                  )}
                </div>
              )}

              {/* External Link */}
              {product.externalLink && (
                <a
                  href={product.externalLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>رابط خارجي مرفق بالمنتج</span>
                </a>
              )}
            </div>
          </div>

          {/* Full Description */}
          <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] space-y-1.5">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-[#5C5B57] dark:text-zinc-400" />
              <span>الوصف الكامل للمنتج</span>
            </span>
            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-[#111214] dark:text-zinc-200">
              {product.description?.trim() ? product.description : 'لم يُكتب وصف للمنتج.'}
            </p>
          </div>

          {/* Variants Full List */}
          {variants.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
                  <span>أصناف المنتج المرفقة ({variants.length})</span>
                </span>
              </div>
              <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730] border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
                {variants.map((v, idx) => (
                  <div key={v.id || idx} className="p-3 bg-white dark:bg-[#131519] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-md overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] shrink-0 flex items-center justify-center">
                        {v.image ? (
                          <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                        ) : (
                          <Layers className="w-4 h-4 text-[#5C5B57] dark:text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{v.name}</p>
                        {v.notes && (
                          <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 truncate">{v.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-left shrink-0 space-y-0.5 tabular-nums">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400">
                        {Number(v.price || 0).toLocaleString('ar-YE')} ر.ي
                      </p>
                      <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400">
                        {v.stock === null || v.stock === undefined ? 'غير محدود' : `${v.stock} وحدة`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Moderation Controls */}
          {isAdmin && (
            <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] space-y-3">
              <label className="block text-xs font-bold">
                ملاحظة / سبب الرفض (مطلوب في حال رفض نشر المنتج)
              </label>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="اكتب سبب الرفض أو التعديلات المطلوبة من المتجر..."
                className="w-full p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
              />
              <div className="flex flex-wrap gap-1.5">
                {REJECTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectionReason(preset)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {!isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                <span>تعديل البيانات</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {product.status === 'pending_review' ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runAction('queue', () => onMoveToQueue(product))}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>سحب لقائمة الانتظار للتعديل</span>
                  </button>
                ) : product.status !== 'active' ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runAction('submit', () => onSubmitForReview(product))}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>تأكيد وإرسال لمراجعة الإدارة</span>
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>منشور ومعتمد للعامة</span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center gap-1.5"
                >
                  <Edit className="w-4 h-4" />
                  <span>تعديل</span>
                </button>
                {product.status === 'active' && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runAction('queue', () => onMoveToQueue(product))}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إيقاف وإعادة للانتظار</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => runAction('reject', () => onReject(product, rejectionReason))}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>رفض النشر</span>
                </button>
                {product.status !== 'active' && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runAction('approve', () => onApproveAndPublish(product))}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>قبول ونشر للعامة</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
