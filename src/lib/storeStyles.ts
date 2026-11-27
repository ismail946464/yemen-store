export type ThemeColor =
  | 'white'
  | 'green'
  | 'mocha'
  | 'gold'
  | 'teal'
  | 'olive'
  | 'blue'
  | 'red'
  | 'black';

export type StoreLayoutStyleId = 'classic' | 'editorial' | 'compact' | 'showcase';

export type StoreAccentId =
  | 'default'
  | 'emerald'
  | 'mocha'
  | 'gold'
  | 'teal'
  | 'olive'
  | 'blue'
  | 'crimson';

export type PlatformFontId = 'tajawal' | 'cairo' | 'almarai' | 'messiri' | 'changa' | 'amiri';

export interface PlatformThemeOption {
  id: ThemeColor;
  name: string;
  shortName: string;
  desc: string;
  color: string;
  swatchClass: string;
}

export const PLATFORM_THEMES: PlatformThemeOption[] = [
  {
    id: 'white',
    name: 'حجري نقي (الأساسي)',
    shortName: 'حجري',
    desc: 'ورق حجري دافئ مع تباين أسود واضح',
    color: '#f6f5f0',
    swatchClass: 'bg-[#f6f5f0] border-2 border-[#111214]',
  },
  {
    id: 'green',
    name: 'أخضر زمردي',
    shortName: 'زمردي',
    desc: 'أخضر يمني متوازن بطابع احترافي',
    color: '#0d6e4e',
    swatchClass: 'bg-[#0d6e4e]',
  },
  {
    id: 'mocha',
    name: 'بن موكا البرونزي',
    shortName: 'موكا',
    desc: 'درجات القهوة والبرونز الدافئة بطابع أصيل',
    color: '#7c4a2d',
    swatchClass: 'bg-[#7c4a2d]',
  },
  {
    id: 'gold',
    name: 'الذهبي العتيق',
    shortName: 'ذهبي',
    desc: 'فخامة العنبر والذهب للعطور والمجوهرات',
    color: '#b45309',
    swatchClass: 'bg-[#b45309]',
  },
  {
    id: 'teal',
    name: 'الفيروز الساحلي',
    shortName: 'فيروزي',
    desc: 'أزرق فيروزي نقي حديث للإلكترونيات',
    color: '#0f766e',
    swatchClass: 'bg-[#0f766e]',
  },
  {
    id: 'olive',
    name: 'الزيتوني الحرازي',
    shortName: 'زيتوني',
    desc: 'أخضر طبيعي هادئ للمنتجات المحلية والعسل',
    color: '#3f6212',
    swatchClass: 'bg-[#3f6212]',
  },
  {
    id: 'blue',
    name: 'أزرق ملكي',
    shortName: 'أزرق',
    desc: 'أزرق بحري واضح للأجهزة والخدمات',
    color: '#1d4ed8',
    swatchClass: 'bg-[#1d4ed8]',
  },
  {
    id: 'red',
    name: 'أحمر ياقوتي',
    shortName: 'ياقوتي',
    desc: 'ياقوتي دافئ بارز للعروض والهدايا',
    color: '#be123c',
    swatchClass: 'bg-[#be123c]',
  },
  {
    id: 'black',
    name: 'أوبسيديان داكن',
    shortName: 'داكن',
    desc: 'أسود ملكي عميق بأحادي اللون الفخم',
    color: '#09090b',
    swatchClass: 'bg-zinc-950 border border-zinc-700',
  },
];

export const VALID_THEME_IDS: ThemeColor[] = PLATFORM_THEMES.map((t) => t.id);

export interface StoreLayoutStyleOption {
  id: StoreLayoutStyleId;
  name: string;
  desc: string;
}

export const STORE_LAYOUT_STYLES: StoreLayoutStyleOption[] = [
  {
    id: 'classic',
    name: 'الستايل المعماري المتوازن',
    desc: 'غلاف عرضي متكامل مع شعار المتجر وبار المؤشرات الكلاسيكي.',
  },
  {
    id: 'editorial',
    name: 'ستايل البوتيك الفاخر',
    desc: 'ترويسة متمركزة وأنيقة تبرز اسم المتجر وشعاره بأسلوب راقٍ.',
  },
  {
    id: 'compact',
    name: 'ستايل العرض السريع المكثف',
    desc: 'واجهة مضغوطة تُظهر المنتجات والبحث مباشرة في أعلى الصفحة.',
  },
  {
    id: 'showcase',
    name: 'ستايل المعرض الداكن المميز',
    desc: 'بانر غني بتدرج داكن عميق يبرز التصوير والعروض بوضوح عالٍ.',
  },
];

export interface StoreAccentOption {
  id: StoreAccentId;
  name: string;
  swatch: string;
  bg: string;
  hover: string;
  price: string;
  text: string;
  border: string;
  verified: string;
}

