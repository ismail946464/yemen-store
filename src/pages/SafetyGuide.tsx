import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  FileText, 
  Lock, 
  ArrowRight,
  PhoneCall, 
  HelpCircle,
  Eye,
  Send,
  AlertOctagon,
  CreditCard,
  Building2
} from 'lucide-react';
import { useAppContext } from '../AppContext';

export default function SafetyGuide() {
  const { isDarkMode, settings } = useAppContext();
  const navigate = useNavigate();
  const [showFullDisclaimer, setShowFullDisclaimer] = useState(false);

  const handleOpenDisclaimerModal = () => {
    window.dispatchEvent(new CustomEvent('open-disclaimer-modal'));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-8" dir="rtl">
      {/* Back Button & Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition border shadow-sm ${
            isDarkMode 
              ? 'bg-gray-900 border-gray-800 text-gray-200 hover:bg-gray-800 hover:text-white' 
              : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-100 hover:text-black'
          }`}
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى المتجر</span>
        </button>

        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
          مركز التوعية والأمان الرسمي
        </span>
      </div>

      {/* Main Hero Header */}
      <div className={`p-6 sm:p-10 rounded-3xl border transition-all relative overflow-hidden ${
        isDarkMode 
          ? 'bg-gradient-to-br from-red-950/40 via-gray-900 to-gray-900 border-red-900/30 text-white' 
          : 'bg-gradient-to-br from-red-50 via-white to-red-50/50 border-red-200 text-gray-900'
      } shadow-xl`}>
        <div className="absolute -left-12 -bottom-12 opacity-5 pointer-events-none">
          <ShieldAlert className="w-72 h-72 text-red-600" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/10 text-red-600 dark:text-red-400 border border-red-600/20 text-xs font-black">
            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span>دليل الأمان والمصداقية ومكافحة الاحتيال</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            تعليمات استخدام المتجر وتنبيهات الحماية من النصب والاحتيال
          </h1>

          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-3xl font-medium leading-relaxed">
            حرصاً من إدارة {settings?.storeName || 'متجر يمن ستور'} على سلامتكم وحماية تعاملاتكم التجارية والمالية، وضعنا هذا الدليل الإرشادي والتنبيهي الشامل لضمان تجربة تسوق آمنة وموثوقة لجميع المتعاملين داخل محافظات الجمهورية اليمنية.
          </p>
        </div>
      </div>

      {/* Crucial Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Passwords & Credentials */}
        <div className={`p-6 rounded-3xl border transition-all ${
          isDarkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white border-gray-200/90'
        } shadow-sm space-y-3`}>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="font-black text-lg text-gray-900 dark:text-white">
            1. سرية كلمة المرور وبيانات الدخول
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
            كلمة المرور الخاصة بحسابك هي مسؤوليتك الشخصية وحدك. إدارة المتجر لا تطلب منك إطلاقاً كلمة المرور أو أي رمز سري بأي وسيلة كانت (واتساب، اتصال، بريد). لا تشارك بياناتك مع أي شخص يدعي أنه من فريق الدعم الفني.
          </p>
        </div>

        {/* Card 2: Official Transfers & Money Remittances */}
        <div className={`p-6 rounded-3xl border transition-all ${
          isDarkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white border-gray-200/90'
        } shadow-sm space-y-3`}>
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <h2 className="font-black text-lg text-gray-900 dark:text-white">
            2. التحويل المالي والحسابات المعتمدة
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
            تأكد دائماً من مطابقة اسم المستلم ورقم حسابه أو المحفظة الإلكترونية (كريمي، جيب، جوالي، ون كاش، أو حوالات النجم والامتياز) المعتمدة الموضحة داخل فاتورة الطلب الرسمية في المتجر قبل إرسال أي مبلغ مالي.
          </p>
        </div>

        {/* Card 3: Inspection on Delivery */}
        <div className={`p-6 rounded-3xl border transition-all ${
          isDarkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white border-gray-200/90'
        } shadow-sm space-y-3`}>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <Eye className="w-6 h-6" />
          </div>
          <h2 className="font-black text-lg text-gray-900 dark:text-white">
            3. فحص ومعاينة السلعة عند الاستلام
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
            احرص على معاينة وفحص السلعة فور استلامها مباشرة من مندوب التوصيل أو من مكتب الشحن للتأكد من سلامتها ومطابقتها التامة للصور والمواصفات المعروضة في المتجر قبل التوقيع على الاستلام أو دفع أي متبقي.
          </p>
        </div>

        {/* Card 4: Shipping Between Yemeni Governorates */}
        <div className={`p-6 rounded-3xl border transition-all ${
          isDarkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white border-gray-200/90'
        } shadow-sm space-y-3`}>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
          <h2 className="font-black text-lg text-gray-900 dark:text-white">
            4. الشحن بين المحافظات اليمنية
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
            في حال شحن البضائع بين المحافظات (صنعاء، عدن، تعز، إب، حضرموت، إلخ)، يتم التعامل عبر مكاتب الشحن والنقل الرسمية المعروفة فقط، واطلب دائماً صورة واضحة من سند الشحن ورقم السند ورقم لوحة وسيلة النقل لمتابعة خط سير الطرد.
          </p>
        </div>
      </div>

      {/* Fraud Warning & Scam Indicators Notice */}
      <div className={`p-6 sm:p-8 rounded-3xl border ${
        isDarkMode 
          ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' 
          : 'bg-amber-50 border-amber-200 text-amber-900'
      } space-y-4`}>
        <div className="flex items-center gap-3">
          <AlertOctagon className="w-7 h-7 text-amber-600 dark:text-amber-400 shrink-0" />
          <h3 className="font-black text-base sm:text-lg">
            إشارات تحذيرية تدل على شبهة احتيال:
          </h3>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm font-medium">
          <li className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />
            <span>عرض سلع بأسعار خيالية متدنية جداً لا تتطابق مع قيمتها السوقية الواقعية.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />
            <span>طلب تحويل الأموال على اسم شخص مختلف تماماً عن اسم صاحب المتجر المعتمد.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />
            <span>إرسال روابط دفع إلكترونية وهمية تطلب إدخال بيانات بنكية أو كلمات مرور سرية.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />
            <span>الضغط عليك للاستعجال بالتحويل بحجة انتهاء العرض أو نفاد الكمية فجأة.</span>
          </li>
        </ul>
      </div>

      {/* Official Disclaimer & Legal Rights */}
      <div className={`p-6 sm:p-8 rounded-3xl border ${
        isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
      } space-y-4`}>
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />
          <h3 className="font-black text-base sm:text-lg">
            وثيقة إخلاء المسؤولية والشروط والضوابط القانونية
          </h3>
        </div>

        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
          تعتبر منصة {settings?.storeName || 'يمن ستور'} منصة رقمية تربط البائعين المعتمدين والمشترين. وتقع مسؤولية جودة المنتجات ومطابقتها على عاتق البائع المعلن. نرجو الاطلاع على الوثيقة الكاملة لشروط الاستخدام وإخلاء المسؤولية الرسمية للمنصة.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleOpenDisclaimerModal}
            className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <FileText className="w-4 h-4" />
            <span>قراءة وثيقة إخلاء المسؤولية والشروط الرسمية</span>
          </button>

          <Link
            to="/contact"
            className={`px-6 py-3 rounded-2xl border font-black text-xs transition flex items-center gap-2 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-750' 
                : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
            }`}
          >
            <PhoneCall className="w-4 h-4 text-emerald-600" />
            <span>الإبلاغ عن نشاط مشبوه أو مخالفة</span>
          </Link>
        </div>
      </div>

      {/* Return to store footer button */}
      <div className="text-center pt-4 pb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition"
        >
          <span>تصفح المنتجات في المتجر</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>
    </div>
  );
}
