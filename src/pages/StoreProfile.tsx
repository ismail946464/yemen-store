import { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { formatArabicDate, formatArabicTime, safeCopyText } from '../lib/deviceSafe';
import {
  CheckCircle,
  ShoppingCart,
  ArrowRight,
  Store as StoreIcon,
  Phone,
  MessageCircle,
  MessageSquare,
  Instagram,
  ExternalLink,
  X,
  Music,
  Edit,
  Star,
  ShieldCheck,
  BookmarkCheck,
  ShoppingBag,
  Loader2,
  Layers,
  MapPin,
  Clock,
  Navigation,
  Heart,
  Eye,
  Search,
  Megaphone,
  UserPlus,
  UserCheck,
  Share2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { isProductOfferActive, getProductOfferBadgeText } from '../lib/offerUtils';
import { getAvailableProductVariants, buildBaseProductForCart } from '../lib/variantUtils';
import { getStockLimit, isItemOutOfStock, calculateSafeDeposit } from '../lib/stockUtils';
import ProductPublisherMiniCard from '../components/ProductPublisherMiniCard';
import { ProductGridSkeleton } from '../components/Skeletons';
import { StoreCategoryItem, sortStoreCategories, getAssignedStoreCategories } from '../lib/storeCategories';
import { resolveStoreAccent, StoreLayoutStyleId } from '../lib/storeStyles';

const PreOrderModal = lazy(() => import('../components/PreOrderModal'));
const ProductVariantsModal = lazy(() => import('../components/ProductVariantsModal'));
const QuickViewModal = lazy(() => import('../components/QuickViewModal'));

function StoreProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-500">
        <ShoppingBag className="w-9 h-9 stroke-[1.5]" />
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
      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
    />
  );
}

