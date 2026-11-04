import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, getDoc, setDoc, query, where, orderBy, limit, 
  onSnapshot, Timestamp, serverTimestamp, increment 
} from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import { 
  Store, Users, ShoppingCart, Trash2, Edit, X, 
  Settings as SettingsIcon, Image as ImageIcon, MessageSquare, 
  ListFilter, CheckCircle, Search, User, ArrowRight, 
  TrendingUp, MapPin, AlertTriangle, Sparkles, Send, 
  BrainCircuit, Share2, Globe, Smartphone, QrCode, 
  ExternalLink, Copy, Rocket, Download, FileJson, 
  Check, MoreHorizontal, Plus, ShieldCheck, Shield, Clock, 
  DollarSign, Package, Eye, ChevronLeft, ChevronRight, 
  Twitter, Instagram, Facebook, Mail, Phone,
  BarChart3, LayoutDashboard, Layout, Sun, Moon, Server, Activity,
  Upload, Palette, Wallet, KeyRound, Lock, BookmarkCheck
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { aiSystem } from '../services/geminiService';
import WalletManagement from '../components/WalletManagement';
import StoreAccountsManagement from '../components/StoreAccountsManagement';

// Types for complex data structures
interface StoreProfile {
  userId: string;
  name: string;
  description: string;
  logoUrl: string;
  verified: boolean;
  verifiedUntil?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  address?: string;
  themeColor?: string;
  lastSeen?: string;
}

// Arabic Gregorian Date Formatter
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
  } catch (err) {
    return isoDate;
  }
};

// UI Helpers
const AdminInput = ({ label, value, onChange, type = "text", placeholder, icon, extra }: any) => (
  <div className="space-y-3">
    <div className="flex justify-between items-end px-1">
      <label className="text-sm font-black text-black uppercase tracking-widest">{label}</label>
      {extra && <span className="text-[11px] font-black text-gray-400">{extra}</span>}
    </div>
    <div className="relative group">
      {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors">{icon}</div>}
      <input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder}
        className={`w-full bg-white border-2 border-gray-100 rounded-2xl py-5 ${icon ? 'pr-14' : 'pr-6'} pl-6 font-black text-base text-black placeholder:text-gray-300 focus:ring-4 focus:ring-black/5 focus:border-black focus:bg-white transition-all shadow-md active:scale-[0.99]`}
      />
    </div>
  </div>
);

const AdminTextarea = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-3">
    <label className="text-sm font-black text-black uppercase tracking-widest px-1">{label}</label>
    <textarea 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder}
      className="w-full bg-white border-2 border-gray-100 rounded-[2rem] p-6 font-black text-base text-black placeholder:text-gray-300 focus:ring-4 focus:ring-black/5 focus:border-black focus:bg-white transition-all shadow-md min-h-[160px] active:scale-[0.99]"
    />
  </div>
);

// Image Compression Utility
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

