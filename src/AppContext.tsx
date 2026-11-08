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

export type ThemeColor = 'green' | 'blue' | 'red' | 'black' | 'white';

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
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  registerWithStore: (email: string, name: string, password?: string, phone?: string, photoURL?: string) => Promise<{ success: boolean; message: string; user?: any; password?: string }>;
  updateUserProfile: (data: { name?: string; phone?: string; photoURL?: string }) => Promise<boolean>;
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
  effectiveTheme: ThemeColor;
  userTheme: ThemeColor | null;
  setUserTheme: (theme: ThemeColor) => Promise<void> | void;
  allowUserThemeOverride: boolean;
  getThemeClasses: (type: 'bg' | 'text' | 'hover' | 'border' | 'bgLight' | 'textDark' | 'badge' | 'ring' | 'gradient' | 'activeTab' | 'price' | 'pageBg' | 'cardBg' | 'headerBg' | 'verified') => string;
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
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.email?.toLowerCase() === '1ismaai0lll@gmail.com' || parsed.uid === 'u_32cd7332ee7ec2e0c1121512')) {
        parsed.uid = 'MQAwCYqFztd2PZbV1fRMxKRqoYX2';
        parsed.role = 'admin';
        localStorage.setItem('yemen_store_session', JSON.stringify(parsed));
      }
      return parsed;
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
  const [userTheme, setUserThemeState] = useState<ThemeColor | null>(() => {
    try {
      const saved = localStorage.getItem('user_preferred_theme');
      if (saved && ['green', 'blue', 'red', 'black', 'white'].includes(saved)) {
        return saved as ThemeColor;
      }
    } catch {}
    return null;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const prevUnreadCount = useRef(0);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({ totalVisitors: 0, totalRegistered: 0, onlineCount: 0, mainStoreLastSeen: null as string | null });

  const toggleDarkMode = () => {
    setIsDarkMode((prev: boolean) => !prev);
  };

  const allowUserThemeOverride = settings?.allowUserThemeOverride !== false;
  const rawAdminTheme = settings?.storeTheme || 'white';
  const adminTheme: ThemeColor = ['green', 'blue', 'red', 'black', 'white'].includes(rawAdminTheme)
    ? (rawAdminTheme as ThemeColor)
    : 'white';

  const effectiveTheme: ThemeColor = (allowUserThemeOverride && userTheme)
    ? userTheme
    : adminTheme;

  // When white theme is active, enforce light mode so dark slate backgrounds do not override the pure white style
  const effectiveIsDarkMode = effectiveTheme === 'white' ? false : isDarkMode;

  const setUserTheme = async (theme: ThemeColor) => {
    setUserThemeState(theme);
    try {
      localStorage.setItem('user_preferred_theme', theme);
      if (user) {
        const targetUid = (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' || user.uid === 'u_32cd7332ee7ec2e0c1121512')
          ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2'
          : user.uid;
        await setDoc(doc(db, 'users', targetUid), { preferredTheme: theme }, { merge: true }).catch(() => {});
      }
    } catch {}
  };

  // Sync user preferredTheme from userData if not set locally
  useEffect(() => {
    if (userData?.preferredTheme && ['green', 'blue', 'red', 'black', 'white'].includes(userData.preferredTheme)) {
      if (!userTheme) {
        setUserThemeState(userData.preferredTheme as ThemeColor);
        try {
          localStorage.setItem('user_preferred_theme', userData.preferredTheme);
        } catch {}
      }
    }
  }, [userData?.preferredTheme]);

  // Apply effective theme to document root and body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.body.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    if (effectiveIsDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    try {
      localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    } catch {}
  }, [effectiveIsDarkMode, isDarkMode]);

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

      const activeUid = (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' || user.uid === 'u_32cd7332ee7ec2e0c1121512')
        ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2'
        : user.uid;
      
      try {
        await setDoc(doc(db, 'users', activeUid), { 
          lastSeen: nowISO,
          isOnline: active 
        }, { merge: true });

        // Store/Admin profile update - throttled to 45 mins
        if ((userData?.role === 'store' || user.email?.toLowerCase() === '1ismaai0lll@gmail.com') && (now - (Number(sessionStorage.getItem('lastProfilePresence')) || 0) > 2700000)) {
          setDoc(doc(db, 'storeProfiles', activeUid), {
            lastSeen: nowISO
          }, { merge: true }).then(() => sessionStorage.setItem('lastProfilePresence', now.toString())).catch(() => {});
        }
        
        // Master admin global stats - throttled to 30 mins
        if (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' && (now - (Number(sessionStorage.getItem('lastGlobalPresence')) || 0) > 1800000)) {
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
        console.warn("Presence update notice:", err?.message);
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
  }, [user?.uid, user?.email]);

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

    // Calculate Online Count (Admin only sync) - real-time active users
    const updateOnlineCount = async () => {
      if (!auth.currentUser) return;
      try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60000).toISOString();
        const qOnline = query(collection(db, 'users'), where('lastSeen', '>=', tenMinutesAgo));
        const snap = await getDocs(qOnline);
        const count = Math.max(1, snap.size);
        
        updateDoc(doc(db, 'stats', 'global'), { onlineCount: count }).catch(() => {});
        setGlobalStats(prev => (prev.onlineCount !== count ? { ...prev, onlineCount: count } : prev));
      } catch (error) {
        console.warn("Notice updating online users count:", error);
      }
    };

    updateOnlineCount();
    const onlineInterval = setInterval(updateOnlineCount, 30000); // 30 seconds

    // Accurate total registered count update (Admin only sync)
    if (auth.currentUser) {
      getDocs(collection(db, 'users')).then(snap => {
        const count = snap.size;
        updateDoc(doc(db, 'stats', 'global'), { totalRegistered: count }).catch(() => {});
        setGlobalStats(prev => (prev.totalRegistered !== count ? { ...prev, totalRegistered: count } : prev));
      }).catch(() => {});
    }

    return () => {
      statsUnsubscribe();
      clearInterval(onlineInterval);
    };
  }, [user?.uid, user?.email, userData?.role]);

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
          setTimeout(() => {
            toast.success("لديك رسالة جديدة!", {
              icon: '💬',
              position: 'top-center'
            });
          }, 0);

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
  }, [user?.uid]);

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
        let authUser: any = currentUser;
        if (currentUser.email && currentUser.email.toLowerCase() === '1ismaai0lll@gmail.com') {
          authUser = {
            ...currentUser,
            uid: 'MQAwCYqFztd2PZbV1fRMxKRqoYX2',
            role: 'admin'
          };
        }
        setUser(authUser);
      } else {
        const saved = localStorage.getItem('yemen_store_session');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && (parsed.email?.toLowerCase() === '1ismaai0lll@gmail.com' || parsed.uid === 'u_32cd7332ee7ec2e0c1121512')) {
              parsed.uid = 'MQAwCYqFztd2PZbV1fRMxKRqoYX2';
              parsed.role = 'admin';
              localStorage.setItem('yemen_store_session', JSON.stringify(parsed));
            }
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
    const effectiveUid = (user.email && user.email.toLowerCase() === '1ismaai0lll@gmail.com') || user.uid === 'u_32cd7332ee7ec2e0c1121512' ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' : user.uid;
    const userDocRef = doc(db, 'users', effectiveUid);
    const unsubUser = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setLoading(false);

        // Keep session and local user in sync with Firestore data only if values actually changed
        if (data) {
          setUser((prev: any) => {
            if (!prev) return prev;
            const newName = data.name || prev.displayName;
            const newPhoto = data.photoURL !== undefined ? data.photoURL : (prev.photoURL || '');
            const newRole = data.role || prev.role;
            if (prev.displayName === newName && prev.photoURL === newPhoto && prev.role === newRole) {
              return prev;
            }
            const updated = {
              ...prev,
              displayName: newName,
              photoURL: newPhoto,
              role: newRole
            };
            try {
              localStorage.setItem('yemen_store_session', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }

        // Check for verification expiry if user is a store
        if (data.role === 'store') {
            getDoc(doc(db, 'storeProfiles', effectiveUid)).then(async (profileSnap) => {
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
                                        userId: effectiveUid,
                                        title: 'تنبيه: توثيق المتجر يقترب من الانتهاء',
                                        message: `سينتهي توثيق متجرك خلال ${diffDays} أيام (${expiryDate.toLocaleDateString('ar-YE')}). يرجى تجديد التوثيق لضمان استمرار ظهور علامتك الموثقة.`,
                                        type: 'verification_expiry',
                                        read: false,
                                        actionUrl: '/admin?tab=store-profile',
                                        createdAt: new Date().toISOString()
                                    });
                                    // Update last notified
                                    await updateDoc(doc(db, 'storeProfiles', effectiveUid), {
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
        // Prevent creating duplicate accounts if another document with this email already exists
        const normalizedEmail = (user.email || '').toLowerCase().trim();
        if (normalizedEmail) {
          try {
            const dupQuery = query(collection(db, 'users'), where('email', '==', normalizedEmail));
            const dupSnap = await getDocs(dupQuery);
            if (!dupSnap.empty) {
              const existingData = dupSnap.docs[0].data();
              setUserData(existingData);
              setLoading(false);
              return;
            }
          } catch {}
        }

        // Create user profile if it doesn't exist
        const isInitialAdmin = user.email && user.email.toLowerCase() === '1ismaai0lll@gmail.com';
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
  }, [user?.uid, user?.email]);

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
      const isMaster = data.user.email?.toLowerCase() === '1ismaai0lll@gmail.com';
      const sessionUser: AppUser = {
        uid: isMaster ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' : data.user.uid,
        email: data.user.email,
        displayName: data.user.name || data.user.email?.split('@')[0],
        photoURL: data.user.photoURL || '',
        role: isMaster ? 'admin' : data.user.role
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

  const loginWithPassword = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || 'فشل تسجيل الدخول');
        return false;
      }
      if (data.sessionToken) {
        localStorage.setItem('yemen_store_session_token', data.sessionToken);
      }
      const isMaster = data.user.email?.toLowerCase() === '1ismaai0lll@gmail.com';
      const sessionUser: AppUser = {
        uid: isMaster ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' : data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName || data.user.name || data.user.email?.split('@')[0],
        photoURL: data.user.photoURL || '',
        role: isMaster ? 'admin' : data.user.role
      };
      localStorage.setItem('yemen_store_session', JSON.stringify(sessionUser));
      setUser(sessionUser);
      setUserData(data.user);
      toast.success(data.message || 'تم تسجيل الدخول بنجاح');
      return true;
    } catch (err: any) {
      toast.error('تعذر الاتصال بالخادم: ' + (err?.message || 'خطأ غير معروف'));
      return false;
    }
  };

  const registerWithStore = async (
    email: string,
    name: string,
    password?: string,
    phone?: string,
    photoURL?: string
  ): Promise<{ success: boolean; message: string; user?: any; password?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, phone, photoURL, agreedToDisclaimer: true })
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || 'فشل إنشاء الحساب');
        return { success: false, message: data.message || 'فشل إنشاء الحساب' };
      }
      if (data.sessionToken) {
        localStorage.setItem('yemen_store_session_token', data.sessionToken);
      }
      if (data.user) {
        const isMaster = data.user.email?.toLowerCase() === '1ismaai0lll@gmail.com';
        const sessionUser: AppUser = {
          uid: isMaster ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' : data.user.uid,
          email: data.user.email,
          displayName: data.user.displayName || data.user.name || data.user.email?.split('@')[0],
          photoURL: data.user.photoURL || '',
          role: isMaster ? 'admin' : data.user.role
        };
        localStorage.setItem('yemen_store_session', JSON.stringify(sessionUser));
        setUser(sessionUser);
        setUserData(data.user);
      }
      return {
        success: true,
        message: data.message || 'تم إنشاء الحساب بنجاح',
        user: data.user,
        password: data.password
      };
    } catch (err: any) {
      toast.error('تعذر الاتصال بالخادم: ' + (err?.message || 'خطأ غير معروف'));
      return { success: false, message: err?.message || 'خطأ اتصال' };
    }
  };

  const updateUserProfile = async (updates: { name?: string; phone?: string; photoURL?: string }): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...updates })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUserData((prev: any) => ({ ...prev, ...data.user }));
        setUser((prev: any) => ({
          ...prev,
          displayName: data.user.displayName || data.user.name || prev?.displayName,
          photoURL: data.user.photoURL || prev?.photoURL
        }));
        const updatedSession = {
          ...user,
          displayName: data.user.displayName || data.user.name || user.displayName,
          photoURL: data.user.photoURL || user.photoURL
        };
        localStorage.setItem('yemen_store_session', JSON.stringify(updatedSession));
        return true;
      }
      return false;
    } catch {
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
    toast.success('تم تسجيل الخروج بنجاح', { id: 'auth-toast' });
  };

  const addToCart = (product: any) => {
    // Check if trying to mix stores
    if (cart.length > 0) {
      const firstStoreId = cart[0].product.ownerId || 'global';
      const newStoreId = product.ownerId || 'global';
      if (firstStoreId !== newStoreId) {
        toast.error("يرجى إتمام طلب المتجر الحالي أولاً أو تفريغ السلة، لا يمكن الجمع بين منتجات من متاجر مختلفة في طلب واحد.", { id: 'cart-error' });
        return;
      }
    }

    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart((prev) => [...prev, { product, quantity: 1 }]);
    }
    toast.success("تمت الإضافة للسلة", { id: 'cart-toast' });
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

  const getThemeClasses = (type: 'bg' | 'text' | 'hover' | 'border' | 'bgLight' | 'textDark' | 'badge' | 'ring' | 'gradient' | 'activeTab' | 'price' | 'pageBg' | 'cardBg' | 'headerBg' | 'verified'): string => {
    switch (effectiveTheme) {
      case 'blue':
        return {
          bg: 'bg-blue-600 text-white',
          text: 'text-blue-600 dark:text-blue-400',
          hover: 'hover:bg-blue-700',
          border: 'border-blue-600 dark:border-blue-500',
          bgLight: 'bg-blue-50 dark:bg-blue-950/40',
          textDark: 'text-blue-800 dark:text-blue-300',
          badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
          ring: 'focus:ring-blue-500 ring-blue-500',
          gradient: 'from-blue-600 to-indigo-700',
          activeTab: 'bg-blue-600 text-white shadow-blue-600/30 ring-blue-400/30',
          price: 'text-blue-600 dark:text-blue-400',
          pageBg: 'bg-[#f4f7fb] dark:bg-[#030712]',
          cardBg: 'bg-white dark:bg-[#0b1329] border-blue-100/70 dark:border-blue-900/40',
          headerBg: 'bg-white/95 dark:bg-[#070e1e]/95 border-blue-100 dark:border-blue-950',
          verified: 'text-blue-500 fill-white'
        }[type] || 'bg-blue-600 text-white';

      case 'red':
        return {
          bg: 'bg-rose-600 text-white',
          text: 'text-rose-600 dark:text-rose-400',
          hover: 'hover:bg-rose-700',
          border: 'border-rose-600 dark:border-rose-500',
          bgLight: 'bg-rose-50 dark:bg-rose-950/40',
          textDark: 'text-rose-800 dark:text-rose-300',
          badge: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
          ring: 'focus:ring-rose-500 ring-rose-500',
          gradient: 'from-rose-600 to-red-700',
          activeTab: 'bg-rose-600 text-white shadow-rose-600/30 ring-rose-400/30',
          price: 'text-rose-600 dark:text-rose-400',
          pageBg: 'bg-[#fff5f6] dark:bg-[#0f0507]',
          cardBg: 'bg-white dark:bg-[#180a0e] border-rose-100/70 dark:border-rose-900/40',
          headerBg: 'bg-white/95 dark:bg-[#13060a]/95 border-rose-100 dark:border-rose-950',
          verified: 'text-rose-500 fill-white'
        }[type] || 'bg-rose-600 text-white';

      case 'black':
        return {
          bg: 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950',
          text: 'text-zinc-950 dark:text-zinc-100',
          hover: 'hover:bg-zinc-800 dark:hover:bg-zinc-200',
          border: 'border-zinc-900 dark:border-zinc-700',
          bgLight: 'bg-zinc-100 dark:bg-zinc-900',
          textDark: 'text-zinc-950 dark:text-zinc-100',
          badge: 'bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700',
          ring: 'focus:ring-zinc-900 ring-zinc-900',
          gradient: 'from-zinc-950 via-zinc-900 to-black',
          activeTab: 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-zinc-950/30 ring-zinc-700/30',
          price: 'text-zinc-950 dark:text-zinc-100',
          pageBg: 'bg-[#f4f4f5] dark:bg-[#050505]',
          cardBg: 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-zinc-800',
          headerBg: 'bg-white/95 dark:bg-[#09090b]/95 border-zinc-200 dark:border-zinc-800',
          verified: 'text-zinc-900 dark:text-zinc-100 fill-white'
        }[type] || 'bg-zinc-950 text-white';

      case 'white':
        return {
          bg: 'bg-black text-white hover:bg-neutral-800 shadow-sm active:scale-98',
          text: 'text-black',
          hover: 'hover:bg-neutral-800',
          border: 'border-neutral-300',
          bgLight: 'bg-neutral-100 border border-neutral-200/80',
          textDark: 'text-black font-black',
          badge: 'bg-neutral-100 text-black border-neutral-300 shadow-xs font-black',
          ring: 'focus:ring-black ring-black',
          gradient: 'from-neutral-900 to-black',
          activeTab: 'bg-black text-white shadow-neutral-900/30 ring-neutral-400/30',
          price: 'text-black font-black',
          pageBg: 'bg-white',
          cardBg: 'bg-white border-neutral-200/90 shadow-sm',
          headerBg: 'bg-white/95 border-neutral-200/90 shadow-xs',
          verified: 'text-emerald-600 fill-white'
        }[type] || 'bg-black text-white';

      case 'green':
      default:
        return {
          bg: 'bg-emerald-600 text-white',
          text: 'text-emerald-600 dark:text-emerald-400',
          hover: 'hover:bg-emerald-700',
          border: 'border-emerald-600 dark:border-emerald-500',
          bgLight: 'bg-emerald-50 dark:bg-emerald-950/40',
          textDark: 'text-emerald-800 dark:text-emerald-300',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
          ring: 'focus:ring-emerald-500 ring-emerald-500',
          gradient: 'from-emerald-600 to-teal-700',
          activeTab: 'bg-emerald-600 text-white shadow-emerald-600/30 ring-emerald-400/30',
          price: 'text-emerald-600 dark:text-emerald-400',
          pageBg: 'bg-[#f2f9f5] dark:bg-[#02130b]',
          cardBg: 'bg-white dark:bg-[#072216] border-emerald-100/70 dark:border-emerald-900/40',
          headerBg: 'bg-white/95 dark:bg-[#041a0f]/95 border-emerald-100 dark:border-emerald-950',
          verified: 'text-emerald-600 fill-white'
        }[type] || 'bg-emerald-600 text-white';
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
    loginWithPassword,
    registerWithStore,
    updateUserProfile,
    logout, 
    cart, 
    addToCart, 
    removeFromCart, 
    clearCart, 
    cartTotal, 
    unreadCount, 
    markMessagesAsRead,
    globalStats, 
    effectiveTheme,
    userTheme,
    setUserTheme,
    allowUserThemeOverride,
    getThemeClasses,
    isDarkMode: effectiveIsDarkMode,
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
    effectiveTheme,
    userTheme,
    allowUserThemeOverride,
    getThemeClasses,
    effectiveIsDarkMode
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
