import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { User, Shield, LogOut, Camera, Loader2, LayoutDashboard, Moon, Sun, Lock, Eye, EyeOff, KeyRound, CheckCircle2, Palette, Bike } from 'lucide-react';
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
    changePassword,
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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPasswordStatusMsg(null);

    const trimmedNew = newPassword.trim();
    if (trimmedNew.length < 4) {
      const msg = 'يجب أن تكون كلمة المرور الجديدة 4 أحرف على الأقل';
      setPasswordStatusMsg({ type: 'error', text: msg });
      toast.error(msg);
      return;
    }

    if (trimmedNew !== confirmPassword.trim()) {
      const msg = 'كلمة المرور الجديدة وتأكيدها غير متطابقين';
      setPasswordStatusMsg({ type: 'error', text: msg });
      toast.error(msg);
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword(trimmedNew, currentPassword.trim() || undefined);
      if (res.success) {
        setPasswordStatusMsg({ type: 'success', text: res.message || 'تم تحديث كلمة المرور بنجاح' });
        toast.success(res.message || 'تم تغيير كلمة المرور بنجاح');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatusMsg({ type: 'error', text: res.message || 'فشل تغيير كلمة المرور' });
        toast.error(res.message || 'فشل تغيير كلمة المرور');
      }
    } finally {
      setIsChangingPassword(false);
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
            <p className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400 mt-0.5 dir-ltr">{user.email}</p>

            {isAdmin && (
              <div className="mt-4 w-full p-3 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] flex items-center gap-2.5 text-right">
                <Shield className={`h-4 w-4 shrink-0 ${getThemeClasses('text')}`} />
                <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">حساب إداري معتمد</span>
              </div>
            )}

            <div className="w-full space-y-2 mt-5 pt-5 border-t border-[#E5E2DA] dark:border-[#232730]">
              {(isAdmin || isStore) && (
                <Link
                  to="/admin"
                  className={`w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>الانتقال إلى لوحة التحكم</span>
                </Link>
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

          {/* Change Password Card */}
          <div className="p-5 sm:p-6 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4.5 h-4.5 text-[#111214] dark:text-[#F4F4F2]" />
                <div>
                  <h3 className="font-display text-base font-extrabold text-[#111214] dark:text-[#F4F4F2]">تغيير كلمة المرور</h3>
                  <p className="text-xs text-[#5C5B57] dark:text-zinc-400">تحديث كلمة مرور الدخول الخاصة بحسابك</p>
                </div>
              </div>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="text-xs font-bold text-[#5C5B57] dark:text-zinc-300 underline hover:text-[#111214] dark:hover:text-white shrink-0"
                >
                  إدارة الأعضاء ←
                </Link>
              )}
            </div>

            {passwordStatusMsg && (
              <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 border ${
                passwordStatusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordStatusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">
                  كلمة المرور الحالية <span className="text-[11px] font-normal text-[#5C5B57] dark:text-zinc-400">(اختياري للدخول بجوجل أو رمز التحقق)</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full min-h-[44px] border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] rounded-lg px-3.5 py-2.5 pl-10 outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5B57] hover:text-[#111214] dark:hover:text-white"
                    tabIndex={-1}
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">
                    كلمة المرور الجديدة
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="4 أحرف على الأقل"
                      dir="ltr"
                      className="w-full min-h-[44px] border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] rounded-lg px-3.5 py-2.5 pl-10 outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5B57] hover:text-[#111214] dark:hover:text-white"
                      tabIndex={-1}
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    dir="ltr"
                    className="w-full min-h-[44px] border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] rounded-lg px-3.5 py-2.5 outline-none focus:border-[#111214] dark:focus:border-zinc-400 text-left font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="min-h-[44px] flex items-center justify-center gap-2 font-bold text-sm rounded-lg px-6 py-2.5 transition-colors bg-[#111214] hover:bg-[#24262B] text-white dark:bg-[#F4F4F2] dark:hover:bg-[#E4E4E0] dark:text-[#111214] disabled:opacity-50"
                >
                  {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>{isChangingPassword ? 'جاري التحديث...' : 'حفظ كلمة المرور'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
