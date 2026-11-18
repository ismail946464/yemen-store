export function safeLocalGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore quota or private-mode security errors
  }
}

export function safeLocalRemove(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {
    // Ignore private-mode security errors
  }
}

export function safeSessionGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore quota or private-mode security errors
  }
}

export function safeSessionRemove(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore private-mode security errors
  }
}

export function requestNotificationPermissionSafely(onResult?: (perm: NotificationPermission) => void): void {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const NotificationApi = window.Notification;
    if (!NotificationApi || typeof NotificationApi.requestPermission !== 'function') return;
    if (NotificationApi.permission !== 'default') {
      onResult?.(NotificationApi.permission);
      return;
    }
    const maybePromise = NotificationApi.requestPermission((perm) => {
      onResult?.(perm);
    });
    if (maybePromise && typeof (maybePromise as Promise<NotificationPermission>).then === 'function') {
      (maybePromise as Promise<NotificationPermission>)
        .then((perm) => onResult?.(perm))
        .catch(() => {});
    }
  } catch {
    // Older iOS Safari / restricted WebViews may disallow Notification API
  }
}

export function showBrowserNotificationSafely(title: string, options?: NotificationOptions): void {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'granted') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          if (reg && typeof reg.showNotification === 'function') {
            return reg.showNotification(title, options);
          }
        })
        .catch(() => {});
      return;
    }

    new window.Notification(title, options);
  } catch {
    // Android Chrome forbids `new Notification()` directly outside ServiceWorker; ignore safely
  }
}

const UNIFIED_ARABIC_LOCALE = 'ar-YE-u-ca-gregory-nu-latn';

export function createSafeDateFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(UNIFIED_ARABIC_LOCALE, options);
  } catch {
    try {
      return new Intl.DateTimeFormat('ar-YE', options);
    } catch {
      return new Intl.DateTimeFormat('en-GB', options);
    }
  }
}

const DEFAULT_DATE_FMT = createSafeDateFormatter({ year: 'numeric', month: 'numeric', day: 'numeric' });
const DEFAULT_TIME_FMT = createSafeDateFormatter({ hour: '2-digit', minute: '2-digit' });
const DEFAULT_DATETIME_FMT = createSafeDateFormatter({
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const DEFAULT_LONG_DATE_FMT = createSafeDateFormatter({ year: 'numeric', month: 'long', day: 'numeric' });
const DEFAULT_WEEKDAY_DATE_FMT = createSafeDateFormatter({
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
const DEFAULT_MONTH_YEAR_FMT = createSafeDateFormatter({ year: 'numeric', month: 'long' });

export function formatArabicDate(
  input: string | number | Date | null | undefined,
  customFormatter?: Intl.DateTimeFormat
): string {
  if (!input) return '';
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    return (customFormatter || DEFAULT_DATE_FMT).format(d);
  } catch {
    return '';
  }
}

export function formatArabicTime(
  input: string | number | Date | null | undefined,
  customFormatter?: Intl.DateTimeFormat
): string {
  if (!input) return '';
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    return (customFormatter || DEFAULT_TIME_FMT).format(d);
  } catch {
    return '';
  }
}

export function formatArabicDateTime(
  input: string | number | Date | null | undefined,
  customFormatter?: Intl.DateTimeFormat
): string {
  if (!input) return '';
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    return (customFormatter || DEFAULT_DATETIME_FMT).format(d);
  } catch {
    return '';
  }
}

export function formatArabicLongDate(input: string | number | Date | null | undefined): string {
  return formatArabicDate(input, DEFAULT_LONG_DATE_FMT);
}

export function formatArabicWeekdayDate(input: string | number | Date | null | undefined): string {
  return formatArabicDate(input, DEFAULT_WEEKDAY_DATE_FMT);
}

export function formatArabicMonthYear(input: string | number | Date | null | undefined): string {
  return formatArabicDate(input, DEFAULT_MONTH_YEAR_FMT);
}

export async function safeCopyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const str = String(text ?? '');
  try {
    if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(str);
      return true;
    }
  } catch {
    // Fallback below for iOS Safari / Android WebView / non-HTTPS contexts
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = str;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, str.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return Boolean(copied);
  } catch {
    return false;
  }
}

