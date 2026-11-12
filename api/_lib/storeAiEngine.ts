/**
 * Standalone Store AI Engine for Yemen Store Platform (Server-side)
 * Comprehensive expert AI system dedicated exclusively to the store
 */

export interface AssistantProduct {
  id: string;
  title: string;
  price: number;
  category?: string;
  image?: string;
  images?: string[];
  description?: string;
  ownerId?: string;
  ownerName?: string;
  ownerVerified?: boolean;
  stock?: number | null;
  deliveryFee?: number;
  depositAmount?: number;
  reservationDurationDays?: number;
}

export interface AssistantChatResponse {
  reply: string;
  products: AssistantProduct[];
  suggestedQuestions?: string[];
  provider: 'standalone_store_ai' | 'gemini';
}

interface ContextAnalysis {
  intent: 
    | 'product_search'
    | 'price_inquiry'
    | 'preorder_deposit'
    | 'payment_methods'
    | 'shipping_delivery'
    | 'courier_role'
    | 'store_verification'
    | 'order_tracking'
    | 'contact_support'
    | 'out_of_bounds'
    | 'greeting'
    | 'general_help';
  keywords: string[];
  matchedProducts: AssistantProduct[];
  priceConstraint?: { max?: number; min?: number; sort?: 'asc' | 'desc' };
}

function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .trim();
}

