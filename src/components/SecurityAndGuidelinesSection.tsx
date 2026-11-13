import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, Truck, FileText, ChevronDown, ChevronUp, Lock, PhoneCall } from 'lucide-react';
import { useAppContext } from '../AppContext';

export default function SecurityAndGuidelinesSection() {
  const { settings, getThemeClasses } = useAppContext();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleOpenFullDisclaimer = () => {
    window.dispatchEvent(new CustomEvent('open-disclaimer-modal'));
  };

  return (
    <section className="mt-14 pt-8 border-t border-[#E5E2DA] dark:border-[#232730]" dir="rtl">
      <div className="rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden">
        {/* Header Bar */}
        <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216]">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#5C5B57] dark:text-zinc-400">
              <ShieldAlert className={`w-4 h-4 ${getThemeClasses('text')}`} />
              <span>دليل الأمان والمصداقية ومكافحة الاحتيال</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] tracking-tight">
              تعليمات استخدام المتجر وتنبيهات الحماية من النصب والاحتيال
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
              حرصاً من إدارة {settings?.storeName || 'المتجر'} على سلامتكم وحماية تعاملاتكم التجارية والمالية، يرجى الالتزام بالإرشادات الأمنية التالية قبل إتمام أي طلب.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="min-h-[44px] px-4 py-2.5 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] font-bold text-xs text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition flex items-center gap-2"
            >
              <span>{isExpanded ? 'طي التفاصيل الإضافية' : 'استعراض الإرشادات والتنبيهات'}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={handleOpenFullDisclaimer}
              className={`min-h-[44px] px-4 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition flex items-center gap-2 active:scale-[0.99]`}
            >
              <FileText className="w-4 h-4" />
              <span>وثيقة إخلاء المسؤولية</span>
            </button>
          </div>
        </div>

        {/* Core 4-Column Security Hairline Ledger */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730]">
          {/* Rule 1 */}
          <div className="p-5 sm:p-6 space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">حماية كلمة المرور</h3>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
              لا تشارك كلمة مرورك مع أي شخص إطلاقاً. إدارة المتجر لا تطلب كلمة المرور الخاصة بك تحت أي ظرف.
            </p>
          </div>

          {/* Rule 2 */}
          <div className="p-5 sm:p-6 space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">التحويل للحسابات المعتمدة</h3>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
              تأكد من مطابقة اسم المستلم ورقم الحساب الموضح في شاشة الدفع للمتجر أو التاجر الموثق قبل التحويل.
            </p>
          </div>

          {/* Rule 3 */}
          <div className="p-5 sm:p-6 space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">معاينة السلعة عند الاستلام</h3>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
              افحص المنتج ومطابقته للمواصفات المعروضة فور استلامه من مندوب التوصيل أو مكتب الشحن المعتمد.
            </p>
          </div>

          {/* Rule 4 */}
          <div className="p-5 sm:p-6 space-y-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <h3 className="font-display font-bold text-sm text-[#111214] dark:text-[#F4F4F2]">الاحتفاظ بسند الحوالة</h3>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
              احتفظ بصورة أو رقم سند التحويل المالي أو إشعار الإيداع لتأكيد طلبك وتسهيل معالجة الشحنة.
            </p>
          </div>
        </div>

        {/* Collapsible Extended Guidelines */}
        {isExpanded && (
          <div className="p-6 sm:p-8 border-t border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
                <h4 className="font-display font-bold text-sm flex items-center gap-2 mb-3 text-emerald-700 dark:text-emerald-400">
                  <Truck className="w-4 h-4" />
                  <span>إرشادات التوصيل والشحن بين المحافظات</span>
                </h4>
                <ul className="text-xs text-[#5C5B57] dark:text-zinc-400 space-y-2 list-disc list-inside leading-relaxed font-medium">
                  <li>يتم تسليم الطلبات داخل المدن الرئيسية (صنعاء، عدن، تعز، إب، الحديدة، مأرب) عبر مناديب توصيل موثوقين.</li>
                  <li>للشحن الخارجي بين المحافظات يتم استخدام مكاتب النقل المعتمدة مع تزويدك برقم البوليصة للمتابعة.</li>
                  <li>يرجى كتابة رقم هاتف فعال ومتاح على الواتساب لضمان سهولة تواصل المندوب معك قبل موعد التوصيل.</li>
                </ul>
              </div>

              <div className="p-5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]">
                <h4 className="font-display font-bold text-sm flex items-center gap-2 mb-3 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>تنبيهات للوقاية من النصب والاحتيال</span>
                </h4>
                <ul className="text-xs text-[#5C5B57] dark:text-zinc-400 space-y-2 list-disc list-inside leading-relaxed font-medium">
                  <li>احذر من أي رسائل أو مكالمات تدعي فوزك بجوائز وتطلب منك رموزاً سرية أو تحويل مبالغ استلام.</li>
                  <li>لا تحول أي مبالغ مالية إلى أي أرقام خارج قنوات الدفع الرسمية المدرجة على صفحة المتجر.</li>
                  <li>في حال وجود أي نشاط مشبوه أو بائع غير ملتزم، تواصل فوراً مع الدعم الفني للإدارة للإبلاغ عنه.</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-xs">
              <div className="flex items-center gap-2 text-[#111214] dark:text-[#F4F4F2] font-bold">
                <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>تحتاج إلى مساعدة أو استفسار بخصوص طلبك؟</span>
              </div>
              <p className="text-[#5C5B57] dark:text-zinc-400 font-medium">
                تواصل مع إدارة المتجر عبر قسم الدعم الفني أو الواتساب الرسمي المعتمد.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
