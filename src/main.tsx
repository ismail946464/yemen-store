import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { safeSessionGet, safeSessionSet, safeSessionRemove } from './lib/deviceSafe';

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
}

class RootErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  declare props: Readonly<{ children: ReactNode }>;
  state: ErrorBoundaryState = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const msg = error instanceof Error ? error.message : String(error || '');
    const isChunkError = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg);
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error || '');
    const isChunkError = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg);
    if (isChunkError && !safeSessionGet('chunk_reload_retry')) {
      safeSessionSet('chunk_reload_retry', '1');
      window.location.reload();
    }
  }

  handleReload = () => {
    safeSessionRemove('chunk_reload_retry');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center bg-[#F6F5F0] text-[#111214] px-4 py-8"
        >
          <div className="max-w-md w-full rounded-xl border border-[#E5E2DA] bg-white p-6 text-center space-y-4 shadow-sm">
            <h1 className="text-lg font-extrabold">
              {this.state.isChunkError ? 'يتوفر تحديث جديد للمنصة' : 'حدث خطأ غير متوقع أثناء عرض الصفحة'}
            </h1>
            <p className="text-sm text-[#5C5B57] leading-relaxed">
              {this.state.isChunkError
                ? 'تم نشر نسخة محدثة من الموقع. يرجى إعادة تحميل الصفحة لتعمل جميع الميزات بشكل صحيح على جهازك.'
                : 'نعتذر عن هذا الخلل. يمكنك إعادة تحميل الصفحة للمتابعة.'}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full min-h-[44px] rounded-lg bg-[#111214] text-white text-sm font-bold hover:opacity-90 transition"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Clear one-time chunk reload flag once the app mounts cleanly
try {
  if (typeof window !== 'undefined') {
    window.setTimeout(() => safeSessionRemove('chunk_reload_retry'), 4000);
  }
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);

// Register Service Worker for PWA safely
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration failures in restricted WebViews or private browsing
    });
  });
}