function analyzeContext(userQuery: string, catalog: AssistantProduct[]): ContextAnalysis {
  const normQuery = normalizeArabic(userQuery);
  const tokens = normQuery.split(/\s+/).filter(t => t.length > 1);

  const outOfBoundsWords = [
    'برمجه', 'كود', 'بايثون', 'جافا', 'سياسه', 'حرب', 'رئيس', 'دوله', 
    'عاصمه', 'طبخ البيتزا', 'شعر غزل', 'فيزياء', 'كيمياء', 'ترجم انجليزي', 'طقس العالم'
  ];
  if (outOfBoundsWords.some(w => normQuery.includes(w))) {
    return { intent: 'out_of_bounds', keywords: tokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('عربون') || 
    normQuery.includes('حجز') || 
    normQuery.includes('احجز') || 
    normQuery.includes('حجوزات') || 
    normQuery.includes('حجز مسبق')
  ) {
    return {
      intent: 'preorder_deposit',
      keywords: tokens,
      matchedProducts: findRelevantProducts(normQuery, catalog, tokens).slice(0, 4)
    };
  }

  if (
    normQuery.includes('دفع') || 
    normQuery.includes('كريمي') || 
    normQuery.includes('جوالي') || 
    normQuery.includes('جيب') || 
    normQuery.includes('محفظه') || 
    normQuery.includes('محافظ') || 
    normQuery.includes('تحويل') || 
    normQuery.includes('سند') || 
    normQuery.includes('اشعار') ||
    normQuery.includes('عند الاستلام') ||
    normQuery.includes('حساب بنكي')
  ) {
    return { intent: 'payment_methods', keywords: tokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('مندوب') || 
    normQuery.includes('توصيل طلبات') || 
    normQuery.includes('رتبه توصيل') || 
    normQuery.includes('اصير مندوب') || 
    normQuery.includes('اريد اشتغل توصيل') ||
    normQuery.includes('بوابه التوصيل')
  ) {
    return { intent: 'courier_role', keywords: tokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('شحن') || 
    normQuery.includes('توصيل') || 
    normQuery.includes('كم سعر التوصيل') || 
    normQuery.includes('رسوم التوصيل') || 
    normQuery.includes('لصنعاء') || 
    normQuery.includes('لعدن') || 
    normQuery.includes('للمحافظات') ||
    normQuery.includes('شركه شحن')
  ) {
    return { intent: 'shipping_delivery', keywords: tokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('تتبع') || 
    normQuery.includes('طلبي') || 
    normQuery.includes('طلباتي') || 
    normQuery.includes('وين وصل') || 
    normQuery.includes('متابعه الطلب') || 
    normQuery.includes('حاله الطلب')
  ) {
    return { intent: 'order_tracking', keywords: tokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('توثيق') || 
    normQuery.includes('موثق') || 
    normQuery.includes('فتح متجر') || 
    normQuery.includes('انشاء متجر') || 
    normQuery.includes('سجل تجاري') || 
    normQuery.includes('اضيف منتجاتي') || 
    normQuery.includes('حساب تاجر')
  ) {
    return { intent: 'store_verification', keywords: tokens, matchedProducts: [] };
  }

  if (
    normQuery.includes('تواصل') || 
    normQuery.includes('اداره') || 
    normQuery.includes('رقم هاتف') || 
    normQuery.includes('خدمه العملاء') || 
    normQuery.includes('واتساب المتجر') || 
    normQuery.includes('شكوى') || 
    normQuery.includes('مساعده مباشره')
  ) {
    return { intent: 'contact_support', keywords: tokens, matchedProducts: [] };
  }

  if (
    normQuery === 'مرحبا' || 
    normQuery === 'اهلا' || 
    normQuery === 'سلام' || 
    normQuery === 'السلام عليكم' || 
    normQuery === 'صباح الخير' || 
    normQuery === 'مساء الخير' ||
    (normQuery.startsWith('مرحبا') && normQuery.length < 15)
  ) {
    return { 
      intent: 'greeting', 
      keywords: tokens, 
      matchedProducts: catalog.slice(0, 4) 
    };
  }

  let priceConstraint: { max?: number; min?: number; sort?: 'asc' | 'desc' } | undefined;
  if (normQuery.includes('ارخص') || normQuery.includes('اقل سعر')) {
    priceConstraint = { sort: 'asc' };
  } else if (normQuery.includes('اغلى') || normQuery.includes('افضل نوع')) {
    priceConstraint = { sort: 'desc' };
  }

  const matched = findRelevantProducts(normQuery, catalog, tokens, priceConstraint);
  
  if (matched.length > 0 || normQuery.includes('كم سعر') || normQuery.includes('بكم') || normQuery.includes('سعر')) {
    return { 
      intent: 'product_search', 
      keywords: tokens, 
      matchedProducts: matched,
      priceConstraint
    };
  }

  return { intent: 'general_help', keywords: tokens, matchedProducts: catalog.slice(0, 4) };
}

function findRelevantProducts(
  normQuery: string,
  catalog: AssistantProduct[],
  tokens: string[],
  constraint?: { sort?: 'asc' | 'desc' }
): AssistantProduct[] {
  const scored = catalog.map(p => {
    let score = 0;
    const titleNorm = normalizeArabic(p.title || '');
    const descNorm = normalizeArabic(p.description || '');
    const catNorm = normalizeArabic(p.category || '');
    const ownerNorm = normalizeArabic(p.ownerName || '');

    if (titleNorm.includes(normQuery)) score += 20;
    if (catNorm.includes(normQuery)) score += 12;
    if (descNorm.includes(normQuery)) score += 8;

    for (const token of tokens) {
      if (token.length < 2) continue;
      if (titleNorm.includes(token)) score += 6;
      if (catNorm.includes(token)) score += 4;
      if (descNorm.includes(token)) score += 2;
      if (ownerNorm.includes(token)) score += 3;
    }

    if (p.ownerVerified) score += 1.5;
    if (p.stock && p.stock > 0) score += 1;

    return { product: p, score };
  });

  let matching = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);

  if (constraint?.sort === 'asc') {
    matching = matching.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (constraint?.sort === 'desc') {
    matching = matching.sort((a, b) => (b.price || 0) - (a.price || 0));
  }

  return matching.slice(0, 6);
}

export function runStandaloneStoreAi(
  userQuery: string,
  catalog: AssistantProduct[],
  settings?: any
): AssistantChatResponse {
  const storeName = settings?.storeName || 'يمن ستور';
  const analysis = analyzeContext(userQuery, catalog);

  switch (analysis.intent) {
    case 'out_of_bounds': {
      return {
        reply: `أهلاً بك! أنا المساعد الذكي المخصص حصرياً لمنصة "${storeName}". 🛍️\n\nتخصصي هو مساعدتك في كل ما يتعلق بالمتجر فقط:\n• البحث عن السلع والمنتجات ومقارنة الأسعار.\n• شرح نظام الحجز المسبق ودفع العربون الضامن.\n• توضيح المحافظ الإلكترونية وطرق السداد والشحن.\n• مساعدة مناديب التوصيل والمتاجر المعتمدة.\n\nيسعدني جداً الإجابة على أي استفسار يخص التسوق والمنتجات! بماذا يمكنني خدمتك في المتجر؟`,
        products: catalog.slice(0, 3),
        suggestedQuestions: [
          'ما هي المنتجات الأكثر طلباً؟',
          'كيف يعمل نظام دفع العربون والحجز؟',
          'ما هي المحافظ المعتمدة للسداد؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'preorder_deposit': {
      let productContext = '';
      if (analysis.matchedProducts.length > 0) {
        const p = analysis.matchedProducts[0];
        const deposit = p.depositAmount || Math.round(p.price * 0.2);
        productContext = `\n\n📌 مثال على منتج "${p.title}":\n• السعر الإجمالي: ${p.price.toLocaleString()} ر.ي\n• العربون المطلوب: ${deposit.toLocaleString()} ر.ي فقط\n• المتبقي عند الاستلام: ${(p.price - deposit).toLocaleString()} ر.ي`;
      }

      return {
        reply: `نظام الحجز المسبق ودفع العربون في منصة ${storeName}: 📦✨\n\nهو ميزة أمان وحصرية تتيح لك تثبيت وحجز السلع النادرة أو محدودة الكمية باسمك مباشرة من المتاجر الموثقة، وفق الضوابط التالية:\n\n1. سداد عربون رمزي (عادة 20% أو المبلغ المحدد في بطاقة المنتج) عبر الكريمي أو المحافظ الإلكترونية المعتمدة.\n2. يتم حجز السلعة وتجميد بيعها لأي عميل آخر لمدة الحجز المحددة (من 3 إلى 5 أيام عمل).\n3. تلتزم بالتوجه للمتجر أو انتظار مندوب التوصيل وسداد باقي القيمة لاستلام سلعتك.\n4. شرط الأمان: في حال انتهاء فترة الحجز المحددة دون سداد باقي المبلغ أو التواصل، يحق للمتجر إلغاء الحجز واحتساب العربون تعويضاً عن حجز السلعة.${productContext}`,
        products: analysis.matchedProducts,
        suggestedQuestions: [
          'عرض المنتجات المتاحة للحجز المسبق',
          'ما هي المحافظ الإلكترونية المعتمدة لسداد العربون؟',
          'كيف أتواصل مع المتجر قبل دفع العربون؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'payment_methods': {
      return {
        reply: `طرق السداد والمحافظ الإلكترونية المعتمدة في منصة ${storeName}: 💳📱\n\nنوفر خيارات دفع آمنة وسلسة تناسب جميع العملاء في اليمن:\n\n1. الدفع نقداً عند الاستلام (COD):\nتدفع قيمة المشتريات نقداً لمندوب التوصيل فور وصول الطرد وفحصه.\n\n2. السداد المباشر عبر المحافظ الإلكترونية المعتمدة:\n• بنك الكريمي (حساب مميز / إرسال حوالة كريمي كاش)\n• محفظة جوالي (Jawali)\n• محفظة جيب (Jeeb)\n• ون كاش وكاش إكسبرس\n\n3. خطوات تأكيد التحويل:\nعند اختيار المحفظة في صفحة السلة، يظهر لك رقم الحساب المعتمد للمتجر واسمه الرسمي، وبعد إتمام التحويل من تطبيقك المصرفي تقوم برفع لقطة الشاشة أو صورة إشعار السند ليتم تجهيز طلبك فوراً.`,
        products: [],
        suggestedQuestions: [
          'كيف أتأكد من وصول حوالتي للمتجر؟',
          'هل يوجد رسوم إضافية عند الدفع بالمحفظة؟',
          'عرض سلة المشتريات لإتمام الطلب'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'shipping_delivery': {
      return {
        reply: `خدمات الشحن والتوصيل في منصة ${storeName}: 🛵📦\n\n• تغطية جغرافية شاملة: نوفر التوصيل السريع داخل المدن الرئيسية (صنعاء، عدن، تعز، الحديدة، المكلا، إب، ذمار) ولكافة المحافظات اليمنية.\n• أجور التوصيل: محددة ورمزية وتبدأ غالباً من 1,500 ريال يمني داخل المدينة الواحدة، وتظهر محسوبة بدقة في سلة الشراء قبل التأكيد.\n• تتبع دقيق بالملاحة: يتم ربط الطلب بمندوب توصيل معتمد يتحرك بملاحة الـ GPS من موقع المتجر إلى موقعك الجغرافي مباشرة.\n• فحص وسلامة الشحنة: يلتزم المندوب بتسليمك الطرد مغلفاً ومحمياً وفق معايير سلامة البضائع.`,
        products: [],
        suggestedQuestions: [
          'كم المدة المستغرقة لوصول الطلب؟',
          'هل يمكنني استلام الطلب بنفسي من مقر المتجر؟',
          'كيف أحدد موقعي بدقة على الخريطة؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'courier_role': {
      return {
        reply: `بوابة مندوب التوصيل المعتمد في ${storeName}: 🛵⚡\n\nتتيح المنصة نظاماً متطوراً لمناديب التوصيل المستقلين لاستلام الشحنات وتوصيلها مع تحقيق دخل فوري:\n\n• كيف تعمل البوابة؟\nيدخل المندوب عبر حسابه إلى تبويب "بوابة التوصيل" ويشاهد الطلبات المتاحة فور اعتمادها من الزبائن.\n• محطة الاستلام: توفر المنصة موقع المتجر ورقم هاتفه وملاحة خرائط Google المباشرة للتوجه واستلام الطرد.\n• محطة التسليم: توفر موقع الزبون الدقيق بالـ GPS ورقم هاتفه للتسليم وتحصيل القيمة وأجرة التوصيل.\n• الانضمام كمندوب:\nإذا كنت تملك وسيلة نقل وترغب بالانضمام لمناديب ${storeName}، يمكنك مراسلة إدارة المنصة عبر تبويب الرسائل لطلب اعتماد رتبة توصيل على حسابك.`,
        products: [],
        suggestedQuestions: [
          'مراسلة الإدارة لطلب رتبة مندوب توصيل',
          'ما هي شروط العمل كمندوب في المنصة؟',
          'أين أجد بوابة التوصيل في الموقع؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'store_verification': {
      return {
        reply: `المتاجر المعتمدة وشارة التوثيق في ${storeName}: 🛡️🏪\n\n• ما هي شارة التوثيق؟\nتحمل المتاجر المعتمدة علامة صح زرقاء أو خضراء تؤكد أن إدارة المنصة قد تحققت رسمياً من الهوية التجارية لصاحب المتجر وموقعه وسجله التجاري لضمان حماية المشتري 100%.\n\n• فتح متجر جديد في المنصة:\nيمكن لأي تاجر أو صاحب عمل في اليمن إنشاء متجره الخاص عبر المنصة، عرض منتجاته، تحديد رسوم التوصيل، واستقبال الحجوزات والمبيعات مع لوحة تحكم متكاملة لإدارة المخزون.\n\n• لطلب توثيق متجرك: تواصل مع الإدارة عبر تبويب المحادثات لتقديم بيانات النشاط وتفعيل شارة الاعتماد.`,
        products: [],
        suggestedQuestions: [
          'كيف أنشئ حساب متجر جديد؟',
          'تصفح قائمة المتاجر الموثقة في المنصة',
          'ما هي عمولة المنصة على المبيعات؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'order_tracking': {
      return {
        reply: `متابعة حالة الطلبات والحجوزات في ${storeName}: 📋🔍\n\nيمكنك معرفة حالة أي طلب قمت به بكل سهولة عبر الخطوات التالية:\n\n1. افتح تبويب "طلباتي" أو "حسابي" من الشريط السفلي.\n2. ستجد قائمة بكافة طلبات الشراء والحجوزات المسبقة مع تفاصيل الحالات التالية:\n• قيد الانتظار: بانتظار مراجعة المتجر أو تأكيد إشعار التحويل.\n• جاري التجهيز: المتجر يقوم بتغليف البضاعة وإعداد الطرد.\n• في الطريق مع المندوب: الشحنة بحوزة المندوب متوجهة لموقعك.\n• تم التسليم بنجاح: تم استلام البضاعة وسداد المبلغ.\n\nكما يمكنك مراسلة المتجر مباشرة داخل التطبيق في أي وقت للاستفسار عن موعد الوصول!`,
        products: [],
        suggestedQuestions: [
          'الذهاب إلى صفحة طلباتي الآن',
          'ماذا أفعل إذا تأخر طلبي عن الموعد؟',
          'كيف أتواصل مع مندوب التوصيل؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'contact_support': {
      const adminContacts = settings?.adminContacts || [];
      const primaryPhone = adminContacts[0]?.phone || '777000000';
      return {
        reply: `مركز الدعم والتواصل المباشر مع إدارة ${storeName}: 📞🤝\n\nنحن هنا لخدمتك ومساعدتك في أي استفسار أو شكوى:\n\n• المراسلة الفورية داخل التطبيق:\nيمكنك إرسال رسالة مباشرة لحساب "الإدارة" عبر صفحة الرسائل الحالية وسيقوم فريق الدعم بالرد عليك فوراً.\n• الهاتف والواتساب المعتمد: ${primaryPhone}\n• فريق خدمة العملاء متاح يومياً لمتابعة الشحنات والرد على استفسارات المتاجر والمشترين.`,
        products: [],
        suggestedQuestions: [
          'مراسلة الإدارة الآن',
          'الاستفسار عن الشحن والتوصيل',
          'تقديم شكوى أو اقتراح'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'greeting': {
      return {
        reply: `أهلاً وسهلاً بك في منصة ${storeName}! ✨🛍️\n\nأنا مستشارك الذكي المخصص لمساعدتك في كل ما يخص المتجر.\nيمكنني مساعدتك في:\n🔍 البحث عن أي منتج والتعرف على الأسعار والمواصفات.\n📦 معرفة كيفية الحجز المسبق ودفع العربون.\n🚚 الاستفسار عن الشحن والتوصيل لكافة المحافظات.\n💳 التعرف على المحافظ الإلكترونية وطرق السداد.\n\nتفضل بسؤالي أو ابحث عن أي منتج تريده بالاسم!`,
        products: analysis.matchedProducts,
        suggestedQuestions: [
          'ابحث لي عن أحدث المنتجات المتوفرة',
          'ما هي المنتجات الأكثر طلباً في المتجر؟',
          'كيف يعمل نظام الحجز ودفع العربون؟'
        ],
        provider: 'standalone_store_ai'
      };
    }

    case 'product_search':
    default: {
      const prods = analysis.matchedProducts;
      if (prods.length > 0) {
        const prices = prods.map(p => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceSummary = minPrice === maxPrice 
          ? `بسعر ${minPrice.toLocaleString()} ر.ي` 
          : `بأسعار تتراوح بين ${minPrice.toLocaleString()} و ${maxPrice.toLocaleString()} ر.ي`;

        return {
          reply: `أهلاً بك! وجدت لك ${prods.length} منتج يطابق استفسارك عن "${userQuery}" ${priceSummary}. ✨\n\nجميع المنتجات أدناه متوفرة ويمكنك الضغط مباشرة على بطاقة أي منتج لعرض التفاصيل الكاملة، إضافته للسلة، أو الحجز المسبق بالعربون:`,
          products: prods,
          suggestedQuestions: [
            `هل يتوفر توصيل لـ ${prods[0].title}؟`,
            `كيف أحجز ${prods[0].title} بالعربون؟`,
            'عرض المزيد من المنتجات المشابهة'
          ],
          provider: 'standalone_store_ai'
        };
      }

      return {
        reply: `أهلاً بك في ${storeName}! 🛍️\nبحثت لك في الكتالوج الحالي عن "${userQuery}"، ويبدو أن هذا المنتج غير متوفر بالاسم الصريح حالياً، ولكن يتوفر لدينا العديد من المنتجات والماركات المعتمدة في الأقسام المتنوعة.\n\nيمكنك تصفح بعض الخيارات المقترحة أدناه أو إخباري بقسم معين (مثل هواتف، عسل، ملابس، إلكترونيات) لأعرض لك المتوفر فوراً!`,
        products: catalog.slice(0, 4),
        suggestedQuestions: [
          'عرض جميع المنتجات المتوفرة',
          'ما هي أقسام المتجر الرئيسية؟',
          'تواصل مع المتجر لطلب توفير السلعة'
        ],
        provider: 'standalone_store_ai'
      };
    }
  }
}
