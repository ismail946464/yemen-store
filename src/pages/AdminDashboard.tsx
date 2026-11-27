import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, setDoc, query, where, orderBy, limit,
  onSnapshot
} from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import {
  Store, Users, ShoppingCart, Trash2, Edit, X,
  Settings as SettingsIcon, Image as ImageIcon, MessageSquare,
  ListFilter, CheckCircle, Search, User,
  TrendingUp, MapPin, AlertTriangle, Send,
  Globe, QrCode, ExternalLink, Download,
  Check, Plus, ShieldCheck, Shield, Clock,
  DollarSign, Package, Eye,
  Instagram, Phone, BarChart3, Sun, Moon, Server, Activity,
  Upload, Palette, Wallet, KeyRound, Lock, BookmarkCheck,
  Navigation, Loader2, EyeOff, RefreshCw, Percent, Gift, Truck, Layers, XCircle,
  Calendar, RotateCcw, ChevronRight, ChevronLeft, History, Tag,
  Building2, Wrench, Pill, Utensils, Car, Laptop, Shirt, Gavel, BellRing,
  Megaphone, Layout, Type, LayoutGrid, ChevronDown, Ticket, Handshake
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import WalletManagement from '../components/WalletManagement';
import CouponManager from '../components/CouponManager';
import PriceOffersInbox from '../components/PriceOffersInbox';
import StoreAccountsManagement from '../components/StoreAccountsManagement';
import AdminBuyerRequestsTab from '../components/AdminBuyerRequestsTab';
import ProductSafetyModal from '../components/ProductSafetyModal';
import { isProductOfferActive, getProductOfferBadgeText } from '../lib/offerUtils';
import { ProductVariant, getProductVariants } from '../lib/variantUtils';
import { reserveStockTransaction, restoreStockTransaction } from '../lib/stockUtils';
import {
  getProductStatusMeta,
  submitProductForReviewAction,
  moveProductToStoreQueueAction,
  approveAndPublishProductAction,
  rejectProductAction
} from '../lib/productModerationUtils';
import { expireReservationTransaction, isStorePickupOnlyOrder } from '../lib/reservationUtils';
import {
  ReportPeriodMode,
  StatsResetConfig,
  getLocalDateKey,
  getLocalMonthKey,
  getLocalDateTimeInputValue,
  shiftLocalDateKey,
  shiftLocalMonthKey,
  formatArabicDateTime,
  computeOverviewReport
} from '../lib/statsReportUtils';
import {
  StoreCategoryItem,
  STORE_CATEGORY_ICON_OPTIONS,
  DEFAULT_STARTER_STORE_CATEGORIES,
  sortStoreCategories,
  doesStoreMatchCategory
} from '../lib/storeCategories';
import {
  BannerAdItem,
  MAX_BANNER_ADS,
  sortBannerAds
} from '../lib/bannerAds';
import {
  formatArabicDate,
  formatArabicTime,
  formatArabicLongDate,
  safeCopyText
} from '../lib/deviceSafe';
import { BuyerRequestItem } from '../lib/buyerRequests';
import { ProductWatcherItem, notifyWatchersOnProductUpdate } from '../lib/priceRadar';
import { PriceOfferItem } from '../lib/priceOffers';
import {
  PLATFORM_THEMES,
  STORE_LAYOUT_STYLES,
  STORE_ACCENT_PALETTES,
  PLATFORM_FONTS
} from '../lib/storeStyles';

const renderStoreCategoryIcon = (iconOrName?: string, className = 'w-4 h-4 shrink-0') => {
  const s = String(iconOrName || '').toLowerCase();
  if (s === 'pharmacy' || s.includes('صيدل') || s.includes('طب')) return <Pill className={className} />;
  if (s === 'mall' || s.includes('مول') || s.includes('مركز')) return <Building2 className={className} />;
  if (s === 'mechanic' || s.includes('ميكان') || s.includes('صيان')) return <Wrench className={className} />;
  if (s === 'food' || s.includes('مطعم') || s.includes('كافيه')) return <Utensils className={className} />;
  if (s === 'electronics' || s.includes('الكترون') || s.includes('إلكترون')) return <Laptop className={className} />;
  if (s === 'fashion' || s.includes('ملابس') || s.includes('أزياء')) return <Shirt className={className} />;
  if (s === 'car' || s.includes('سيار')) return <Car className={className} />;
  if (s === 'store' || s.includes('محل') || s.includes('متجر')) return <Store className={className} />;
  return <Tag className={className} />;
};

interface StoreProfile {
  userId: string;
  name: string;
  description: string;
  logoUrl: string;
  bannerUrl?: string;
  verified: boolean;
  verifiedUntil?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  address?: string;
  city?: string;
  district?: string;
  landmark?: string;
  workingHours?: string;
  phone?: string;
  location?: { lat: number; lng: number } | null;
  coordinates?: { lat: number; lng: number } | null;
  googleMapsUrl?: string;
  themeColor?: string;
  storeStyle?: string;
  storeAnnouncement?: string;
  lastSeen?: string;
  statsReset?: StatsResetConfig | null;
  storeCategoryIds?: string[];
}

type AdminTab =
  | 'overview'
  | 'products'
  | 'product-review'
  | 'orders'
  | 'buyer-requests'
  | 'users'
  | 'stores'
  | 'settings'
  | 'categories'
  | 'store-profile'
  | 'wallets'
  | 'server'
  | 'store-accounts';

const formatArabicVerificationDate = (isoDate?: string) => {
  if (!isoDate) return '';
  return formatArabicLongDate(isoDate) || isoDate;
};

const AdminInput = ({ label, value, onChange, type = 'text', placeholder, icon, extra, dir, required }: any) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-end gap-2">
      <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">{label}</label>
      {extra && <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">{extra}</span>}
    </div>
    <div className="relative">
      {icon && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5C5B57] dark:text-zinc-400 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        type={type}
        value={value}
        required={required}
        dir={dir}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg py-2.5 ${icon ? 'pr-10' : 'pr-3.5'} pl-3.5 font-medium text-sm text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57]/60 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-[#131519] focus:border-[#111214] dark:focus:border-zinc-400 outline-none transition`}
      />
    </div>
  </div>
);

const AdminTextarea = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">{label}</label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg p-3.5 font-medium text-sm text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57]/60 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-[#131519] focus:border-[#111214] dark:focus:border-zinc-400 outline-none transition min-h-[120px]"
    />
  </div>
);

const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
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
  });
};