export default function StoreProfile() {
  const userId = useParams().userId;
  const navigate = useNavigate();
  const {
    getThemeClasses,
    addToCart,
    cart,
    user,
    userData,
    isAdmin,
    login,
    isFavorite,
    toggleFavorite,
    recordRecentlyViewed,
    toggleFollowStore,
    isFollowingStore,
  } = useAppContext();
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreOrderProduct, setSelectedPreOrderProduct] = useState<any | null>(null);
  const [variantsModalProduct, setVariantsModalProduct] = useState<any | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const [storeSearch, setStoreSearch] = useState('');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState('الكل');
  const [storeSortBy, setStoreSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'offers'>('newest');

  const [userRating, setUserRating] = useState(10);
  const [userCredibility, setUserCredibility] = useState(10);
  const [userComment, setUserComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratings, setRatings] = useState<any[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategoryItem[]>([]);

  const isOnline = profile?.lastSeen && (new Date().getTime() - new Date(profile.lastSeen).getTime()) < 75000;
  const isVerified = Boolean(profile?.verified) && (!profile?.verifiedUntil || profile?.verifiedUntil === '' || new Date(profile.verifiedUntil).getTime() >= Date.now());
  const storeAccent = useMemo(
    () => resolveStoreAccent(profile?.themeColor, getThemeClasses),
    [profile?.themeColor, getThemeClasses]
  );
  const layoutStyle = (profile?.storeStyle || 'classic') as StoreLayoutStyleId;

  const productCategoriesInStore = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(String(p.category));
    });
    return ['الكل', ...Array.from(cats)];
  }, [products]);

  const filteredStoreProducts = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    return products
      .filter((p) => {
        if (storeCategoryFilter !== 'الكل' && p.category !== storeCategoryFilter) return false;
        if (storeSortBy === 'offers' && !isProductOfferActive(p)) return false;
        if (q) {
          const hay = `${p.title || ''} ${p.description || ''} ${p.category || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (storeSortBy === 'price-asc') return Number(a.price || 0) - Number(b.price || 0);
        if (storeSortBy === 'price-desc') return Number(b.price || 0) - Number(a.price || 0);
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
  }, [products, storeSearch, storeCategoryFilter, storeSortBy]);

  useEffect(() => {
    const fetchStoreData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const [profileSnap, pSnap, rSnap, scSnap] = await Promise.all([
          getDoc(doc(db, 'storeProfiles', userId)),
          getDocs(query(collection(db, 'products'), where('ownerId', '==', userId))),
          getDocs(query(collection(db, 'ratings'), where('storeId', '==', userId))),
          getDocs(collection(db, 'storeCategories')),
        ]);
        setStoreCategories(
          sortStoreCategories(scSnap.docs.map(d => ({ id: d.id, ...d.data() })) as StoreCategoryItem[])
        );

        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        } else if (user) {
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

        setProducts(
          pSnap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .filter((p: any) => p.status === 'active')
        );
        setRatings(rSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [userId, user]);

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

      const prevCount = profile?.ratingCount || 0;
      const prevRating = profile?.averageRating || 0;
      const prevCred = profile?.averageCredibility || 0;
      const newRatingCount = prevCount + 1;
      const newAverageRating = (prevRating * prevCount + userRating) / newRatingCount;
      const newAverageCredibility = (prevCred * prevCount + userCredibility) / newRatingCount;

      await setDoc(doc(db, 'storeProfiles', userId), {
        userId,
        name: String(profile?.name || 'متجر'),
        logoUrl: String(profile?.logoUrl || ''),
        verified: Boolean(profile?.verified),
        ratingCount: newRatingCount,
        averageRating: newAverageRating,
        averageCredibility: newAverageCredibility,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setProfile({
        ...(profile || {}),
        userId,
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

  if (loading) {
    return (
      <div className="space-y-8" dir="rtl">
        <div className="h-56 sm:h-72 rounded-lg skeleton-shimmer" />
        <div className="h-24 rounded-lg skeleton-shimmer" />
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 text-center rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-4" dir="rtl">
        <div className="w-14 h-14 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] mx-auto flex items-center justify-center text-[#5C5B57] dark:text-zinc-400">
          <StoreIcon className="w-7 h-7" />
        </div>
        <h2 className="font-display text-xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">المتجر غير موجود</h2>
        <p className="text-sm text-[#5C5B57] dark:text-zinc-400">تعذر العثور على بيانات هذا المتجر حالياً.</p>
        <Link
          to="/"
          className={`inline-flex items-center gap-2 min-h-[42px] px-6 py-2.5 rounded-lg font-bold text-sm ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
        >
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-16 space-y-8" dir="rtl">
      {/* Custom Store Announcement Strip */}
      {profile.storeAnnouncement && String(profile.storeAnnouncement).trim() && (
        <div className={`rounded-lg border px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm font-bold ${storeAccent.border || 'border-[#E5E2DA] dark:border-[#232730]'} bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2]`}>
          <Megaphone className={`w-4 h-4 shrink-0 ${storeAccent.text}`} />
          <p className="leading-relaxed">{profile.storeAnnouncement}</p>
        </div>
      )}

      {/* Boutique Store Identity Header (supports 4 store layout styles) */}
      <section className={`rounded-lg border overflow-hidden ${
        layoutStyle === 'showcase'
          ? 'border-zinc-800 bg-[#111214] text-white'
          : 'border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]'
      }`}>
        {layoutStyle !== 'compact' && (
          <div className={`relative ${
            layoutStyle === 'showcase'
              ? 'h-52 sm:h-72 bg-zinc-900'
              : layoutStyle === 'editorial'
                ? 'h-36 sm:h-48 bg-[#EFEDE6] dark:bg-[#1C1F26]'
                : 'h-44 sm:h-60 bg-[#EFEDE6] dark:bg-[#1C1F26]'
          } overflow-hidden`}>
            {profile.bannerUrl ? (
              <img
                src={profile.bannerUrl}
                alt={profile.name}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#5C5B57] dark:text-zinc-600">
                <StoreIcon className="w-14 h-14 stroke-[1.25] opacity-40" />
              </div>
            )}
            <div className={`absolute inset-0 ${
              layoutStyle === 'showcase'
                ? 'bg-gradient-to-t from-[#111214] via-black/45 to-transparent'
                : 'bg-gradient-to-t from-black/45 via-transparent to-transparent'
            }`} />
          </div>
        )}

        <div className={`px-5 sm:px-8 pb-6 ${layoutStyle === 'compact' ? 'pt-6' : ''}`}>
          <div className={`flex flex-col ${
            layoutStyle === 'editorial'
              ? 'items-center text-center -mt-12'
              : layoutStyle === 'compact'
                ? 'md:flex-row md:items-center justify-between'
                : 'md:flex-row md:items-end justify-between -mt-12'
          } gap-5 relative z-10`}>
            <div className={`flex ${
              layoutStyle === 'editorial'
                ? 'flex-col items-center gap-3'
                : 'items-end gap-4'
            }`}>
              <div className={`${
                layoutStyle === 'compact' ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-22 h-22 sm:w-26 sm:h-26'
              } rounded-lg p-1 border shrink-0 ${
                layoutStyle === 'showcase'
                  ? 'bg-[#181B20] border-zinc-700'
                  : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730]'
              }`}>
                <div className="w-full h-full rounded-md overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] flex items-center justify-center">
                  {profile.logoUrl ? (
                    <img src={profile.logoUrl} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className={`w-full h-full flex items-center justify-center ${storeAccent.bg} text-2xl font-extrabold`}>
                      {profile.name?.charAt(0) || 'م'}
                    </span>
                  )}
                </div>
              </div>

              <div className="pb-1 space-y-1">
                <div className={`flex items-center gap-2 flex-wrap ${layoutStyle === 'editorial' ? 'justify-center' : ''}`}>
                  <h1 className={`${
                    layoutStyle === 'editorial' ? 'font-amiri text-3xl sm:text-4xl' : 'font-display text-2xl sm:text-3xl'
                  } font-extrabold tracking-tight ${
                    layoutStyle === 'showcase' ? 'text-white' : 'text-[#111214] dark:text-[#F4F4F2]'
                  }`}>
                    {profile.name}
                  </h1>
                  {isVerified && (
                    <span title="متجر موثق ومعتمد رسمياً" className="inline-flex items-center">
                      <CheckCircle className={`w-5 h-5 ${storeAccent.verified}`} />
                    </span>
                  )}
                </div>

                {/* Unboxed typographic status metadata */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-[#5C5B57] dark:text-zinc-400">
                  <span className={isOnline ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-medium'}>
                    {isOnline ? 'متصل الآن' : 'غير متصل'}
                  </span>
                  {profile.lastSeen && !isOnline && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        آخر تواجد {formatArabicTime(profile.lastSeen)}
                      </span>
                    </>
                  )}
                </div>

                {(() => {
                  const assignedCats = getAssignedStoreCategories(profile, storeCategories);
                  if (assignedCats.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {assignedCats.map((cat) => (
                        <span
                          key={cat.id}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded bg-[#FAF9F6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-zinc-200"
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {userId && user?.uid !== userId && (
                <button
                  type="button"
                  onClick={() => toggleFollowStore(userId, profile?.name)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors min-h-[44px] ${
                    isFollowingStore(userId)
                      ? `${storeAccent.bg} ${storeAccent.hover}`
                      : 'border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-[#111214] dark:text-[#F4F4F2]'
                  }`}
                >
                  {isFollowingStore(userId) ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  <span>{isFollowingStore(userId) ? 'تتابع المتجر' : 'متابعة المتجر'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  const ok = await safeCopyText(window.location.href);
                  if (ok) toast.success('تم نسخ رابط المتجر للمشاركة');
                }}
                aria-label="مشاركة رابط المتجر"
                title="نسخ رابط المتجر"
                className="flex items-center justify-center border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-[#111214] dark:text-[#F4F4F2] w-11 h-11 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => (user ? setShowRatingModal(true) : login())}
                className="flex items-center gap-1.5 border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-[#111214] dark:text-[#F4F4F2] px-4 py-2.5 rounded-lg text-xs font-bold transition-colors min-h-[44px]"
              >
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                <span>تقديم تقييم</span>
              </button>

              {user?.uid !== userId && (
                <Link
                  to={`/contact?to=${userId}`}
                  className="flex items-center gap-1.5 bg-[#111214] dark:bg-[#F4F4F2] hover:bg-[#24262B] dark:hover:bg-[#E4E4E0] text-white dark:text-[#111214] px-4 py-2.5 rounded-lg text-xs font-bold transition-colors min-h-[44px]"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>مراسلة فورية</span>
                </Link>
              )}

              {(isAdmin || user?.uid === userId) && (
                <Link
                  to={isAdmin ? `/admin?tab=store-profile&editStoreId=${userId}` : "/admin?tab=store-profile"}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors min-h-[44px] ${storeAccent.bg} ${storeAccent.hover}`}
                >
                  <Edit className="w-4 h-4" />
                  <span>إدارة المتجر</span>
                </Link>
              )}

              {(profile?.whatsapp || profile?.tiktok || profile?.instagram) && (
                <button
                  type="button"
                  onClick={() => setShowLinks(true)}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors min-h-[44px]"
                >
                  <Phone className="w-4 h-4" />
                  <span>روابط التواصل</span>
                </button>
              )}
            </div>
          </div>

          <p className="mt-5 pt-4 border-t border-[#E5E2DA] dark:border-[#232730] text-sm text-[#5C5B57] dark:text-zinc-300 leading-relaxed max-w-3xl">
            {profile.description || (isVerified
              ? 'متجر موثق ومعتمد يقدم منتجات متنوعة مع خدمة التواصل المباشر والطلب السريع.'
              : 'متجر مسجل يقدم منتجات متنوعة مع خدمة التواصل المباشر.')}
          </p>

          {(() => {
            const fullAddress = [profile.city, profile.district, profile.address]
              .map((v: any) => String(v || '').trim())
              .filter(Boolean)
              .join(' — ');
            const landmark = String(profile.landmark || '').trim();
            const workingHours = String(profile.workingHours || '').trim();
            const storePhone = String(profile.phone || '').trim();
            const lat = profile.location?.lat ?? profile.coordinates?.lat;
            const lng = profile.location?.lng ?? profile.coordinates?.lng;
            const rawMapUrl = String(profile.googleMapsUrl || '').trim();
            const safeMapUrl = rawMapUrl && /^https?:\/\//i.test(rawMapUrl) ? rawMapUrl : '';
            const mapHref = safeMapUrl || (lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : '');

            if (!fullAddress && !landmark && !workingHours && !storePhone && !mapHref) return null;

            return (
              <div className="mt-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2]">
                    <MapPin className={`w-4 h-4 shrink-0 ${getThemeClasses('text')}`} />
                    <span>العنوان الفعلي للمتجر (في الواقع)</span>
                  </div>
                  {mapHref && (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] hover:opacity-90 text-xs font-bold transition-opacity"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>فتح الموقع على الخريطة</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  )}
                </div>

                {fullAddress && (
                  <p className="text-xs sm:text-sm font-bold text-[#111214] dark:text-[#F4F4F2] leading-relaxed">
                    {fullAddress}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#5C5B57] dark:text-zinc-300">
                  {landmark && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0 opacity-75" />
                      <span>أقرب معلم: <strong className="text-[#111214] dark:text-[#F4F4F2]">{landmark}</strong></span>
                    </span>
                  )}
                  {workingHours && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0 opacity-75" />
                      <span>أوقات الدوام: <strong className="text-[#111214] dark:text-[#F4F4F2]">{workingHours}</strong></span>
                    </span>
                  )}
                  {storePhone && (
                    <a
                      href={`tel:${storePhone}`}
                      className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 hover:underline tabular-nums"
                      dir="ltr"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{storePhone}</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Single Horizontal 4-Cell KPI Ledger Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-t border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216]">
          <div className="p-4 sm:p-5 border-b md:border-b-0 border-e border-[#E5E2DA] dark:border-[#232730]">
            <span className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400 block mb-1">تقييم المتجر</span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
              {(profile.averageRating || 0).toFixed(1)}<span className="text-xs text-[#5C5B57] dark:text-zinc-500 font-bold">/10</span>
            </div>
          </div>
          <div className="p-4 sm:p-5 border-b md:border-b-0 md:border-e border-[#E5E2DA] dark:border-[#232730]">
            <span className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400 block mb-1">مصداقية التعامل</span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
              {(profile.averageCredibility || 0).toFixed(1)}<span className="text-xs text-[#5C5B57] dark:text-zinc-500 font-bold">/10</span>
            </div>
          </div>
          <div className="p-4 sm:p-5 border-e border-[#E5E2DA] dark:border-[#232730]">
            <span className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400 block mb-1">إجمالي المقيمين</span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
              {profile.ratingCount || 0}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <span className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400 block mb-1">المنتجات المعروضة</span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
              {products.length}
            </div>
          </div>
        </div>
      </section>

      {/* Customer Ratings */}
      {ratings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E2DA] dark:border-[#232730] pb-3">
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">
              آراء المشترين ({ratings.length})
            </h2>
          </div>

          <div className="flex overflow-x-auto pb-2 gap-4 no-scrollbar">
            {ratings.map((r, i) => (
              <div
                key={r.id || i}
                className="min-w-[280px] sm:min-w-[330px] p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-4 shrink-0"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${getThemeClasses('bg')} flex items-center justify-center font-extrabold text-sm shrink-0`}>
                      {r.userName?.charAt(0) || 'ع'}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">{r.userName}</h4>
                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                        {formatArabicDate(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{r.rating}/10</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[#5C5B57] dark:text-zinc-400 font-semibold">
                      <span>التقييم</span>
                      <span className="tabular-nums">{r.rating}/10</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#EFEDE6] dark:bg-[#1C1F26] rounded-sm overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${r.rating * 10}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[#5C5B57] dark:text-zinc-400 font-semibold">
                      <span>المصداقية</span>
                      <span className="tabular-nums">{r.credibility}/10</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#EFEDE6] dark:bg-[#1C1F26] rounded-sm overflow-hidden">
                      <div className="h-full bg-emerald-600" style={{ width: `${r.credibility * 10}%` }} />
                    </div>
                  </div>
                </div>

                {r.comment && (
                  <p className="pt-3 border-t border-[#E5E2DA] dark:border-[#232730] text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-300 leading-relaxed">
                    "{r.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Store Products */}
      <section className="space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-[#E5E2DA] dark:border-[#232730] pb-3">
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">
            منتجات المتجر ({filteredStoreProducts.length})
          </h2>
          <Link to="/search-stores" className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-300 flex items-center gap-1 hover:text-[#111214] dark:hover:text-white transition-colors font-bold">
            <span>دليل المتاجر</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

        {/* In-Store Search, Category & Sort Bar */}
        {products.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  placeholder={`ابحث داخل منتجات ${profile.name}...`}
                  className="w-full min-h-[42px] bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg pr-10 pl-8 py-2 text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 outline-none focus:border-[#111214] dark:focus:border-zinc-500 transition-colors"
                />
                {storeSearch && (
                  <button
                    type="button"
                    onClick={() => setStoreSearch('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5C5B57] hover:text-[#111214] dark:hover:text-white p-1"
                    aria-label="مسح البحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={storeSortBy}
                onChange={(e) => setStoreSortBy(e.target.value as any)}
                className="min-h-[42px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
              >
                <option value="newest">الأحدث</option>
                <option value="offers">العروض والخصومات فقط</option>
                <option value="price-asc">السعر: الأقل أولاً</option>
                <option value="price-desc">السعر: الأعلى أولاً</option>
              </select>
            </div>

            {productCategoriesInStore.length > 2 && (
              <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
                {productCategoriesInStore.map((catName) => {
                  const active = storeCategoryFilter === catName;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setStoreCategoryFilter(catName)}
                      className={`min-h-[34px] px-3 py-1 rounded-lg border text-xs font-bold whitespace-nowrap transition-colors ${
                        active
                          ? `${storeAccent.bg} border-transparent`
                          : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300 hover:text-[#111214] dark:hover:text-white'
                      }`}
                    >
                      {catName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {filteredStoreProducts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#131519] rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] space-y-2">
            <StoreIcon className="w-10 h-10 text-[#5C5B57] dark:text-zinc-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-[#5C5B57] dark:text-zinc-400 font-bold">
              {products.length === 0
                ? 'لا توجد منتجات معروضة حالياً لهذا المتجر.'
                : 'لا توجد منتجات مطابقة لخيارات البحث الحالية.'}
            </p>
            {(storeSearch || storeCategoryFilter !== 'الكل' || storeSortBy !== 'newest') && (
              <button
                type="button"
                onClick={() => {
                  setStoreSearch('');
                  setStoreCategoryFilter('الكل');
                  setStoreSortBy('newest');
                }}
                className="text-xs font-bold underline text-[#111214] dark:text-[#F4F4F2]"
              >
                عرض كل منتجات المتجر
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
            {filteredStoreProducts.map((product) => {
              const hasOfferActive = isProductOfferActive(product);
              const offerBadge = hasOfferActive ? getProductOfferBadgeText(product) : '';
              const hasCrossedPrice = Number(product.originalPrice || 0) > Number(product.price || 0);
              const availableVariants = getAvailableProductVariants(product);
              const baseOutOfStock = isItemOutOfStock(product);
              const fullyOutOfStock = baseOutOfStock && availableVariants.length === 0;
              const stockLimit = getStockLimit(product);
              const inCartQty = cart.find(
                (c) => (c.product?._cartKey || (c.product?.selectedVariantId ? `${c.product.id}__variant__${c.product.selectedVariantId}` : c.product?.id)) === product.id
              )?.quantity || 0;
              const baseAtCartMax = baseOutOfStock || (stockLimit !== null && inCartQty >= stockLimit);
              const isNoDelivery = Boolean(product.noDelivery);
              const canPreOrder = isNoDelivery || (isVerified && (product.isPreOrderEnabled ?? true));
              const fav = isFavorite(product.id);

              return (
              <article
                key={product.id}
                onClick={() => {
                  recordRecentlyViewed(product.id);
                  navigate(`/product/${product.id}`);
                }}
                className="group flex flex-col h-full cursor-pointer"
              >
                <div className="aspect-[4/5] relative overflow-hidden rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] mb-3">
                  <StoreProductImage
                    src={product.image || (product.images && product.images[0])}
                    alt={product.title}
                  />

                  {offerBadge && (
                    <span className="absolute top-2.5 right-2.5 bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] text-[10px] font-bold px-2 py-0.5 rounded-md z-10">
                      {offerBadge}
                    </span>
                  )}

                  <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(product.id);
                      }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                        fav
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white/90 dark:bg-[#131519]/90 text-[#111214] dark:text-[#F4F4F2] border-[#E5E2DA] dark:border-[#232730] hover:bg-white dark:hover:bg-[#131519]'
                      }`}
                      title={fav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}
                      aria-label={fav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}
                    >
                      <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        recordRecentlyViewed(product.id);
                        setQuickViewProduct(product);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/90 dark:bg-[#131519]/90 text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] hover:bg-white dark:hover:bg-[#131519] transition-colors"
                      title="معاينة سريعة"
                      aria-label="معاينة سريعة"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {fullyOutOfStock && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-2 text-center z-20">
                      <span className="text-white font-bold text-[11px] bg-rose-600 px-2.5 py-1 rounded-md">نفدت الكمية</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col flex-1 justify-between gap-2">
                  <div className="space-y-1">
                    <ProductPublisherMiniCard
                      product={product}
                      storeProfile={{ ...profile, isVerified }}
                      variant="compact"
                    />
                    <h3 className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] line-clamp-2 leading-snug">
                      {product.title}
                    </h3>
                    {isNoDelivery && (
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 line-clamp-1 mt-0.5">
                        <StoreIcon className="w-3 h-3 shrink-0" />
                        <span>لا يوجد توصيل · استلام من المتجر فقط</span>
                      </p>
                    )}
                    {hasOfferActive && (product.offerExtras || product.offerTitle) && (
                      <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 line-clamp-1 mt-0.5">
                        {product.offerExtras || product.offerTitle}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`text-sm sm:text-base font-extrabold ${storeAccent.price} tabular-nums`}>
                          {Number(product.price || 0).toLocaleString()} <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                        </span>
                        {hasCrossedPrice && (
                          <span className="text-[11px] text-[#5C5B57] dark:text-zinc-500 line-through tabular-nums">
                            {Number(product.originalPrice).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {isNoDelivery ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!user) { login(); return; }
                            setSelectedPreOrderProduct(product);
                          }}
                          disabled={baseOutOfStock}
                          className="w-9 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={baseOutOfStock ? 'نفدت الكمية' : 'حجز للاستلام من المتجر (لا يوجد توصيل)'}
                          aria-label="حجز للاستلام من المتجر"
                        >
                          <BookmarkCheck className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            addToCart(buildBaseProductForCart(product));
                          }}
                          disabled={baseOutOfStock || baseAtCartMax}
                          className={`w-9 h-9 rounded-lg ${storeAccent.bg} ${storeAccent.hover} flex items-center justify-center transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed`}
                          title={baseOutOfStock ? 'نفدت الكمية من المنتج الأساسي' : baseAtCartMax ? 'بلغت الحد الأقصى المتاح' : 'أضف للسلة'}
                          aria-label="أضف للسلة"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {availableVariants.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setVariantsModalProduct(product);
                        }}
                        className="w-full min-h-[34px] py-1.5 px-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-[11px] font-bold flex items-center justify-between transition-colors text-[#111214] dark:text-[#F4F4F2]"
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span>أصناف</span>
                        </span>
                        <span className="tabular-nums text-[#5C5B57] dark:text-zinc-400">
                          {availableVariants.length} متاح
                        </span>
                      </button>
                    )}

                    {canPreOrder && !baseOutOfStock && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!user) { login(); return; }
                          setSelectedPreOrderProduct(product);
                        }}
                        className="w-full min-h-[34px] py-1.5 px-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[11px] font-bold flex items-center justify-between transition-colors text-[#111214] dark:text-[#F4F4F2]"
                      >
                        <span className="flex items-center gap-1 text-[#5C5B57] dark:text-zinc-300">
                          <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>{isNoDelivery ? `حجز للمتجر (${product.reservationDurationDays || 3}أ)` : 'حجز مسبق'}</span>
                        </span>
                        <span className="tabular-nums">
                          {calculateSafeDeposit(Number(product.price || 0), product.depositAmount).toLocaleString()} ر.ي
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </section>

      {variantsModalProduct && (
        <Suspense fallback={null}>
          <ProductVariantsModal
            product={variantsModalProduct}
            isOpen={!!variantsModalProduct}
            onClose={() => setVariantsModalProduct(null)}
            onNavigateToVariant={(pid, vid) => navigate(`/variant/${pid}/${vid}`)}
          />
        </Suspense>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={() => setShowRatingModal(false)}>
          <div
            className="rounded-xl w-full max-w-lg p-6 sm:p-7 shadow-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2]"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div className="flex items-center gap-2.5">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="font-display text-lg font-extrabold">تقييم المتجر والمصداقية</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="p-2 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] hover:text-[#111214] dark:hover:text-white transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2.5">
                <div className="flex justify-between items-end">
                  <label className="text-xs sm:text-sm font-bold">تقييم المتجر العام</label>
                  <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                    {userRating}<span className="text-xs text-[#5C5B57] dark:text-zinc-500">/10</span>
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setUserRating(star)}
                      className={`flex-1 min-h-[36px] rounded-md transition-colors flex items-center justify-center ${
                        userRating >= star
                          ? 'bg-amber-500 text-white'
                          : 'bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-500'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${userRating >= star ? 'fill-white' : ''}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-end">
                  <label className="text-xs sm:text-sm font-bold">مصداقية التعامل</label>
                  <span className={`text-xl font-extrabold tabular-nums ${getThemeClasses('price')}`}>
                    {userCredibility}<span className="text-xs text-[#5C5B57] dark:text-zinc-500">/10</span>
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setUserCredibility(star)}
                      className={`flex-1 min-h-[36px] rounded-md transition-colors flex items-center justify-center ${
                        userCredibility >= star
                          ? 'bg-emerald-700 text-white'
                          : 'bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-500'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold block">رأيك الشخصي (اختياري)</label>
                <textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="اكتب تجربتك مع هذا المتجر..."
                  className="w-full h-24 border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 rounded-lg p-3.5 outline-none text-sm resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleRatingSubmit}
                disabled={isSubmittingRating}
                className={`w-full min-h-[44px] py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                {isSubmittingRating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 fill-current" />
                    <span>تقديم التقييم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Links Modal */}
      {showLinks && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={() => setShowLinks(false)}>
          <div
            className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl p-6 w-full max-w-sm space-y-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex justify-between items-center pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
              <h3 className="font-display text-base font-bold flex items-center gap-2 text-[#111214] dark:text-[#F4F4F2]">
                <StoreIcon className={`w-4 h-4 ${getThemeClasses('text')}`} />
                <span>روابط التواصل للمتجر</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLinks(false)}
                className="text-[#5C5B57] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] p-1.5 rounded-lg transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {profile.whatsapp && (
                <a
                  href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors border border-emerald-200 dark:border-emerald-800"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-4.5 h-4.5" />
                    <span className="font-bold text-sm">واتساب المتجر</span>
                  </div>
                  <ExternalLink className="w-4 h-4 opacity-70" />
                </a>
              )}
              {profile.tiktok && (
                <a
                  href={profile.tiktok.startsWith('http') ? profile.tiktok : `https://tiktok.com/@${profile.tiktok}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] flex items-center justify-between p-3.5 bg-[#111214] text-white rounded-lg hover:bg-black transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Music className="w-4.5 h-4.5" />
                    <span className="font-bold text-sm">تيك توك</span>
                  </div>
                  <ExternalLink className="w-4 h-4 opacity-70" />
                </a>
              )}
              {profile.instagram && (
                <a
                  href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] flex items-center justify-between p-3.5 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Instagram className="w-4.5 h-4.5" />
                    <span className="font-bold text-sm">انستقرام</span>
                  </div>
                  <ExternalLink className="w-4 h-4 opacity-70" />
                </a>
              )}
            </div>

            <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 text-center">
              هذه الروابط تتبع إدارة المتجر بشكل مباشر
            </p>
          </div>
        </div>
      )}

      {/* Pre-Order Reservation Modal */}
      {selectedPreOrderProduct && (
        <Suspense fallback={null}>
          <PreOrderModal
            product={buildBaseProductForCart(selectedPreOrderProduct)}
            isOpen={!!selectedPreOrderProduct}
            onClose={() => setSelectedPreOrderProduct(null)}
          />
        </Suspense>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <Suspense fallback={null}>
          <QuickViewModal
            product={quickViewProduct}
            storeProfile={{ ...profile, isVerified }}
            isOpen={!!quickViewProduct}
            onClose={() => setQuickViewProduct(null)}
            onOpenPreOrder={(p) => {
              setQuickViewProduct(null);
              if (!user) { login(); return; }
              setSelectedPreOrderProduct(p);
            }}
            onOpenVariants={(p) => {
              setQuickViewProduct(null);
              setVariantsModalProduct(p);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
