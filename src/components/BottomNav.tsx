import { Link, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingBag, MessageSquare, User, LayoutDashboard, Bike } from 'lucide-react';
import { useAppContext } from '../AppContext';

export default function BottomNav() {
  const { user, cart, unreadCount, isStore, isAdmin, isDelivery, isDarkMode, getThemeClasses } = useAppContext();
  const location = useLocation();

  // Hide bottom nav on specific independent store URLs if needed, but show by default on all main routes
  const isIndependentStore = location.pathname.startsWith('/s/') || location.pathname.startsWith('/store-site/');
  if (isIndependentStore) return null;

  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const navItems = [
    {
      id: 'home',
      label: 'الرئيسية',
      path: '/',
      icon: Home,
      exact: true
    },
    {
      id: 'search',
      label: 'البحث والمتاجر',
      path: '/search-stores',
      icon: Search
    },
    {
      id: 'cart',
      label: 'السلة',
      path: '/cart',
      icon: ShoppingBag,
      badge: cartCount > 0 ? cartCount : undefined
    },
    {
      id: 'messages',
      label: 'الرسائل',
      path: '/contact',
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    {
      id: 'profile',
      label: 'حسابي',
      path: user ? '/profile' : '/login',
      icon: User
    }
  ];

  // If user is courier or admin, append quick delivery button
  if (user && (isDelivery || isAdmin)) {
    navItems.push({
      id: 'delivery',
      label: 'التوصيل',
      path: '/delivery',
      icon: Bike
    });
  }

  // If user is store owner or admin, append a quick dashboard button
  if (user && (isStore || isAdmin)) {
    navItems.push({
      id: 'admin',
      label: 'لوحة التحكم',
      path: '/admin',
      icon: LayoutDashboard
    });
  }

  return (
    <nav 
      aria-label="شريط المهام السفلي"
      className="fixed bottom-0 left-0 right-0 z-[999] transition-all duration-300 pointer-events-auto pb-[env(safe-area-inset-bottom,0px)]"
      dir="rtl"
    >
      {/* Blur Background and Border */}
      <div className={`border-t backdrop-blur-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.08)] transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-slate-950/95 border-slate-800/90 text-slate-300' 
          : 'bg-white/95 border-slate-200/90 text-slate-700'
      }`}>
        <div className="max-w-md md:max-w-2xl mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-around h-16 sm:h-18">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact 
                ? location.pathname === item.path 
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex flex-col items-center justify-center relative py-1.5 px-2.5 sm:px-3 rounded-2xl transition-all duration-200 group active:scale-90 ${
                    isActive
                      ? `${getThemeClasses('text')} font-black`
                      : isDarkMode
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {/* Active Indicator Glow / Pill */}
                  {isActive && (
                    <span className={`absolute -top-1 w-8 h-1 rounded-full ${getThemeClasses('bg')} shadow-sm animate-in fade-in zoom-in duration-200`} />
                  )}

                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'scale-115 stroke-[2.4]' : 'group-hover:scale-110 stroke-[1.8]'
                    }`} />
                    
                    {/* Badge for Cart count or Unread count */}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-md border-2 border-white dark:border-slate-900 animate-pulse">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>

                  <span className={`text-[10px] mt-1 tracking-tight leading-tight transition-all duration-200 ${
                    isActive ? 'font-black scale-102' : 'font-medium'
                  }`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
