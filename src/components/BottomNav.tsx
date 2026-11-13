import { Link, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingBag, MessageSquare, User, LayoutDashboard } from 'lucide-react';
import { useAppContext } from '../AppContext';

export default function BottomNav() {
  const { user, cart, unreadCount, isStore, isAdmin, getThemeClasses } = useAppContext();
  const location = useLocation();

  const isIndependentStore = location.pathname.startsWith('/s/') || location.pathname.startsWith('/store-site/');
  const searchParams = new URLSearchParams(location.search);
  const isChatSession = location.pathname === '/contact' && (searchParams.has('to') || searchParams.has('userId'));
  if (isIndependentStore || isChatSession) return null;

  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const navItems = [
    { id: 'home', label: 'الرئيسية', path: '/', icon: Home, exact: true },
    { id: 'search', label: 'المتاجر', path: '/search-stores', icon: Search },
    { id: 'cart', label: 'السلة', path: '/cart', icon: ShoppingBag, badge: cartCount > 0 ? cartCount : undefined },
    { id: 'messages', label: 'الرسائل', path: '/contact', icon: MessageSquare, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'profile', label: 'حسابي', path: user ? '/profile' : '/login', icon: User }
  ];

  if (user && (isStore || isAdmin)) {
    navItems.push({
      id: 'admin',
      label: 'الإدارة',
      path: '/admin',
      icon: LayoutDashboard
    });
  }

  return (
    <nav
      aria-label="شريط المهام السفلي"
      className="md:hidden fixed bottom-0 left-0 right-0 z-[999] pointer-events-auto pb-[env(safe-area-inset-bottom,0px)]"
      dir="rtl"
    >
      <div className="border-t border-[#E5E2DA] dark:border-[#232730] bg-white/95 dark:bg-[#0A0B0D]/95 backdrop-blur-md">
        <div className="max-w-md mx-auto px-1">
          <div className="flex items-center justify-around h-14">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`min-w-[48px] min-h-[44px] flex flex-col items-center justify-center relative py-1 px-2 transition-colors duration-150 ${
                    isActive
                      ? 'text-[#111214] dark:text-[#F4F4F2] font-bold'
                      : 'text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-zinc-200'
                  }`}
                >
                  {isActive && (
                    <span className={`absolute top-0 w-7 h-0.5 ${getThemeClasses('bg')}`} />
                  )}

                  <div className="relative">
                    <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-rose-600 text-white text-[9px] font-bold tabular-nums rounded-md flex items-center justify-center px-1 border border-white dark:border-[#0A0B0D]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>

                  <span className={`text-[10px] mt-1 whitespace-nowrap leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
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
