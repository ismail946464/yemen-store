import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  User, Shield, LogOut, Camera, Loader2, LayoutDashboard, Moon, Sun,
  Lock, KeyRound, Palette, Bike, Store
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Profile() {
  const {
    user,
    userData,
    isAdmin,
    isStore,
    isDelivery,
    logout,
    getThemeClasses,
    isDarkMode,
    toggleDarkMode,
    updateUserProfile,
    effectiveTheme,
    setUserTheme,
    allowUserThemeOverride
  } = useAppContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setPhone(userData.phone || '');
      setPhotoURL(userData.photoURL || '');
    }
  }, [userData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً (الأقصى 1 ميجابايت)");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const result = await promise;
      setPhotoURL(result);
      toast.success("تم اختيار الصورة، اضغط حفظ لتطبيق التغييرات");
    } catch (error) {
      console.error(error);
      toast.error("فشل معالجة الصورة");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setMessage('');
    try {
      const targetUid = (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' || user.uid === 'u_32cd7332ee7ec2e0c1121512')
        ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2'
        : user.uid;

      await setDoc(doc(db, 'users', targetUid), {
        name,
        phone,
        photoURL
      }, { merge: true });

      await updateUserProfile({ name, phone, photoURL });

      if (isAdmin || isStore) {
        await setDoc(doc(db, 'storeProfiles', targetUid), {
          name,
          logoUrl: photoURL,
          whatsapp: phone
        }, { merge: true }).catch(() => {});
      }

      setMessage('تم التحديث بنجاح!');
      toast.success("تم تحديث وحفظ الملف الشخصي بنجاح");
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setMessage('حدث خطأ أثناء التحديث.');
      toast.error("حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4" dir="rtl">
        <div className="w-16 h-16 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center mb-4">
          <User className="h-8 w-8 text-[#5C5B57] dark:text-zinc-400" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] mb-2">الملف الشخصي</h2>
        <p className="text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mb-5">
          الرجاء تسجيل الدخول لعرض وإدارة حسابك الشخصي
        </p>
        <Link
          to="/login"
          className={`${getThemeClasses('bg')} ${getThemeClasses('hover')} min-h-[44px] px-6 py-2.5 rounded-lg text-sm font-bold transition-colors inline-flex items-center`}
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E5E2DA] dark:border-[#232730] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight">
            إعدادات الحساب الشخصي
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 mt-1">
            تحديث بياناتك الشخصية، كلمة المرور، وتفضيلات مظهر المنصة
          </p>
        </div>

        <button
          type="button"
          onClick={toggleDarkMode}
          className="min-h-[42px] px-4 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors flex items-center gap-2 text-xs font-bold"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          <span>{isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
        </button>
      </div>

      {/* 12-Column Settings Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Identity & Quick Navigation Column */}
        <div className="lg:col-span-4 space-y-5">
          <div className="p-6 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex flex-col items-center text-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-lg border border-[#E5E2DA] dark:border-[#232730] overflow-hidden bg-[#EFEDE6] dark:bg-[#1C1F26] flex items-center justify-center relative">
                {photoURL ? (
                  <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-[#5C5B57]" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`absolute -bottom-1.5 -left-1.5 p-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')} rounded-md border border-white dark:border-[#131519] transition-colors`}
                title="تغيير الصورة"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            <h2 className="font-display text-lg font-extrabold text-[#111214] dark:text-[#F4F4F2] mt-4">
              {name || 'مستخدم جديد'}
            </h2>
            <p dir="ltr" className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400 mt-0.5">{user.email}</p>

            {isAdmin && (
              <div className="mt-4 w-full p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] flex items-center gap-2.5 text-right">
                <Shield className={`h-4 w-4 shrink-0 ${getThemeClasses('text')}`} />
                <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">حساب إداري معتمد</span>
              </div>
            )}

            <div className="w-full space-y-2 mt-5 pt-5 border-t border-[#E5E2DA] dark:border-[#232730]">
              {(isAdmin || isStore) && (
                <>
                  <Link
                    to="/admin"
                    className={`w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>الانتقال إلى لوحة التحكم</span>
                  </Link>
                  <Link
                    to="/admin?tab=store-profile"
                    className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] text-[#111214] dark:text-[#F4F4F2] transition-colors"
                  >
                    <Store className="w-4 h-4" />
                    <span>إدارة الملف التجاري والعنوان الفعلي</span>
                  </Link>
                </>
              )}

              {isDelivery && (
                <Link
                  to="/delivery"
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] hover:bg-[#EFEDE6] dark:hover:bg-[#232730] transition-colors"
                >
                  <Bike className="w-4 h-4" />
                  <span>بوابة مندوب التوصيل</span>
                </Link>
              )}

              <button
                type="button"
                onClick={() => logout()}
                className="w-full min-h-[42px] flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs rounded-lg py-2 transition-colors"
              >
                <LogOut className="h-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>

          {/* Theme Palette Switcher */}
          <div className="p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className={`w-4 h-4 ${getThemeClasses('text')}`} />
                <h3 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">نمط وألوان المنصة</h3>
              </div>
              <span className="text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-400">
                {allowUserThemeOverride ? 'تخصيص حر' : 'موحد'}
              </span>
            </div>

            {allowUserThemeOverride ? (
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'white', name: 'حجري', color: '#f6f5f0', border: 'border-[#111214]' },
                  { id: 'green', name: 'زمردي', color: '#0d6e4e', border: 'border-[#0d6e4e]' },
                  { id: 'blue', name: 'أزرق', color: '#1d4ed8', border: 'border-[#1d4ed8]' },
                  { id: 'red', name: 'قرمزي', color: '#be123c', border: 'border-[#be123c]' },
                  { id: 'black', name: 'داكن', color: '#09090b', border: 'border-zinc-900' }
                ].map((t) => {
                  const isSelected = effectiveTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setUserTheme(t.id as any);
                        toast.success(`تم تغيير ستايل الموقع إلى ${t.name}`, { id: 'theme-change' });
                      }}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-[#EFEDE6] dark:bg-[#1C1F26] border-[#111214] dark:border-white'
                          : 'border-[#E5E2DA] dark:border-[#232730] hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border ${t.id === 'white' ? 'border-[#111214]/30' : 'border-transparent'}`}
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-[10px] font-bold text-[#111214] dark:text-zinc-200">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-xs flex items-center gap-2.5 text-[#5C5B57] dark:text-zinc-300">
                <Lock className="w-4 h-4 shrink-0" />
                <span>تم توحيد مظهر المنصة من قبل الإدارة ({effectiveTheme}).</span>
              </div>
            )}
          </div>
        </div>

        {/* Account Forms Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Personal Info Form */}
          <div className="p-5 sm:p-6 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-5">
            <div className="pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
              <h3 className="font-display text-base font-extrabold text-[#111214] dark:text-[#F4F4F2]">المعلومات الشخصية</h3>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400">تظهر هذه البيانات في طلباتك وللتواصل مع المتاجر والمندوبين</p>
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-xs font-bold border ${
                message.includes('نجاح')
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}>
                {message}
              </div>
            )}

            <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">الاسم الكريم</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full min-h-[44px] border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] rounded-lg px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-right"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">رقم الهاتف (اختياري)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full min-h-[44px] border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] rounded-lg px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left"
                  dir="ltr"
                  placeholder="+967..."
                />
              </div>
              <div className="sm:col-span-2 flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`${getThemeClasses('bg')} ${getThemeClasses('hover')} font-bold text-sm rounded-lg px-6 py-2.5 transition-colors disabled:opacity-50 min-h-[44px]`}
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>

          {/* Compact Change Password Link */}
          <div className="flex items-center justify-start px-1 pt-0.5">
            <Link
              to="/change-password"
              className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold rounded-md px-2 py-1 transition-colors border border-transparent ${
                effectiveTheme === 'red'
                  ? 'text-red-700 hover:text-red-800 hover:bg-red-100/70 hover:border-red-200 dark:text-rose-300 dark:hover:text-rose-200 dark:hover:bg-rose-950/50 dark:hover:border-rose-800/60'
                  : effectiveTheme === 'black'
                    ? 'text-red-600 hover:text-red-700 hover:bg-zinc-200/70 hover:border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-zinc-900 dark:hover:border-red-900/50'
                    : 'text-red-600 hover:text-red-700 hover:bg-red-50/90 hover:border-red-200/80 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/35 dark:hover:border-rose-900/50'
              }`}
            >
              <KeyRound className="w-3 h-3 shrink-0" />
              <span className="underline underline-offset-4">تغيير كلمة المرور</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
