import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { CheckCircle, ShoppingCart, ArrowRight, Store as StoreIcon, Phone, MessageCircle, MessageSquare, Instagram, ExternalLink, X, Music, Edit, Star, ShieldCheck, ThumbsUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

export default function StoreProfile() {
  const userId = useParams().userId;
  const { getThemeClasses, addToCart, user, userData, isAdmin, login, settings } = useAppContext();
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinks, setShowLinks] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  
  const [userRating, setUserRating] = useState(10);
  const [userCredibility, setUserCredibility] = useState(10);
  const [userComment, setUserComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratings, setRatings] = useState<any[]>([]);
  
  const isOnline = profile?.lastSeen && (new Date().getTime() - new Date(profile.lastSeen).getTime()) < 75000;
  const isVerified = Boolean(profile?.verified) && (!profile?.verifiedUntil || profile?.verifiedUntil === '' || new Date(profile.verifiedUntil).getTime() >= Date.now());

  useEffect(() => {
    const fetchStoreData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        // Fetch Profile
        const profileSnap = await getDoc(doc(db, 'storeProfiles', userId));
        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        } else if (user) {
          // Fallback if no specific profile exists yet - only attempt if signed in
          try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
              setProfile({
                name: userSnap.data().name,
                logoUrl: userSnap.data().photoURL,
                userId: userId,
                verified: userSnap.data().role === 'store'
              });
            }
          } catch (err) {
            console.warn("Could not fetch fallback user profile:", err);
          }
        }

        // Fetch Products
        const q = query(collection(db, 'products'), where('ownerId', '==', userId));
        const pSnap = await getDocs(q);
        setProducts(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Ratings
        const rq = query(collection(db, 'ratings'), where('storeId', '==', userId));
        const rSnap = await getDocs(rq);
        setRatings(rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [userId]);

   const handleRatingSubmit = async () => {
    if (!user || !userId) return;
    if (user.uid === userId) {
      toast.error("لا يمكنك تقييم متجرك الخاص");
      return;
    }

    setIsSubmittingRating(true);
    try {
      const ratingData = {
        storeId: userId,
        userId: user.uid,
        userName: userData?.name || user.displayName || 'مستخدم',
        rating: userRating,
        credibility: userCredibility,
        comment: userComment,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'ratings'), ratingData);
      
      // Update store profile stats
      const newRatingCount = (profile.ratingCount || 0) + 1;
      const newAverageRating = ((profile.averageRating || 0) * (profile.ratingCount || 0) + userRating) / newRatingCount;
      const newAverageCredibility = ((profile.averageCredibility || 0) * (profile.ratingCount || 0) + userCredibility) / newRatingCount;

      // Only send the fields that the rules allow for customers (rating stats)
      await updateDoc(doc(db, 'storeProfiles', userId), {
        ratingCount: newRatingCount,
        averageRating: newAverageRating,
        averageCredibility: newAverageCredibility,
        updatedAt: new Date().toISOString() // Include updatedAt for validation consistency
      });

      setProfile({
        ...profile,
        ratingCount: newRatingCount,
        averageRating: newAverageRating,
        averageCredibility: newAverageCredibility
      });

      setRatings([ratingData, ...ratings]);
      toast.success("شكراً لتقييمك!");
      setShowRatingModal(false);
      setUserComment('');
    } catch (e) {
      console.error(e);
      toast.error("فشل في إرسال التقييم");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600`}></div>
    </div>
  );

  if (!profile) return (
    <div className="text-center py-20 bg-gray-50 min-h-screen flex flex-col items-center justify-center">
      <StoreIcon className="w-20 h-20 text-gray-200 mb-6" />
      <h2 className="text-3xl font-black text-gray-900 mb-4">المتجر غير موجود</h2>
      <Link to="/" className="text-blue-600 font-bold hover:underline">العودة للرئيسية</Link>
    </div>
  );

  return (
    <div className="space-y-12 pb-32 bg-white font-sans min-h-screen">
      {/* Store Hero / Banner */}
      <div className="relative h-[250px] md:h-[400px] sm:rounded-[3.5rem] overflow-hidden shadow-2xl shadow-black/5 mx-0 sm:mx-4 mt-2">
         {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt={profile.name} className="w-full h-full object-cover" />
         ) : (
            <div className="w-full h-full bg-gray-50 flex items-center justify-center">
               <StoreIcon className="w-20 h-20 text-gray-200" />
            </div>
         )}
         
         {/* Premium Overlay */}
         <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent md:bg-gradient-to-l md:from-white md:via-white/20"></div>
         
         <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-16">
            <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-8" dir="rtl">
               <motion.div 
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="flex items-center gap-6"
               >
                  <div className="w-24 h-24 md:w-36 md:h-36 rounded-[2.5rem] bg-white p-1.5 shadow-2xl border border-gray-50 relative group">
                    <div className="w-full h-full rounded-[2.25rem] overflow-hidden">
                      {profile.logoUrl ? (
                        <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-3xl font-black">
                          {profile.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    {isOnline && (
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 md:w-8 md:h-8 bg-green-500 rounded-2xl border-4 border-white shadow-lg animate-pulse"></div>
                    )}
                  </div>
                  
              <div className="flex flex-col gap-2">
                     <div className="flex items-center gap-3">
                        <h1 className="text-3xl md:text-5xl font-black text-black drop-shadow-sm">{profile.name}</h1>
                        {isVerified && <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-blue-500 fill-white" title="متجر موثق ومعتمد رسمياً" />}
                     </div>
                     <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isOnline ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-gray-200 text-gray-700'}`}>
                           {isOnline ? 'متصل الآن' : 'غير متصل'}
                        </span>
                        {profile.lastSeen && !isOnline && (
                           <span className="text-[10px] text-gray-800 font-black tracking-tight">آخر تواجد {new Date(profile.lastSeen).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                     </div>
                  </div>
               </motion.div>

               <motion.div
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: -20 }}
                 className="hidden md:block max-w-sm"
               >
                  <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2rem] p-6 shadow-2xl shadow-black/5">
                    <p className="text-black font-black leading-relaxed text-right">
                      {profile.description || 'أهلاً بكم في متجري الموثق، أتمنى لكم تجربة تسوق ممتعة.'}
                    </p>
                  </div>
               </motion.div>
            </div>
         </div>
      </div>

      {/* The Action Strip */}
      <div className="sticky top-[70px] z-40 bg-white/80 backdrop-blur-xl border-b border-gray-50 py-4 shadow-sm mx-4 sm:rounded-3xl border-x">
         <div className="max-w-7xl mx-auto px-6 overflow-x-auto no-scrollbar">
            <div className="flex flex-row items-center justify-center md:justify-start gap-4 min-w-max" dir="rtl">
               <button 
                  onClick={() => user ? setShowRatingModal(true) : login()}
                  className="flex items-center gap-2 bg-yellow-400 text-black px-8 py-3 rounded-2xl text-xs font-black hover:bg-yellow-500 transition shadow-xl shadow-yellow-400/20 active:scale-95 border-2 border-white"
               >
                  <Star className="w-4 h-4 fill-black" />
                  تقديم تقييم
               </button>

               <Link 
                  to={`/contact?to=${userId}`}
                  className="flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-2xl text-xs font-black hover:bg-black transition shadow-xl shadow-black/10 active:scale-95"
               >
                  <MessageSquare className="w-4 h-4" />
                  مراسلة فورية
               </Link>

               {(isAdmin || user?.uid === userId) && (
                  <Link 
                     to={isAdmin ? `/admin?tab=store-profile&editStoreId=${userId}` : "/admin?tab=store-profile"}
                     className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl text-xs font-black hover:bg-blue-700 transition shadow-xl shadow-blue-600/20 active:scale-95"
                  >
                     <Edit className="w-4 h-4" />
                     إدارة المتجر
                  </Link>
               )}

               {(profile?.whatsapp || profile?.tiktok || profile?.instagram) && (
                  <button 
                     onClick={() => setShowLinks(true)}
                     className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-2xl text-xs font-black hover:bg-green-700 transition shadow-xl shadow-green-600/20 active:scale-95"
                  >
                     <Phone className="w-4 h-4" />
                     روابط التواصل
                  </button>
               )}
            </div>
         </div>
      </div>

      {/* Store Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2" dir="rtl">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-2">
           <div className="bg-yellow-50 p-3 rounded-2xl">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
           </div>
           <div className="text-2xl font-black text-gray-900">{(profile.averageRating || 0).toFixed(1)}/10</div>
           <div className="text-xs font-black text-gray-900 uppercase">تقييم المتجر</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-2">
           <div className="bg-blue-50 p-3 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
           </div>
           <div className="text-2xl font-black text-gray-900">{(profile.averageCredibility || 0).toFixed(1)}/10</div>
           <div className="text-xs font-black text-gray-900 uppercase">مصداقية المتجر</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-2">
           <div className="bg-green-50 p-3 rounded-2xl">
              <ThumbsUp className="w-6 h-6 text-green-600" />
           </div>
           <div className="text-2xl font-black text-gray-900">{profile.ratingCount || 0}</div>
           <div className="text-xs font-black text-gray-900 uppercase">إجمالي المقيمين</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-2">
           <div className="bg-purple-50 p-3 rounded-2xl">
              <StoreIcon className="w-6 h-6 text-purple-600" />
           </div>
           <div className="text-2xl font-black text-gray-900">{products.length}</div>
           <div className="text-xs font-black text-gray-900 uppercase">منتجات معروضة</div>
        </div>
      </div>

       {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setShowRatingModal(false)}>
            <motion.div 
               initial={{ y: 50, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 50, opacity: 0 }}
               className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl relative overflow-hidden flex flex-col"
               onClick={e => e.stopPropagation()}
               dir="rtl"
            >
               <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                     <div className="bg-yellow-50 p-2.5 rounded-2xl">
                        <Star className="w-6 h-6 text-yellow-600 fill-yellow-600" />
                     </div>
                     <h3 className="text-2xl font-black text-gray-900">تقييم المتجر والمصداقية</h3>
                  </div>
                  <button onClick={() => setShowRatingModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-gray-200 transition">
                     <X className="w-5 h-5" />
                  </button>
               </div>

               <div className="space-y-8 flex-1">
                  <div className="space-y-4">
                     <div className="flex justify-between items-end">
                        <label className="text-sm font-black text-gray-900 uppercase tracking-wider">تقييم المتجر العام</label>
                        <span className="text-3xl font-black text-yellow-600">{userRating}<span className="text-sm text-gray-300">/10</span></span>
                     </div>
                     <div className="flex gap-1.5 justify-between">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                           <button
                              key={star}
                              onClick={() => setUserRating(star)}
                              className={`flex-1 aspect-square rounded-xl transition-all transform active:scale-75 ${
                                 userRating >= star ? 'bg-yellow-500 scale-110 shadow-lg shadow-yellow-100' : 'bg-gray-100 opacity-40 grayscale'
                              }`}
                           >
                              <Star className={`w-full h-full p-1.5 ${userRating >= star ? 'text-white fill-white' : 'text-gray-400'}`} />
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex justify-between items-end">
                        <label className="text-sm font-black text-gray-900 uppercase tracking-wider">مصداقية التعامل</label>
                        <span className="text-3xl font-black text-blue-600">{userCredibility}<span className="text-sm text-gray-300">/10</span></span>
                     </div>
                     <div className="flex gap-1.5 justify-between">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                           <button
                              key={star}
                              onClick={() => setUserCredibility(star)}
                              className={`flex-1 aspect-square rounded-xl transition-all transform active:scale-75 ${
                                 userCredibility >= star ? 'bg-blue-600 scale-110 shadow-lg shadow-blue-100' : 'bg-gray-100 opacity-40 grayscale'
                              }`}
                           >
                              <ShieldCheck className={`w-full h-full p-1.5 ${userCredibility >= star ? 'text-white' : 'text-gray-400'}`} />
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-3">
                     <label className="text-sm font-black text-gray-900 uppercase tracking-wider pb-2">رأيك الشخصي (اختياري)</label>
                     <textarea
                        value={userComment}
                        onChange={(e) => setUserComment(e.target.value)}
                        placeholder="اكتب تجربتك مع هذا المتجر..."
                        className="w-full h-24 bg-gray-50 border-2 border-gray-100 rounded-3xl p-4 outline-none focus:border-blue-500 transition-all text-sm resize-none"
                     ></textarea>
                  </div>
               </div>

               <div className="mt-8">
                  <button 
                     onClick={handleRatingSubmit}
                     disabled={isSubmittingRating}
                     className="w-full bg-black text-white py-5 rounded-[1.5rem] font-black shadow-2xl hover:scale-[1.02] active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                     {isSubmittingRating ? (
                        <>
                           <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                           <span>جاري الإرسال...</span>
                        </>
                     ) : (
                        <>
                           <Star className="w-5 h-5 fill-white" />
                           <span>تقديم التقييم</span>
                        </>
                     )}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Social Links Modal */}
      <AnimatePresence>
        {showLinks && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowLinks(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 ${getThemeClasses('bg')} opacity-5 rounded-bl-full -mr-16 -mt-16`}></div>
              
              <div className="flex justify-between items-center relative z-10">
                <h3 className="text-xl font-bold flex items-center gap-2 text-right w-full" dir="rtl">
                   <StoreIcon className={`w-6 h-6 ${getThemeClasses('text')}`} />
                   روابط المتجر
                </h3>
                <button onClick={() => setShowLinks(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 relative z-10" dir="rtl">
                {profile.whatsapp && (
                  <a 
                    href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 transition border border-green-100 group"
                  >
                    <div className="flex items-center gap-3">
                       <MessageCircle className="w-6 h-6" />
                       <span className="font-bold">واتساب المتجر</span>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-40 group-hover:opacity-100 transition" />
                  </a>
                )}
                {profile.tiktok && (
                  <a 
                    href={profile.tiktok.startsWith('http') ? profile.tiktok : `https://tiktok.com/@${profile.tiktok}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-black text-white rounded-2xl hover:bg-gray-900 transition group"
                  >
                    <div className="flex items-center gap-3">
                       <Music className="w-6 h-6" />
                       <span className="font-bold">تيك توك</span>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-40 group-hover:opacity-100 transition" />
                  </a>
                )}
                {profile.instagram && (
                  <a 
                    href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white rounded-2xl hover:brightness-110 transition group"
                  >
                    <div className="flex items-center gap-3">
                       <Instagram className="w-6 h-6" />
                       <span className="font-bold">انستقرام</span>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-40 group-hover:opacity-100 transition" />
                  </a>
                )}
              </div>

              <p className="text-[10px] text-gray-400 text-center relative z-10 italic">
                هذه الروابط تتبع إدارة المتجر بشكل مباشر
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ratings List */}
      {ratings.length > 0 && (
         <div className="space-y-6" dir="rtl">
            <div className="flex items-center gap-3 px-2">
               <h2 className="text-2xl font-black text-gray-900 border-r-4 border-blue-500 pr-4">تعليقات المشتريين</h2>
            </div>
            
            <div className="flex overflow-x-auto pb-6 gap-6 px-2 scrollbar-hide">
               {ratings.map((r, i) => (
                  <motion.div 
                     key={i} 
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: i * 0.1 }}
                     className="min-w-[300px] md:min-w-[400px] bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4"
                  >
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                           <div className={`w-12 h-12 rounded-2xl ${getThemeClasses('bg')} text-white flex items-center justify-center font-black text-xl shadow-lg`}>
                              {r.userName?.charAt(0) || 'U'}
                           </div>
                           <div>
                              <h4 className="font-black text-gray-900">{r.userName}</h4>
                              <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</p>
                           </div>
                        </div>
                        <div className="bg-yellow-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-yellow-100 shadow-sm">
                           <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                           <span className="text-xs font-black text-yellow-700">{r.rating}</span>
                        </div>
                     </div>
                     
                     <div className="flex gap-4">
                        <div className="flex-1 space-y-1">
                           <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest bg-gray-50 p-1 px-2 rounded-lg inline-block">التقييم</p>
                           <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-500 rounded-full shadow-sm" style={{ width: `${r.rating * 10}%` }}></div>
                           </div>
                        </div>
                        <div className="flex-1 space-y-1">
                           <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest bg-gray-50 p-1 px-2 rounded-lg inline-block">المصداقية</p>
                           <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full shadow-sm" style={{ width: `${r.credibility * 10}%` }}></div>
                           </div>
                        </div>
                     </div>

                     {r.comment && (
                        <div className="bg-gray-50/50 p-4 rounded-2xl border-r-4 border-blue-500 italic text-gray-900 font-bold text-sm leading-relaxed">
                           "{r.comment}"
                        </div>
                     )}
                  </motion.div>
               ))}
            </div>
         </div>
      )}

      {/* Products Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            منتجات المتجر
            <span className="text-sm bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{products.length}</span>
          </h2>
          <Link to="/" className="text-sm text-gray-500 flex items-center gap-1 hover:text-gray-900 transition font-medium">
             المزيد من المتاجر <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
             <StoreIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
             <p className="text-gray-500 font-medium">لا توجد منتجات معروضة حالياً لهذا المتجر.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 px-4">
            {products.map((product) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] border border-gray-50 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-black/5 transition duration-500 group flex flex-col h-full relative"
              >
                 <div className="aspect-[4/5] relative overflow-hidden bg-gray-50 p-2">
                   <div className="w-full h-full rounded-[2rem] overflow-hidden">
                     <img 
                       src={product.image || (product.images && product.images[0])} 
                       alt={product.title} 
                       className="w-full h-full object-cover group-hover:scale-110 transition duration-700" 
                     />
                   </div>
                   
                   {!product.available && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-8 text-center">
                      <span className="text-gray-900 font-black text-sm border-2 border-gray-900 px-6 py-2 rounded-2xl rotate-[-12deg]">نفذت الكمية</span>
                    </div>
                  )}

                   <div className="absolute top-4 right-4 z-10">
                      <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl text-[10px] font-black text-gray-900 shadow-sm border border-white/50">
                         {product.category}
                      </div>
                   </div>

                   <button 
                     onClick={(e) => {
                       e.preventDefault();
                       e.stopPropagation();
                       addToCart(product);
                       toast.success('تم إضافة المنتج للسلة');
                     }}
                     className="absolute bottom-6 left-6 right-6 bg-white text-gray-900 py-3.5 rounded-2xl font-black text-xs shadow-2xl shadow-black/20 transform translate-y-20 group-hover:translate-y-0 transition-all duration-500 flex items-center justify-center gap-2 hover:bg-gray-50"
                   >
                     <ShoppingCart className="h-4 w-4" />
                     أضف للسلة
                   </button>
                 </div>

                 <div className="p-6 pt-2 flex flex-col flex-1">
                   <Link to={`/product/${product.id}`} className="block">
                     <h3 className="font-black text-black group-hover:text-blue-600 transition-colors line-clamp-1 mb-2 text-lg">{product.title}</h3>
                   </Link>
                   <p className="text-xs text-gray-800 mb-6 line-clamp-2 leading-relaxed font-bold">{product.description}</p>
                   <div className="mt-auto flex items-center justify-between gap-2">
                     <div className="flex flex-col">
                       <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">السعر الحالي</span>
                       <span className="text-xl font-black text-blue-600">
                         {product.price.toLocaleString()} <span className="text-xs font-black text-gray-500 mr-0.5">ر.ي</span>
                       </span>
                     </div>
                   </div>
                 </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