const ImageEditor = ({ label, value, onChange }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      toast.loading('جاري ضغط وتحسين جودة الصورة...', { id: 'img-upload' });
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          onChange(compressed);
          toast.success('تم الرفع بنجاح', { id: 'img-upload' });
        } catch {
          toast.error('فشل في معالجة الصورة', { id: 'img-upload' });
        }
      };
      reader.onerror = () => {
        toast.error('خطأ في قراءة الملف', { id: 'img-upload' });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">{label}</label>
        {!value && <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">PNG, JPG بحد أقصى 2MB</span>}
      </div>
      <div className="relative group overflow-hidden rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] hover:border-[#111214] dark:hover:border-zinc-500 transition bg-[#FAF9F6] dark:bg-[#101216] h-44 lg:h-52">
        {value ? (
          <div className="relative w-full h-full">
            <img src={value} className="w-full h-full object-cover" alt={label} />
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-11 h-11 bg-white rounded-lg text-[#111214] flex items-center justify-center hover:bg-neutral-100 transition shadow-sm"
                aria-label="تعديل الصورة"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="w-11 h-11 bg-white rounded-lg text-rose-600 flex items-center justify-center hover:bg-rose-50 transition shadow-sm"
                aria-label="حذف الصورة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center h-full gap-3 cursor-pointer p-4 text-center"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">اختر صورة من جهازك</p>
              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-0.5">انقر هنا لتصفح الملفات</p>
            </div>
          </div>
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const {
    isAdmin, isStore, loading, user, userData,
    settings, getThemeClasses, globalStats,
    isDarkMode, toggleDarkMode, getAuthHeaders, changePassword
  } = useAppContext();

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [showMobileAllSections, setShowMobileAllSections] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState<'identity' | 'location' | 'style'>('identity');
  const [settingsSubTab, setSettingsSubTab] = useState<'brand' | 'appearance' | 'banners' | 'security'>('brand');
  const [categoriesSubTab, setCategoriesSubTab] = useState<'stores' | 'products'>('stores');
  const [walletsSubTab, setWalletsSubTab] = useState<'wallets' | 'coupons'>('wallets');
  const [ordersSubTab, setOrdersSubTab] = useState<'orders' | 'offers'>('orders');
  const [isSaving, setIsSaving] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [priceOffers, setPriceOffers] = useState<PriceOfferItem[]>([]);
  const [buyerRequests, setBuyerRequests] = useState<BuyerRequestItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategoryItem[]>([]);
  const [bannerAds, setBannerAds] = useState<BannerAdItem[]>([]);
  const [productWatchers, setProductWatchers] = useState<ProductWatcherItem[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [serverLogs, setServerLogs] = useState<any[]>([]);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [showResetCatsConfirm, setShowResetCatsConfirm] = useState(false);

  // Overview Report & Non-Destructive Stats Reset states
  const [reportPeriodMode, setReportPeriodMode] = useState<ReportPeriodMode>('all');
  const [reportDay, setReportDay] = useState<string>(() => getLocalDateKey());
  const [reportMonth, setReportMonth] = useState<string>(() => getLocalMonthKey());
  const [reportCustomStart, setReportCustomStart] = useState<string>(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return getLocalDateTimeInputValue(start);
  });
  const [reportCustomEnd, setReportCustomEnd] = useState<string>(() => getLocalDateTimeInputValue(new Date()));
  const [selectedReportStoreId, setSelectedReportStoreId] = useState<string>('all');
  const [ignoreResetView, setIgnoreResetView] = useState<boolean>(false);
  const [showAllPeriodOrders, setShowAllPeriodOrders] = useState<boolean>(false);
  const [showResetStatsModal, setShowResetStatsModal] = useState<boolean>(false);
  const [isResettingStats, setIsResettingStats] = useState<boolean>(false);

  const handleDetectStoreGps = () => {
    if (!navigator.geolocation) {
      toast.error('متصفحك لا يدعم خاصية تحديد الموقع الجغرافي');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setStoreProfile(prev => prev ? ({
          ...prev,
          location: { lat, lng },
          coordinates: { lat, lng },
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        }) : null);
        toast.success(`تم بنجاح التقاط موقع المتجر عبر GPS (${lat}, ${lng})`);
      },
      (err) => {
        setDetectingGps(false);
        console.warn('Geolocation error:', err);
        toast.error('تعذر الوصول إلى GPS. يرجى تفعيل إذن الموقع في المتصفح أو إدخال رابط خرائط Google يدوياً.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Password management states
  const [passwordModalUser, setPasswordModalUser] = useState<{ id: string; email: string; name: string; role: string } | null>(null);
  const [adminUserNewPass, setAdminUserNewPass] = useState('');
  const [showAdminUserNewPass, setShowAdminUserNewPass] = useState(true);
  const [isSavingUserPass, setIsSavingUserPass] = useState(false);

  const [adminSelfCurrentPass, setAdminSelfCurrentPass] = useState('');
  const [adminSelfNewPass, setAdminSelfNewPass] = useState('');
  const [adminSelfConfirmPass, setAdminSelfConfirmPass] = useState('');
  const [showAdminSelfPasswords, setShowAdminSelfPasswords] = useState(false);
  const [isChangingAdminSelfPass, setIsChangingAdminSelfPass] = useState(false);

  const handleSaveUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (!adminUserNewPass.trim() || adminUserNewPass.trim().length < 4) {
      toast.error('يجب أن تتكون كلمة المرور من 4 أحرف على الأقل');
      return;
    }
    setIsSavingUserPass(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          action: 'update',
          payload: {
            id: passwordModalUser.id,
            email: passwordModalUser.email,
            name: passwordModalUser.name,
            role: passwordModalUser.role || 'user',
            password: adminUserNewPass.trim()
          }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'تعذر تحديث كلمة المرور');
      }
      toast.success(`تم تحديث كلمة مرور ${passwordModalUser.name || passwordModalUser.email} بنجاح`);
      setPasswordModalUser(null);
      setAdminUserNewPass('');
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء تحديث كلمة المرور');
    } finally {
      setIsSavingUserPass(false);
    }
  };

  const handleChangeAdminSelfPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSelfNewPass.trim() || adminSelfNewPass.trim().length < 4) {
      toast.error('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل');
      return;
    }
    if (adminSelfNewPass !== adminSelfConfirmPass) {
      toast.error('كلمتا المرور غير متطابقتين');
      return;
    }
    setIsChangingAdminSelfPass(true);
    try {
      const res = await changePassword(adminSelfNewPass.trim(), adminSelfCurrentPass.trim() || undefined);
      if (res.success) {
        toast.success(res.message || 'تم تحديث كلمة مرور حسابك بنجاح');
        setAdminSelfCurrentPass('');
        setAdminSelfNewPass('');
        setAdminSelfConfirmPass('');
      } else {
        toast.error(res.message || 'تعذر تغيير كلمة المرور');
      }
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء التغيير');
    } finally {
      setIsChangingAdminSelfPass(false);
    }
  };

  // Multi-store editing states
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('editStoreId');
  });
  const [allStoreProfiles, setAllStoreProfiles] = useState<any[]>([]);
  const [storesSearchTerm, setStoresSearchTerm] = useState('');

  const currentTargetStoreId = (isAdmin && selectedStoreId) ? selectedStoreId : (user?.uid || '');

  const [viewedTabs, setViewedTabs] = useState<Record<string, boolean>>(() => {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab') || 'overview';
    return { [initialTab]: true };
  });

  const handleTabClick = (tab: AdminTab) => {
    setActiveTab(tab);
    setViewedTabs(prev => ({ ...prev, [tab]: true }));
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  };

  const handleSelectStore = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    const url = new URL(window.location.href);
    if (storeId && storeId !== user?.uid) {
      url.searchParams.set('editStoreId', storeId);
    } else {
      url.searchParams.delete('editStoreId');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const [productForm, setProductForm] = useState<any>(null);
  const [inspectingProduct, setInspectingProduct] = useState<any | null>(null);
  const [productFilterTab, setProductFilterTab] = useState<'all' | 'queued' | 'pending_review' | 'active' | 'rejected' | 'draft'>('all');
  const [reviewQueueFilter, setReviewQueueFilter] = useState<'pending_review' | 'queued' | 'rejected' | 'active' | 'all'>('pending_review');
  const [categoryForm, setCategoryForm] = useState<any>(null);
  const [storeCategoryForm, setStoreCategoryForm] = useState<any>(null);
  const [bannerAdForm, setBannerAdForm] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: string; title: string; email?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSettings, setLocalSettings] = useState<any>({});
  const [showQrModal, setShowQrModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);

  const handleToggleStoreCategory = async (storeId: string, currentCategoryIds: string[], categoryId: string) => {
    if (!isAdmin) return;
    const prev = Array.isArray(currentCategoryIds) ? currentCategoryIds : [];
    const next = prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId];
    try {
      await setDoc(doc(db, 'storeProfiles', storeId), {
        userId: storeId,
        storeCategoryIds: next,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      if (storeProfile && currentTargetStoreId === storeId) {
        setStoreProfile({ ...storeProfile, storeCategoryIds: next });
      }
      try { sessionStorage.removeItem('yemen_store_directory_v1'); } catch {}
      toast.success('تم تحديث تصنيف المتجر بنجاح');
    } catch (err: any) {
      toast.error(err?.message || 'فشل تحديث تصنيف المتجر');
    }
  };

  const handleTestGeminiKey = async () => {
    setIsTestingGemini(true);
    const toastId = toast.loading('جاري اختبار الاتصال بنظام الذكاء الاصطناعي للمتجر...');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/ai/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ apiKey: localSettings.geminiApiKey })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'تم الاتصال بنجاح!', { id: toastId });
      } else {
        toast.error(data.message || 'فشل الاتصال', { id: toastId });
      }
    } catch (err: any) {
      toast.error('حدث خطأ في الاتصال: ' + err.message, { id: toastId });
    } finally {
      setIsTestingGemini(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    if (!isAdmin && !isStore) { navigate('/'); return; }

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const validTabs: AdminTab[] = [
      'overview', 'products', 'product-review', 'orders', 'buyer-requests', 'users', 'stores',
      'settings', 'categories', 'store-profile', 'wallets', 'server', 'store-accounts'
    ];
    if (tabParam && validTabs.includes(tabParam as AdminTab)) {
      setActiveTab(tabParam as AdminTab);
      setViewedTabs(prev => ({ ...prev, [tabParam]: true }));
    }
    const editStoreParam = params.get('editStoreId');
    if (editStoreParam) {
      setSelectedStoreId(editStoreParam);
    }
  }, [isAdmin, isStore, loading, user, navigate]);

  // Dedicated Store Profile Listener
  useEffect(() => {
    if (!currentTargetStoreId) return;

    const unsubProfile = onSnapshot(doc(db, 'storeProfiles', currentTargetStoreId), async (snap) => {
      if (snap.exists()) {
        const profileData = snap.data() as StoreProfile;
        if (profileData.verified && profileData.verifiedUntil) {
          const expDate = new Date(profileData.verifiedUntil);
          if (isNaN(expDate.getTime()) || expDate.getFullYear() < 2026) {
            const freshDate = new Date();
            freshDate.setFullYear(freshDate.getFullYear() + 1);
            const freshIso = freshDate.toISOString();
            profileData.verifiedUntil = freshIso;
            updateDoc(doc(db, 'storeProfiles', currentTargetStoreId), { verifiedUntil: freshIso }).catch(console.error);
          }
        }
        setStoreProfile(profileData);
      } else {
        try {
          const uSnap = await getDoc(doc(db, 'users', currentTargetStoreId));
          if (uSnap.exists()) {
            const uData = uSnap.data();
            setStoreProfile({
              userId: currentTargetStoreId,
              name: uData.name || '',
              description: '',
              logoUrl: uData.photoURL || '',
              verified: uData.role === 'store'
            });
          } else {
            setStoreProfile({ userId: currentTargetStoreId, name: '', description: '', logoUrl: '', verified: false });
          }
        } catch {
          setStoreProfile({ userId: currentTargetStoreId, name: '', description: '', logoUrl: '', verified: false });
        }
      }
    }, (err) => {
      console.warn('Store profile listener notice:', err.message);
    });

    return () => unsubProfile();
  }, [currentTargetStoreId]);

  useEffect(() => {
    if (!user || loading) return;

    const unsubscribers: (() => void)[] = [];

    const fetchData = () => {
      let pQuery: any = collection(db, 'products');
      if (isStore && !isAdmin) pQuery = query(pQuery, where('ownerId', '==', user.uid));
      const unsubProducts = onSnapshot(pQuery, (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.warn('Products listener notice:', err.message));
      unsubscribers.push(unsubProducts);

      let oQuery: any = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      if (isStore && !isAdmin) oQuery = query(collection(db, 'orders'), where('storeId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubOrders = onSnapshot(oQuery, (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.warn('Orders listener notice:', err.message));
      unsubscribers.push(unsubOrders);

      const brQuery = query(collection(db, 'buyerRequests'), orderBy('updatedAt', 'desc'), limit(60));
      const unsubBuyerReqs = onSnapshot(brQuery, (snap) => {
        setBuyerRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as BuyerRequestItem)));
      }, (err) => console.warn('BuyerRequests listener notice:', err.message));
      unsubscribers.push(unsubBuyerReqs);

      let pwQuery: any = collection(db, 'productWatchers');
      if (isStore && !isAdmin) pwQuery = query(pwQuery, where('storeId', '==', user.uid));
      const unsubWatchers = onSnapshot(pwQuery, (snap) => {
        setProductWatchers(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductWatcherItem)));
      }, (err) => console.warn('ProductWatchers listener notice:', err.message));
      unsubscribers.push(unsubWatchers);

      let poQuery: any = collection(db, 'priceOffers');
      if (isStore && !isAdmin) poQuery = query(poQuery, where('storeId', '==', user.uid));
      const unsubPriceOffers = onSnapshot(poQuery, (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as PriceOfferItem))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPriceOffers(list);
      }, (err) => console.warn('PriceOffers listener notice:', err.message));
      unsubscribers.push(unsubPriceOffers);

      if (isAdmin) {
        const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(100)), (snap) => {
          setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.warn('Users listener notice:', err.message));
        unsubscribers.push(unsubUsers);

        const unsubStoreProfiles = onSnapshot(collection(db, 'storeProfiles'), (snap) => {
          setAllStoreProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.warn('StoreProfiles listener notice:', err.message));
        unsubscribers.push(unsubStoreProfiles);

        const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
          setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.warn('Categories listener notice:', err.message));
        unsubscribers.push(unsubCats);

        const unsubStoreCats = onSnapshot(collection(db, 'storeCategories'), (snap) => {
          setStoreCategories(sortStoreCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })) as StoreCategoryItem[]));
        }, (err) => console.warn('StoreCategories listener notice:', err.message));
        unsubscribers.push(unsubStoreCats);

        const unsubLogs = onSnapshot(query(collection(db, 'serverLogs'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
          setServerLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.warn('ServerLogs listener notice:', err.message));
        unsubscribers.push(unsubLogs);

        const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (!data.storePublicUrl) {
              data.storePublicUrl = window.location.origin;
            }
            setLocalSettings(data);
          }
        }, (err) => console.warn('Global settings listener notice:', err.message));
        unsubscribers.push(unsubSettings);

        const unsubBannerAds = onSnapshot(collection(db, 'bannerAds'), (snap) => {
          setBannerAds(sortBannerAds(snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAdItem[]));
        }, (err) => console.warn('BannerAds listener notice:', err.message));
        unsubscribers.push(unsubBannerAds);
      }
    };

    fetchData();
    return () => unsubscribers.forEach(unsub => unsub());
  }, [user, isAdmin, isStore, loading]);

  const expiringOrdersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || loading || orders.length === 0) return;
    const now = Date.now();
    orders.forEach((o) => {
      const isReservedActive = o.status === 'reserved' || o.status === 'deposit_paid';
      if (!isReservedActive || !o.reservationExpiresAt) return;
      const expMs = new Date(o.reservationExpiresAt).getTime();
      if (!Number.isFinite(expMs) || expMs > now) return;
      if (expiringOrdersRef.current.has(o.id)) return;
      expiringOrdersRef.current.add(o.id);
      expireReservationTransaction(o.id).catch((err) => {
        expiringOrdersRef.current.delete(o.id);
        console.warn('Reservation auto-expire notice:', err);
      });
    });
  }, [orders, user, loading]);

  const productWatchersByProdId = useMemo(() => {
    const map: Record<string, { count: number; minTarget: number | null; restockCount: number }> = {};
    for (const w of productWatchers) {
      if (!w.productId) continue;
      if (!map[w.productId]) {
        map[w.productId] = { count: 0, minTarget: null, restockCount: 0 };
      }
      map[w.productId].count += 1;
      if (w.watchRestock) map[w.productId].restockCount += 1;
      if (w.targetPrice && w.targetPrice > 0) {
        map[w.productId].minTarget =
          map[w.productId].minTarget === null
            ? Number(w.targetPrice)
            : Math.min(map[w.productId].minTarget!, Number(w.targetPrice));
      }
    }
    return map;
  }, [productWatchers]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm) return;
    if (isStore && !isAdmin && productForm.ownerId && productForm.ownerId !== user?.uid) {
      toast.error('لا يمكنك تعديل منتج لا يخص متجرك');
      return;
    }
    setIsSaving(true);
    try {
      const targetOwnerId = productForm.ownerId || currentTargetStoreId || user?.uid || '';
      const targetStoreObj = (targetOwnerId === currentTargetStoreId && storeProfile)
        ? storeProfile
        : allStoreProfiles.find(sp => sp.id === targetOwnerId || sp.userId === targetOwnerId);
      const isTargetStoreVerified = targetStoreObj
        ? Boolean(targetStoreObj.verified) && (!targetStoreObj.verifiedUntil || targetStoreObj.verifiedUntil === '' || new Date(targetStoreObj.verifiedUntil).getTime() >= Date.now())
        : (Boolean(storeProfile?.verified) && (!storeProfile?.verifiedUntil || storeProfile?.verifiedUntil === '' || new Date(storeProfile.verifiedUntil).getTime() >= Date.now()));

      const isNoDelivery = Boolean(productForm.noDelivery);
      const hasOffer = Boolean(productForm.hasOffer);
      const rawOfferType = hasOffer ? (productForm.offerType || 'discount') : null;
      const offerType = isNoDelivery && rawOfferType === 'free_delivery' ? 'discount' : rawOfferType;
      const numericPrice = Number(productForm.price) || 0;
      const rawOriginal = productForm.originalPrice !== '' && productForm.originalPrice !== null && productForm.originalPrice !== undefined
        ? Number(productForm.originalPrice)
        : null;
      const computedDiscount = (hasOffer && rawOriginal && rawOriginal > numericPrice)
        ? Math.round(((rawOriginal - numericPrice) / rawOriginal) * 100)
        : (hasOffer && productForm.discountPercent ? Number(productForm.discountPercent) : null);

      const rawVariants = Array.isArray(productForm.variants) ? productForm.variants : [];
      const sanitizedVariants: ProductVariant[] = rawVariants
        .filter((v: any) => v && typeof v === 'object' && String(v.name || '').trim().length > 0)
        .filter((v: any) => !v.storeId || v.storeId === targetOwnerId)
        .slice(0, 30)
        .map((v: any, idx: number) => {
          const vPrice = Number(v.price) > 0 ? Number(v.price) : numericPrice;
          const vOrig = v.originalPrice !== '' && v.originalPrice !== null && v.originalPrice !== undefined && Number(v.originalPrice) > 0
            ? Number(v.originalPrice)
            : null;
          const vStock = v.stock === '' || v.stock === null || v.stock === undefined
            ? null
            : Math.max(0, Math.floor(Number(v.stock)));
          return {
            id: String(v.id || `var_${Date.now()}_${idx}`),
            name: String(v.name || '').trim(),
            price: vPrice,
            originalPrice: vOrig && vOrig > vPrice ? vOrig : null,
            stock: vStock,
            image: typeof v.image === 'string' ? v.image : '',
            notes: typeof v.notes === 'string' ? v.notes.trim() : '',
            storeId: targetOwnerId,
            available: v.available !== false && (vStock === null || vStock > 0),
          };
        });

      const cleanStock = productForm.stock === '' || productForm.stock === undefined || productForm.stock === null
        ? null
        : Math.max(0, Math.floor(Number(productForm.stock)));

      const nowIso = new Date().toISOString();
      const targetStoreName =
        targetStoreObj?.name ||
        storeProfile?.name ||
        userData?.name ||
        settings?.storeName ||
        'متجر مسجل';

      // Enforce two-stage publishing safety for store accounts:
      // Store creations & edits MUST go into the store waiting queue ('queued') or 'draft' — never directly to 'active'.
      let nextStatus: string = productForm.status || (isAdmin ? 'active' : 'queued');
      if (!isAdmin) {
        nextStatus = nextStatus === 'draft' ? 'draft' : 'queued';
      }

      const cleanDurationDays = Math.max(1, Math.min(365, Math.floor(Number(productForm.reservationDurationDays) || 3)));

      const data: any = {
        ...productForm,
        image: productForm.images?.[0] || '',
        price: numericPrice,
        stock: cleanStock,
        available: cleanStock === null || cleanStock > 0,
        status: nextStatus,
        moderationStatus:
          nextStatus === 'active'
            ? 'approved'
            : nextStatus === 'pending_review'
              ? 'pending_review'
              : nextStatus === 'rejected'
                ? 'rejected'
                : 'queued',
        noDelivery: isNoDelivery,
        isPreOrderEnabled: isNoDelivery ? true : (isTargetStoreVerified ? (productForm.isPreOrderEnabled ?? true) : false),
        reservationDurationDays: cleanDurationDays,
        ownerId: targetOwnerId,
        ownerName: targetStoreName,
        variants: sanitizedVariants,
        hasOffer,
        offerType,
        originalPrice: hasOffer && rawOriginal && rawOriginal > numericPrice ? rawOriginal : null,
        discountPercent: hasOffer ? computedDiscount : null,
        offerTitle: hasOffer && productForm.offerTitle ? String(productForm.offerTitle).trim() : null,
        offerExtras: hasOffer && productForm.offerExtras ? String(productForm.offerExtras).trim() : null,
        offerExpiresAt: hasOffer && productForm.offerExpiresAt ? String(productForm.offerExpiresAt).trim() : null,
        updatedAt: nowIso
      };

      if (nextStatus === 'queued') {
        data.queuedAt = nowIso;
        data.rejectionReason = null;
      } else if (nextStatus === 'active' && isAdmin) {
        data.reviewedAt = nowIso;
        data.reviewedBy = user?.uid || 'admin';
        data.rejectionReason = null;
      }

      if (isNoDelivery) {
        data.deliveryFee = 0;
      } else if (hasOffer && offerType === 'free_delivery') {
        data.deliveryFee = 0;
      } else if (data.deliveryFee === 0 && offerType !== 'free_delivery') {
        delete data.deliveryFee;
      }

      const rawDeposit = productForm.depositAmount !== '' && productForm.depositAmount !== null && productForm.depositAmount !== undefined
        ? Number(productForm.depositAmount)
        : 0;
      if (Number.isFinite(rawDeposit) && rawDeposit > 0) {
        data.depositAmount = numericPrice > 0 ? Math.min(numericPrice, Math.round(rawDeposit)) : Math.round(rawDeposit);
      } else {
        delete data.depositAmount;
      }

      const estimatedSize = JSON.stringify(data).length;
      if (estimatedSize > 900000) {
        toast.error('حجم بيانات المنتج كبير جداً. يرجى تقليل عدد الصور أو اختيار صور أصغر.', { duration: 5000 });
        setIsSaving(false);
        return;
      }

      if (productForm.id) {
        const prevProduct = products.find((p) => p.id === productForm.id);
        await updateDoc(doc(db, 'products', productForm.id), data);
        if (!isAdmin && nextStatus === 'queued') {
          toast.success('تم حفظ التعديلات في قائمة انتظار المتجر. يمكنك الآن معاينة كافة التفاصيل وإرساله لمراجعة الإدارة.');
        } else {
          toast.success('تم تحديث المنتج');
          if (nextStatus === 'active') {
            const notifiedCount = await notifyWatchersOnProductUpdate({
              productId: productForm.id,
              productTitle: String(productForm.title || prevProduct?.title || 'منتج'),
              storeName: targetStoreName,
              prevPrice: Number(prevProduct?.price || 0),
              nextPrice: numericPrice,
              prevOutOfStock: Boolean(prevProduct && (prevProduct.available === false || prevProduct.stock === 0)),
              nextOutOfStock: cleanStock === 0,
            });
            if (notifiedCount > 0) {
              toast.success(`تم إرسال تنبيه رادار الأسعار إلى ${notifiedCount} عميل مهتم`);
            }
          }
        }
      } else {
        data.createdAt = nowIso;
        const createdRef = await addDoc(collection(db, 'products'), data);
        if (!isAdmin && nextStatus === 'queued') {
          toast.success('تمت إضافة المنتج إلى قائمة انتظار متجرك! راجع جميع التفاصيل ثم أرسله للإدارة للنشر.');
          setInspectingProduct({ id: createdRef.id, ...data });
          setProductFilterTab('queued');
        } else {
          toast.success('تم إضافة المنتج');
        }
      }
      setProductForm(null);
    } catch (err) {
      toast.error('فشل الحفظ');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm || !categoryForm.name?.trim()) {
      toast.error('يرجى إدخال اسم القسم');
      return;
    }
    const name = categoryForm.name.trim();
    const slug = (categoryForm.slug?.trim() || name.replace(/\s+/g, '-')).toLowerCase();

    setIsSaving(true);
    try {
      const data = {
        name,
        slug,
        icon: categoryForm.icon || 'tag',
        order: Number(categoryForm.order) || (categories.length + 1),
        updatedAt: new Date().toISOString()
      };

      if (categoryForm.id) {
        await updateDoc(doc(db, 'categories', categoryForm.id), data);
        toast.success('تم تحديث القسم بنجاح');
      } else {
        await addDoc(collection(db, 'categories'), data);
        toast.success('تم إضافة القسم بنجاح');
      }
      setCategoryForm(null);
    } catch (err: any) {
      console.error(err);
      toast.error('فشل حفظ القسم: ' + (err.message || 'حدث خطأ'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmResetDefaultCategories = async () => {
    setShowResetCatsConfirm(false);
    setIsSaving(true);
    try {
      const DEFAULT_CATS = [
        { name: 'الإلكترونيات والأجهزة', slug: 'electronics', icon: 'laptop', order: 1 },
        { name: 'الهواتف والملحقات', slug: 'phones', icon: 'smartphone', order: 2 },
        { name: 'الأزياء والملابس', slug: 'fashion', icon: 'shirt', order: 3 },
        { name: 'العطور والبخور', slug: 'perfumes', icon: 'sparkles', order: 4 },
        { name: 'منتجات محلية يمنية', slug: 'local', icon: 'map-pin', order: 5 },
        { name: 'الساعات والإكسسوارات', slug: 'watches', icon: 'watch', order: 6 },
        { name: 'الأحذية والحقائب', slug: 'shoes-bags', icon: 'shopping-bag', order: 7 },
        { name: 'العناية والجمال', slug: 'beauty', icon: 'heart', order: 8 },
        { name: 'المنزل والمطبخ', slug: 'home', icon: 'home', order: 9 },
        { name: 'ألعاب وترفيه', slug: 'gaming', icon: 'gamepad', order: 10 }
      ];

      const currentSlugs = categories.map(c => c.slug);
      for (const cat of DEFAULT_CATS) {
        if (!currentSlugs.includes(cat.slug)) {
          await addDoc(collection(db, 'categories'), cat);
        }
      }
      toast.success('تم استعادة وتحديث جميع الأقسام بنجاح!');
    } catch {
      toast.error('فشل استعادة الأقسام');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStoreCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!storeCategoryForm || !storeCategoryForm.name?.trim()) {
      toast.error('يرجى إدخال اسم قسم المتجر');
      return;
    }
    const name = storeCategoryForm.name.trim();
    const rawSlug = (storeCategoryForm.slug?.trim() || name).toLowerCase().replace(/\s+/g, '-');
    const slug = rawSlug || `store-cat-${Date.now()}`;

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const data = {
        name,
        slug,
        icon: storeCategoryForm.icon || 'store',
        order: Number(storeCategoryForm.order) || (storeCategories.length + 1),
        updatedAt: nowIso
      };

      if (storeCategoryForm.id) {
        await updateDoc(doc(db, 'storeCategories', storeCategoryForm.id), data);
        toast.success('تم تحديث تصنيف المتجر بنجاح');
      } else {
        await addDoc(collection(db, 'storeCategories'), { ...data, createdAt: nowIso });
        toast.success('تم إضافة تصنيف المتجر بنجاح');
      }
      try { sessionStorage.removeItem('yemen_store_directory_v1'); } catch {}
      setStoreCategoryForm(null);
    } catch (err: any) {
      console.error(err);
      toast.error('فشل حفظ تصنيف المتجر: ' + (err?.message || 'حدث خطأ'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStarterStoreCategories = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const existingNames = new Set(storeCategories.map((c) => String(c.name || '').trim()));
      const existingSlugs = new Set(storeCategories.map((c) => String(c.slug || '').trim().toLowerCase()));
      let addedCount = 0;
      const nowIso = new Date().toISOString();
      for (const cat of DEFAULT_STARTER_STORE_CATEGORIES) {
        if (!existingNames.has(cat.name) && !existingSlugs.has(cat.slug)) {
          await addDoc(collection(db, 'storeCategories'), { ...cat, createdAt: nowIso, updatedAt: nowIso });
          addedCount++;
        }
      }
      try { sessionStorage.removeItem('yemen_store_directory_v1'); } catch {}
      if (addedCount > 0) {
        toast.success(`تمت إضافة ${addedCount} تصنيفات متاجر جاهزة بنجاح`);
      } else {
        toast.success('جميع تصنيفات المتاجر الافتراضية موجودة بالفعل');
      }
    } catch (err: any) {
      toast.error('تعذر إضافة التصنيفات الافتراضية');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBannerAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !bannerAdForm) return;
    const imageVal = String(bannerAdForm.image || '').trim();
    if (!imageVal) {
      toast.error('يرجى رفع صورة للمساحة الإعلانية');
      return;
    }
    if (!bannerAdForm.id && bannerAds.length >= MAX_BANNER_ADS) {
      toast.error(`الحد الأقصى للمساحات الإعلانية هو ${MAX_BANNER_ADS} إعلانات`);
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const targetStoreId = String(bannerAdForm.targetStoreId || '').trim() || null;
      const selectedStore = targetStoreId ? allStoresList.find((s) => s.id === targetStoreId) : null;
      const cleanOrder = Math.max(1, Math.min(MAX_BANNER_ADS, Math.floor(Number(bannerAdForm.order) || (bannerAds.length + 1))));

      const payload: any = {
        title: String(bannerAdForm.title || '').trim(),
        subtitle: String(bannerAdForm.subtitle || '').trim() || null,
        badgeText: String(bannerAdForm.badgeText || '').trim() || null,
        image: imageVal,
        buttonText: String(bannerAdForm.buttonText || '').trim() || null,
        targetStoreId,
        targetStoreName: targetStoreId ? (selectedStore?.name || String(bannerAdForm.targetStoreName || '').trim() || null) : null,
        customLink: !targetStoreId ? (String(bannerAdForm.customLink || '').trim() || null) : null,
        order: cleanOrder,
        active: bannerAdForm.active !== false,
        updatedAt: nowIso
      };

      const estimatedSize = JSON.stringify(payload).length;
      if (estimatedSize > 920000) {
        toast.error('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر.');
        setIsSaving(false);
        return;
      }

      if (bannerAdForm.id) {
        await updateDoc(doc(db, 'bannerAds', bannerAdForm.id), payload);
        toast.success('تم تحديث المساحة الإعلانية بنجاح');
      } else {
        await addDoc(collection(db, 'bannerAds'), { ...payload, createdAt: nowIso });
        toast.success('تمت إضافة المساحة الإعلانية بنجاح');
      }
      setBannerAdForm(null);
    } catch (err: any) {
      console.error('Save banner ad error:', err);
      toast.error('فشل حفظ الإعلان: ' + (err?.message || 'حدث خطأ'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBannerAdActive = async (ad: BannerAdItem) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'bannerAds', ad.id), {
        active: ad.active === false,
        updatedAt: new Date().toISOString()
      });
      toast.success(ad.active === false ? 'تم تفعيل الإعلان' : 'تم إيقاف الإعلان مؤقتاً');
    } catch (err: any) {
      toast.error('تعذر تحديث حالة الإعلان');
    }
  };

  const handleImportLegacyBannerAsAd = async () => {
    if (!isAdmin || !localSettings?.heroBanner || bannerAds.length >= MAX_BANNER_ADS) return;
    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      await addDoc(collection(db, 'bannerAds'), {
        title: String(localSettings.heroTitle || localSettings.storeName || 'إعلان مميز').trim(),
        subtitle: String(localSettings.heroSubtitle || '').trim() || null,
        badgeText: 'عرض مميز',
        image: localSettings.heroBanner,
        buttonText: String(localSettings.heroButtonText || 'استكشف الآن').trim() || null,
        targetStoreId: null,
        targetStoreName: null,
        customLink: String(localSettings.heroLink || '').trim() || null,
        order: bannerAds.length + 1,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      toast.success('تم تحويل البانر الحالي إلى المساحة الإعلانية رقم 1');
    } catch (err: any) {
      toast.error('تعذر استيراد البانر الحالي');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStoreProfile = async () => {
    if (!storeProfile || !user || !currentTargetStoreId) return;
    setIsSaving(true);
    try {
      const cleanStr = (val: unknown, fallback = '') => (typeof val === 'string' ? val : fallback);
      const payload: Record<string, any> = {
        ...storeProfile,
        userId: currentTargetStoreId,
        name: cleanStr(storeProfile.name),
        description: cleanStr(storeProfile.description),
        bannerUrl: cleanStr(storeProfile.bannerUrl),
        logoUrl: cleanStr(storeProfile.logoUrl),
        city: cleanStr(storeProfile.city, 'صنعاء') || 'صنعاء',
        district: cleanStr(storeProfile.district),
        address: cleanStr(storeProfile.address),
        landmark: cleanStr(storeProfile.landmark),
        workingHours: cleanStr(storeProfile.workingHours),
        googleMapsUrl: cleanStr(storeProfile.googleMapsUrl),
        phone: cleanStr(storeProfile.phone),
        whatsapp: cleanStr(storeProfile.whatsapp),
        telegram: cleanStr(storeProfile.telegram),
        instagram: cleanStr(storeProfile.instagram),
        tiktok: cleanStr(storeProfile.tiktok),
        themeColor: cleanStr(storeProfile.themeColor, 'default') || 'default',
        storeStyle: cleanStr(storeProfile.storeStyle, 'classic') || 'classic',
        storeAnnouncement: cleanStr(storeProfile.storeAnnouncement),
        seoTitle: cleanStr(storeProfile.seoTitle),
        seoDescription: cleanStr(storeProfile.seoDescription),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'storeProfiles', currentTargetStoreId), payload, { merge: true });
      try { sessionStorage.removeItem('yemen_store_directory_v1'); } catch {}
      toast.success(
        currentTargetStoreId === user.uid
          ? 'تم تحديث الملف التجاري بنجاح'
          : `تم تحديث ملف المتجر (${storeProfile.name || 'المحدد'}) بنجاح`
      );
    } catch {
      toast.error('فشل التحديث');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetVerification = async (durationMonths: number | 'lifetime' | 0) => {
    if (!storeProfile || !user || !currentTargetStoreId) return;
    try {
      let verified = true;
      let verifiedUntil = '';

      if (durationMonths === 0) {
        verified = false;
        verifiedUntil = '';
      } else if (durationMonths === 'lifetime') {
        verified = true;
        verifiedUntil = '';
      } else {
        verified = true;
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + durationMonths);
        verifiedUntil = targetDate.toISOString();
      }

      const updatedProfile = {
        ...storeProfile,
        userId: currentTargetStoreId,
        verified,
        verifiedUntil,
        updatedAt: new Date().toISOString()
      };

      setStoreProfile(updatedProfile);
      await setDoc(doc(db, 'storeProfiles', currentTargetStoreId), updatedProfile, { merge: true });

      const storeDisplayName = storeProfile.name || 'المتجر';
      if (!verified) {
        toast.success(`تم إيقاف التوثيق لـ (${storeDisplayName})`);
      } else if (durationMonths === 'lifetime') {
        toast.success(`تم تفعيل التوثيق الدائم الرسمي لـ (${storeDisplayName}) مدى الحياة!`);
      } else {
        toast.success(`تم تجديد توثيق (${storeDisplayName}) بنجاح حتى ${formatArabicVerificationDate(verifiedUntil)}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('فشل في تحديث حالة التوثيق');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'users') {
        const targetId = deleteConfirm.id;
        const targetEmail = (deleteConfirm.email || '').trim().toLowerCase();

        if (targetId === 'MQAwCYqFztd2PZbV1fRMxKRqoYX2') {
          toast.error('لا يمكن حذف حساب المدير العام الرئيسي للمتجر');
          setDeleteConfirm(null);
          return;
        }

        try {
          await deleteDoc(doc(db, 'users', targetId));
        } catch (e: any) {
          console.warn('Direct firestore delete notice:', e?.message);
        }

        try {
          const authHeaders = await getAuthHeaders();
          await fetch('/api/admin/accounts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            },
            body: JSON.stringify({
              action: 'delete',
              payload: { email: targetEmail, id: targetId }
            })
          });
        } catch (e: any) {
          console.warn('Backend accounts delete notice:', e?.message);
        }

        try {
          await deleteDoc(doc(db, 'storeProfiles', targetId));
        } catch {}

        setUsers(prev => prev.filter(u => u.id !== targetId));
        toast.success('تم حذف الحساب نهائياً بنجاح');
        setDeleteConfirm(null);
        return;
      }

      await deleteDoc(doc(db, deleteConfirm.type, deleteConfirm.id));
      if (deleteConfirm.type === 'storeCategories') {
        const deletedCatId = deleteConfirm.id;
        try { sessionStorage.removeItem('yemen_store_directory_v1'); } catch {}
        // Clean up deleted category ID from store profiles referencing it
        allStoreProfiles.forEach((sp) => {
          if (Array.isArray(sp.storeCategoryIds) && sp.storeCategoryIds.includes(deletedCatId)) {
            updateDoc(doc(db, 'storeProfiles', sp.id), {
              storeCategoryIds: sp.storeCategoryIds.filter((id: string) => id !== deletedCatId)
            }).catch(() => {});
          }
        });
      }
      toast.success('تم الحذف بنجاح');
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('فشل الحذف: ' + (err?.message || 'يرجى المحاولة لاحقاً'));
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const isCancelledTarget = status === 'cancelled' || status === 'reservation_expired';
      const stockItems = Array.isArray(targetOrder?.items)
        ? targetOrder.items.map((it: any) => ({
            productId: it.productId || it.id,
            variantId: it.variantId || null,
            variantName: it.variantName || null,
            title: it.title || '',
            quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
          }))
        : [];

      const updatePayload: Record<string, any> = { status };

      if (isCancelledTarget && targetOrder?.stockDeducted && !targetOrder?.stockRestored && stockItems.length > 0) {
        await restoreStockTransaction(stockItems);
        updatePayload.stockRestored = true;
      } else if (!isCancelledTarget && targetOrder?.stockDeducted && targetOrder?.stockRestored && stockItems.length > 0) {
        await reserveStockTransaction(stockItems);
        updatePayload.stockRestored = false;
      }

      await updateDoc(doc(db, 'orders', orderId), updatePayload);
      if (viewingOrder?.id === orderId) {
        setViewingOrder((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
      }
      toast.success(
        updatePayload.stockRestored
          ? 'تم تحديث حالة الطلب وإعادة الكمية للمخزون'
          : 'تم تحديث حالة الطلب'
      );
    } catch (err: any) {
      toast.error(err?.message || 'فشل التحديث');
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    const targetUser = users.find(u => u.id === userId);
    const roleLabels: Record<string, string> = {
      admin: 'مدير نظام',
      store: 'متجر رسمي',
      delivery: 'مندوب توصيل',
      user: 'عضو عادي'
    };
    const roleName = roleLabels[role] || role;

    if (userId === 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' && role !== 'admin') {
      toast.error('لا يمكن تغيير رتبة المدير العام الرئيسي للمتجر');
      return;
    }

    try {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));

      try {
        const authHeaders = await getAuthHeaders();
        await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({
            action: 'update',
            payload: { id: userId, email: targetUser?.email, role }
          })
        });
      } catch (backendErr) {
        console.warn('Backend role update notice:', backendErr);
      }

      try {
        await setDoc(doc(db, 'users', userId), { role }, { merge: true });
      } catch (fsErr) {
        console.warn('Client direct firestore role update notice:', fsErr);
      }

      if (role === 'store') {
        try {
          const storeRef = doc(db, 'storeProfiles', userId);
          const pSnap = await getDoc(storeRef);
          if (!pSnap.exists()) {
            const oneYearLater = new Date();
            oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
            await setDoc(storeRef, {
              userId,
              name: targetUser?.name || 'متجر جديد',
              description: `متجر رسمي معتمد في منصة ${localSettings?.storeName || settings?.storeName || 'المتجر'}`,
              logoUrl: targetUser?.photoURL || '',
              verified: true,
              verifiedUntil: oneYearLater.toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        } catch (profileErr) {
          console.warn('Store profile creation note:', profileErr);
        }
      }

      toast.success(`تم تحديث رتبة (${targetUser?.name || 'المستخدم'}) إلى [${roleName}] بنجاح`);
    } catch (err: any) {
      console.error('Role update error:', err);
      toast.error('فشل تحديث الرتبة: ' + (err?.message || 'يرجى المحاولة لاحقاً'));
    }
  };

  const handleManualCleanup = async () => {
    setIsCleaningUp(true);
    const toastId = toast.loading('جاري تنفيذ عملية تنظيف السيرفر...');
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/admin/cleanup-products', {
        headers: { ...authHeaders }
      });
      if (response.ok) {
        toast.success('تم تنفيذ عملية التنظيف بنجاح. تحقق من سجلات السيرفر.', { id: toastId });
      } else {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'فشل في الوصول إلى السيرفر');
      }
    } catch (err: any) {
      toast.error('خطأ: ' + (err?.message || 'خطأ في الاتصال بالسيرفر'), { id: toastId });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
    processing: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60',
    shipped: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60',
    delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
    cancelled: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
    reserved: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
    deposit_paid: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
    reservation_expired: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60'
  };

  const statusArabic: Record<string, string> = {
    pending: 'قيد الانتظار',
    processing: 'جاري التجهيز',
    shipped: 'تم الشحن',
    delivered: 'تم التسليم',
    cancelled: 'ملغي',
    reserved: 'حجز مسبق مؤكد',
    deposit_paid: 'تم استلام العربون',
    reservation_expired: 'انتهت مدة الحجز (مُصادر)'
  };

  const storeUsers = users.filter(u => u.role === 'store');
  const allStoresList = Array.from(new Set([
    ...storeUsers.map(u => u.id),
    ...allStoreProfiles.map(p => p.id)
  ])).map(id => {
    const profile = allStoreProfiles.find(p => p.id === id) || (id === user?.uid ? storeProfile : null);
    const u = users.find(usr => usr.id === id);
    return {
      id,
      name: profile?.name || u?.name || ('متجر رقم ' + id.slice(0, 6)),
      email: u?.email || '—',
      phone: u?.phone || profile?.whatsapp || '—',
      logoUrl: profile?.logoUrl || u?.photoURL || '',
      verified: Boolean(profile?.verified),
      verifiedUntil: profile?.verifiedUntil || '',
      ratingCount: profile?.ratingCount || 0,
      averageRating: profile?.averageRating || 0,
      averageCredibility: profile?.averageCredibility || 0,
      productCount: products.filter(p => p.ownerId === id).length,
      storeCategoryIds: Array.isArray(profile?.storeCategoryIds) ? profile.storeCategoryIds : []
    };
  });

  const filteredStores = allStoresList.filter(s => {
    if (!storesSearchTerm.trim()) return true;
    const term = storesSearchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || s.phone.includes(term);
  });

  const realOnlineCount = isAdmin && users.length > 0
    ? users.filter(u => {
        if (!u.lastSeen) return false;
        const ms = new Date(u.lastSeen).getTime();
        return Number.isFinite(ms) && (Date.now() - ms) <= 10 * 60 * 1000;
      }).length
    : (globalStats.onlineCount || 0);

  const realRegisteredCount = isAdmin && users.length > 0 && users.length < 100
    ? users.length
    : (globalStats.totalRegistered || users.length);

  const isScopedToSpecificStore = !isAdmin || (selectedReportStoreId !== 'all');
  const targetResetStoreId = !isAdmin
    ? (user?.uid || '')
    : (selectedReportStoreId !== 'all' ? selectedReportStoreId : '');

  const activeOverviewReset: StatsResetConfig | null = isScopedToSpecificStore
    ? (
        targetResetStoreId === currentTargetStoreId
          ? (storeProfile?.statsReset || null)
          : (allStoreProfiles.find(sp => sp.id === targetResetStoreId || sp.userId === targetResetStoreId)?.statsReset || null)
      )
    : (globalStats.statsReset || null);

  const handleConfirmResetStats = async () => {
    if (!user) return;
    setIsResettingStats(true);
    try {
      const now = new Date();
      const resetDayKey = getLocalDateKey(now);
      const resetPayload: StatsResetConfig = {
        resetAt: now.toISOString(),
        visitsBaseline: globalStats.totalVisitors || 0,
        usersBaseline: realRegisteredCount || 0,
        storesBaseline: users.filter(u => u.role === 'store').length,
        resetDayKey,
        resetDayVisitsBaseline: globalStats.dailyVisits?.[resetDayKey] || 0,
        resetBy: user.uid
      };

      if (isScopedToSpecificStore && targetResetStoreId) {
        await setDoc(doc(db, 'storeProfiles', targetResetStoreId), {
          userId: targetResetStoreId,
          updatedAt: now.toISOString(),
          statsReset: resetPayload
        }, { merge: true });
        if (targetResetStoreId === currentTargetStoreId) {
          setStoreProfile(prev => prev ? { ...prev, statsReset: resetPayload } : prev);
        }
      } else {
        await setDoc(doc(db, 'stats', 'global'), {
          statsReset: resetPayload
        }, { merge: true });
      }

      setIgnoreResetView(false);
      setShowResetStatsModal(false);
      toast.success('تم تصفير عرض الإحصائيات من الصفر بنجاح (البيانات الفعلية محفوظة بالكامل)');
    } catch (err: any) {
      console.error('Stats reset error:', err);
      toast.error(err?.message || 'تعذر تصفير الإحصائيات');
    } finally {
      setIsResettingStats(false);
    }
  };

  const handleRestoreStatsFromReset = async () => {
    if (!user) return;
    setIsResettingStats(true);
    try {
      const nowIso = new Date().toISOString();
      if (isScopedToSpecificStore && targetResetStoreId) {
        await setDoc(doc(db, 'storeProfiles', targetResetStoreId), {
          userId: targetResetStoreId,
          updatedAt: nowIso,
          statsReset: null
        }, { merge: true });
        if (targetResetStoreId === currentTargetStoreId) {
          setStoreProfile(prev => prev ? { ...prev, statsReset: null } : prev);
        }
      } else {
        await setDoc(doc(db, 'stats', 'global'), {
          statsReset: null
        }, { merge: true });
      }
      setIgnoreResetView(false);
      toast.success('تمت استعادة الإحصائيات التراكمية الكاملة بنجاح');
    } catch (err: any) {
      console.error('Stats restore error:', err);
      toast.error(err?.message || 'تعذر استعادة الإحصائيات');
    } finally {
      setIsResettingStats(false);
    }
  };

  const pendingReviewProductsCount = products.filter(p => p.status === 'pending_review').length;
  const pendingPriceOffersCount = priceOffers.filter(o => o.status === 'pending').length;

  const navItems: {
    id: AdminTab;
    label: string;
    group: 'core' | 'store' | 'admin';
    icon: React.ReactNode;
    count?: number;
    adminOnly?: boolean;
  }[] = [
    { id: 'overview', label: 'نظرة عامة', group: 'core', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'orders', label: 'الطلبات والتفاوض', group: 'core', icon: <ShoppingCart className="w-4 h-4" />, count: viewedTabs['orders'] ? undefined : (orders.filter(o => o.status === 'pending').length + pendingPriceOffersCount) },
    { id: 'products', label: 'المنتجات', group: 'core', icon: <Package className="w-4 h-4" />, count: !isAdmin ? products.filter(p => p.status === 'queued' || p.status === 'rejected').length : undefined },
    { id: 'buyer-requests', label: 'طلبات التسعير', group: 'core', icon: <Gavel className="w-4 h-4" />, count: viewedTabs['buyer-requests'] ? undefined : buyerRequests.filter(r => r.status === 'open').length },
    { id: 'store-profile', label: 'هوية المتجر', group: 'store', icon: <Store className="w-4 h-4" /> },
    { id: 'wallets', label: 'المحافظ والكوبونات', group: 'store', icon: <Wallet className="w-4 h-4" /> },
    ...(isAdmin ? [
      { id: 'product-review' as AdminTab, label: 'مراجعة المنتجات', group: 'admin' as const, icon: <ShieldCheck className="w-4 h-4" />, count: pendingReviewProductsCount, adminOnly: true },
      { id: 'stores' as AdminTab, label: 'المتاجر والتوثيق', group: 'admin' as const, icon: <Shield className="w-4 h-4" />, count: viewedTabs['stores'] ? undefined : allStoresList.length, adminOnly: true },
      { id: 'categories' as AdminTab, label: 'التصنيفات', group: 'admin' as const, icon: <ListFilter className="w-4 h-4" />, adminOnly: true },
      { id: 'users' as AdminTab, label: 'المستخدمون', group: 'admin' as const, icon: <Users className="w-4 h-4" />, count: viewedTabs['users'] ? undefined : users.length, adminOnly: true },
      { id: 'store-accounts' as AdminTab, label: 'الحسابات', group: 'admin' as const, icon: <KeyRound className="w-4 h-4" />, adminOnly: true },
      { id: 'settings' as AdminTab, label: 'الإعدادات والبانر', group: 'admin' as const, icon: <SettingsIcon className="w-4 h-4" />, adminOnly: true },
      { id: 'server' as AdminTab, label: 'السيرفر', group: 'admin' as const, icon: <Server className="w-4 h-4" />, adminOnly: true }
    ] : [])
  ];

  const activeNavItem = navItems.find(n => n.id === activeTab) || navItems[0];
  const mobileQuickTabIds: AdminTab[] = isAdmin
    ? ['overview', 'orders', 'products', 'product-review', 'settings']
    : ['overview', 'orders', 'products', 'store-profile', 'wallets'];
  const mobileQuickTabs = navItems.filter(item => mobileQuickTabIds.includes(item.id));

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6" dir="rtl">
      {/* Mobile Compact Header + Quick Tabs + Collapsible All-Sections Menu */}
      <div className="lg:hidden mb-4 bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl overflow-hidden">
        <div className="px-3.5 py-3 border-b border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between gap-2 bg-[#FAF9F6] dark:bg-[#101216]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg ${settings?.storeLogo ? 'bg-white border border-[#E5E2DA]' : `${getThemeClasses('bg')} text-white`} flex items-center justify-center overflow-hidden shrink-0`}>
              {settings?.storeLogo ? (
                <img src={settings.storeLogo} alt="Logo" className="w-full h-full object-contain p-0.5" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-medium truncate">
                لوحة التحكم · {settings?.storeName || 'إدارة النظام'}
              </p>
              <h2 className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2] truncate">
                {activeNavItem.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowMobileAllSections(prev => !prev)}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                showMobileAllSections
                  ? 'bg-[#111214] text-white border-[#111214] dark:bg-[#F4F4F2] dark:text-[#111214] dark:border-[#F4F4F2]'
                  : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>الأقسام</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMobileAllSections ? 'rotate-180' : ''}`} />
            </button>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="w-9 h-9 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex items-center justify-center text-[#111214] dark:text-[#F4F4F2]"
              aria-label={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Clean 1-row quick tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2">
          {mobileQuickTabs.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                handleTabClick(item.id);
                setShowMobileAllSections(false);
              }}
              className={`min-h-[42px] px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === item.id
                  ? 'border-[#111214] dark:border-[#F4F4F2] text-[#111214] dark:text-[#F4F4F2]'
                  : 'border-transparent text-[#5C5B57] dark:text-zinc-400'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && activeTab !== item.id && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] tabular-nums">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Collapsible Grouped All-Sections Drawer on Mobile */}
        {showMobileAllSections && (
          <div className="p-3.5 border-t border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-3.5">
            {(
              [
                { key: 'core', title: 'العمليات اليومية' },
                { key: 'store', title: 'المتجر والمالية' },
                ...(isAdmin ? [{ key: 'admin', title: 'إدارة المنصة' }] : [])
              ] as { key: 'core' | 'store' | 'admin'; title: string }[]
            ).map(groupMeta => {
              const groupItems = navItems.filter(n => n.group === groupMeta.key);
              if (groupItems.length === 0) return null;
              return (
                <div key={groupMeta.key} className="space-y-1.5">
                  <p className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 px-1">{groupMeta.title}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {groupItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          handleTabClick(item.id);
                          setShowMobileAllSections(false);
                        }}
                        className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold border flex items-center justify-between gap-2 transition ${
                          activeTab === item.id
                            ? `${getThemeClasses('bg')} text-white border-transparent`
                            : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0 truncate">
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.count !== undefined && item.count > 0 && activeTab !== item.id && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] tabular-nums shrink-0">
                            {item.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop 2-Pane Architectural Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr] gap-6 items-start">
        {/* Desktop Grouped Sidebar */}
        <aside className="hidden lg:block sticky top-20 bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${settings?.storeLogo ? 'bg-white border border-[#E5E2DA]' : `${getThemeClasses('bg')} text-white`} flex items-center justify-center overflow-hidden shrink-0`}>
              {settings?.storeLogo ? (
                <img src={settings.storeLogo} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base text-[#111214] dark:text-[#F4F4F2] truncate">لوحة التحكم</h2>
              <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 truncate">{settings?.storeName || 'إدارة النظام'}</p>
            </div>
          </div>

          <nav className="p-2.5 space-y-4">
            <div className="space-y-1">
              <p className="text-[10.5px] font-bold text-[#5C5B57] dark:text-zinc-400 px-3 py-1">العمليات اليومية</p>
              {navItems.filter(n => n.group === 'core').map(item => (
                <NavItem
                  key={item.id}
                  active={activeTab === item.id}
                  onClick={() => handleTabClick(item.id)}
                  icon={item.icon}
                  label={item.label}
                  count={viewedTabs[item.id] ? undefined : item.count}
                />
              ))}
            </div>

            <div className="pt-3 border-t border-[#E5E2DA] dark:border-[#232730] space-y-1">
              <p className="text-[10.5px] font-bold text-[#5C5B57] dark:text-zinc-400 px-3 py-1">المتجر والمالية</p>
              {navItems.filter(n => n.group === 'store').map(item => (
                <NavItem
                  key={item.id}
                  active={activeTab === item.id}
                  onClick={() => handleTabClick(item.id)}
                  icon={item.icon}
                  label={item.label}
                  count={viewedTabs[item.id] ? undefined : item.count}
                />
              ))}
            </div>

            {isAdmin && (
              <div className="pt-3 border-t border-[#E5E2DA] dark:border-[#232730] space-y-1">
                <p className="text-[10.5px] font-bold text-[#5C5B57] dark:text-zinc-400 px-3 py-1">إدارة المنصة</p>
                {navItems.filter(n => n.group === 'admin').map(item => (
                  <NavItem
                    key={item.id}
                    active={activeTab === item.id}
                    onClick={() => handleTabClick(item.id)}
                    icon={item.icon}
                    label={item.label}
                    count={viewedTabs[item.id] ? undefined : item.count}
                  />
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-[#E5E2DA] dark:border-[#232730] flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex-1 min-h-[40px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition whitespace-nowrap"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                <span>{isDarkMode ? 'نهاري' : 'ليلي'}</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                  title="رمز QR المتجر"
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR</span>
                </button>
              )}
            </div>
          </nav>
        </aside>

        {/* Main Content Workspace */}
        <main className="min-w-0 bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl overflow-hidden min-h-[70vh]">
          {/* Contextual Top Breadcrumb Bar */}
          <div className="hidden sm:flex items-center justify-between gap-4 px-6 lg:px-8 py-3.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6]/70 dark:bg-[#101216]/70">
            <div className="flex items-center gap-2 text-xs font-medium text-[#5C5B57] dark:text-zinc-400">
              <span>لوحة التحكم</span>
              <span aria-hidden="true">/</span>
              <span className="font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                {activeNavItem.icon}
                <span>{activeNavItem.label}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {currentTargetStoreId && (
                <Link
                  to={`/store/${currentTargetStoreId}`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>معاينة المتجر</span>
                </Link>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {/* TAB: OVERVIEW */}
              {activeTab === 'overview' && (() => {
                const overviewReport = computeOverviewReport({
                  mode: reportPeriodMode,
                  reportDay,
                  reportMonth,
                  reportCustomStart,
                  reportCustomEnd,
                  orders,
                  products,
                  users,
                  isAdmin,
                  selectedStoreId: isAdmin ? selectedReportStoreId : 'all',
                  totalVisitors: globalStats.totalVisitors,
                  dailyVisits: globalStats.dailyVisits,
                  realRegisteredCount,
                  activeReset: activeOverviewReset,
                  ignoreResetView
                });

                const applyCustomQuickRange = (minutesBack: number) => {
                  const end = new Date();
                  const start = new Date(end.getTime() - minutesBack * 60 * 1000);
                  setReportCustomStart(getLocalDateTimeInputValue(start));
                  setReportCustomEnd(getLocalDateTimeInputValue(end));
                };

                const displayedPeriodOrders = showAllPeriodOrders
                  ? overviewReport.periodOrders
                  : overviewReport.periodOrders.slice(0, 5);

                const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

                return (
                <div className="space-y-6">
                  {/* Overview Clean Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h1 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">نظرة عامة</h1>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5B57] dark:text-zinc-400 font-medium mt-1">
                        <span>{overviewReport.periodLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">{realOnlineCount} متصل الآن</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setProductForm({ title: '', price: '', description: '', stock: null, category: 'عام', images: [], status: isAdmin ? 'active' : 'queued', variants: [], hasOffer: false, offerType: 'discount', originalPrice: '', discountPercent: '', offerTitle: '', offerExtras: '', offerExpiresAt: '', noDelivery: false, isPreOrderEnabled: true, depositAmount: null, reservationDurationDays: 3 })}
                        className={`min-h-[40px] px-4 py-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة منتج</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetStatsModal(true)}
                        disabled={isResettingStats}
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-bold text-[#5C5B57] dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 transition disabled:opacity-50 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>تصفير العداد</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Shortcuts Bar */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => handleTabClick('orders')}
                      className="p-3.5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6]/70 dark:bg-[#101216] hover:bg-white dark:hover:bg-[#181B20] text-right transition flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">طلبات الشراء</p>
                        <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums mt-0.5">
                          {pendingOrdersCount > 0 ? `${pendingOrdersCount} بانتظار التنفيذ` : `${orders.length} إجمالي الطلبات`}
                        </p>
                      </div>
                      <ShoppingCart className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                    </button>

                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleTabClick('product-review')}
                        className="p-3.5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6]/70 dark:bg-[#101216] hover:bg-white dark:hover:bg-[#181B20] text-right transition flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">مراجعة المنتجات</p>
                          <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums mt-0.5">
                            {pendingReviewProductsCount > 0 ? `${pendingReviewProductsCount} بانتظار القرار` : 'كل المنتجات مراجعة'}
                          </p>
                        </div>
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTabClick('products')}
                        className="p-3.5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6]/70 dark:bg-[#101216] hover:bg-white dark:hover:bg-[#181B20] text-right transition flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">المنتجات</p>
                          <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums mt-0.5">
                            {products.length} منتج مسجل
                          </p>
                        </div>
                        <Package className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTabClick('store-profile')}
                      className="p-3.5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6]/70 dark:bg-[#101216] hover:bg-white dark:hover:bg-[#181B20] text-right transition flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">هوية المتجر</p>
                        <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2] truncate mt-0.5">
                          {storeProfile?.name || 'تعديل الشعار والستايل'}
                        </p>
                      </div>
                      <Store className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                    </button>

                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsSubTab('banners');
                          handleTabClick('settings');
                        }}
                        className="p-3.5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6]/70 dark:bg-[#101216] hover:bg-white dark:hover:bg-[#181B20] text-right transition flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">البانر والمظهر</p>
                          <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums mt-0.5">
                            {bannerAds.length}/{MAX_BANNER_ADS} إعلانات نشطة
                          </p>
                        </div>
                        <Palette className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTabClick('wallets')}
                        className="p-3.5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6]/70 dark:bg-[#101216] hover:bg-white dark:hover:bg-[#181B20] text-right transition flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">المحافظ المالية</p>
                          <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2] mt-0.5">
                            حسابات التحويل والدفع
                          </p>
                        </div>
                        <Wallet className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                      </button>
                    )}
                  </div>

                  {/* Clean Segmented Period Filter Bar */}
                  <div className="p-3 sm:p-3.5 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6]/70 dark:bg-[#101216] space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] self-start overflow-x-auto max-w-full">
                        {(
                          [
                            { id: 'all', label: 'الكل' },
                            { id: 'daily', label: 'يومي' },
                            { id: 'monthly', label: 'شهري' },
                            { id: 'custom', label: 'فترة مخصصة' }
                          ] as { id: ReportPeriodMode; label: string }[]
                        ).map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setReportPeriodMode(tab.id);
                              setShowAllPeriodOrders(false);
                            }}
                            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
                              reportPeriodMode === tab.id
                                ? 'bg-[#111214] text-white dark:bg-[#F4F4F2] dark:text-[#111214]'
                                : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {isAdmin && allStoresList.length > 0 && (
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 shrink-0">المتجر:</label>
                          <select
                            value={selectedReportStoreId}
                            onChange={e => {
                              setSelectedReportStoreId(e.target.value);
                              setShowAllPeriodOrders(false);
                            }}
                            className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-md px-2.5 py-1.5 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 max-w-[200px]"
                          >
                            <option value="all">كل المتاجر (المنصة)</option>
                            {allStoresList.map(st => (
                              <option key={st.id} value={st.id}>{st.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Daily Picker */}
                    {reportPeriodMode === 'daily' && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                        <button
                          type="button"
                          onClick={() => setReportDay(prev => shiftLocalDateKey(prev, -1))}
                          className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center gap-1"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>اليوم السابق</span>
                        </button>
                        <input
                          type="date"
                          value={reportDay}
                          onChange={e => setReportDay(e.target.value || getLocalDateKey())}
                          className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-md px-3 py-1.5 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => setReportDay(prev => shiftLocalDateKey(prev, 1))}
                          className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center gap-1"
                        >
                          <span>اليوم التالي</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportDay(getLocalDateKey())}
                          className="px-2.5 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                        >
                          اليوم
                        </button>
                      </div>
                    )}

                    {/* Monthly Picker */}
                    {reportPeriodMode === 'monthly' && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                        <button
                          type="button"
                          onClick={() => setReportMonth(prev => shiftLocalMonthKey(prev, -1))}
                          className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center gap-1"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>الشهر السابق</span>
                        </button>
                        <input
                          type="month"
                          value={reportMonth}
                          onChange={e => setReportMonth(e.target.value || getLocalMonthKey())}
                          className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-md px-3 py-1.5 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => setReportMonth(prev => shiftLocalMonthKey(prev, 1))}
                          className="px-2.5 py-1.5 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] flex items-center gap-1"
                        >
                          <span>الشهر التالي</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportMonth(getLocalMonthKey())}
                          className="px-2.5 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                        >
                          هذا الشهر
                        </button>
                      </div>
                    )}

                    {/* Custom Exact Date & Time Picker */}
                    {reportPeriodMode === 'custom' && (
                      <div className="space-y-2.5 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block">من تاريخ ووقت:</label>
                            <input
                              type="datetime-local"
                              value={reportCustomStart}
                              onChange={e => setReportCustomStart(e.target.value)}
                              className="w-full bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-md px-3 py-1.5 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none tabular-nums"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block">إلى تاريخ ووقت:</label>
                            <input
                              type="datetime-local"
                              value={reportCustomEnd}
                              onChange={e => setReportCustomEnd(e.target.value)}
                              className="w-full bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-md px-3 py-1.5 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none tabular-nums"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 ml-1">اختصارات:</span>
                          {[
                            { label: 'آخر ساعة', mins: 60 },
                            { label: 'آخر 24 ساعة', mins: 24 * 60 },
                            { label: 'آخر 7 أيام', mins: 7 * 24 * 60 },
                            { label: 'آخر 30 يوماً', mins: 30 * 24 * 60 }
                          ].map(preset => (
                            <button
                              key={preset.mins}
                              type="button"
                              onClick={() => applyCustomQuickRange(preset.mins)}
                              className="px-2.5 py-1 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[11px] font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        {overviewReport.isRangeInvalid && (
                          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            تأكد من أن تاريخ البداية يسبق تاريخ النهاية.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Active Stats Reset Notice Banner */}
                  {activeOverviewReset && (
                    <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <History className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold text-amber-900 dark:text-amber-200">
                            {ignoreResetView
                              ? 'تستعرض الآن السجل التراكمي الكامل (متضمن ما قبل التصفير)'
                              : `تم تصفير عرض الإحصائيات بتاريخ ${formatArabicDateTime(activeOverviewReset.resetAt)}`}
                          </p>
                          <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                            {overviewReport.isWindowBeforeReset
                              ? 'الفترة المختارة تقع قبل لحظة التصفير. اضغط «عرض ما قبل التصفير» لمعاينة أداء المتجر وقتها.'
                              : 'الأرقام المعروضة تبدأ من الصفر فقط داخل التقرير؛ جميع الطلبات والمنتجات والمستخدمين الفعليين محفوظون بالكامل.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIgnoreResetView(prev => !prev)}
                          className="px-2.5 py-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#131519] text-[11px] font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
                        >
                          {ignoreResetView ? 'العودة لما بعد التصفير' : 'عرض ما قبل التصفير'}
                        </button>
                        <button
                          type="button"
                          onClick={handleRestoreStatsFromReset}
                          disabled={isResettingStats}
                          className="px-2.5 py-1.5 rounded-md bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold transition disabled:opacity-50"
                        >
                          إلغاء التصفير (استعادة الكل)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 4-Cell Consolidated Hairline KPI Ledger */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden bg-[#FAF9F6] dark:bg-[#101216] divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730]">
                    <StatCard
                      label={
                        reportPeriodMode === 'all'
                          ? 'إجمالي الزيارات'
                          : reportPeriodMode === 'daily'
                            ? 'زيارات اليوم المختار'
                            : reportPeriodMode === 'monthly'
                              ? 'زيارات الشهر'
                              : 'زيارات الفترة'
                      }
                      value={overviewReport.visitsCount}
                      icon={<Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
                      trend={`${realOnlineCount} متصل`}
                    />
                    <StatCard
                      label={overviewReport.registeredOrCustomersLabel}
                      value={overviewReport.registeredOrCustomersCount}
                      icon={<Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      trend={overviewReport.registeredOrCustomersTrend}
                    />
                    <StatCard
                      label={overviewReport.ordersCardLabel}
                      value={`${overviewReport.ordersCardValue} طلب`}
                      icon={<ShoppingCart className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                      trend={overviewReport.ordersCardTrend}
                    />
                    <StatCard
                      label={overviewReport.salesCardLabel}
                      value={`${overviewReport.totalRevenue.toLocaleString()} ر.ي`}
                      icon={<DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      trend={`${overviewReport.validOrdersCount} طلب فعّال`}
                    />
                  </div>

                  {/* Period Performance Breakdown Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden bg-white dark:bg-[#131519] divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730]">
                    <div className="p-3 sm:p-3.5 text-center space-y-0.5">
                      <p className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">مكتملة (تم التسليم)</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {overviewReport.deliveredCount} طلب · {overviewReport.deliveredRevenue.toLocaleString()} ر.ي
                      </p>
                    </div>
                    <div className="p-3 sm:p-3.5 text-center space-y-0.5">
                      <p className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">قيد التجهيز والشحن</p>
                      <p className="text-sm font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                        {overviewReport.inProgressCount} طلب
                      </p>
                    </div>
                    <div className="p-3 sm:p-3.5 text-center space-y-0.5">
                      <p className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">حجوزات العربون</p>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                        {overviewReport.reservedCount} حجز
                      </p>
                    </div>
                    <div className="p-3 sm:p-3.5 text-center space-y-0.5">
                      <p className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">ملغاة / منتهية</p>
                      <p className="text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                        {overviewReport.cancelledCount} طلب
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-3 sm:p-3.5 text-center space-y-0.5">
                      <p className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">متوسط قيمة الطلب</p>
                      <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                        {overviewReport.avgOrderValue.toLocaleString()} ر.ي
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Period Orders */}
                    <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden bg-white dark:bg-[#131519]">
                      <div className="px-5 py-3.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between">
                        <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
                          <span>
                            {reportPeriodMode === 'all' ? 'أحدث الطلبات الفعلية' : `طلبات الفترة (${overviewReport.periodOrders.length})`}
                          </span>
                        </h3>
                        <div className="flex items-center gap-3">
                          {overviewReport.periodOrders.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setShowAllPeriodOrders(prev => !prev)}
                              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                            >
                              {showAllPeriodOrders ? 'عرض أقل' : `عرض الكل (${overviewReport.periodOrders.length})`}
                            </button>
                          )}
                          <button
                            onClick={() => handleTabClick('orders')}
                            className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition"
                          >
                            إدارة الطلبات
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                        {displayedPeriodOrders.length === 0 ? (
                          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium py-8 text-center px-4">
                            {overviewReport.isResetApplied && reportPeriodMode === 'all'
                              ? 'لا توجد طلبات مسجلة منذ تصفير الإحصائيات (الطلبات السابقة محفوظة في تبويب طلبات الشراء)'
                              : 'لا توجد طلبات مسجلة في هذه الفترة'}
                          </p>
                        ) : (
                          displayedPeriodOrders.map(order => (
                            <div
                              key={order.id}
                              onClick={() => setViewingOrder(order)}
                              className="p-4 flex justify-between items-center hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-md flex items-center justify-center font-mono text-[10px] font-bold text-[#111214] dark:text-[#F4F4F2]">
                                  #{order.id.slice(-4)}
                                </div>
                                <div>
                                  <p className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2]">{order.customerName}</p>
                                  <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                                    {formatArabicDateTime(order.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-left space-y-1">
                                <p className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                                  {Number(order.total || 0).toLocaleString()} ر.ي
                                </p>
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusColors[order.status] || ''}`}>
                                  {statusArabic[order.status] || order.status}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Best Sellers in Period */}
                    <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden bg-white dark:bg-[#131519]">
                      <div className="px-5 py-3.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between">
                        <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
                          <span>
                            {reportPeriodMode === 'all' ? 'المنتجات الأكثر مبيعاً' : 'الأكثر مبيعاً في الفترة'}
                          </span>
                        </h3>
                        <button
                          onClick={() => handleTabClick('products')}
                          className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition"
                        >
                          إدارة المنتجات
                        </button>
                      </div>
                      <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                        {overviewReport.bestSellers.length === 0 ? (
                          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium py-8 text-center">
                            لا توجد منتجات مسجلة بعد
                          </p>
                        ) : (
                          overviewReport.bestSellers.slice(0, 5).map((product, idx) => (
                            <div key={product.id || idx} className="p-3.5 flex items-center gap-3.5">
                              <div className="w-12 h-12 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-md overflow-hidden shrink-0">
                                {product.images?.[0] && <img src={product.images[0]} className="w-full h-full object-cover" alt="" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] truncate">{product.title}</p>
                                <div className="flex justify-between items-center mt-0.5">
                                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                    {Number(product.price || 0).toLocaleString()} ر.ي
                                  </span>
                                  <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-bold tabular-nums">
                                    {product.soldCount > 0 ? `${product.soldCount} مبيعة` : '0 مبيعة'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* TAB: STORE PROFILE */}
              {activeTab === 'store-profile' && storeProfile && (
                <div className="space-y-8">
                  {isAdmin && (
                    <div className="p-4 sm:p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] flex items-center justify-center shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2]">
                              وضع إدارة المتاجر
                            </span>
                            {currentTargetStoreId !== user?.uid && (
                              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                تعديل متجر تاجر آخر
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm sm:text-base font-bold mt-1 text-[#111214] dark:text-[#F4F4F2]">
                            {currentTargetStoreId === user?.uid
                              ? 'تعديل: متجرك الشخصي / حساب المنصة الرئيسي'
                              : `تعديل متجر: ${storeProfile?.name || ('متجر رقم ' + currentTargetStoreId.slice(0, 8))}`}
                          </h3>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <select
                          value={selectedStoreId || user?.uid || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleSelectStore(val === user?.uid ? null : val);
                          }}
                          className="min-h-[44px] text-xs font-bold px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] cursor-pointer"
                        >
                          <option value={user?.uid}>متجري الشخصي (حساب الإدارة)</option>
                          {allStoresList.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.verified ? '(موثق)' : ''}
                            </option>
                          ))}
                        </select>

                        {selectedStoreId && selectedStoreId !== user?.uid && (
                          <button
                            type="button"
                            onClick={() => handleSelectStore(null)}
                            className="min-h-[44px] px-4 py-2 rounded-lg font-bold text-xs bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] transition"
                          >
                            العودة لمتجري
                          </button>
                        )}

                        {currentTargetStoreId && (
                          <Link
                            to={`/store/${currentTargetStoreId}`}
                            target="_blank"
                            className={`min-h-[44px] px-4 py-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>معاينة المتجر</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">الملف التجاري</h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        {currentTargetStoreId === user?.uid
                          ? 'معلومات متجرك والهوية المرئية وروابط التواصل'
                          : `معلومات وبيانات المتجر (${storeProfile?.name || 'المحدد'})`}
                      </p>
                    </div>
                    <button
                      onClick={handleUpdateStoreProfile}
                      disabled={isSaving}
                      className={`min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white px-6 py-2.5 rounded-lg font-bold text-xs transition disabled:opacity-50`}
                    >
                      {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                  </div>

                  {/* Sub-Tabs for Store Profile */}
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] overflow-x-auto max-w-full">
                    {[
                      { id: 'identity', label: 'الهوية والتوثيق', icon: <Store className="w-3.5 h-3.5" /> },
                      { id: 'location', label: 'العنوان والتواصل', icon: <MapPin className="w-3.5 h-3.5" /> },
                      { id: 'style', label: 'الستايل والتصنيف', icon: <Palette className="w-3.5 h-3.5" /> }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setProfileSubTab(tab.id as any)}
                        className={`px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                          profileSubTab === tab.id
                            ? 'bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] shadow-xs border border-[#E5E2DA]/80 dark:border-[#232730]'
                            : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {profileSubTab === 'identity' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-4 space-y-6">
                      <ImageEditor
                        label="شعار المتجر"
                        value={storeProfile.logoUrl}
                        onChange={(v: string) => setStoreProfile({ ...storeProfile, logoUrl: v })}
                      />

                      {/* Verification Status Block */}
                      {(() => {
                        const isVerified = Boolean(storeProfile.verified);
                        const hasExpiry = Boolean(storeProfile.verifiedUntil && storeProfile.verifiedUntil !== '');
                        const expDate = hasExpiry ? new Date(storeProfile.verifiedUntil!) : null;
                        const isExpired = hasExpiry && expDate ? expDate.getTime() < Date.now() : false;
                        const diffDays = hasExpiry && expDate ? Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                        const formattedDate = hasExpiry && storeProfile.verifiedUntil ? formatArabicVerificationDate(storeProfile.verifiedUntil) : '';

                        return (
                          <div className="p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  isVerified && !isExpired
                                    ? 'bg-emerald-600 text-white'
                                    : isExpired
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400'
                                }`}>
                                  <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2]">حالة التوثيق والاعتماد</h4>
                                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400">شارة التوثيق المعتمدة</span>
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                isVerified && !isExpired
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                  : isExpired
                                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-white text-[#5C5B57] border-[#E5E2DA] dark:bg-[#131519] dark:text-zinc-400 dark:border-[#232730]'
                              }`}>
                                {isVerified && !isExpired ? 'موثق ومعتمد' : isExpired ? 'منتهي الصلاحية' : 'غير موثق'}
                              </span>
                            </div>

                            <div className="p-3 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-xs space-y-1.5">
                              {isVerified && !isExpired ? (
                                hasExpiry ? (
                                  <>
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="text-[#5C5B57] dark:text-zinc-400">ينتهي في:</span>
                                      <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{formattedDate}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-[#5C5B57] dark:text-zinc-400">
                                      <span>المتبقي:</span>
                                      <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">{diffDays} يوماً</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                                    <Check className="w-4 h-4 shrink-0" />
                                    <span>توثيق دائم مدى الحياة بدون تاريخ انتهاء</span>
                                  </div>
                                )
                              ) : isExpired ? (
                                <div className="text-amber-800 dark:text-amber-300 font-bold space-y-1">
                                  <p>انتهت فترة التوثيق السابقة في: <span className="underline">{formattedDate}</span></p>
                                  <p className="text-[11px] opacity-85">يرجى تجديد التوثيق لاستمرار ظهور الشارة المعتمدة.</p>
                                </div>
                              ) : (
                                <p className="text-[#5C5B57] dark:text-zinc-400 text-[11px]">
                                  المتجر حالياً بدون علامة التوثيق. فعّل التوثيق لزيادة الموثوقية.
                                </p>
                              )}
                            </div>

                            {isAdmin && (
                              <div className="space-y-2">
                                <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block">
                                  خيارات تجديد وتفعيل التوثيق:
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSetVerification(12)}
                                    className="min-h-[40px] px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                                  >
                                    تجديد لسنة
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetVerification(24)}
                                    className="min-h-[40px] px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition"
                                  >
                                    تجديد لسنتين
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetVerification('lifetime')}
                                    className="col-span-2 min-h-[40px] px-3 py-2 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] font-bold text-xs transition hover:opacity-90"
                                  >
                                    تفعيل توثيق دائم (مدى الحياة)
                                  </button>
                                  {isVerified && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetVerification(0)}
                                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline col-span-2 py-1 text-center"
                                    >
                                      إيقاف التوثيق مؤقتاً
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="md:col-span-8 space-y-6">
                      <ImageEditor
                        label="بانر المتجر"
                        value={storeProfile.bannerUrl}
                        onChange={(v: string) => setStoreProfile({ ...storeProfile, bannerUrl: v })}
                      />
                      <AdminInput
                        label="اسم المتجر"
                        value={storeProfile.name}
                        onChange={(v: string) => setStoreProfile({ ...storeProfile, name: v })}
                        placeholder={`مثال: ${localSettings.storeName || 'متجر صنعاء'}`}
                      />
                      <AdminTextarea
                        label="وصف المتجر"
                        value={storeProfile.description}
                        onChange={(v: string) => setStoreProfile({ ...storeProfile, description: v })}
                        placeholder="اكتب نبذة عن متجرك ومنتجاتك..."
                      />
                    </div>
                  </div>
                  )}

                  {profileSubTab === 'location' && (
                  <div className="space-y-6">
                      {/* Store Real-World Physical Address & GPS */}
                      <div className="p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] flex items-center justify-center shrink-0">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                                عنوان المتجر الفعلي والموقع الجغرافي (في الواقع)
                              </h4>
                              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium">
                                يظهر للعملاء في صفحة متجرك والمنتجات وعند حجز الاستلام من المتجر، ويستخدمه المندوب للتوجه إليك
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleDetectStoreGps}
                            disabled={detectingGps}
                            className={`min-h-[44px] px-4 py-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0`}
                          >
                            {detectingGps ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>جاري التقاط الإحداثيات...</span>
                              </>
                            ) : (
                              <>
                                <Navigation className="w-3.5 h-3.5" />
                                <span>تحديد موقع المحل GPS</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-[#F4F4F2]">
                              المحافظة / المدينة
                            </label>
                            <select
                              value={storeProfile.city || 'صنعاء'}
                              onChange={(e) => setStoreProfile({ ...storeProfile, city: e.target.value })}
                              className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold outline-none"
                            >
                              {['صنعاء', 'عدن', 'تعز', 'حضرموت', 'إب', 'الحديدة', 'ذمار', 'مأرب', 'صعدة', 'لحج', 'أبين', 'شبوة', 'المهرة', 'عمران', 'حجة', 'البيضاء', 'الجوف', 'ريمة', 'المحويت', 'سقطرى'].map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          <AdminInput
                            label="المديرية / الحي / المنطقة"
                            value={storeProfile.district || ''}
                            onChange={(v: string) => setStoreProfile({ ...storeProfile, district: v })}
                            placeholder="مثال: حي حدة / المنصورة / مديرية..."
                          />

                          <div className="sm:col-span-2">
                            <AdminInput
                              label="العنوان التفصيلي (الشارع، المركز/المبنى، رقم المحل)"
                              value={storeProfile.address || ''}
                              onChange={(v: string) => setStoreProfile({ ...storeProfile, address: v })}
                              placeholder="مثال: شارع حدة - بجانب جولة المدينة - مركز النور التجاري - محل رقم 4"
                            />
                          </div>

                          <AdminInput
                            label="أقرب معلم بارز (اختياري)"
                            value={storeProfile.landmark || ''}
                            onChange={(v: string) => setStoreProfile({ ...storeProfile, landmark: v })}
                            placeholder="مثال: أمام جامع الخير / مقابل مستشفى..."
                          />

                          <AdminInput
                            label="أوقات الدوام / العمل (اختياري)"
                            value={storeProfile.workingHours || ''}
                            onChange={(v: string) => setStoreProfile({ ...storeProfile, workingHours: v })}
                            icon={<Clock className="w-4 h-4" />}
                            placeholder="مثال: يومياً 9 صباحاً - 10 مساءً"
                          />

                          <AdminInput
                            label="هاتف المحل المباشر (اختياري)"
                            value={storeProfile.phone || ''}
                            onChange={(v: string) => setStoreProfile({ ...storeProfile, phone: v })}
                            icon={<Phone className="w-4 h-4" />}
                            dir="ltr"
                            placeholder="77xxxxxxx / 01xxxxxx"
                          />

                          <div>
                            <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-[#F4F4F2]">
                              رابط موقع المتجر من خرائط Google (اختياري)
                            </label>
                            <input
                              type="url"
                              dir="ltr"
                              value={storeProfile.googleMapsUrl || ''}
                              onChange={(e) => setStoreProfile({ ...storeProfile, googleMapsUrl: e.target.value })}
                              placeholder="https://maps.google.com/?q=..."
                              className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] text-xs font-medium outline-none text-left"
                            />
                          </div>
                        </div>

                        {(storeProfile.location?.lat && storeProfile.location?.lng) && (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold tabular-nums">
                              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>إحداثيات GPS محفوظة:</span>
                              <span className="font-mono" dir="ltr">{storeProfile.location.lat}, {storeProfile.location.lng}</span>
                            </div>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${storeProfile.location.lat},${storeProfile.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
                            >
                              <span>معاينة وملاحة Google Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleUpdateStoreProfile}
                            disabled={isSaving}
                            className={`min-h-[42px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white px-5 py-2 rounded-lg font-bold text-xs transition disabled:opacity-50 inline-flex items-center gap-1.5`}
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ عنوان المتجر الفعلي'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-5 border-t border-[#E5E2DA] dark:border-[#232730]">
                        <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2] mb-4">روابط التواصل الاجتماعي</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <AdminInput label="واتساب" value={storeProfile.whatsapp || ''} onChange={(v: string) => setStoreProfile({ ...storeProfile, whatsapp: v })} icon={<Phone className="w-4 h-4" />} placeholder="96777xxxxxxx" />
                          <AdminInput label="تليجرام" value={storeProfile.telegram || ''} onChange={(v: string) => setStoreProfile({ ...storeProfile, telegram: v })} icon={<Send className="w-4 h-4" />} placeholder="t.me/username" />
                          <AdminInput label="انستجرام" value={storeProfile.instagram || ''} onChange={(v: string) => setStoreProfile({ ...storeProfile, instagram: v })} icon={<Instagram className="w-4 h-4" />} placeholder="username" />
                          <AdminInput label="تيك توك" value={storeProfile.tiktok || ''} onChange={(v: string) => setStoreProfile({ ...storeProfile, tiktok: v })} icon={<Globe className="w-4 h-4" />} placeholder="username" />
                        </div>
                      </div>
                  </div>
                  )}

                  {profileSubTab === 'style' && (
                  <div className="space-y-6">
                      {/* Storefront Visual Style & Custom Accent */}
                      <div className="space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                              <Layout className="w-4 h-4" />
                              <span>ستايل وتصميم صفحة المتجر</span>
                            </h3>
                            <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-0.5">
                              اختر شكل عرض صفحة متجرك، اللون المميز لأزرارك وأسعارك، وإعلان الترحيب للزوار
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {STORE_LAYOUT_STYLES.map((styleOption) => {
                            const selected = (storeProfile.storeStyle || 'classic') === styleOption.id;
                            return (
                              <button
                                key={styleOption.id}
                                type="button"
                                onClick={() => setStoreProfile({ ...storeProfile, storeStyle: styleOption.id })}
                                className={`p-3.5 rounded-lg border text-right transition flex flex-col justify-between gap-1.5 ${
                                  selected
                                    ? 'border-[#111214] dark:border-[#F4F4F2] bg-[#FAF9F6] dark:bg-[#101216]'
                                    : 'border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#FAF9F6] dark:hover:bg-[#101216]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <span className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2]">
                                    {styleOption.name}
                                  </span>
                                  {selected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                                </div>
                                <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 leading-relaxed">
                                  {styleOption.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5" />
                            <span>اللون المميز لصفحة المتجر</span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {STORE_ACCENT_PALETTES.map((accent) => {
                              const selected = (storeProfile.themeColor || 'default') === accent.id;
                              return (
                                <button
                                  key={accent.id}
                                  type="button"
                                  onClick={() => setStoreProfile({ ...storeProfile, themeColor: accent.id })}
                                  className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 transition ${
                                    selected
                                      ? 'border-[#111214] dark:border-[#F4F4F2] bg-[#111214] text-white dark:bg-[#F4F4F2] dark:text-[#111214]'
                                      : 'border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26]'
                                  }`}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 dark:border-white/20"
                                    style={{ backgroundColor: accent.swatch }}
                                  />
                                  <span className="whitespace-nowrap">{accent.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                              <Megaphone className="w-3.5 h-3.5" />
                              <span>شريط إعلان المتجر للزوار (اختياري)</span>
                            </label>
                            <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400">يظهر أعلى صفحة متجرك</span>
                          </div>
                          <input
                            type="text"
                            maxLength={250}
                            value={storeProfile.storeAnnouncement || ''}
                            onChange={(e) => setStoreProfile({ ...storeProfile, storeAnnouncement: e.target.value })}
                            placeholder="مثال: توصيل مجاني داخل صنعاء للطلبات فوق 15,000 ر.ي هذا الأسبوع"
                            className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2.5 font-medium text-sm text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57]/60 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-[#131519] focus:border-[#111214] dark:focus:border-zinc-400 outline-none transition"
                          />
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="pt-5 border-t border-[#E5E2DA] dark:border-[#232730] space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                                تصنيف المتجر في الدليل (للإدارة فقط)
                              </h3>
                              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                                اختر الأقسام التي ينتمي إليها هذا المتجر ليظهر ضمن قوائم دليل المتاجر (صيدليات، مولات، محلات...)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveTab('categories')}
                              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                            >
                              إدارة قوائم المتاجر
                            </button>
                          </div>
                          {storeCategories.length === 0 ? (
                            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 bg-[#FAF9F6] dark:bg-[#101216] border border-dashed border-[#E5E2DA] dark:border-[#232730] rounded-lg p-3">
                              لا توجد قوائم متاجر مضافة بعد. يمكنك إضافتها من تبويب «التصنيفات».
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {storeCategories.map((cat) => {
                                const activeList = Array.isArray(storeProfile.storeCategoryIds) ? storeProfile.storeCategoryIds : [];
                                const checked = activeList.includes(cat.id);
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                      const next = checked
                                        ? activeList.filter((id) => id !== cat.id)
                                        : [...activeList, cat.id];
                                      setStoreProfile({ ...storeProfile, storeCategoryIds: next });
                                    }}
                                    className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                                      checked
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                        : 'bg-[#FAF9F6] dark:bg-[#101216] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2]'
                                    }`}
                                  >
                                    {renderStoreCategoryIcon(cat.icon || cat.name, 'w-3.5 h-3.5 shrink-0')}
                                    <span>{cat.name}</span>
                                    {checked && <Check className="w-3.5 h-3.5" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                  )}
                </div>
              )}

              {/* TAB: WALLETS & COUPONS */}
              {activeTab === 'wallets' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">
                        المحافظ المالية وكوبونات الخصم
                      </h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        إدارة حسابات الدفع الإلكتروني وإنشاء أكواد الخصم الترويجية لعملائك
                      </p>
                    </div>
                    <div className="flex items-center p-1 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                      <button
                        type="button"
                        onClick={() => setWalletsSubTab('wallets')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          walletsSubTab === 'wallets'
                            ? `${getThemeClasses('bg')}`
                            : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                        }`}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>المحافظ الإلكترونية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalletsSubTab('coupons')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          walletsSubTab === 'coupons'
                            ? `${getThemeClasses('bg')}`
                            : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                        }`}
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>كوبونات الخصم</span>
                      </button>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="p-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          {walletsSubTab === 'coupons' ? <Ticket className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {walletsSubTab === 'coupons' ? 'إدارة كوبونات الخصم' : 'إدارة حسابات الدفع والتحويل'}
                          </span>
                          <p className="text-sm font-bold mt-1 text-[#111214] dark:text-[#F4F4F2]">
                            {currentTargetStoreId === user?.uid
                              ? 'إدارة: متجرك الشخصي / حساب المنصة'
                              : `إدارة متجر: ${storeProfile?.name || ('متجر رقم ' + currentTargetStoreId.slice(0, 8))}`}
                          </p>
                        </div>
                      </div>
                      {currentTargetStoreId !== user?.uid && (
                        <button
                          type="button"
                          onClick={() => handleSelectStore(null)}
                          className="min-h-[40px] px-4 py-2 rounded-lg font-bold text-xs bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                        >
                          التبديل إلى متجري الشخصي
                        </button>
                      )}
                    </div>
                  )}

                  {walletsSubTab === 'wallets' ? (
                    <WalletManagement merchantId={currentTargetStoreId || 'global'} />
                  ) : (
                    <CouponManager
                      storeId={currentTargetStoreId || 'global'}
                      storeName={storeProfile?.name || userData?.name || settings?.storeName || 'المتجر'}
                      isMasterView={isAdmin && currentTargetStoreId === user?.uid}
                    />
                  )}
                </div>
              )}

              {/* TAB: PRODUCTS */}
              {activeTab === 'products' && (() => {
                const queuedCount = products.filter(p => p.status === 'queued').length;
                const reviewCount = products.filter(p => p.status === 'pending_review').length;
                const activeCount = products.filter(p => p.status === 'active').length;
                const rejectedCount = products.filter(p => p.status === 'rejected').length;
                const draftCount = products.filter(p => p.status === 'draft').length;

                const statusTabs: { id: typeof productFilterTab; label: string; count: number }[] = [
                  { id: 'all', label: 'الكل', count: products.length },
                  { id: 'queued', label: 'قائمة الانتظار', count: queuedCount },
                  { id: 'pending_review', label: 'بانتظار الإدارة', count: reviewCount },
                  { id: 'active', label: 'منشور للعامة', count: activeCount },
                  { id: 'rejected', label: 'مرفوض', count: rejectedCount },
                  { id: 'draft', label: 'مسودة', count: draftCount },
                ];

                const visibleProducts = products
                  .filter(p => productFilterTab === 'all' || p.status === productFilterTab)
                  .filter(p => (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()));

                return (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">إدارة المنتجات وقائمة الانتظار</h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        {isAdmin
                          ? 'عرض، تعديل، ومراجعة المنتجات قبل اعتماد نشرها للعامة'
                          : 'أضف منتجاتك لقائمة انتظار المتجر، راجع جميع التفاصيل، ثم أرسلها لمراجعة الإدارة للنشر للعامة'}
                      </p>
                    </div>
                    <button
                      onClick={() => setProductForm({ title: '', price: '', description: '', stock: null, category: 'عام', images: [], status: isAdmin ? 'active' : 'queued', variants: [], hasOffer: false, offerType: 'discount', originalPrice: '', discountPercent: '', offerTitle: '', offerExtras: '', offerExpiresAt: '', noDelivery: false, isPreOrderEnabled: true, depositAmount: null, reservationDurationDays: 3 })}
                      className={`min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white px-5 py-2.5 rounded-lg font-bold text-xs transition flex items-center gap-2 self-start sm:self-auto`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة منتج جديد</span>
                    </button>
                  </div>

                  {/* Safety Workflow Notice */}
                  <div className="p-3.5 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">
                        نظام أمان النشر:
                      </span>
                      <span className="text-[#5C5B57] dark:text-zinc-400 font-medium">
                        قائمة انتظار المتجر ← معاينة كافة التفاصيل ← إرسال لمراجعة الإدارة ← اعتماد ونشر للعامة
                      </span>
                    </div>
                    {queuedCount > 0 && !isAdmin && (
                      <button
                        type="button"
                        onClick={() => setProductFilterTab('queued')}
                        className="px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold text-[11px] hover:bg-amber-100 transition"
                      >
                        لديك {queuedCount} منتجات بقائمة الانتظار جاهزة للإرسال
                      </button>
                    )}
                  </div>

                  {/* Sub-Filter Status Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[#E5E2DA] dark:border-[#232730] pb-2">
                    {statusTabs.map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setProductFilterTab(tab.id)}
                        className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                          productFilterTab === tab.id
                            ? 'bg-[#111214] text-white dark:bg-[#F4F4F2] dark:text-[#111214]'
                            : 'bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 border border-[#E5E2DA] dark:border-[#232730] hover:text-[#111214] dark:hover:text-[#F4F4F2]'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className="text-[10px] opacity-80 tabular-nums">({tab.count})</span>
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5C5B57] dark:text-zinc-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ابحث باسم المنتج أو السعر..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg py-2.5 pr-10 pl-4 font-medium text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57]/70 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-[#131519] focus:border-[#111214] dark:focus:border-zinc-400 outline-none transition"
                    />
                  </div>

                  <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 font-bold text-[11px]">
                            <th className="py-3.5 px-4">المنتج</th>
                            <th className="py-3.5 px-4">التصنيف</th>
                            <th className="py-3.5 px-4 text-center">السعر</th>
                            <th className="py-3.5 px-4 text-center">المخزون</th>
                            <th className="py-3.5 px-4 text-center">حالة الأمان والنشر</th>
                            <th className="py-3.5 px-4 text-left">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                          {visibleProducts.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-10 text-center text-xs font-medium text-[#5C5B57] dark:text-zinc-400">
                                لا توجد منتجات ضمن هذا التصنيف حالياً
                              </td>
                            </tr>
                          ) : visibleProducts.map(product => {
                              const statusMeta = getProductStatusMeta(product.status);
                              return (
                              <tr key={product.id} className="hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 bg-[#FAF9F6] dark:bg-[#101216] rounded-md overflow-hidden border border-[#E5E2DA] dark:border-[#232730] shrink-0">
                                      {product.images?.[0] && <img src={product.images[0]} className="w-full h-full object-cover" alt="" />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2]">{product.title}</p>
                                        {isProductOfferActive(product) && (
                                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                            {getProductOfferBadgeText(product)}
                                          </span>
                                        )}
                                        {getProductVariants(product).length > 0 && (
                                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF9F6] text-[#111214] border border-[#E5E2DA] dark:bg-[#101216] dark:text-zinc-200 dark:border-[#232730] inline-flex items-center gap-1 tabular-nums">
                                            <Layers className="w-2.5 h-2.5" />
                                            <span>{getProductVariants(product).length} أصناف</span>
                                          </span>
                                        )}
                                        {product.noDelivery && (
                                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 inline-flex items-center gap-1">
                                            <Store className="w-2.5 h-2.5" />
                                            <span>استلام من المتجر فقط · حجز {product.reservationDurationDays || 3}أ</span>
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                                        {product.createdAt ? (formatArabicDate(product.createdAt) || '—') : '—'}
                                      </p>
                                      {(productWatchersByProdId[product.id]?.count || 0) > 0 && (
                                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center gap-1 tabular-nums">
                                          <BellRing className="w-3 h-3 shrink-0" />
                                          <span>
                                            رادار العملاء: {productWatchersByProdId[product.id].count} مهتم
                                            {productWatchersByProdId[product.id].minTarget
                                              ? ` · أقل سعر مطلوب ${productWatchersByProdId[product.id].minTarget!.toLocaleString()} ر.ي`
                                              : ''}
                                          </span>
                                        </p>
                                      )}
                                      {product.status === 'rejected' && product.rejectionReason && (
                                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                                          سبب الرفض: {product.rejectionReason}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-bold text-[#111214] dark:text-[#F4F4F2] whitespace-nowrap">
                                  {product.category}
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <div className="flex flex-col items-center">
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                      {Number(product.price || 0).toLocaleString()} ر.ي
                                    </span>
                                    {Number(product.originalPrice || 0) > Number(product.price || 0) && (
                                      <span className="text-[10px] text-[#5C5B57] dark:text-zinc-500 line-through tabular-nums">
                                        {Number(product.originalPrice).toLocaleString()} ر.ي
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap tabular-nums">
                                  <span className={`font-bold ${product.stock === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#111214] dark:text-[#F4F4F2]'}`}>
                                    {product.stock === null || product.stock === undefined ? 'غير محدود' : `${product.stock} وحدة`}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusMeta.badgeClass}`}>
                                    {statusMeta.shortLabel}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-left whitespace-nowrap">
                                  <div className="flex justify-end items-center gap-1.5">
                                    {!isAdmin && (product.status === 'queued' || product.status === 'draft') && (
                                      <button
                                        type="button"
                                        onClick={() => setInspectingProduct(product)}
                                        className="min-h-[36px] px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1"
                                        title="معاينة التفاصيل وإرسال لمراجعة الإدارة"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>فحص وإرسال</span>
                                      </button>
                                    )}
                                    {isAdmin && product.status === 'pending_review' && (
                                      <button
                                        type="button"
                                        onClick={() => setInspectingProduct(product)}
                                        className="min-h-[36px] px-2.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition flex items-center gap-1"
                                        title="فحص المنتج واعتماده أو رفضه"
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>مراجعة</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setInspectingProduct(product)}
                                      className="w-9 h-9 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-md flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                                      title="معاينة جميع تفاصيل المنتج"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setProductForm({ ...product, images: product.images || [], variants: getProductVariants(product), noDelivery: Boolean(product.noDelivery), reservationDurationDays: product.reservationDurationDays || 3 })}
                                      className="w-9 h-9 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-md flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                                      title="تعديل المنتج"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirm({ id: product.id, type: 'products', title: product.title })}
                                      className="w-9 h-9 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-md flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                      title="حذف المنتج"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* TAB: ADMIN PRODUCT SAFETY REVIEW */}
              {activeTab === 'product-review' && isAdmin && (() => {
                const pendingList = products.filter(p => p.status === 'pending_review');
                const queuedList = products.filter(p => p.status === 'queued');
                const rejectedList = products.filter(p => p.status === 'rejected');
                const activeList = products.filter(p => p.status === 'active');

                const reviewItems = products
                  .filter(p => reviewQueueFilter === 'all' || p.status === reviewQueueFilter)
                  .filter(p => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (p.title || '').toLowerCase().includes(q) || (p.ownerName || '').toLowerCase().includes(q);
                  })
                  .sort((a, b) =>
                    new Date(b.submittedForReviewAt || b.updatedAt || b.createdAt || 0).getTime() -
                    new Date(a.submittedForReviewAt || a.updatedAt || a.createdAt || 0).getTime()
                  );

                return (
                  <div className="space-y-6">
                    <div className="pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">
                        مركز أمان ومراجعة المنتجات المنشورة
                      </h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        فحص كامل تفاصيل المنتجات الواردة من المتاجر والموافقة على نشرها للعامة أو رفضها لحماية المنصة
                      </p>
                    </div>

                    {/* 4-Cell Safety Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#E5E2DA] dark:border-[#232730] rounded-lg divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730] bg-[#FAF9F6] dark:bg-[#101216]">
                      <div className="p-4">
                        <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block">بانتظار المراجعة</span>
                        <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">{pendingList.length}</span>
                      </div>
                      <div className="p-4 border-r sm:border-r-0 border-[#E5E2DA] dark:border-[#232730]">
                        <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block">قائمة انتظار المتاجر</span>
                        <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{queuedList.length}</span>
                      </div>
                      <div className="p-4">
                        <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block">معتمد ومنشور</span>
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{activeList.length}</span>
                      </div>
                      <div className="p-4 border-r sm:border-r-0 border-[#E5E2DA] dark:border-[#232730]">
                        <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block">مرفوضة</span>
                        <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{rejectedList.length}</span>
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {[
                          { id: 'pending_review', label: `بانتظار القرار (${pendingList.length})` },
                          { id: 'queued', label: `قائمة انتظار المتاجر (${queuedList.length})` },
                          { id: 'rejected', label: `مرفوض (${rejectedList.length})` },
                          { id: 'active', label: `منشور (${activeList.length})` },
                          { id: 'all', label: `الكل (${products.length})` },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setReviewQueueFilter(tab.id as any)}
                            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                              reviewQueueFilter === tab.id
                                ? 'bg-[#111214] text-white dark:bg-[#F4F4F2] dark:text-[#111214]'
                                : 'bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 border border-[#E5E2DA] dark:border-[#232730]'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative sm:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5B57] dark:text-zinc-400 w-4 h-4 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="بحث بالمنتج أو المتجر..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full min-h-[40px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg py-2 pr-9 pl-3 text-xs font-medium outline-none"
                        />
                      </div>
                    </div>

                    {reviewItems.length === 0 ? (
                      <div className="p-10 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] text-center space-y-2">
                        <ShieldCheck className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-50" />
                        <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">لا توجد منتجات ضمن هذا التصنيف حالياً</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {reviewItems.map((product) => {
                          const storeObj = allStoreProfiles.find(sp => sp.id === product.ownerId || sp.userId === product.ownerId);
                          const storeLabel = product.ownerName || storeObj?.name || 'متجر مسجل';
                          const statusMeta = getProductStatusMeta(product.status);
                          const prodVariants = getProductVariants(product);

                          return (
                            <div
                              key={product.id}
                              className="p-4 sm:p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="flex items-start gap-3.5 min-w-0">
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] shrink-0">
                                  {product.images?.[0] ? (
                                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#5C5B57]">
                                      <Package className="w-5 h-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">{product.title}</h4>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusMeta.badgeClass}`}>
                                      {statusMeta.shortLabel}
                                    </span>
                                    {product.noDelivery && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 inline-flex items-center gap-1">
                                        <Store className="w-3 h-3" />
                                        <span>استلام من المتجر فقط</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5C5B57] dark:text-zinc-400">
                                    <span className="font-bold text-[#111214] dark:text-zinc-200 flex items-center gap-1">
                                      <Store className="w-3.5 h-3.5" />
                                      {storeLabel}
                                    </span>
                                    <span className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                                      {Number(product.price || 0).toLocaleString('ar-YE')} ر.ي
                                    </span>
                                    <span>التصنيف: {product.category || 'عام'}</span>
                                    {prodVariants.length > 0 && (
                                      <span className="tabular-nums">{prodVariants.length} أصناف</span>
                                    )}
                                  </div>
                                  {product.description && (
                                    <p className="text-xs text-[#5C5B57] dark:text-zinc-400 line-clamp-2 max-w-2xl">
                                      {product.description}
                                    </p>
                                  )}
                                  {product.status === 'rejected' && product.rejectionReason && (
                                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                      سبب الرفض: {product.rejectionReason}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setInspectingProduct(product)}
                                  className="min-h-[42px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-xs font-bold flex items-center gap-1.5 transition"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>فحص كافة التفاصيل</span>
                                </button>
                                {product.status !== 'active' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await approveAndPublishProductAction(product, user?.uid || 'admin');
                                        const notifiedCount = await notifyWatchersOnProductUpdate({
                                          productId: product.id,
                                          productTitle: String(product.title || 'منتج'),
                                          storeName: String(product.ownerName || storeProfile?.name || 'المتجر'),
                                          prevPrice: Number(product.price || 0),
                                          nextPrice: Number(product.price || 0),
                                          prevOutOfStock: product.available === false || product.stock === 0,
                                          nextOutOfStock: product.available === false || product.stock === 0,
                                        });
                                        toast.success(
                                          notifiedCount > 0
                                            ? `تم اعتماد ونشر "${product.title}" وإرسال تنبيه رادار الأسعار إلى ${notifiedCount} عميل`
                                            : `تم اعتماد ونشر "${product.title}" للعامة`
                                        );
                                      } catch (err: any) {
                                        toast.error(err?.message || 'فشل الاعتماد');
                                      }
                                    }}
                                    className="min-h-[42px] px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>اعتماد ونشر</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* TAB: ORDERS & NEGOTIATIONS */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div className="pb-5 border-b border-[#E5E2DA] dark:border-[#232730] flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">
                        الطلبات وعروض التفاوض
                      </h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        متابعة طلبات العملاء وتحديث حالات التسليم والرد على عروض الأسعار المقترحة
                      </p>
                    </div>
                    <div className="flex items-center p-1 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                      <button
                        type="button"
                        onClick={() => setOrdersSubTab('orders')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors tabular-nums ${
                          ordersSubTab === 'orders'
                            ? `${getThemeClasses('bg')}`
                            : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>الطلبات ({orders.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrdersSubTab('offers')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors tabular-nums ${
                          ordersSubTab === 'offers'
                            ? `${getThemeClasses('bg')}`
                            : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                        }`}
                      >
                        <Handshake className="w-3.5 h-3.5" />
                        <span>عروض التفاوض ({priceOffers.length})</span>
                        {pendingPriceOffersCount > 0 && ordersSubTab !== 'offers' && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px]">
                            {pendingPriceOffersCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {ordersSubTab === 'offers' ? (
                    <PriceOffersInbox offers={priceOffers} />
                  ) : (
                  <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 font-bold text-[11px]">
                            <th className="py-3.5 px-4">رقم الطلب</th>
                            <th className="py-3.5 px-4 text-center">العميل</th>
                            <th className="py-3.5 px-4 text-center">تاريخ الطلب</th>
                            <th className="py-3.5 px-4 text-center">الإجمالي</th>
                            <th className="py-3.5 px-4 text-center">الحالة</th>
                            <th className="py-3.5 px-4 text-left">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                          {orders.map(order => (
                            <tr key={order.id} className="hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition">
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-[#111214] dark:text-[#F4F4F2]" dir="ltr">
                                    #{order.id.slice(-6).toUpperCase()}
                                  </span>
                                  {(order.isPreOrder || order.orderType === 'preorder') && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold inline-flex items-center gap-1">
                                      <BookmarkCheck className="w-3 h-3" />
                                      <span>عربون</span>
                                    </span>
                                  )}
                                  {isStorePickupOnlyOrder(order) && (
                                    <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold inline-flex items-center gap-1">
                                      <Store className="w-3 h-3" />
                                      <span>استلام من المتجر</span>
                                    </span>
                                  )}
                                  {(order.depositForfeited || order.status === 'reservation_expired') && (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold">
                                      ذهب العربون للمتجر
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                <p className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2]">{order.customerName}</p>
                                <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-mono tabular-nums" dir="ltr">{order.customerPhone}</p>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-center tabular-nums">
                                <p className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">{formatArabicDate(order.createdAt) || '—'}</p>
                                <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400">{formatArabicTime(order.createdAt) || ''}</p>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-center tabular-nums">
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">{Number(order.total || 0).toLocaleString()} ر.ي</span>
                                {(order.isPreOrder || order.orderType === 'preorder') && (
                                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                                    عربون: {(order.depositAmount || 0).toLocaleString()} | متبقي: {(order.remainingAmount || 0).toLocaleString()}
                                  </p>
                                )}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                <select
                                  value={order.status}
                                  onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                  className={`border rounded-md px-2.5 py-1.5 text-[11px] font-bold cursor-pointer outline-none ${statusColors[order.status] || ''}`}
                                >
                                  <option value="pending">قيد الانتظار</option>
                                  <option value="reserved">حجز مسبق مؤكد</option>
                                  <option value="deposit_paid">تم استلام العربون</option>
                                  <option value="processing">جاري التجهيز</option>
                                  <option value="shipped">تم الشحن</option>
                                  <option value="delivered">تم التسليم</option>
                                  <option value="cancelled">ملغي</option>
                                  <option value="reservation_expired">انتهت مدة الحجز (مُصادر)</option>
                                </select>
                              </td>
                              <td className="py-3.5 px-4 text-left whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setViewingOrder(order)}
                                    className="w-9 h-9 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] flex items-center justify-center transition"
                                    title="عرض تفاصيل الطلب والدفع"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm({ id: order.id, type: 'orders', title: 'هذا الطلب' })}
                                    className="w-9 h-9 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition"
                                    title="حذف الطلب"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* ADMIN ONLY: STORES TAB */}
              {isAdmin && activeTab === 'stores' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">
                        إدارة المتاجر والتوثيق الرسمي
                      </h2>
                      <p className="text-xs sm:text-sm font-medium mt-0.5 text-[#5C5B57] dark:text-zinc-400">
                        عرض جميع المتاجر المسجلة في المنصة، التحكم في هوياتها، وتجديد وتفعيل التوثيق
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                      <span className="px-3 py-1.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold">
                        الإجمالي: {allStoresList.length}
                      </span>
                      <span className="px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                        الموثقة: {allStoresList.filter(s => s.verified).length}
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5C5B57] dark:text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={storesSearchTerm}
                      onChange={(e) => setStoresSearchTerm(e.target.value)}
                      placeholder="ابحث عن متجر بالاسم أو البريد الإلكتروني أو الهاتف..."
                      className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57]/70 dark:placeholder:text-zinc-500 text-xs sm:text-sm font-medium outline-none focus:bg-white dark:focus:bg-[#131519] focus:border-[#111214] dark:focus:border-zinc-400 transition"
                    />
                  </div>

                  {filteredStores.length === 0 ? (
                    <div className="p-12 text-center rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400">
                      <Store className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="font-bold text-sm">لا توجد متاجر مطابقة لبحثك</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredStores.map((s) => {
                        const isCurrentUser = s.id === user?.uid;
                        const hasExpiry = Boolean(s.verifiedUntil);
                        const expDate = hasExpiry ? new Date(s.verifiedUntil) : null;
                        const isExpired = hasExpiry && expDate ? expDate.getTime() < Date.now() : false;

                        return (
                          <div
                            key={s.id}
                            className="p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex flex-col justify-between gap-4"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-11 h-11 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] overflow-hidden flex items-center justify-center shrink-0">
                                    {s.logoUrl ? (
                                      <img src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <Store className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2] truncate">
                                        {s.name}
                                      </h4>
                                      {isCurrentUser && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2]">
                                          حسابك
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium truncate mt-0.5">
                                      {s.email}
                                    </p>
                                    {s.phone && s.phone !== '—' && (
                                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-mono tabular-nums" dir="ltr">
                                        {s.phone}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 flex items-center gap-1 ${
                                  s.verified && !isExpired
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : isExpired
                                      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                      : 'bg-[#FAF9F6] text-[#5C5B57] border-[#E5E2DA] dark:bg-[#101216] dark:text-zinc-400 dark:border-[#232730]'
                                }`}>
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{s.verified && !isExpired ? 'موثق' : isExpired ? 'منتهي' : 'غير موثق'}</span>
                                </span>
                              </div>

                              <div className="grid grid-cols-3 mt-4 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] divide-x divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730] text-center text-xs">
                                <div className="p-2.5">
                                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">المنتجات</span>
                                  <span className="font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">{s.productCount}</span>
                                </div>
                                <div className="p-2.5">
                                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">التقييم</span>
                                  <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                    {s.averageRating ? `${s.averageRating.toFixed(1)}/10` : '—'}
                                  </span>
                                </div>
                                <div className="p-2.5">
                                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">المصداقية</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    {s.averageCredibility ? `${s.averageCredibility.toFixed(1)}/10` : '—'}
                                  </span>
                                </div>
                              </div>

                              {s.verified && s.verifiedUntil && (
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-2 tabular-nums">
                                  ينتهي التوثيق: {formatArabicVerificationDate(s.verifiedUntil)}
                                </p>
                              )}

                              <div className="mt-3 pt-2.5 border-t border-[#E5E2DA] dark:border-[#232730] space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">
                                    تصنيف المتجر (للإدارة فقط):
                                  </span>
                                  {storeCategories.length === 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('categories')}
                                      className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                                    >
                                      + إضافة قوائم المتاجر
                                    </button>
                                  )}
                                </div>
                                {storeCategories.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {storeCategories.map((cat) => {
                                      const active = Array.isArray(s.storeCategoryIds) && s.storeCategoryIds.includes(cat.id);
                                      return (
                                        <button
                                          key={cat.id}
                                          type="button"
                                          onClick={() => handleToggleStoreCategory(s.id, s.storeCategoryIds || [], cat.id)}
                                          className={`px-2 py-1 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 transition-colors ${
                                            active
                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                              : 'bg-[#FAF9F6] dark:bg-[#101216] border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                                          }`}
                                        >
                                          {renderStoreCategoryIcon(cat.icon || cat.name, 'w-2.5 h-2.5 shrink-0')}
                                          <span>{cat.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-3 border-t border-[#E5E2DA] dark:border-[#232730]">
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectStore(s.id);
                                  setActiveTab('store-profile');
                                  toast.success(`أنت الآن تعدل متجر: ${s.name}`);
                                }}
                                className={`w-full min-h-[40px] py-2 px-3 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition flex items-center justify-center gap-1.5`}
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>تعديل وتوثيق هذا المتجر</span>
                              </button>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectStore(s.id);
                                    setActiveTab('wallets');
                                  }}
                                  className="min-h-[40px] py-2 px-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold transition flex items-center justify-center gap-1.5"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  <span>المحافظ</span>
                                </button>

                                <Link
                                  to={`/store/${s.id}`}
                                  target="_blank"
                                  className="min-h-[40px] py-2 px-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold transition flex items-center justify-center gap-1.5"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>زيارة المتجر</span>
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ADMIN ONLY: USERS TAB */}
              {isAdmin && activeTab === 'users' && (() => {
                const uniqueUsers = (() => {
                  const map = new Map<string, any>();
                  for (const u of users) {
                    const key = (u.email || u.id).trim().toLowerCase();
                    if (u.id === 'MQAwCYqFztd2PZbV1fRMxKRqoYX2') {
                      map.set(key, u);
                    } else if (!map.has(key)) {
                      map.set(key, u);
                    }
                  }
                  return Array.from(map.values());
                })();

                return (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                      <div>
                        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">إدارة المستخدمين</h2>
                        <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                          التحكم بالحسابات وتعيين وترقية الرتب وإدارة الصلاحيات
                        </p>
                      </div>
                      <span className="px-3 py-1.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums self-start sm:self-auto">
                        إجمالي الحسابات: {uniqueUsers.length}
                      </span>
                    </div>

                    <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 text-[11px] font-bold">
                              <th className="py-3.5 px-4">المستخدم</th>
                              <th className="py-3.5 px-4 text-center">البريد الإلكتروني</th>
                              <th className="py-3.5 px-4 text-center">الرتبة</th>
                              <th className="py-3.5 px-4 text-center">تاريخ الانضمام</th>
                              <th className="py-3.5 px-4 text-left">تحكم</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                            {uniqueUsers.map(u => {
                              const isMasterAdminAccount = u.id === 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' || (u.email && u.email.toLowerCase() === '1ismaai0lll@gmail.com');
                              return (
                                <tr key={u.id} className="hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition">
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 bg-[#FAF9F6] dark:bg-[#101216] rounded-lg flex items-center justify-center overflow-hidden border border-[#E5E2DA] dark:border-[#232730] shrink-0">
                                        {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" alt="" /> : <User className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />}
                                      </div>
                                      <div>
                                        <p className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5 flex-wrap">
                                          <span>{u.name}</span>
                                          {isMasterAdminAccount && (
                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-[10px] font-bold">
                                              المدير العام
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-mono mt-0.5">#{u.id.slice(0, 10)}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-center text-xs font-mono text-[#111214] dark:text-[#F4F4F2]" dir="ltr">
                                    {u.email}
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    {isMasterAdminAccount ? (
                                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                        مدير عام المتجر
                                      </span>
                                    ) : (
                                      <select
                                        value={u.role || 'user'}
                                        onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                        className="text-xs font-bold px-2.5 py-1.5 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] cursor-pointer outline-none"
                                      >
                                        <option value="user">عضو عادي</option>
                                        <option value="delivery">مندوب توصيل</option>
                                        <option value="store">متجر رسمي</option>
                                        <option value="admin">مدير نظام</option>
                                      </select>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-center text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                                    {u.createdAt ? (formatArabicDate(u.createdAt) || '—') : '—'}
                                  </td>
                                  <td className="py-3.5 px-4 text-left">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {u.role === 'store' && (
                                        <>
                                          <button
                                            onClick={() => {
                                              handleSelectStore(u.id);
                                              setActiveTab('store-profile');
                                              toast.success(`أنت الآن تعدل متجر: ${u.name}`);
                                            }}
                                            title="تعديل وتوثيق ملف هذا المتجر"
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] rounded-md font-bold text-xs transition"
                                          >
                                            <Store className="w-3.5 h-3.5" />
                                            <span>تعديل المتجر</span>
                                          </button>
                                          <Link
                                            to={`/store/${u.id}`}
                                            target="_blank"
                                            title="زيارة صفحة المتجر"
                                            className="w-9 h-9 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white flex items-center justify-center transition"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </Link>
                                        </>
                                      )}
                                      <button
                                        onClick={() => {
                                          setPasswordModalUser({
                                            id: u.id,
                                            email: u.email,
                                            name: u.name || u.email,
                                            role: u.role || 'user'
                                          });
                                          setAdminUserNewPass('');
                                          setShowAdminUserNewPass(true);
                                        }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 rounded-md font-bold text-[11px] transition"
                                        title="تغيير كلمة مرور هذا الحساب"
                                      >
                                        <KeyRound className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">كلمة المرور</span>
                                      </button>
                                      {!isMasterAdminAccount ? (
                                        <button
                                          onClick={() => setDeleteConfirm({ id: u.id, type: 'users', title: u.name, email: u.email })}
                                          className="w-9 h-9 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition"
                                          title="حذف الحساب نهائياً"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      ) : (
                                        <span className="w-9 h-9 flex items-center justify-center text-[#5C5B57]/40 dark:text-zinc-600 cursor-not-allowed" title="محمي من الحذف">
                                          <Lock className="w-4 h-4" />
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ADMIN ONLY: SETTINGS TAB */}
              {isAdmin && activeTab === 'settings' && (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">إعدادات المنصة</h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        تخصيص الهوية البصرية، الألوان، شعار المنصة، وأمان الحساب
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDoc(doc(db, 'settings', 'global'), localSettings, { merge: true })
                          .then(() => toast.success('تم الحفظ'))
                          .catch(() => toast.error('فشل الحفظ'));
                      }}
                      className={`min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white px-6 py-2.5 rounded-lg font-bold text-xs transition`}
                    >
                      حفظ الكل
                    </button>
                  </div>

                  {/* Sub-Tabs for Settings */}
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] overflow-x-auto max-w-full">
                    {[
                      { id: 'brand', label: 'الهوية والشعار', icon: <Store className="w-3.5 h-3.5" /> },
                      { id: 'appearance', label: 'المظهر والخطوط', icon: <Palette className="w-3.5 h-3.5" /> },
                      { id: 'banners', label: 'المساحة الإعلانية', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                      { id: 'security', label: 'الأمان والربط الذكي', icon: <KeyRound className="w-3.5 h-3.5" /> }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSettingsSubTab(tab.id as any)}
                        className={`px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                          settingsSubTab === tab.id
                            ? 'bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] shadow-xs border border-[#E5E2DA]/80 dark:border-[#232730]'
                            : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {settingsSubTab === 'brand' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AdminInput
                        label="اسم المنصة"
                        value={localSettings.storeName || ''}
                        onChange={(v: any) => setLocalSettings({ ...localSettings, storeName: v })}
                      />
                      <AdminInput
                        label="رابط المتجر العام (المنشور)"
                        value={localSettings.storePublicUrl || ''}
                        onChange={(v: any) => setLocalSettings({ ...localSettings, storePublicUrl: v })}
                        placeholder="https://www.example.com"
                        extra="الرابط الرسمي لمشاركة المتجر"
                      />
                      <AdminInput
                        label="المعرف العالمي (Handle)"
                        value={localSettings.storeHandle || ''}
                        onChange={(v: any) => setLocalSettings({ ...localSettings, storeHandle: v })}
                      />
                      <AdminInput
                        label="شريط الإعلان العلوي للمنصة (اختياري)"
                        value={localSettings.bannerMessage || ''}
                        onChange={(v: any) => setLocalSettings({ ...localSettings, bannerMessage: v })}
                        icon={<Megaphone className="w-4 h-4" />}
                        placeholder="مثال: عروض نهاية الأسبوع متاحة الآن في جميع المتاجر الموثقة"
                        extra="يظهر كشريط أنيق أعلى جميع الصفحات"
                      />
                    </div>
                  )}

                  {/* AI Assistant Configuration Card */}
                  {settingsSubTab === 'security' && (
                      <div className="p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                              مفتاح محرك المحادثة الذكي للمتجر
                            </h4>
                            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-0.5 leading-relaxed">
                              يربط مستشار المتجر في المحادثات لتقديم إجابات فورية عن المنتجات والأسعار 24/7
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            localSettings.geminiApiKey
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          }`}>
                            {localSettings.geminiApiKey ? 'مفتاح مضاف' : 'مطلوب مفتاح'}
                          </span>
                        </div>

                        <AdminInput
                          label="مفتاح API"
                          value={localSettings.geminiApiKey || ''}
                          onChange={(v: any) => setLocalSettings({ ...localSettings, geminiApiKey: v })}
                          placeholder="AIzaSy..."
                          dir="ltr"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleTestGeminiKey}
                            disabled={isTestingGemini}
                            className={`min-h-[40px] px-4 py-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg text-xs font-bold transition disabled:opacity-50`}
                          >
                            {isTestingGemini ? 'جاري الفحص...' : 'اختبار الاتصال'}
                          </button>

                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-[#5C5B57] dark:text-zinc-300 hover:underline flex items-center gap-1"
                          >
                            <span>الحصول على مفتاح API</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                  )}

                  {settingsSubTab === 'appearance' && (
                    <div className="space-y-5 bg-[#FAF9F6] dark:bg-[#101216] p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730]">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                            ستايل ومظهر المنصة العام ({PLATFORM_THEMES.length} ستايلات)
                          </h4>
                          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-0.5">
                            اختر الستايل المعتمد للأزرار والبطاقات والترويسة
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] whitespace-nowrap">
                          {PLATFORM_THEMES.find((t) => t.id === (localSettings.storeTheme || 'white'))?.shortName || 'حجري'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {PLATFORM_THEMES.map((themeItem) => {
                          const isSelected = (localSettings.storeTheme || 'white') === themeItem.id;
                          return (
                            <button
                              key={themeItem.id}
                              type="button"
                              onClick={() => setLocalSettings({ ...localSettings, storeTheme: themeItem.id })}
                              className={`p-3 rounded-lg border text-right transition flex flex-col justify-between ${
                                isSelected
                                  ? 'border-[#111214] dark:border-[#F4F4F2] bg-white dark:bg-[#131519]'
                                  : 'border-[#E5E2DA] dark:border-[#232730] bg-white/70 dark:bg-[#131519]/70 hover:bg-white dark:hover:bg-[#131519]'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-1.5 gap-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${themeItem.swatchClass}`} />
                                  <span className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2] truncate">{themeItem.name}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                              </div>
                              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 leading-snug">{themeItem.desc}</p>
                            </button>
                          );
                        })}
                      </div>

                      {/* Platform Typography / Font Selector */}
                      <div className="pt-4 border-t border-[#E5E2DA] dark:border-[#232730] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-display text-xs font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-1.5">
                            <Type className="w-3.5 h-3.5" />
                            <span>خط المنصة والهوية</span>
                          </h4>
                          <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400">
                            {PLATFORM_FONTS.find((f) => f.id === (localSettings.storeFont || 'tajawal'))?.name || 'تجوال'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {PLATFORM_FONTS.map((fontOption) => {
                            const selected = (localSettings.storeFont || 'tajawal') === fontOption.id;
                            return (
                              <button
                                key={fontOption.id}
                                type="button"
                                onClick={() => setLocalSettings({ ...localSettings, storeFont: fontOption.id })}
                                className={`p-3 rounded-lg border text-right transition flex items-start justify-between gap-2 ${
                                  selected
                                    ? 'border-[#111214] dark:border-[#F4F4F2] bg-white dark:bg-[#131519]'
                                    : 'border-[#E5E2DA] dark:border-[#232730] bg-white/70 dark:bg-[#131519]/70 hover:bg-white dark:hover:bg-[#131519]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <span className={`block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] ${fontOption.className}`}>
                                    {fontOption.name}
                                  </span>
                                  <span className="block text-[10.5px] text-[#5C5B57] dark:text-zinc-400 mt-0.5">
                                    {fontOption.desc}
                                  </span>
                                </div>
                                {selected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#E5E2DA] dark:border-[#232730]">
                        <label className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] cursor-pointer">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">
                              السماح لكل مستخدم باختيار وتغيير ستايل الموقع بشكل منفرد
                            </span>
                            <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 leading-relaxed">
                              {localSettings.allowUserThemeOverride !== false
                                ? 'مفعّل: يمكن لكل مستخدم وزائر تخصيص مظهر الموقع من إعدادات حسابه.'
                                : 'مغلق: يتم تطبيق الستايل المحدد أعلاه بشكل موحد على الجميع.'}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={localSettings.allowUserThemeOverride !== false}
                            onChange={(e) => setLocalSettings({ ...localSettings, allowUserThemeOverride: e.target.checked })}
                            className="w-5 h-5 rounded text-emerald-600 mt-0.5 cursor-pointer shrink-0"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === 'security' && (
                  <div className="bg-[#FAF9F6] dark:bg-[#101216] p-5 sm:p-6 rounded-lg border border-[#E5E2DA] dark:border-[#232730] space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] flex items-center justify-center shrink-0">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2]">
                            أمان حساب الإدارة — تغيير كلمة المرور
                          </h4>
                          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium">
                            تحديث كلمة مرور حسابك الإداري ({user?.email || userData?.email})
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTabClick('store-accounts')}
                        className="min-h-[40px] px-4 py-2 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>إدارة كلمات مرور كل الحسابات</span>
                      </button>
                    </div>

                    <form onSubmit={handleChangeAdminSelfPassword} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                          كلمة المرور الحالية (اختياري لـ Google)
                        </label>
                        <input
                          type={showAdminSelfPasswords ? 'text' : 'password'}
                          dir="ltr"
                          value={adminSelfCurrentPass}
                          onChange={(e) => setAdminSelfCurrentPass(e.target.value)}
                          placeholder="••••••••"
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                          كلمة المرور الجديدة *
                        </label>
                        <input
                          type={showAdminSelfPasswords ? 'text' : 'password'}
                          dir="ltr"
                          value={adminSelfNewPass}
                          onChange={(e) => setAdminSelfNewPass(e.target.value)}
                          placeholder="4 أحرف على الأقل"
                          required
                          minLength={4}
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                          تأكيد كلمة المرور الجديدة *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type={showAdminSelfPasswords ? 'text' : 'password'}
                            dir="ltr"
                            value={adminSelfConfirmPass}
                            onChange={(e) => setAdminSelfConfirmPass(e.target.value)}
                            placeholder="أعد كتابة كلمة المرور"
                            required
                            minLength={4}
                            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminSelfPasswords((p) => !p)}
                            className="w-11 h-11 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center justify-center shrink-0"
                            title={showAdminSelfPasswords ? 'إخفاء' : 'إظهار'}
                          >
                            {showAdminSelfPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="md:col-span-3 flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={isChangingAdminSelfPass}
                          className={`min-h-[44px] px-5 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition flex items-center gap-2 disabled:opacity-50`}
                        >
                          {isChangingAdminSelfPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          <span>{isChangingAdminSelfPass ? 'جاري التحديث...' : 'تحديث كلمة مرور الإدارة'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                  )}

                  {settingsSubTab === 'banners' && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-display text-lg font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400" />
                            <span>المساحة الإعلانية للبانر (حتى {MAX_BANNER_ADS} إعلانات)</span>
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                            للإدارة فقط
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[11px] font-bold tabular-nums text-[#111214] dark:text-[#F4F4F2]">
                            {bannerAds.length} / {MAX_BANNER_ADS}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium mt-1">
                          أضف حتى {MAX_BANNER_ADS} مساحات إعلانية (خصومات أو إعلانات متاجر). عند فتح المتجر يبدأ الزبون بإعلان عشوائي ثم يتنقل البانر بالترتيب كل 30 ثانية، وعند الضغط عليه ينتقل مباشرة للمتجر المحدد.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {bannerAds.length === 0 && localSettings.heroBanner && (
                          <button
                            type="button"
                            onClick={handleImportLegacyBannerAsAd}
                            disabled={isSaving}
                            className="min-h-[42px] px-4 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold transition"
                          >
                            استيراد البانر الحالي كأول إعلان
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={bannerAds.length >= MAX_BANNER_ADS}
                          onClick={() => {
                            const usedOrders = new Set(bannerAds.map((a) => Number(a.order)));
                            let nextOrder = 1;
                            while (usedOrders.has(nextOrder) && nextOrder < MAX_BANNER_ADS) nextOrder++;
                            setBannerAdForm({
                              title: '',
                              subtitle: '',
                              badgeText: 'خصم خاص',
                              image: '',
                              buttonText: '',
                              targetStoreId: '',
                              customLink: '',
                              order: nextOrder,
                              active: true
                            });
                          }}
                          className={`min-h-[42px] px-5 py-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white text-xs font-bold transition inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed`}
                        >
                          <Plus className="w-4 h-4" />
                          <span>{bannerAds.length >= MAX_BANNER_ADS ? `اكتمل الحد (${MAX_BANNER_ADS}/${MAX_BANNER_ADS})` : 'إضافة مساحة إعلانية'}</span>
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-3 bg-[#FAF9F6] dark:bg-[#101216] p-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={localSettings.showHeroBanner !== false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setLocalSettings({ ...localSettings, showHeroBanner: checked });
                            setDoc(doc(db, 'settings', 'global'), { showHeroBanner: checked }, { merge: true }).catch(() => {});
                          }}
                          className="w-5 h-5 rounded text-emerald-600 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                          تفعيل ظهور المساحة الإعلانية (البانر) في الصفحة الرئيسية
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400">
                        تبديل تلقائي كل 30 ثانية
                      </span>
                    </label>

                    {bannerAds.length === 0 ? (
                      <div className="text-center py-10 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] p-6 space-y-2">
                        <ImageIcon className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-50" />
                        <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">لا توجد مساحات إعلانية مضافة بعد</p>
                        <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
                          أضف من 1 إلى 5 مساحات إعلانية بصورها وربطها مباشرة بالمتاجر أو العروض.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bannerAds.map((ad, idx) => (
                          <div
                            key={ad.id}
                            className={`rounded-lg border overflow-hidden bg-[#FAF9F6] dark:bg-[#101216] flex flex-col justify-between transition ${
                              ad.active === false
                                ? 'border-dashed border-[#E5E2DA] dark:border-[#232730] opacity-70'
                                : 'border-[#E5E2DA] dark:border-[#232730]'
                            }`}
                          >
                            <div className="relative h-36 bg-[#EFEDE6] dark:bg-[#1C1F26] overflow-hidden">
                              <img src={ad.image} alt={ad.title || 'إعلان'} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 flex flex-col justify-between">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold tabular-nums border border-white/15">
                                    المساحة #{ad.order || idx + 1}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      ad.active !== false
                                        ? 'bg-emerald-600 text-white border-emerald-400/50'
                                        : 'bg-zinc-800 text-zinc-300 border-zinc-600'
                                    }`}
                                  >
                                    {ad.active !== false ? 'نشط' : 'متوقف'}
                                  </span>
                                </div>
                                <div className="text-right">
                                  {ad.title && (
                                    <p className="text-sm font-extrabold text-white line-clamp-1">{ad.title}</p>
                                  )}
                                  {ad.subtitle && (
                                    <p className="text-[11px] text-white/80 line-clamp-1">{ad.subtitle}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="p-3.5 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-[#111214] dark:text-[#F4F4F2] min-w-0">
                                  <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span className="truncate">
                                    {ad.targetStoreName
                                      ? `يفتح متجر: ${ad.targetStoreName}`
                                      : ad.customLink
                                        ? `رابط: ${ad.customLink}`
                                        : 'التمرير للمنتجات'}
                                  </span>
                                </div>
                                {ad.badgeText && (
                                  <span className="px-2 py-0.5 rounded bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[10px] font-bold text-[#5C5B57] dark:text-zinc-300">
                                    {ad.badgeText}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2DA] dark:border-[#232730]">
                                <button
                                  type="button"
                                  onClick={() => handleToggleBannerAdActive(ad)}
                                  className="min-h-[36px] px-3 py-1.5 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[11px] font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                                >
                                  {ad.active !== false ? 'إيقاف مؤقت' : 'تفعيل العرض'}
                                </button>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setBannerAdForm({ ...ad })}
                                    className="w-9 h-9 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] flex items-center justify-center transition"
                                    title="تعديل الإعلان"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteConfirm({
                                        id: ad.id,
                                        type: 'bannerAds',
                                        title: ad.title || ad.targetStoreName || `المساحة الإعلانية #${ad.order}`
                                      })
                                    }
                                    className="w-9 h-9 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition"
                                    title="حذف الإعلان"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {settingsSubTab === 'brand' && (
                  <div className="pt-6 border-t border-[#E5E2DA] dark:border-[#232730] space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-display text-lg font-bold flex items-center gap-2 text-[#111214] dark:text-[#F4F4F2]">
                          <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          <span>أيقونة وشعار الموقع الأساسي</span>
                        </h4>
                        <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                          تحكم في الشعار الذي يظهر في الترويسة العلوية وأيقونة تبويب المتصفح (Favicon).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDoc(doc(db, 'settings', 'global'), localSettings, { merge: true })
                            .then(() => toast.success('تم حفظ إعدادات الأيقونة والشعار بنجاح!'))
                            .catch(() => toast.error('فشل الحفظ'));
                        }}
                        className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-2 self-start"
                      >
                        <Check className="w-4 h-4" />
                        <span>حفظ الشعار والأيقونة</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-7 space-y-5">
                        <div className="bg-[#FAF9F6] dark:bg-[#101216] p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] space-y-5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                              صورة الشعار أو الأيقونة
                            </label>
                            {(localSettings.storeLogo || localSettings.siteIcon) && (
                              <button
                                type="button"
                                onClick={() => setLocalSettings({ ...localSettings, storeLogo: '', siteIcon: '' })}
                                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>إزالة الشعار</span>
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="relative w-20 h-20 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex items-center justify-center overflow-hidden shrink-0 group">
                              {(localSettings.siteIcon || localSettings.storeLogo) ? (
                                <img
                                  src={localSettings.siteIcon || localSettings.storeLogo}
                                  alt="Current Logo"
                                  className="w-full h-full object-contain p-1.5"
                                />
                              ) : (
                                <div className="flex flex-col items-center text-[#5C5B57] dark:text-zinc-400">
                                  <Store className="w-6 h-6 mb-1" />
                                  <span className="text-[10px] font-bold">بدون شعار</span>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 w-full space-y-2">
                              <label className="cursor-pointer inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] font-bold text-xs hover:opacity-90 transition w-full sm:w-auto">
                                <Upload className="w-4 h-4" />
                                <span>رفع شعار من جهازك</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      toast.loading('جاري تجهيز الشعار...', { id: 'logo-up2' });
                                      reader.onloadend = async () => {
                                        try {
                                          const compressed = await compressImage(reader.result as string);
                                          setLocalSettings({
                                            ...localSettings,
                                            storeLogo: compressed,
                                            siteIcon: compressed
                                          });
                                          toast.success('تم تحديث الشعار بنجاح!', { id: 'logo-up2' });
                                        } catch {
                                          setLocalSettings({
                                            ...localSettings,
                                            storeLogo: reader.result as string,
                                            siteIcon: reader.result as string
                                          });
                                          toast.success('تم تحديث الشعار!', { id: 'logo-up2' });
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                                يدعم PNG, JPG, SVG وبأبعاد دائرية أو مربعة.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-3 border-t border-[#E5E2DA] dark:border-[#232730]">
                            <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                              أو رابط صورة مباشر للشعار (Image URL)
                            </label>
                            <input
                              type="url"
                              dir="ltr"
                              value={localSettings.siteIcon || localSettings.storeLogo || ''}
                              onChange={(e) => setLocalSettings({
                                ...localSettings,
                                storeLogo: e.target.value,
                                siteIcon: e.target.value
                              })}
                              placeholder="https://example.com/my-logo.png"
                              className="w-full min-h-[44px] bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2 text-xs font-mono text-left text-[#111214] dark:text-[#F4F4F2] outline-none"
                            />
                          </div>
                        </div>

                        {/* Customization Options */}
                        <div className="bg-white dark:bg-[#131519] p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] space-y-4">
                          <h5 className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                            <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>تخصيص شكل وعرض الأيقونة في الترويسة</span>
                          </h5>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 block">شكل الإطار:</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { id: 'circle', label: 'دائري' },
                                { id: 'rounded', label: 'مربع منحني' },
                                { id: 'transparent', label: 'بدون إطار' },
                                { id: 'original', label: 'أبعاد حرة' }
                              ].map(sh => (
                                <button
                                  key={sh.id}
                                  type="button"
                                  onClick={() => setLocalSettings({ ...localSettings, siteIconShape: sh.id })}
                                  className={`p-2.5 rounded-lg border text-center text-xs font-bold transition ${
                                    (localSettings.siteIconShape || 'rounded') === sh.id
                                      ? 'border-[#111214] dark:border-[#F4F4F2] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2]'
                                      : 'border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-400'
                                  }`}
                                >
                                  {sh.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 block">لون خلفية الأيقونة:</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { id: 'white', label: 'أبيض' },
                                { id: 'transparent', label: 'شفاف' },
                                { id: 'theme', label: 'لون المظهر' },
                                { id: 'dark', label: 'داكن' }
                              ].map(bg => (
                                <button
                                  key={bg.id}
                                  type="button"
                                  onClick={() => setLocalSettings({ ...localSettings, siteIconBg: bg.id })}
                                  className={`p-2.5 rounded-lg border text-center text-xs font-bold transition ${
                                    (localSettings.siteIconBg || 'white') === bg.id
                                      ? 'border-[#111214] dark:border-[#F4F4F2] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2]'
                                      : 'border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-400'
                                  }`}
                                >
                                  {bg.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 block">الحجم:</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'compact', label: 'مدمج (36px)' },
                                { id: 'medium', label: 'متوازن (44px)' },
                                { id: 'large', label: 'بارز (54px)' }
                              ].map(sz => (
                                <button
                                  key={sz.id}
                                  type="button"
                                  onClick={() => setLocalSettings({ ...localSettings, siteIconSize: sz.id })}
                                  className={`p-2.5 rounded-lg border text-center text-xs font-bold transition ${
                                    (localSettings.siteIconSize || 'medium') === sz.id
                                      ? 'border-[#111214] dark:border-[#F4F4F2] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2]'
                                      : 'border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-400'
                                  }`}
                                >
                                  {sz.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <label className="flex items-center justify-between p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] cursor-pointer">
                            <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                              إظهار إطار خارجي حول الأيقونة
                            </span>
                            <input
                              type="checkbox"
                              checked={localSettings.siteIconBorder !== false}
                              onChange={(e) => setLocalSettings({ ...localSettings, siteIconBorder: e.target.checked })}
                              className="w-5 h-5 rounded text-emerald-600 cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Live Header Simulation */}
                      <div className="lg:col-span-5">
                        <div className="bg-[#111214] text-white p-5 rounded-lg border border-[#232730] space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-emerald-400" />
                              <span className="text-xs font-bold text-zinc-200">معاينة الترويسة المباشرة</span>
                            </div>
                          </div>

                          <div className="rounded-lg border border-zinc-700 bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] p-3.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                {(() => {
                                  const previewLogo = localSettings.siteIcon || localSettings.storeLogo;
                                  const previewShape = localSettings.siteIconShape || 'rounded';
                                  const previewBg = localSettings.siteIconBg || 'white';
                                  const previewSize = localSettings.siteIconSize || 'medium';
                                  const previewBorder = localSettings.siteIconBorder !== false && previewShape !== 'transparent' && previewBg !== 'transparent';

                                  const sizeClass = previewSize === 'large'
                                    ? 'h-12 w-12'
                                    : previewSize === 'compact'
                                      ? 'h-8 w-8'
                                      : 'h-10 w-10';

                                  const shapeClass = previewShape === 'circle'
                                    ? 'rounded-full'
                                    : previewShape === 'transparent'
                                      ? 'rounded-none'
                                      : 'rounded-lg';

                                  const bgClass = previewShape === 'transparent' || previewBg === 'transparent'
                                    ? 'bg-transparent'
                                    : previewBg === 'theme'
                                      ? 'bg-emerald-600 text-white'
                                      : previewBg === 'dark'
                                        ? 'bg-zinc-900 text-white'
                                        : 'bg-white text-[#111214]';

                                  const borderClass = previewBorder ? 'border border-[#E5E2DA] p-1' : 'p-0';

                                  if (previewLogo && previewLogo.trim() !== '') {
                                    return (
                                      <div className={`flex items-center justify-center overflow-hidden ${shapeClass} ${bgClass} ${borderClass}`}>
                                        <img src={previewLogo} alt="Preview" className={`${sizeClass} object-contain`} />
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                                      <Store className="h-5 w-5" />
                                    </div>
                                  );
                                })()}

                                <div className="flex flex-col text-right">
                                  <span className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">
                                    {localSettings.storeName || 'متجر محيط'}
                                  </span>
                                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400">سوق التجارة الإلكترونية</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400">
                                  <MessageSquare className="w-4 h-4" />
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] flex items-center justify-center text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                                  {(userData?.name || 'م').charAt(0)}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                            <span className="text-[11px] font-bold text-zinc-400 block">معاينة تبويب المتصفح (Favicon):</span>
                            <div className="inline-flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-md border border-zinc-800 text-xs">
                              {(localSettings.siteIcon || localSettings.storeLogo) ? (
                                <img src={localSettings.siteIcon || localSettings.storeLogo} alt="Favicon" className="w-4 h-4 object-contain" />
                              ) : (
                                <Store className="w-4 h-4 text-emerald-400" />
                              )}
                              <span className="text-zinc-200 font-bold">{localSettings.storeName || 'متجر محيط'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* TAB: CATEGORIES */}
              {activeTab === 'categories' && isAdmin && (
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                    {[
                      { id: 'stores', label: `قوائم المتاجر (${storeCategories.length})`, icon: <Store className="w-3.5 h-3.5" /> },
                      { id: 'products', label: `أقسام المنتجات (${categories.length})`, icon: <ListFilter className="w-3.5 h-3.5" /> }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoriesSubTab(tab.id as any)}
                        className={`px-3.5 py-2 rounded-md text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                          categoriesSubTab === tab.id
                            ? 'bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] shadow-xs border border-[#E5E2DA]/80 dark:border-[#232730]'
                            : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* SECTION 1: Store Categories (Pharmacies, Malls, Shops, Mechanics...) */}
                  {categoriesSubTab === 'stores' && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E2DA] dark:border-[#232730]">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">
                            أقسام وقوائم المتاجر
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                            للإدارة فقط
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                          أضف وعدّل واحذف قوائم المتاجر (مثل: صيدليات، محلات، مولات، محلات ميكانيكية...) التي تظهر في دليل المتاجر المعتمدة
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddStarterStoreCategories}
                          disabled={isSaving}
                          className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold transition disabled:opacity-50"
                        >
                          إضافة تصنيفات جاهزة للمتاجر
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStoreCategoryForm({
                              name: '',
                              slug: '',
                              icon: 'store',
                              order: storeCategories.length + 1
                            })
                          }
                          className={`min-h-[44px] px-5 py-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white text-xs font-bold transition flex items-center gap-1.5`}
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة قائمة متاجر جديدة</span>
                        </button>
                      </div>
                    </div>

                    {storeCategories.length === 0 ? (
                      <div className="text-center py-10 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] p-6 space-y-2">
                        <Store className="w-8 h-8 mx-auto text-[#5C5B57] dark:text-zinc-500 opacity-50" />
                        <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">لا توجد قوائم متاجر مضافة حالياً</p>
                        <p className="text-xs text-[#5C5B57] dark:text-zinc-400">
                          أضف قوائم مثل «صيدليات» أو «مولات» أو «محلات ميكانيكية»، ثم اربط المتاجر بها من تبويب المتاجر.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead>
                              <tr className="border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 text-[11px] font-bold">
                                <th className="py-3.5 px-4">قائمة المتجر</th>
                                <th className="py-3.5 px-4 text-center">المعرّف (Slug)</th>
                                <th className="py-3.5 px-4 text-center">المتاجر المرتبطة</th>
                                <th className="py-3.5 px-4 text-left">إجراءات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                              {storeCategories.map((sc) => {
                                const storeCount = allStoresList.filter((st) =>
                                  doesStoreMatchCategory({ storeCategoryIds: st.storeCategoryIds }, sc)
                                ).length;

                                return (
                                  <tr key={sc.id} className="hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition">
                                    <td className="py-3.5 px-4 font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                          {renderStoreCategoryIcon(sc.icon || sc.name, 'w-4 h-4')}
                                        </div>
                                        <div>
                                          <p className="font-bold text-xs sm:text-sm">{sc.name}</p>
                                          <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">الترتيب: {sc.order || 1}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-center font-mono text-xs text-sky-700 dark:text-sky-400" dir="ltr">
                                      {sc.slug}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 tabular-nums">
                                        {storeCount} متجر
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-left">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setStoreCategoryForm({ ...sc })}
                                          className="w-9 h-9 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] flex items-center justify-center transition"
                                          title="تعديل قائمة المتجر"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setDeleteConfirm({ id: sc.id, type: 'storeCategories', title: sc.name })}
                                          className="w-9 h-9 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition"
                                          title="حذف قائمة المتجر"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* SECTION 2: Product Categories */}
                  {categoriesSubTab === 'products' && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E2DA] dark:border-[#232730]">
                      <div>
                        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">أقسام المنتجات</h2>
                        <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                          إدارة تصنيفات المنتجات وترتيبها في الصفحة الرئيسية
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setShowResetCatsConfirm(true)}
                          disabled={isSaving}
                          className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold transition"
                        >
                          إعادة الأقسام الافتراضية
                        </button>
                        <button
                          onClick={() => setCategoryForm({ name: '', slug: '', icon: 'tag', order: categories.length + 1 })}
                          className={`min-h-[44px] px-5 py-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white text-xs font-bold transition flex items-center gap-1.5`}
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة قسم منتجات</span>
                        </button>
                      </div>
                    </div>

                    <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400 text-[11px] font-bold">
                              <th className="py-3.5 px-4">القسم</th>
                              <th className="py-3.5 px-4 text-center">المعرّف (Slug)</th>
                              <th className="py-3.5 px-4 text-center">المنتجات المرتبطة</th>
                              <th className="py-3.5 px-4 text-left">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                            {categories.map((c) => {
                              const productCount = products.filter(p =>
                                p.category === c.name || p.category === c.slug || p.categorySlug === c.slug
                              ).length;

                              return (
                                <tr key={c.id} className="hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition">
                                  <td className="py-3.5 px-4 font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                        <ListFilter className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <p className="font-bold text-xs sm:text-sm">{c.name}</p>
                                        <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">الترتيب: {c.order || 1}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-center font-mono text-xs text-sky-700 dark:text-sky-400" dir="ltr">
                                    {c.slug}
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 tabular-nums">
                                      {productCount} منتج
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-left">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => setCategoryForm({ ...c })}
                                        className="w-9 h-9 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] flex items-center justify-center transition"
                                        title="تعديل القسم"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirm({ id: c.id, type: 'categories', title: c.name })}
                                        className="w-9 h-9 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition"
                                        title="حذف القسم"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* TAB: SERVER */}
              {activeTab === 'server' && isAdmin && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">إدارة السيرفر</h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        تحكم في العمليات الخلفية، والتنظيف التلقائي، ومراقبة السجلات
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleManualCleanup}
                        disabled={isCleaningUp}
                        className="min-h-[44px] bg-rose-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-rose-700 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {isCleaningUp ? <Clock className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        <span>تنظيف يدوي الآن</span>
                      </button>
                      <button
                        onClick={() => {
                          setDoc(doc(db, 'settings', 'global'), localSettings, { merge: true })
                            .then(() => toast.success('تم حفظ إعدادات السيرفر'))
                            .catch(() => toast.error('فشل الحفظ'));
                        }}
                        className={`min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white px-5 py-2 rounded-lg font-bold text-xs transition`}
                      >
                        حفظ الإعدادات
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <div className="bg-[#FAF9F6] dark:bg-[#101216] p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] space-y-5">
                        <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                          <SettingsIcon className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
                          <span>إعدادات التنظيف التلقائي</span>
                        </h3>

                        <div className="flex items-center justify-between p-3.5 bg-white dark:bg-[#131519] rounded-lg border border-[#E5E2DA] dark:border-[#232730]">
                          <div>
                            <p className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2]">تفعيل التنظيف التلقائي</p>
                            <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">حذف المنتجات القديمة تلقائياً لتوفير مساحة التخزين</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocalSettings({ ...localSettings, autoCleanupEnabled: !localSettings.autoCleanupEnabled })}
                            className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${localSettings.autoCleanupEnabled ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                          >
                            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${localSettings.autoCleanupEnabled ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>

                        <AdminInput
                          label="عمر المنتج بالشهور (ليتم حذفه)"
                          type="number"
                          value={(localSettings.cleanupMonths || 3).toString()}
                          onChange={(v: string) => setLocalSettings({ ...localSettings, cleanupMonths: Number(v) })}
                          placeholder="3"
                          extra="المنتجات الأقدم من هذا الرقم سيتم حذفها"
                        />

                        <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-lg border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs font-medium text-amber-900 dark:text-amber-200 leading-relaxed">
                            تنبيه: سيتم حذف المنتجات بناءً على تاريخ الإنشاء. تأكد من الإعدادات قبل التفعيل.
                          </p>
                        </div>
                      </div>

                      <div className="bg-[#111214] p-5 rounded-lg text-white border border-[#232730] space-y-3">
                        <h3 className="font-display text-sm font-bold flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          <span>حالة السيرفر</span>
                        </h3>
                        <div className="divide-y divide-zinc-800 text-xs">
                          <div className="flex justify-between items-center py-2.5">
                            <span className="text-zinc-400">الحالة التشغيلية</span>
                            <span className="flex items-center gap-2 font-bold text-emerald-400">
                              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                              <span>يعمل بكفاءة</span>
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2.5">
                            <span className="text-zinc-400">الوقت الحالي</span>
                            <span className="font-bold tabular-nums">{formatArabicDateTime(new Date().toISOString())}</span>
                          </div>
                          <div className="flex justify-between items-center py-2.5">
                            <span className="text-zinc-400">المستخدمون المتصلون</span>
                            <span className="font-bold tabular-nums">{realOnlineCount} متصل</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                        <ListFilter className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
                        <span>سجلات السيرفر (Logs)</span>
                      </h3>
                      <div className="bg-[#101216] rounded-lg p-4 text-emerald-400 font-mono text-[11px] h-[440px] overflow-y-auto border border-[#232730]">
                        <div className="space-y-2 text-left" dir="ltr">
                          {serverLogs.length === 0 ? (
                            <div className="text-zinc-500">No logs recorded yet.</div>
                          ) : (
                            serverLogs.map(log => (
                              <div key={log.id} className="border-b border-zinc-800/80 pb-1.5 flex gap-3">
                                <span className="text-zinc-500 shrink-0 tabular-nums">[{formatArabicTime(log.timestamp) || '—'}]</span>
                                <span className={
                                  log.type === 'error' ? 'text-rose-400' :
                                  log.type === 'success' ? 'text-emerald-400' : 'text-sky-400'
                                }>
                                  [{(log.type || 'info').toUpperCase()}] {log.message}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: BUYER REQUESTS (REVERSE MARKETPLACE) */}
              {activeTab === 'buyer-requests' && (
                <AdminBuyerRequestsTab
                  buyerRequests={buyerRequests}
                  currentStoreId={currentTargetStoreId || user?.uid || ''}
                  currentStoreName={storeProfile?.name || userData?.name || 'متجر'}
                  storeProfile={storeProfile}
                  storeProducts={products}
                  isAdmin={isAdmin}
                  getThemeClasses={getThemeClasses}
                />
              )}

              {/* TAB: STORE ACCOUNTS */}
              {activeTab === 'store-accounts' && isAdmin && (
                <StoreAccountsManagement />
              )}
            </motion.div>
          </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl p-6 text-center space-y-5 max-w-sm w-full shadow-xl"
          >
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">تأكيد الحذف النهائي</h3>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
                هل أنت متأكد من حذف «{deleteConfirm.title}»؟ لا يمكن التراجع عن هذه العملية لاحقاً.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={handleDelete}
                className="flex-1 min-h-[44px] bg-rose-600 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-rose-700 transition"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs py-2.5 rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reset Default Categories Confirmation Modal */}
      {showResetCatsConfirm && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl p-6 text-center space-y-5 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-lg flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <ListFilter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">استعادة الأقسام الافتراضية</h3>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
                هل تريد استعادة وتهيئة جميع الأقسام الافتراضية (الإلكترونيات، الهواتف، الأزياء، العطور، المنتجات المحلية، وغيرها)؟
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={handleConfirmResetDefaultCategories}
                className={`flex-1 min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs py-2.5 rounded-lg transition`}
              >
                تأكيد الاستعادة
              </button>
              <button
                onClick={() => setShowResetCatsConfirm(false)}
                className="flex-1 min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs py-2.5 rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Change User Password Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#131519] rounded-xl p-6 max-w-md w-full shadow-xl space-y-5 relative border border-[#E5E2DA] dark:border-[#232730] text-right"
          >
            <div className="flex justify-between items-center pb-3.5 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2]">تغيير كلمة مرور الحساب</h3>
                  <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-mono" dir="ltr">
                    {passwordModalUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUserPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                    كلمة المرور الجديدة ({passwordModalUser.name})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
                      let gen = '';
                      for (let i = 0; i < 8; i++) gen += chars[Math.floor(Math.random() * chars.length)];
                      setAdminUserNewPass(gen);
                      setShowAdminUserNewPass(true);
                    }}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>توليد تلقائي</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type={showAdminUserNewPass ? 'text' : 'password'}
                    dir="ltr"
                    value={adminUserNewPass}
                    onChange={(e) => setAdminUserNewPass(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة (4 أحرف+)"
                    required
                    minLength={4}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminUserNewPass((p) => !p)}
                    className="w-11 h-11 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center justify-center shrink-0"
                  >
                    {showAdminUserNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isSavingUserPass}
                  className={`flex-1 min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs py-2.5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  {isSavingUserPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>{isSavingUserPass ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="min-h-[44px] px-5 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs py-2.5 rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Category Modal (Add / Edit) */}
      {categoryForm && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#131519] rounded-xl p-6 max-w-lg w-full shadow-xl space-y-5 relative border border-[#E5E2DA] dark:border-[#232730] text-right"
          >
            <div className="flex justify-between items-center pb-3.5 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ListFilter className="w-4 h-4" />
                </div>
                <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2]">
                  {categoryForm.id ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}
                </h3>
              </div>
              <button
                onClick={() => setCategoryForm(null)}
                className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <AdminInput
                label="اسم القسم بالعربية"
                value={categoryForm.name || ''}
                onChange={(v: string) => setCategoryForm({ ...categoryForm, name: v })}
                placeholder="مثال: الإلكترونيات والأجهزة"
                required
              />

              <AdminInput
                label="معرّف القسم (Slug بالإنجليزية)"
                value={categoryForm.slug || ''}
                onChange={(v: string) => setCategoryForm({ ...categoryForm, slug: v })}
                placeholder="مثال: electronics"
                extra="يُستخدم في الرابط والفلترة"
                required
                dir="ltr"
              />

              <AdminInput
                label="ترتيب ظهور القسم"
                type="number"
                value={(categoryForm.order || 1).toString()}
                onChange={(v: string) => setCategoryForm({ ...categoryForm, order: Number(v) })}
                placeholder="1"
              />

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryForm(null)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`min-h-[44px] px-6 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition`}
                >
                  {isSaving ? 'جاري الحفظ...' : (categoryForm.id ? 'حفظ التعديلات' : 'إضافة القسم')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Store Category Modal (Add / Edit - Admin Only) */}
      {storeCategoryForm && isAdmin && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#131519] rounded-xl p-6 max-w-lg w-full shadow-xl space-y-5 relative border border-[#E5E2DA] dark:border-[#232730] text-right"
          >
            <div className="flex justify-between items-center pb-3.5 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  {renderStoreCategoryIcon(storeCategoryForm.icon || storeCategoryForm.name, 'w-4 h-4')}
                </div>
                <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2]">
                  {storeCategoryForm.id ? 'تعديل قائمة المتاجر' : 'إضافة قائمة متاجر جديدة'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStoreCategoryForm(null)}
                className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStoreCategory} className="space-y-4">
              <AdminInput
                label="اسم القائمة (مثال: صيدليات، مولات، محلات ميكانيكية)"
                value={storeCategoryForm.name || ''}
                onChange={(v: string) => setStoreCategoryForm({ ...storeCategoryForm, name: v })}
                placeholder="مثال: صيدليات"
                required
              />

              <AdminInput
                label="المعرّف بالإنجليزية (Slug)"
                value={storeCategoryForm.slug || ''}
                onChange={(v: string) => setStoreCategoryForm({ ...storeCategoryForm, slug: v })}
                placeholder="مثال: pharmacies"
                extra="يُستخدم لتمييز القائمة (اختياري - يُولد تلقائياً إن تُرك فارغاً)"
                dir="ltr"
              />

              <div>
                <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                  أيقونة القائمة
                </label>
                <select
                  value={storeCategoryForm.icon || 'store'}
                  onChange={(e) => setStoreCategoryForm({ ...storeCategoryForm, icon: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold outline-none cursor-pointer"
                >
                  {STORE_CATEGORY_ICON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <AdminInput
                label="ترتيب الظهور"
                type="number"
                value={(storeCategoryForm.order || 1).toString()}
                onChange={(v: string) => setStoreCategoryForm({ ...storeCategoryForm, order: Number(v) })}
                placeholder="1"
              />

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStoreCategoryForm(null)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`min-h-[44px] px-6 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition`}
                >
                  {isSaving ? 'جاري الحفظ...' : (storeCategoryForm.id ? 'حفظ التعديلات' : 'إضافة القائمة')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Banner Ad Modal (Add / Edit - Admin Only) */}
      {bannerAdForm && isAdmin && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#131519] rounded-xl p-5 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl space-y-5 relative border border-[#E5E2DA] dark:border-[#232730] text-right"
          >
            <div className="flex justify-between items-center pb-3.5 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2]">
                    {bannerAdForm.id ? 'تعديل المساحة الإعلانية' : 'إضافة مساحة إعلانية جديدة للبانر'}
                  </h3>
                  <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                    متاح للإدارة فقط (الحد الأقصى {MAX_BANNER_ADS} مساحات إعلانية متتالية كل 30 ثانية)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBannerAdForm(null)}
                className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBannerAd} className="space-y-4">
              <ImageEditor
                label="صورة الإعلان / البانر (مطلوبة)"
                value={bannerAdForm.image || ''}
                onChange={(v: string) => setBannerAdForm({ ...bannerAdForm, image: v })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                    المتجر المستهدف عند الضغط على الإعلان
                  </label>
                  <select
                    value={bannerAdForm.targetStoreId || ''}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const storeObj = allStoresList.find((s) => s.id === nextId);
                      setBannerAdForm({
                        ...bannerAdForm,
                        targetStoreId: nextId,
                        targetStoreName: storeObj?.name || '',
                        buttonText: !bannerAdForm.buttonText && storeObj ? `زيارة ${storeObj.name}` : bannerAdForm.buttonText
                      });
                    }}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="">— بدون ربط متجر محدد (أو استخدم رابطاً مخصصاً) —</option>
                    {allStoresList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} {st.verified ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <AdminInput
                  label="ترتيب الإعلان في البانر (1 إلى 5)"
                  type="number"
                  value={(bannerAdForm.order || 1).toString()}
                  onChange={(v: string) =>
                    setBannerAdForm({
                      ...bannerAdForm,
                      order: Math.max(1, Math.min(MAX_BANNER_ADS, Number(v) || 1))
                    })
                  }
                  placeholder="1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AdminInput
                  label="عنوان الإعلان / الخصم"
                  value={bannerAdForm.title || ''}
                  onChange={(v: string) => setBannerAdForm({ ...bannerAdForm, title: v })}
                  placeholder="مثال: خصم 30% في متجر محيط"
                />
                <AdminInput
                  label="شارة صغيرة (اختياري)"
                  value={bannerAdForm.badgeText || ''}
                  onChange={(v: string) => setBannerAdForm({ ...bannerAdForm, badgeText: v })}
                  placeholder="مثال: خصم خاص / إعلان متجر"
                />
              </div>

              <AdminTextarea
                label="وصف الإعلان المختصر (اختياري)"
                value={bannerAdForm.subtitle || ''}
                onChange={(v: string) => setBannerAdForm({ ...bannerAdForm, subtitle: v })}
                placeholder="مثال: عروض لفترة محدودة على كافة المنتجات..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AdminInput
                  label="نص الزر داخل البانر"
                  value={bannerAdForm.buttonText || ''}
                  onChange={(v: string) => setBannerAdForm({ ...bannerAdForm, buttonText: v })}
                  placeholder="مثال: زيارة المتجر / تسوق العرض"
                />
                {!bannerAdForm.targetStoreId && (
                  <AdminInput
                    label="رابط مخصص (اختياري عند عدم اختيار متجر)"
                    value={bannerAdForm.customLink || ''}
                    onChange={(v: string) => setBannerAdForm({ ...bannerAdForm, customLink: v })}
                    placeholder="مثال: /search-stores"
                    dir="ltr"
                  />
                )}
              </div>

              <label className="flex items-center gap-3 bg-[#FAF9F6] dark:bg-[#101216] p-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerAdForm.active !== false}
                  onChange={(e) => setBannerAdForm({ ...bannerAdForm, active: e.target.checked })}
                  className="w-5 h-5 rounded text-emerald-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                  إعلان نشط (يظهر ضمن التناوب التلقائي للعملاء)
                </span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBannerAdForm(null)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`min-h-[44px] px-6 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition`}
                >
                  {isSaving ? 'جاري الحفظ...' : (bannerAdForm.id ? 'حفظ التعديلات' : 'نشر المساحة الإعلانية')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Order Details & Payment Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-xl p-5 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl space-y-5 relative border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2]"
          >
            <div className="flex items-center justify-between border-b pb-3.5 border-[#E5E2DA] dark:border-[#232730]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">
                    تفاصيل الطلب <span className="font-mono text-emerald-600 dark:text-emerald-400">#{viewingOrder.id.slice(-6).toUpperCase()}</span>
                  </h3>
                  <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium tabular-nums">
                    {formatArabicDate(viewingOrder.createdAt) || '—'} — {formatArabicTime(viewingOrder.createdAt) || ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingOrder(null)}
                className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
              <div>
                <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block mb-1.5">حالة الطلب الحالية:</span>
                  <select
                    value={viewingOrder.status}
                    onChange={(e) => {
                      handleUpdateOrderStatus(viewingOrder.id, e.target.value);
                    }}
                    className={`text-xs font-bold rounded-md px-3 py-2 border cursor-pointer outline-none ${statusColors[viewingOrder.status] || ''}`}
                  >
                  <option value="pending">قيد الانتظار</option>
                  <option value="reserved">حجز مسبق مؤكد</option>
                  <option value="deposit_paid">تم استلام العربون</option>
                  <option value="processing">جاري التجهيز</option>
                  <option value="shipped">تم الشحن</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغي</option>
                  <option value="reservation_expired">انتهت مدة الحجز (مُصادر)</option>
                </select>
              </div>

              <div className="sm:text-left">
                <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block mb-1">المبلغ الإجمالي:</span>
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {Number(viewingOrder.total || 0).toLocaleString()} <span className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                </span>
              </div>
            </div>

            {(viewingOrder.isPreOrder || viewingOrder.orderType === 'preorder' || isStorePickupOnlyOrder(viewingOrder)) && (
              <div className="p-4 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      {isStorePickupOnlyOrder(viewingOrder)
                        ? 'حجز استلام من المتجر فقط (لا يوجد توصيل)'
                        : 'بيانات الحجز المسبق والعربون'}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                      مدة الحجز: {viewingOrder.reservationDurationDays || 3} أيام
                    </span>
                    {(viewingOrder.depositForfeited || viewingOrder.status === 'reservation_expired') && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                        انتهت المدة وذهب العربون للمتجر
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white dark:bg-[#131519] p-2.5 rounded-md border border-amber-200 dark:border-amber-800/50">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-bold block">العربون المدفوع:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">{(viewingOrder.depositAmount || 0).toLocaleString()} ر.ي</span>
                  </div>
                  <div className="bg-white dark:bg-[#131519] p-2.5 rounded-md border border-amber-200 dark:border-amber-800/50">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-bold block">المتبقي عند الاستلام:</span>
                    <span className="font-bold text-sky-700 dark:text-sky-400 tabular-nums">{(viewingOrder.remainingAmount || 0).toLocaleString()} ر.ي</span>
                  </div>
                  <div className="bg-white dark:bg-[#131519] p-2.5 rounded-md border border-amber-200 dark:border-amber-800/50 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-bold block">انتهاء المهلة:</span>
                    <span className="font-bold text-[11px] tabular-nums">
                      {viewingOrder.reservationExpiresAt ? (formatArabicDateTime(viewingOrder.reservationExpiresAt) || 'غير محدد') : 'غير محدد'}
                    </span>
                  </div>
                </div>
                {viewingOrder.reservationTerms && (
                  <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200 bg-white/70 dark:bg-[#131519]/70 p-2.5 rounded-md border border-amber-200/70 dark:border-amber-800/40">
                    {viewingOrder.reservationTerms}
                  </p>
                )}
              </div>
            )}

            <div className="p-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] space-y-3">
              <h4 className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{isStorePickupOnlyOrder(viewingOrder) ? 'بيانات العميل (الاستلام داخل المتجر)' : 'بيانات العميل والتوصيل'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-[#5C5B57] dark:text-zinc-400 block">الاسم:</span>
                  <span className="font-bold">{viewingOrder.customerName || `عميل ${localSettings?.storeName || settings?.storeName || 'المتجر'}`}</span>
                </div>

                <div>
                  <span className="text-xs text-[#5C5B57] dark:text-zinc-400 block">الهاتف / الواتساب:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums" dir="ltr">
                      {viewingOrder.customerPhone || 'غير محدد'}
                    </span>
                    {viewingOrder.customerPhone && (
                      <a
                        href={`https://wa.me/${viewingOrder.customerPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition"
                        title="مراسلة واتساب"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {viewingOrder.customerNotes && (
                  <div className="sm:col-span-2">
                    <span className="text-xs text-[#5C5B57] dark:text-zinc-400 block">ملاحظات / تفاصيل العنوان:</span>
                    <p className="font-medium text-xs bg-[#FAF9F6] dark:bg-[#101216] p-2.5 rounded-md border border-[#E5E2DA] dark:border-[#232730] mt-1">
                      {viewingOrder.customerNotes}
                    </p>
                  </div>
                )}

                {viewingOrder.location && (
                  <div className="sm:col-span-2 flex items-center justify-between p-2.5 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-800 dark:text-sky-300 tabular-nums">
                      <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span>GPS: {viewingOrder.location.lat.toFixed(5)}, {viewingOrder.location.lng.toFixed(5)}</span>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${viewingOrder.location.lat},${viewingOrder.location.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-1"
                    >
                      <span>فتح في الخريطة</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] space-y-3">
              <h4 className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>طريقة وبيانات الدفع</span>
              </h4>

              {viewingOrder.paymentMethod === 'wallet' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      الدفع عبر المحفظة الإلكترونية
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730]">
                      {viewingOrder.selectedWallet?.transferType === 'point' ? 'تحويل لنقطة صرافة / وكيل' : 'تحويل مباشر لمشترك'}
                    </span>
                  </div>

                  {viewingOrder.selectedWallet && (
                    <div className="p-3 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[#5C5B57] dark:text-zinc-400">المحفظة المستهدفة:</span>
                        <span className="font-bold">{viewingOrder.selectedWallet.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5C5B57] dark:text-zinc-400">رقم الحساب:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">{viewingOrder.selectedWallet.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5C5B57] dark:text-zinc-400">اسم المستلم:</span>
                        <span className="font-bold">{viewingOrder.selectedWallet.accountName}</span>
                      </div>
                      {viewingOrder.selectedWallet.transferType === 'point' && viewingOrder.selectedWallet.pointDetails && (
                        <div className="flex justify-between text-amber-700 dark:text-amber-400">
                          <span className="font-bold">اسم النقطة / الوكيل:</span>
                          <span className="font-bold">{viewingOrder.selectedWallet.pointDetails}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {viewingOrder.transferReference && (
                    <div className="flex items-center justify-between p-3 rounded-md bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">رقم الحوالة / السند:</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 select-all" dir="ltr">
                        {viewingOrder.transferReference}
                      </span>
                    </div>
                  )}

                  {viewingOrder.paymentProof && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 block">صورة إشعار / سند التحويل:</span>
                      <div className="rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] max-h-64 bg-black flex items-center justify-center relative">
                        <img src={viewingOrder.paymentProof} alt="إشعار التحويل" className="max-h-64 object-contain" />
                        <a
                          href={viewingOrder.paymentProof}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-3 left-3 bg-white text-[#111214] px-3 py-1.5 rounded-md text-xs font-bold shadow flex items-center gap-1.5"
                        >
                          <span>عرض بالحجم الكامل</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#5C5B57] dark:text-zinc-300">
                  طريقة الدفع: الدفع عند الاستلام (كاش للمندوب)
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                المنتجات المطلوبة ({viewingOrder.items?.length || 0})
              </h4>
              <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730] border border-[#E5E2DA] dark:border-[#232730] rounded-lg max-h-48 overflow-y-auto">
                {viewingOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#131519]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] shrink-0">
                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="font-bold text-xs">{item.title}</p>
                        {item.variantName && (
                          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            الصنف: {item.variantName}
                          </p>
                        )}
                        <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">الكمية: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()} ر.ي
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setViewingOrder(null)}
                className={`min-h-[44px] px-6 py-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition`}
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl p-6 text-center space-y-5 max-w-sm w-full shadow-xl relative"
          >
            <button
              onClick={() => setShowQrModal(false)}
              className="w-10 h-10 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition absolute left-4 top-4"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-display text-lg font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">كود QR الخاص بمتجرك</h3>
              <p className="text-[#5C5B57] dark:text-zinc-400 text-xs font-medium px-2">شارك هذا الكود مع عملائك للوصول السريع لمتجرك</p>
            </div>

            <div id="store-qr-canvas-wrap" className="bg-white p-4 rounded-lg border border-[#E5E2DA] flex justify-center">
              <QRCodeCanvas
                value={settings?.storePublicUrl || window.location.origin}
                size={190}
                level="H"
                includeMargin={true}
                imageSettings={{
                  src: settings?.storeLogo || '',
                  x: undefined,
                  y: undefined,
                  height: 36,
                  width: 36,
                  excavate: true
                }}
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const canvas = document.querySelector('#store-qr-canvas-wrap canvas') as HTMLCanvasElement | null;
                  if (canvas) {
                    const url = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = 'store-qr.png';
                    link.href = url;
                    link.click();
                    toast.success('تم تحميل الكود');
                  }
                }}
                className={`w-full min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition`}
              >
                <Download className="w-4 h-4" />
                <span>تحميل الكود كصورة</span>
              </button>
              <button
                onClick={async () => {
                  const ok = await safeCopyText(settings?.storePublicUrl || window.location.origin);
                  if (ok) toast.success('تم نسخ رابط المتجر');
                  else toast.error('تعذر نسخ الرابط تلقائياً');
                }}
                className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
              >
                نسخ الرابط المباشر
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Product Form Modal */}
      {productForm && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] rounded-xl p-6 sm:p-8 max-w-2xl w-full shadow-xl relative overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
              <h3 className="font-display text-xl font-bold">{productForm.id ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
              <button
                onClick={() => setProductForm(null)}
                className="w-10 h-10 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AdminInput
                  label="عنوان المنتج"
                  value={productForm.title}
                  onChange={(v: string) => setProductForm({ ...productForm, title: v })}
                  placeholder="مثال: عسل سدر يمني أصلي"
                  required
                />
                <AdminInput
                  label="السعر (ريال)"
                  type="number"
                  value={(productForm.price ?? '').toString()}
                  onChange={(v: string) => setProductForm({ ...productForm, price: v })}
                  placeholder="0"
                  required
                />
                <div className="md:col-span-2 space-y-2">
                  <AdminInput
                    label="المخزون المتوفر (اتركه فارغاً ليكون غير محدود)"
                    type="number"
                    value={productForm.stock === null || productForm.stock === undefined ? '' : Number(productForm.stock).toString()}
                    onChange={(v: string) => setProductForm({ ...productForm, stock: v === '' ? null : Math.max(0, Math.floor(Number(v))) })}
                    placeholder="غير محدود"
                  />
                  <div className="bg-[#FAF9F6] dark:bg-[#101216] p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730]">
                    <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>بوضع الكمية (0) يُعتبر المنتج نافداً، وإذا تُرك فارغاً يُعتبر متوفراً دائماً.</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">التصنيف</label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2 font-bold text-sm text-[#111214] dark:text-[#F4F4F2] outline-none"
                  >
                    <option value="عام">عام</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">الحالة ومسار الأمان</label>
                  {isAdmin ? (
                    <select
                      value={productForm.status || 'active'}
                      onChange={e => setProductForm({ ...productForm, status: e.target.value })}
                      className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2 font-bold text-sm text-[#111214] dark:text-[#F4F4F2] outline-none"
                    >
                      <option value="active">منشور للعامة (نشط)</option>
                      <option value="pending_review">بانتظار مراجعة الإدارة</option>
                      <option value="queued">قائمة انتظار المتجر</option>
                      <option value="rejected">مرفوض</option>
                      <option value="draft">مسودة (مخفي)</option>
                    </select>
                  ) : (
                    <select
                      value={productForm.status === 'draft' ? 'draft' : 'queued'}
                      onChange={e => setProductForm({ ...productForm, status: e.target.value })}
                      className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2 font-bold text-sm text-[#111214] dark:text-[#F4F4F2] outline-none"
                    >
                      <option value="queued">قائمة انتظار المتجر (لمعاينة التفاصيل وإرسالها للمراجعة)</option>
                      <option value="draft">مسودة مخفية بالمتجر</option>
                    </select>
                  )}
                </div>
              </div>

              {!isAdmin && (
                <div className="p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs flex items-start gap-2 text-amber-900 dark:text-amber-200">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-medium">
                    لحماية المتجر والعملاء: عند الحفظ يذهب المنتج أولاً إلى <strong>قائمة الانتظار الخاصة بمتجرك</strong> لتتمكن من معاينة جميع التفاصيل قبل إرساله لمراجعة الإدارة واعتماده للنشر للعامة.
                  </p>
                </div>
              )}

              <AdminTextarea
                label="وصف المنتج"
                value={productForm.description}
                onChange={(v: string) => setProductForm({ ...productForm, description: v })}
                placeholder="اكتب مواصفات وتفاصيل المنتج هنا..."
              />

              {/* Offers, Discounts & Free Add-ons Configuration */}
              <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center text-[#111214] dark:text-[#F4F4F2]">
                      <Percent className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">العروض والخصومات والإضافات</h4>
                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                        أضف خصماً على السعر، هدية مجانية، عرض باقة، أو توصيل مجاني ليظهر المنتج في خانة العروض
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none min-h-[38px] px-3 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
                    <input
                      type="checkbox"
                      checked={Boolean(productForm.hasOffer)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setProductForm({
                          ...productForm,
                          hasOffer: checked,
                          offerType: productForm.offerType || 'discount'
                        });
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">تفعيل عرض</span>
                  </label>
                </div>

                {Boolean(productForm.hasOffer) && (
                  <div className="space-y-4 pt-3 border-t border-[#E5E2DA] dark:border-[#232730]">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">نوع العرض</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'discount', label: 'خصم على السعر', icon: Percent },
                          { id: 'bonus', label: 'إضافة / هدية مجانية', icon: Gift },
                          { id: 'bundle', label: 'عرض باقة / كمية', icon: Package },
                          ...(!productForm.noDelivery ? [{ id: 'free_delivery', label: 'توصيل مجاني', icon: Truck }] : [])
                        ].map((opt) => {
                          const IconComp = opt.icon;
                          const isSelected = (productForm.offerType || 'discount') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setProductForm({ ...productForm, offerType: opt.id })}
                              className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                isSelected
                                  ? `${getThemeClasses('bg')} border-transparent text-white`
                                  : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
                              }`}
                            >
                              <IconComp className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AdminInput
                        label="السعر قبل الخصم (اختياري - ر.ي)"
                        type="number"
                        value={productForm.originalPrice === undefined || productForm.originalPrice === null ? '' : productForm.originalPrice.toString()}
                        onChange={(v: string) => {
                          const orig = v === '' ? '' : Number(v);
                          const currentPrice = Number(productForm.price) || 0;
                          const pct = productForm.discountPercent ? Number(productForm.discountPercent) : 0;
                          if (orig && pct > 0 && pct < 100) {
                            const discounted = Math.max(0, Math.round(Number(orig) * (1 - pct / 100)));
                            setProductForm({ ...productForm, originalPrice: orig, price: discounted.toString() });
                          } else if (orig && currentPrice > 0 && Number(orig) > currentPrice) {
                            const calcPct = Math.round(((Number(orig) - currentPrice) / Number(orig)) * 100);
                            setProductForm({ ...productForm, originalPrice: orig, discountPercent: calcPct.toString() });
                          } else {
                            setProductForm({ ...productForm, originalPrice: orig });
                          }
                        }}
                        placeholder="مثال: 15000"
                        extra="يظهر مشطوباً بجانب السعر النهائي بعد الخصم"
                      />

                      <AdminInput
                        label="نسبة الخصم % (لحساب السعر تلقائياً)"
                        type="number"
                        value={productForm.discountPercent === undefined || productForm.discountPercent === null ? '' : productForm.discountPercent.toString()}
                        onChange={(v: string) => {
                          const pct = v === '' ? '' : Math.min(99, Math.max(0, Number(v)));
                          const baseOrig = Number(productForm.originalPrice || productForm.price || 0);
                          if (pct !== '' && Number(pct) > 0 && baseOrig > 0) {
                            const discounted = Math.max(0, Math.round(baseOrig * (1 - Number(pct) / 100)));
                            setProductForm({
                              ...productForm,
                              originalPrice: baseOrig.toString(),
                              discountPercent: pct.toString(),
                              price: discounted.toString()
                            });
                          } else {
                            setProductForm({ ...productForm, discountPercent: pct === '' ? '' : pct.toString() });
                          }
                        }}
                        placeholder="مثال: 20"
                        extra="أدخل النسبة لحساب السعر الجديد تلقائياً من السعر الأساسي"
                      />
                    </div>

                    {Number(productForm.originalPrice || 0) > Number(productForm.price || 0) && Number(productForm.price || 0) > 0 && (
                      <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                          السعر النهائي في العرض: {Number(productForm.price).toLocaleString()} ر.ي
                        </span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          يوفر العميل {(Number(productForm.originalPrice) - Number(productForm.price)).toLocaleString()} ر.ي (
                          {Math.round(((Number(productForm.originalPrice) - Number(productForm.price)) / Number(productForm.originalPrice)) * 100)}%)
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AdminInput
                        label="عنوان العرض المختصر"
                        value={productForm.offerTitle || ''}
                        onChange={(v: string) => setProductForm({ ...productForm, offerTitle: v })}
                        placeholder="مثال: خصم نهاية الأسبوع / عرض خاص"
                      />
                      <AdminInput
                        label="تاريخ انتهاء العرض (اختياري)"
                        type="date"
                        value={productForm.offerExpiresAt || ''}
                        onChange={(v: string) => setProductForm({ ...productForm, offerExpiresAt: v })}
                      />
                    </div>

                    <AdminTextarea
                      label="الإضافات والمزايا المجانية المرفقة مع المنتج"
                      value={productForm.offerExtras || ''}
                      onChange={(v: string) => setProductForm({ ...productForm, offerExtras: v })}
                      placeholder="مثال: يشمل شاحن أصلي مجاني + غطاء حماية + تغليف هدايا مجاني"
                    />
                  </div>
                )}
              </div>

              {/* Product Variants Configuration (Independent Store-Scoped) */}
              {(() => {
                const targetOwnerId = productForm.ownerId || currentTargetStoreId || user?.uid || '';
                const currentVariants: ProductVariant[] = Array.isArray(productForm.variants) ? productForm.variants : [];

                const addBlankVariant = () => {
                  if (currentVariants.length >= 30) {
                    toast.error('الحد الأقصى 30 صنفاً لكل منتج');
                    return;
                  }
                  const newVariant: ProductVariant = {
                    id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    name: '',
                    price: Number(productForm.price) || 0,
                    originalPrice: null,
                    stock: null,
                    image: '',
                    notes: '',
                    storeId: targetOwnerId,
                    available: true,
                  };
                  setProductForm({ ...productForm, variants: [...currentVariants, newVariant] });
                };

                const updateVariantField = (idx: number, patch: Partial<ProductVariant>) => {
                  const next = currentVariants.map((item, i) =>
                    i === idx ? { ...item, ...patch, storeId: targetOwnerId } : item
                  );
                  setProductForm({ ...productForm, variants: next });
                };

                const removeVariant = (idx: number) => {
                  const next = currentVariants.filter((_, i) => i !== idx);
                  setProductForm({ ...productForm, variants: next });
                };

                return (
                  <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] shrink-0">
                          <Layers className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">أصناف المنتج المستقلة (اختياري)</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-300">
                              خاصة بالمتجر الناشر فقط
                            </span>
                          </div>
                          <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-0.5">
                            أضف كل صنف بشكل منفرد بسعره ومخزونه وصورته، ولكل صنف قائمته الخاصة عند الضغط عليه دون التأثير على سعر المنتج الأساسي عند شرائه وحده
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addBlankVariant}
                        className="min-h-[38px] px-3.5 py-2 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة صنف منفرد</span>
                      </button>
                    </div>

                    {currentVariants.length === 0 ? (
                      <div className="p-3 rounded-md bg-white dark:bg-[#131519] border border-dashed border-[#E5E2DA] dark:border-[#232730] text-[11px] text-[#5C5B57] dark:text-zinc-400 text-center font-medium">
                        لم يتم إضافة أصناف بعد. اضغط «إضافة صنف منفرد» لإدخال كل صنف بسعره ومخزونه وصورته.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {currentVariants.map((variant, vIdx) => (
                          <div
                            key={variant.id || vIdx}
                            className="p-3.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E2DA] dark:border-[#232730]">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] tabular-nums">
                                  صنف #{vIdx + 1}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold">
                                  <input
                                    type="checkbox"
                                    checked={variant.available !== false}
                                    onChange={(e) => updateVariantField(vIdx, { available: e.target.checked })}
                                    className="w-3.5 h-3.5 rounded"
                                  />
                                  <span>متاح</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removeVariant(vIdx)}
                                  className="w-8 h-8 rounded-md border border-[#E5E2DA] dark:border-[#232730] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition"
                                  aria-label="حذف الصنف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <AdminInput
                                label="اسم الصنف"
                                value={variant.name}
                                onChange={(val: string) => updateVariantField(vIdx, { name: val })}
                                placeholder="مثال: عبوة 500 جم / مقاس XL / لون أسود"
                                required
                              />
                              <AdminInput
                                label="سعر الصنف (ر.ي)"
                                type="number"
                                value={(variant.price ?? '').toString()}
                                onChange={(val: string) => updateVariantField(vIdx, { price: val === '' ? 0 : Number(val) })}
                                placeholder="0"
                                required
                              />
                              <AdminInput
                                label="السعر قبل الخصم (اختياري)"
                                type="number"
                                value={variant.originalPrice === null || variant.originalPrice === undefined ? '' : variant.originalPrice.toString()}
                                onChange={(val: string) => updateVariantField(vIdx, { originalPrice: val === '' ? null : Number(val) })}
                                placeholder="بدون سعر سابق"
                              />
                              <AdminInput
                                label="مخزون الصنف (فارغ = غير محدود)"
                                type="number"
                                value={variant.stock === null || variant.stock === undefined ? '' : Number(variant.stock).toString()}
                                onChange={(val: string) => updateVariantField(vIdx, { stock: val === '' ? null : Math.max(0, Math.floor(Number(val))) })}
                                placeholder="غير محدود"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                              <AdminInput
                                label="ملاحظة / مواصفة الصنف (اختياري)"
                                value={variant.notes || ''}
                                onChange={(val: string) => updateVariantField(vIdx, { notes: val })}
                                placeholder="مثال: وزن صافي 500 جرام مع تغليف محكم"
                              />
                              <div className="flex items-center gap-2">
                                {variant.image ? (
                                  <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] shrink-0">
                                    <img src={variant.image} alt={variant.name} className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => updateVariantField(vIdx, { image: '' })}
                                      className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 text-white flex items-center justify-center transition"
                                      aria-label="إزالة صورة الصنف"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : null}
                                <label className="min-h-[44px] px-3 py-2 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:border-[#111214] dark:hover:border-zinc-500 text-[11px] font-bold text-[#111214] dark:text-[#F4F4F2] cursor-pointer flex items-center gap-1.5 shrink-0 transition">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>{variant.image ? 'تغيير الصورة' : 'صورة الصنف'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      toast.loading('جاري ضغط صورة الصنف...', { id: `var-img-${vIdx}` });
                                      reader.onloadend = async () => {
                                        try {
                                          const compressed = await compressImage(reader.result as string, 600, 600, 0.6);
                                          updateVariantField(vIdx, { image: compressed });
                                          toast.success('تم رفع صورة الصنف', { id: `var-img-${vIdx}` });
                                        } catch {
                                          toast.error('فشل في ضغط الصورة', { id: `var-img-${vIdx}` });
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Delivery Mode & Pre-Order / Store-Pickup-Only Configuration */}
              {(() => {
                const targetOwnerId = productForm.ownerId || currentTargetStoreId || user?.uid;
                const targetStoreObj = (targetOwnerId === currentTargetStoreId && storeProfile)
                  ? storeProfile
                  : allStoreProfiles.find(sp => sp.id === targetOwnerId || sp.userId === targetOwnerId);
                const isVerifiedForPreOrder = targetStoreObj
                  ? Boolean(targetStoreObj.verified) && (!targetStoreObj.verifiedUntil || targetStoreObj.verifiedUntil === '' || new Date(targetStoreObj.verifiedUntil).getTime() >= Date.now())
                  : (Boolean(storeProfile?.verified) && (!storeProfile?.verifiedUntil || storeProfile?.verifiedUntil === '' || new Date(storeProfile.verifiedUntil).getTime() >= Date.now()));
                const isNoDelivery = Boolean(productForm.noDelivery);
                const durationPresets = [1, 2, 3, 5, 7, 10, 14, 30];
                const currentDuration = Math.max(1, Math.min(365, Math.floor(Number(productForm.reservationDurationDays) || 3)));

                return (
                  <div className="space-y-4">
                    {/* Fulfillment / Delivery Mode Card */}
                    <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] space-y-3">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-[#111214] dark:text-[#F4F4F2] shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">نظام التوصيل والاستلام</h4>
                          <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                            اختر ما إذا كان المنتج يقبل التوصيل أو يُحجز فقط للاستلام من المتجر نفسه بدون توصيل
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, noDelivery: false })}
                          className={`p-3 rounded-lg border text-right transition flex items-start gap-2.5 ${
                            !isNoDelivery
                              ? `${getThemeClasses('border')} ${getThemeClasses('bgLight')}`
                              : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] hover:border-[#111214]/40'
                          }`}
                        >
                          <Truck className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">توصيل متاح للعملاء</p>
                            <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-0.5">
                              يُطلب عبر السلة مع تحديد رسوم التوصيل من الموصل
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setProductForm({
                            ...productForm,
                            noDelivery: true,
                            isPreOrderEnabled: true,
                            offerType: productForm.offerType === 'free_delivery' ? 'discount' : productForm.offerType
                          })}
                          className={`p-3 rounded-lg border text-right transition flex items-start gap-2.5 ${
                            isNoDelivery
                              ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/35'
                              : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730] hover:border-amber-500/60'
                          }`}
                        >
                          <Store className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                          <div>
                            <p className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">لا يوجد توصيل — الاستلام من المتجر فقط</p>
                            <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-0.5">
                              حجز بعربون فقط والعميل يحضر للمتجر للاستلام خلال المدة المحددة
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Deposit & Duration Configuration (Always visible if noDelivery OR verified store) */}
                    {(!isNoDelivery && !isVerifiedForPreOrder) ? (
                      <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-dashed border-[#E5E2DA] dark:border-[#232730] space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <h4 className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">ميزة الحجز المسبق (دفع عربون)</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            خاصة بالمتاجر الموثقة أو منتجات الاستلام من المتجر
                          </span>
                        </div>
                        <p className="text-xs text-[#5C5B57] dark:text-zinc-400 leading-relaxed">
                          للمنتجات التي تدعم التوصيل، يُسمح بتفعيل الحجز المسبق الإضافي للمتاجر الموثقة. أو يمكنك اختيار «لا يوجد توصيل — الاستلام من المتجر فقط» أعلاه لتفعيل الحجز بالعربون مباشرة.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <div>
                              <h4 className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                                {isNoDelivery ? 'إعدادات الحجز للاستلام من المتجر (إلزامي عند إيقاف التوصيل)' : 'إعدادات الحجز المسبق (دفع عربون)'}
                              </h4>
                              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">
                                {isNoDelivery
                                  ? 'حدد مبلغ العربون والمدة المسموحة لحضور العميل إلى المتجر لاستلام المنتج'
                                  : 'تحديد مبلغ العربون ومدة الحجز'}
                              </p>
                            </div>
                          </div>
                          {!isNoDelivery && (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={productForm.isPreOrderEnabled ?? true}
                                onChange={(e) => setProductForm({ ...productForm, isPreOrderEnabled: e.target.checked })}
                                className="w-4 h-4 rounded text-amber-600"
                              />
                              <span className="text-xs font-bold">تفعيل ميزة الحجز</span>
                            </label>
                          )}
                        </div>

                        {(isNoDelivery || (productForm.isPreOrderEnabled ?? true)) && (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <AdminInput
                                label="مبلغ العربون المطلوب (ريال)"
                                type="number"
                                value={productForm.depositAmount === undefined || productForm.depositAmount === null ? '' : productForm.depositAmount.toString()}
                                onChange={(v: string) => setProductForm({ ...productForm, depositAmount: v === '' ? null : Number(v) })}
                                placeholder="افتراضياً 20%"
                                extra="اتركه فارغاً لاحتساب 20% تلقائياً"
                              />

                              <div className="space-y-1.5">
                                <div className="flex justify-between items-end gap-2">
                                  <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                                    مدة صلاحية الحجز (بالأيام)
                                  </label>
                                  <span className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400">
                                    من 1 إلى 90 يوماً
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <select
                                    value={durationPresets.includes(currentDuration) ? currentDuration : 'custom'}
                                    onChange={(e) => {
                                      if (e.target.value !== 'custom') {
                                        setProductForm({ ...productForm, reservationDurationDays: Number(e.target.value) });
                                      }
                                    }}
                                    className="w-full min-h-[44px] bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3 py-2 font-bold text-xs text-[#111214] dark:text-[#F4F4F2] outline-none"
                                  >
                                    <option value={1}>يوم واحد (24 ساعة)</option>
                                    <option value={2}>يومان (48 ساعة)</option>
                                    <option value={3}>3 أيام (موصى به)</option>
                                    <option value={5}>5 أيام</option>
                                    <option value={7}>أسبوع (7 أيام)</option>
                                    <option value={10}>10 أيام</option>
                                    <option value={14}>أسبوعان (14 يوماً)</option>
                                    <option value={30}>شهر (30 يوماً)</option>
                                    {!durationPresets.includes(currentDuration) && (
                                      <option value="custom">مخصص ({currentDuration} أيام)</option>
                                    )}
                                  </select>
                                  <input
                                    type="number"
                                    min={1}
                                    max={90}
                                    value={currentDuration}
                                    onChange={(e) => {
                                      const val = Math.max(1, Math.min(90, Math.floor(Number(e.target.value) || 1)));
                                      setProductForm({ ...productForm, reservationDurationDays: val });
                                    }}
                                    placeholder="أدخل عدد الأيام"
                                    className="w-full min-h-[44px] bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3 py-2 font-bold text-sm text-[#111214] dark:text-[#F4F4F2] outline-none tabular-nums"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-md border border-rose-200 dark:border-rose-800/50">
                              <p className="text-[11px] text-rose-800 dark:text-rose-200 font-medium leading-relaxed flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                                <span>
                                  {isNoDelivery
                                    ? `لا يوجد توصيل لهذا المنتج: يحجز العميل المنتج بدفع العربون فقط ويحضر إلى المتجر نفسه للاستلام وسداد الباقي خلال (${currentDuration}) أيام، وإذا لم يأتِ للاستلام خلال المدة يذهب العربون للمتجر.`
                                    : `في حال لم يُتم الزبون الشراء خلال المدة المحددة (${currentDuration} أيام)، يُلغى الحجز تلقائياً ويذهب العربون للمتجر.`}
                                </span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Product Images Grid */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">صور المنتج</label>
                  <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400">ارفع صوراً لسلعتك من جهازك</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {(productForm.images || []).map((img: string, idx: number) => (
                    <div key={idx} className="relative aspect-square rounded-lg border border-[#E5E2DA] dark:border-[#232730] overflow-hidden group bg-[#FAF9F6] dark:bg-[#101216] flex flex-col items-center justify-center">
                      {img ? (
                        <>
                          <img src={img} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                const newImgs = productForm.images.filter((_: any, i: number) => i !== idx);
                                setProductForm({ ...productForm, images: newImgs });
                              }}
                              className="w-10 h-10 bg-white rounded-lg text-rose-600 flex items-center justify-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-[#5C5B57] dark:text-zinc-400 p-2 text-center">
                          <ImageIcon className="w-6 h-6" />
                          <span className="text-[11px] font-bold">صورة {idx + 1}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                toast.loading('جاري ضغط وتحسين جودة الصورة...', { id: 'prod-img' });
                                reader.onloadend = async () => {
                                  try {
                                    const compressed = await compressImage(reader.result as string);
                                    const newImgs = [...productForm.images];
                                    newImgs[idx] = compressed;
                                    setProductForm({ ...productForm, images: newImgs });
                                    toast.success('تم رفع الصورة بنجاح', { id: 'prod-img' });
                                  } catch {
                                    toast.error('فشل في ضغط الصورة', { id: 'prod-img' });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setProductForm({ ...productForm, images: [...(productForm.images || []), ''] })}
                    className="aspect-square rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] flex flex-col items-center justify-center gap-2 hover:border-[#111214] dark:hover:border-zinc-400 bg-[#FAF9F6] dark:bg-[#101216] transition text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]"
                  >
                    <Plus className="w-6 h-6" />
                    <span className="text-xs font-bold">إضافة صورة</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className={`w-full min-h-[48px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>
                  {productForm.id
                    ? (isAdmin ? 'تحديث المنتج' : 'حفظ التعديلات في قائمة الانتظار')
                    : (isAdmin ? 'إضافة المنتج للمتجر' : 'حفظ في قائمة انتظار المتجر')}
                </span>
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Full Product Details & Moderation Safety Modal */}
      {inspectingProduct && (
        <ProductSafetyModal
          product={inspectingProduct}
          storeName={
            inspectingProduct.ownerName ||
            allStoreProfiles.find(sp => sp.id === inspectingProduct.ownerId || sp.userId === inspectingProduct.ownerId)?.name ||
            storeProfile?.name ||
            'متجر مسجل'
          }
          storeVerified={
            Boolean(
              allStoreProfiles.find(sp => sp.id === inspectingProduct.ownerId || sp.userId === inspectingProduct.ownerId)?.verified ??
              storeProfile?.verified
            )
          }
          isAdmin={isAdmin}
          onClose={() => setInspectingProduct(null)}
          onEdit={(prod) => {
            setInspectingProduct(null);
            setProductForm({ ...prod, images: prod.images || [], variants: getProductVariants(prod), noDelivery: Boolean(prod.noDelivery), reservationDurationDays: prod.reservationDurationDays || 3 });
          }}
          onSubmitForReview={async (prod) => {
            try {
              const sName = prod.ownerName || storeProfile?.name || userData?.name || 'متجر مسجل';
              await submitProductForReviewAction(prod, sName);
              toast.success('تم إرسال المنتج لمراجعة الإدارة بنجاح! سيصلك إشعار فور البت في النشر.');
              setInspectingProduct(null);
            } catch (err: any) {
              toast.error(err?.message || 'فشل إرسال المنتج للمراجعة');
            }
          }}
          onApproveAndPublish={async (prod) => {
            try {
              await approveAndPublishProductAction(prod, user?.uid || 'admin');
              const notifiedCount = await notifyWatchersOnProductUpdate({
                productId: prod.id,
                productTitle: String(prod.title || 'منتج'),
                storeName: String(prod.ownerName || storeProfile?.name || 'المتجر'),
                prevPrice: Number(prod.price || 0),
                nextPrice: Number(prod.price || 0),
                prevOutOfStock: prod.available === false || prod.stock === 0,
                nextOutOfStock: prod.available === false || prod.stock === 0,
              });
              toast.success(
                notifiedCount > 0
                  ? `تم قبول ونشر «${prod.title}» وتنبيه ${notifiedCount} عميل عبر الرادار`
                  : `تم قبول ونشر «${prod.title}» للعامة بنجاح`
              );
              setInspectingProduct(null);
            } catch (err: any) {
              toast.error(err?.message || 'فشل اعتماد المنتج');
            }
          }}
          onReject={async (prod, reason) => {
            try {
              await rejectProductAction(prod, user?.uid || 'admin', reason);
              toast.success('تم رفض نشر المنتج وإشعار المتجر بالسبب');
              setInspectingProduct(null);
            } catch (err: any) {
              toast.error(err?.message || 'يرجى كتابة سبب الرفض');
            }
          }}
          onMoveToQueue={async (prod) => {
            try {
              await moveProductToStoreQueueAction(prod.id);
              toast.success('تمت إعادة المنتج إلى قائمة انتظار المتجر');
              setInspectingProduct(null);
            } catch (err: any) {
              toast.error(err?.message || 'فشل نقل المنتج لقائمة الانتظار');
            }
          }}
        />
      )}

      {/* Non-Destructive Statistics Reset Confirmation Modal */}
      {showResetStatsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl p-5 sm:p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[#111214] dark:text-[#F4F4F2]">تصفير عداد الإحصائيات</h3>
                  <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium">إعادة البدء من الصفر داخل التقرير فقط</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetStatsModal(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-[#5C5B57] hover:bg-[#FAF9F6] dark:hover:bg-[#101216]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] space-y-2 text-xs text-[#111214] dark:text-[#F4F4F2] leading-relaxed">
              <p className="font-bold">سيتم تصفير عرض الأرقام التالية لتبدأ من (0) اعتباراً من الآن:</p>
              <ul className="list-disc pr-4 space-y-1 text-[#5C5B57] dark:text-zinc-300">
                <li>الزيارات والمستخدمون المسجلون الجدد</li>
                <li>عداد الطلبات وإجمالي المبيعات وقائمة الأكثر مبيعاً</li>
              </ul>
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 pt-1">
                ✓ ملاحظة هامة: لن يتم حذف أي طلبات حقيقية أو منتجات أو حسابات مستخدمين من قاعدة البيانات، ويمكنك إلغاء التصفير أو عرض السجل السابق في أي وقت.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetStatsModal(false)}
                disabled={isResettingStats}
                className="px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] text-xs font-bold text-[#111214] dark:text-[#F4F4F2] hover:bg-[#FAF9F6] dark:hover:bg-[#101216]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmResetStats}
                disabled={isResettingStats}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {isResettingStats ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>تأكيد التصفير (في الإحصائيات فقط)</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }> = ({ active, onClick, icon, label, count }) => {
  const { getThemeClasses } = useAppContext();
  return (
    <button
      onClick={onClick}
      className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg transition text-xs font-bold ${
        active
          ? `${getThemeClasses('bg')} text-white`
          : 'text-[#5C5B57] dark:text-zinc-400 hover:bg-[#FAF9F6] dark:hover:bg-[#101216] hover:text-[#111214] dark:hover:text-[#F4F4F2]'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      {!active && count !== undefined && count > 0 && (
        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

function StatCard({ label, value, icon, trend }: { label: string; value: any; icon: React.ReactNode; trend?: string }) {
  return (
    <div className="p-4 sm:p-5 space-y-1.5">
      <div className="flex items-center justify-between text-[#5C5B57] dark:text-zinc-400">
        <span className="text-[11px] font-bold">{label}</span>
        <span className="opacity-80 shrink-0">{icon}</span>
      </div>
      <h3 className="text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums tracking-tight">{value}</h3>
      {trend && (
        <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">
          {trend}
        </p>
      )}
    </div>
  );
}
