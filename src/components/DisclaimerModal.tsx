import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, X, Check } from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

export default function DisclaimerModal() {
  const { user, getThemeClasses } = useAppContext();
  const [show, setShow] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const handleOpen = () => setShow(true);
    window.addEventListener('open-disclaimer-modal', handleOpen);
    return () => window.removeEventListener('open-disclaimer-modal', handleOpen);
  }, []);

  const handleAgree = async () => {
    if (!user) {
      setShow(false);
      return;
    }
    setSubmitting(true);
    try {
      const targetUid = (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' || user.uid === 'u_32cd7332ee7ec2e0c1121512')
        ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2'
        : user.uid;
      await setDoc(doc(db, 'users', targetUid), {
        agreedToDisclaimer: true
      }, { merge: true });
      setShow(false);
      toast.success('شكراً لتفهمكم');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ ما');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShow(false)}
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#131519] rounded-xl w-full max-w-lg overflow-hidden border border-[#E5E2DA] dark:border-[#232730] shadow-xl relative"
          >
            {/* Header */}
            <div className="px-6 py-5 bg-[#FAF9F6] dark:bg-[#101216] border-b border-[#E5E2DA] dark:border-[#232730] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-[#111214] dark:text-[#F4F4F2] leading-snug">
                    تعليمات وتنبيهات الحماية من الاحتيال
                  </h2>
                  <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium mt-0.5">
                    شروط الاستخدام وإخلاء المسؤولية المعتمدة
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShow(false)}
                className="w-11 h-11 -mt-1 -ml-2 rounded-lg flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                <p className="text-[#111214] dark:text-[#F4F4F2] text-sm sm:text-base font-bold leading-relaxed">
                  نخلي مسؤوليتنا الكاملة عن أي عمليات نصب أو احتيال قد تحدث داخل المنصة من قبل متاجر غير موثقة من قبل إدارة المنصة.
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-medium leading-relaxed">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <p>ننصح دائماً بالتعامل مع المتاجر التي تحمل شارة التوثيق الرسمية لضمان جودة ومصداقية الخدمة.</p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group select-none min-h-[44px] px-1">
                <div
                  className={`w-5 h-5 rounded-md border transition-colors flex items-center justify-center shrink-0 ${
                    agreed
                      ? `${getThemeClasses('bg')} border-transparent text-white`
                      : 'border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] group-hover:border-[#111214] dark:group-hover:border-zinc-400'
                  }`}
                >
                  {agreed && <Check className="w-3.5 h-3.5" />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span className="text-[#111214] dark:text-[#F4F4F2] font-bold text-sm">
                  لقد قرأت هذا التنبيه وأوافق على ما جاء فيه
                </span>
              </label>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#FAF9F6] dark:bg-[#101216] border-t border-[#E5E2DA] dark:border-[#232730]">
              <button
                disabled={!agreed || submitting}
                onClick={handleAgree}
                className={`w-full min-h-[44px] py-3 rounded-lg font-bold text-sm transition ${
                  agreed && !submitting
                    ? `${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white active:scale-[0.99]`
                    : 'bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-500 cursor-not-allowed'
                }`}
              >
                {submitting ? 'جاري الحفظ...' : 'أوافق والمتابعة'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
