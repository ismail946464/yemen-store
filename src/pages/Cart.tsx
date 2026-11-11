import React, { useState, useEffect, ChangeEvent } from 'react';
import { Trash2, ShoppingBag, CreditCard, Wallet, MapPin, Navigation, CheckCircle, ArrowRight, Copy, Check, UploadCloud, X, AlertCircle } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { MerchantWallet } from '../components/WalletManagement';

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

export default function Cart() {
  const { cart, removeFromCart, cartTotal, user, userData, clearCart, isDarkMode, getThemeClasses, settings } = useAppContext();
  const currentStoreName = settings?.storeName || 'يمن ستور';
  const defaultWallets = getDefaultFallbackWallets(currentStoreName);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'wallet'>('cod');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Wallets state
  const [merchantWallets, setMerchantWallets] = useState<MerchantWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<MerchantWallet | null>(null);
  const [transferReference, setTransferReference] = useState('');
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Customer contact info state
  const [customerPhone, setCustomerPhone] = useState(userData?.phone || '');
  const [customerNotes, setCustomerNotes] = useState('');

  const navigate = useNavigate();

  // Load merchant wallets from Firestore storeWallets/{storeId}
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

        // Fallback to global store wallets if merchant hasn't configured any
        if (loaded.length === 0 && storeId !== 'global') {
          const globalRef = doc(db, 'storeWallets', 'global');
          const globalSnap = await getDoc(globalRef);
          if (globalSnap.exists() && globalSnap.data()?.wallets) {
            loaded = (globalSnap.data().wallets as MerchantWallet[]).filter(w => w.isActive);
          }
        }

        // If still none, use defaults
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
      const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(newLoc);
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
        options
      );
    } else {
      setIsGettingLocation(false);
      if (!silent) toast.error("متصفحك لا يدعم تحديد الموقع التلقائي");
    }
  };

  // Try to get location when cart loads
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
      } catch (err) {
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
        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
          <ShoppingBag className="h-12 w-12 text-slate-700 dark:text-slate-200" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">السلة فارغة</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">أضف بعض المنتجات لتتمكن من شرائها والطلب المباشر</p>
        <button 
          onClick={() => navigate('/')}
          className={`${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white px-8 py-3.5 rounded-2xl font-black shadow-lg active:scale-95 transition`}
        >
          تصفح المتجر الآن
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

  const finalizeOrder = async (loc: {lat: number, lng: number} | null) => {
    setIsSubmitting(true);
    try {
      const orderData = {
        userId: user?.uid,
        customerName: userData?.displayName || userData?.name || user?.displayName || `عميل ${currentStoreName}`,
        customerEmail: user?.email || '',
        customerPhone: customerPhone.trim() || userData?.phone || '',
        customerNotes: customerNotes.trim(),
        storeId: cart[0]?.product?.ownerId || 'global',
        storeName: cart[0]?.product?.ownerName || (settings?.storeName || 'يمن ستور'),
        deliveryFee: cart[0]?.product?.deliveryFee || 1500,
        deliveryStatus: 'pending_pickup',
        customerAddress: customerNotes.trim() || 'العنوان محدد عبر الخريطة',
        items: cart.map(item => ({
          productId: item.product.id,
          title: item.product.title,
          price: item.product.price,
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 font-sans" dir="rtl">
      {/* Title */}
      <div className="text-right px-4">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2">سلة المشتريات</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold">راجع طلباتك واختر وسيلة الدفع المناسبة لإتمام الطلب</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4">
        {/* Cart items list */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              key={item.product.id} 
              className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isDarkMode 
                  ? 'bg-slate-900 border-slate-800' 
                  : 'bg-white border-neutral-200 shadow-xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-neutral-100 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
                  <img 
                    src={item.product.image || (item.product.images && item.product.images[0]) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300'} 
                    alt={item.product.title} 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="text-center sm:text-right flex-1 min-w-0">
                  <h3 className="font-bold text-neutral-900 dark:text-white text-base mb-1 truncate">{item.product.title}</h3>
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-1.5">
                    <span className="font-black text-base text-neutral-950 dark:text-white tabular-nums">
                      {item.product.price?.toLocaleString()} <span className="text-xs font-normal text-neutral-500">ر.ي</span>
                    </span>
                    <span className="text-xs bg-neutral-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-slate-700">
                      الكمية: {item.quantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center sm:justify-start text-[11px] text-neutral-500 font-medium">
                    <span>متوفر للتسليم المباشر</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => removeFromCart(item.product.id)}
                className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-slate-800 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95 shrink-0 border border-neutral-200 dark:border-slate-700"
                title="إزالة من السلة"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}

          {/* Customer contact details optional confirmation */}
          <div className={`p-6 rounded-3xl border space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
          }`}>
            <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${getThemeClasses('bg')}`}></span>
              بيانات التواصل الخاصة بك لتأكيد الطلب
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  رقم الهاتف أو الواتساب للتواصل *
                </label>
                <input 
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="مثال: 777123456"
                  className={`w-full px-4 py-3 rounded-2xl border text-sm font-bold transition focus:ring-2 ${getThemeClasses('ring')} outline-none ${
                    isDarkMode 
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  ملاحظات أو تفاصيل العنوان الإضافية
                </label>
                <input 
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="مثال: الحي، الشارع، قرب معلم معين..."
                  className={`w-full px-4 py-3 rounded-2xl border text-sm font-bold transition focus:ring-2 ${getThemeClasses('ring')} outline-none ${
                    isDarkMode 
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Checkout & Payment Summary */}
        <div className="space-y-6">
          <div className={`p-5 sm:p-6 rounded-2xl border space-y-6 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-neutral-200 shadow-xs'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neutral-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-slate-700">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">ملخص الطلب والدفع</h3>
            </div>

            {/* Price breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 font-bold text-xs">المجموع الفرعي</span>
                <span className="font-black text-slate-900 dark:text-white">{cartTotal.toLocaleString()} ر.ي</span>
              </div>
              <div className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 font-bold text-xs">رسوم التوصيل</span>
                <span className={`${getThemeClasses('price')} font-black text-xs`}>مجاناً</span>
              </div>
              <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-end">
                  <span className="text-slate-500 dark:text-slate-400 font-black text-xs">الإجمالي النهائي</span>
                  <span className={`text-3xl font-black ${getThemeClasses('price')}`}>
                    {cartTotal.toLocaleString()} <span className="text-xs text-slate-500 font-bold">ر.ي</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Location selector */}
            <div className={`p-4 rounded-2xl border transition ${
              location 
                ? `${getThemeClasses('bgLight')} ${getThemeClasses('border')}` 
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Navigation className={`w-4 h-4 ${getThemeClasses('text')}`} />
                  <span className="font-black text-xs text-slate-900 dark:text-white">موقع التوصيل عبر الـ GPS</span>
                </div>
                {location && (
                  <span className={`text-[10px] font-black ${getThemeClasses('text')} flex items-center gap-1`}>
                    <CheckCircle className="w-3.5 h-3.5" />
                    تم التحديد
                  </span>
                )}
              </div>

              {!location ? (
                <button 
                  onClick={() => requestLocation()}
                  disabled={isGettingLocation}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isGettingLocation ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      تحديد موقعي التلقائي للمندوب
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">الإحداثيات محددة بدقة على الخريطة</span>
                  <button 
                    onClick={() => setLocation(null)}
                    className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                  >
                    إعادة التحديد
                  </button>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                طريقة الدفع
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Cash on delivery */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'cod'
                      ? `${getThemeClasses('border')} ${getThemeClasses('bgLight')} ${getThemeClasses('text')} shadow-sm`
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                  <span className="text-xs font-black">الدفع عند الاستلام</span>
                </button>

                {/* Electronic Wallets */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative ${
                    paymentMethod === 'wallet'
                      ? `${getThemeClasses('border')} ${getThemeClasses('bgLight')} ${getThemeClasses('text')} shadow-sm`
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className={`absolute -top-2 right-2 ${getThemeClasses('bg')} text-white text-[9px] font-black px-1.5 py-0.5 rounded-full`}>
                    مباشر
                  </span>
                  <Wallet className="w-5 h-5" />
                  <span className="text-xs font-black">المحافظ الإلكترونية</span>
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
                  className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                      اختر المحفظة الإلكترونية للتاجر:
                    </label>

                    <div className="grid grid-cols-1 gap-2.5 max-h-56 overflow-y-auto p-1">
                      {merchantWallets.map((wallet) => {
                        const isSelected = selectedWallet?.id === wallet.id;
                        return (
                          <div
                            key={wallet.id}
                            onClick={() => setSelectedWallet(wallet)}
                            className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? `${getThemeClasses('border')} ${getThemeClasses('bgLight')} text-slate-900 dark:text-white`
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                isSelected ? `${getThemeClasses('bg')} text-white` : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}>
                                <Wallet className="w-4 h-4" />
                              </div>
                              <div>
                                <h5 className="font-black text-xs text-slate-900 dark:text-white">{wallet.name}</h5>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  {wallet.accountNumber}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                wallet.transferType === 'point'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : getThemeClasses('badge')
                              }`}>
                                {wallet.transferType === 'point' ? 'تحويل لنقطة' : 'تحويل لمشترك'}
                              </span>
                              {isSelected && <Check className={`w-4 h-4 ${getThemeClasses('text')}`} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Wallet Details & Account Copy */}
                  {selectedWallet && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">رقم الحساب / الهاتف:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-slate-900 dark:text-white select-all">
                            {selectedWallet.accountNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount(selectedWallet)}
                            className={`p-1.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white text-xs transition active:scale-95 flex items-center gap-1 shadow-sm`}
                            title="نسخ رقم الحساب"
                          >
                            {copiedWalletId === selectedWallet.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold">تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold">نسخ</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">اسم صاحب الحساب / المستلم:</span>
                        <span className="font-black text-slate-800 dark:text-slate-200">{selectedWallet.accountName}</span>
                      </div>

                      {/* Transfer Type description */}
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                          طريقة التحويل المطلوبة من التاجر:
                        </span>
                        {selectedWallet.transferType === 'point' ? (
                          <div className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                            <span>📍 تحويل لنقطة صرافة / وكيل:</span>
                            <span className="underline">{selectedWallet.pointDetails || 'يرجى مراجعة التاجر'}</span>
                          </div>
                        ) : (
                          <div className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <span>✅ تحويل مباشر لمشترك:</span>
                            <span>إلى رقم الحساب الموضح أعلاه مباشرة</span>
                          </div>
                        )}
                        {selectedWallet.notes && (
                          <p className="text-[11px] text-slate-400 mt-1 italic">
                            ملاحظة: {selectedWallet.notes}
                          </p>
                        )}
                      </div>

                      {/* Transaction reference input */}
                      <div>
                        <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                          رقم الحوالة أو العملية (اختياري إذا أرفقت السند):
                        </label>
                        <input
                          type="text"
                          value={transferReference}
                          onChange={(e) => setTransferReference(e.target.value)}
                          placeholder="مثال: رقم العملية من إشعار التحويل"
                          className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 ${
                            isDarkMode 
                              ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' 
                              : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                          }`}
                        />
                      </div>

                      {/* Payment proof receipt upload */}
                      <div>
                        <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                          إرفاق صورة إشعار أو سند التحويل (موصى به):
                        </label>
                        
                        {!paymentProof ? (
                          <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition bg-white/50 dark:bg-slate-900/50">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleProofUpload} 
                              className="hidden" 
                              disabled={isUploadingProof}
                            />
                            {isUploadingProof ? (
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                جاري معالجة الصورة...
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                                <UploadCloud className="w-4 h-4 text-emerald-600" />
                                <span>اضغط لاختيار صورة السند أو لقطة الشاشة</span>
                              </div>
                            )}
                          </label>
                        ) : (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-36 bg-black flex items-center justify-center group">
                            <img src={paymentProof} alt="Payment Receipt" className="max-h-36 object-contain" />
                            <button
                              type="button"
                              onClick={() => setPaymentProof(null)}
                              className="absolute top-2 left-2 p-1 bg-red-600 text-white rounded-lg shadow-md hover:scale-105 active:scale-95 transition"
                              title="حذف الصورة"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <span className={`absolute bottom-2 right-2 ${getThemeClasses('bg')} text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-md`}>
                              تم إرفاق السند ✅
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirm & Order Button */}
            <button 
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full bg-neutral-900 hover:bg-black text-white py-3.5 rounded-xl font-bold text-sm shadow-xs active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>تأكيد وشراء الآن</span>
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
