import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../AppContext';

export default function ChangePassword() {
  const { user, isAdmin, getThemeClasses, changePassword } = useAppContext();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        <h2 className="font-display text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2] mb-2">تغيير كلمة المرور</h2>
        <p className="text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mb-5">
          الرجاء تسجيل الدخول أولاً لتحديث كلمة مرور حسابك
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
    <div className="max-w-2xl mx-auto space-y-6 pb-16" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card-bg)] flex items-center justify-center shrink-0">
            <KeyRound className={`w-5 h-5 ${getThemeClasses('text')}`} />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[#111214] dark:text-[#F4F4F2]">
              تغيير كلمة المرور
            </h1>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-0.5">
              تحديث كلمة مرور الدخول الخاصة بحسابك
            </p>
          </div>
        </div>

        <Link
          to="/profile"
          className="min-h-[40px] px-3.5 py-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card-bg)] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors inline-flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى حسابي</span>
        </Link>
      </div>

      <div className="p-5 sm:p-6 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card-bg)] space-y-5">
        {isAdmin && (
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--theme-border)]">
            <span className="text-xs font-medium text-[#5C5B57] dark:text-zinc-400">
              صلاحيات المشرف: يمكنك أيضاً تعديل كلمات مرور الأعضاء
            </span>
            <Link
              to="/admin"
              className="text-xs font-bold text-[#5C5B57] dark:text-zinc-300 underline hover:text-[#111214] dark:hover:text-white shrink-0"
            >
              إدارة الأعضاء ←
            </Link>
          </div>
        )}

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
                className="w-full min-h-[44px] border border-[var(--theme-border)] bg-[var(--theme-bg-page)] text-[#111214] dark:text-[#F4F4F2] rounded-lg px-3.5 py-2.5 pl-10 outline-none focus:border-[var(--primary-color)] text-left font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5B57] hover:text-[#111214] dark:hover:text-white"
                tabIndex={-1}
                aria-label="إظهار أو إخفاء كلمة المرور الحالية"
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
                  className="w-full min-h-[44px] border border-[var(--theme-border)] bg-[var(--theme-bg-page)] text-[#111214] dark:text-[#F4F4F2] rounded-lg px-3.5 py-2.5 pl-10 outline-none focus:border-[var(--primary-color)] text-left font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5B57] hover:text-[#111214] dark:hover:text-white"
                  tabIndex={-1}
                  aria-label="إظهار أو إخفاء كلمة المرور الجديدة"
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
                className="w-full min-h-[44px] border border-[var(--theme-border)] bg-[var(--theme-bg-page)] text-[#111214] dark:text-[#F4F4F2] rounded-lg px-3.5 py-2.5 outline-none focus:border-[var(--primary-color)] text-left font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isChangingPassword}
              className={`min-h-[44px] flex items-center justify-center gap-2 font-bold text-sm rounded-lg px-6 py-2.5 transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')} disabled:opacity-50`}
            >
              {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isChangingPassword ? 'جاري التحديث...' : 'حفظ كلمة المرور'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
