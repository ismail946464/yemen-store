import { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, increment, updateDoc, addDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role?: string;
  [key: string]: any;
}

interface AppContextType {
  user: User | AppUser | null;
  userData: any | null;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isStore: boolean;
  loading: boolean;
  userRole: 'user' | 'store' | 'admin' | null;
  settings: any | null;
  isLoginModalOpen: boolean;
  loginModalInitialEmail: string;
  openLoginModal: (initialEmail?: string) => void;
  closeLoginModal: () => void;
  login: () => Promise<void> | void;
  loginWithGoogle: () => Promise<void>;
  loginWithOtp: (email: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  cart: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  unreadCount: number;
  markMessagesAsRead: () => Promise<void>;
  settingsLoading: boolean;
  globalStats: { totalVisitors: number, totalRegistered: number, onlineCount: number, mainStoreLastSeen: string | null };
  getThemeClasses: (type: 'bg' | 'text' | 'hover' | 'border' | 'bgLight' | 'textDark') => string;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

export interface CartItem {
  product: any;
  quantity: number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('yemen_store_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalInitialEmail, setLoginModalInitialEmail] = useState('');
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [settings, setSettings] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const prevUnreadCount = useRef(0);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({ totalVisitors: 0, totalRegistered: 0, onlineCount: 0, mainStoreLastSeen: null as string | null });

  const toggleDarkMode = () => {
    setIsDarkMode((prev: boolean) => {
      const newVal = !prev;
      localStorage.setItem('isDarkMode', JSON.stringify(newVal));
      return newVal;
    });
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Visitor increment
    useEffect(() => {
        const hasVisited = sessionStorage.getItem('visited_v2');
        if (!hasVisited) {
            const statsRef = doc(db, 'stats', 'global');
            getDoc(statsRef).then(snap => {
                if (snap.exists()) {
                   updateDoc(statsRef, { totalVisitors: increment(1) })
                     .then(() => sessionStorage.setItem('visited_v2', 'true'))
                     .catch(e => {
                       if (e.code === 'resource-exhausted') sessionStorage.setItem('visited_v2', 'true');
                     });
                } else {
                   setDoc(statsRef, { totalVisitors: 1 })
                     .then(() => sessionStorage.setItem('visited_v2', 'true'))
                     .catch(() => {});
                }
            }).catch(() => {});
        }
    }, []);

  const lastPresenceUpdateRef = useRef<number>(Number(sessionStorage.getItem('lastPresenceTime')) || 0);
  const initialMessageIds = useRef<Set<string>>(new Set());
  const isInitialMessagesLoaded = useRef(false);

  // Presence / Last Seen System
  useEffect(() => {
    if (!user) return;

    const updatePresence = async (active: boolean) => {
      if (!user) return;
      const now = Date.now();
      
      // Throttle: don't update more than once every 25 minutes
      if (now - lastPresenceUpdateRef.current < 1500000) return;
      
      const nowISO = new Date(now).toISOString();
      lastPresenceUpdateRef.current = now;
      sessionStorage.setItem('lastPresenceTime', now.toString());
      
      try {
        await updateDoc(doc(db, 'users', user.uid), { 
          lastSeen: nowISO,
          isOnline: active 
        });

        // Store/Admin profile update - throttled to 45 mins
        if ((userData?.role === 'store' || user.email === '1ismaai0lll@gmail.com') && (now - (Number(sessionStorage.getItem('lastProfilePresence')) || 0) > 2700000)) {
          updateDoc(doc(db, 'storeProfiles', user.uid), {
            lastSeen: nowISO
          }).then(() => sessionStorage.setItem('lastProfilePresence', now.toString())).catch(() => {});
        }
        
        // Master admin global stats - throttled to 30 mins
        if (user.email === '1ismaai0lll@gmail.com' && (now - (Number(sessionStorage.getItem('lastGlobalPresence')) || 0) > 1800000)) {
           setDoc(doc(db, 'stats', 'global'), { 
             mainStoreLastSeen: nowISO 
           }, { merge: true })
           .then(() => sessionStorage.setItem('lastGlobalPresence', now.toString()))
           .catch(() => {});
        }
      } catch (err: any) {
        if (err.code === 'resource-exhausted') {
           console.warn("Quota exceeded for presence update");
           return;
        }
      }
    };

    updatePresence(true);
    const interval = setInterval(() => updatePresence(true), 1500000); // 25m heartbeat
    
    // Activity tracking - only update presence on activity if it's been a while (20m+)
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastPresenceUpdateRef.current > 1200000) {
        updatePresence(true);
      }
    };
    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      // Do NOT reset throttle here to prevent tab-switching write bombs
      updatePresence(isVisible);
    };

    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keypress', handleActivity);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  // Fetch Global Stats
  useEffect(() => {
    // Visitor stats and online count listener
    const statsUnsubscribe = onSnapshot(doc(db, 'stats', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalStats(prev => ({ 
          ...prev, 
          totalVisitors: data.totalVisitors || 0,
          totalRegistered: data.totalRegistered || 0,
          onlineCount: data.onlineCount || 0,
          mainStoreLastSeen: data.mainStoreLastSeen || null
        }));
      }
    }, (error) => {
      console.warn('Global stats listener notice (handled):', (error as any)?.message);
    });

    // ONLY the master admin or main admins should calculate and sync these values to global stats
    // Store owners will just listen to the results from the global doc
    const isMasterAdminUser = user?.email === '1ismaai0lll@gmail.com' || userData?.role === 'admin';
    
    if (!isMasterAdminUser || !auth.currentUser) return () => statsUnsubscribe();

    // Calculate Online Count (Admin only sync) - throttled to 20 mins
    const updateOnlineCount = async () => {
      if (!auth.currentUser) return;
      try {
        const twentyMinutesAgo = new Date(Date.now() - 20 * 60000).toISOString();
        const qOnline = query(collection(db, 'users'), where('lastSeen', '>=', twentyMinutesAgo));
        const snap = await getDocs(qOnline);
        const count = snap.size;
        
        // Only update global doc if count changed significantly to save writes
        if (Math.abs(count - globalStats.onlineCount) > 2 || (count > 0 && globalStats.onlineCount === 0)) {
          setGlobalStats(prev => ({ ...prev, onlineCount: count }));
          updateDoc(doc(db, 'stats', 'global'), { onlineCount: count }).catch(() => {});
        }
      } catch (error) {
        console.warn("Failed to fetch online users (possibly quota)", error);
      }
    };

    updateOnlineCount();
    const onlineInterval = setInterval(updateOnlineCount, 1200000); // 20 mins

    // One-time total registered count update (Admin only)
    if (auth.currentUser) {
      const lastCountUpdate = sessionStorage.getItem('registeredCountUpdated');
      if (!lastCountUpdate) {
        getDocs(collection(db, 'users')).then(async snap => {
          const count = snap.size;
          setGlobalStats(prev => ({ ...prev, totalRegistered: count }));
          updateDoc(doc(db, 'stats', 'global'), { totalRegistered: count })
            .then(() => sessionStorage.setItem('registeredCountUpdated', 'true'))
            .catch(() => {});
        }).catch(() => {});
      }
    }

    return () => {
      statsUnsubscribe();
      clearInterval(onlineInterval);
    };
  }, [user, userData?.role]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      prevUnreadCount.current = 0;
      isInitialMessagesLoaded.current = false;
      initialMessageIds.current.clear();
      return;
    }
    const q = query(
      collection(db, 'messages'), 
      where('recipientId', '==', user.uid), 
      where('isRead', '==', false)
    );
    
    // Unread messages snapshot
    const unsubscribe = onSnapshot(q, (snap) => {
      const currentIds = snap.docs.map(d => d.id);
      const newCount = snap.size;

      if (!isInitialMessagesLoaded.current) {
        initialMessageIds.current = new Set(currentIds);
        isInitialMessagesLoaded.current = true;
      } else {
        const trulyNewMessages = snap.docChanges().filter(change => {
          if (change.type !== 'added') return false;
          if (initialMessageIds.current.has(change.doc.id)) return false;
          
          // Timestamp check: Ignore messages older than 2 minutes when just listening
          const msgData = change.doc.data();
          if (msgData.createdAt) {
            const msgTime = new Date(msgData.createdAt).getTime();
            const now = Date.now();
            if (now - msgTime > 120000) return false; 
          }
          return true;
        });

        if (trulyNewMessages.length > 0) {
          toast.success("لديك رسالة جديدة!", {
            icon: '💬',
            position: 'top-center'
          });

          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification("متجر يمن", {
              body: "لديك رسائل جديدة!",
              icon: "/favicon.ico"
            });
          }
          
          // Add to tracked set so they don't fire again
          trulyNewMessages.forEach(change => initialMessageIds.current.add(change.doc.id));
        }
      }
      
      setUnreadCount(newCount);
      prevUnreadCount.current = newCount;
    }, (error) => {
      console.warn('Unread messages listener fail (silent):', error.message);
    });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => unsubscribe();
  }, [user]);

  const markMessagesAsRead = async () => {
    if (!user) return;
    setUnreadCount(0);
    prevUnreadCount.current = 0;
    try {
      const q = query(
        collection(db, 'messages'), 
        where('recipientId', '==', user.uid), 
        where('isRead', '==', false)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        updateDoc(doc(db, 'messages', d.id), { isRead: true }).catch(() => {});
      });

      if (userData?.role === 'admin' || user.email === '1ismaai0lll@gmail.com') {
        const qAdmin = query(
          collection(db, 'messages'),
          where('recipientId', '==', 'admin'),
          where('isRead', '==', false)
        );
        const adminSnap = await getDocs(qAdmin);
        adminSnap.docs.forEach(d => {
          updateDoc(doc(db, 'messages', d.id), { isRead: true }).catch(() => {});
        });
      }

      const qConv = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid)
      );
      const convSnap = await getDocs(qConv);
      convSnap.docs.forEach(d => {
        const data = d.data();
        if (data.unreadCount && data.unreadCount[user.uid] > 0) {
          updateDoc(doc(db, 'conversations', d.id), {
            [`unreadCount.${user.uid}`]: 0
          }).catch(() => {});
        }
      });
    } catch (e) {
      console.warn("Error marking messages as read:", e);
    }
  };

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setSettings(snap.data());
      setSettingsLoading(false);
    }, (error) => {
      console.warn("Settings sync failed:", error);
      setSettingsLoading(false);
    });

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        const saved = localStorage.getItem('yemen_store_session');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setUser(parsed);
          } catch {
            setUser(null);
            setUserData(null);
            setLoading(false);
          }
        } else {
          setUser(null);
          setUserData(null);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubAuth();
      unsubSettings();
    };
  }, []);

  // Sync Favicon and Document Title dynamically with settings
  useEffect(() => {
    if (!settings) return;
    if (settings.storeName) {
      document.title = settings.storeName;
    }
    const iconUrl = settings.siteIcon || settings.storeLogo;
    if (iconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = iconUrl;

      let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
      if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        document.getElementsByTagName('head')[0].appendChild(appleLink);
      }
      appleLink.href = iconUrl;
    }
  }, [settings?.storeName, settings?.storeLogo, settings?.siteIcon]);

  useEffect(() => {
    if (!user) return;

    // Use onSnapshot for real-time role and point updates
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setLoading(false);

        // Check for verification expiry if user is a store
        if (data.role === 'store') {
            getDoc(doc(db, 'storeProfiles', user.uid)).then(async (profileSnap) => {
                if (profileSnap.exists()) {
                    const profile = profileSnap.data();
                    if (profile.verified && profile.verifiedUntil) {
                        const expiryDate = new Date(profile.verifiedUntil);
                        const now = new Date();
                        const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        
                        // If expiring in 10 days or less, and we haven't notified recently
                        if (diffDays <= 10 && diffDays > -30) {
                            const lastNotified = profile.lastExpiryNotificationSentAt ? new Date(profile.lastExpiryNotificationSentAt) : null;
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            
                            if (!lastNotified || lastNotified < thirtyDaysAgo) {
                                // Send notification
                                try {
                                    await addDoc(collection(db, 'notifications'), {
                                        userId: user.uid,
                                        title: 'تنبيه: توثيق المتجر يقترب من الانتهاء',
                                        message: `سينتهي توثيق متجرك خلال ${diffDays} أيام (${expiryDate.toLocaleDateString('ar-YE')}). يرجى تجديد التوثيق لضمان استمرار ظهور علامتك الموثقة.`,
                                        type: 'verification_expiry',
                                        read: false,
                                        actionUrl: '/admin?tab=store-profile',
                                        createdAt: new Date().toISOString()
                                    });
                                    // Update last notified
                                    await updateDoc(doc(db, 'storeProfiles', user.uid), {
                                        lastExpiryNotificationSentAt: new Date().toISOString()
                                    });
                                } catch (err) {
                                    console.error("Error sending expiry notification:", err);
                                }
                            }
                        }
                    }
                }
            });
        }
      } else {
        // Create user profile if it doesn't exist
        const isInitialAdmin = user.email === '1ismaai0lll@gmail.com';
        const newUserData = {
          name: (user as any).displayName || user.email?.split('@')[0] || 'مستخدم',
          email: user.email || '',
          phone: '',
          photoURL: (user as any).photoURL || '',
          role: isInitialAdmin ? 'admin' : ((user as any).role || 'user'),
          pointsBalance: 0,
          agreedToDisclaimer: false,
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          isOnline: true
        };
        setUserData(newUserData);
        setLoading(false);
        setDoc(userDocRef, newUserData).catch(err => {
          console.warn('User profile sync note:', err.message);
        });
        // Also sync total registered count
        updateDoc(doc(db, 'stats', 'global'), { totalRegistered: increment(1) }).catch(() => {});
      }
    }, (error) => {
      console.warn(`User profile listener notice for ${user.uid}:`, error.message);
      setLoading(false);
    });

    return () => unsubUser();
  }, [user]);

  const openLoginModal = (initialEmail?: string) => {
    if (initialEmail) setLoginModalInitialEmail(initialEmail);
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  const login = () => {
    openLoginModal();
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const res = await signInWithPopup(auth, provider);
      if (res.user) {
        localStorage.removeItem('yemen_store_session');
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      toast.error("فشل تسجيل الدخول: " + error.message);
      throw error;
    }
  };

  const loginWithOtp = async (email: string, code: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      
      const contentType = res.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        toast.error('تعذر معالجة استجابة الخادم. يرجى المحاولة لاحقاً.');
        return false;
      }

      if (!data.success) {
        toast.error(data.message || 'فشل التحقق من الرمز');
        return false;
      }
      if (data.sessionToken) {
        localStorage.setItem('yemen_store_session_token', data.sessionToken);
      }
      const sessionUser: AppUser = {
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.name || data.user.email?.split('@')[0],
        photoURL: data.user.photoURL || '',
        role: data.user.role
      };
      localStorage.setItem('yemen_store_session', JSON.stringify(sessionUser));
      setUser(sessionUser);
      setUserData(data.user);
      return true;
    } catch (err: any) {
      toast.error('تعذر الاتصال بالخادم: ' + (err?.message || 'خطأ غير معروف'));
      return false;
    }
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) return { Authorization: `Bearer ${idToken}` };
      } catch {}
    }
    const sessionToken = localStorage.getItem('yemen_store_session_token');
    if (sessionToken) {
      return { Authorization: `Bearer ${sessionToken}` };
    }
    return {};
  };

  const logout = async () => {
    localStorage.removeItem('yemen_store_session');
    localStorage.removeItem('yemen_store_session_token');
    setUser(null);
    setUserData(null);
    try {
      await signOut(auth);
    } catch {}
    toast.success('تم تسجيل الخروج بنجاح');
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      // Check if trying to mix stores
      if (prev.length > 0) {
        const firstStoreId = prev[0].product.ownerId || 'global';
        const newStoreId = product.ownerId || 'global';
        if (firstStoreId !== newStoreId) {
          toast.error("يرجى إتمام طلب المتجر الحالي أولاً أو تفريغ السلة، لا يمكن الجمع بين منتجات من متاجر مختلفة في طلب واحد.");
          return prev;
        }
      }

      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      toast.success("تمت الإضافة للسلة");
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  
  const isMasterAdmin = user?.email === '1ismaai0lll@gmail.com';
  const isAdmin = userData?.role === 'admin' || isMasterAdmin;
  const isStore = userData?.role === 'store';
  const userRole = userData?.role || null;
  const themeColor = settings?.storeTheme || 'green';

  const getThemeClasses = (type: 'bg' | 'text' | 'hover' | 'border' | 'bgLight' | 'textDark') => {
    switch (themeColor) {
      case 'blue':
        return { bg: 'bg-blue-600', text: 'text-blue-600', hover: 'hover:bg-blue-700', border: 'border-blue-600', bgLight: 'bg-blue-50', textDark: 'text-blue-700' }[type];
      case 'red':
        return { bg: 'bg-red-600', text: 'text-red-600', hover: 'hover:bg-red-700', border: 'border-red-600', bgLight: 'bg-red-50', textDark: 'text-red-700' }[type];
      case 'purple':
        return { bg: 'bg-purple-600', text: 'text-purple-600', hover: 'hover:bg-purple-700', border: 'border-purple-600', bgLight: 'bg-purple-50', textDark: 'text-purple-700' }[type];
      case 'orange':
        return { bg: 'bg-orange-600', text: 'text-orange-600', hover: 'hover:bg-orange-700', border: 'border-orange-600', bgLight: 'bg-orange-50', textDark: 'text-orange-700' }[type];
      case 'black':
        return { bg: 'bg-black', text: 'text-black', hover: 'hover:bg-gray-800', border: 'border-black', bgLight: 'bg-gray-100', textDark: 'text-gray-900' }[type];
      default:
        return { bg: 'bg-green-600', text: 'text-green-600', hover: 'hover:bg-green-700', border: 'border-green-600', bgLight: 'bg-green-50', textDark: 'text-green-700' }[type];
    }
  };

  const value = useMemo(() => ({ 
    user, 
    userData, 
    isAdmin, 
    isMasterAdmin, 
    isStore, 
    loading, 
    userRole, 
    settings, 
    settingsLoading, 
    isLoginModalOpen,
    loginModalInitialEmail,
    openLoginModal,
    closeLoginModal,
    login, 
    loginWithGoogle,
    loginWithOtp,
    logout, 
    cart, 
    addToCart, 
    removeFromCart, 
    clearCart, 
    cartTotal, 
    unreadCount, 
    markMessagesAsRead,
    globalStats, 
    getThemeClasses,
    isDarkMode,
    toggleDarkMode,
    getAuthHeaders
  }), [
    user, 
    userData, 
    isAdmin, 
    isMasterAdmin, 
    isStore, 
    loading, 
    userRole, 
    settings, 
    settingsLoading, 
    isLoginModalOpen,
    loginModalInitialEmail,
    cart, 
    unreadCount, 
    globalStats,
    getThemeClasses,
    isDarkMode
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
