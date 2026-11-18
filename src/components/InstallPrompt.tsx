import { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { requestNotificationPermissionSafely } from '../lib/deviceSafe';

export default function InstallPrompt() {
  const { settings, getThemeClasses } = useAppContext();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      try {
        const isStandaloneMode = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
          || Boolean((window.navigator as any).standalone)
          || document.referrer.includes('android-app://');
        setIsStandalone(isStandaloneMode);
        return isStandaloneMode;
      } catch {
        return false;
      }
    };

    const standalone = checkStandalone();

    const sendSystemNotification = () => {
      try {
        if ('Notification' in window && Notification.permission === 'granted' && !standalone && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            if (registration && typeof registration.showNotification === 'function') {
              registration.showNotification(settings?.storeName || 'يمن ستور', {
                body: 'قم بتثبيت التطبيق للوصول السريع وإدارة الطلبات.',
                icon: settings?.storeLogo || '/pwa-192x192.png',
                badge: settings?.storeLogo || '/pwa-192x192.png',
                tag: 'install-yemen-store',
                requireInteraction: true,
                dir: 'rtl'
              } as any);
            }
          }).catch(() => {});
        }
      } catch {}
    };

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!standalone) {
        setShowPrompt(true);
        requestNotificationPermissionSafely((permission) => {
          if (permission === 'granted') sendSystemNotification();
        });
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    const installedHandler = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      try {
        if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            if (reg && typeof reg.getNotifications === 'function') {
              reg.getNotifications({ tag: 'install-yemen-store' }).then(notifications => {
                notifications.forEach(n => n.close());
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      } catch {}
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
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
    <div className="bg-[#111214] dark:bg-[#131519] text-[#F4F4F2] px-4 py-2.5 border-b border-[#232730] relative z-[100] transition-all duration-150">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1C1F26] border border-[#2C313C] flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-[#F4F4F2]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold truncate">
              تثبيت تطبيق {settings?.storeName || 'يمن ستور'}
            </p>
            <p className="text-[11px] text-zinc-400 hidden sm:block truncate">
              وصول مباشر وسريع من الشاشة الرئيسية لجهازك
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className={`min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>تثبيت</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPrompt(false)}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#1C1F26] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
