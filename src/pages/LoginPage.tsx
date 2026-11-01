import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, Phone, Eye, EyeOff, Copy, Check, ArrowRight, Sparkles, ShieldCheck, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, loginWithPassword, registerWithStore, settings, getThemeClasses, isDarkMode } = useAppContext();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Registration success state (shows generated password)
  const [newlyCreatedPassword, setNewlyCreatedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If already logged in, redirect home
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

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

    if (!email || !email.includes('@')) {
      toast.error('يرجى إدخال بريد إلكتروني صالح');
      return;
    }
    if (!name) {
      toast.error('يرجى كتابة الاسم أو اللقب');
      return;
    }

    setRegLoading(true);
    try {
      const result = await registerWithStore(email, name, regPhone.trim());
      if (result.success && result.password) {
        setNewlyCreatedPassword(result.password);
        toast.success('تم إنشاء الحساب وتوليد كلمة المرور بنجاح!');
      }
    } finally {
      setRegLoading(false);
    }
  };

  const handleCopyPassword = () => {
    if (!newlyCreatedPassword) return;
    navigator.clipboard.writeText(newlyCreatedPassword);
    setCopied(true);
    toast.success('تم نسخ كلمة المرور بنجاح! احتفظ بها.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleFinishRegistration = () => {
    setNewlyCreatedPassword(null);
    navigate('/');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4" dir="rtl">
      <div 
        className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border transition-all ${
          isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'
        }`}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700 p-8 text-white text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
            <span className="text-3xl">🇾🇪</span>
          </div>

          <h1 className="text-2xl font-black">{settings?.storeName || 'متجر يمن ستور'}</h1>
          <p className="text-xs text-white/80 mt-1 font-medium">نظام الحسابات الداخلية المباشر الخاص بالمتجر</p>
        </div>

        {/* Body */}
        <div className="p-8">
          {newlyCreatedPassword ? (
            /* Registration Success */
            <div className="text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-950/60 text-green-600 rounded-3xl flex items-center justify-center border-2 border-green-500/30">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">تم إنشاء حسابك في المتجر بنجاح!</h2>
                <p className="text-xs text-gray-500 mt-1">
                  لقد خصص المتجر لك كلمة مرور خاصة بحسابك، احفظها الآن:
                </p>
              </div>

              {/* Password Display Box */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-dashed border-emerald-500 rounded-2xl p-6 relative group">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1">كلمة المرور الخاصة بك:</span>
                <div className="text-3xl font-black font-mono tracking-widest text-emerald-700 dark:text-emerald-300 select-all" dir="ltr">
                  {newlyCreatedPassword}
                </div>
                
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>تم النسخ بنجاح!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ كلمة المرور</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3.5 text-right">
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                  ⚠️ <strong>تنبيه هام:</strong> احفظ كلمة المرور هذه في مكان آمن، فلن تتمكن من تسجيل الدخول إلى حسابك هذا في المتجر مستقبلاً إلا بكتابة كلمة المرور هذه بدقة.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFinishRegistration}
                className={`w-full py-4 px-4 rounded-2xl font-black text-white text-sm shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 transition ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                <span>دخول المتجر واستخدام الحساب الآن</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          ) : (
            <div>
              {/* Tabs */}
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-3 text-xs font-black rounded-xl transition ${
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
                  className={`flex-1 py-3 text-xs font-black rounded-xl transition ${
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
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold mb-2">البريد الإلكتروني المسجل</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="name@example.com"
                        className={`w-full pr-11 pl-4 py-3.5 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-green-500 ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        dir="ltr"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-2">كلمة مرور المتجر</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="كلمة المرور الخاصة بحسابك"
                        className={`w-full pr-11 pl-11 py-3.5 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-green-500 ${
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
                        {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      أدخل كلمة المرور التي استلمتها من المتجر عند التسجيل.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className={`w-full py-4 px-4 rounded-2xl font-black text-white text-sm shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
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
                      className="text-xs text-green-600 dark:text-green-400 font-bold hover:underline"
                    >
                      ليس لديك حساب؟ اضغط هنا لإنشاء حساب واستلام كلمة مرورك فوراً
                    </button>
                  </div>
                </form>
              ) : (
                /* Register Form */
                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold mb-2">الاسم الكامل أو اللقب</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <User className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="اسمك الظاهر في المتجر"
                        className={`w-full pr-11 pl-4 py-3.5 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-green-500 ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-2">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@example.com"
                        className={`w-full pr-11 pl-4 py-3.5 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-green-500 ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        dir="ltr"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      🔒 يمنع تكرار البريد في النظام، وسيكون هذا معرّفك الدائم في المتجر.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-2">رقم الهاتف (اختياري للتواصل والطلبات)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                        <Phone className="w-5 h-5" />
                      </div>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="77XXXXXXX"
                        className={`w-full pr-11 pl-4 py-3.5 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-green-500 ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3.5 text-right">
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                      ✨ بمجرد الضغط على إنشاء الحساب، سيقوم المتجر بتوليد كلمة مرور فورية خاصة بك لعرضها ونسخها مباشرة.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={regLoading}
                    className={`w-full py-4 px-4 rounded-2xl font-black text-white text-sm shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                  >
                    {regLoading ? (
                      <span>جاري إنشاء الحساب...</span>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>إنشاء الحساب واستلام كلمة المرور</span>
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
