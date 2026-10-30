/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Store, MapPin, Search, ShoppingBag, User as UserIcon, Bot, Menu, X, MessageSquare, PhoneCall, Users, TrendingUp } from 'lucide-react';
import { AppProvider, useAppContext } from './AppContext';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import ContactModal from './components/ContactModal';
import DisclaimerModal from './components/DisclaimerModal';
import InstallPrompt from './components/InstallPrompt';
import StoreFront from './pages/StoreFront';
import StoreSite from './pages/StoreSite';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import Contact from './pages/Contact';
import StoreProfile from './pages/StoreProfile';
import ProductDetail from './pages/ProductDetail';
import StoreSearch from './pages/StoreSearch';
import NotificationCenter from './components/NotificationCenter';
import BottomNav from './components/BottomNav';
import LoginModal from './components/LoginModal';
import LoginPage from './pages/LoginPage';

function Header() {
    const { user, userData, isAdmin, isStore, login, logout, cart, settings, getThemeClasses, unreadCount, globalStats, isDarkMode } = useAppContext();
    const navigate = useNavigate();
    const [showContactModal, setShowContactModal] = useState(false);
    
    const isMainStoreOnline = globalStats.mainStoreLastSeen && (new Date().getTime() - new Date(globalStats.mainStoreLastSeen).getTime()) < 75000;

    const handleLogin = async () => {
      await login();
      navigate('/');
    };
  
    const storeFont = settings?.storeFont || 'tajawal';
  
    const fontClass = `font-${storeFont}`;
    
    const location = useLocation();
    const isIndependentStore = location.pathname.startsWith('/s/') || location.pathname.startsWith('/store-site/');

    return (
      <header className={`${isIndependentStore ? 'hidden' : 'sticky top-0 z-50 transition-colors duration-300'}`}>
        <div className={`border-b relative z-10 py-5 transition-colors duration-300 ${isDarkMode ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="relative">
                  {(() => {
                    const logoUrl = settings?.siteIcon || settings?.storeLogo;
                    const shape = settings?.siteIconShape || 'rounded'; // 'rounded' | 'circle' | 'transparent' | 'original'
                    const bgChoice = settings?.siteIconBg || 'white'; // 'white' | 'transparent' | 'theme' | 'dark'
                    const sizeChoice = settings?.siteIconSize || 'medium'; // 'compact' | 'medium' | 'large'
                    const withBorder = settings?.siteIconBorder !== false && shape !== 'transparent' && bgChoice !== 'transparent';

                    const sizeCls = sizeChoice === 'large' 
                      ? 'h-13 sm:h-14 min-w-[52px]' 
                      : sizeChoice === 'compact' 
                        ? 'h-9 sm:h-9 min-w-[36px]' 
                        : 'h-10 sm:h-12 min-w-[42px]';

                    const shapeCls = shape === 'circle' 
                      ? 'rounded-full' 
                      : shape === 'transparent' 
                        ? 'rounded-none shadow-none' 
                        : 'rounded-2xl';

                    const bgCls = shape === 'transparent' || bgChoice === 'transparent'
                      ? 'bg-transparent border-transparent shadow-none'
                      : bgChoice === 'theme'
                        ? `${getThemeClasses('bg')} text-white`
                        : bgChoice === 'dark'
                          ? 'bg-slate-900 dark:bg-black text-white'
                          : isDarkMode 
                            ? 'bg-slate-900 border-slate-800' 
                            : 'bg-white border-slate-100';

                    const borderCls = withBorder 
                      ? `border shadow-sm p-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-200/80'}` 
                      : 'border-0 p-0';

                    if (logoUrl && logoUrl.trim() !== '') {
                      return (
                        <div className={`relative flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105 ${shapeCls} ${bgCls} ${borderCls}`}>
                          <img 
                            src={logoUrl} 
                            alt="Site Logo" 
                            className={`${sizeCls} w-auto max-w-[150px] object-contain transition-all duration-300`} 
                          />
                        </div>
                      );
                    }

                    return (
                      <div className={`${getThemeClasses('bg')} p-2.5 rounded-2xl shadow-xl shadow-blue-500/10 group-hover:rotate-3 transition`}>
                        <Store className="h-6 w-6 text-white" />
                      </div>
                    );
                  })()}
                </div>
                <div className="flex flex-col leading-tight">
                  <h1 className={`text-xl sm:text-2xl font-black tracking-tight group-hover:text-blue-600 transition ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {settings?.storeName || 'يمن ستور'}
                  </h1>
                </div>
              </Link>
              
              <div className="flex items-center gap-1.5 sm:gap-4">
                {user ? (
                  <div className="flex items-center gap-1 sm:gap-3">
                    <NotificationCenter />
                    {/* On desktop, keep quick message and profile buttons; on mobile, BottomNav provides instant access */}
                    <Link to="/contact" className={`hidden sm:flex w-10 h-10 items-center justify-center rounded-2xl transition relative group border ${isDarkMode ? 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white' : 'bg-gray-50 border-gray-100 text-gray-900 hover:bg-gray-100 hover:text-black'}`}>
                       <MessageSquare className="w-5 h-5 group-hover:scale-110 transition" />
                       {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-lg">{unreadCount}</span>}
                    </Link>
                    
                    <Link to="/profile" className="hidden sm:block ml-1">
                       <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl sm:rounded-3xl p-0.5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:scale-105 transition active:scale-95 cursor-pointer shadow-lg shadow-blue-500/10">
                          <div className={`w-full h-full rounded-[0.9rem] sm:rounded-[1.25rem] overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                             <img 
                               src={userData?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'} 
                               className="w-full h-full object-cover" 
                               alt="Profile" 
                             />
                          </div>
                       </div>
                    </Link>
                  </div>
                ) : (
                  <button onClick={handleLogin} className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-black text-xs shadow-xl transition active:translate-y-0 ${isDarkMode ? 'bg-blue-600 text-white shadow-blue-900/20 hover:bg-blue-700' : 'bg-black text-white shadow-black/10 hover:translate-y-[-2px]'}`}>
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
  const { settings, settingsLoading, getThemeClasses, isDarkMode, isLoginModalOpen, closeLoginModal, loginModalInitialEmail } = useAppContext();
  const location = useLocation();
  const isIndependentStore = location.pathname.startsWith('/s/') || location.pathname.startsWith('/store-site/');
  
  useEffect(() => {
    if (settings?.storeLogo) {
      // Update favicon
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.storeLogo;
      
      // Update apple icon
      let appleIcon = document.querySelector("link[rel~='apple-touch-icon']") as HTMLLinkElement;
      if (!appleIcon) {
        appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        document.getElementsByTagName('head')[0].appendChild(appleIcon);
      }
      appleIcon.href = settings.storeLogo;

      // Update PWA Manifest dynamically
      const manifest = {
        short_name: settings.shortName || settings.storeName || "يمن ستور",
        name: settings.storeName || "يمن ستور",
        description: settings.storeDescription || "منصة يمن ستور للتجارة والمتاجر الموثوقة",
        start_url: "/",
        display: "standalone",
        theme_color: "#000000",
        background_color: "#ffffff",
        icons: [
          {
            src: settings.storeLogo,
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: settings.storeLogo,
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          }
        ]
      };
      
      const stringManifest = JSON.stringify(manifest);
      const blob = new Blob([stringManifest], {type: 'application/json'});
      const manifestURL = URL.createObjectURL(blob);
      
      let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
      if (manifestLink) {
        manifestLink.href = manifestURL;
      }
    }
    
    // Update Document Title and Social Meta Tags
    if (settings?.storeName) {
      document.title = settings.storeName;
      
      // Update Open Graph and Twitter tags
      const currentUrl = settings.storePublicUrl || 'https://www.yemenstoreonline.com';
      const metaTags = [
        { property: 'og:title', content: settings.storeName },
        { property: 'og:description', content: settings.storeDescription || '' },
        { property: 'og:image', content: settings.storeLogo || '' },
        { property: 'og:url', content: currentUrl },
        { name: 'twitter:title', content: settings.storeName },
        { name: 'twitter:image', content: settings.storeLogo || '' },
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
    }
  }, [settings]);

  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" dir="rtl">
        <div className="flex flex-col items-center gap-6">
          {settings?.storeLogo && settings.storeLogo !== "" && (
            <img src={settings.storeLogo} alt="Logo" className="w-24 h-24 object-contain animate-pulse" />
          )}
          <div className="flex flex-col items-center gap-4">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${getThemeClasses('border')}`}></div>
            <p className="text-gray-900 font-black animate-pulse">{settings?.storeName || 'جاري تحميل المتجر...'}</p>
          </div>
        </div>
      </div>
    );
  }

  const storeFont = settings?.storeFont || 'tajawal';
  const fontClass = `font-${storeFont}`;

  return (
    <div 
      id="app-root" 
      className={`min-h-screen flex flex-col transition-all duration-300 ${isDarkMode ? 'dark bg-gray-950 text-white' : 'bg-gray-50'} ${fontClass}`} 
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
      <main className={`flex-1 w-full pb-24 sm:pb-28 ${isIndependentStore ? '' : 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-8'}`}>
        <Routes>
          <Route path="/" element={<StoreFront />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/product/:productId" element={<ProductDetail />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/store/:userId" element={<StoreProfile />} />
          <Route path="/s/:slug" element={<StoreSite />} />
          <Route path="/s/:slug/cart" element={<Cart />} />
          <Route path="/s/:slug/orders" element={<Orders />} />
          <Route path="/s/:slug/product/:productId" element={<ProductDetail />} />
          <Route path="/store-site/:slug" element={<StoreSite />} />
          <Route path="/search-stores" element={<StoreSearch />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Toaster 
        position="top-center" 
        gutter={8}
        containerStyle={{
          top: 24,
        }}
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '16px',
            background: '#0f172a',
            color: '#fff',
            padding: '12px 20px',
            fontWeight: 'bold',
            fontSize: '13px',
            direction: 'rtl',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </Router>
  );
}
