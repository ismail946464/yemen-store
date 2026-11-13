import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, Clock, ShieldAlert, CreditCard,
  Copy, Check, UploadCloud, BookmarkCheck, Store
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MerchantWallet } from './WalletManagement';

const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.65): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const getDefaultWallets = (storeName: string = 'يمن ستور'): MerchantWallet[] => [
  {
    id: 'kuraimi-default',
    name: 'الكريمي كاش (Kuraimi)',
    accountNumber: '777000000',
    accountName: `متجر ${storeName} الرسمي`,
    transferType: 'subscriber',
    isActive: true,
    notes: 'تحويل مباشر لحساب المشترك عبر تطبيق كريمي جوال أو صرافات الكريمي'
  },
  {
    id: 'jawali-default',
    name: 'محفظة جوالي (Jawali)',
    accountNumber: '777111222',
    accountName: `متجر ${storeName} الرسمي`,
    transferType: 'subscriber',
    isActive: true,
    notes: 'تحويل لمشترك جوالي فوري'
  },
  {
    id: 'jeeb-default',
    name: 'محفظة جيب (Jeeb)',
    accountNumber: '777333444',
    accountName: `متجر ${storeName} الرسمي`,
    transferType: 'subscriber',
    isActive: true,
    notes: 'تحويل مباشر عبر محفظة جيب'
  }
];

interface PreOrderModalProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function PreOrderModal({ product, isOpen, onClose }: PreOrderModalProps) {
  const { user, userData, login, getThemeClasses, settings } = useAppContext();
  const currentStoreName = settings?.storeName || 'يمن ستور';
  const defaultWallets = getDefaultWallets(currentStoreName);
  const navigate = useNavigate();

  const productPrice = Number(product?.price) || 0;

  const depositAmount = product?.depositAmount !== undefined && Number(product?.depositAmount) > 0
    ? Number(product.depositAmount)
    : Math.max(1000, Math.round(productPrice * 0.2));

  const reservationDurationDays = product?.reservationDurationDays !== undefined && Number(product?.reservationDurationDays) > 0
    ? Number(product.reservationDurationDays)
    : 3;

  const remainingAmount = Math.max(0, productPrice - depositAmount);

  const [customerPhone, setCustomerPhone] = useState(userData?.phone || '');
  const [customerNotes, setCustomerNotes] = useState('');
  const [merchantWallets, setMerchantWallets] = useState<MerchantWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<MerchantWallet | null>(null);
  const [transferReference, setTransferReference] = useState('');
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [hasAgreedToPolicy, setHasAgreedToPolicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !product) return;
    const storeId = product.ownerId || 'global';

    const loadWallets = async () => {
      try {
        const snap = await getDoc(doc(db, 'storeWallets', storeId));
        if (snap.exists() && snap.data().wallets && snap.data().wallets.length > 0) {
          const active = snap.data().wallets.filter((w: MerchantWallet) => w.isActive);
          if (active.length > 0) {
            setMerchantWallets(active);
            setSelectedWallet(active[0]);
            return;
          }
        }
        setMerchantWallets(defaultWallets);
        setSelectedWallet(defaultWallets[0]);
      } catch (err) {
        console.warn("Failed to load store wallets, fallback to defaults:", err);
        setMerchantWallets(defaultWallets);
        setSelectedWallet(defaultWallets[0]);
      }
    };