const ImageEditor = ({ label, value, onChange, onGenerate }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      toast.loading('جاري ضغط وتحسين جودة الصورة...', { id: 'img-upload' });
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          onChange(compressed);
          toast.success('تم الرفع بنجاح', { id: 'img-upload' });
        } catch (err) {
          toast.error('فشل في معالجة الصورة');
        }
      };
      reader.onerror = () => {
        toast.error('خطأ في قراءة الملف', { id: 'img-upload' });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <label className="text-sm font-black text-black uppercase tracking-widest">{label}</label>
        {!value && <span className="text-[10px] font-black text-gray-400">PNG, JPG بحد أقصى 2MB</span>}
      </div>
      <div className="relative group overflow-hidden rounded-[2.5rem] border-2 border-dashed border-gray-100 hover:border-black transition-all bg-white shadow-sm h-48 lg:h-64">
        {value ? (
          <div className="relative w-full h-full">
            <img src={value} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4 backdrop-blur-[2px]">
               <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white rounded-2xl text-black hover:scale-110 active:scale-95 transition shadow-2xl shadow-black/20"><Edit className="w-6 h-6"/></button>
               <button onClick={() => onChange('')} className="p-4 bg-white rounded-2xl text-red-500 hover:scale-110 active:scale-95 transition shadow-2xl shadow-black/20"><Trash2 className="w-6 h-6"/></button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-5 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
             <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 transition duration-500">
               <ImageIcon className="w-10 h-10 text-gray-300" />
             </div>
             <div className="text-center px-6">
                <p className="text-sm font-black text-black">اختر صورة من جهازك</p>
                <p className="text-[10px] text-gray-400 font-bold mt-2 leading-relaxed">انقر هنا لتصفح الملفات أو اسحب الصورة مباشرة</p>
             </div>
             <div className="flex gap-2">
                {onGenerate && (
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsGenerating(true);
                      await onGenerate();
                      setIsGenerating(false);
                    }}
                    disabled={isGenerating}
                    className="px-6 py-3 bg-yellow-400 text-black text-[11px] font-black rounded-2xl hover:scale-105 transition flex items-center gap-2 shadow-lg shadow-yellow-400/20"
                  >
                    {isGenerating ? <Clock className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                    توليد ذكي
                  </button>
                )}
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
    isDarkMode, toggleDarkMode, getAuthHeaders
  } = useAppContext();
  
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'users' | 'stores' | 'settings' | 'categories' | 'store-profile' | 'wallets' | 'server' | 'store-accounts'>('overview');
  const [isSaving, setIsSaving] = useState(false);
  
  // Data States
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [serverLogs, setServerLogs] = useState<any[]>([]);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // OTP Email Sender State (Official Store Sender)
  const [otpSenderConfig, setOtpSenderConfig] = useState({
    senderEmail: 'yemenstore@gmail.com',
    senderName: 'اليمن',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpUser: 'yemenstore@gmail.com',
    smtpPass: ''
  });
  const [isSavingOtpConfig, setIsSavingOtpConfig] = useState(false);
  const [testOtpEmail, setTestOtpEmail] = useState('');
  const [isSendingTestOtp, setIsSendingTestOtp] = useState(false);
  
  // Multi-store editing states (Admin can edit any store)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('editStoreId');
  });
  const [allStoreProfiles, setAllStoreProfiles] = useState<any[]>([]);
  const [storesSearchTerm, setStoresSearchTerm] = useState('');

  // Target store ID for profile & wallet editing (admin can edit other stores or own store)
  const currentTargetStoreId = (isAdmin && selectedStoreId) ? selectedStoreId : (user?.uid || '');

  // Track tabs that the admin has viewed so notification numbers disappear when opened
  const [viewedTabs, setViewedTabs] = useState<Record<string, boolean>>(() => {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab') || 'overview';
    return { [initialTab]: true };
  });

  const handleTabClick = (tab: any) => {
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

  // Form States
  const [productForm, setProductForm] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: string, title: string, email?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Settings Local States (Admin Only)
  const [localSettings, setLocalSettings] = useState<any>({});
  const [showQrModal, setShowQrModal] = useState(false);
  const [storePublicUrl, setStorePublicUrl] = useState('');
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    if (settings?.storePublicUrl) {
      setStorePublicUrl(settings.storePublicUrl);
    }
  }, [settings?.storePublicUrl]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    if (!isAdmin && !isStore) { navigate('/'); return; }
    
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['overview', 'products', 'orders', 'users', 'stores', 'settings', 'categories', 'store-profile', 'wallets', 'server'].includes(tabParam)) {
      setActiveTab(tabParam as any);
      setViewedTabs(prev => ({ ...prev, [tabParam]: true }));
    }
    const editStoreParam = params.get('editStoreId');
    if (editStoreParam) {
      setSelectedStoreId(editStoreParam);
    }
  }, [isAdmin, isStore, loading, user, navigate]);

  // Fetch OTP settings
  useEffect(() => {

    fetch('/api/auth/otp-settings')
      .then(r => r.json())
      .then(d => {
        if (d.senderEmail) {
          setOtpSenderConfig(prev => ({
            ...prev,
            senderEmail: d.senderEmail,
            senderName: d.senderName || 'اليمن',
            smtpHost: d.smtpHost || 'smtp.gmail.com',
            smtpPort: d.smtpPort || 465,
            smtpUser: d.smtpUser || 'yemenstore@gmail.com'
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Dedicated Store Profile Listener for current target store (dynamic for admins)
  useEffect(() => {
    if (!currentTargetStoreId) return;
    
    const unsubProfile = onSnapshot(doc(db, 'storeProfiles', currentTargetStoreId), async (snap) => {
      if (snap.exists()) {
        const profileData = snap.data() as StoreProfile;
        // Auto-heal ancient or invalid mock dates (like 2001 or dates prior to 2026)
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
        // Fallback: look up user details
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
      console.warn('Store profile listener notice (handled):', err.message);
    });

    return () => unsubProfile();
  }, [currentTargetStoreId]);

  useEffect(() => {
    if (!user || loading) return;
    
    const unsubscribers: (() => void)[] = [];

    // Real-time fetching based on active tab
    const fetchData = () => {
      // Products
      let pQuery: any = collection(db, 'products');
      if (isStore && !isAdmin) pQuery = query(pQuery, where('ownerId', '==', user.uid));
      const unsubProducts = onSnapshot(pQuery, (snap) => {
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn('Products listener notice (handled):', err.message);
      });
      unsubscribers.push(unsubProducts);

      // Orders
      let oQuery: any = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      if (isStore && !isAdmin) oQuery = query(collection(db, 'orders'), where('storeId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubOrders = onSnapshot(oQuery, (snap) => {
        setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn('Orders listener notice (handled):', err.message);
      });
      unsubscribers.push(unsubOrders);

      if (isAdmin) {
        // Users
        const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(100)), (snap) => {
          setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
          console.warn('Users listener notice (handled):', err.message);
        });
        unsubscribers.push(unsubUsers);

        // All Store Profiles
        const unsubStoreProfiles = onSnapshot(collection(db, 'storeProfiles'), (snap) => {
          setAllStoreProfiles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
          console.warn('StoreProfiles listener notice (handled):', err.message);
        });
        unsubscribers.push(unsubStoreProfiles);

        // Categories
        const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
          setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
          console.warn('Categories listener notice (handled):', err.message);
        });
        unsubscribers.push(unsubCats);

        // Deployments
        const unsubDeploy = onSnapshot(query(collection(db, 'deployments'), orderBy('createdAt', 'desc'), limit(10)), (snap) => {
          setDeployments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
          console.warn('Deployments listener notice (handled):', err.message);
        });
        unsubscribers.push(unsubDeploy);

        // Server Logs
        const unsubLogs = onSnapshot(query(collection(db, 'serverLogs'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
          setServerLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
          console.warn('ServerLogs listener notice (handled):', err.message);
        });
        unsubscribers.push(unsubLogs);

        // Global Settings
        const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            // Auto-fill the official domain if it's missing (as requested by user "you do it")
            if (!data.storePublicUrl) {
              data.storePublicUrl = 'https://www.yemenstoreonline.com';
            }
            setLocalSettings(data);
          }
        }, (err) => {
          console.warn('Global settings listener notice (handled):', err.message);
        });
        unsubscribers.push(unsubSettings);
      }
    };

    fetchData();
    return () => unsubscribers.forEach(unsub => unsub());
  }, [user, isAdmin, isStore, loading]);

  // Handlers
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm) return;
    setIsSaving(true);
    try {
      const data: any = { 
        ...productForm, 
        image: productForm.images?.[0] || '', // Sync main image field
        price: Number(productForm.price),
        stock: productForm.stock === '' || productForm.stock === undefined || productForm.stock === null ? null : Number(productForm.stock),
        isPreOrderEnabled: productForm.isPreOrderEnabled ?? true,
        reservationDurationDays: Number(productForm.reservationDurationDays) || 3,
        ownerId: productForm.ownerId || user?.uid,
        updatedAt: new Date().toISOString()
      };

      if (productForm.depositAmount !== '' && productForm.depositAmount !== null && productForm.depositAmount !== undefined) {
        data.depositAmount = Number(productForm.depositAmount);
      } else {
        delete data.depositAmount;
      }

      // Size check (Firestore limit is 1MB)
      const estimatedSize = JSON.stringify(data).length;
      if (estimatedSize > 900000) {
        toast.error("حجم بيانات المنتج كبير جداً. يرجى تقليل عدد الصور أو اختيار صور أصغر.", { duration: 5000 });
        setIsSaving(false);
        return;
      }

      if (productForm.id) {
        await updateDoc(doc(db, 'products', productForm.id), data);
        toast.success("تم تحديث المنتج");
      } else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'products'), data);
        toast.success("تم إضافة المنتج");
      }
      setProductForm(null);
    } catch (err) {
      toast.error("فشل الحفظ");
      console.error(err);
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
          ? "تم تحديث الملف التجاري بنجاح" 
          : `تم تحديث ملف المتجر (${storeProfile.name || 'المحدد'}) بنجاح`
      );
    } catch (err) {
      toast.error("فشل التحديث");
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
      toast.error("فشل في تحديث حالة التوثيق");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'users') {
        const targetId = deleteConfirm.id;
        const targetEmail = (deleteConfirm.email || '').trim().toLowerCase();

        // Strictly protect the master admin account
        if (targetId === 'MQAwCYqFztd2PZbV1fRMxKRqoYX2') {
          toast.error("لا يمكن حذف حساب المدير العام الرئيسي للمتجر");
          setDeleteConfirm(null);
          return;
        }

        // 1. Direct Firestore user doc deletion
        try {
          await deleteDoc(doc(db, 'users', targetId));
        } catch (e: any) {
          console.warn("Direct firestore delete notice:", e?.message);
        }

        // 2. Also delete from backend accounts & storeAccounts collection
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
          console.warn("Backend accounts delete notice:", e?.message);
        }

        // 3. If target had a storeProfile, clean it up
        try {
          await deleteDoc(doc(db, 'storeProfiles', targetId));
        } catch {}

        // Instant UI update
        setUsers(prev => prev.filter(u => u.id !== targetId));
        toast.success("تم حذف الحساب نهائياً بنجاح");
        setDeleteConfirm(null);
        return;
      }

      await deleteDoc(doc(db, deleteConfirm.type, deleteConfirm.id));
      toast.success("تم الحذف بنجاح");
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error("فشل الحذف: " + (err?.message || "يرجى المحاولة لاحقاً"));
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
      toast.success("تم تحديث حالة الطلب");
    } catch (err) {
      toast.error("فشل التحديث");
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    const targetUser = users.find(u => u.id === userId);
    const roleLabels: Record<string, string> = {
      admin: 'مدير نظام',
      store: 'متجر رسمي',
      user: 'عضو عادي'
    };
    const roleName = roleLabels[role] || role;

    // Prevent changing master admin role away from admin
    if (userId === 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' && role !== 'admin') {
      toast.error("لا يمكن تغيير رتبة المدير العام الرئيسي للمتجر");
      return;
    }

    try {
      // 1. Optimistic UI update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));

      // 2. Update backend storeAccounts & users via server
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
        console.warn("Backend role update notice:", backendErr);
      }

      // 3. Update Firestore users collection directly from client
      try {
        await setDoc(doc(db, 'users', userId), { role }, { merge: true });
      } catch (fsErr) {
        console.warn("Client direct firestore role update notice:", fsErr);
      }

      // 4. If promoted to store, ensure storeProfile exists
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
              description: 'متجر رسمي معتمد في منصة يمن ستور',
              logoUrl: targetUser?.photoURL || '',
              verified: true,
              verifiedUntil: oneYearLater.toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        } catch (profileErr) {
          console.warn("Store profile creation note:", profileErr);
        }
      }

      toast.success(`تم تحديث رتبة (${targetUser?.name || 'المستخدم'}) إلى [${roleName}] بنجاح`);
    } catch (err: any) {
      console.error('Role update error:', err);
      toast.error("فشل تحديث الرتبة: " + (err?.message || "يرجى المحاولة لاحقاً"));
    }
  };

  const handleManualCleanup = async () => {
    setIsCleaningUp(true);
    const toastId = toast.loading('جاري تنفيذ عملية تنظيف السيرفر...');
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/admin/cleanup-products', {
        headers: {
          ...authHeaders
        }
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

  const handleSaveOtpSettings = async () => {
    setIsSavingOtpConfig(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/auth/save-smtp-settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          otpSenderEmail: otpSenderConfig.senderEmail,
          otpSenderName: otpSenderConfig.senderName,
          smtpHost: otpSenderConfig.smtpHost,
          smtpPort: otpSenderConfig.smtpPort,
          smtpUser: otpSenderConfig.smtpUser,
          smtpPass: otpSenderConfig.smtpPass
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم حفظ إعدادات بريد الإرسال التلقائي بنجاح!');
      } else {
        toast.error(data.message || 'فشل حفظ الإعدادات');
      }
    } catch (err: any) {
      toast.error('خطأ: ' + err.message);
    } finally {
      setIsSavingOtpConfig(false);
    }
  };

  const handleTestOtpSend = async () => {
    if (!testOtpEmail || !testOtpEmail.includes('@')) {
      toast.error('يرجى إدخال بريد إلكتروني تجريبي صحيح');
      return;
    }
    setIsSendingTestOtp(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testOtpEmail.trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`تم إنشاء وإرسال كود التحقق بنجاح إلى البريد المدخل!`);
      } else {
        toast.error(data.message || 'فشل إرسال كود التحقق التجريبي');
      }
    } catch (err: any) {
      toast.error('خطأ في الإرسال: ' + err.message);
    } finally {
      setIsSendingTestOtp(false);
    }
  };
  const handleInstallPWA = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      toast("على أجهزة iOS: اضغط على زر 'مشاركة' ثم 'إضافة إلى الصفحة الرئيسية'", {
        icon: '📱',
        duration: 5000
      });
    } else {
      toast("سيظهر خيار تثبيت التطبيق في متصفحك تلقائياً", {
        icon: '📲'
      });
    }
  };

  // UI Helpers
  const statusColors: any = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    processing: 'bg-blue-100 text-blue-700 border-blue-200',
    shipped: 'bg-purple-100 text-purple-700 border-purple-200',
    delivered: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200'
  };

  const statusArabic: any = {
    pending: 'قيد الانتظار',
    processing: 'جاري التجهيز',
    shipped: 'تم الشحن',
    delivered: 'تم التسليم',
    cancelled: 'ملغي'
  };

  // Computed list of all registered stores in the platform
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

  return (
    <div className={`flex flex-col lg:flex-row gap-8 min-h-screen -m-4 p-4 lg:p-8 transition-colors duration-300 ${isDarkMode ? 'bg-gray-950' : 'bg-gray-50/50'}`}>
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
        <div className={`p-8 rounded-[2.5rem] shadow-sm border relative overflow-hidden group transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 border-gray-800 shadow-black/20' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-4 relative z-10">
            <div className={`w-14 h-14 ${settings?.storeLogo && settings.storeLogo !== "" ? 'bg-white' : 'bg-green-500'} rounded-2xl flex items-center justify-center text-white shadow-lg ${settings?.storeLogo && settings.storeLogo !== "" ? 'shadow-black/5' : 'shadow-green-500/20'} group-hover:rotate-6 transition overflow-hidden border ${isDarkMode ? 'border-gray-800' : 'border-gray-50'}`}>
              {settings?.storeLogo && settings.storeLogo !== "" ? (
                <img src={settings.storeLogo} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Shield className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className={`font-black text-xl leading-none ${isDarkMode ? 'text-white' : 'text-black'}`}>لوحة التحكم</h2>
              <p className={`text-[10px] font-black uppercase mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-900'}`}>{settings?.storeName || 'إدارة النظام'}</p>
            </div>
          </div>
          
          <nav className="space-y-1 mt-6">
            <NavItem active={activeTab === 'overview'} onClick={() => handleTabClick('overview')} icon={<BarChart3 className="w-5 h-5"/>} label="الإحصائيات" />
            <NavItem active={activeTab === 'store-profile'} onClick={() => handleTabClick('store-profile')} icon={<Store className="w-5 h-5"/>} label="الملف التجاري" />
            <NavItem active={activeTab === 'wallets'} onClick={() => handleTabClick('wallets')} icon={<Wallet className="w-5 h-5 text-emerald-500"/>} label="إدارة المحافظ الإلكترونية" />
            <NavItem active={activeTab === 'products'} onClick={() => handleTabClick('products')} icon={<Package className="w-5 h-5"/>} label="إدارة المنتجات" />
            <NavItem active={activeTab === 'orders'} onClick={() => handleTabClick('orders')} icon={<ShoppingCart className="w-5 h-5"/>} label="طلبات الشراء" count={viewedTabs['orders'] ? undefined : orders.filter(o => o.status === 'pending').length} />
            
            {isAdmin && (
              <div className="pt-6 mt-6 border-t border-gray-100 space-y-1">
                <p className="text-[10px] font-black text-gray-900 px-4 mb-2 uppercase tracking-widest">إدارة النظام</p>
                <NavItem active={activeTab === 'store-accounts'} onClick={() => handleTabClick('store-accounts')} icon={<KeyRound className="w-5 h-5 text-amber-500"/>} label="الحسابات وكلمات المرور" />
                <NavItem active={activeTab === 'stores'} onClick={() => handleTabClick('stores')} icon={<Store className="w-5 h-5 text-blue-500"/>} label="إدارة المتاجر والتوثيق" count={viewedTabs['stores'] ? undefined : allStoresList.length} />
                <NavItem active={activeTab === 'users'} onClick={() => handleTabClick('users')} icon={<Users className="w-5 h-5"/>} label="المستخدمين" count={viewedTabs['users'] ? undefined : users.length} />
                <NavItem active={activeTab === 'categories'} onClick={() => handleTabClick('categories')} icon={<ListFilter className="w-5 h-5"/>} label="تصنيفات النظام" />
                <NavItem active={activeTab === 'settings'} onClick={() => handleTabClick('settings')} icon={<SettingsIcon className="w-5 h-5"/>} label="إعدادات المنصة" />
                <NavItem active={activeTab === 'server'} onClick={() => handleTabClick('server')} icon={<Server className="w-5 h-5"/>} label="إدارة السيرفر" />
              </div>
            )}

            <div className={`pt-6 mt-6 border-t font-black uppercase tracking-widest ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
              <p className={`text-[10px] px-4 mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-900'}`}>تخصيص الواجهة</p>
              <div className="px-4 mb-4">
                <button 
                  onClick={(e) => {
                     e.preventDefault();
                     toggleDarkMode();
                  }}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-sm transition shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-yellow-500 hover:bg-gray-700' : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${isDarkMode ? 'bg-gray-700 text-yellow-500' : 'bg-white text-gray-400'}`}>
                     {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </div>
                  <span>{isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                </button>
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`rounded-[2.5rem] p-6 lg:p-10 shadow-sm border min-h-[70vh] transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 border-gray-800 shadow-black/20 text-white' : 'bg-white border-gray-100 text-gray-900'}`}
          >
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-black text-gray-900 mb-1">نظرة عامة</h1>
                    <p className="text-gray-900 font-black">أداء المتجر ونشاط المستخدمين في الوقت الفعلي</p>
                  </div>
                  <div className="flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                    <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100 text-xs font-bold text-green-600 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      {globalStats.onlineCount} متصل الآن
                    </div>
                  </div>
                </div>

                {(() => {
                  const totalRevenue = orders
                    .filter(o => o.status !== 'cancelled')
                    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

                  const todayOrders = orders.filter(o => {
                    try {
                      const date = new Date(o.createdAt);
                      const today = new Date();
                      return date.toDateString() === today.toDateString();
                    } catch {
                      return false;
                    }
                  });

                  // Calculate actual product sales counts from real orders
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard label="إجمالي الزيارات" value={globalStats.totalVisitors} icon={<Eye className="w-6 h-6 text-blue-500"/>} trend={`${globalStats.onlineCount} متصل الآن`} />
                        <StatCard label="المستخدمين المسجلين" value={globalStats.totalRegistered || users.length} icon={<Users className="w-6 h-6 text-green-500"/>} trend={`${users.filter(u => u.role === 'store').length} متجر`} />
                        <StatCard label="طلبات اليوم" value={`${todayOrders.length} طلب`} icon={<ShoppingCart className="w-6 h-6 text-orange-500"/>} trend={todayOrders.length > 0 ? "نشط" : undefined} />
                        <StatCard label="إجمالي المبيعات" value={`${totalRevenue.toLocaleString()} ريال`} icon={<DollarSign className="w-6 h-6 text-emerald-500"/>} trend={`${orders.length} طلب مسجل`} />
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-black">
                            <Clock className="w-5 h-5 text-gray-900" />
                            أحدث الطلبات الفعلية
                          </h3>
                          <div className="space-y-4">
                            {orders.length === 0 ? (
                              <p className="text-xs text-gray-400 font-bold py-6 text-center">لا توجد طلبات مسجلة بعد</p>
                            ) : (
                              orders.slice(0, 5).map(order => (
                                <div key={order.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-gray-100 hover:shadow-md transition cursor-pointer">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center font-mono text-[10px] font-bold">
                                      #{order.id.slice(-4)}
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm">{order.customerName}</p>
                                      <p className="text-[10px] text-gray-900 font-black">{new Date(order.createdAt).toLocaleDateString('ar-YE')}</p>
                                    </div>
                                  </div>
                                  <div className="text-left">
                                    <p className="font-black text-sm">{order.total} ريال</p>
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${statusColors[order.status]}`}>
                                      {statusArabic[order.status]}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-black">
                             <TrendingUp className="w-5 h-5 text-gray-900" />
                             المنتجات الأكثر مبيعاً (إحصاءات فعلية)
                          </h3>
                          <div className="space-y-4">
                            {bestSellers.length === 0 ? (
                              <p className="text-xs text-gray-400 font-bold py-6 text-center">لا توجد منتجات مسجلة بعد</p>
                            ) : (
                              bestSellers.slice(0, 5).map((product, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
                                   <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                                     {product.images?.[0] && <img src={product.images[0]} className="w-full h-full object-cover" />}
                                   </div>
                                   <div className="flex-1">
                                     <p className="font-bold text-sm mb-1 text-black">{product.title}</p>
                                     <div className="flex justify-between items-center">
                                       <span className="text-xs font-black text-green-700">{product.price} ريال</span>
                                       <span className="text-[10px] text-blue-600 font-black">
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
              <div className="max-w-4xl space-y-10">
                {isAdmin && (
                  <div className={`p-6 rounded-[2rem] border transition-all duration-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 shrink-0">
                        <Store className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-600 text-white">
                            وضع إدارة المتاجر
                          </span>
                          {currentTargetStoreId !== user?.uid && (
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              تعديل متجر تاجر آخر
                            </span>
                          )}
                        </div>
                        <h3 className={`text-base sm:text-lg font-black mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {currentTargetStoreId === user?.uid 
                            ? 'أنت تعدل: متجرك الشخصي / حساب المنصة الرئيسي' 
                            : `أنت تعدل متجر: ${storeProfile?.name || ('متجر رقم ' + currentTargetStoreId.slice(0, 8))}`}
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
                        className={`text-xs font-black px-4 py-3 rounded-2xl border shadow-sm cursor-pointer ${
                          isDarkMode 
                            ? 'bg-gray-800 text-white border-gray-700 focus:ring-blue-500' 
                            : 'bg-white text-gray-900 border-blue-300 focus:ring-blue-500'
                        }`}
                      >
                        <option value={user?.uid}>🏠 متجري الشخصي (حساب الإدارة)</option>
                        {allStoresList.map(s => (
                          <option key={s.id} value={s.id}>
                            🏪 {s.name} {s.verified ? '✓ (موثق)' : ''}
                          </option>
                        ))}
                      </select>

                      {selectedStoreId && selectedStoreId !== user?.uid && (
                        <button
                          type="button"
                          onClick={() => handleSelectStore(null)}
                          className={`px-4 py-3 rounded-2xl font-black text-xs transition border shadow-sm ${
                            isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          العودة لمتجري
                        </button>
                      )}

                      {currentTargetStoreId && (
                        <Link
                          to={`/store/${currentTargetStoreId}`}
                          target="_blank"
                          className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs transition shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          معاينة المتجر
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-black mb-1 text-black">الملف التجاري</h2>
                    <p className="text-gray-900 font-black">
                      {currentTargetStoreId === user?.uid 
                        ? 'معلومات متجرك والهوية المرئية وروابط التواصل' 
                        : `معلومات وبيانات المتجر (${storeProfile?.name || 'المحدد'})`}
                    </p>
                  </div>
                  <button 
                    onClick={handleUpdateStoreProfile}
                    className="bg-black text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition"
                  >
                    حفظ التغييرات
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                  <div className="md:col-span-4 flex flex-col items-center gap-6">
                    <div className="w-full">
                      <ImageEditor 
                        label="شعار المتجر" 
                        value={storeProfile.logoUrl} 
                        onChange={(v: string) => setStoreProfile({...storeProfile, logoUrl: v})} 
                      />
                    </div>
                    {/* High-end Verification Card */}
                    {(() => {
                      const isVerified = Boolean(storeProfile.verified);
                      const hasExpiry = Boolean(storeProfile.verifiedUntil && storeProfile.verifiedUntil !== '');
                      const expDate = hasExpiry ? new Date(storeProfile.verifiedUntil!) : null;
                      const isExpired = hasExpiry && expDate ? expDate.getTime() < Date.now() : false;
                      const diffDays = hasExpiry && expDate ? Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                      const formattedDate = hasExpiry && storeProfile.verifiedUntil ? formatArabicVerificationDate(storeProfile.verifiedUntil) : '';

                      return (
                        <div className={`w-full p-6 rounded-[2rem] border transition-all duration-300 space-y-4 ${
                          isVerified && !isExpired
                            ? 'bg-gradient-to-br from-blue-50/80 via-emerald-50/50 to-white dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-800/60 shadow-lg shadow-emerald-500/5'
                            : isExpired
                              ? 'bg-gradient-to-br from-amber-50 to-rose-50 dark:from-slate-900 dark:to-amber-950/30 border-amber-200 dark:border-amber-800 shadow-md'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                isVerified && !isExpired
                                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                  : isExpired
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                              }`}>
                                <ShieldCheck className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-black text-sm text-slate-900 dark:text-white">حالة التوثيق والاعتماد</h4>
                                <span className="text-[10px] text-slate-400 font-bold">العلامة الزرقاء المعتمدة</span>
                              </div>
                            </div>

                            <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                              isVerified && !isExpired
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : isExpired
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                isVerified && !isExpired ? 'bg-emerald-500 animate-pulse' : isExpired ? 'bg-amber-500' : 'bg-slate-400'
                              }`}></span>
                              {isVerified && !isExpired ? 'موثق ومعتمد رسمياً' : isExpired ? 'التوثيق منتهي الصلاحية' : 'غير موثق'}
                            </span>
                          </div>

                          {/* Verification Date Details */}
                          <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5">
                            {isVerified && !isExpired ? (
                              hasExpiry ? (
                                <>
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="text-slate-500 dark:text-slate-400">تاريخ انتهاء الصلاحية:</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400">{formattedDate}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span>الفترة المتبقية:</span>
                                    <span className="font-black text-slate-700 dark:text-slate-300">متبقي {diffDays} يوماً</span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-emerald-700 dark:text-emerald-400 font-black flex items-center gap-1.5">
                                  <Check className="w-4 h-4" />
                                  <span>توثيق دائم مدى الحياة (معتمد رسمياً بدون تاريخ انتهاء)</span>
                                </div>
                              )
                            ) : isExpired ? (
                              <div className="text-amber-800 dark:text-amber-300 font-bold space-y-1">
                                <p>⚠️ انتهت فترة التوثيق السابقة في: <span className="font-black underline">{formattedDate}</span></p>
                                <p className="text-[11px] opacity-80">يرجى تجديد التوثيق لاستمرار ظهور الشارة المعتمدة للزبائن.</p>
                              </div>
                            ) : (
                              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                                المتجر حالياً بدون علامة التوثيق. قم بتفعيل التوثيق لزيادة الموثوقية والمبيعات.
                              </p>
                            )}
                          </div>

                          {/* Renewal & Action Buttons */}
                          <div className="space-y-2 pt-1">
                            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">
                              خيارات تجديد وتفعيل التوثيق:
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleSetVerification(12)}
                                className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                تجديد لسنة (حتى 2027)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetVerification(24)}
                                className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                تجديد لسنتين (حتى 2028)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetVerification('lifetime')}
                                className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black text-xs transition shadow-sm active:scale-95 col-span-2 flex items-center justify-center gap-1.5"
                              >
                                <Shield className="w-3.5 h-3.5" />
                                تفعيل توثيق دائم (مدى الحياة)
                              </button>
                              {isVerified && (
                                <button
                                  type="button"
                                  onClick={() => handleSetVerification(0)}
                                  className="text-[11px] font-bold text-rose-500 hover:underline col-span-2 py-1 text-center"
                                >
                                  إيقاف التوثيق مؤقتاً
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="md:col-span-8 space-y-8">
                    <ImageEditor 
                      label="بانر المتجر" 
                      value={storeProfile.bannerUrl} 
                      onChange={(v: string) => setStoreProfile({...storeProfile, bannerUrl: v})} 
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <AdminInput label="اسم المتجر" value={storeProfile.name} onChange={v => setStoreProfile({...storeProfile, name: v})} placeholder="مثال: يمن ستور العالمي" />
                       <AdminInput label="عنوان المتجر" value={storeProfile.address || ''} onChange={v => setStoreProfile({...storeProfile, address: v})} placeholder="صنعاء - شارع حدة" />
                    </div>
                    <AdminTextarea label="وصف المتجر" value={storeProfile.description} onChange={v => setStoreProfile({...storeProfile, description: v})} placeholder="اكتب نبذة عن متجرك ومنتجاتك..." />
                    
                    <div className="pt-6 border-t border-gray-100">
                       <h3 className="text-lg font-black mb-6">روابط التواصل الاجتماعي</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <AdminInput label="واتساب" value={storeProfile.whatsapp || ''} onChange={v => setStoreProfile({...storeProfile, whatsapp: v})} icon={<Phone className="w-4 h-4"/>} placeholder="96777xxxxxxx" />
                          <AdminInput label="تليجرام" value={storeProfile.telegram || ''} onChange={v => setStoreProfile({...storeProfile, telegram: v})} icon={<Send className="w-4 h-4"/>} placeholder="t.me/username" />
                          <AdminInput label="انستجرام" value={storeProfile.instagram || ''} onChange={v => setStoreProfile({...storeProfile, instagram: v})} icon={<Instagram className="w-4 h-4"/>} placeholder="username" />
                          <AdminInput label="تيك توك" value={storeProfile.tiktok || ''} onChange={v => setStoreProfile({...storeProfile, tiktok: v})} icon={<Globe className="w-4 h-4"/>} placeholder="username" />
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
                  <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-500/20 shrink-0">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                          إدارة حسابات الدفع والتحويل
                        </span>
                        <p className={`text-sm font-black mt-0.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {currentTargetStoreId === user?.uid 
                            ? 'أنت تدير محافظ: متجرك الشخصي / حساب المنصة' 
                            : `أنت تدير محافظ متجر: ${storeProfile?.name || ('متجر رقم ' + currentTargetStoreId.slice(0, 8))}`}
                        </p>
                      </div>
                    </div>
                    {currentTargetStoreId !== user?.uid && (
                      <button
                        type="button"
                        onClick={() => handleSelectStore(null)}
                        className={`px-4 py-2 rounded-xl font-black text-xs transition border shadow-sm ${
                          isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200'
                        }`}
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
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-black mb-1 text-black">إدارة المنتجات</h2>
                    <p className="text-gray-900 font-black">عرض، تعديل، وإضافة منتجات جديدة للمتجر</p>
                  </div>
                  <button 
                    onClick={() => setProductForm({ title: '', price: '', description: '', stock: 0, category: 'عام', images: [], status: 'active' })} 
                    className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-green-600/20 hover:bg-green-700 transition flex items-center gap-2"
                  >
                    <Plus className="w-6 h-6" />
                    إضافة منتج جديد
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-900 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="ابحث باسم المنتج أو السعر..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border-0 rounded-2xl py-4 pr-12 pl-6 font-black text-sm text-black placeholder:text-gray-500 focus:ring-2 focus:ring-green-500 transition shadow-sm border border-gray-100"
                  />
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full text-right border-separate border-spacing-y-4">
                     <thead>
                       <tr className="text-gray-900 text-xs font-black uppercase tracking-widest px-4 border-b border-gray-100">
                         <th className="p-4 font-black">المنتج</th>
                         <th className="p-4 font-black">التصنيف</th>
                         <th className="p-4 font-black text-center">السعر</th>
                         <th className="p-4 font-black text-center">المخزون</th>
                         <th className="p-4 font-black text-center">الحالة</th>
                         <th className="p-4 font-black text-left">الإجراءات</th>
                       </tr>
                     </thead>
                     <tbody>
                       {products.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).map(product => (
                         <tr key={product.id} className="group bg-gray-50/50 hover:bg-white transition hover:shadow-lg rounded-2xl">
                           <td className="p-4 first:rounded-r-2xl border-y border-r border-transparent group-hover:border-gray-100 transition whitespace-nowrap">
                             <div className="flex items-center gap-4">
                               <div className="w-14 h-14 bg-white rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                                 {product.images?.[0] && <img src={product.images[0]} className="w-full h-full object-cover" />}
                               </div>
                               <div>
                                 <p className="font-black text-sm text-black">{product.title}</p>
                                 <p className="text-[10px] text-gray-900 font-black">تم الإضافة: {new Date(product.createdAt || '').toLocaleDateString('ar-YE')}</p>
                               </div>
                             </div>
                           </td>
                           <td className="p-4 border-y border-transparent group-hover:border-gray-100 transition text-sm font-black text-gray-900 whitespace-nowrap">
                              {product.category}
                           </td>
                           <td className="p-4 border-y border-transparent group-hover:border-gray-100 transition text-center whitespace-nowrap">
                              <span className="font-black text-green-700">{product.price} ريال</span>
                           </td>
                           <td className="p-4 border-y border-transparent group-hover:border-gray-100 transition text-center whitespace-nowrap">
                              <span className={`font-black ${Number(product.stock || 0) <= 5 ? 'text-red-500' : 'text-gray-900'}`}>
                                {product.stock || 0} وحدة
                              </span>
                           </td>
                           <td className="p-4 border-y border-transparent group-hover:border-gray-100 transition text-center whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-900'}`}>
                                {product.status === 'active' ? 'نشط' : 'مسودة'}
                              </span>
                           </td>
                           <td className="p-4 last:rounded-l-2xl border-y border-l border-transparent group-hover:border-gray-100 transition text-left whitespace-nowrap">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setProductForm(product)} className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-blue-500 hover:bg-blue-50 transition border border-gray-100">
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button onClick={() => setDeleteConfirm({ id: product.id, type: 'products', title: product.title })} className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 transition border border-gray-100">
                                  <Trash2 className="w-5 h-5" />
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

            {/* TAB: ORDERS */}
            {activeTab === 'orders' && (
              <div className="space-y-8">
                <div>
                   <h2 className="text-3xl font-black mb-1 text-black">طلبات الشراء</h2>
                   <p className="text-gray-900 font-black">متابعة طلبات العملاء وتحديث حالات التسليم</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-separate border-spacing-y-4">
                    <thead>
                      <tr className="text-gray-900 text-[10px] font-black uppercase tracking-widest px-4 border-b border-gray-100">
                        <th className="p-4">رقم الطلب</th>
                        <th className="p-4 text-center">العميل</th>
                        <th className="p-4 text-center">تاريخ الطلب</th>
                        <th className="p-4 text-center text-left">الإجمالي</th>
                        <th className="p-4 text-center">الحالة</th>
                        <th className="p-4 text-left">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id} className="bg-gray-50/50 hover:bg-white transition hover:shadow-lg rounded-2xl group">
                          <td className="p-4 rounded-r-2xl border-y border-r border-transparent group-hover:border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-xs font-black text-gray-900">#{order.id.slice(-6).toUpperCase()}</span>
                          </td>
                          <td className="p-4 border-y border-transparent group-hover:border-gray-100 whitespace-nowrap text-center">
                            <p className="font-black text-sm text-black">{order.customerName}</p>
                            <p className="text-[10px] text-blue-700 font-black">{order.customerPhone}</p>
                          </td>
                          <td className="p-4 border-y border-transparent group-hover:border-gray-100 whitespace-nowrap text-center">
                             <p className="text-xs font-black text-black">{new Date(order.createdAt).toLocaleDateString('ar-YE')}</p>
                             <p className="text-[9px] text-gray-900 font-black">{new Date(order.createdAt).toLocaleTimeString('ar-YE')}</p>
                          </td>
                          <td className="p-4 border-y border-transparent group-hover:border-gray-100 whitespace-nowrap text-center">
                             <span className="font-black text-green-700">{order.total} ريال</span>
                          </td>
                          <td className="p-4 border-y border-transparent group-hover:border-gray-100 whitespace-nowrap text-center">
                             <select 
                               value={order.status} 
                               onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                               className={`border-0 rounded-lg p-2 text-[10px] font-black cursor-pointer focus:ring-0 ${statusColors[order.status]}`}
                             >
                               <option value="pending">قيد الانتظار</option>
                               <option value="processing">جاري التجهيز</option>
                               <option value="shipped">تم الشحن</option>
                               <option value="delivered">تم التسليم</option>
                               <option value="cancelled">ملغي</option>
                             </select>
                          </td>
                          <td className="p-4 rounded-l-2xl border-y border-l border-transparent group-hover:border-gray-100 text-left whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => setViewingOrder(order)} 
                                  className="w-9 h-9 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center transition active:scale-95 shadow-sm"
                                  title="عرض تفاصيل الطلب والدفع"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteConfirm({ id: order.id, type: 'orders', title: 'هذا الطلب' })} className="text-red-400 hover:text-red-600 transition p-2">
                                  <Trash2 className="w-5 h-5" />
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

            {/* ADMIN ONLY: STORES TAB */}
            {isAdmin && activeTab === 'stores' && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>
                      إدارة المتاجر والتوثيق الرسمي
                    </h2>
                    <p className={`text-sm font-black mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      عرض جميع المتاجر المسجلة في المنصة، التحكم في هوياتها، تجديد وتفعيل التوثيق وإدارة محافظها
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black">
                      إجمالي المتاجر: {allStoresList.length}
                    </span>
                    <span className="px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-black">
                      المتاجر الموثقة: {allStoresList.filter(s => s.verified).length}
                    </span>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={storesSearchTerm}
                    onChange={(e) => setStoresSearchTerm(e.target.value)}
                    placeholder="ابحث عن متجر بالاسم أو البريد الإلكتروني أو الهاتف..."
                    className={`w-full pr-12 pl-4 py-3.5 rounded-2xl border text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>

                {/* Stores Grid */}
                {filteredStores.length === 0 ? (
                  <div className={`p-12 text-center rounded-[2.5rem] border ${isDarkMode ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-white border-gray-100 text-gray-500'}`}>
                    <Store className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-black text-base">لا توجد متاجر مطابقة لبحثك</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredStores.map((s) => {
                      const isCurrentUser = s.id === user?.uid;
                      const hasExpiry = Boolean(s.verifiedUntil);
                      const expDate = hasExpiry ? new Date(s.verifiedUntil) : null;
                      const isExpired = hasExpiry && expDate ? expDate.getTime() < Date.now() : false;

                      return (
                        <div 
                          key={s.id}
                          className={`p-6 rounded-[2.5rem] border transition-all duration-300 shadow-sm flex flex-col justify-between gap-6 relative group ${
                            isDarkMode ? 'bg-gray-900 border-gray-800 hover:border-gray-700' : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-md'
                          }`}
                        >
                          <div>
                            {/* Store Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                                  {s.logoUrl ? (
                                    <img src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Store className="w-7 h-7 text-gray-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className={`font-black text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {s.name}
                                    </h4>
                                    {isCurrentUser && (
                                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                        حسابك
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">
                                    {s.email}
                                  </p>
                                  {s.phone && s.phone !== '—' && (
                                    <p className="text-[11px] text-gray-400 font-medium">
                                      📞 {s.phone}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Verification Pill */}
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 flex items-center gap-1 ${
                                s.verified && !isExpired
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : isExpired
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                <ShieldCheck className="w-3 h-3" />
                                {s.verified && !isExpired ? 'موثق' : isExpired ? 'منتهي' : 'غير موثق'}
                              </span>
                            </div>

                            {/* Store Meta / Stats */}
                            <div className="grid grid-cols-3 gap-2 mt-5 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 text-center text-xs">
                              <div>
                                <span className="text-[10px] text-gray-400 font-bold block">المنتجات</span>
                                <span className={`font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {s.productCount}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 font-bold block">التقييم</span>
                                <span className="font-black text-amber-500">
                                  {s.averageRating ? `${s.averageRating.toFixed(1)}/10` : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 font-bold block">المصداقية</span>
                                <span className="font-black text-emerald-500">
                                  {s.averageCredibility ? `${s.averageCredibility.toFixed(1)}/10` : '—'}
                                </span>
                              </div>
                            </div>

                            {s.verified && s.verifiedUntil && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-black mt-2 text-right">
                                ينتهي التوثيق: {formatArabicVerificationDate(s.verifiedUntil)}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectStore(s.id);
                                setActiveTab('store-profile');
                                toast.success(`أنت الآن تعدل متجر: ${s.name}`);
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
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
                                className={`py-2 px-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-1 ${
                                  isDarkMode 
                                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200' 
                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                }`}
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                <span>المحافظ</span>
                              </button>

                              <Link
                                to={`/store/${s.id}`}
                                target="_blank"
                                className={`py-2 px-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-1 ${
                                  isDarkMode 
                                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200' 
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
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

            {/* ADMIN ONLY TABS */}
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
               <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-black text-black dark:text-white">إدارة المستخدمين</h2>
                      <p className="text-xs text-gray-500 font-bold mt-1">
                        التحكم بالحسابات وتعيين وترقية الرتب (مدير، متجر رسمي، عضو) وإدارة الصلاحيات
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-black text-gray-700 dark:text-gray-300">
                        إجمالي الحسابات: {uniqueUsers.length}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-right border-separate border-spacing-y-4">
                        <thead>
                          <tr className="text-gray-900 dark:text-gray-300 text-[10px] font-black uppercase border-b border-gray-100 dark:border-gray-800">
                            <th className="p-4">المستخدم</th>
                            <th className="p-4 text-center">البريد الإلكتروني</th>
                            <th className="p-4 text-center">الرتبة</th>
                            <th className="p-4 text-center">تاريخ الانضمام</th>
                            <th className="p-4 text-left">تحكم</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uniqueUsers.map(u => {
                            const isMasterAdminAccount = u.id === 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' || (u.email && u.email.toLowerCase() === '1ismaai0lll@gmail.com');
                            return (
                             <tr key={u.id} className="bg-gray-50/50 dark:bg-gray-850 hover:bg-white dark:hover:bg-gray-800 transition rounded-2xl">
                                <td className="p-4 rounded-r-2xl">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-600 shadow-sm">
                                         {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-gray-900 dark:text-gray-200" />}
                                      </div>
                                      <div>
                                        <p className="font-black text-sm text-black dark:text-white flex items-center gap-1.5">
                                          {u.name}
                                          {isMasterAdminAccount && (
                                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-black">
                                              المدير العام
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{u.id.slice(0, 10)}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="p-4 text-center text-xs font-black text-gray-900 dark:text-gray-200 dir-ltr font-mono">{u.email}</td>
                                <td className="p-4 text-center">
                                   {isMasterAdminAccount ? (
                                     <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 shadow-sm border border-red-200 dark:border-red-800">
                                       مدير عام المتجر
                                     </span>
                                   ) : (
                                     <select 
                                       value={u.role || 'user'} 
                                       onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                       className={`text-[10px] font-black px-3 py-1 rounded-full border-0 focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                                         u.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 shadow-sm' : u.role === 'store' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shadow-sm' : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-200 shadow-sm'
                                       }`}
                                     >
                                        <option value="user">عضو عادي</option>
                                        <option value="store">متجر رسمي</option>
                                        <option value="admin">مدير نظام</option>
                                     </select>
                                   )}
                                </td>
                                <td className="p-4 text-center text-[10px] text-gray-900 dark:text-gray-300 font-black">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-YE') : '—'}</td>
                                <td className="p-4 rounded-l-2xl text-left">
                                   <div className="flex items-center justify-end gap-2">
                                      {u.role === 'store' && (
                                        <>
                                          <button 
                                            onClick={() => {
                                              handleSelectStore(u.id);
                                              setActiveTab('store-profile');
                                              toast.success(`أنت الآن تعدل متجر: ${u.name}`);
                                            }}
                                            title="تعديل وتوثيق ملف هذا المتجر"
                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-xl font-black text-xs transition"
                                          >
                                            <Store className="w-3.5 h-3.5" />
                                            <span>تعديل المتجر</span>
                                          </button>
                                          <Link 
                                            to={`/store/${u.id}`}
                                            target="_blank"
                                            title="زيارة صفحة المتجر"
                                            className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition"
                                          >
                                            <ExternalLink className="w-4 h-4" />
                                          </Link>
                                        </>
                                      )}
                                      {!isMasterAdminAccount ? (
                                        <button 
                                          onClick={() => setDeleteConfirm({ id: u.id, type: 'users', title: u.name, email: u.email })} 
                                          className="text-red-600 hover:text-red-800 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition active:scale-95"
                                          title="حذف الحساب نهائياً"
                                        >
                                           <Trash2 className="w-4 h-4" />
                                        </button>
                                      ) : (
                                        <span className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed" title="محمي (المدير الرئيسي)">
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
              );
            })()}

            {isAdmin && activeTab === 'settings' && (
              <div className="max-w-4xl space-y-10">
                 <div className="flex justify-between items-center">
                   <h2 className="text-3xl font-black">إعدادات المنصة</h2>
                   <button onClick={() => {
                     setDoc(doc(db, 'settings', 'global'), localSettings, { merge: true })
                      .then(() => toast.success("تم الحفظ"))
                      .catch(() => toast.error("فشل الحفظ"));
                   }} className="bg-black text-white px-10 py-4 rounded-2xl font-black">حفظ الكل</button>
                 </div>

                  <div className="md:col-span-12 space-y-10">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                           <AdminInput label="اسم المنصة" value={localSettings.storeName || ''} onChange={(v: any) => setLocalSettings({...localSettings, storeName: v})} />
                           <div id="store-public-url-input">
                             <AdminInput 
                               label="رابط المتجر العام (المنشور)" 
                               value={localSettings.storePublicUrl || ''} 
                               onChange={(v: any) => setLocalSettings({...localSettings, storePublicUrl: v})} 
                               placeholder="انسخ الرابط من زر 'Share' في الأعلى"
                               extra="هذا الرابط هو الذي يجب أن تشاركه مع الآخرين"
                             />
                           </div>
                           <AdminInput label="المعرف العالمي (Handle)" value={localSettings.storeHandle || ''} onChange={(v: any) => setLocalSettings({...localSettings, storeHandle: v})} />
                        </div>
                        <div className="space-y-4">
                          <label className="block text-sm font-black text-gray-700">لون المظهر الرئيسي</label>
                          <div className="flex flex-wrap gap-4 bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                            {['green', 'blue', 'red', 'purple', 'orange', 'black', 'rose', 'amber', 'cyan'].map(c => (
                              <button 
                                key={c}
                                onClick={() => setLocalSettings({...localSettings, storeTheme: c})}
                                className={`w-12 h-12 rounded-2xl border-4 transition-all duration-300 ${localSettings.storeTheme === c ? 'border-white scale-110 shadow-xl ring-4 ring-black/5' : 'border-white/50 scale-90'}`}
                                style={{ backgroundColor: c === 'black' ? '#000' : (c === 'green' ? '#166534' : c) }}
                              />
                            ))}
                          </div>
                        </div>
                     </div>

                     <div className="pt-10 border-t border-gray-100">
                        <h4 className="text-2xl font-black mb-8 flex items-center gap-2">
                           <ImageIcon className="w-6 h-6 text-blue-500" />
                           الهوية المرئية للهيرو
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                           <ImageEditor 
                             label="البانر الرئيسي (Hero Banner)" 
                             value={localSettings.heroBanner} 
                             onChange={(v: string) => setLocalSettings({...localSettings, heroBanner: v})}
                           />
                           <div className="space-y-6">
                              <AdminInput label="عنوان الهيرو (Hero Title)" value={localSettings.heroTitle || ''} onChange={(v: any) => setLocalSettings({...localSettings, heroTitle: v})} />
                              <AdminTextarea label="العنوان الفرعي" value={localSettings.heroSubtitle || ''} onChange={(v: any) => setLocalSettings({...localSettings, heroSubtitle: v})} />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <AdminInput 
                                  label="نص زر الهيرو" 
                                  value={localSettings.heroButtonText || ''} 
                                  onChange={(v: any) => setLocalSettings({...localSettings, heroButtonText: v})} 
                                  placeholder="مثال: استكشف المجموعة" 
                                />
                                <AdminInput 
                                  label="رابط زر الهيرو" 
                                  value={localSettings.heroLink || ''} 
                                  onChange={(v: any) => setLocalSettings({...localSettings, heroLink: v})} 
                                  placeholder="اتركه فارغاً للتمرير للمنتجات تلقائياً" 
                                />
                              </div>
                              <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700">
                                 <input 
                                   type="checkbox" 
                                   checked={localSettings.showHeroBanner} 
                                   onChange={e => setLocalSettings({...localSettings, showHeroBanner: e.target.checked})}
                                   className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-emerald-500 border-gray-300"
                                 />
                                 <span className="text-sm font-black">تفعيل قسم الهيرو في الصفحة الرئيسية</span>
                              </div>
                           </div>
                        </div>
                     </div>
                     {/* قسم تخصيص أيقونة وشعار الموقع الأساسي */}
                     <div className="pt-10 border-t border-gray-100 dark:border-slate-800 space-y-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                           <div>
                              <h4 className="text-2xl font-black mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
                                 <Store className="w-6 h-6 text-emerald-500" />
                                 أيقونة وشعار الموقع الأساسي
                              </h4>
                              <p className="text-sm text-gray-500 font-medium">
                                 تحكم في الأيقونة التي تظهر في شريط الترويسة العلوي بجانب اسم المنصة، وفي أيقونة تبويب المتصفح (Favicon)، واضبط مظهرها ليتناسق بدقة مع اللوجو الخاص بك.
                              </p>
                           </div>
                           <button
                             type="button"
                             onClick={() => {
                               setDoc(doc(db, 'settings', 'global'), localSettings, { merge: true })
                                 .then(() => toast.success("تم حفظ إعدادات الأيقونة والشعار بنجاح!"))
                                 .catch(() => toast.error("فشل الحفظ"));
                             }}
                             className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-95 transition flex items-center gap-2 self-start"
                           >
                              <Check className="w-4 h-4" />
                              حفظ الشعار والأيقونة
                           </button>
                        </div>

                        {/* Current Logo and Uploading Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                           {/* Left Column: Upload & Options */}
                           <div className="lg:col-span-7 space-y-6">
                              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
                                 <div className="flex items-center justify-between">
                                    <label className="text-sm font-black text-slate-800 dark:text-slate-200">
                                       صورة الشعار أو الأيقونة
                                    </label>
                                    {(localSettings.storeLogo || localSettings.siteIcon) && (
                                       <button
                                          type="button"
                                          onClick={() => setLocalSettings({ ...localSettings, storeLogo: '', siteIcon: '' })}
                                          className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 transition"
                                       >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          إزالة الشعار
                                       </button>
                                    )}
                                 </div>

                                 {/* Upload Box */}
                                 <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group">
                                       {(localSettings.siteIcon || localSettings.storeLogo) ? (
                                          <img 
                                             src={localSettings.siteIcon || localSettings.storeLogo} 
                                             alt="Current Logo" 
                                             className="w-full h-full object-contain p-2"
                                          />
                                       ) : (
                                          <div className="flex flex-col items-center text-slate-400">
                                             <Store className="w-8 h-8 mb-1" />
                                             <span className="text-[10px] font-bold">لا يوجد شعار</span>
                                          </div>
                                       )}
                                       <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-[11px] font-black">
                                          تغيير
                                          <input 
                                             type="file" 
                                             accept="image/*" 
                                             className="hidden" 
                                             onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                   const reader = new FileReader();
                                                   toast.loading('جاري تجهيز الشعار...', { id: 'logo-up' });
                                                   reader.onloadend = async () => {
                                                      try {
                                                         const compressed = await compressImage(reader.result as string);
                                                         setLocalSettings({
                                                            ...localSettings,
                                                            storeLogo: compressed,
                                                            siteIcon: compressed
                                                         });
                                                         toast.success('تم رفع واختيار الشعار بنجاح!', { id: 'logo-up' });
                                                      } catch (err) {
                                                         setLocalSettings({
                                                            ...localSettings,
                                                            storeLogo: reader.result as string,
                                                            siteIcon: reader.result as string
                                                         });
                                                         toast.success('تم رفع الشعار!', { id: 'logo-up' });
                                                      }
                                                   };
                                                   reader.readAsDataURL(file);
                                                }
                                             }}
                                          />
                                       </label>
                                    </div>

                                    <div className="flex-1 w-full space-y-2">
                                       <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs hover:bg-slate-800 transition shadow-sm w-full sm:w-auto">
                                          <Upload className="w-4 h-4" />
                                          رفع شعار أو أيقونة من جهازك
                                          <input 
                                             type="file" 
                                             accept="image/*" 
                                             className="hidden" 
                                             onChange={async (e) => {
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
                                                      } catch (err) {
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
                                       <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                          يدعم ملفات PNG المفرغة، JPG، SVG، وبأبعاد دائرية أو مربعة أو مستطيلة.
                                       </p>
                                    </div>
                                 </div>

                                 {/* URL Input */}
                                 <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                       أو ضع رابط صورة مباشر للشعار (Image URL):
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
                                       className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-left dir-ltr focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                                    />
                                 </div>

                                 {/* Presets Grid */}
                                 <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                                       أو اختر من النماذج والشعارات الجاهزة المقترحة:
                                    </span>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                       {[
                                          { 
                                             title: 'الدرع اليمني الأصيل', 
                                             url: 'https://cdn-icons-png.flaticon.com/512/3750/3750019.png',
                                             shape: 'rounded',
                                             bg: 'white'
                                          },
                                          { 
                                             title: 'تاج التجارة الملكي', 
                                             url: 'https://cdn-icons-png.flaticon.com/512/2589/2589903.png',
                                             shape: 'circle',
                                             bg: 'dark'
                                          },
                                          { 
                                             title: 'حقيبة التسوق الذهبية', 
                                             url: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
                                             shape: 'circle',
                                             bg: 'theme'
                                          },
                                          { 
                                             title: 'شارة التوثيق الرسمية', 
                                             url: 'https://cdn-icons-png.flaticon.com/512/1067/1067555.png',
                                             shape: 'transparent',
                                             bg: 'transparent'
                                          }
                                       ].map((item, idx) => (
                                          <button
                                             key={idx}
                                             type="button"
                                             onClick={() => {
                                                setLocalSettings({
                                                   ...localSettings,
                                                   storeLogo: item.url,
                                                   siteIcon: item.url,
                                                   siteIconShape: item.shape,
                                                   siteIconBg: item.bg
                                                });
                                                toast.success(`تم اختيار ${item.title}`);
                                             }}
                                             className="p-2.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:shadow-sm transition flex flex-col items-center gap-1.5 text-center group"
                                          >
                                             <img src={item.url} alt={item.title} className="w-8 h-8 object-contain group-hover:scale-110 transition" />
                                             <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{item.title}</span>
                                          </button>
                                       ))}
                                    </div>
                                 </div>
                              </div>

                              {/* Customization Options to match the user's logo style */}
                              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
                                 <h5 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                    <Palette className="w-4 h-4 text-emerald-500" />
                                    تخصيص شكل وعرض الأيقونة لتناسب اللوجو الخاص بك تماماً
                                 </h5>

                                 {/* 1. Shape Choice */}
                                 <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                       شكل إطار الأيقونة في الترويسة:
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                       {[
                                          { id: 'circle', label: 'دائري كامل', desc: 'للشعارات المستديرة' },
                                          { id: 'rounded', label: 'مربع منحني', desc: 'شكل التطبيقات العصرية' },
                                          { id: 'transparent', label: 'مفرغ بدون إطار', desc: 'للشعارات المفرغة PNG' },
                                          { id: 'original', label: 'أبعاد حرة', desc: 'حسب أبعاد الصورة الأصلية' },
                                       ].map(sh => (
                                          <button
                                             key={sh.id}
                                             type="button"
                                             onClick={() => setLocalSettings({ ...localSettings, siteIconShape: sh.id })}
                                             className={`p-3 rounded-2xl border text-right transition-all ${
                                                (localSettings.siteIconShape || 'rounded') === sh.id
                                                   ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                                                   : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                             }`}
                                          >
                                             <span className="text-xs font-black block text-slate-900 dark:text-white">{sh.label}</span>
                                             <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{sh.desc}</span>
                                          </button>
                                       ))}
                                    </div>
                                 </div>

                                 {/* 2. Background Choice */}
                                 <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                       لون خلفية الأيقونة:
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                       {[
                                          { id: 'white', label: 'أبيض ناصع' },
                                          { id: 'transparent', label: 'شفاف مفرغ' },
                                          { id: 'theme', label: 'لون المظهر' },
                                          { id: 'dark', label: 'داكن فاخر' },
                                       ].map(bg => (
                                          <button
                                             key={bg.id}
                                             type="button"
                                             onClick={() => setLocalSettings({ ...localSettings, siteIconBg: bg.id })}
                                             className={`p-2.5 rounded-xl border text-center transition ${
                                                (localSettings.siteIconBg || 'white') === bg.id
                                                   ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-black'
                                                   : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold'
                                             }`}
                                          >
                                             <span className="text-xs">{bg.label}</span>
                                          </button>
                                       ))}
                                    </div>
                                 </div>

                                 {/* 3. Size Choice */}
                                 <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                       حجم ظهور الأيقونة:
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                       {[
                                          { id: 'compact', label: 'صغير ومدمج (36px)' },
                                          { id: 'medium', label: 'قياسي متوازن (44px)' },
                                          { id: 'large', label: 'كبير وبارز (54px)' },
                                       ].map(sz => (
                                          <button
                                             key={sz.id}
                                             type="button"
                                             onClick={() => setLocalSettings({ ...localSettings, siteIconSize: sz.id })}
                                             className={`p-2.5 rounded-xl border text-center transition ${
                                                (localSettings.siteIconSize || 'medium') === sz.id
                                                   ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-black'
                                                   : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold'
                                             }`}
                                          >
                                             <span className="text-xs">{sz.label}</span>
                                          </button>
                                       ))}
                                    </div>
                                 </div>

                                 {/* 4. Border Toggle */}
                                 <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                                    <div>
                                       <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                                          إظهار إطار خارجي ناعم حول الأيقونة
                                       </span>
                                       <span className="text-[10px] text-slate-400 font-medium">
                                          يمكن إلغاؤه لجعل اللوجو ينسجم مباشرة مع خلفية الترويسة
                                       </span>
                                    </div>
                                    <input 
                                       type="checkbox" 
                                       checked={localSettings.siteIconBorder !== false} 
                                       onChange={(e) => setLocalSettings({ ...localSettings, siteIconBorder: e.target.checked })}
                                       className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                                    />
                                 </div>
                              </div>
                           </div>

                           {/* Right Column: Live Interactive Header Simulation (Exact look as circled in screenshot) */}
                           <div className="lg:col-span-5 space-y-4">
                              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-6">
                                 <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                    <div className="flex items-center gap-2">
                                       <Eye className="w-4 h-4 text-emerald-400" />
                                       <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                          معاينة شريط الترويسة العلوي المباشرة
                                       </span>
                                    </div>
                                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                       مطابق للجوال
                                    </span>
                                 </div>

                                 <p className="text-xs text-slate-400 leading-relaxed">
                                    هكذا يظهر اللوجو تماماً في أعلى التطبيق بجانب اسم المنصة (نفس المكان المحدد في دائرة لقطة الشاشة):
                                 </p>

                                 {/* Live Simulated Mobile Header */}
                                 <div className="rounded-2xl border border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-4 shadow-2xl transition-all">
                                    <div className="flex items-center justify-between gap-3">
                                       {/* Right side: Logo & Brand Name */}
                                       <div className="flex items-center gap-2.5">
                                          {(() => {
                                             const previewLogo = localSettings.siteIcon || localSettings.storeLogo;
                                             const previewShape = localSettings.siteIconShape || 'rounded';
                                             const previewBg = localSettings.siteIconBg || 'white';
                                             const previewSize = localSettings.siteIconSize || 'medium';
                                             const previewBorder = localSettings.siteIconBorder !== false && previewShape !== 'transparent' && previewBg !== 'transparent';

                                             const sizeClass = previewSize === 'large' 
                                                ? 'h-13 w-13 min-w-[50px]' 
                                                : previewSize === 'compact' 
                                                   ? 'h-9 w-9 min-w-[34px]' 
                                                   : 'h-11 w-11 min-w-[42px]';

                                             const shapeClass = previewShape === 'circle' 
                                                ? 'rounded-full' 
                                                : previewShape === 'transparent' 
                                                   ? 'rounded-none shadow-none' 
                                                   : 'rounded-2xl';

                                             const bgClass = previewShape === 'transparent' || previewBg === 'transparent'
                                                ? 'bg-transparent border-transparent shadow-none'
                                                : previewBg === 'theme'
                                                   ? 'bg-emerald-600 text-white'
                                                   : previewBg === 'dark'
                                                      ? 'bg-slate-900 text-white'
                                                      : 'bg-white text-slate-900';

                                             const borderClass = previewBorder 
                                                ? 'border border-slate-200 shadow-sm p-1' 
                                                : 'border-0 p-0';

                                             if (previewLogo && previewLogo.trim() !== '') {
                                                return (
                                                   <div className={`flex items-center justify-center overflow-hidden transition-all ${shapeClass} ${bgClass} ${borderClass}`}>
                                                      <img 
                                                         src={previewLogo} 
                                                         alt="Preview Logo" 
                                                         className={`${sizeClass} object-contain transition-all`} 
                                                      />
                                                   </div>
                                                );
                                             }

                                             return (
                                                <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm">
                                                   <Store className="h-5 w-5" />
                                                </div>
                                             );
                                          })()}

                                          <div className="flex flex-col text-right">
                                             <span className="font-black text-base text-slate-900 leading-tight">
                                                {localSettings.storeName || 'يمن ستور'}
                                             </span>
                                             <span className="text-[10px] text-slate-400 font-medium">
                                                سوق التجارة الإلكترونية
                                             </span>
                                          </div>
                                       </div>

                                       {/* Left side: Notification, Messages, Profile Avatars */}
                                       <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                                             <MessageSquare className="w-4 h-4" />
                                          </div>
                                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 p-0.5">
                                             <div className="w-full h-full rounded-full bg-slate-200 overflow-hidden">
                                                <img 
                                                   src={userData?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'} 
                                                   alt="User" 
                                                   className="w-full h-full object-cover" 
                                                />
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 </div>

                                 {/* Favicon Browser Tab Simulation */}
                                 <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                                    <span className="text-[11px] font-bold text-slate-300 block">
                                       معاينة أيقونة المتصفح (Favicon في لسان التبويب):
                                    </span>
                                    <div className="inline-flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                                       {(localSettings.siteIcon || localSettings.storeLogo) ? (
                                          <img 
                                             src={localSettings.siteIcon || localSettings.storeLogo} 
                                             alt="Favicon" 
                                             className="w-4 h-4 object-contain rounded-sm" 
                                          />
                                       ) : (
                                          <Store className="w-4 h-4 text-emerald-400" />
                                       )}
                                       <span className="text-slate-300 font-bold">{localSettings.storeName || 'يمن ستور'}</span>
                                       <X className="w-3 h-3 text-slate-500 mr-2" />
                                    </div>
                                 </div>

                                 <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-800/40 space-y-1">
                                    <span className="text-emerald-400 font-black text-xs flex items-center gap-1.5">
                                       <CheckCircle className="w-4 h-4" />
                                       مزامنة شاملة وفورية
                                    </span>
                                    <p className="text-[11px] text-emerald-200/80 leading-relaxed font-medium">
                                       عند الضغط على "حفظ الشعار والأيقونة"، سيتم تحديث الشعار فوراً في شريط الترويسة، وتبويب المتصفح، وشاشات الجوال بدون الحاجة لإعادة تحميل الصفحة.
                                    </p>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
              </div>
            )}
            {activeTab === 'server' && isAdmin && (
              <div className="space-y-10">
                <div className="flex justify-between items-center text-right">
                  <div>
                    <h2 className="text-3xl font-black mb-1">إدارة السيرفر</h2>
                    <p className="text-gray-500 font-medium">تحكم في العمليات الخلفية، والتنظيف التلقائي، ومراقبة السجلات</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleManualCleanup}
                      disabled={isCleaningUp}
                      className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-red-700 transition flex items-center gap-2"
                    >
                      {isCleaningUp ? <Clock className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                      تنظيف يدوي الآن
                    </button>
                    <button 
                      onClick={() => {
                        setDoc(doc(db, 'settings', 'global'), localSettings, { merge: true })
                          .then(() => toast.success("تم حفظ إعدادات السيرفر"))
                          .catch(() => toast.error("فشل الحفظ"));
                      }}
                      className="bg-black text-white px-8 py-4 rounded-2xl font-black"
                    >
                      حفظ الإعدادات
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 shadow-sm text-right">
                      <h3 className="text-xl font-black mb-6 flex items-center gap-3 justify-start flex-row-reverse">
                        <SettingsIcon className="w-6 h-6 text-blue-500" />
                        إعدادات التنظيف التلقائي
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 flex-row-reverse">
                          <div className="text-right">
                            <p className="font-bold text-sm">تفعيل التنظيف التلقائي</p>
                            <p className="text-[10px] text-gray-400">حذف المنتجات القديمة تلقائياً لتوفير مساحة التخزين</p>
                          </div>
                          <button 
                            onClick={() => setLocalSettings({...localSettings, autoCleanupEnabled: !localSettings.autoCleanupEnabled})}
                            className={`w-14 h-8 rounded-full transition-colors relative ${localSettings.autoCleanupEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                          >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${localSettings.autoCleanupEnabled ? 'left-7' : 'left-1'}`}></div>
                          </button>
                        </div>

                        <AdminInput 
                          label="عمر المنتج بالشهور (ليتم حذفه)" 
                          type="number"
                          value={(localSettings.cleanupMonths || 3).toString()} 
                          onChange={(v: string) => setLocalSettings({...localSettings, cleanupMonths: Number(v)})} 
                          placeholder="3" 
                          extra="المنتجات الأقدم من هذا الرقم سيتم حذفها"
                        />

                        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex items-start gap-3 text-right flex-row-reverse">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-1" />
                          <p className="text-xs font-bold text-yellow-800 leading-relaxed">
                            تنبيه: سيتم حذف المنتجات بناءً على حقل "تاريخ الإنشاء". تأكد من الإعدادات قبل التفعيل.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-600/20 text-right">
                      <h3 className="text-xl font-black mb-4 flex items-center gap-3 justify-start flex-row-reverse">
                        <Activity className="w-6 h-6" />
                        حالة السيرفر
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/10 flex-row-reverse">
                          <span className="text-sm font-medium opacity-80">الحالة التشغيلية</span>
                          <span className="flex items-center gap-2 text-sm font-black">
                            <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                            يعمل بكفاءة
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/10 flex-row-reverse">
                          <span className="text-sm font-medium opacity-80">وقت التشغيل الأخير</span>
                          <span className="text-sm font-black">{new Date().toLocaleString('ar-YE')}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 flex-row-reverse">
                          <span className="text-sm font-medium opacity-80">المستخدمين المتصلين حالياً</span>
                          <span className="text-sm font-black">{globalStats.onlineCount || 1} متصل</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 text-right">
                    <h3 className="text-xl font-black flex items-center gap-3 pr-4 justify-start flex-row-reverse">
                      <ListFilter className="w-6 h-6 text-gray-400" />
                      سجلات السيرفر (Logs)
                    </h3>
                    <div className="bg-gray-900 rounded-[2.5rem] p-6 text-green-400 font-mono text-[10px] h-[500px] overflow-y-auto border-4 border-gray-800 shadow-inner">
                      <div className="space-y-3 text-left dir-ltr">
                        {serverLogs.length === 0 ? (
                          <div className="text-gray-600 italic">No logs found...</div>
                        ) : (
                          serverLogs.map(log => (
                            <div key={log.id} className="border-b border-gray-800 pb-2 flex gap-4">
                              <span className="text-gray-500 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                              <span className={
                                log.type === 'error' ? 'text-red-500' : 
                                log.type === 'success' ? 'text-green-400' : 'text-blue-400'
                              }>
                                [{log.type.toUpperCase()}] {log.message}
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
            {activeTab === 'store-accounts' && (
              <StoreAccountsManagement />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-white rounded-[3rem] p-10 text-center space-y-8 max-w-sm w-full shadow-2xl"
           >
              <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                <Trash2 className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-2xl font-black mb-2">تأكيد الحذف النهائي</h3>
                <p className="text-gray-500 font-medium leading-relaxed">
                  هل أنت متأكد تماماً من حذف "{deleteConfirm.title}"؟ لا يمكن التراجع عن هذه العملية لاحقاً.
                </p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-red-600/20 hover:bg-red-700 active:scale-95 transition"
                >
                  نعم، احذف
                </button>
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-gray-100 text-gray-500 font-black py-5 rounded-[2rem] hover:bg-gray-200 active:scale-95 transition"
                >
                  إلغاء
                </button>
              </div>
           </motion.div>
        </div>
      )}

      {/* Order Details & Payment Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`rounded-[2.5rem] p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 relative border ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black">
                    تفاصيل الطلب <span className="font-mono text-emerald-600">#{viewingOrder.id.slice(-6).toUpperCase()}</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    تاريخ الطلب: {new Date(viewingOrder.createdAt).toLocaleDateString('ar-YE')} - {new Date(viewingOrder.createdAt).toLocaleTimeString('ar-YE')}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setViewingOrder(null)}
                className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Total Banner */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1">حالة الطلب الحالية:</span>
                <select 
                  value={viewingOrder.status}
                  onChange={(e) => {
                    handleUpdateOrderStatus(viewingOrder.id, e.target.value);
                    setViewingOrder({ ...viewingOrder, status: e.target.value });
                  }}
                  className={`text-xs font-black rounded-xl p-2 border-0 cursor-pointer shadow-sm ${statusColors[viewingOrder.status]}`}
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="processing">جاري التجهيز</option>
                  <option value="shipped">تم الشحن</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>

              <div className="text-left">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">المبلغ الإجمالي:</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {viewingOrder.total?.toLocaleString()} <span className="text-xs font-bold text-slate-500">ر.ي</span>
                </span>
              </div>
            </div>

            {/* Customer Details */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-500" />
                بيانات العميل والتوصيل
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">الاسم:</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{viewingOrder.customerName || 'عميل يمن ستور'}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">رقم الهاتف / الواتساب:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{viewingOrder.customerPhone || 'غير محدد'}</span>
                    {viewingOrder.customerPhone && (
                      <a 
                        href={`https://wa.me/${viewingOrder.customerPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-lg bg-green-500 text-white text-xs hover:bg-green-600 transition"
                        title="مراسلة واتساب مباشرة"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {viewingOrder.customerNotes && (
                  <div className="sm:col-span-2">
                    <span className="text-xs text-slate-400 block">ملاحظات / تفاصيل العنوان:</span>
                    <p className="font-bold text-xs bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mt-1">
                      {viewingOrder.customerNotes}
                    </p>
                  </div>
                )}

                {viewingOrder.location && (
                  <div className="sm:col-span-2 flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span>إحداثيات GPS: {viewingOrder.location.lat.toFixed(5)}, {viewingOrder.location.lng.toFixed(5)}</span>
                    </div>
                    <a 
                      href={`https://www.google.com/maps?q=${viewingOrder.location.lat},${viewingOrder.location.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      فتح في الخريطة
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Wallets Info */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" />
                طريقة وبيانات الدفع
              </h4>

              {viewingOrder.paymentMethod === 'wallet' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      الدفع عبر المحفظة الإلكترونية
                    </span>
                    {viewingOrder.selectedWallet?.transferType === 'point' ? (
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        تحويل لنقطة صرافة / وكيل
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        تحويل مباشر لمشترك
                      </span>
                    )}
                  </div>

                  {viewingOrder.selectedWallet && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">المحفظة المستهدفة:</span>
                        <span className="font-black text-slate-900 dark:text-white">{viewingOrder.selectedWallet.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">رقم الحساب / الهاتف:</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{viewingOrder.selectedWallet.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">اسم المستلم:</span>
                        <span className="font-bold">{viewingOrder.selectedWallet.accountName}</span>
                      </div>
                      {viewingOrder.selectedWallet.transferType === 'point' && viewingOrder.selectedWallet.pointDetails && (
                        <div className="flex justify-between text-amber-700 dark:text-amber-400">
                          <span className="font-bold">اسم النقطة / الوكيل:</span>
                          <span className="font-black">{viewingOrder.selectedWallet.pointDetails}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Transfer reference */}
                  {viewingOrder.transferReference && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">رقم الحوالة / السند:</span>
                      <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm select-all">
                        {viewingOrder.transferReference}
                      </span>
                    </div>
                  )}

                  {/* Payment receipt image */}
                  {viewingOrder.paymentProof && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-500 block">صورة إشعار / سند التحويل:</span>
                      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-64 bg-slate-950 flex items-center justify-center relative group">
                        <img 
                          src={viewingOrder.paymentProof} 
                          alt="إشعار التحويل" 
                          className="max-h-64 object-contain"
                        />
                        <a 
                          href={viewingOrder.paymentProof} 
                          target="_blank" 
                          rel="noreferrer"
                          className="absolute bottom-3 left-3 bg-white/90 text-slate-900 px-3 py-1 rounded-xl text-xs font-bold shadow-lg hover:bg-white flex items-center gap-1.5"
                        >
                          عرض بالحجم الكامل
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                  💵 طريقة الدفع: الدفع عند الاستلام (كاش للمندوب)
                </div>
              )}
            </div>

            {/* Ordered items table */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                المنتجات المطلوبة ({viewingOrder.items?.length || 0})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {viewingOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-[10px] text-slate-400">الكمية: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                      {(item.price * item.quantity).toLocaleString()} ر.ي
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setViewingOrder(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold text-xs transition"
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {showQrModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-white rounded-[3rem] p-10 text-center space-y-8 max-w-sm w-full shadow-2xl relative"
           >
              <button 
                onClick={() => setShowQrModal(false)}
                className="absolute left-6 top-6 w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto text-green-600">
                <QrCode className="w-10 h-10" />
              </div>
              
              <div>
                <h3 className="text-2xl font-black mb-2">كود QR الخاص بمتجرك</h3>
                <p className="text-gray-500 text-xs font-bold px-4">قم بمشاركة هذا الكود مع عملائك للوصول السريع لمتجرك</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex justify-center shadow-inner">
                <QRCodeCanvas 
                  value={settings?.storePublicUrl || window.location.origin} 
                  size={200}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: settings?.storeLogo || '',
                    x: undefined,
                    y: undefined,
                    height: 40,
                    width: 40,
                    excavate: true,
                  }}
                />
              </div>

              <div className="space-y-3">
                 <button 
                   onClick={() => {
                     const canvas = document.querySelector('canvas');
                     if (canvas) {
                       const url = canvas.toDataURL("image/png");
                       const link = document.createElement('a');
                       link.download = 'store-qr.png';
                       link.href = url;
                       link.click();
                       toast.success('تم تحميل الكود');
                     }
                   }}
                   className="w-full bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition"
                 >
                   <Download className="w-5 h-5" />
                   تحميل الكود كصورة
                 </button>
                 <button 
                   onClick={() => {
                      navigator.clipboard.writeText(settings?.storePublicUrl || window.location.origin);
                     toast.success('تم نسخ رابط المتجر');
                   }}
                   className="w-full bg-gray-50 text-black font-black py-4 rounded-2xl border border-gray-100 hover:bg-gray-100 transition"
                 >
                   نسخ الرابط المباشر
                 </button>
              </div>
           </motion.div>
        </div>
      )}

      {/* Product Form Modal */}
      {productForm && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
           <motion.div 
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="bg-white rounded-[3rem] p-10 max-w-2xl w-full shadow-2xl relative overflow-y-auto max-h-[90vh]"
           >
              <button 
                onClick={() => setProductForm(null)}
                className="absolute left-6 top-6 w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-3xl font-black mb-10">{productForm.id ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
              
              <form onSubmit={handleSaveProduct} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AdminInput 
                    label="عنوان المنتج" 
                    value={productForm.title} 
                    onChange={v => setProductForm({...productForm, title: v})} 
                    placeholder="مثال: عسل سدر يمني أصلي" 
                  />
                  <AdminInput 
                    label="السعر (ريال)" 
                    type="number"
                    value={productForm.price.toString()} 
                    onChange={v => setProductForm({...productForm, price: v})} 
                    placeholder="0.00" 
                  />
                  <div className="space-y-1">
                    <AdminInput 
                      label="المخزون المتوفر (اتركه فارغاً ليكون غير محدود)" 
                      type="number"
                      value={productForm.stock === null || productForm.stock === undefined ? '' : (productForm.stock || 0).toString()} 
                      onChange={(v: string) => setProductForm({...productForm, stock: v === '' ? null : v})} 
                      placeholder="غير محدود" 
                    />
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mt-2">
                      <p className="text-[10px] text-blue-600 font-extrabold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        تنبيه: بوضع الكمية (0)، سيتم اعتبار المنتج "نافداً من الكمية" وسيظهر للزبائن بهذا الوصف. إذا تركت الحقل فارغاً، سيتم اعتبار المنتج "متوفراً دائماً" (مخزون غير محدود).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-black text-black uppercase tracking-widest px-1">التصنيف</label>
                    <select 
                      value={productForm.category}
                      onChange={e => setProductForm({...productForm, category: e.target.value})}
                      className="w-full bg-white border-2 border-gray-100 rounded-[1.5rem] p-5 font-black text-base focus:ring-4 focus:ring-black/5 focus:border-black transition-all shadow-md active:scale-[0.99]"
                    >
                      <option value="عام">عام</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-black text-black uppercase tracking-widest px-1">الحالة</label>
                    <select 
                      value={productForm.status}
                      onChange={e => setProductForm({...productForm, status: e.target.value})}
                      className="w-full bg-white border-2 border-gray-100 rounded-[1.5rem] p-5 font-black text-base focus:ring-4 focus:ring-black/5 focus:border-black transition-all shadow-md active:scale-[0.99]"
                    >
                      <option value="active">نشط (يظهر للجميع)</option>
                      <option value="draft">مسودة (مخفي)</option>
                    </select>
                  </div>
                </div>

                <AdminTextarea 
                  label="وصف المنتج" 
                  value={productForm.description} 
                  onChange={v => setProductForm({...productForm, description: v})} 
                  placeholder="اكتب مواصفات وتفاصيل المنتج هنا..." 
                />

                {/* Pre-Order / Reservation Configuration */}
                <div className="p-6 rounded-[2rem] bg-amber-50/70 border-2 border-amber-300 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                        <BookmarkCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-black">إعدادات الحجز المسبق (دفع عربون)</h4>
                        <p className="text-[11px] text-gray-500 font-bold">تحديد مبلغ العربون ومدة الحجز ومصادرة العربون عند فوات المدة</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={productForm.isPreOrderEnabled ?? true}
                        onChange={(e) => setProductForm({ ...productForm, isPreOrderEnabled: e.target.checked })}
                        className="w-5 h-5 rounded-lg border-2 border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-black text-black">تفعيل ميزة الحجز</span>
                    </label>
                  </div>

                  {(productForm.isPreOrderEnabled ?? true) && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <AdminInput
                            label="مبلغ العربون المطلوب (ريال)"
                            type="number"
                            value={productForm.depositAmount === undefined || productForm.depositAmount === null ? '' : productForm.depositAmount.toString()}
                            onChange={(v: string) => setProductForm({ ...productForm, depositAmount: v === '' ? null : Number(v) })}
                            placeholder="مثال: 5000 (افتراضياً 20%)"
                            extra="اتركه فارغاً لاحتساب 20% تلقائياً من السعر"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-sm font-black text-black uppercase tracking-widest px-1 block">
                            مدة صلاحية الحجز (المحددة من المتجر)
                          </label>
                          <select
                            value={productForm.reservationDurationDays || 3}
                            onChange={(e) => setProductForm({ ...productForm, reservationDurationDays: Number(e.target.value) })}
                            className="w-full bg-white border-2 border-gray-100 rounded-[1.5rem] p-5 font-black text-base focus:ring-4 focus:ring-black/5 focus:border-black transition-all shadow-md active:scale-[0.99]"
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
                      <div className="p-3 bg-red-100/70 rounded-2xl border border-red-200">
                        <p className="text-[11px] text-red-800 font-black leading-relaxed flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>شرط النظام المعتمد: في حال لم يقم الزبون بإتمام شراء المنتج وسداد باقي المبلغ خلال المدة المحددة، يُعتبر الحجز لاغياً تلقائياً ويذهب مبلغ العربون للمتجر.</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-end px-1">
                    <label className="text-sm font-black text-black uppercase tracking-widest">صور المنتج</label>
                    <span className="text-[11px] font-black text-gray-400">ارفع صوراً مميزة لسلعتك من جهازك</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    {productForm.images.map((img: string, idx: number) => (
                      <div key={idx} className="relative aspect-square rounded-3xl border-2 border-gray-100 overflow-hidden group bg-gray-50 flex flex-col items-center justify-center transition-all hover:border-black shadow-sm">
                        {img ? (
                          <>
                            <img src={img} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-[2px]">
                               <button 
                                 type="button" 
                                 onClick={() => {
                                   const newImgs = productForm.images.filter((_: any, i: number) => i !== idx);
                                   setProductForm({...productForm, images: newImgs});
                                 }} 
                                 className="p-3 bg-white rounded-xl text-red-500 shadow-xl hover:scale-110 active:scale-95 transition"
                               >
                                 <Trash2 className="w-5 h-5"/>
                               </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                             <ImageIcon className="w-8 h-8" />
                             <span className="text-[10px] font-black">جاليري {idx + 1}</span>
                             <input 
                               type="file" 
                               accept="image/*"
                               onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                     const reader = new FileReader();
                                     toast.loading('جاري ضغط وتحسين جودة الصورة...', { id: 'prod-img' });
                                     reader.onloadend = async () => {
                                       try {
                                         const compressed = await compressImage(reader.result as string);
                                         const newImgs = [...productForm.images];
                                         newImgs[idx] = compressed;
                                         setProductForm({...productForm, images: newImgs});
                                         toast.success('تم رفع الصورة بنجاح وتلقائياً تم تقليل حجمها', { id: 'prod-img' });
                                       } catch (err) {
                                         toast.error('فشل في ضغط الصورة');
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
                      onClick={() => setProductForm({...productForm, images: [...productForm.images, '']})}
                      className="aspect-square rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center gap-4 hover:border-black hover:text-black hover:bg-white transition-all bg-gray-50/50 shadow-sm active:scale-95 group"
                    >
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-black group-hover:text-white transition duration-500">
                        <Plus className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest">إضافة صورة</span>
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full bg-green-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-xl shadow-green-600/20 hover:bg-green-700 active:scale-95 transition flex items-center justify-center gap-3"
                >
                  {isSaving ? <Clock className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                  {productForm.id ? 'تحديث المنتج' : 'إضافة المنتج للمتجر'}
                </button>
              </form>
           </motion.div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function NavItem({ active, onClick, icon, label, count, extra }: { active: boolean, onClick: () => void, icon: any, label: string, count?: number, extra?: string }) {
  const { isDarkMode } = useAppContext();
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-300 group ${
        active 
          ? `${isDarkMode ? 'bg-blue-600 shadow-blue-900/20' : 'bg-black shadow-black/10'} text-white shadow-xl scale-102 translate-l-1` 
          : `${isDarkMode ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
          {icon}
        </span>
        <span className="font-black text-sm">{label}</span>
      </div>
      {!active && count !== undefined && count > 0 && (
         <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white shadow-sm">
           {count}
         </span>
      )}
      {extra && (
        <span className="text-[9px] font-black bg-yellow-400 text-black px-2 py-1 rounded-lg">
          {extra}
        </span>
      )}
    </button>
  );
}

function StatCard({ label, value, icon, trend }: { label: string, value: any, icon: any, trend?: string }) {
  const { isDarkMode } = useAppContext();
  return (
    <div className={`rounded-[2.5rem] p-8 border hover:shadow-xl transition-all group relative overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      <div className="relative z-10">
        <div className={`w-12 h-12 rounded-2xl shadow-sm border flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-100 text-gray-500'}`}>
           {icon}
        </div>
        <p className={`font-bold text-xs mb-1 uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
        <div className="flex items-end gap-3 flex-wrap">
          <h3 className={`text-3xl lg:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{value}</h3>
          {trend && (
            <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isDarkMode ? 'text-green-400 bg-green-900/20' : 'text-green-600 bg-green-50'}`}>{trend}</span>
          )}
        </div>
      </div>
    </div>
  );
}
