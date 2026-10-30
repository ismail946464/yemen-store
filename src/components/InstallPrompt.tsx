import { useState, useEffect } from 'react';
import { Download, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../AppContext';

export default function InstallPrompt() {
  const { settings } = useAppContext();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone 
        || document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();

    const sendSystemNotification = () => {
      if ('Notification' in window && Notification.permission === 'granted' && !standalone) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(settings?.storeName || 'يمن ستور', {
            body: 'قم بتثبيت التطبيق الآن للوصول السريع والمنتجات الحصرية!',
            icon: settings?.storeLogo || 'https://cdn-icons-png.flaticon.com/512/3750/3750019.png',
            badge: settings?.storeLogo || 'https://cdn-icons-png.flaticon.com/512/3750/3750019.png',
            tag: 'install-yemen-store',
            requireInteraction: true, // This makes it stay in the notification shade
            vibrate: [200, 100, 200],
            dir: 'rtl'
          } as any);
        });
      }
    };

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!standalone) {
        setShowPrompt(true);
        // Request notification permission to send the "sticky" notification
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') sendSystemNotification();
          });
        } else if (Notification.permission === 'granted') {
          sendSystemNotification();
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      // Close notification if it exists
      if ('Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(reg => {
              reg.getNotifications({ tag: 'install-yemen-store' }).then(notifications => {
                  notifications.forEach(n => n.close());
              });
          });
      }
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-black text-white px-4 py-3 border-b border-yellow-500/50 relative z-[100]"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded-full animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.5)]">
              <BellRing className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white">تطبيق {settings?.storeName || 'يمن ستور'} بحاجة للتثبيت</h3>
              <p className="text-[9px] text-gray-400 font-bold hidden xs:block">سيبقى هذا الإشعار حتى تكتمل عملية التثبيت</p>
            </div>
          </div>

          <button 
            onClick={handleInstallClick}
            className="bg-yellow-400 text-black text-[10px] sm:text-xs font-black px-6 py-2 rounded-full hover:bg-yellow-300 transition-all flex items-center gap-2 shrink-0 active:scale-95 whitespace-nowrap"
          >
            <Download className="w-3 h-3" />
            تثبيت الآن
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
