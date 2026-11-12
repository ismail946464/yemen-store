import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Clock, ShieldAlert, CheckCircle, CreditCard, 
  Copy, Check, UploadCloud, AlertCircle, BookmarkCheck,
  ChevronLeft, Sparkles, Store
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MerchantWallet } from './WalletManagement';

// Client-side image compression
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
  const { user, userData, login, getThemeClasses, isDarkMode, settings } = useAppContext();
  const currentStoreName = settings?.storeName || 'يمن ستور';
  const defaultWallets = getDefaultWallets(currentStoreName);
  const navigate = useNavigate();

  // Reservation details from product configuration or calculated defaults
  const productPrice = Number(product?.price) || 0;
  
  // Deposit amount: product.depositAmount or 20% of product price by default
  const depositAmount = product?.depositAmount !== undefined && Number(product?.depositAmount) > 0
    ? Number(product.depositAmount)
    : Math.max(1000, Math.round(productPrice * 0.2));

  // Reservation duration set by the store: product.reservationDurationDays or default 3 days
  const reservationDurationDays = product?.reservationDurationDays !== undefined && Number(product?.reservationDurationDays) > 0
    ? Number(product.reservationDurationDays)
    : 3;

  const remainingAmount = Math.max(0, productPrice - depositAmount);

  // Form states
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

  // Fetch store wallets
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
        reservationStatus: 'active', // active, completed, forfeited, cancelled
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

      // Attach store physical location if available
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

      const docRef = await addDoc(collection(db, 'orders'), reservationData);

      // Also create notification for the customer
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: 'تم تأكيد طلب الحجز المسبق بنجاح',
        message: `تم تسجيل حجز منتج "${product.title}" بدفع عربون ${depositAmount.toLocaleString()} ريال. مدة الحجز ${reservationDurationDays} أيام حتى ${new Date(reservationExpiresAt).toLocaleDateString('ar-YE')}.`,
        type: 'order',
        createdAt: new Date().toISOString(),
        read: false,
        actionUrl: '/orders'
      }).catch(() => {});

      // If store owner exists and is different from buyer, notify them
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
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose} dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-[2.5rem] shadow-2xl border overflow-hidden my-auto ${
          isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'
        }`}
      >
        {/* Header */}
        <div className="relative p-6 sm:p-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-inner">
              <BookmarkCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-white">
                  ميزة رسمية
                </span>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  حجز مؤكد مع ضمان عدم البيع
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black mt-1">حجز مسبق مع دفع عربون</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmitReservation} className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto no-scrollbar">
          
          {/* Product Mini Banner */}
          <div className={`p-4 rounded-3xl border flex items-center gap-4 ${
            isDarkMode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white shadow-sm shrink-0 border border-gray-100">
              {product.image || (product.images && product.images[0]) ? (
                <img src={product.image || product.images[0]} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Store className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-base truncate mb-1">{product.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">{product.category}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-bold">السعر الكامل:</span>
                <span className={`text-base font-black ${getThemeClasses('price')}`}>
                  {productPrice.toLocaleString()} ريال
                </span>
              </div>
            </div>
          </div>

          {/* Pricing & Duration Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            {/* Deposit Box */}
            <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
              <span className="text-[11px] font-black text-amber-700 dark:text-amber-300 block mb-1">
                مبلغ العربون المطلوب
              </span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {depositAmount.toLocaleString()}
              </span>
              <span className="text-xs font-black text-amber-700 dark:text-amber-300 mr-1">ريال</span>
              <p className="text-[10px] text-amber-800/80 dark:text-amber-400/80 mt-1 font-bold">
                (يُدفع الآن لتثبيت الحجز)
              </p>
            </div>

            {/* Remaining Box */}
            <div className={`p-4 rounded-3xl border ${getThemeClasses('bgLight')} ${getThemeClasses('border')}`}>
              <span className={`text-[11px] font-black ${getThemeClasses('textDark')} block mb-1`}>
                المتبقي عند الشراء
              </span>
              <span className={`text-2xl font-black ${getThemeClasses('price')}`}>
                {remainingAmount.toLocaleString()}
              </span>
              <span className={`text-xs font-black ${getThemeClasses('textDark')} mr-1`}>ريال</span>
              <p className={`text-[10px] ${getThemeClasses('textDark')} opacity-80 mt-1 font-bold`}>
                (عند استلام السلعة)
              </p>
            </div>

            {/* Duration Box */}
            <div className={`p-4 rounded-3xl border ${getThemeClasses('bgLight')} ${getThemeClasses('border')}`}>
              <span className={`text-[11px] font-black ${getThemeClasses('textDark')} block mb-1`}>
                صلاحية مدة الحجز
              </span>
              <span className={`text-2xl font-black ${getThemeClasses('price')}`}>
                {reservationDurationDays}
              </span>
              <span className={`text-xs font-black ${getThemeClasses('textDark')} mr-1`}>أيام</span>
              <p className={`text-[10px] ${getThemeClasses('textDark')} opacity-80 mt-1 font-bold`}>
                (مهلة حصرية لك)
              </p>
            </div>
          </div>

          {/* Strict Policy Clause (As Requested by User) */}
          <div className="p-5 rounded-3xl bg-red-50 dark:bg-red-950/40 border-2 border-red-500/40 space-y-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h4 className="font-black text-sm">ميثاق وسياسة الحجز المسبق ومصادرة العربون</h4>
            </div>
            <p className="text-xs leading-relaxed text-red-900 dark:text-red-200 font-bold">
              • عند دفع العربون، يلتزم المتجر فوراً بحجز هذه السلعة لك وإيقاف بيعها لأي زبون آخر طوال مدة 
              <span className="font-black underline mx-1">({reservationDurationDays} أيام)</span>.
            </p>
            <p className="text-xs leading-relaxed text-red-900 dark:text-red-200 font-black bg-red-100/80 dark:bg-red-900/40 p-3 rounded-2xl border border-red-300 dark:border-red-800">
              ⚠️ مالم يتم إتمام شراء السلعة وسداد المبلغ المتبقي ({remainingAmount.toLocaleString()} ريال) قبل انتهاء مدة الحجز ({reservationDurationDays} أيام)، يعتبر الحجز لاغياً تلقائياً ويذهب مبلغ العربون بالكامل للمتجر تعويضاً عن حجز السلعة وعدم بيعها لزبون آخر.
            </p>
            <label className="flex items-start gap-3 cursor-pointer pt-2 select-none">
              <input
                type="checkbox"
                checked={hasAgreedToPolicy}
                onChange={(e) => setHasAgreedToPolicy(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded-lg border-2 border-red-400 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-xs font-black text-red-900 dark:text-red-300">
                أقر وأوافق تماماً على هذا الشرط، وأعلم أنه في حال لم أتمم شراء السلعة خلال المدة المحددة يذهب العربون للمتجر.
              </span>
            </label>
          </div>

          {/* Wallet Selection for Deposit Payment */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-black flex items-center gap-2">
                <CreditCard className={`w-4 h-4 ${getThemeClasses('text')}`} />
                <span>اختر محفظة المتجر لدفع العربون ({depositAmount.toLocaleString()} ريال)</span>
              </label>
              <span className="text-[10px] text-gray-400 font-bold">تحويل مباشر</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {merchantWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  onClick={() => setSelectedWallet(wallet)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    selectedWallet?.id === wallet.id
                      ? `${getThemeClasses('border')} ${getThemeClasses('bgLight')} shadow-md ring-2 ${getThemeClasses('ring')}`
                      : isDarkMode
                      ? 'border-gray-800 bg-gray-800 hover:border-gray-700'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black">{wallet.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${getThemeClasses('bgLight')} ${getThemeClasses('textDark')} font-bold`}>
                      {wallet.transferType === 'subscriber' ? 'حساب مشترك' : 'حساب بنكي'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                    <div className={`font-mono text-sm font-black tracking-wider ${getThemeClasses('text')}`}>
                      {wallet.accountNumber}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(wallet.id, wallet.accountNumber);
                      }}
                      className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center gap-1 hover:bg-gray-50 active:scale-95 transition"
                    >
                      {copiedWalletId === wallet.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedWalletId === wallet.id ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                  {wallet.accountName && (
                    <div className="text-[10px] text-gray-500 font-bold mt-1">
                      باسم: {wallet.accountName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Customer Contact & Transfer Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black">رقم هاتفك للتواصل وتأكيد الحجز *</label>
              <input
                type="tel"
                required
                placeholder="مثال: 777123456"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className={`w-full p-4 rounded-2xl border-2 font-black text-sm outline-none transition text-right ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                } focus:${getThemeClasses('border')}`}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black">رقم الحوالة أو المرجع لدفع العربون *</label>
              <input
                type="text"
                required
                placeholder="رقم العملية من تطبيق المحفظة"
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value)}
                className={`w-full p-4 rounded-2xl border-2 font-black text-sm outline-none transition text-right ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                } focus:${getThemeClasses('border')}`}
              />
            </div>
          </div>

          {/* Upload Payment Proof Screenshot */}
          <div className="space-y-2">
            <label className="text-xs font-black flex items-center justify-between">
              <span>صورة إشعار تحويل العربون (اختياري لكن يسرع تأكيد الحجز)</span>
              {paymentProof && <span className="text-green-600 text-[10px] font-bold">تم إرفاق الإشعار بنجاح ✓</span>}
            </label>
            <div className={`p-4 rounded-2xl border-2 border-dashed flex items-center justify-between gap-4 ${
              isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${getThemeClasses('bgLight')} ${getThemeClasses('text')} flex items-center justify-center shrink-0`}>
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold">ارفع لقطة شاشة من إشعار التحويل</p>
                  <p className="text-[10px] text-gray-400">يدعم JPG, PNG (يتم الضغط تلقائياً)</p>
                </div>
              </div>
              <label className={`px-4 py-2.5 rounded-xl ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white text-xs font-black cursor-pointer active:scale-95 transition shadow-md`}>
                <span>{isUploadingProof ? 'جاري المعالجة...' : paymentProof ? 'تغيير الصورة' : 'اختيار صورة'}</span>
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
              <div className={`relative w-28 h-28 rounded-2xl overflow-hidden border-2 ${getThemeClasses('border')} shadow-md`}>
                <img src={paymentProof} alt="إشعار التحويل" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPaymentProof(null)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-black">ملاحظات إضافية للمتجر (اختياري)</label>
            <input
              type="text"
              placeholder="أي تفاصيل خاصة ترغب في إبلاغ المتجر بها..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className={`w-full p-4 rounded-2xl border-2 font-medium text-xs outline-none transition text-right ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              } focus:${getThemeClasses('border')}`}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !hasAgreedToPolicy}
              className={`w-full py-5 rounded-2xl text-white font-black text-base shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                !hasAgreedToPolicy
                  ? 'bg-gray-400 cursor-not-allowed opacity-60'
                  : `${getThemeClasses('bg')} ${getThemeClasses('hover')} shadow-lg`
              }`}
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  <span>جاري تسجيل الحجز المسبق...</span>
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-5 h-5" />
                  <span>تأكيد الحجز المسبق ودفع العربون ({depositAmount.toLocaleString()} ريال)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
