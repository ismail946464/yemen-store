import React, { useState, useEffect, useRef } from 'react';
import { Mail, ArrowRight, RefreshCw, CheckCircle2, AlertCircle, Copy, Check, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, loginWithOtp, loginWithGoogle, settings, getThemeClasses, isDarkMode } = useAppContext();
  const navigate = useNavigate();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If already logged in, redirect home
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Focus first OTP input when switching to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message || 'فشل إرسال رمز التحقق');
        setLoading(false);
        return;
      }

      toast.success('تم إرسال رمز التحقق بنجاح!');
      if (data.codePreview) {
        setPreviewCode(data.codePreview);
      }
      setStep('otp');
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err: any) {
      toast.error('تعذر الاتصال بالخادم: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    // Auto advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 digits entered
    if (newDigits.every(d => d !== '')) {
      handleVerifyOtp(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split('');
      setOtpDigits(digits);
      handleVerifyOtp(pasted);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || otpDigits.join('');
    if (finalCode.length !== 6) {
      toast.error('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setLoading(true);
    try {
      const success = await loginWithOtp(email.trim().toLowerCase(), finalCode);
      if (success) {
        toast.success('تم تسجيل الدخول بنجاح! أهلاً بك');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch {
      // Handled in loginWithGoogle
    } finally {
      setGoogleLoading(false);
    }
  };

  const applyPreviewCode = () => {
    if (previewCode && previewCode.length === 6) {
      setOtpDigits(previewCode.split(''));
      handleVerifyOtp(previewCode);
    }
  };

  const copyPreviewCode = () => {
    if (previewCode) {
      navigator.clipboard.writeText(previewCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('تم نسخ الرمز');
    }
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
          <p className="text-xs text-white/80 mt-1 font-medium">تسجيل الدخول برمز التحقق بالبريد الإلكتروني</p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <span>ℹ️</span>
                  <span>سيصلك كود تحقق تلقائي فوري مكون من 6 أرقام.</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className={`w-full py-4 px-4 rounded-2xl font-black text-white text-sm shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>جاري إرسال رمز التحقق...</span>
                  </>
                ) : (
                  <>
                    <span>إرسال رمز التحقق إلى بريدي</span>
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-gray-400">أو المتابعة السريعة</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className={`w-full py-3.5 px-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-3 transition ${
                  isDarkMode 
                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200' 
                    : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-sm'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{googleLoading ? 'جاري الاتصال بـ Google...' : 'تسجيل الدخول السريع بحساب Google'}</span>
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-base font-bold text-gray-800 dark:text-gray-200">أدخل رمز التحقق (6 أرقام)</p>
                <p className="text-xs text-gray-500 mt-1">
                  تم إرسال رمز التحقق المكون من 6 أرقام إلى: <strong className="text-green-600 font-mono">{email}</strong>
                </p>
              </div>

              {previewCode && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div className="text-right">
                      <span className="text-xs text-amber-800 dark:text-amber-300 font-medium block">رمز التحقق:</span>
                      <span className="font-mono font-black text-amber-900 dark:text-amber-200 text-lg tracking-widest">{previewCode}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={applyPreviewCode}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition"
                    >
                      تعبئة تلقائية
                    </button>
                    <button
                      type="button"
                      onClick={copyPreviewCode}
                      className="p-1.5 bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded-lg text-xs transition"
                      title="نسخ الرمز"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* 6 Digits */}
              <div className="flex justify-center gap-2 sm:gap-3" dir="ltr" onPaste={handlePaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className={`w-12 h-14 text-center text-2xl font-black rounded-2xl border transition focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      digit 
                        ? 'border-green-500 bg-green-50/30 text-green-700 dark:bg-green-950/30 dark:text-green-300' 
                        : isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-white' 
                          : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={loading || otpDigits.some(d => !d)}
                className={`w-full py-4 px-4 rounded-2xl font-black text-white text-sm shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50 ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>جاري التحقق والدخول...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>تأكيد تسجيل الدخول</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setPreviewCode(null);
                  }}
                  className="hover:text-gray-700 dark:hover:text-gray-300 font-medium"
                >
                  ← تغيير البريد
                </button>

                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={resendCooldown > 0 || loading}
                  className="text-green-600 hover:text-green-700 font-bold disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `إعادة الإرسال بعد ${resendCooldown} ثانية` : 'إعادة إرسال رمز جديد'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
