import React, { useState, useEffect } from 'react';
import {
  Trash2,
  ShoppingBag,
  CreditCard,
  Wallet,
  MapPin,
  Navigation,
  CheckCircle,
  ArrowRight,
  Copy,
  Check,
  UploadCloud,
  X,
  Plus,
  Minus,
  Phone,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { MerchantWallet } from '../components/WalletManagement';
import { isProductOfferActive, getProductOfferBadgeText } from '../lib/offerUtils';

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

const getDefaultFallbackWallets = (storeName: string = 'يمن ستور'): MerchantWallet[] => [
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

function CartItemThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#5C5B57] dark:text-zinc-500">
        <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  );
}

export default function Cart() {
  const { cart, removeFromCart, updateCartQuantity, cartTotal, user, userData, clearCart, getThemeClasses, settings } = useAppContext();
  const currentStoreName = settings?.storeName || 'يمن ستور';
  const defaultWallets = getDefaultFallbackWallets(currentStoreName);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'wallet'>('cod');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [merchantWallets, setMerchantWallets] = useState<MerchantWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<MerchantWallet | null>(null);
  const [transferReference, setTransferReference] = useState('');
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const [customerPhone, setCustomerPhone] = useState(userData?.phone || '');
  const [customerNotes, setCustomerNotes] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (userData?.phone && !customerPhone) {
      setCustomerPhone(userData.phone);
    }
  }, [userData?.phone]);

  useEffect(() => {
    if (cart.length === 0) return;
    const storeId = cart[0]?.product?.ownerId || 'global';

    const loadWallets = async () => {
      try {
        const storeRef = doc(db, 'storeWallets', storeId);
        const storeSnap = await getDoc(storeRef);

        let loaded: MerchantWallet[] = [];
        if (storeSnap.exists() && storeSnap.data()?.wallets) {
          loaded = (storeSnap.data().wallets as MerchantWallet[]).filter(w => w.isActive);
        }

        if (loaded.length === 0 && storeId !== 'global') {
          const globalRef = doc(db, 'storeWallets', 'global');
          const globalSnap = await getDoc(globalRef);
          if (globalSnap.exists() && globalSnap.data()?.wallets) {
            loaded = (globalSnap.data().wallets as MerchantWallet[]).filter(w => w.isActive);
          }
        }

        if (loaded.length === 0) {
          loaded = defaultWallets;
        }

        setMerchantWallets(loaded);
        if (loaded.length > 0 && !selectedWallet) {
          setSelectedWallet(loaded[0]);
        }
      } catch (err) {
        console.error('Error fetching wallets in cart:', err);
        setMerchantWallets(defaultWallets);
        setSelectedWallet(defaultWallets[0]);
      }
    };

    loadWallets();
  }, [cart]);

  const requestLocation = (silent = false) => {
    if (!silent) setIsGettingLocation(true);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsGettingLocation(false);
          if (!silent) toast.success("تم تحديد موقعك بدقة لمندوب التوصيل");
        },
        (error) => {
          console.error("Error getting location", error);
          setIsGettingLocation(false);
          if (!silent) {
            let msg = "فشل الوصول للموقع. يرجى تفعيل الـ GPS والسماح للمتصفح بالوصول.";
            if (error.code === error.PERMISSION_DENIED) msg = "الرجاء السماح بالوصول للموقع ليتمكن المندوب من الوصول إليك.";
            toast.error(msg);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setIsGettingLocation(false);
      if (!silent) toast.error("متصفحك لا يدعم تحديد الموقع التلقائي");
    }
  };

  useEffect(() => {
    if (cart.length > 0 && !location) {
      requestLocation(true);
    }
  }, [cart.length]);

  const handleCopyAccount = (wallet: MerchantWallet) => {
    navigator.clipboard.writeText(wallet.accountNumber);
    setCopiedWalletId(wallet.id);
    toast.success(`تم نسخ رقم حساب ${wallet.name}: ${wallet.accountNumber}`);
    setTimeout(() => setCopiedWalletId(null), 3000);
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (PNG أو JPG)');
      return;
    }

    setIsUploadingProof(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressed = await compressImage(reader.result as string, 900, 900, 0.7);
        setPaymentProof(compressed);
        toast.success('تم رفع صورة السند بنجاح');
      } catch {
        toast.error('حدث خطأ أثناء معالجة الصورة');
      } finally {
        setIsUploadingProof(false);
      }
    };
    reader.onerror = () => {
      toast.error('فشل قراءة ملف الصورة');
      setIsUploadingProof(false);
    };
    reader.readAsDataURL(file);
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4" dir="rtl">
        <div className="w-16 h-16 bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] rounded-lg flex items-center justify-center mb-5">
          <ShoppingBag className="h-8 w-8 text-[#5C5B57] dark:text-zinc-300 stroke-[1.5]" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] mb-2">السلة فارغة</h2>
        <p className="text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mb-6 max-w-sm">
          أضف بعض المنتجات من المتجر لتتمكن من مراجعتها وإتمام الشراء بسهولة.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`${getThemeClasses('bg')} ${getThemeClasses('hover')} min-h-[44px] px-7 py-2.5 rounded-lg font-bold text-sm transition-colors`}
        >
          تصفح المنتجات الآن
        </button>
      </div>
    );
  }

  const handleCheckout = async () => {
    if (!user) {
      toast.error("الرجاء تسجيل الدخول أولاً لإتمام الطلب");
      return;
    }

    if (paymentMethod === 'wallet' && !selectedWallet) {
      toast.error("يرجى اختيار المحفظة الإلكترونية التي ترغب بالتحويل عبرها");
      return;
    }

    if (paymentMethod === 'wallet' && !transferReference.trim() && !paymentProof) {
      toast.error("يرجى إدخال رقم الحوالة/العملية أو رفع صورة إشعار السند لتأكيد الطلب");
      return;
    }

    if (!location) {
      toast.loading("جاري محاولة تحديد موقعك للدقة...", { duration: 1500 });
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
            setLocation(loc);
            await finalizeOrder(loc);
          },
          async () => {
            await finalizeOrder(null);
          },
          { enableHighAccuracy: true, timeout: 4000 }
        );
      } else {
        await finalizeOrder(null);
      }
      return;
    }

    await finalizeOrder(location);
  };

  const finalizeOrder = async (loc: { lat: number; lng: number } | null) => {
    setIsSubmitting(true);
    try {
      const targetStoreId = cart[0]?.product?.ownerId;
      let storeProfileData: any = null;
      if (targetStoreId && targetStoreId !== 'global') {
        try {
          const sSnap = await getDoc(doc(db, 'storeProfiles', targetStoreId));
          if (sSnap.exists()) {
            storeProfileData = sSnap.data();
          } else {
            const uSnap = await getDoc(doc(db, 'users', targetStoreId));
            if (uSnap.exists()) {
              storeProfileData = uSnap.data();
            }
          }
        } catch (e) {
          console.warn("Store profile lookup notice:", e);
        }
      }

      const orderData = {
        userId: user?.uid,
        customerName: userData?.displayName || userData?.name || user?.displayName || `عميل ${currentStoreName}`,
        customerEmail: user?.email || '',
        customerPhone: customerPhone.trim() || userData?.phone || '',
        customerNotes: customerNotes.trim(),
        storeId: targetStoreId || 'global',
        storeName: storeProfileData?.name || cart[0]?.product?.ownerName || (settings?.storeName || 'يمن ستور'),
        storeAddress: storeProfileData?.address || (storeProfileData?.city ? `${storeProfileData.city} - المركز` : 'صنعاء'),
        storeLocation: storeProfileData?.location || storeProfileData?.coordinates || null,
        storeMapsUrl: storeProfileData?.googleMapsUrl || storeProfileData?.mapsUrl || '',
        storePhone: storeProfileData?.phone || storeProfileData?.whatsapp || '',
        deliveryFee: (isProductOfferActive(cart[0]?.product) && cart[0]?.product?.offerType === 'free_delivery')
          ? 0
          : (cart[0]?.product?.deliveryFee ?? 1500),
        deliveryStatus: 'pending_pickup',
        customerAddress: customerNotes.trim() || 'العنوان محدد عبر الخريطة',
        items: cart.map(item => ({
          productId: item.product.id,
          title: item.product.title,
          price: item.product.price,
          originalPrice: item.product.originalPrice || null,
          offerTitle: isProductOfferActive(item.product) ? (item.product.offerTitle || null) : null,
          offerExtras: isProductOfferActive(item.product) ? (item.product.offerExtras || null) : null,
          quantity: item.quantity,
          image: item.product.image || (item.product.images && item.product.images[0]) || ''
        })),
        total: cartTotal,
        status: 'pending',
        paymentMethod: paymentMethod,
        selectedWallet: paymentMethod === 'wallet' && selectedWallet ? {
          id: selectedWallet.id,
          name: selectedWallet.name,
          accountNumber: selectedWallet.accountNumber,
          accountName: selectedWallet.accountName,
          transferType: selectedWallet.transferType,
          pointDetails: selectedWallet.pointDetails || '',
          notes: selectedWallet.notes || ''
        } : null,
        transferReference: paymentMethod === 'wallet' ? transferReference.trim() : null,
        paymentProof: paymentMethod === 'wallet' ? paymentProof : null,
        location: loc,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'orders'), orderData);

      toast.success("تم استلام طلبك بنجاح! سيتم التواصل معك والبدء بالتجهيز فوراً.");
      clearCart();
      navigate('/orders');
    } catch (error) {
      console.error("Error creating order", error);
      toast.error("حدث خطأ أثناء إتمام الطلب. تأكد من اتصالك بالإنترنت.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-8 pb-16" dir="rtl">
      {/* Editorial Invoice Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E5E2DA] dark:border-[#232730] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight">سلة المشتريات</h1>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-1">
            راجع منتجاتك واختر وسيلة الدفع المناسبة لإتمام الطلب
          </p>
        </div>
        <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 tabular-nums">
          إجمالي القطع: {totalItemsCount}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Start 7 Columns: Hairline Line-Item Ledger + Contact Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] divide-y divide-[#E5E2DA] dark:divide-[#232730]">
            {cart.map((item) => {
              const unitPrice = Number(item.product.price || 0);
              const lineSubtotal = unitPrice * item.quantity;

              return (
                <div
                  key={item.product.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730]">
                      <CartItemThumbnail
                        src={item.product.image || (item.product.images && item.product.images[0])}
                        alt={item.product.title}
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-[#111214] dark:text-[#F4F4F2] text-sm sm:text-base line-clamp-1">
                          {item.product.title}
                        </h3>
                        {isProductOfferActive(item.product) && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            {getProductOfferBadgeText(item.product)}
                          </span>
                        )}
                      </div>
                      {isProductOfferActive(item.product) && (item.product.offerExtras || item.product.offerTitle) && (
                        <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 line-clamp-1">
                          {item.product.offerExtras || item.product.offerTitle}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-[#5C5B57] dark:text-zinc-400">
                        <span className="tabular-nums font-semibold">
                          {unitPrice.toLocaleString()} ر.ي
                        </span>
                        {Number(item.product.originalPrice || 0) > unitPrice && (
                          <span className="line-through opacity-60 tabular-nums">
                            {Number(item.product.originalPrice).toLocaleString()}
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>سعر الوحدة</span>
                      </div>
                      <div className={`text-sm font-extrabold ${getThemeClasses('price')} tabular-nums`}>
                        {lineSubtotal.toLocaleString()} <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5E2DA] dark:border-[#232730]">
                    <div className="flex items-center rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26]">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="w-10 h-10 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] transition-colors rounded-r-lg"
                        aria-label="إنقاص الكمية"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="w-10 h-10 flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] transition-colors rounded-l-lg"
                        aria-label="زيادة الكمية"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="w-10 h-10 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#1C1F26] text-[#5C5B57] hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800 flex items-center justify-center transition-colors shrink-0"
                      title="إزالة من السلة"
                      aria-label="إزالة من السلة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Customer Contact & Address Details */}
          <div className="p-5 sm:p-6 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-4">
            <h4 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
              <Phone className={`w-4 h-4 ${getThemeClasses('text')}`} />
              <span>بيانات التواصل والتسليم</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#5C5B57] dark:text-zinc-400 mb-1.5">
                  رقم الهاتف أو الواتساب للتواصل *
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="مثال: 777123456"
                  dir="ltr"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-bold text-left outline-none focus:border-[#111214] dark:focus:border-zinc-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5B57] dark:text-zinc-400 mb-1.5">
                  ملاحظات أو تفاصيل العنوان
                </label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="مثال: الحي، الشارع، قرب معلم معين..."
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right/End 5 Columns: Sticky Invoice Summary & Payment */}
        <div className="lg:col-span-5">
          <div className="p-5 sm:p-6 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-5 lg:sticky lg:top-22">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
              <CreditCard className="w-5 h-5 text-[#111214] dark:text-[#F4F4F2]" />
              <h3 className="font-display text-lg font-extrabold text-[#111214] dark:text-[#F4F4F2]">ملخص الفاتورة والدفع</h3>
            </div>

            {/* Clean Hairline Invoice Breakdown (No nested boxes) */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-[#5C5B57] dark:text-zinc-400 font-medium text-xs">المجموع الفرعي</span>
                <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">{cartTotal.toLocaleString()} ر.ي</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#5C5B57] dark:text-zinc-400 font-medium text-xs">رسوم التوصيل</span>
                <span className={`${getThemeClasses('price')} font-bold text-xs`}>مجاناً</span>
              </div>
              <div className="pt-3 border-t border-dashed border-[#E5E2DA] dark:border-[#232730] flex justify-between items-end">
                <span className="text-[#5C5B57] dark:text-zinc-300 font-bold text-xs">الإجمالي النهائي</span>
                <span className={`text-2xl sm:text-3xl font-extrabold ${getThemeClasses('price')} tabular-nums`}>
                  {cartTotal.toLocaleString()} <span className="text-xs text-[#5C5B57] dark:text-zinc-400 font-bold">ر.ي</span>
                </span>
              </div>
            </div>

            {/* GPS Location Row */}
            <div className="pt-4 border-t border-[#E5E2DA] dark:border-[#232730] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className={`w-4 h-4 ${getThemeClasses('text')}`} />
                  <span className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2]">موقع التوصيل عبر GPS</span>
                </div>
                {location && (
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>تم التحديد</span>
                  </span>
                )}
              </div>

              {!location ? (
                <button
                  type="button"
                  onClick={() => requestLocation()}
                  disabled={isGettingLocation}
                  className="w-full min-h-[42px] bg-[#111214] hover:bg-[#24262B] text-white dark:bg-[#F4F4F2] dark:hover:bg-[#E4E4E0] dark:text-[#111214] py-2.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGettingLocation ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      <span>تحديد موقعي التلقائي للمندوب</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5C5B57] dark:text-zinc-400 text-[11px]">الإحداثيات محددة بدقة على الخريطة</span>
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                  >
                    إعادة التحديد
                  </button>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2.5 pt-4 border-t border-[#E5E2DA] dark:border-[#232730]">
              <label className="block text-xs font-bold text-[#5C5B57] dark:text-zinc-400">
                طريقة الدفع
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`min-h-[48px] p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
                    paymentMethod === 'cod'
                      ? `${getThemeClasses('border')} ${getThemeClasses('bgLight')} ${getThemeClasses('textDark')}`
                      : 'border-[#E5E2DA] dark:border-[#232730] hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs font-bold">الدفع عند الاستلام</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`min-h-[48px] p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
                    paymentMethod === 'wallet'
                      ? `${getThemeClasses('border')} ${getThemeClasses('bgLight')} ${getThemeClasses('textDark')}`
                      : 'border-[#E5E2DA] dark:border-[#232730] hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs font-bold">المحافظ الإلكترونية</span>
                </button>
              </div>
            </div>

            {/* Merchant Wallets Flow */}
            <AnimatePresence>
              {paymentMethod === 'wallet' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-3 border-t border-[#E5E2DA] dark:border-[#232730]"
                >
                  <div>
                    <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-2">
                      اختر المحفظة الإلكترونية للتاجر:
                    </label>

                    <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730] rounded-lg border border-[#E5E2DA] dark:border-[#232730] max-h-52 overflow-y-auto">
                      {merchantWallets.map((wallet) => {
                        const isSelected = selectedWallet?.id === wallet.id;
                        return (
                          <div
                            key={wallet.id}
                            onClick={() => setSelectedWallet(wallet)}
                            className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected
                                ? `${getThemeClasses('bgLight')}`
                                : 'bg-white dark:bg-[#131519] hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs shrink-0 ${
                                isSelected ? `${getThemeClasses('bg')}` : 'bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-300'
                              }`}>
                                <Wallet className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2] truncate">{wallet.name}</h5>
                                <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-mono tabular-nums">
                                  {wallet.accountNumber}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400">
                                {wallet.transferType === 'point' ? 'نقطة' : 'مشترك'}
                              </span>
                              {isSelected && <Check className={`w-4 h-4 ${getThemeClasses('text')}`} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedWallet && (
                    <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400">رقم الحساب / الهاتف:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] select-all tabular-nums">
                            {selectedWallet.accountNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount(selectedWallet)}
                            className={`px-2 py-1 rounded-md ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-[11px] font-bold transition-colors flex items-center gap-1`}
                            title="نسخ رقم الحساب"
                          >
                            {copiedWalletId === selectedWallet.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>تم</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs border-b border-[#E5E2DA] dark:border-[#232730] pb-2">
                        <span className="text-[#5C5B57] dark:text-zinc-400">اسم المستلم:</span>
                        <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">{selectedWallet.accountName}</span>
                      </div>

                      <div className="text-xs">
                        <span className="font-semibold text-[#5C5B57] dark:text-zinc-400 block mb-0.5">
                          طريقة التحويل:
                        </span>
                        {selectedWallet.transferType === 'point' ? (
                          <div className="text-amber-700 dark:text-amber-400 font-bold">
                            تحويل لنقطة صرافة: <span className="underline">{selectedWallet.pointDetails || 'يرجى مراجعة التاجر'}</span>
                          </div>
                        ) : (
                          <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                            تحويل مباشر لحساب مشترك
                          </div>
                        )}
                        {selectedWallet.notes && (
                          <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-1">
                            {selectedWallet.notes}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                          رقم الحوالة أو العملية (أو أرفق السند)
                        </label>
                        <input
                          type="text"
                          value={transferReference}
                          onChange={(e) => setTransferReference(e.target.value)}
                          placeholder="رقم العملية من إشعار التحويل"
                          className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-xs font-bold outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">
                          صورة إشعار التحويل (اختياري)
                        </label>

                        {!paymentProof ? (
                          <label className="min-h-[44px] border border-dashed border-[#D5D1C7] dark:border-[#343A46] hover:border-[#111214] dark:hover:border-zinc-400 rounded-lg p-3 flex items-center justify-center cursor-pointer transition-colors bg-white dark:bg-[#131519]">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleProofUpload}
                              className="hidden"
                              disabled={isUploadingProof}
                            />
                            {isUploadingProof ? (
                              <div className="flex items-center gap-2 text-xs font-bold text-[#5C5B57]">
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                <span>جاري معالجة الصورة...</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs font-bold text-[#5C5B57] dark:text-zinc-300">
                                <UploadCloud className="w-4 h-4" />
                                <span>رفع لقطة شاشة للسند</span>
                              </div>
                            )}
                          </label>
                        ) : (
                          <div className="relative rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] max-h-36 bg-black flex items-center justify-center">
                            <img src={paymentProof} alt="Payment Receipt" className="max-h-36 object-contain" />
                            <button
                              type="button"
                              onClick={() => setPaymentProof(null)}
                              className="absolute top-2 left-2 p-1 bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors"
                              title="حذف الصورة"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Primary Confirm Button */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting}
              className={`w-full ${getThemeClasses('bg')} ${getThemeClasses('hover')} min-h-[48px] py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>تأكيد وإتمام الطلب</span>
                  <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
