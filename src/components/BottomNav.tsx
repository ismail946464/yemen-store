import { Link, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingBag, MessageSquare, User, LayoutDashboard, Bike } from 'lucide-react';
import { useAppContext } from '../AppContext';

export default function BottomNav() {
  const { user, cart, unreadCount, isStore, isAdmin, isDelivery, isDarkMode, getThemeClasses } = useAppContext();
  const location = useLocation();

  // Hide bottom nav on specific independent store URLs or when inside an active chat on mobile
  const isIndependentStore = location.pathname.startsWith('/s/') || location.pathname.startsWith('/store-site/');
  const searchParams = new URLSearchParams(location.search);
  const isChatSession = location.pathname === '/contact' && (searchParams.has('to') || searchParams.has('userId'));
  if (isIndependentStore || isChatSession) return null;

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
      <div className={`border-t backdrop-blur-2xl transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-slate-950/95 border-slate-800/90 text-slate-300' 
          : 'bg-white/95 border-neutral-200 text-neutral-600 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]'
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
                  className={`flex flex-col items-center justify-center relative py-1 px-2.5 sm:px-3 rounded-xl transition-all duration-150 group active:scale-95 ${
                    isActive
                      ? (isDarkMode ? 'text-white font-black' : 'text-neutral-950 font-black')
                      : isDarkMode
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {/* Active Indicator Top Line */}
                  {isActive && (
                    <span className={`absolute -top-1 w-7 h-0.5 rounded-full ${isDarkMode ? 'bg-white' : 'bg-neutral-950'} transition-all`} />
                  )}

                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform duration-150 ${
                      isActive ? 'scale-110 stroke-[2.2]' : 'group-hover:scale-105 stroke-[1.75]'
                    }`} />
                    
                    {/* Badge for Cart count or Unread count */}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-xs border border-white dark:border-slate-900">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>

                  <span className={`text-[11px] mt-1 tracking-tight leading-tight transition-all duration-150 ${
                    isActive ? 'font-bold' : 'font-medium'
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
