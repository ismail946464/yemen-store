import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Truck,
  FileText,
  Lock,
  ArrowRight,
  PhoneCall,
  Eye,
  CheckCircle2,
  CreditCard
} from 'lucide-react';
import { useAppContext } from '../AppContext';

export default function SafetyGuide() {
  const { settings, getThemeClasses } = useAppContext();
  const navigate = useNavigate();

  const handleOpenDisclaimerModal = () => {
    window.dispatchEvent(new CustomEvent('open-disclaimer-modal'));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-8" dir="rtl">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E5E2DA] dark:border-[#232730]">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى المتجر</span>
        </button>

        <span className="text-xs font-bold text-[#5C5B57] dark:text-zinc-400">
          مركز التوعية والأمان الرسمي
        </span>
      </div>

      {/* Editorial Header */}
      <header className="p-6 sm:p-8 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span>دليل التسوق الآمن وحماية المشتري</span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111214] dark:text-[#F4F4F2] tracking-tight leading-snug">
          إرشادات استخدام المتجر وتجربة الشراء الموثوقة
        </h1>

        <p className="text-sm text-[#5C5B57] dark:text-zinc-400 max-w-3xl font-medium leading-relaxed">
          حرصاً من إدارة {settings?.storeName || 'المتجر'} على راحتكم وجودة تعاملاتكم التجارية، وضعنا هذا الدليل الإرشادي لضمان تجربة تسوق سهلة وواضحة لجميع المتعاملين داخل محافظات الجمهورية اليمنية.
        </p>
      </header>

      {/* 2x2 Architectural Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 border border-[#E5E2DA] dark:border-[#232730] rounded-xl overflow-hidden bg-white dark:bg-[#131519] divide-y md:divide-y-0 md:grid-rows-2">
        {/* Rule 1 */}
        <div className="p-6 sm:p-7 space-y-3 md:border-l border-[#E5E2DA] dark:border-[#232730] md:border-b">
          <div className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="font-display font-bold text-base sm:text-lg text-[#111214] dark:text-[#F4F4F2]">
            1. سرية كلمة المرور وبيانات الدخول
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
            كلمة المرور الخاصة بحسابك هي مسؤوليتك الشخصية وحدك. إدارة المتجر لا تطلب منك إطلاقاً كلمة المرور أو أي رمز سري بأي وسيلة كانت (واتساب، اتصال، بريد). لا تشارك بياناتك مع أي شخص يدعي أنه من فريق الدعم الفني.
          </p>
        </div>

        {/* Rule 2 */}
        <div className="p-6 sm:p-7 space-y-3 md:border-b border-[#E5E2DA] dark:border-[#232730]">
          <div className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <h2 className="font-display font-bold text-base sm:text-lg text-[#111214] dark:text-[#F4F4F2]">
            2. التحويل المالي والحسابات المعتمدة
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
            تأكد دائماً من مطابقة اسم المستلم ورقم حسابه أو المحفظة الإلكترونية (كريمي، جيب، جوالي، ون كاش، أو حوالات النجم والامتياز) المعتمدة الموضحة داخل فاتورة الطلب الرسمية في المتجر قبل إرسال أي مبلغ مالي.
          </p>
        </div>

        {/* Rule 3 */}
        <div className="p-6 sm:p-7 space-y-3 md:border-l border-[#E5E2DA] dark:border-[#232730]">
          <div className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <h2 className="font-display font-bold text-base sm:text-lg text-[#111214] dark:text-[#F4F4F2]">
            3. فحص ومعاينة السلعة عند الاستلام
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
            احرص على معاينة وفحص السلعة فور استلامها مباشرة من مندوب التوصيل أو من مكتب الشحن للتأكد من سلامتها ومطابقتها التامة للصور والمواصفات المعروضة في المتجر قبل التوقيع على الاستلام أو دفع أي متبقي.
          </p>
        </div>

        {/* Rule 4 */}
        <div className="p-6 sm:p-7 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <h2 className="font-display font-bold text-base sm:text-lg text-[#111214] dark:text-[#F4F4F2]">
            4. الشحن بين المحافظات اليمنية
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
            في حال شحن البضائع بين المحافظات (صنعاء، عدن، تعز، إب، حضرموت، إلخ)، يتم التعامل عبر مكاتب الشحن والنقل الرسمية المعروفة فقط، واطلب دائماً صورة واضحة من سند الشحن ورقم السند ورقم لوحة وسيلة النقل لمتابعة خط سير الطرد.
          </p>
        </div>
      </div>

      {/* Buyer Confidence Notice */}
      <div className="p-6 sm:p-7 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-4">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <h3 className="font-display font-bold text-base sm:text-lg text-[#111214] dark:text-[#F4F4F2]">
            نصائح سريعة لتجربة تسوق مثالية
          </h3>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm font-medium text-[#111214] dark:text-zinc-200 list-disc list-inside">
          <li>قارن الأسعار وتصفح تقييمات وآراء المشترين السابقين قبل إتمام الطلب.</li>
          <li>تأكد من مطابقة اسم المستلم الظاهر في فاتورة الطلب الرسمية عند التحويل.</li>
          <li>احتفظ بصورة السند أو رقم المرجع لمتابعة حالة الطلب وشحنه بسهولة.</li>
          <li>تواصل مع الدعم الفني عبر صفحة التواصل لأي استفسار أو مساعدة في طلبك.</li>
        </ul>
      </div>

      {/* Official Policy & Actions */}
      <div className="p-6 sm:p-7 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] space-y-4">
        <div className="flex items-center gap-2.5">
          <FileText className={`w-5 h-5 ${getThemeClasses('text')} shrink-0`} />
          <h3 className="font-display font-bold text-base sm:text-lg text-[#111214] dark:text-[#F4F4F2]">
            سياسات الاستخدام وتنظيم التعاملات
          </h3>
        </div>

        <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
          تعمل إدارة منصة {settings?.storeName || 'المتجر'} على تنظيم عرض المنتجات والطلبات بين البائعين والمشترين، وتوفير قنوات تواصل مباشرة وشفافة لضمان سلاسة التوصيل وحفظ حقوق الطلبات المسجلة عبر المنصة.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleOpenDisclaimerModal}
            className={`min-h-[44px] px-5 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition flex items-center gap-2 active:scale-[0.99]`}
          >
            <FileText className="w-4 h-4" />
            <span>قراءة سياسات الاستخدام والإرشادات</span>
          </button>

          <Link
            to="/contact"
            className="min-h-[44px] px-5 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] font-bold text-xs transition flex items-center gap-2"
          >
            <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>التواصل مع خدمة العملاء</span>
          </Link>
        </div>
      </div>

      {/* Return CTA */}
      <div className="flex justify-center pt-2 pb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 min-h-[44px] px-7 py-2.5 rounded-lg bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] font-bold text-sm hover:opacity-90 transition"
        >
          <span>تصفح المنتجات في المتجر</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>
    </div>
  );
}