    loadWallets();
  }, [isOpen, product]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWalletId(id);
    toast.success("تم نسخ رقم الحساب");
    setTimeout(() => setCopiedWalletId(null), 2500);
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت.");
      return;
    }

    setIsUploadingProof(true);
    const toastId = toast.loading("جاري معالجة وضغط صورة الإشعار...");

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string, 900, 900, 0.7);
          setPaymentProof(compressed);
          toast.success("تم رفع وتحسين صورة الإشعار بنجاح", { id: toastId });
        } catch {
          toast.error("فشل معالجة الصورة", { id: toastId });
        } finally {
          setIsUploadingProof(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("خطأ أثناء قراءة الملف", { id: toastId });
      setIsUploadingProof(false);
    }
  };

  const handleSubmitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يرجى تسجيل الدخول أولاً لإتمام الحجز المسبق");
      login();
      return;
    }

    if (!customerPhone.trim()) {
      toast.error("يرجى كتابة رقم الهاتف للتواصل معك بخصوص الحجز");
      return;
    }

    if (!transferReference.trim()) {
      toast.error("يرجى إدخال رقم الحوالة أو المرجع لتأكيد دفع العربون");
      return;
    }

    if (!hasAgreedToPolicy) {
      toast.error("يجب الموافقة على شرط وسياسة الحجز المسبق للمتابعة");
      return;
    }

    setIsSubmitting(true);
    const reservationExpiresAt = new Date(Date.now() + reservationDurationDays * 86400000).toISOString();

    try {
      const reservationData = {
        userId: user.uid,
        customerName: userData?.name || user.displayName || 'عميل محترم',
        customerEmail: user.email || '',
        customerPhone: customerPhone.trim(),
        customerNotes: customerNotes.trim(),
        orderType: 'preorder',
        isPreOrder: true,
        depositAmount: depositAmount,
        remainingAmount: remainingAmount,
        reservationDurationDays: reservationDurationDays,
        reservationExpiresAt: reservationExpiresAt,
        reservationStatus: 'active',
        reservationTerms: `تم حجز السلعة لمدة ${reservationDurationDays} أيام بعربون مقداره ${depositAmount} ريال. مالم يتم إتمام الشراء وسداد الباقي (${remainingAmount} ريال) قبل انتهاء المدة يذهب العربون للمتجر.`,
        status: 'reserved',
        deliveryStatus: 'pending_pickup',
        deliveryFee: product.deliveryFee || 1500,
        storeId: product.ownerId || '',
        storeName: product.ownerName || (settings?.storeName || 'يمن ستور'),
        items: [{
          productId: product.id,
          id: product.id,
          title: product.title,
          price: productPrice,
          quantity: 1,
          image: product.image || (product.images && product.images[0]) || '',
          ownerId: product.ownerId || '',
          depositAmount: depositAmount,
          remainingAmount: remainingAmount
        }],
        total: productPrice,
        paymentMethod: 'wallet',
        selectedWallet: selectedWallet || null,
        transferReference: transferReference.trim(),
        paymentProof: paymentProof || null,
        createdAt: new Date().toISOString()
      };

      if (product.ownerId) {
        try {
          const sSnap = await getDoc(doc(db, 'storeProfiles', product.ownerId));
          if (sSnap.exists()) {
            const sData = sSnap.data();
            (reservationData as any).storeAddress = sData.address || (sData.city ? `${sData.city} - المركز` : 'صنعاء');
            (reservationData as any).storeLocation = sData.location || sData.coordinates || null;
            (reservationData as any).storeMapsUrl = sData.googleMapsUrl || sData.mapsUrl || '';
            (reservationData as any).storePhone = sData.phone || sData.whatsapp || '';
          }
        } catch (e) {
          console.warn("Store profile lookup for preorder notice:", e);
        }
      }

      await addDoc(collection(db, 'orders'), reservationData);

      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: 'تم تأكيد طلب الحجز المسبق بنجاح',
        message: `تم تسجيل حجز منتج "${product.title}" بدفع عربون ${depositAmount.toLocaleString()} ريال. مدة الحجز ${reservationDurationDays} أيام حتى ${new Date(reservationExpiresAt).toLocaleDateString('ar-YE')}.`,
        type: 'order',
        createdAt: new Date().toISOString(),
        read: false,
        actionUrl: '/orders'
      }).catch(() => {});

      if (product.ownerId && product.ownerId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: product.ownerId,
          title: 'حجز مسبق جديد بعربون!',
          message: `قام العميل ${userData?.name || 'مشتري'} بحجز منتج "${product.title}" ودفع عربون ${depositAmount.toLocaleString()} ريال لمدة ${reservationDurationDays} أيام.`,
          type: 'order',
          createdAt: new Date().toISOString(),
          read: false,
          actionUrl: '/admin?tab=orders'
        }).catch(() => {});
      }

      toast.success("تم تأكيد طلب الحجز المسبق بنجاح!");
      onClose();
      navigate('/orders');
    } catch (err) {
      console.error("Reservation submission error:", err);
      toast.error("حدث خطأ أثناء تسجيل الحجز، يرجى المحاولة مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose} dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl shadow-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] flex items-center justify-center border border-[#E5E2DA] dark:border-[#232730]">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold">حجز مسبق بعربون</h2>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400">احتفاظ بالسلعة ومنع بيعها خلال المهلة المحددة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-lg bg-[#FAF9F6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] hover:text-[#111214] dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitReservation} className="p-5 sm:p-6 space-y-6 max-h-[78vh] overflow-y-auto no-scrollbar">
          {/* Product Summary Line */}
          <div className="pb-4 border-b border-[#E5E2DA] dark:border-[#232730] flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] shrink-0 border border-[#E5E2DA] dark:border-[#232730]">
              {product.image || (product.images && product.images[0]) ? (
                <img src={product.image || product.images[0]} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5C5B57]">
                  <Store className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 truncate">{product.category || 'منتج'}</p>
              <h3 className="font-bold text-sm sm:text-base truncate">{product.title}</h3>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-0.5 tabular-nums">
                السعر الكامل: <strong className={`${getThemeClasses('price')}`}>{productPrice.toLocaleString()} ر.ي</strong>
              </p>
            </div>
          </div>

          {/* Unified 3-Cell Deposit Ledger */}
          <div className="grid grid-cols-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-center">
            <div className="p-3.5 border-e border-[#E5E2DA] dark:border-[#232730]">
              <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 block mb-0.5">العربون الآن</span>
              <span className="text-base sm:text-xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                {depositAmount.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-[#5C5B57] mr-1">ر.ي</span>
            </div>

            <div className="p-3.5 border-e border-[#E5E2DA] dark:border-[#232730]">
              <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 block mb-0.5">المتبقي لاحقاً</span>
              <span className={`text-base sm:text-xl font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                {remainingAmount.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-[#5C5B57] mr-1">ر.ي</span>
            </div>

            <div className="p-3.5">
              <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 block mb-0.5">مدة الحجز</span>
              <span className="text-base sm:text-xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                {reservationDurationDays}
              </span>
              <span className="text-[10px] font-bold text-[#5C5B57] mr-1">أيام</span>
            </div>
          </div>

          {/* Policy Agreement */}
          <div className="p-4 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2.5">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <h4 className="font-bold text-xs sm:text-sm">سياسة الحجز المسبق وضمان العربون</h4>
            </div>
            <p className="text-xs leading-relaxed text-rose-900 dark:text-rose-200">
              عند دفع العربون يلتزم المتجر بحجز السلعة لك لمدة {reservationDurationDays} أيام. في حال عدم إتمام سداد المبلغ المتبقي ({remainingAmount.toLocaleString()} ر.ي) قبل انتهاء المدة، يُلغى الحجز تلقائياً ويُحتسب العربون للمتجر.
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer pt-1 select-none">
              <input
                type="checkbox"
                checked={hasAgreedToPolicy}
                onChange={(e) => setHasAgreedToPolicy(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-rose-900 dark:text-rose-300">
                أوافق على شروط الحجز المسبق وموعد استكمال السداد.
              </span>
            </label>
          </div>

          {/* Wallet Selection */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs sm:text-sm font-bold flex items-center gap-2">
                <CreditCard className={`w-4 h-4 ${getThemeClasses('text')}`} />
                <span>محفظة المتجر لدفع العربون ({depositAmount.toLocaleString()} ر.ي)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {merchantWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  onClick={() => setSelectedWallet(wallet)}
                  className={`p-3.5 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between ${
                    selectedWallet?.id === wallet.id
                      ? `${getThemeClasses('border')} ${getThemeClasses('bgLight')}`
                      : 'border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] hover:border-[#111214]/40'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-bold">{wallet.name}</span>
                    <span className="text-[10px] font-semibold text-[#5C5B57] dark:text-zinc-400">
                      {wallet.transferType === 'subscriber' ? 'مشترك' : 'وكيل'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                    <div className={`font-mono text-sm font-extrabold tabular-nums ${getThemeClasses('text')}`}>
                      {wallet.accountNumber}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(wallet.id, wallet.accountNumber);
                      }}
                      className="px-2 py-1 rounded-md text-[10px] font-bold bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex items-center gap-1 hover:bg-[#EFEDE6] dark:hover:bg-[#232730]"
                    >
                      {copiedWalletId === wallet.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedWalletId === wallet.id ? 'تم' : 'نسخ'}</span>
                    </button>
                  </div>
                  {wallet.accountName && (
                    <div className="text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-1 truncate">
                      باسم: {wallet.accountName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contact & Reference Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold block">رقم هاتفك للتواصل وتأكيد الحجز *</label>
              <input
                type="tel"
                required
                placeholder="مثال: 777123456"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] font-bold text-sm outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold block">رقم الحوالة أو المرجع لدفع العربون *</label>
              <input
                type="text"
                required
                placeholder="رقم العملية من تطبيق المحفظة"
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] font-bold text-sm outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-right"
              />
            </div>
          </div>

          {/* Proof Screenshot Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold flex items-center justify-between">
              <span>صورة إشعار تحويل العربون (اختياري)</span>
              {paymentProof && <span className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">تم إرفاق الإشعار</span>}
            </label>
            <div className="p-3.5 rounded-lg border border-dashed border-[#D5D1C7] dark:border-[#343A46] bg-[#FAF9F6] dark:bg-[#1C1F26] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <UploadCloud className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold">ارفع لقطة شاشة من إشعار التحويل</p>
                  <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">يدعم JPG, PNG</p>
                </div>
              </div>
              <label className={`min-h-[38px] px-4 py-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-xs font-bold cursor-pointer inline-flex items-center transition-colors`}>
                <span>{isUploadingProof ? 'جاري المعالجة...' : paymentProof ? 'تغيير' : 'اختيار صورة'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProofUpload}
                  disabled={isUploadingProof}
                  className="hidden"
                />
              </label>
            </div>
            {paymentProof && (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730]">
                <img src={paymentProof} alt="إشعار التحويل" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPaymentProof(null)}
                  className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white"
                  aria-label="حذف"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold block">ملاحظات إضافية للمتجر (اختياري)</label>
            <input
              type="text"
              placeholder="أي تفاصيل خاصة ترغب في إبلاغ المتجر بها..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] font-medium text-xs outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-right"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !hasAgreedToPolicy}
            className={`w-full min-h-[48px] py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
              !hasAgreedToPolicy
                ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : `${getThemeClasses('bg')} ${getThemeClasses('hover')}`
            }`}
          >
            {isSubmitting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>جاري تسجيل الحجز المسبق...</span>
              </>
            ) : (
              <>
                <BookmarkCheck className="w-4 h-4" />
                <span>تأكيد الحجز المسبق ({depositAmount.toLocaleString()} ر.ي)</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