export const STORE_ACCENT_PALETTES: StoreAccentOption[] = [
  {
    id: 'default',
    name: 'افتراضي (لون المنصة)',
    swatch: '#5c5b57',
    bg: '',
    hover: '',
    price: '',
    text: '',
    border: '',
    verified: '',
  },
  {
    id: 'emerald',
    name: 'زمردي',
    swatch: '#0D6E4E',
    bg: 'bg-[#0D6E4E] text-white dark:bg-[#10B981] dark:text-[#04120C]',
    hover: 'hover:bg-[#09583E] dark:hover:bg-[#059669]',
    price: 'text-[#0D6E4E] dark:text-[#34D399]',
    text: 'text-[#0D6E4E] dark:text-[#34D399]',
    border: 'border-[#0D6E4E] dark:border-[#10B981]',
    verified: 'text-[#0D6E4E] dark:text-[#34D399]',
  },
  {
    id: 'mocha',
    name: 'موكا برونزي',
    swatch: '#7C4A2D',
    bg: 'bg-[#7C4A2D] text-white dark:bg-[#C28858] dark:text-[#18100B]',
    hover: 'hover:bg-[#633922] dark:hover:bg-[#D19B6E]',
    price: 'text-[#7C4A2D] dark:text-[#DFAC80]',
    text: 'text-[#7C4A2D] dark:text-[#DFAC80]',
    border: 'border-[#7C4A2D] dark:border-[#C28858]',
    verified: 'text-[#7C4A2D] dark:text-[#DFAC80]',
  },
  {
    id: 'gold',
    name: 'ذهبي عتيق',
    swatch: '#B45309',
    bg: 'bg-[#B45309] text-white dark:bg-[#F59E0B] dark:text-[#181104]',
    hover: 'hover:bg-[#92400E] dark:hover:bg-[#D97706]',
    price: 'text-[#B45309] dark:text-[#FBBF24]',
    text: 'text-[#B45309] dark:text-[#FBBF24]',
    border: 'border-[#B45309] dark:border-[#F59E0B]',
    verified: 'text-[#B45309] dark:text-[#FBBF24]',
  },
  {
    id: 'teal',
    name: 'فيروزي',
    swatch: '#0F766E',
    bg: 'bg-[#0F766E] text-white dark:bg-[#14B8A6] dark:text-[#041816]',
    hover: 'hover:bg-[#115E59] dark:hover:bg-[#0D9488]',
    price: 'text-[#0F766E] dark:text-[#2DD4BF]',
    text: 'text-[#0F766E] dark:text-[#2DD4BF]',
    border: 'border-[#0F766E] dark:border-[#14B8A6]',
    verified: 'text-[#0F766E] dark:text-[#2DD4BF]',
  },
  {
    id: 'olive',
    name: 'زيتوني',
    swatch: '#3F6212',
    bg: 'bg-[#3F6212] text-white dark:bg-[#84CC16] dark:text-[#0F1704]',
    hover: 'hover:bg-[#365314] dark:hover:bg-[#65A30D]',
    price: 'text-[#3F6212] dark:text-[#A3E635]',
    text: 'text-[#3F6212] dark:text-[#A3E635]',
    border: 'border-[#3F6212] dark:border-[#84CC16]',
    verified: 'text-[#3F6212] dark:text-[#A3E635]',
  },
  {
    id: 'blue',
    name: 'أزرق ملكي',
    swatch: '#1D4ED8',
    bg: 'bg-[#1D4ED8] text-white dark:bg-[#3B82F6] dark:text-white',
    hover: 'hover:bg-[#1E40AF] dark:hover:bg-[#2563EB]',
    price: 'text-[#1D4ED8] dark:text-[#60A5FA]',
    text: 'text-[#1D4ED8] dark:text-[#60A5FA]',
    border: 'border-[#1D4ED8] dark:border-[#3B82F6]',
    verified: 'text-[#1D4ED8] dark:text-[#60A5FA]',
  },
  {
    id: 'crimson',
    name: 'ياقوتي',
    swatch: '#BE123C',
    bg: 'bg-[#BE123C] text-white dark:bg-[#F43F5E] dark:text-white',
    hover: 'hover:bg-[#9F1239] dark:hover:bg-[#E11D48]',
    price: 'text-[#BE123C] dark:text-[#FB7185]',
    text: 'text-[#BE123C] dark:text-[#FB7185]',
    border: 'border-[#BE123C] dark:border-[#F43F5E]',
    verified: 'text-[#BE123C] dark:text-[#FB7185]',
  },
];

export function resolveStoreAccent(
  accentId: string | undefined,
  fallbackGetTheme: (type: 'bg' | 'hover' | 'price' | 'text' | 'border' | 'verified') => string
) {
  const matched = STORE_ACCENT_PALETTES.find((p) => p.id === accentId && p.id !== 'default');
  if (!matched) {
    return {
      bg: fallbackGetTheme('bg'),
      hover: fallbackGetTheme('hover'),
      price: fallbackGetTheme('price'),
      text: fallbackGetTheme('text'),
      border: fallbackGetTheme('border'),
      verified: fallbackGetTheme('verified'),
    };
  }
  return {
    bg: matched.bg,
    hover: matched.hover,
    price: matched.price,
    text: matched.text,
    border: matched.border,
    verified: matched.verified,
  };
}

export const PLATFORM_FONTS: { id: PlatformFontId; name: string; desc: string; className: string }[] = [
  { id: 'tajawal', name: 'تجوال (Tajawal)', desc: 'واضح وسريع القراءة لجميع المتاجر', className: 'font-tajawal' },
  { id: 'cairo', name: 'كايرو (Cairo)', desc: 'هندسي معماري متوازن للواجهات الحديثة', className: 'font-cairo' },
  { id: 'almarai', name: 'المراعي (Almarai)', desc: 'نظيف ومختصر للكتالوجات والأسعار', className: 'font-almarai' },
  { id: 'messiri', name: 'المسيري (El Messiri)', desc: 'طابع عربي أنيق للبوتيكات والعطور', className: 'font-messiri' },
  { id: 'changa', name: 'تشانجا (Changa)', desc: 'عريض وجريء للمتاجر الشبابية والأجهزة', className: 'font-changa' },
  { id: 'amiri', name: 'أميري (Amiri)', desc: 'خط نسخي كلاسيكي فخم للمنتجات التراثية', className: 'font-amiri' },
];
