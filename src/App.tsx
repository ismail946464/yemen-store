/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Store, ShoppingBag, User as UserIcon, Bot, MessageSquare, Bike } from 'lucide-react';
import { AppProvider, useAppContext } from './AppContext';
import { Toaster } from 'react-hot-toast';
import ContactModal from './components/ContactModal';
import DisclaimerModal from './components/DisclaimerModal';
import InstallPrompt from './components/InstallPrompt';
import NotificationCenter from './components/NotificationCenter';
import BottomNav from './components/BottomNav';
import LoginModal from './components/LoginModal';
import { PageLoadingSkeleton } from './components/Skeletons';
import StoreFront from './pages/StoreFront';

const StoreSite = lazy(() => import('./pages/StoreSite'));
const Cart = lazy(() => import('./pages/Cart'));
const Orders = lazy(() => import('./pages/Orders'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Contact = lazy(() => import('./pages/Contact'));
const StoreProfile = lazy(() => import('./pages/StoreProfile'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const StoreSearch = lazy(() => import('./pages/StoreSearch'));
const DeliveryPortal = lazy(() => import('./pages/DeliveryPortal'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SafetyGuide = lazy(() => import('./pages/SafetyGuide'));

function Header() {
  const { user, userData, isDelivery, isStore, isAdmin, login, cart, unreadCount, settings, getThemeClasses } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [showContactModal, setShowContactModal] = useState(false);

  const handleLogin = async () => {
    await login();
    navigate('/');
  };

  const isIndependentStore = location.pathname.startsWith('/s/') || location.pathname.startsWith('/store-site/');
  const isContactPage = location.pathname === '/contact';
  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <header className={isIndependentStore ? 'hidden' : isContactPage ? 'hidden md:block sticky top-0 z-50 transition-colors duration-200' : 'sticky top-0 z-50 transition-colors duration-200'}>
      <div className={`border-b relative z-10 h-16 flex items-center transition-colors duration-200 backdrop-blur-md ${getThemeClasses('headerBg')}`}>
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center gap-4 md:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 min-w-0">
            {(() => {
              const logoUrl = settings?.siteIcon || settings?.storeLogo;
              const shape = settings?.siteIconShape || 'rounded';
              const bgChoice = settings?.siteIconBg || 'white';
              const sizeChoice = settings?.siteIconSize || 'medium';
              const withBorder = settings?.siteIconBorder !== false && shape !== 'transparent' && bgChoice !== 'transparent';

              const sizeCls = sizeChoice === 'large'
                ? 'h-10 min-w-[40px]'
                : sizeChoice === 'compact'
                  ? 'h-8 min-w-[32px]'
                  : 'h-9 min-w-[36px]';

              const shapeCls = shape === 'circle'
                ? 'rounded-full'
                : shape === 'transparent'
                  ? 'rounded-none'
                  : 'rounded-lg';

              const bgCls = shape === 'transparent' || bgChoice === 'transparent'
                ? 'bg-transparent border-transparent'
                : bgChoice === 'theme'
                  ? `${getThemeClasses('bg')}`
                  : bgChoice === 'dark'
                    ? 'bg-[#111214] text-white'
                    : 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730]';

              const borderCls = withBorder ? 'border p-1' : 'border-0 p-0';

              if (logoUrl && logoUrl.trim() !== '') {
                return (
                  <div className={`relative flex items-center justify-center overflow-hidden ${shapeCls} ${bgCls} ${borderCls}`}>
                    <img
                      src={logoUrl}
                      alt={settings?.storeName || 'شعار المتجر'}
                      className={`${sizeCls} w-auto max-w-[110px] object-contain`}
                    />
                  </div>
                );
              }

              return (
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getThemeClasses('bg')}`}>
                  <Store className="h-4.5 w-4.5" />
                </div>
              );
            })()}

            <span className="font-display text-base sm:text-lg font-extrabold tracking-tight whitespace-nowrap text-[#111214] dark:text-[#F4F4F2]">
              {settings?.storeName || 'يمن ستور'}
            </span>
          </Link>

          {/* Zone 2: Clean Typographic Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold" aria-label="التنقل الرئيسي">
            <Link
              to="/"
              className={`whitespace-nowrap shrink-0 py-1.5 transition-colors border-b-2 ${
                location.pathname === '/'
                  ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                  : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
              }`}
            >
              الرئيسية
            </Link>
            <Link
              to="/search-stores"
              className={`whitespace-nowrap shrink-0 py-1.5 transition-colors border-b-2 ${
                location.pathname.startsWith('/search-stores')
                  ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                  : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
              }`}
            >
              المتاجر
            </Link>
            {user && (
              <Link
                to="/orders"
                className={`whitespace-nowrap shrink-0 py-1.5 transition-colors border-b-2 ${
                  location.pathname.startsWith('/orders')
                    ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                    : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                }`}
              >
                طلباتي
              </Link>
            )}
            <Link
              to="/contact?to=ai_assistant"
              className={`whitespace-nowrap shrink-0 py-1.5 flex items-center gap-1.5 transition-colors border-b-2 ${
                location.pathname === '/contact' && location.search.includes('ai_assistant')
                  ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                  : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>مساعد المتجر</span>
            </Link>
            {user && (isAdmin || isStore) && (
              <Link
                to="/admin"
                className={`whitespace-nowrap shrink-0 py-1.5 transition-colors border-b-2 ${
                  location.pathname.startsWith('/admin')
                    ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                    : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                }`}
              >
                لوحة الإدارة
              </Link>
            )}
          </nav>

          {/* Zone 3: Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile AI Assistant shortcut */}
            <Link
              to="/contact?to=ai_assistant"
              title={`مساعد ${settings?.storeName || 'يمن ستور'}`}
              className="md:hidden min-h-[40px] flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors whitespace-nowrap shrink-0"
            >
              <Bot className="w-4 h-4" />
              <span>المساعد</span>
            </Link>

            {/* Delivery Courier Shortcut - Strictly for role === 'delivery' only */}
            {isDelivery && (
              <Link
                to="/delivery"
                title="بوابة التوصيل"
                className={`min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                <Bike className="w-4 h-4" />
                <span>التوصيل</span>
              </Link>
            )}

            {/* Desktop Cart Button */}
            <Link
              to="/cart"
              title="سلة المشتريات"
              className="hidden sm:flex relative w-10 h-10 items-center justify-center rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors"
            >
              <ShoppingBag className="w-4.5 h-4.5" />
              {cartCount > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums border border-white dark:border-[#0A0B0D] ${getThemeClasses('bg')}`}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="flex items-center gap-2">
                <NotificationCenter />
                <Link
                  to="/contact"
                  title="الرسائل"
                  className="hidden sm:flex w-10 h-10 items-center justify-center rounded-lg transition-colors relative border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]"
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums border border-white dark:border-[#0A0B0D]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                <Link
                  to="/profile"
                  title="حسابي"
                  className="hidden sm:flex w-10 h-10 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] items-center justify-center transition hover:opacity-90"
                >
                  {userData?.photoURL ? (
                    <img
                      src={userData.photoURL}
                      className="w-full h-full object-cover"
                      alt={userData?.name || 'الحساب'}
                    />
                  ) : (
                    <UserIcon className="w-4.5 h-4.5" />
                  )}
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                className={`min-h-[40px] px-4 py-2 rounded-lg font-bold text-xs whitespace-nowrap shrink-0 transition active:scale-[0.98] ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                دخول المنصة
              </button>
            )}
          </div>
        </div>
      </div>

      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="تواصل مع الإدارة"
        contacts={settings?.adminContacts || []}
        getThemeClasses={getThemeClasses}
      />
    </header>
  );
}

function MainLayout() {
  const { settings, settingsLoading, getThemeClasses, isDarkMode, isLoginModalOpen, closeLoginModal, loginModalInitialEmail, effectiveTheme } = useAppContext();
  const location = useLocation();
  const isIndependentStore = location.pathname.startsWith('/s/') || location.pathname.startsWith('/store-site/');

  useEffect(() => {
    if (settings?.storeLogo) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.storeLogo;

      let appleIcon = document.querySelector("link[rel~='apple-touch-icon']") as HTMLLinkElement;
      if (!appleIcon) {
        appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        document.getElementsByTagName('head')[0].appendChild(appleIcon);
      }
      appleIcon.href = settings.storeLogo;

      const manifest = {
        short_name: settings.shortName || settings.storeName || 'المتجر',
        name: settings.storeName || 'متجر',
        description: settings.storeDescription || `منصة ${settings.storeName || 'المتجر'} للتجارة والمتاجر الموثوقة`,
        start_url: '/',
        display: 'standalone',
        theme_color: '#111214',
        background_color: '#f6f5f0',
        icons: [
          { src: settings.storeLogo, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: settings.storeLogo, sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      };

      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const manifestURL = URL.createObjectURL(blob);
      const manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
      if (manifestLink) {
        manifestLink.href = manifestURL;
      }
      return () => URL.revokeObjectURL(manifestURL);
    }
  }, [settings?.storeLogo, settings?.storeName, settings?.shortName, settings?.storeDescription]);

  useEffect(() => {
    if (!settings) return;
    const currentStoreName = settings?.storeName || 'يمن ستور';
    document.title = currentStoreName;

    const currentUrl = settings?.storePublicUrl || 'https://www.yemenstoreonline.com';
    const dynamicDescription = settings?.storeDescription || `منصة ${currentStoreName} للتجارة والمتاجر الموثوقة`;
    const metaTags = [
      { property: 'og:title', content: currentStoreName },
      { property: 'og:description', content: dynamicDescription },
      { property: 'og:image', content: settings?.storeLogo || '' },
      { property: 'og:url', content: currentUrl },
      { name: 'description', content: dynamicDescription },
      { name: 'twitter:title', content: currentStoreName },
      { name: 'twitter:description', content: dynamicDescription },
      { name: 'twitter:image', content: settings?.storeLogo || '' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ];

    metaTags.forEach(tag => {
      const attr = tag.property ? `property="${tag.property}"` : `name="${tag.name}"`;
      let element = document.querySelector(`meta[${attr}]`);
      if (!element) {
        element = document.createElement('meta');
        if (tag.property) element.setAttribute('property', tag.property);
        if (tag.name) element.setAttribute('name', tag.name);
        document.getElementsByTagName('head')[0].appendChild(element);
      }
      element.setAttribute('content', tag.content);
    });
  }, [settings]);

  if (settingsLoading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark bg-[#0A0B0D] text-[#F4F4F2]' : 'bg-[#F6F5F0] text-[#111214]'}`} dir="rtl">
        <div className="h-16 border-b border-[#E5E2DA] dark:border-[#232730] px-6 flex items-center justify-between">
          <div className="w-32 h-5 rounded-md skeleton-shimmer" />
          <div className="w-24 h-8 rounded-lg skeleton-shimmer" />
        </div>
        <PageLoadingSkeleton />
      </div>
    );
  }

  const storeFont = settings?.storeFont || 'tajawal';
  const fontClass = `font-${storeFont}`;
  const searchParams = new URLSearchParams(location.search);
  const isChatSession = location.pathname === '/contact' && (searchParams.has('to') || searchParams.has('userId'));
  const isContactPage = location.pathname === '/contact';

  return (
    <div
      id="app-root"
      data-theme={effectiveTheme}
      className={`${isContactPage ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'} flex flex-col transition-colors duration-200 ${getThemeClasses('pageBg')} ${isDarkMode ? 'dark text-[#F4F4F2]' : 'text-[#111214]'} ${fontClass}`}
      dir="rtl"
    >
      {settings?.customCss && (
        <style id="ai-injected-styles" dangerouslySetInnerHTML={{ __html: settings.customCss }} />
      )}

      <Header />
      <DisclaimerModal />
      <InstallPrompt />
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        initialEmail={loginModalInitialEmail}
      />
      <main className={`flex-1 w-full ${
        isIndependentStore
          ? ''
          : isChatSession
            ? 'p-0 m-0 overflow-hidden flex flex-col min-h-0 h-full'
            : isContactPage
              ? 'p-0 m-0 pb-16 md:pb-0 overflow-hidden flex flex-col min-h-0'
              : 'pb-20 sm:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'
      }`}>
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Routes>
            <Route path="/" element={<StoreFront />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/product/:productId" element={<ProductDetail />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/delivery" element={<DeliveryPortal />} />
            <Route path="/store/:userId" element={<StoreProfile />} />
            <Route path="/s/:slug" element={<StoreSite />} />
            <Route path="/s/:slug/cart" element={<Cart />} />
            <Route path="/s/:slug/orders" element={<Orders />} />
            <Route path="/s/:slug/product/:productId" element={<ProductDetail />} />
            <Route path="/store-site/:slug" element={<StoreSite />} />
            <Route path="/search-stores" element={<StoreSearch />} />
            <Route path="/safety-guide" element={<SafetyGuide />} />
            <Route path="*" element={<StoreFront />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppProvider>
        <Toaster
          position="top-center"
          gutter={8}
          containerStyle={{ top: 20 }}
          toastOptions={{
            duration: 3200,
            style: {
              borderRadius: '8px',
              background: '#111214',
              color: '#f4f4f2',
              padding: '10px 16px',
              fontWeight: '600',
              fontSize: '13px',
              direction: 'rtl',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.16)',
              border: '1px solid #232730',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#fff' },
            },
          }}
        />
        <MainLayout />
      </AppProvider>
    </Router>
  );
}
