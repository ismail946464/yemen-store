import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { ShoppingCart, ArrowRight, Share2, ShieldCheck, Truck, CheckCircle, Store, MessageCircle, Phone, MessageSquare, Star, Send, User, Image as ImageIcon, PackageX, BookmarkCheck } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import PreOrderModal from '../components/PreOrderModal';

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { addToCart, settings, getThemeClasses, user, login } = useAppContext();
  const navigate = useNavigate();
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showPreOrderModal, setShowPreOrderModal] = useState(false);
  const themeColor = settings?.storeTheme || 'green';

  useEffect(() => {
    if (!productId) return;
    const q = query(
      collection(db, 'productReviews'),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn('Reviews listener notice (handled):', err.message);
    });

    return () => unsubscribe();
  }, [productId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      login();
      return;
    }
    if (!newComment.trim()) {
      toast.error("يرجى كتابة تعليق");
      return;
    }

    setSubmittingReview(true);
    try {
      await addDoc(collection(db, 'productReviews'), {
        productId,
        userId: user.uid,
        userName: user.displayName || 'مستخدم',
        userPhoto: user.photoURL || '',
        rating: newRating,
        comment: newComment,
        createdAt: new Date().toISOString()
      });

      // Update product aggregation
      const productRef = doc(db, 'products', productId!);
      const currentRatingCount = product.ratingCount || 0;
      const currentAverageRating = product.averageRating || 0;
      
      const newRatingCount = currentRatingCount + 1;
      const newAverageRating = ((currentAverageRating * currentRatingCount) + newRating) / newRatingCount;

      await updateDoc(productRef, {
        ratingCount: newRatingCount,
        averageRating: newAverageRating
      });

      setNewComment('');
      setNewRating(5);
      toast.success("تمت إضافة تقييمك بنجاح");
    } catch (err) {
      console.error(err);
      toast.error("فشل إضافة التقييم");
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function getProduct() {
      if (!productId) return;
      try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        if (!isMounted) return;
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProduct({ id: docSnap.id, ...data });
          setNotFound(false);
          
          if (data.ownerId) {
            const storeSnap = await getDoc(doc(db, 'storeProfiles', data.ownerId));
            if (isMounted && storeSnap.exists()) {
              setStoreProfile(storeSnap.data());
            }
          }
        } else {
          setNotFound(true);
        }
      } catch (e) {
        if (isMounted) {
          console.error(e);
          setNotFound(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    getProduct();
    return () => { isMounted = false; };
  }, [productId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${getThemeClasses('border')}`}></div>
        <p className="text-xs font-bold text-slate-400">جاري تحميل بيانات المنتج...</p>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4 py-16" dir="rtl">
        <div className="w-24 h-24 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6 shadow-xl shadow-amber-500/10 border border-amber-200/50 dark:border-amber-800/50">
          <PackageX className="w-12 h-12" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-3">
          عذراً، هذا المنتج غير متوفر حالياً
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto mb-8 leading-relaxed">
          يبدو أن هذا المنتج قد تم بيعه أو إزالته من قبل التاجر، أو أن الرابط غير صحيح. يمكنك تصفح المنتجات الأخرى المتاحة في المتجر.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link 
            to="/" 
            className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            تصفح أحدث المنتجات
          </Link>
          <Link 
            to="/search-stores" 
            className="px-8 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm transition"
          >
            دليل المتاجر
          </Link>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description,
          url: window.location.href,
        });
      } catch (err: any) {
        // Silently ignore abort/cancel errors
        if (err.name !== 'AbortError') {
          console.warn("Share failed:", err);
        }
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("تم نسخ الرابط");
    }
  };

  const isStoreVerified = Boolean(product?.ownerVerified || (storeProfile && Boolean(storeProfile.verified) && (!storeProfile.verifiedUntil || storeProfile.verifiedUntil === '' || new Date(storeProfile.verifiedUntil).getTime() >= Date.now())));
  const canPreOrder = isStoreVerified && (product?.isPreOrderEnabled ?? true);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 font-sans" dir="rtl">
      <button 
        onClick={() => navigate(-1)}
        className="group inline-flex items-center gap-2.5 text-gray-900 hover:text-black transition-all mb-8 bg-gray-50 hover:bg-white hover:shadow-xl hover:shadow-black/5 px-6 py-3 rounded-2xl border border-gray-100"
      >
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
        <span className="font-black text-sm">العودة للمتجر</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16">
        {/* Images Section */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-[4/5] rounded-[3rem] overflow-hidden bg-white border border-gray-50 shadow-2xl shadow-black/5 relative group p-2"
          >
            <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative bg-gray-50 flex items-center justify-center">
              {(product.image || (product.images && product.images[0])) ? (
                <img 
                  src={product.image || product.images[0]} 
                  alt={product.title} 
                  className="w-full h-full object-cover transition duration-700 group-hover:scale-110"
                />
              ) : (
                <Store className="w-20 h-20 text-gray-200" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-500"></div>
            </div>
            
            <div className="absolute top-8 left-8 flex flex-col gap-2">
               {product.category === 'local' && (
                 <span className="bg-yellow-400 text-black text-[10px] font-black px-4 py-2 rounded-2xl shadow-xl shadow-yellow-400/20 border border-yellow-500/20 backdrop-blur-md">منتج محلي 🇾🇪</span>
               )}
            </div>
            
            <button 
              onClick={handleShare}
              className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center bg-white/90 backdrop-blur-md text-gray-900 rounded-2xl shadow-xl border border-white/50 hover:scale-110 active:scale-90 transition"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </motion.div>
          
          {product.images && product.images.length > 1 && (
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              {product.images.map((img: string, idx: number) => (
                <button 
                  key={idx}
                  onClick={() => setProduct({ ...product, image: img })}
                  className={`flex-shrink-0 w-24 h-24 rounded-3xl overflow-hidden border-2 transition-all p-1 ${product.image === img ? 'border-blue-600 scale-105 shadow-lg shadow-blue-500/10' : 'border-gray-50 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                >
                  {img ? (
                    <img src={img} alt="" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-2xl">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="flex flex-col pt-2 sm:pt-4">
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${product.stock === undefined || product.stock === null || Number(product.stock) > 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
               <span className={`w-2 h-2 rounded-full ${product.stock === undefined || product.stock === null || Number(product.stock) > 0 ? 'bg-blue-600 animate-pulse' : 'bg-red-600'}`}></span>
               <span className={`text-[10px] font-black uppercase tracking-widest ${product.stock === undefined || product.stock === null || Number(product.stock) > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                 {product.stock === undefined || product.stock === null || Number(product.stock) > 0 ? `متوفر بالمخزن ${product.stock !== undefined && product.stock !== null ? `(${product.stock} وحدة)` : '(كمية غير محدودة)'}` : 'نفدت الكمية'}
               </span>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 leading-[1.2]">{product.title}</h1>
          
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center bg-gray-100 px-4 py-2 rounded-2xl border border-gray-200">
               <div className="flex items-center text-yellow-500 ml-2">
                 {[...Array(5)].map((_, i) => (
                   <Star key={i} className={`w-4 h-4 ${i < Math.round(product.averageRating || 0) ? 'fill-current' : 'text-gray-300'}`} />
                 ))}
               </div>
               <span className="text-sm font-black text-black">
                 {product.averageRating ? product.averageRating.toFixed(1) : '0.0'}
               </span>
            </div>
            <div className="w-[1px] h-6 bg-gray-200"></div>
            <span className="text-sm font-black text-gray-800">
               {product.ratingCount || 0} تقييم حقيقي من عملاءنا
            </span>
          </div>
          
          <div className="bg-gray-50 rounded-[2.5rem] p-8 mb-10 border border-gray-100">
            <div className="flex flex-wrap items-end gap-3 mb-2">
              <span className="text-[10px] text-gray-900 font-black uppercase tracking-[0.2em] w-full mb-1">السعر النهائي للمنتج</span>
              <span className="text-5xl font-black text-blue-600 tracking-tight">
                {product.price.toLocaleString()}
              </span>
              <span className="text-lg font-black text-gray-900 mb-1.5 mr-0.5">ر.ي</span>
            </div>
            {product.deliveryFee > 0 && (
              <p className="text-xs text-green-700 font-black flex items-center gap-1.5">
                 <Truck className="w-3.5 h-3.5" />
                 + رسوم توصيل ذكية {product.deliveryFee} ريال فقط
              </p>
            )}
          </div>

          <div className="mb-12">
            <h4 className="text-black font-black text-lg mb-4 flex items-center gap-2">
               <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
               تفاصيل المنتج
            </h4>
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
               <p className="text-gray-900 text-sm leading-[1.8] font-bold whitespace-pre-wrap">{product.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
             <div className="flex items-center gap-4 p-5 bg-blue-50/50 rounded-[2rem] border border-blue-100/50 group hover:bg-blue-50 transition">
               <div className="bg-white p-3 rounded-2xl shadow-sm text-blue-600 group-hover:scale-110 transition">
                 <Truck className="w-6 h-6" />
               </div>
               <div>
                 <span className="block font-black text-gray-900 text-sm">توصيل وتوريد</span>
                 <span className="text-gray-900 text-[10px] font-black leading-tight">شحن آمن وسريع</span>
               </div>
             </div>
             <div className="flex items-center gap-4 p-5 bg-green-50/50 rounded-[2rem] border border-green-100/50 group hover:bg-green-50 transition">
               <div className="bg-white p-3 rounded-2xl shadow-sm text-green-600 group-hover:scale-110 transition">
                 <ShieldCheck className="w-6 h-6" />
               </div>
               <div>
                 <span className="block font-black text-gray-900 text-sm">ضمان المنصة</span>
                 <span className="text-gray-900 text-[10px] font-black leading-tight">حقك محفوظ 100%</span>
               </div>
             </div>
          </div>

          <div className="sticky bottom-4 sm:relative sm:bottom-0 z-40">
             <div className="bg-white/80 backdrop-blur-xl sm:bg-transparent p-4 sm:p-0 rounded-[2.5rem] shadow-2xl shadow-black/10 sm:shadow-none border border-gray-100 sm:border-0 flex flex-col gap-4">
                {product.externalLink ? (
                  <a 
                    href={product.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-black text-white py-6 rounded-[2rem] font-black transition shadow-2xl shadow-black/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 text-lg group"
                  >
                    <span>شراء عبر الرابط الخارجي</span>
                    <ArrowRight className="w-6 h-6 rotate-180 group-hover:translate-x-1 transition" />
                  </a>
                ) : (
                  <button 
                    onClick={() => {
                      if (!user) { login(); return; }
                      addToCart(product);
                      toast.success('تمت الإضافة للسلة');
                    }}
                    disabled={product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0}
                    className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black transition shadow-[0_20px_50px_-15px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 text-lg disabled:opacity-50 group"
                  >
                    <ShoppingCart className="w-6 h-6 group-hover:rotate-12 transition" />
                    <span>{product.stock === undefined || product.stock === null || Number(product.stock) > 0 ? (user ? 'أضف للسلة الآن' : 'سجل دخولك للشراء') : 'نفدت الكمية من المخزن'}</span>
                  </button>
                )}
                
                {product.ownerId && (
                   <Link to={`/contact?to=${product.ownerId}`} className="w-full bg-white text-gray-900 border-2 border-gray-100 py-5 rounded-[2rem] font-black text-center hover:bg-gray-50 transition flex items-center justify-center gap-2">
                      <MessageCircle className="w-5 h-5 text-green-500" />
                      مراسلة البائع فوراً
                   </Link>
                )}

                {/* Pre-Order / Reservation Card with Deposit - ONLY FOR TRUSTED / VERIFIED STORES */}
                {canPreOrder && (
                  <div className="bg-amber-50/70 dark:bg-amber-950/30 rounded-[2.5rem] p-6 border-2 border-amber-300 dark:border-amber-800/60 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                          <BookmarkCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-black text-base text-gray-900 dark:text-white">حجز مسبق مع دفع عربون</h4>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold">احجز السلعة باسمك لضمان عدم بيعها لغيرك</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-black px-3 py-1 rounded-full bg-amber-500 text-white shadow-sm">
                        متجر موثق ✓
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center bg-white/90 dark:bg-gray-800/90 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block mb-0.5">مبلغ العربون المطلوب</span>
                        <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                          {((product.depositAmount && Number(product.depositAmount) > 0) ? Number(product.depositAmount) : Math.max(1000, Math.round(Number(product.price) * 0.2))).toLocaleString()} ريال
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block mb-0.5">صلاحية مدة الحجز</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {product.reservationDurationDays || 3} أيام
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 space-y-1">
                      <p className="text-[11px] text-red-700 dark:text-red-400 font-black leading-relaxed">
                        ⚠️ شرط الحجز المعتمد:
                      </p>
                      <p className="text-[10px] text-red-800 dark:text-red-300 font-bold leading-relaxed">
                        مالم يتم إتمام شراء السلعة وسداد باقي المبلغ قبل انتهاء مدة الحجز ({product.reservationDurationDays || 3} أيام)، يعتبر الحجز لاغياً تلقائياً ويذهب مبلغ العربون للمتجر تعويضاً عن فوات فرصة البيع.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!user) { login(); return; }
                        setShowPreOrderModal(true);
                      }}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-amber-600/25 active:scale-95 transition flex items-center justify-center gap-2"
                    >
                      <BookmarkCheck className="w-5 h-5" />
                      <span>حجز مسبق للسلعة الآن</span>
                    </button>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Pre-Order Modal */}
      {showPreOrderModal && (
        <PreOrderModal
          product={product}
          isOpen={showPreOrderModal}
          onClose={() => setShowPreOrderModal(false)}
        />
      )}

      {/* Reviews Section */}
      <div className="mt-32 border-t border-gray-50 pt-20">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-4xl font-black text-gray-900 mb-4">آراء العملاء الحقيقية</h2>
          <p className="text-gray-900 font-black uppercase tracking-widest text-xs">ثقة عملاءنا هي سر نجاحنا</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Post Review Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-50 shadow-2xl shadow-black/5 sticky top-28">
              <h3 className="font-black text-xl mb-8 text-gray-900">أضف تقييمك</h3>
              {user ? (
                <form onSubmit={handleSubmitReview} className="space-y-8">
                  <div className="text-center">
                    <label className="block text-[10px] font-black text-gray-400 mb-6 uppercase tracking-widest">اختر عدد النجوم</label>
                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setNewRating(num)}
                          className="focus:outline-none transition transform hover:scale-125 hover:rotate-6"
                        >
                          <Star 
                            className={`w-10 h-10 transition-all ${num <= newRating ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg' : 'text-gray-100'}`} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest text-right">تعليقك يهمنا</label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="كيف كانت تجربتك مع هذا المنتج؟"
                      className="w-full bg-gray-50 border-none rounded-3xl p-6 text-sm font-medium focus:ring-4 focus:ring-blue-100 outline-none transition h-40 resize-none text-right placeholder:text-gray-300"
                      dir="rtl"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full bg-black text-white py-5 rounded-[1.75rem] font-black flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition shadow-2xl shadow-black/10 disabled:opacity-50"
                  >
                    {submittingReview ? 'جاري الإرسال...' : (
                      <>
                        <span>إرسال التقييم</span>
                        <Send className="w-4 h-4 rotate-180" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-3xl">
                  <User className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 text-sm font-bold mb-6">سجل دخولك لتتمكن من التقييم</p>
                  <button 
                    onClick={login}
                    className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-500/20"
                  >
                    دخول المنصة
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-2 space-y-8">
            {reviews.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-black/5">
                  <Star className="w-10 h-10 text-gray-100" />
                </div>
                <h4 className="text-xl font-black text-gray-900 mb-2">كن أنت البطل</h4>
                <p className="text-gray-400 font-bold">لا توجد تقييمات لهذا المنتج بعد، كن أول من يضع بصمته</p>
              </div>
            ) : (
              reviews.map((review) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={review.id} 
                  className="bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-black/10 transition-all duration-500 group"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100 group-hover:rotate-3 transition">
                        {review.userPhoto ? <img src={review.userPhoto} className="w-full h-full object-cover" /> : <User className="w-7 h-7" />}
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900 text-base">{review.userName}</h4>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(review.createdAt).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-400/10 px-4 py-2 rounded-2xl">
                       <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                       <span className="text-sm font-black text-yellow-600">{review.rating}.0</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute -right-4 top-0 w-1 h-full bg-blue-100 rounded-full group-hover:bg-blue-600 transition"></div>
                    <p className="text-gray-600 text-base leading-[1.8] font-medium whitespace-pre-wrap pr-4">{review.comment}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
