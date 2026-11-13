import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, Camera, Check, FileText, Store, ShieldCheck, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

const makeSvgAvatar = (bg: string, letter: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="48" font-weight="bold">${letter}</text></svg>`
  )}`;

const PRESET_AVATARS = [
  makeSvgAvatar('#111214', 'أ'),
  makeSvgAvatar('#0d6e4e', 'م'),
  makeSvgAvatar('#1d4ed8', 'ع'),
  makeSvgAvatar('#b45309', 'س'),
  makeSvgAvatar('#be123c', 'ن'),
];

export default function LoginPage() {
  const { user, loginWithPassword, registerWithStore, updateUserProfile, settings, getThemeClasses } = useAppContext();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [regLoading, setRegLoading] = useState(false);

  const [isOptionalStep, setIsOptionalStep] = useState(false);
  const [optDisplayName, setOptDisplayName] = useState('');
  const [optPhone, setOptPhone] = useState('');
  const [optPhotoURL, setOptPhotoURL] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

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
    <div className="min-h-[82vh] flex items-center justify-center py-6 px-2" dir="rtl">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
        {/* Editorial Brand Showcase Column (Desktop) */}
        <div className="lg:col-span-5 bg-[#FAF9F6] dark:bg-[#101216] p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-e border-[#E5E2DA] dark:border-[#232730]">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-white dark:bg-[#1C1F26] rounded-lg flex items-center justify-center border border-[#E5E2DA] dark:border-[#232730] overflow-hidden p-1.5">
              {settings?.storeLogo ? (
                <img src={settings.storeLogo} alt={settings?.storeName || 'شعار المتجر'} className="w-full h-full object-contain" />
              ) : (
                <Store className={`w-6 h-6 ${getThemeClasses('text')}`} />
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] tracking-tight">
                {settings?.storeName || 'يمن ستور'}
              </h1>
              <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 mt-2 leading-relaxed">
                بوابة موحدة لإدارة مشترياتك، تتبع الشحنات عبر الخريطة، والحجز المسبق لدى المتاجر المعتمدة.
              </p>
            </div>
          </div>

          <div className="hidden lg:block space-y-3 pt-8 border-t border-[#E5E2DA] dark:border-[#232730] mt-8 text-xs text-[#5C5B57] dark:text-zinc-400">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>توثيق التجار وضمان الحجز المسبق بالعربون</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-[#111214] dark:text-zinc-300 shrink-0" />
              <span>إحداثيات GPS دقيقة لتسليم الطلبات مباشرة</span>
            </div>
          </div>
        </div>

        {/* Auth Form Workspace */}
        <div className="lg:col-span-7 p-6 sm:p-8">
          {isOptionalStep ? (
            <form onSubmit={handleSaveOptionalProfile} className="space-y-4">
              <div className="border-b border-[#E5E2DA] dark:border-[#232730] pb-3">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">خطوة اختيارية</p>
                <h2 className="font-display text-lg font-extrabold text-[#111214] dark:text-[#F4F4F2] mt-0.5">تخصيص ملفك الشخصي</h2>
                <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-1">
                  يمكنك إضافة صورة واسم ظاهر ورقم هاتف الآن، أو التخطي للمتابعة.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 pt-1">
                <div className="relative">
                  <div className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${getThemeClasses('border')} bg-[#EFEDE6] dark:bg-[#1C1F26] flex items-center justify-center`}>
                    {optPhotoURL ? (
                      <img src={optPhotoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-[#5C5B57]" />
                    )}
                  </div>
                  <label className={`absolute -bottom-1.5 -left-1.5 p-1.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')} rounded-md border border-white dark:border-[#131519] cursor-pointer`}>
                    <Camera className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileUpload}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setOptPhotoURL(url)}
                      className={`w-8 h-8 rounded-lg overflow-hidden border transition-opacity ${
                        optPhotoURL === url ? `ring-2 ${getThemeClasses('ring')} opacity-100` : 'opacity-75 hover:opacity-100 border-[#E5E2DA] dark:border-[#232730]'
                      }`}
                    >
                      <img src={url} alt={`شعار ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">الاسم الظاهر في المتجر</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#5C5B57]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={optDisplayName}
                    onChange={(e) => setOptDisplayName(e.target.value)}
                    placeholder="اسمك الظاهر للجميع"
                    className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">رقم الهاتف (لتأكيد الطلبات)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#5C5B57]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={optPhone}
                    onChange={(e) => setOptPhone(e.target.value)}
                    placeholder="77XXXXXXX"
                    className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className={`w-full min-h-[46px] py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
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
                  className="w-full min-h-[40px] py-2 px-4 rounded-lg text-xs font-bold text-[#5C5B57] hover:text-[#111214] dark:hover:text-white transition-colors"
                >
                  تخطي الآن ودخول المتجر مباشرة
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Flush Underline Auth Tabs */}
              <div className="flex border-b border-[#E5E2DA] dark:border-[#232730]">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 min-h-[44px] py-2.5 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'login'
                      ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                      : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 min-h-[44px] py-2.5 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'register'
                      ? `${getThemeClasses('border')} text-[#111214] dark:text-white`
                      : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white'
                  }`}
                >
                  إنشاء حساب جديد
                </button>
              </div>

              {activeTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">البريد الإلكتروني</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#5C5B57]">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">كلمة المرور</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#5C5B57]">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="كلمة المرور الخاصة بك"
                        className="w-full min-h-[44px] pr-10 pl-11 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#5C5B57] hover:text-[#111214] dark:hover:text-white"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className={`w-full min-h-[46px] py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
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

                  <div className="pt-1 text-center">
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
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">الاسم الكامل أو اللقب</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#5C5B57]">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="اسمك الكامل"
                        className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">البريد الإلكتروني</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#5C5B57]">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>يُستخدم كبريد تعريفي فريد لحسابك في المتجر.</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-[#111214] dark:text-zinc-300">كلمة المرور</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#5C5B57]">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="4 أحرف على الأقل"
                        className="w-full min-h-[44px] pr-10 pl-11 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#5C5B57] hover:text-[#111214] dark:hover:text-white"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-[#D5D1C7] cursor-pointer"
                      />
                      <span className="text-xs text-amber-950 dark:text-amber-200 font-medium leading-relaxed">
                        أوافق على{' '}
                        <button
                          type="button"
                          onClick={handleOpenDisclaimer}
                          className={`underline font-bold hover:opacity-80 inline-flex items-center gap-0.5 ${getThemeClasses('text')}`}
                        >
                          <FileText className="w-3 h-3" />
                          شروط وسياسات الاستخدام وإخلاء المسؤولية
                        </button>
                        {' '}وتنبيهات الأمان والحماية من النصب والاحتيال في المتجر.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={regLoading || !agreedToTerms}
                    className={`w-full min-h-[46px] py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    {regLoading ? (
                      <span>جاري إنشاء الحساب...</span>
                    ) : (
                      <>
                        <span>إنشاء حساب جديد</span>
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
