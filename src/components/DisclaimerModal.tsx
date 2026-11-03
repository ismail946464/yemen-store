import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

export default function DisclaimerModal() {
  const { user, userData, loading } = useAppContext();
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
      toast.success("شكراً لتفهمكم");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ ما");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative border border-gray-100"
          >
            {/* Close Button */}
            <button
              onClick={() => setShow(false)}
              className="absolute top-4 left-4 p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-700 transition z-10"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="bg-red-50 p-8 text-center border-b border-red-100">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">تعليمات وتنبيهات الحماية من الاحتيال</h2>
              <p className="text-red-700 font-bold text-sm">شروط الاستخدام وإخلاء المسؤولية المعتمدة</p>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <p className="text-gray-700 text-lg font-bold leading-relaxed text-center" dir="rtl">
                  نخلي مسؤوليتنا الكاملة عن أي عمليات نصب أو احتيال قد تحدث داخل المتجر من قبل متاجر غير موثقة من قبل إدارة المنصة.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-xl text-blue-800 text-sm font-medium" dir="rtl">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>ننصح دائماً بالتعامل مع المتاجر التي تحمل علامة التوثيق لضمان جودة ومصداقية الخدمة.</p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer group select-none" dir="rtl">
                  <div className={`w-6 h-6 rounded-md border-2 transition-colors flex items-center justify-center ${agreed ? 'bg-black border-black' : 'border-gray-200 group-hover:border-gray-400'}`}>
                    {agreed && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={agreed} 
                    onChange={(e) => setAgreed(e.target.checked)} 
                  />
                  <span className="text-gray-700 font-bold text-sm font-tajawal">لقد قرأت هذا التنبيه وأوافق على ما جاء فيه</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 pt-0">
              <button
                disabled={!agreed || submitting}
                onClick={handleAgree}
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all transform active:scale-95 shadow-xl ${
                  agreed && !submitting
                    ? 'bg-black text-white hover:bg-gray-900 shadow-gray-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
