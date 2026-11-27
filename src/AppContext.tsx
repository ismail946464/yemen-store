import { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, getCountFromServer, increment, updateDoc, addDoc, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';
import { getStockLimit, isItemOutOfStock } from './lib/stockUtils';
import { expireDeliveryFeeProposalTransaction } from './lib/deliveryFeeUtils';
import { expireReservationTransaction, isStorePickupOnlyProduct } from './lib/reservationUtils';
import { StatsResetConfig, getLocalDateKey } from './lib/statsReportUtils';
import {
  safeLocalGet,
  safeLocalSet,
  safeLocalRemove,
  safeSessionGet,
  safeSessionSet,
  requestNotificationPermissionSafely,
  showBrowserNotificationSafely,
  formatArabicDate
} from './lib/deviceSafe';
import { ThemeColor, VALID_THEME_IDS } from './lib/storeStyles';
export type { ThemeColor };

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
  addToCart: (product: any, quantityToAdd?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  syncCartItemStock: (productKey: string, patch: { stock?: number | null; available?: boolean; price?: number; noDelivery?: boolean }) => void;
  clearCart: () => void;
  cartTotal: number;
  unreadCount: number;
  markMessagesAsRead: () => Promise<void>;
  settingsLoading: boolean;
  globalStats: {
    totalVisitors: number;
    totalRegistered: number;
    onlineCount: number;
    mainStoreLastSeen: string | null;
    dailyVisits: Record<string, number>;
    statsReset: StatsResetConfig | null;
  };
  effectiveTheme: ThemeColor;
  userTheme: ThemeColor | null;
  setUserTheme: (theme: ThemeColor) => Promise<void> | void;
  allowUserThemeOverride: boolean;
  getThemeClasses: (type: 'bg' | 'text' | 'hover' | 'border' | 'bgLight' | 'textDark' | 'badge' | 'ring' | 'gradient' | 'activeTab' | 'price' | 'pageBg' | 'cardBg' | 'headerBg' | 'verified') => string;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  favoriteIds: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  recentlyViewedIds: string[];
  recordRecentlyViewed: (productId: string) => void;
  isCartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  followedStoreIds: string[];
  toggleFollowStore: (storeId: string, storeName?: string) => void;
  isFollowingStore: (storeId: string) => boolean;
  isSearchPaletteOpen: boolean;
  openSearchPalette: () => void;
  closeSearchPalette: () => void;
  isAiDrawerOpen: boolean;
  aiDrawerInitialQuery: string;
  openAiDrawer: (initialQuery?: string) => void;
  closeAiDrawer: () => void;
}

export interface CartItem {
  product: any;
  quantity: number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | AppUser | null>(() => {
    try {
      const saved = safeLocalGet('yemen_store_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.email?.toLowerCase() === '1ismaai0lll@gmail.com' || parsed.uid === 'u_32cd7332ee7ec2e0c1121512')) {
        parsed.uid = 'MQAwCYqFztd2PZbV1fRMxKRqoYX2';
        parsed.role = 'admin';
        safeLocalSet('yemen_store_session', JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalInitialEmail, setLoginModalInitialEmail] = useState('');
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const openCartDrawer = useCallback(() => setIsCartDrawerOpen(true), []);
  const closeCartDrawer = useCallback(() => setIsCartDrawerOpen(false), []);
  const [isSearchPaletteOpen, setIsSearchPaletteOpen] = useState(false);
  const openSearchPalette = useCallback(() => setIsSearchPaletteOpen(true), []);
  const closeSearchPalette = useCallback(() => setIsSearchPaletteOpen(false), []);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiDrawerInitialQuery, setAiDrawerInitialQuery] = useState('');
  const openAiDrawer = useCallback((initialQuery?: string) => {
    setAiDrawerInitialQuery(typeof initialQuery === 'string' ? initialQuery.trim() : '');
    setIsAiDrawerOpen(true);
  }, []);
  const closeAiDrawer = useCallback(() => {
    setIsAiDrawerOpen(false);
  }, []);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = safeLocalGet('yemen_store_cart_v1');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });
  const cartRef = useRef<CartItem[]>(cart);
  const didMountCartRef = useRef(false);

  useEffect(() => {
    cartRef.current = cart;
    if (!didMountCartRef.current) {
      didMountCartRef.current = true;
      return;
    }
    safeLocalSet('yemen_store_cart_v1', JSON.stringify(cart));
  }, [cart]);

  const [settings, setSettings] = useState<any | null>(() => {
    try {
      const cached = safeLocalGet('yemen_store_settings_cache_v1');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (parsed && (!parsed.storeName || String(parsed.storeName).trim() === 'يمن ستور')) {
        parsed.storeName = 'متجر محيط';
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [userTheme, setUserThemeState] = useState<ThemeColor | null>(() => {
    try {
      const resetDone = safeLocalGet('default_white_theme_v1');
      if (!resetDone) {
        safeLocalSet('user_preferred_theme', 'white');
        safeLocalSet('isDarkMode', JSON.stringify(false));
        safeLocalSet('default_white_theme_v1', 'true');
        return 'white';
      }
      const saved = safeLocalGet('user_preferred_theme');
      if (saved && VALID_THEME_IDS.includes(saved as ThemeColor)) {
        return saved as ThemeColor;
      }
    } catch {}
    return 'white';
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const resetDone = safeLocalGet('default_white_theme_v1');
      if (!resetDone) return false;
      const savedTheme = safeLocalGet('user_preferred_theme');
      if (savedTheme === 'white') return false;
      const saved = safeLocalGet('isDarkMode');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const prevUnreadCount = useRef(0);
  const [settingsLoading, setSettingsLoading] = useState(() => !safeLocalGet('yemen_store_settings_cache_v1'));
  const [globalStats, setGlobalStats] = useState<{
    totalVisitors: number;
    totalRegistered: number;
    onlineCount: number;
    mainStoreLastSeen: string | null;
    dailyVisits: Record<string, number>;
    statsReset: StatsResetConfig | null;
  }>({
    totalVisitors: 0,
    totalRegistered: 0,
    onlineCount: 0,
    mainStoreLastSeen: null,
    dailyVisits: {},
    statsReset: null
  });

  const toggleDarkMode = useCallback(() => {
    const canOverride = settings?.allowUserThemeOverride !== false;
    const rawTheme = settings?.storeTheme || 'white';
    const currentAdminTheme = VALID_THEME_IDS.includes(rawTheme) ? rawTheme : 'white';
    const currentEffective = canOverride && userTheme ? userTheme : currentAdminTheme;
    if (currentEffective === 'white') {
      toast('الستايل الأبيض النقي مفعل افتراضياً', { icon: '⚪' });
      return;
    }
    setIsDarkMode((prev: boolean) => !prev);
  }, [settings?.allowUserThemeOverride, settings?.storeTheme, userTheme]);

  const allowUserThemeOverride = settings?.allowUserThemeOverride !== false;
  const rawAdminTheme = settings?.storeTheme || 'white';
  const adminTheme: ThemeColor = VALID_THEME_IDS.includes(rawAdminTheme)
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
      safeLocalSet('isDarkMode', JSON.stringify(false));
    }
    try {
      safeLocalSet('user_preferred_theme', theme);
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
    if (userData?.preferredTheme && VALID_THEME_IDS.includes(userData.preferredTheme as ThemeColor)) {
      if (!userTheme) {
        setUserThemeState(userData.preferredTheme as ThemeColor);
        safeLocalSet('user_preferred_theme', userData.preferredTheme);
      }
    }
  }, [userData?.preferredTheme]);

  // Favorites (Wishlist) & Recently Viewed Products
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = safeLocalGet('yemen_store_favorites_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, 200) : [];
      }
    } catch {}
    return [];
  });
  const favoriteIdsRef = useRef<string[]>(favoriteIds);
  useEffect(() => {
    favoriteIdsRef.current = favoriteIds;
  }, [favoriteIds]);

  useEffect(() => {
    if (Array.isArray(userData?.favorites)) {
      const remote = userData.favorites.filter((x: unknown) => typeof x === 'string').slice(0, 200) as string[];
      const merged = Array.from(new Set([...remote, ...favoriteIdsRef.current])).slice(0, 200);
      const curr = favoriteIdsRef.current;
      if (merged.length === curr.length && merged.every((id, idx) => id === curr[idx])) {
        return;
      }
      favoriteIdsRef.current = merged;
      setFavoriteIds(merged);
      safeLocalSet('yemen_store_favorites_v1', JSON.stringify(merged));
    }
  }, [userData?.favorites]);

  const toggleFavorite = useCallback((productId: string) => {
    if (!productId) return;
    const prev = favoriteIdsRef.current;
    const exists = prev.includes(productId);
    const next = exists
      ? prev.filter((id) => id !== productId)
      : [productId, ...prev].slice(0, 200);
    favoriteIdsRef.current = next;
    setFavoriteIds(next);
    safeLocalSet('yemen_store_favorites_v1', JSON.stringify(next));
    if (user) {
      const targetUid = (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' || user.uid === 'u_32cd7332ee7ec2e0c1121512')
        ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2'
        : user.uid;
      setDoc(doc(db, 'users', targetUid), { favorites: next }, { merge: true }).catch(() => {});
    }
    toast.success(exists ? 'تمت الإزالة من المفضلة' : 'تم الحفظ في المفضلة', { id: 'fav-toggle' });
  }, [user]);

  const isFavorite = useCallback((productId: string) => favoriteIds.includes(productId), [favoriteIds]);

  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const saved = safeLocalGet('yemen_store_recently_viewed_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, 12) : [];
      }
    } catch {}
    return [];
  });
  const recentlyViewedIdsRef = useRef<string[]>(recentlyViewedIds);
  useEffect(() => {
    recentlyViewedIdsRef.current = recentlyViewedIds;
  }, [recentlyViewedIds]);

  const recordRecentlyViewed = useCallback((productId: string) => {
    if (!productId) return;
    const next = [productId, ...recentlyViewedIdsRef.current.filter((id) => id !== productId)].slice(0, 12);
    recentlyViewedIdsRef.current = next;
    setRecentlyViewedIds(next);
    safeLocalSet('yemen_store_recently_viewed_v1', JSON.stringify(next));
  }, []);

  const [followedStoreIds, setFollowedStoreIds] = useState<string[]>(() => {
    try {
      safeLocalRemove('yemen_store_compare_v1');
      const saved = safeLocalGet('yemen_store_followed_stores_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, 200) : [];
      }
    } catch {}
    return [];
  });
  const followedStoreIdsRef = useRef<string[]>(followedStoreIds);
  useEffect(() => {
    followedStoreIdsRef.current = followedStoreIds;
  }, [followedStoreIds]);

  useEffect(() => {
    if (Array.isArray(userData?.followedStores)) {
      const remote = userData.followedStores.filter((x: unknown) => typeof x === 'string').slice(0, 200) as string[];
      const merged = Array.from(new Set([...remote, ...followedStoreIdsRef.current])).slice(0, 200);
      const curr = followedStoreIdsRef.current;
      if (merged.length === curr.length && merged.every((id, idx) => id === curr[idx])) {
        return;
      }
      followedStoreIdsRef.current = merged;
      setFollowedStoreIds(merged);
      safeLocalSet('yemen_store_followed_stores_v1', JSON.stringify(merged));
    }
  }, [userData?.followedStores]);

  const toggleFollowStore = useCallback((storeId: string, storeName?: string) => {
    if (!storeId) return;
    const prev = followedStoreIdsRef.current;
    const exists = prev.includes(storeId);
    const next = exists
      ? prev.filter((id) => id !== storeId)
      : [storeId, ...prev].slice(0, 200);
    followedStoreIdsRef.current = next;
    setFollowedStoreIds(next);
    safeLocalSet('yemen_store_followed_stores_v1', JSON.stringify(next));
    if (user) {
      const targetUid = (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' || user.uid === 'u_32cd7332ee7ec2e0c1121512')
        ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2'
        : user.uid;
      setDoc(doc(db, 'users', targetUid), { followedStores: next }, { merge: true }).catch(() => {});
    }
    toast.success(
      exists
        ? `تم إلغاء متابعة ${storeName || 'المتجر'}`
        : `تتابع الآن ${storeName || 'المتجر'}`,
      { id: 'follow-store-toggle' }
    );
  }, [user]);

  const isFollowingStore = useCallback(
    (storeId: string) => followedStoreIds.includes(storeId),
    [followedStoreIds]
  );

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
    safeLocalSet('isDarkMode', JSON.stringify(isDarkMode));
  }, [effectiveIsDarkMode, isDarkMode]);

  // Visitor increment
    useEffect(() => {
        const hasVisited = safeSessionGet('visited_v2');
        if (!hasVisited) {
            const statsRef = doc(db, 'stats', 'global');
            const todayKey = getLocalDateKey();
            getDoc(statsRef).then(snap => {
                if (snap.exists()) {
                   updateDoc(statsRef, {
                     totalVisitors: increment(1),
                     [`dailyVisits.${todayKey}`]: increment(1)
                   })
                     .then(() => safeSessionSet('visited_v2', 'true'))
                     .catch(e => {
                       if (e.code === 'resource-exhausted') safeSessionSet('visited_v2', 'true');
                     });
                } else {
                   setDoc(statsRef, {
                     totalVisitors: 1,
                     dailyVisits: { [todayKey]: 1 }
                   })
                     .then(() => safeSessionSet('visited_v2', 'true'))
                     .catch(() => {});
                }
            }).catch(() => {});
        }
    }, []);

  const lastPresenceUpdateRef = useRef<number>(Number(safeSessionGet('lastPresenceTime')) || 0);
  const initialMessageIds = useRef<Set<string>>(new Set());
  const isInitialMessagesLoaded = useRef(false);

  // Presence / Last Seen System
  useEffect(() => {
    if (!user) return;

    const updatePresence = async (active: boolean) => {
      if (!user) return;
      const now = Date.now();
      
      // Throttle: don't update more than once every 5 minutes (aligned with 10m online window)
      if (now - lastPresenceUpdateRef.current < 300000) return;
      
      const nowISO = new Date(now).toISOString();
      lastPresenceUpdateRef.current = now;
      safeSessionSet('lastPresenceTime', now.toString());

      const activeUid = (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' || user.uid === 'u_32cd7332ee7ec2e0c1121512')
        ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2'
        : user.uid;
      
      try {
        await setDoc(doc(db, 'users', activeUid), { 
          lastSeen: nowISO,
          isOnline: active 
        }, { merge: true });

        // Store/Admin profile update - throttled to 45 mins
        if ((userData?.role === 'store' || user.email?.toLowerCase() === '1ismaai0lll@gmail.com') && (now - (Number(safeSessionGet('lastProfilePresence')) || 0) > 2700000)) {
          setDoc(doc(db, 'storeProfiles', activeUid), {
            lastSeen: nowISO
          }, { merge: true }).then(() => safeSessionSet('lastProfilePresence', now.toString())).catch(() => {});
        }
        
        // Master admin global stats - throttled to 30 mins
        if (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' && (now - (Number(safeSessionGet('lastGlobalPresence')) || 0) > 1800000)) {
           setDoc(doc(db, 'stats', 'global'), { 
             mainStoreLastSeen: nowISO 
           }, { merge: true })
           .then(() => safeSessionSet('lastGlobalPresence', now.toString()))
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
    const interval = setInterval(() => updatePresence(true), 300000); // 5m heartbeat
    
    // Activity tracking - only update presence on activity if it's been 5m+
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastPresenceUpdateRef.current > 300000) {
        updatePresence(true);
      }
    };
    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      // Do NOT reset throttle here to prevent tab-switching write bombs
      updatePresence(isVisible);
    };

    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('keypress', handleActivity, { passive: true });
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
        const nextVisitors = data.totalVisitors || 0;
        const nextRegistered = data.totalRegistered || 0;
        const nextOnline = data.onlineCount || 0;
        const nextLastSeen = data.mainStoreLastSeen || null;
        const nextDailyVisits = (data.dailyVisits && typeof data.dailyVisits === 'object') ? data.dailyVisits : {};
        const nextStatsReset = data.statsReset || null;
        const todayKey = getLocalDateKey();
        setGlobalStats(prev => {
          if (
            prev.totalVisitors === nextVisitors &&
            prev.totalRegistered === nextRegistered &&
            prev.onlineCount === nextOnline &&
            prev.mainStoreLastSeen === nextLastSeen &&
            prev.dailyVisits?.[todayKey] === nextDailyVisits?.[todayKey] &&
            JSON.stringify(prev.statsReset) === JSON.stringify(nextStatsReset) &&
            Object.keys(prev.dailyVisits).length === Object.keys(nextDailyVisits).length
          ) {
            return prev;
          }
          return {
            ...prev,
            totalVisitors: nextVisitors,
            totalRegistered: nextRegistered,
            onlineCount: nextOnline,
            mainStoreLastSeen: nextLastSeen,
            dailyVisits: nextDailyVisits,
            statsReset: nextStatsReset
          };
        });
      }
    }, (error) => {
      console.warn('Global stats listener notice (handled):', (error as any)?.message);
    });

    // ONLY the master admin or main admins should calculate and sync these values to global stats
    // Store owners will just listen to the results from the global doc
    const isMasterAdminUser = user?.email === '1ismaai0lll@gmail.com' || userData?.role === 'admin';
    
    if (!isMasterAdminUser || !auth.currentUser) return () => statsUnsubscribe();

    // Calculate Online Count (Admin only sync) - uses getCountFromServer to avoid downloading user docs/avatars
    const updateOnlineCount = async () => {
      if (!auth.currentUser || document.hidden) return;
      try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60000).toISOString();
        const qOnline = query(collection(db, 'users'), where('lastSeen', '>=', tenMinutesAgo));
        const countSnap = await getCountFromServer(qOnline);
        const count = countSnap.data().count;
        
        updateDoc(doc(db, 'stats', 'global'), { onlineCount: count }).catch(() => {});
        setGlobalStats(prev => (prev.onlineCount !== count ? { ...prev, onlineCount: count } : prev));
      } catch (error) {
        console.warn("Notice updating online users count:", error);
      }
    };

    updateOnlineCount();
    const onlineInterval = setInterval(updateOnlineCount, 180000); // 3 minutes

    // Sync total registered count via server aggregation (no document payload transfer)
    if (auth.currentUser && !safeSessionGet('synced_user_count_v1')) {
      safeSessionSet('synced_user_count_v1', '1');
      getCountFromServer(collection(db, 'users')).then(countSnap => {
        const count = countSnap.data().count;
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
      where('isRead', '==', false),
      limit(40)
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

          if (document.hidden) {
            showBrowserNotificationSafely("متجر محيط", {
              body: "لديك رسائل جديدة!",
              icon: "/pwa-192x192.png"
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

    requestNotificationPermissionSafely();

    return () => unsubscribe();
  }, [user?.uid]);

  // Background watcher: automatically expire overdue courier fee proposals AND overdue store-pickup/pre-order reservations
  useEffect(() => {
    if (!user?.uid) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let pendingFeeOrders: Array<{ id: string; expiresAtMs: number }> = [];
    let pendingReservations: Array<{ id: string; expiresAtMs: number }> = [];
    const triggeredResIds = new Set<string>();

    const checkAndSchedule = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      const now = Date.now();
      let nextDelayMs: number | null = null;

      for (const item of pendingFeeOrders) {
        if (item.expiresAtMs <= now) {
          expireDeliveryFeeProposalTransaction(item.id);
        } else {
          const delay = item.expiresAtMs - now + 250;
          if (nextDelayMs === null || delay < nextDelayMs) {
            nextDelayMs = delay;
          }
        }
      }

      for (const item of pendingReservations) {
        if (item.expiresAtMs <= now) {
          if (!triggeredResIds.has(item.id)) {
            triggeredResIds.add(item.id);
            expireReservationTransaction(item.id).catch(() => {
              triggeredResIds.delete(item.id);
            });
          }
        } else {
          const delay = item.expiresAtMs - now + 250;
          if (nextDelayMs === null || delay < nextDelayMs) {
            nextDelayMs = delay;
          }
        }
      }

      if (nextDelayMs !== null) {
        timerId = setTimeout(checkAndSchedule, Math.min(nextDelayMs, 60_000));
      }
    };

    const qOrders = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      limit(35)
    );

    const unsubscribeOrders = onSnapshot(qOrders, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, data: d.data() as any }));

      pendingFeeOrders = docs
        .filter(({ data }) => data.deliveryFeeApprovalStatus === 'pending_customer' && data.deliveryFeeExpiresAt)
        .map(({ id, data }) => ({
          id,
          expiresAtMs: new Date(data.deliveryFeeExpiresAt).getTime()
        }))
        .filter(item => !Number.isNaN(item.expiresAtMs));

      pendingReservations = docs
        .filter(({ data }) => (data.status === 'reserved' || data.status === 'deposit_paid') && data.reservationExpiresAt)
        .map(({ id, data }) => ({
          id,
          expiresAtMs: new Date(data.reservationExpiresAt).getTime()
        }))
        .filter(item => !Number.isNaN(item.expiresAtMs));

      checkAndSchedule();
    }, (err) => {
      console.warn('Order fee/reservation expiration watcher notice:', err.message);
    });

    return () => {
      unsubscribeOrders();
      if (timerId) clearTimeout(timerId);
    };
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
      if (snap.exists()) {
        const rawData = (snap.data() || {}) as Record<string, any>;
        const normalizedStoreName =
          !rawData?.storeName || String(rawData.storeName).trim() === 'يمن ستور'
            ? 'متجر محيط'
            : rawData.storeName;
        const data: Record<string, any> = { ...rawData, storeName: normalizedStoreName };
        setSettings(data);
        try {
          const lightCache = {
            storeName: normalizedStoreName,
            shortName: data.shortName && String(data.shortName).trim() !== 'يمن ستور' ? data.shortName : 'متجر محيط',
            storeDescription: data.storeDescription,
            storeLogo: data.storeLogo && String(data.storeLogo).length < 180000 ? data.storeLogo : undefined,
            siteIcon: data.siteIcon && String(data.siteIcon).length < 180000 ? data.siteIcon : undefined,
            siteIconShape: data.siteIconShape,
            siteIconBg: data.siteIconBg,
            siteIconSize: data.siteIconSize,
            siteIconBorder: data.siteIconBorder,
            storeTheme: data.storeTheme,
            storeFont: data.storeFont,
            allowUserThemeOverride: data.allowUserThemeOverride,
            showHeroBanner: data.showHeroBanner,
            storePublicUrl: data.storePublicUrl,
            bannerMessage: data.bannerMessage
          };
          safeLocalSet('yemen_store_settings_cache_v1', JSON.stringify(lightCache));
        } catch {}
      }
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
        const saved = safeLocalGet('yemen_store_session');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && (parsed.email?.toLowerCase() === '1ismaai0lll@gmail.com' || parsed.uid === 'u_32cd7332ee7ec2e0c1121512')) {
              parsed.uid = 'MQAwCYqFztd2PZbV1fRMxKRqoYX2';
              parsed.role = 'admin';
              safeLocalSet('yemen_store_session', JSON.stringify(parsed));
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

  // Head title, favicon, and meta synchronization is handled centrally in App.tsx MainLayout

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

        // Keep local user in sync with Firestore data only if values actually changed
        if (data) {
          setUser((prev: any) => {
            if (!prev) return prev;
            const newName = data.name || prev.displayName;
            const newPhoto = data.photoURL !== undefined ? data.photoURL : (prev.photoURL || '');
            const newRole = data.role || prev.role;
            if (prev.displayName === newName && prev.photoURL === newPhoto && prev.role === newRole) {
              return prev;
            }
            return {
              ...prev,
              displayName: newName,
              photoURL: newPhoto,
              role: newRole
            };
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
                                        message: `سينتهي توثيق متجرك خلال ${diffDays} أيام (${formatArabicDate(expiryDate)}). يرجى تجديد التوثيق لضمان استمرار ظهور علامتك الموثقة.`,
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

  useEffect(() => {
    if (!user) return;
    if (safeLocalGet('yemen_store_session')) {
      safeLocalSet('yemen_store_session', JSON.stringify(user));
    }
  }, [user]);

  const openLoginModal = useCallback((initialEmail?: string) => {
    if (initialEmail) setLoginModalInitialEmail(initialEmail);
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
  }, []);

  const login = useCallback(() => {
    openLoginModal();
  }, [openLoginModal]);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const res = await signInWithPopup(auth, provider);
      if (res.user) {
        safeLocalRemove('yemen_store_session');
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
        safeLocalSet('yemen_store_session_token', data.sessionToken);
      }
      const isMaster = data.user.email?.toLowerCase() === '1ismaai0lll@gmail.com';
      const sessionUser: AppUser = {
        uid: isMaster ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' : data.user.uid,
        email: data.user.email,
        displayName: data.user.name || data.user.email?.split('@')[0],
        photoURL: data.user.photoURL || '',
        role: isMaster ? 'admin' : data.user.role
      };
      safeLocalSet('yemen_store_session', JSON.stringify(sessionUser));
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
        safeLocalSet('yemen_store_session_token', data.sessionToken);
      }
      const isMaster = data.user.email?.toLowerCase() === '1ismaai0lll@gmail.com';
      const sessionUser: AppUser = {
        uid: isMaster ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2' : data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName || data.user.name || data.user.email?.split('@')[0],
        photoURL: data.user.photoURL || '',
        role: isMaster ? 'admin' : data.user.role
      };
      safeLocalSet('yemen_store_session', JSON.stringify(sessionUser));
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
        safeLocalSet('yemen_store_session_token', data.sessionToken);
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
        safeLocalSet('yemen_store_session', JSON.stringify(sessionUser));
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
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
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
        safeLocalSet('yemen_store_session', JSON.stringify(updatedSession));
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
    const sessionToken = safeLocalGet('yemen_store_session_token');
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
    safeLocalRemove('yemen_store_session');
    safeLocalRemove('yemen_store_session_token');
    setUser(null);
    setUserData(null);
    try {
      await signOut(auth);
    } catch {}
    toast.success('تم تسجيل الخروج بنجاح', { id: 'auth-toast' });
  };

  const getCartItemKey = (product: any) =>
    product?._cartKey || (product?.selectedVariantId ? `${product.id}__variant__${product.selectedVariantId}` : product?.id);

  const addToCart = useCallback((product: any, quantityToAdd = 1) => {
    if (isStorePickupOnlyProduct(product)) {
      toast.error("هذا المنتج لا يدعم التوصيل؛ يجب حجزه والاستلام من المتجر نفسه فقط", { id: 'cart-nodelivery-error' });
      return;
    }

    const prev = cartRef.current;
    if (prev.length > 0) {
      const firstStoreId = prev[0].product.ownerId || 'global';
      const newStoreId = product.ownerId || 'global';
      if (firstStoreId !== newStoreId) {
        toast.error("يرجى إتمام طلب المتجر الحالي أولاً أو تفريغ السلة، لا يمكن الجمع بين منتجات من متاجر مختلفة في طلب واحد.", { id: 'cart-error' });
        return;
      }
    }

    if (isItemOutOfStock(product)) {
      toast.error("نفدت الكمية المتوفرة من هذا المنتج حالياً", { id: 'cart-stock-error' });
      return;
    }

    const qtyDelta = Math.max(1, Math.floor(Number(quantityToAdd) || 1));
    const stockLimit = getStockLimit(product);
    const targetKey = getCartItemKey(product);
    const existing = prev.find((item) => getCartItemKey(item.product) === targetKey);
    const currentQty = existing ? existing.quantity : 0;

    if (stockLimit !== null && currentQty >= stockLimit) {
      toast.error(`لا تتوفر كمية إضافية؛ الحد الأقصى المتاح بالمخزون هو ${stockLimit}`, { id: 'cart-stock-error' });
      return;
    }

    const desiredQty = currentQty + qtyDelta;
    const clampedQty = stockLimit !== null ? Math.min(desiredQty, stockLimit) : desiredQty;
    const wasClamped = stockLimit !== null && desiredQty > stockLimit;

    const nextCart = existing
      ? prev.map((item) =>
          getCartItemKey(item.product) === targetKey
            ? { ...item, product: { ...item.product, ...product }, quantity: clampedQty }
            : item
        )
      : [...prev, { product, quantity: clampedQty }];

    cartRef.current = nextCart;
    setCart(nextCart);
    if (wasClamped) {
      toast.success(`تمت إضافة أقصى كمية متوفرة (${stockLimit}) للسلة`, { id: 'cart-toast' });
    } else {
      toast.success(product.selectedVariantName ? `تمت إضافة (${product.selectedVariantName}) للسلة` : "تمت الإضافة للسلة", { id: 'cart-toast' });
    }
  }, []);

  const removeFromCart = useCallback((productKey: string) => {
    const nextCart = cartRef.current.filter((item) => getCartItemKey(item.product) !== productKey && item.product.id !== productKey);
    cartRef.current = nextCart;
    setCart(nextCart);
  }, []);

  const updateCartQuantity = useCallback((productKey: string, quantity: number) => {
    const cleanQty = Math.floor(Number(quantity) || 0);
    if (cleanQty <= 0) {
      const nextCart = cartRef.current.filter((item) => getCartItemKey(item.product) !== productKey && item.product.id !== productKey);
      cartRef.current = nextCart;
      setCart(nextCart);
      return;
    }

    const targetItem = cartRef.current.find((item) => getCartItemKey(item.product) === productKey || item.product.id === productKey);
    if (!targetItem) return;

    const stockLimit = getStockLimit(targetItem.product);
    if (stockLimit !== null && stockLimit <= 0) {
      toast.error("نفدت الكمية المتوفرة من هذا المنتج وتمت إزالته", { id: 'cart-stock-error' });
      const nextCart = cartRef.current.filter((item) => getCartItemKey(item.product) !== productKey && item.product.id !== productKey);
      cartRef.current = nextCart;
      setCart(nextCart);
      return;
    }

    let finalQty = cleanQty;
    if (stockLimit !== null && cleanQty > stockLimit) {
      finalQty = stockLimit;
      toast.error(`لا تتوفر كمية أكبر؛ المتاح في المخزون هو ${stockLimit} فقط`, { id: 'cart-stock-error' });
    }

    const nextCart = cartRef.current.map((item) =>
      (getCartItemKey(item.product) === productKey || item.product.id === productKey)
        ? { ...item, quantity: finalQty }
        : item
    );
    cartRef.current = nextCart;
    setCart(nextCart);
  }, []);

  const syncCartItemStock = useCallback((productKey: string, patch: { stock?: number | null; available?: boolean; price?: number; noDelivery?: boolean }) => {
    let changed = false;
    const nextCart = cartRef.current.map((item) => {
      if (getCartItemKey(item.product) !== productKey) {
        return item;
      }
      const nextStock = patch.stock !== undefined ? patch.stock : item.product.stock;
      const nextAvailable = patch.available !== undefined ? patch.available : item.product.available;
      const nextPrice = patch.price !== undefined ? patch.price : item.product.price;
      const nextNoDelivery = patch.noDelivery !== undefined ? patch.noDelivery : item.product.noDelivery;
      const nextProduct = { ...item.product, stock: nextStock, available: nextAvailable, price: nextPrice, noDelivery: nextNoDelivery };
      const limit = getStockLimit(nextProduct);
      const nextQty = limit !== null && limit > 0 ? Math.min(item.quantity, limit) : item.quantity;

      if (
        item.product.stock === nextStock &&
        item.product.available === nextAvailable &&
        item.product.price === nextPrice &&
        item.product.noDelivery === nextNoDelivery &&
        item.quantity === nextQty
      ) {
        return item;
      }
      changed = true;
      return { ...item, product: nextProduct, quantity: nextQty };
    });
    if (changed) {
      cartRef.current = nextCart;
      setCart(nextCart);
    }
  }, []);

  const clearCart = useCallback(() => {
    cartRef.current = [];
    setCart([]);
  }, []);

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

      case 'mocha':
        return {
          bg: 'bg-[#7C4A2D] text-white dark:bg-[#C28858] dark:text-[#18100B]',
          text: 'text-[#7C4A2D] dark:text-[#DFAC80]',
          hover: 'hover:bg-[#633922] dark:hover:bg-[#D19B6E]',
          border: 'border-[#7C4A2D] dark:border-[#C28858]',
          bgLight: 'bg-[#F3ECE6] dark:bg-[#241913]',
          textDark: 'text-[#5A341E] dark:text-[#ECC8A6]',
          badge: 'bg-[#F3ECE6] text-[#5A341E] border-[#E4D6C9] dark:bg-[#241913] dark:text-[#ECC8A6] dark:border-[#3D2B20]',
          ring: 'focus:ring-[#7C4A2D] ring-[#7C4A2D]',
          gradient: 'from-[#2A180E] to-[#7C4A2D]',
          activeTab: 'bg-[#7C4A2D] text-white dark:bg-[#C28858] dark:text-[#18100B]',
          price: 'text-[#7C4A2D] dark:text-[#DFAC80]',
          pageBg: 'bg-[#F7F3EE] dark:bg-[#110C09]',
          cardBg: 'bg-white dark:bg-[#1A130E] border-[#E6DDD3] dark:border-[#2F231B]',
          headerBg: 'bg-[#F7F3EE]/95 dark:bg-[#110C09]/95 border-[#E6DDD3] dark:border-[#2F231B]',
          verified: 'text-[#0D6E4E] dark:text-[#34D399]'
        }[type] || 'bg-[#7C4A2D] text-white';

      case 'gold':
        return {
          bg: 'bg-[#B45309] text-white dark:bg-[#F59E0B] dark:text-[#181104]',
          text: 'text-[#B45309] dark:text-[#FBBF24]',
          hover: 'hover:bg-[#92400E] dark:hover:bg-[#D97706]',
          border: 'border-[#B45309] dark:border-[#F59E0B]',
          bgLight: 'bg-[#F9F2E3] dark:bg-[#261B08]',
          textDark: 'text-[#78350F] dark:text-[#FDE68A]',
          badge: 'bg-[#F9F2E3] text-[#78350F] border-[#E8D8B7] dark:bg-[#261B08] dark:text-[#FDE68A] dark:border-[#423010]',
          ring: 'focus:ring-[#B45309] ring-[#B45309]',
          gradient: 'from-[#241805] to-[#B45309]',
          activeTab: 'bg-[#B45309] text-white dark:bg-[#F59E0B] dark:text-[#181104]',
          price: 'text-[#B45309] dark:text-[#FBBF24]',
          pageBg: 'bg-[#FAF7F0] dark:bg-[#0F0D08]',
          cardBg: 'bg-white dark:bg-[#18140D] border-[#EBE3D0] dark:border-[#302717]',
          headerBg: 'bg-[#FAF7F0]/95 dark:bg-[#0F0D08]/95 border-[#EBE3D0] dark:border-[#302717]',
          verified: 'text-[#0D6E4E] dark:text-[#34D399]'
        }[type] || 'bg-[#B45309] text-white';

      case 'teal':
        return {
          bg: 'bg-[#0F766E] text-white dark:bg-[#14B8A6] dark:text-[#041816]',
          text: 'text-[#0F766E] dark:text-[#2DD4BF]',
          hover: 'hover:bg-[#115E59] dark:hover:bg-[#0D9488]',
          border: 'border-[#0F766E] dark:border-[#14B8A6]',
          bgLight: 'bg-[#EAF4F4] dark:bg-[#0D2624]',
          textDark: 'text-[#134E4A] dark:text-[#99F6E4]',
          badge: 'bg-[#EAF4F4] text-[#134E4A] border-[#CBE3E2] dark:bg-[#0D2624] dark:text-[#99F6E4] dark:border-[#19423F]',
          ring: 'focus:ring-[#0F766E] ring-[#0F766E]',
          gradient: 'from-[#082423] to-[#0F766E]',
          activeTab: 'bg-[#0F766E] text-white dark:bg-[#14B8A6] dark:text-[#041816]',
          price: 'text-[#0F766E] dark:text-[#2DD4BF]',
          pageBg: 'bg-[#F3F8F8] dark:bg-[#071112]',
          cardBg: 'bg-white dark:bg-[#0F1B1C] border-[#D9E7E6] dark:border-[#1D3234]',
          headerBg: 'bg-[#F3F8F8]/95 dark:bg-[#071112]/95 border-[#D9E7E6] dark:border-[#1D3234]',
          verified: 'text-[#0F766E] dark:text-[#2DD4BF]'
        }[type] || 'bg-[#0F766E] text-white';

      case 'olive':
        return {
          bg: 'bg-[#3F6212] text-white dark:bg-[#84CC16] dark:text-[#0F1704]',
          text: 'text-[#3F6212] dark:text-[#A3E635]',
          hover: 'hover:bg-[#365314] dark:hover:bg-[#65A30D]',
          border: 'border-[#3F6212] dark:border-[#84CC16]',
          bgLight: 'bg-[#F0F4E8] dark:bg-[#1A240B]',
          textDark: 'text-[#365314] dark:text-[#D9F99D]',
          badge: 'bg-[#F0F4E8] text-[#365314] border-[#D7E2C2] dark:bg-[#1A240B] dark:text-[#D9F99D] dark:border-[#304215]',
          ring: 'focus:ring-[#3F6212] ring-[#3F6212]',
          gradient: 'from-[#182208] to-[#3F6212]',
          activeTab: 'bg-[#3F6212] text-white dark:bg-[#84CC16] dark:text-[#0F1704]',
          price: 'text-[#3F6212] dark:text-[#A3E635]',
          pageBg: 'bg-[#F6F7F2] dark:bg-[#0B0E07]',
          cardBg: 'bg-white dark:bg-[#13180E] border-[#E1E5D6] dark:border-[#252F1B]',
          headerBg: 'bg-[#F6F7F2]/95 dark:bg-[#0B0E07]/95 border-[#E1E5D6] dark:border-[#252F1B]',
          verified: 'text-[#3F6212] dark:text-[#A3E635]'
        }[type] || 'bg-[#3F6212] text-white';

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
    syncCartItemStock,
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
    getAuthHeaders,
    favoriteIds,
    toggleFavorite,
    isFavorite,
    recentlyViewedIds,
    recordRecentlyViewed,
    isCartDrawerOpen,
    openCartDrawer,
    closeCartDrawer,
    followedStoreIds,
    toggleFollowStore,
    isFollowingStore,
    isSearchPaletteOpen,
    openSearchPalette,
    closeSearchPalette,
    isAiDrawerOpen,
    aiDrawerInitialQuery,
    openAiDrawer,
    closeAiDrawer
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
    openLoginModal,
    closeLoginModal,
    login,
    cart, 
    cartTotal,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    syncCartItemStock,
    clearCart,
    unreadCount, 
    globalStats,
    effectiveTheme,
    userTheme,
    allowUserThemeOverride,
    getThemeClasses,
    effectiveIsDarkMode,
    favoriteIds,
    toggleFavorite,
    isFavorite,
    recentlyViewedIds,
    recordRecentlyViewed,
    isCartDrawerOpen,
    openCartDrawer,
    closeCartDrawer,
    followedStoreIds,
    toggleFollowStore,
    isFollowingStore,
    isSearchPaletteOpen,
    openSearchPalette,
    closeSearchPalette,
    isAiDrawerOpen,
    aiDrawerInitialQuery,
    openAiDrawer,
    closeAiDrawer
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
