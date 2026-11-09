import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, Truck, FileText, ChevronDown, ChevronUp, Lock, PhoneCall, HelpCircle } from 'lucide-react';
import { useAppContext } from '../AppContext';

export default function SecurityAndGuidelinesSection() {
  const { isDarkMode, settings, getThemeClasses } = useAppContext();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleOpenFullDisclaimer = () => {
    window.dispatchEvent(new CustomEvent('open-disclaimer-modal'));
  };

  return (
    <section className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800" dir="rtl">
      {/* Header Banner */}
      <div className={`p-6 sm:p-8 rounded-3xl border transition-all ${
        isDarkMode 
          ? 'bg-gray-900/90 border-gray-800 text-white' 
          : `${getThemeClasses('cardBg')} text-gray-900`
      } shadow-lg relative overflow-hidden`}>
        
        {/* Background decorative watermark */}
        <div className="absolute -left-10 -bottom-10 opacity-5 pointer-events-none">
          <ShieldCheck className={`w-64 h-64 ${getThemeClasses('text')}`} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${getThemeClasses('bgLight')} ${getThemeClasses('textDark')} border ${getThemeClasses('border')} text-xs font-black`}>
              <ShieldAlert className={`w-4 h-4 ${getThemeClasses('text')}`} />
              <span>دليل الأمان والمصداقية ومكافحة الاحتيال</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              تعليمات استخدام المتجر وتنبيهات الحماية من النصب والاحتيال
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-2xl font-medium leading-relaxed">
              حرصاً من إدارة {settings?.storeName || 'المتجر'} على سلامتكم وحماية تعاملاتكم التجارية والمالية، يرجى الالتزام بالتعليمات والإرشادات الأمنية التالية قبل إتمام أي طلب.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-5 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-black text-xs text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-750 transition flex items-center gap-2 shadow-sm"
            >
              <span>{isExpanded ? 'طي التفاصيل الإضافية' : 'استعراض كل الإرشادات والتنبيهات'}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={handleOpenFullDisclaimer}
              className={`px-5 py-3 rounded-2xl ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-black text-xs transition flex items-center gap-2 shadow-md active:scale-95`}
            >
              <FileText className="w-4 h-4" />
              <span>وثيقة إخلاء المسؤولية والشروط الرسمية</span>
            </button>
          </div>
        </div>

        {/* Core Security Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {/* Rule 1: Passwords */}
          <div className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-100'
          } shadow-sm space-y-2`}>
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-black text-sm text-gray-900 dark:text-white">حماية كلمة المرور</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              لا تشارك كلمة مرورك مع أي شخص إطلاقاً. إدارة المتجر لا تطلب كلمة المرور الخاصة بك تحت أي ظرف.
            </p>
          </div>

          {/* Rule 2: Official Transfers */}
          <div className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-100'
          } shadow-sm space-y-2`}>
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-black text-sm text-gray-900 dark:text-white">التحويل للحسابات المعتمدة</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              تأكد من مطابقة اسم المستلم ورقم الحساب الموضح في شاشة الدفع للمتجر أو التاجر الموثق قبل التحويل.
            </p>
          </div>

          {/* Rule 3: Inspection upon delivery */}
          <div className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-100'
          } shadow-sm space-y-2`}>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-black text-sm text-gray-900 dark:text-white">معاينة السلعة عند الاستلام</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              افحص المنتج ومطابقته للمواصفات المعروضة فور استلامه من مندوب التوصيل أو مكتب الشحن المعتمد.
            </p>
          </div>

          {/* Rule 4: Transfer receipts */}
          <div className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-100'
          } shadow-sm space-y-2`}>
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-black text-sm text-gray-900 dark:text-white">الاحتفاظ بسند الحوالة</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              احتفظ بصورة أو رقم سند التحويل المالي أو إشعار الإيداع البنكي لتأكيد طلبك وتسهيل معالجة الشحنة.
            </p>
          </div>
        </div>

        {/* Collapsible Extended Guidelines & Policies */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-200/70 dark:border-gray-800 space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Delivery Guidelines */}
              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-white/80 border-gray-200'}`}>
                <h4 className="font-black text-sm flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400">
                  <Truck className="w-4 h-4" />
                  إرشادات التوصيل والشحن بين المحافظات
                </h4>
                <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-2 list-disc list-inside leading-relaxed font-medium">
                  <li>يتم تسليم الطلبات داخل المدن الرئيسية (صنعاء، عدن، تعز، إب، الحديدة، مأرب) عبر مناديب توصيل موثوقين.</li>
                  <li>للشحن الخارجي بين المحافظات يتم استخدام مكاتب النقل المعتمدة مع تزويدك برقم البوليصة للمتابعة.</li>
                  <li>يرجى كتابة رقم هاتف فعال ومتاح على الواتساب لضمان سهولة تواصل المندوب معك قبل موعد التوصيل.</li>
                </ul>
              </div>

              {/* Anti-Fraud Warnings */}
              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-white/80 border-gray-200'}`}>
                <h4 className="font-black text-sm flex items-center gap-2 mb-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  تنبيهات مشددة للوقاية من النصب والاحتيال
                </h4>
                <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-2 list-disc list-inside leading-relaxed font-medium">
                  <li>احذر من أي رسائل أو مكالمات تدعي فوزك بجوائز وتطلب منك رموز سرية أو تحويل مبالغ استلام.</li>
                  <li>لا تحول أي مبالغ مالية إلى أي أرقام خارج قنوات الدفع الرسمية المدرجة على صفحة المتجر.</li>
                  <li>في حال وجود أي نشاط مشبوه أو بائع غير ملتزم، تواصل فوراً مع الدعم الفني للإدارة للإبلاغ عنه.</li>
                </ul>
              </div>
            </div>

            {/* Official Support Note */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black">
                <PhoneCall className="w-4 h-4" />
                <span>تحتاج إلى مساعدة أو استفسار بخصوص طلبك؟</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                تواصل مع إدارة المتجر عبر قسم الدعم الفني أو الواتساب الرسمي المعتمد.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
