import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, Sparkles, ShieldCheck, Camera, Check, FileText, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
];

export default function LoginPage() {
  const { user, loginWithPassword, registerWithStore, updateUserProfile, settings, getThemeClasses, isDarkMode } = useAppContext();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state (Step 1)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [regLoading, setRegLoading] = useState(false);

  // Step 2: Optional profile details state
  const [isOptionalStep, setIsOptionalStep] = useState(false);
  const [optDisplayName, setOptDisplayName] = useState('');
  const [optPhone, setOptPhone] = useState('');
  const [optPhotoURL, setOptPhotoURL] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // If already logged in, redirect home
  useEffect(() => {
    if (user && !isOptionalStep) {
      navigate('/');
    }
  }, [user, navigate, isOptionalStep]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!email || !email.includes('@')) {
      toast.error('يرجى إدخال بريد إلكتروني صالح');
      return;
    }
    if (!password) {
      toast.error('يرجى إدخال كلمة المرور الخاصة بحسابك');
      return;
    }

    setLoginLoading(true);
    try {
      const success = await loginWithPassword(email, password);
      if (success) {
        navigate('/');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = regEmail.trim().toLowerCase();
    const name = regName.trim();
    const password = regPassword.trim();

    if (!name) {
      toast.error('يرجى كتابة الاسم أو اللقب');
      return;
    }
    if (!email || !email.includes('@')) {
      toast.error('يرجى إدخال بريد إلكتروني صالح');
      return;
    }
    if (!password || password.length < 4) {
      toast.error('يرجى تحديد كلمة مرور لا تقل عن 4 خانات');
      return;
    }
    if (!agreedToTerms) {
      toast.error('يجب الموافقة على شروط الاستخدام وسياسات الأمان للمتابعة');
      return;
    }

    setRegLoading(true);
    try {
      const result = await registerWithStore(email, name, password);
      if (result.success) {
        toast.success('تم إنشاء حسابك بنجاح!');
        // Proceed to optional profile completion step
        setOptDisplayName(name);
        setIsOptionalStep(true);
      }
    } finally {
      setRegLoading(false);
    }
  };

  const handleSaveOptionalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateUserProfile({
        name: optDisplayName.trim() || regName,
        phone: optPhone.trim(),
        photoURL: optPhotoURL.trim()
      });
      toast.success('تم حفظ معلوماتك بنجاح!');
      setIsOptionalStep(false);
      navigate('/');
    } catch {
      toast.error('فشل في حفظ البيانات الاختيارية');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSkipOptionalProfile = () => {
    setIsOptionalStep(false);
    navigate('/');
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('حجم الصورة كبير، يرجى اختيار صورة أقل من 2 ميغابايت');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setOptPhotoURL(reader.result as string);
        toast.success('تم اختيار الصورة الشخصية');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenDisclaimer = (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('open-disclaimer-modal'));
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4" dir="rtl">
      <div 
        className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border transition-all ${
          isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'
        }`}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700 p-6 sm:p-8 text-white text-center">
          <div className="w-14 h-14 mx-auto mb-2 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner overflow-hidden p-1">
            {settings?.storeLogo ? (
              <img src={settings.storeLogo} alt={settings?.storeName || 'شعار المتجر'} className="w-full h-full object-contain rounded-xl" />
            ) : (
              <Store className="w-7 h-7 text-white" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black">{settings?.storeName || 'متجر يمن ستور'}</h1>
          <p className="text-xs text-white/80 mt-1 font-medium">نظام الحسابات الخاص بالمتجر</p>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8">
          {isOptionalStep ? (
            /* Step 2: Optional Info Step */
            <form onSubmit={handleSaveOptionalProfile} className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-black mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  خطوة إضافية (اختيارية)
                </span>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">تخصيص ملفك الشخصي</h2>
                <p className="text-xs text-gray-500 mt-1">
                  يمكنك إضافة صورة واسم ظاهر ورقم هاتف الآن، أو تخطي هذه الخطوة مباشرة.
                </p>
              </div>

              {/* Avatar selection & upload */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="relative group">
                  <div className={`w-20 h-20 rounded-full overflow-hidden border-2 ${getThemeClasses('border')} shadow-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center`}>
                    {optPhotoURL ? (
                      <img src={optPhotoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <label className={`absolute bottom-0 left-0 p-1.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-full shadow-lg cursor-pointer transition`}>
                    <Camera className="w-4 h-4" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarFileUpload} 
                    />
                  </label>
                </div>

                {/* Quick Avatar Presets */}
                <div className="flex items-center gap-2">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setOptPhotoURL(url)}
                      className={`w-7 h-7 rounded-full overflow-hidden border transition ${
                        optPhotoURL === url ? `ring-2 ${getThemeClasses('ring')} scale-110` : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold mb-1.5">الاسم الظاهر في المتجر</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={optDisplayName}
                    onChange={(e) => setOptDisplayName(e.target.value)}
                    placeholder="اسمك الظاهر للجميع"
                    className={`w-full pr-10 pl-4 py-3 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold mb-1.5">رقم الهاتف (للتواصل وتأكيد الطلبات)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={optPhone}
                    onChange={(e) => setOptPhone(e.target.value)}
                    placeholder="77XXXXXXX"
                    className={`w-full pr-10 pl-4 py-3 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-3">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-white text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                >
                  {savingProfile ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ والمتابعة إلى المتجر</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSkipOptionalProfile}
                  className="w-full py-2.5 px-4 rounded-2xl text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition"
                >
                  تخطي الآن ودخول المتجر مباشرة
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition ${
                    activeTab === 'login'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition ${
                    activeTab === 'register'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  إنشاء حساب جديد
                </button>
              </div>

              {activeTab === 'login' ? (
                /* Login Form */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">البريد الإلكتروني</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="name@example.com"
                        className={`w-full pr-10 pl-4 py-3 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">كلمة المرور</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="كلمة المرور الخاصة بك"
                        className={`w-full pr-10 pl-11 py-3 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 hover:text-gray-600 transition"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className={`w-full py-4 px-4 rounded-2xl font-black text-white text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    {loginLoading ? (
                      <span>جاري تسجيل الدخول...</span>
                    ) : (
                      <>
                        <span>تسجيل الدخول إلى حسابي</span>
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('register')}
                      className={`text-xs ${getThemeClasses('text')} font-bold hover:underline`}
                    >
                      ليس لديك حساب؟ اضغط هنا لإنشاء حساب جديد
                    </button>
                  </div>
                </form>
              ) : (
                /* Register Form */
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">الاسم الكامل أو اللقب</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="اسمك الكامل"
                        className={`w-full pr-10 pl-4 py-3 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${getThemeClasses('ring')} ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">البريد الإلكتروني</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@example.com"
                        className={`w-full pr-10 pl-4 py-3 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${getThemeClasses('ring')} ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        dir="ltr"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      🔒 يمنع تكرار البريد في النظام، وسيكون معرّفك الدائم في المتجر.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">كلمة المرور (تحددها بنفسك)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور الخاصة بك"
                        className={`w-full pr-10 pl-11 py-3 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${getThemeClasses('ring')} ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 hover:text-gray-600 transition"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Agreement Checkbox - Shown ONLY during registration */}
                  <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-3.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className={`mt-0.5 w-4 h-4 rounded border-gray-300 focus:ring-2 ${getThemeClasses('ring')} cursor-pointer`}
                      />
                      <span className="text-xs text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
                        أوافق على{' '}
                        <button
                          type="button"
                          onClick={handleOpenDisclaimer}
                          className={`underline font-black hover:opacity-80 inline-flex items-center gap-0.5 ${getThemeClasses('text')}`}
                        >
                          <FileText className="w-3 h-3" />
                          شروط وسياسات الاستخدام وإخلاء المسؤولية
                        </button>
                        {' '}وتنبيهات الأمان والحماية من النصب والاحتيال في المتجر.
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 pb-2">
                    <button
                      type="submit"
                      disabled={regLoading || !agreedToTerms}
                      className={`w-full py-4 px-4 rounded-2xl font-black text-white text-sm shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                    >
                      {regLoading ? (
                        <span>جاري إنشاء الحساب...</span>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>إنشاء حساب جديد</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
