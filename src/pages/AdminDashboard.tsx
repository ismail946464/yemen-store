import React, { useState, useEffect, useRef } from 'react';
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
  Navigation, Loader2, EyeOff, RefreshCw
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import WalletManagement from '../components/WalletManagement';
import StoreAccountsManagement from '../components/StoreAccountsManagement';

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
  location?: { lat: number; lng: number } | null;
  coordinates?: { lat: number; lng: number } | null;
  googleMapsUrl?: string;
  themeColor?: string;
  lastSeen?: string;
}

type AdminTab =
  | 'overview'
  | 'products'
  | 'orders'
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
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return isoDate;
  }
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
  const [isSaving, setIsSaving] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [serverLogs, setServerLogs] = useState<any[]>([]);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [showResetCatsConfirm, setShowResetCatsConfirm] = useState(false);

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
  const [categoryForm, setCategoryForm] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: string; title: string; email?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSettings, setLocalSettings] = useState<any>({});
  const [showQrModal, setShowQrModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);

  const handleTestGeminiKey = async () => {
    setIsTestingGemini(true);
    const toastId = toast.loading('جاري اختبار الاتصال بنظام الذكاء الاصطناعي للمتجر...');
    try {
      const res = await fetch('/api/ai/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      'overview', 'products', 'orders', 'users', 'stores',
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

        const unsubLogs = onSnapshot(query(collection(db, 'serverLogs'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
          setServerLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.warn('ServerLogs listener notice:', err.message));
        unsubscribers.push(unsubLogs);

        const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (!data.storePublicUrl) {
              data.storePublicUrl = 'https://www.yemenstoreonline.com';
            }
            setLocalSettings(data);
          }
        }, (err) => console.warn('Global settings listener notice:', err.message));
        unsubscribers.push(unsubSettings);
      }
    };

    fetchData();
    return () => unsubscribers.forEach(unsub => unsub());
  }, [user, isAdmin, isStore, loading]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm) return;
    setIsSaving(true);
    try {
      const targetOwnerId = productForm.ownerId || currentTargetStoreId || user?.uid;
      const targetStoreObj = (targetOwnerId === currentTargetStoreId && storeProfile)
        ? storeProfile
        : allStoreProfiles.find(sp => sp.id === targetOwnerId || sp.userId === targetOwnerId);
      const isTargetStoreVerified = targetStoreObj
        ? Boolean(targetStoreObj.verified) && (!targetStoreObj.verifiedUntil || targetStoreObj.verifiedUntil === '' || new Date(targetStoreObj.verifiedUntil).getTime() >= Date.now())
        : (Boolean(storeProfile?.verified) && (!storeProfile?.verifiedUntil || storeProfile?.verifiedUntil === '' || new Date(storeProfile.verifiedUntil).getTime() >= Date.now()));

      const data: any = {
        ...productForm,
        image: productForm.images?.[0] || '',
        price: Number(productForm.price),
        stock: productForm.stock === '' || productForm.stock === undefined || productForm.stock === null ? null : Number(productForm.stock),
        isPreOrderEnabled: isTargetStoreVerified ? (productForm.isPreOrderEnabled ?? true) : false,
        reservationDurationDays: Number(productForm.reservationDurationDays) || 3,
        ownerId: productForm.ownerId || user?.uid,
        updatedAt: new Date().toISOString()
      };

      if (productForm.depositAmount !== '' && productForm.depositAmount !== null && productForm.depositAmount !== undefined) {
        data.depositAmount = Number(productForm.depositAmount);
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
        await updateDoc(doc(db, 'products', productForm.id), data);
        toast.success('تم تحديث المنتج');
      } else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'products'), data);
        toast.success('تم إضافة المنتج');
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

  const handleUpdateStoreProfile = async () => {
    if (!storeProfile || !user || !currentTargetStoreId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'storeProfiles', currentTargetStoreId), {
        ...storeProfile,
        userId: currentTargetStoreId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
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
      toast.success('تم الحذف بنجاح');
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('فشل الحذف: ' + (err?.message || 'يرجى المحاولة لاحقاً'));
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
      toast.success('تم تحديث حالة الطلب');
    } catch {
      toast.error('فشل التحديث');
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
      productCount: products.filter(p => p.ownerId === id).length
    };
  });

  const filteredStores = allStoresList.filter(s => {
    if (!storesSearchTerm.trim()) return true;
    const term = storesSearchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || s.phone.includes(term);
  });

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; count?: number; adminOnly?: boolean }[] = [
    { id: 'overview', label: 'الإحصائيات', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'store-profile', label: 'الملف التجاري', icon: <Store className="w-4 h-4" /> },
    { id: 'wallets', label: 'المحافظ الإلكترونية', icon: <Wallet className="w-4 h-4" /> },
    { id: 'products', label: 'المنتجات', icon: <Package className="w-4 h-4" /> },
    { id: 'orders', label: 'طلبات الشراء', icon: <ShoppingCart className="w-4 h-4" />, count: viewedTabs['orders'] ? undefined : orders.filter(o => o.status === 'pending').length },
    ...(isAdmin ? [
      { id: 'store-accounts' as AdminTab, label: 'الحسابات وكلمات المرور', icon: <KeyRound className="w-4 h-4" />, adminOnly: true },
      { id: 'stores' as AdminTab, label: 'المتاجر والتوثيق', icon: <ShieldCheck className="w-4 h-4" />, count: viewedTabs['stores'] ? undefined : allStoresList.length, adminOnly: true },
      { id: 'users' as AdminTab, label: 'المستخدمون', icon: <Users className="w-4 h-4" />, count: viewedTabs['users'] ? undefined : users.length, adminOnly: true },
      { id: 'categories' as AdminTab, label: 'التصنيفات', icon: <ListFilter className="w-4 h-4" />, adminOnly: true },
      { id: 'settings' as AdminTab, label: 'إعدادات المنصة', icon: <SettingsIcon className="w-4 h-4" />, adminOnly: true },
      { id: 'server' as AdminTab, label: 'إدارة السيرفر', icon: <Server className="w-4 h-4" />, adminOnly: true }
    ] : [])
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6" dir="rtl">
      {/* Mobile Top Tab Rail */}
      <div className="lg:hidden mb-4 bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between bg-[#FAF9F6] dark:bg-[#101216]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-md ${settings?.storeLogo ? 'bg-white border border-[#E5E2DA]' : `${getThemeClasses('bg')} text-white`} flex items-center justify-center overflow-hidden`}>
              {settings?.storeLogo ? (
                <img src={settings.storeLogo} alt="Logo" className="w-full h-full object-contain p-0.5" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">لوحة التحكم</h2>
              <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-medium">{settings?.storeName || 'إدارة النظام'}</p>
            </div>
          </div>

          <button
            onClick={toggleDarkMode}
            className="w-10 h-10 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex items-center justify-center text-[#111214] dark:text-[#F4F4F2]"
            aria-label={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`min-h-[44px] px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 shrink-0 ${
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
      </div>

      {/* Desktop 2-Pane Architectural Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block sticky top-20 bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden">
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

          <nav className="p-2.5 space-y-1">
            {navItems.filter(n => !n.adminOnly).map(item => (
              <NavItem
                key={item.id}
                active={activeTab === item.id}
                onClick={() => handleTabClick(item.id)}
                icon={item.icon}
                label={item.label}
                count={viewedTabs[item.id] ? undefined : item.count}
              />
            ))}

            {isAdmin && (
              <div className="pt-3 mt-3 border-t border-[#E5E2DA] dark:border-[#232730] space-y-1">
                <p className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400 px-3 py-1">إدارة النظام</p>
                {navItems.filter(n => n.adminOnly).map(item => (
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

            <div className="pt-3 mt-3 border-t border-[#E5E2DA] dark:border-[#232730] space-y-2">
              <button
                onClick={toggleDarkMode}
                className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
              >
                <span className="flex items-center gap-2.5">
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                  <span>{isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                </span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setShowQrModal(true)}
                  className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                >
                  <QrCode className="w-4 h-4" />
                  <span>رمز QR المتجر</span>
                </button>
              )}
            </div>
          </nav>
        </aside>

        {/* Main Content Workspace */}
        <main className="min-w-0 bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg p-4 sm:p-6 lg:p-8 min-h-[70vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {/* TAB: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h1 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">نظرة عامة</h1>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        أداء المتجر ونشاط المستخدمين في الوقت الفعلي
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span>{globalStats.onlineCount} متصل الآن</span>
                    </div>
                  </div>

                  {(() => {
                    const totalRevenue = orders
                      .filter(o => o.status !== 'cancelled')
                      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

                    const todayOrders = orders.filter(o => {
                      try {
                        return new Date(o.createdAt).toDateString() === new Date().toDateString();
                      } catch {
                        return false;
                      }
                    });

                    const productSalesMap: Record<string, number> = {};
                    orders.forEach(o => {
                      if (o.status !== 'cancelled' && Array.isArray(o.items)) {
                        o.items.forEach((item: any) => {
                          const pid = item.productId || item.id;
                          if (pid) {
                            productSalesMap[pid] = (productSalesMap[pid] || 0) + (Number(item.quantity) || 1);
                          }
                        });
                      }
                    });

                    const bestSellers = [...products]
                      .map(p => ({ ...p, soldCount: productSalesMap[p.id] || 0 }))
                      .sort((a, b) => b.soldCount - a.soldCount);

                    return (
                      <>
                        {/* 4-Cell Consolidated Hairline KPI Ledger */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden bg-[#FAF9F6] dark:bg-[#101216] divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730]">
                          <StatCard
                            label="إجمالي الزيارات"
                            value={globalStats.totalVisitors}
                            icon={<Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
                            trend={`${globalStats.onlineCount} متصل`}
                          />
                          <StatCard
                            label="المستخدمون المسجلون"
                            value={globalStats.totalRegistered || users.length}
                            icon={<Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                            trend={`${users.filter(u => u.role === 'store').length} متجر`}
                          />
                          <StatCard
                            label="طلبات اليوم"
                            value={`${todayOrders.length} طلب`}
                            icon={<ShoppingCart className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                            trend={todayOrders.length > 0 ? 'نشط' : undefined}
                          />
                          <StatCard
                            label="إجمالي المبيعات"
                            value={`${totalRevenue.toLocaleString()} ر.ي`}
                            icon={<DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                            trend={`${orders.length} طلب`}
                          />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          {/* Recent Orders */}
                          <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden bg-white dark:bg-[#131519]">
                            <div className="px-5 py-3.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between">
                              <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
                                <span>أحدث الطلبات الفعلية</span>
                              </h3>
                              <button
                                onClick={() => handleTabClick('orders')}
                                className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition"
                              >
                                عرض الكل
                              </button>
                            </div>
                            <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                              {orders.length === 0 ? (
                                <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium py-8 text-center">
                                  لا توجد طلبات مسجلة بعد
                                </p>
                              ) : (
                                orders.slice(0, 5).map(order => (
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
                                          {new Date(order.createdAt).toLocaleDateString('ar-YE')}
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

                          {/* Best Sellers */}
                          <div className="border border-[#E5E2DA] dark:border-[#232730] rounded-lg overflow-hidden bg-white dark:bg-[#131519]">
                            <div className="px-5 py-3.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between">
                              <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
                                <span>المنتجات الأكثر مبيعاً</span>
                              </h3>
                              <button
                                onClick={() => handleTabClick('products')}
                                className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition"
                              >
                                إدارة المنتجات
                              </button>
                            </div>
                            <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                              {bestSellers.length === 0 ? (
                                <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium py-8 text-center">
                                  لا توجد منتجات مسجلة بعد
                                </p>
                              ) : (
                                bestSellers.slice(0, 5).map((product, idx) => (
                                  <div key={idx} className="p-3.5 flex items-center gap-3.5">
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
                                          {product.soldCount > 0 ? `${product.soldCount} مبيعة` : (product.category || 'متوفر')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

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
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <AdminInput
                          label="اسم المتجر"
                          value={storeProfile.name}
                          onChange={(v: string) => setStoreProfile({ ...storeProfile, name: v })}
                          placeholder={`مثال: ${localSettings.storeName || 'متجر صنعاء'}`}
                        />
                        <AdminInput
                          label="عنوان المتجر التفصيلي"
                          value={storeProfile.address || ''}
                          onChange={(v: string) => setStoreProfile({ ...storeProfile, address: v })}
                          placeholder="صنعاء - شارع حدة - أمام مركز الكميم"
                        />
                      </div>
                      <AdminTextarea
                        label="وصف المتجر"
                        value={storeProfile.description}
                        onChange={(v: string) => setStoreProfile({ ...storeProfile, description: v })}
                        placeholder="اكتب نبذة عن متجرك ومنتجاتك..."
                      />

                      {/* Store Physical Location & GPS */}
                      <div className="p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] flex items-center justify-center shrink-0">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                                موقع المتجر الجغرافي للاستلام (GPS)
                              </h4>
                              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-medium">
                                يستخدمه مندوب التوصيل للتوجه المباشر إلى باب متجرك واستلام الطلب
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
                                <span>تحديد موقع متجري عبر GPS</span>
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

                          <div>
                            <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-[#F4F4F2]">
                              رابط موقع المتجر من خرائط Google (اختياري)
                            </label>
                            <input
                              type="url"
                              value={storeProfile.googleMapsUrl || ''}
                              onChange={(e) => setStoreProfile({ ...storeProfile, googleMapsUrl: e.target.value })}
                              placeholder="https://maps.google.com/?q=..."
                              className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] text-xs font-medium dir-ltr outline-none"
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
                              <span>تجربة ملاحة المندوب في Google Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
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
                  </div>
                </div>
              )}

              {/* TAB: WALLETS */}
              {activeTab === 'wallets' && (
                <div className="space-y-6">
                  {isAdmin && (
                    <div className="p-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            إدارة حسابات الدفع والتحويل
                          </span>
                          <p className="text-sm font-bold mt-1 text-[#111214] dark:text-[#F4F4F2]">
                            {currentTargetStoreId === user?.uid
                              ? 'إدارة محافظ: متجرك الشخصي / حساب المنصة'
                              : `إدارة محافظ متجر: ${storeProfile?.name || ('متجر رقم ' + currentTargetStoreId.slice(0, 8))}`}
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
                  <WalletManagement merchantId={currentTargetStoreId || 'global'} />
                </div>
              )}

              {/* TAB: PRODUCTS */}
              {activeTab === 'products' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">إدارة المنتجات</h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        عرض، تعديل، وإضافة منتجات جديدة للمتجر
                      </p>
                    </div>
                    <button
                      onClick={() => setProductForm({ title: '', price: '', description: '', stock: 0, category: 'عام', images: [], status: 'active' })}
                      className={`min-h-[44px] ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white px-5 py-2.5 rounded-lg font-bold text-xs transition flex items-center gap-2 self-start sm:self-auto`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة منتج جديد</span>
                    </button>
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
                            <th className="py-3.5 px-4 text-center">الحالة</th>
                            <th className="py-3.5 px-4 text-left">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                          {products
                            .filter(p => (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(product => (
                              <tr key={product.id} className="hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition">
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 bg-[#FAF9F6] dark:bg-[#101216] rounded-md overflow-hidden border border-[#E5E2DA] dark:border-[#232730] shrink-0">
                                      {product.images?.[0] && <img src={product.images[0]} className="w-full h-full object-cover" alt="" />}
                                    </div>
                                    <div>
                                      <p className="font-bold text-xs sm:text-sm text-[#111214] dark:text-[#F4F4F2]">{product.title}</p>
                                      <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                                        {product.createdAt ? new Date(product.createdAt).toLocaleDateString('ar-YE') : '—'}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-bold text-[#111214] dark:text-[#F4F4F2] whitespace-nowrap">
                                  {product.category}
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                    {Number(product.price || 0).toLocaleString()} ر.ي
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap tabular-nums">
                                  <span className={`font-bold ${product.stock === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#111214] dark:text-[#F4F4F2]'}`}>
                                    {product.stock === null || product.stock === undefined ? 'غير محدود' : `${product.stock} وحدة`}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    product.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'bg-[#FAF9F6] text-[#5C5B57] border-[#E5E2DA] dark:bg-[#101216] dark:text-zinc-400 dark:border-[#232730]'
                                  }`}>
                                    {product.status === 'active' ? 'نشط' : 'مسودة'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-left whitespace-nowrap">
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => setProductForm({ ...product, images: product.images || [] })}
                                      className="w-9 h-9 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-md flex items-center justify-center text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                                      title="تعديل المنتج"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm({ id: product.id, type: 'products', title: product.title })}
                                      className="w-9 h-9 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-md flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                      title="حذف المنتج"
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
                </div>
              )}

              {/* TAB: ORDERS */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div className="pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">طلبات الشراء</h2>
                    <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                      متابعة طلبات العملاء وتحديث حالات التسليم
                    </p>
                  </div>

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
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold text-[#111214] dark:text-[#F4F4F2]" dir="ltr">
                                    #{order.id.slice(-6).toUpperCase()}
                                  </span>
                                  {(order.isPreOrder || order.orderType === 'preorder') && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold inline-flex items-center gap-1">
                                      <BookmarkCheck className="w-3 h-3" />
                                      <span>عربون</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                <p className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2]">{order.customerName}</p>
                                <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-mono tabular-nums" dir="ltr">{order.customerPhone}</p>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-center tabular-nums">
                                <p className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">{new Date(order.createdAt).toLocaleDateString('ar-YE')}</p>
                                <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400">{new Date(order.createdAt).toLocaleTimeString('ar-YE')}</p>
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
                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-YE') : '—'}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-5">
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

                      {/* AI Assistant Configuration Card */}
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
                    </div>

                    {/* Theme & Appearance Box */}
                    <div className="space-y-5 bg-[#FAF9F6] dark:bg-[#101216] p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730]">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="font-display text-sm font-bold text-[#111214] dark:text-[#F4F4F2]">
                            ستايل ومظهر المنصة العام
                          </h4>
                          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-0.5">
                            اختر الستايل المعتمد للأزرار والبطاقات والترويسة
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730]">
                          {localSettings.storeTheme === 'blue' ? 'أزرق ملكي' :
                           localSettings.storeTheme === 'red' ? 'أحمر ياقوتي' :
                           localSettings.storeTheme === 'black' ? 'أسود فخم' :
                           localSettings.storeTheme === 'green' ? 'أخضر زمردي' : 'أبيض ناصع'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { id: 'white', name: 'أبيض ناصع (الأساسي)', desc: 'نقي مع تباين أسود واضح', swatch: 'bg-white border-2 border-[#111214]' },
                          { id: 'green', name: 'أخضر زمردي', desc: 'أخضر يمني متوازن', swatch: 'bg-emerald-600' },
                          { id: 'blue', name: 'أزرق ملكي', desc: 'أزرق بحري احترافي', swatch: 'bg-blue-600' },
                          { id: 'red', name: 'أحمر ياقوتي', desc: 'أحمر دافئ مميز', swatch: 'bg-rose-600' },
                          { id: 'black', name: 'أسود فخم', desc: 'داكن متكامل المظهر', swatch: 'bg-zinc-950 border border-zinc-700' }
                        ].map((themeItem) => {
                          const isSelected = (localSettings.storeTheme || 'white') === themeItem.id;
                          return (
                            <button
                              key={themeItem.id}
                              type="button"
                              onClick={() => setLocalSettings({ ...localSettings, storeTheme: themeItem.id })}
                              className={`p-3.5 rounded-lg border text-right transition flex flex-col justify-between ${
                                isSelected
                                  ? 'border-[#111214] dark:border-[#F4F4F2] bg-white dark:bg-[#131519]'
                                  : 'border-[#E5E2DA] dark:border-[#232730] bg-white/70 dark:bg-[#131519]/70 hover:bg-white dark:hover:bg-[#131519]'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`w-4 h-4 rounded-full shrink-0 ${themeItem.swatch}`} />
                                  <span className="font-bold text-xs text-[#111214] dark:text-[#F4F4F2]">{themeItem.name}</span>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                              </div>
                              <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">{themeItem.desc}</p>
                            </button>
                          );
                        })}
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
                  </div>

                  {/* Admin Account Security / Change Password Card */}
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
                          value={adminSelfCurrentPass}
                          onChange={(e) => setAdminSelfCurrentPass(e.target.value)}
                          placeholder="••••••••"
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 dir-ltr text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                          كلمة المرور الجديدة *
                        </label>
                        <input
                          type={showAdminSelfPasswords ? 'text' : 'password'}
                          value={adminSelfNewPass}
                          onChange={(e) => setAdminSelfNewPass(e.target.value)}
                          placeholder="4 أحرف على الأقل"
                          required
                          minLength={4}
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 dir-ltr text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#111214] dark:text-[#F4F4F2] mb-1.5">
                          تأكيد كلمة المرور الجديدة *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type={showAdminSelfPasswords ? 'text' : 'password'}
                            value={adminSelfConfirmPass}
                            onChange={(e) => setAdminSelfConfirmPass(e.target.value)}
                            placeholder="أعد كتابة كلمة المرور"
                            required
                            minLength={4}
                            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 dir-ltr text-left"
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

                  {/* Hero Visual Identity */}
                  <div className="pt-6 border-t border-[#E5E2DA] dark:border-[#232730]">
                    <h4 className="font-display text-lg font-bold text-[#111214] dark:text-[#F4F4F2] mb-5 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400" />
                      <span>الهوية المرئية للهيرو</span>
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <ImageEditor
                        label="البانر الرئيسي (Hero Banner)"
                        value={localSettings.heroBanner}
                        onChange={(v: string) => setLocalSettings({ ...localSettings, heroBanner: v })}
                      />
                      <div className="space-y-4">
                        <AdminInput label="عنوان الهيرو" value={localSettings.heroTitle || ''} onChange={(v: any) => setLocalSettings({ ...localSettings, heroTitle: v })} />
                        <AdminTextarea label="العنوان الفرعي" value={localSettings.heroSubtitle || ''} onChange={(v: any) => setLocalSettings({ ...localSettings, heroSubtitle: v })} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <AdminInput
                            label="نص زر الهيرو"
                            value={localSettings.heroButtonText || ''}
                            onChange={(v: any) => setLocalSettings({ ...localSettings, heroButtonText: v })}
                            placeholder="مثال: استكشف المجموعة"
                          />
                          <AdminInput
                            label="رابط زر الهيرو"
                            value={localSettings.heroLink || ''}
                            onChange={(v: any) => setLocalSettings({ ...localSettings, heroLink: v })}
                            placeholder="اتركه فارغاً للتمرير للمنتجات"
                          />
                        </div>
                        <label className="flex items-center gap-3 bg-[#FAF9F6] dark:bg-[#101216] p-3.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={localSettings.showHeroBanner}
                            onChange={e => setLocalSettings({ ...localSettings, showHeroBanner: e.target.checked })}
                            className="w-5 h-5 rounded text-emerald-600 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">تفعيل قسم الهيرو في الصفحة الرئيسية</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Site Icon & Primary Logo Customization */}
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
                              value={localSettings.siteIcon || localSettings.storeLogo || ''}
                              onChange={(e) => setLocalSettings({
                                ...localSettings,
                                storeLogo: e.target.value,
                                siteIcon: e.target.value
                              })}
                              placeholder="https://example.com/my-logo.png"
                              className="w-full min-h-[44px] bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2 text-xs font-mono text-left dir-ltr text-[#111214] dark:text-[#F4F4F2] outline-none"
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
                                    {localSettings.storeName || 'يمن ستور'}
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
                              <span className="text-zinc-200 font-bold">{localSettings.storeName || 'يمن ستور'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: CATEGORIES */}
              {activeTab === 'categories' && isAdmin && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">أقسام وتصنيفات النظام</h2>
                      <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                        إدارة تصنيفات المنتجات وترتيبها في المتجر
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
                        <span>إضافة قسم جديد</span>
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
                            <span className="font-bold tabular-nums">{new Date().toLocaleString('ar-YE')}</span>
                          </div>
                          <div className="flex justify-between items-center py-2.5">
                            <span className="text-zinc-400">المستخدمون المتصلون</span>
                            <span className="font-bold tabular-nums">{globalStats.onlineCount || 1} متصل</span>
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
                                <span className="text-zinc-500 shrink-0 tabular-nums">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
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

              {/* TAB: STORE ACCOUNTS */}
              {activeTab === 'store-accounts' && isAdmin && (
                <StoreAccountsManagement />
              )}
            </motion.div>
          </AnimatePresence>
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
                    value={adminUserNewPass}
                    onChange={(e) => setAdminUserNewPass(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة (4 أحرف+)"
                    required
                    minLength={4}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 dir-ltr text-left"
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
                    {new Date(viewingOrder.createdAt).toLocaleDateString('ar-YE')} — {new Date(viewingOrder.createdAt).toLocaleTimeString('ar-YE')}
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
                    setViewingOrder({ ...viewingOrder, status: e.target.value });
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

            {(viewingOrder.isPreOrder || viewingOrder.orderType === 'preorder') && (
              <div className="p-4 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">بيانات الحجز المسبق والعربون</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                    مدة الحجز: {viewingOrder.reservationDurationDays || 3} أيام
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white dark:bg-[#131519] p-2.5 rounded-md border border-amber-200 dark:border-amber-800/50">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-bold block">العربون المدفوع:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">{(viewingOrder.depositAmount || 0).toLocaleString()} ر.ي</span>
                  </div>
                  <div className="bg-white dark:bg-[#131519] p-2.5 rounded-md border border-amber-200 dark:border-amber-800/50">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-bold block">المتبقي للسداد:</span>
                    <span className="font-bold text-sky-700 dark:text-sky-400 tabular-nums">{(viewingOrder.remainingAmount || 0).toLocaleString()} ر.ي</span>
                  </div>
                  <div className="bg-white dark:bg-[#131519] p-2.5 rounded-md border border-amber-200 dark:border-amber-800/50 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-bold block">انتهاء المهلة:</span>
                    <span className="font-bold text-[11px] tabular-nums">
                      {viewingOrder.reservationExpiresAt ? new Date(viewingOrder.reservationExpiresAt).toLocaleString('ar-YE') : 'غير محدد'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-lg border border-[#E5E2DA] dark:border-[#232730] space-y-3">
              <h4 className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>بيانات العميل والتوصيل</span>
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

            <div className="bg-white p-4 rounded-lg border border-[#E5E2DA] flex justify-center">
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
                  const canvas = document.querySelector('canvas');
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
                onClick={() => {
                  navigator.clipboard.writeText(settings?.storePublicUrl || window.location.origin);
                  toast.success('تم نسخ رابط المتجر');
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
                    value={productForm.stock === null || productForm.stock === undefined ? '' : (productForm.stock || 0).toString()}
                    onChange={(v: string) => setProductForm({ ...productForm, stock: v === '' ? null : v })}
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
                  <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">الحالة</label>
                  <select
                    value={productForm.status}
                    onChange={e => setProductForm({ ...productForm, status: e.target.value })}
                    className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2 font-bold text-sm text-[#111214] dark:text-[#F4F4F2] outline-none"
                  >
                    <option value="active">نشط (يظهر للجميع)</option>
                    <option value="draft">مسودة (مخفي)</option>
                  </select>
                </div>
              </div>

              <AdminTextarea
                label="وصف المنتج"
                value={productForm.description}
                onChange={(v: string) => setProductForm({ ...productForm, description: v })}
                placeholder="اكتب مواصفات وتفاصيل المنتج هنا..."
              />

              {/* Pre-Order / Reservation Configuration */}
              {(() => {
                const targetOwnerId = productForm.ownerId || currentTargetStoreId || user?.uid;
                const targetStoreObj = (targetOwnerId === currentTargetStoreId && storeProfile)
                  ? storeProfile
                  : allStoreProfiles.find(sp => sp.id === targetOwnerId || sp.userId === targetOwnerId);
                const isVerifiedForPreOrder = targetStoreObj
                  ? Boolean(targetStoreObj.verified) && (!targetStoreObj.verifiedUntil || targetStoreObj.verifiedUntil === '' || new Date(targetStoreObj.verifiedUntil).getTime() >= Date.now())
                  : (Boolean(storeProfile?.verified) && (!storeProfile?.verifiedUntil || storeProfile?.verifiedUntil === '' || new Date(storeProfile.verifiedUntil).getTime() >= Date.now()));

                if (!isVerifiedForPreOrder) {
                  return (
                    <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-dashed border-[#E5E2DA] dark:border-[#232730] space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <h4 className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">ميزة الحجز المسبق (دفع عربون)</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          خاصة بالمتاجر الموثقة فقط
                        </span>
                      </div>
                      <p className="text-xs text-[#5C5B57] dark:text-zinc-400 leading-relaxed">
                        يُسمح بتفعيل ميزة الحجز المسبق ودفع العربون فقط للمتاجر الموثقة لحماية حقوق المشترين.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="p-4 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <div>
                          <h4 className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">إعدادات الحجز المسبق (دفع عربون)</h4>
                          <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400">تحديد مبلغ العربون ومدة الحجز</p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={productForm.isPreOrderEnabled ?? true}
                          onChange={(e) => setProductForm({ ...productForm, isPreOrderEnabled: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-600"
                        />
                        <span className="text-xs font-bold">تفعيل ميزة الحجز</span>
                      </label>
                    </div>

                    {(productForm.isPreOrderEnabled ?? true) && (
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
                            <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">
                              مدة صلاحية الحجز
                            </label>
                            <select
                              value={productForm.reservationDurationDays || 3}
                              onChange={(e) => setProductForm({ ...productForm, reservationDurationDays: Number(e.target.value) })}
                              className="w-full min-h-[44px] bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2 font-bold text-sm text-[#111214] dark:text-[#F4F4F2] outline-none"
                            >
                              <option value={1}>يوم واحد (24 ساعة)</option>
                              <option value={2}>يومان (48 ساعة)</option>
                              <option value={3}>3 أيام (72 ساعة - موصى به)</option>
                              <option value={5}>5 أيام</option>
                              <option value={7}>أسبوع كامل (7 أيام)</option>
                              <option value={10}>10 أيام</option>
                              <option value={14}>أسبوعان (14 يوماً)</option>
                            </select>
                          </div>
                        </div>
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-md border border-rose-200 dark:border-rose-800/50">
                          <p className="text-[11px] text-rose-800 dark:text-rose-200 font-medium leading-relaxed flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>في حال لم يُتم الزبون الشراء خلال المدة المحددة، يُلغى الحجز تلقائياً ويذهب العربون للمتجر.</span>
                          </p>
                        </div>
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
                <span>{productForm.id ? 'تحديث المنتج' : 'إضافة المنتج للمتجر'}</span>
              </button>
            </form>
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
    <div className="p-4 sm:p-5 space-y-2">
      <div className="flex items-center justify-between text-[#5C5B57] dark:text-zinc-400">
        <span className="text-[11px] font-bold">{label}</span>
        <span className="w-8 h-8 rounded-md bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center shrink-0">
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className="text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">{value}</h3>
        {trend && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
