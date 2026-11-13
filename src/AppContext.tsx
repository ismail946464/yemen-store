import { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
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
  isDelivery: boolean;
  loading: boolean;
  userRole: 'user' | 'store' | 'admin' | 'delivery' | null;
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
  changePassword: (newPassword: string, currentPassword?: string, targetEmail?: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  cart: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
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
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('yemen_store_cart_v1');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('yemen_store_cart_v1', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const [settings, setSettings] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userTheme, setUserThemeState] = useState<ThemeColor | null>(() => {
    try {
      const resetDone = localStorage.getItem('default_white_theme_v1');
      if (!resetDone) {
        localStorage.setItem('user_preferred_theme', 'white');
        localStorage.setItem('isDarkMode', JSON.stringify(false));
        localStorage.setItem('default_white_theme_v1', 'true');
        return 'white';
      }
      const saved = localStorage.getItem('user_preferred_theme');
      if (saved && ['green', 'blue', 'red', 'black', 'white'].includes(saved)) {
        return saved as ThemeColor;
      }
    } catch {}
    return 'white';
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const resetDone = localStorage.getItem('default_white_theme_v1');
      if (!resetDone) return false;
      const savedTheme = localStorage.getItem('user_preferred_theme');
      if (savedTheme === 'white') return false;
      const saved = localStorage.getItem('isDarkMode');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const prevUnreadCount = useRef(0);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({ totalVisitors: 0, totalRegistered: 0, onlineCount: 0, mainStoreLastSeen: null as string | null });

  const toggleDarkMode = () => {
    if (effectiveTheme === 'white') {
      toast('الستايل الأبيض النقي مفعل افتراضياً', { icon: '⚪' });
      return;
    }
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

  // When white theme is active, strictly enforce light mode so dark slate backgrounds do not override the pure white style
  const effectiveIsDarkMode = effectiveTheme === 'white' ? false : isDarkMode;

  const setUserTheme = async (theme: ThemeColor) => {
    setUserThemeState(theme);
    if (theme === 'white') {
      setIsDarkMode(false);
      try {
        localStorage.setItem('isDarkMode', JSON.stringify(false));
      } catch {}
    }
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

    // Calculate Online Count (Admin only sync) - throttled & skips hidden tabs
    const updateOnlineCount = async () => {
      if (!auth.currentUser || document.hidden) return;
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
    const onlineInterval = setInterval(updateOnlineCount, 180000); // 3 minutes

    // Sync total registered count at most once per session to avoid redundant full-collection scans
    if (auth.currentUser && !sessionStorage.getItem('synced_user_count_v1')) {
      sessionStorage.setItem('synced_user_count_v1', '1');
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

  const changePassword = async (
    newPassword: string,
    currentPassword?: string,
    targetEmail?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'يرجى تسجيل الدخول أولاً' };
    }
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          email: targetEmail || user.email,
          newPassword: newPassword.trim(),
          currentPassword: currentPassword?.trim() || undefined
        })
      });
      const data = await res.json();
      return {
        success: Boolean(data?.success),
        message: data?.message || (data?.success ? 'تم تغيير كلمة المرور بنجاح' : 'فشل تغيير كلمة المرور')
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'تعذر الاتصال بالخادم: ' + (err?.message || 'خطأ غير معروف')
      };
    }
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

  const addToCart = useCallback((product: any) => {
    setCart((prev) => {
      if (prev.length > 0) {
        const firstStoreId = prev[0].product.ownerId || 'global';
        const newStoreId = product.ownerId || 'global';
        if (firstStoreId !== newStoreId) {
          toast.error("يرجى إتمام طلب المتجر الحالي أولاً أو تفريغ السلة، لا يمكن الجمع بين منتجات من متاجر مختلفة في طلب واحد.", { id: 'cart-error' });
          return prev;
        }
      }

      const existing = prev.find((item) => item.product.id === product.id);
      toast.success("تمت الإضافة للسلة", { id: 'cart-toast' });
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.product.id !== productId);
      }
      return prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );
    });
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + ((Number(item.product.price) || 0) * item.quantity), 0), [cart]);
  
  const isMasterAdmin = user?.email === '1ismaai0lll@gmail.com';
  const isAdmin = userData?.role === 'admin' || isMasterAdmin;
  const isStore = userData?.role === 'store';
  const isDelivery = userData?.role === 'delivery';
  const userRole = userData?.role || null;

  const getThemeClasses = useCallback((type: 'bg' | 'text' | 'hover' | 'border' | 'bgLight' | 'textDark' | 'badge' | 'ring' | 'gradient' | 'activeTab' | 'price' | 'pageBg' | 'cardBg' | 'headerBg' | 'verified'): string => {
    switch (effectiveTheme) {
      case 'blue':
        return {
          bg: 'bg-[#1D4ED8] text-white dark:bg-[#3B82F6] dark:text-white',
          text: 'text-[#1D4ED8] dark:text-[#60A5FA]',
          hover: 'hover:bg-[#1E40AF] dark:hover:bg-[#2563EB]',
          border: 'border-[#1D4ED8] dark:border-[#3B82F6]',
          bgLight: 'bg-[#EEF2FA] dark:bg-[#101D38]',
          textDark: 'text-[#1E3A8A] dark:text-[#93C5FD]',
          badge: 'bg-[#EEF2FA] text-[#1E40AF] border-[#D7E0F4] dark:bg-[#101D38] dark:text-[#93C5FD] dark:border-[#1E325C]',
          ring: 'focus:ring-[#1D4ED8] ring-[#1D4ED8]',
          gradient: 'from-[#10131A] to-[#1D4ED8]',
          activeTab: 'bg-[#1D4ED8] text-white dark:bg-[#3B82F6]',
          price: 'text-[#1D4ED8] dark:text-[#60A5FA]',
          pageBg: 'bg-[#F5F6F9] dark:bg-[#070A12]',
          cardBg: 'bg-white dark:bg-[#0F1422] border-[#E1E5EF] dark:border-[#1E273D]',
          headerBg: 'bg-[#FFFFFF]/95 dark:bg-[#070A12]/95 border-[#E1E5EF] dark:border-[#1E273D]',
          verified: 'text-[#1D4ED8] dark:text-[#60A5FA]'
        }[type] || 'bg-[#1D4ED8] text-white';

      case 'red':
        return {
          bg: 'bg-[#BE123C] text-white dark:bg-[#F43F5E] dark:text-white',
          text: 'text-[#BE123C] dark:text-[#FB7185]',
          hover: 'hover:bg-[#9F1239] dark:hover:bg-[#E11D48]',
          border: 'border-[#BE123C] dark:border-[#F43F5E]',
          bgLight: 'bg-[#FAF0F2] dark:bg-[#2B0F17]',
          textDark: 'text-[#881337] dark:text-[#FDA4AF]',
          badge: 'bg-[#FAF0F2] text-[#9F1239] border-[#EBD5DB] dark:bg-[#2B0F17] dark:text-[#FDA4AF] dark:border-[#4C1D2A]',
          ring: 'focus:ring-[#BE123C] ring-[#BE123C]',
          gradient: 'from-[#171113] to-[#BE123C]',
          activeTab: 'bg-[#BE123C] text-white dark:bg-[#F43F5E]',
          price: 'text-[#BE123C] dark:text-[#FB7185]',
          pageBg: 'bg-[#F8F5F6] dark:bg-[#11080B]',
          cardBg: 'bg-white dark:bg-[#1A0F13] border-[#ECE1E4] dark:border-[#331C23]',
          headerBg: 'bg-[#FFFFFF]/95 dark:bg-[#11080B]/95 border-[#ECE1E4] dark:border-[#331C23]',
          verified: 'text-[#BE123C] dark:text-[#FB7185]'
        }[type] || 'bg-[#BE123C] text-white';

      case 'black':
        return {
          bg: 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950',
          text: 'text-zinc-950 dark:text-zinc-100',
          hover: 'hover:bg-zinc-800 dark:hover:bg-zinc-200',
          border: 'border-zinc-900 dark:border-zinc-200',
          bgLight: 'bg-zinc-100 dark:bg-zinc-900',
          textDark: 'text-zinc-950 dark:text-zinc-100',
          badge: 'bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800',
          ring: 'focus:ring-zinc-900 ring-zinc-900',
          gradient: 'from-zinc-950 to-zinc-800',
          activeTab: 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950',
          price: 'text-zinc-950 dark:text-zinc-50',
          pageBg: 'bg-[#F5F5F5] dark:bg-[#09090B]',
          cardBg: 'bg-white dark:bg-[#121215] border-zinc-200 dark:border-zinc-800',
          headerBg: 'bg-white/95 dark:bg-[#09090B]/95 border-zinc-200 dark:border-zinc-800',
          verified: 'text-zinc-900 dark:text-zinc-100'
        }[type] || 'bg-zinc-950 text-white';

      case 'white':
        return {
          bg: 'bg-[#111214] text-white dark:bg-[#F4F4F2] dark:text-[#111214]',
          text: 'text-[#111214] dark:text-[#F4F4F2]',
          hover: 'hover:bg-[#24262B] dark:hover:bg-[#E4E4E0]',
          border: 'border-[#D5D1C7] dark:border-[#343A46]',
          bgLight: 'bg-[#EFEDE6] dark:bg-[#1C1F26]',
          textDark: 'text-[#111214] dark:text-[#F4F4F2]',
          badge: 'bg-[#EFEDE6] text-[#111214] border-[#E5E2DA] dark:bg-[#1C1F26] dark:text-[#F4F4F2] dark:border-[#2C313C]',
          ring: 'focus:ring-[#111214] ring-[#111214]',
          gradient: 'from-[#111214] to-[#272A30]',
          activeTab: 'bg-[#111214] text-white dark:bg-[#F4F4F2] dark:text-[#111214]',
          price: 'text-[#111214] dark:text-[#F4F4F2]',
          pageBg: 'bg-[#F6F5F0] dark:bg-[#0A0B0D]',
          cardBg: 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730]',
          headerBg: 'bg-[#F6F5F0]/95 dark:bg-[#0A0B0D]/95 border-[#E5E2DA] dark:border-[#232730]',
          verified: 'text-[#0D6E4E] dark:text-[#10B981]'
        }[type] || 'bg-[#111214] text-white';

      case 'green':
      default:
        return {
          bg: 'bg-[#0D6E4E] text-white dark:bg-[#10B981] dark:text-[#04120C]',
          text: 'text-[#0D6E4E] dark:text-[#34D399]',
          hover: 'hover:bg-[#09583E] dark:hover:bg-[#059669]',
          border: 'border-[#0D6E4E] dark:border-[#10B981]',
          bgLight: 'bg-[#EBF5F0] dark:bg-[#0D2B20]',
          textDark: 'text-[#084C36] dark:text-[#6EE7B7]',
          badge: 'bg-[#EBF5F0] text-[#084C36] border-[#CFE5D9] dark:bg-[#0D2B20] dark:text-[#6EE7B7] dark:border-[#194A37]',
          ring: 'focus:ring-[#0D6E4E] ring-[#0D6E4E]',
          gradient: 'from-[#09241B] to-[#0D6E4E]',
          activeTab: 'bg-[#0D6E4E] text-white dark:bg-[#10B981] dark:text-[#04120C]',
          price: 'text-[#0D6E4E] dark:text-[#34D399]',
          pageBg: 'bg-[#F5F7F5] dark:bg-[#07100C]',
          cardBg: 'bg-white dark:bg-[#0F1A15] border-[#DFE7E1] dark:border-[#1D3329]',
          headerBg: 'bg-[#FFFFFF]/95 dark:bg-[#07100C]/95 border-[#DFE7E1] dark:border-[#1D3329]',
          verified: 'text-[#0D6E4E] dark:text-[#34D399]'
        }[type] || 'bg-[#0D6E4E] text-white';
    }
  }, [effectiveTheme]);

  const value = useMemo(() => ({ 
    user, 
    userData, 
    isAdmin, 
    isMasterAdmin, 
    isStore, 
    isDelivery,
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
    changePassword,
    logout, 
    cart, 
    addToCart, 
    removeFromCart, 
    updateCartQuantity,
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
    isDelivery,
    loading, 
    userRole, 
    settings, 
    settingsLoading, 
    isLoginModalOpen,
    loginModalInitialEmail,
    cart, 
    cartTotal,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
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
