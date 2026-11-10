import { GoogleGenAI, Type } from "@google/genai";

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

export interface AssistantChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  catalogProducts?: AssistantProduct[];
  storeSettings?: any;
}

export interface AssistantChatResponse {
  reply: string;
  products: AssistantProduct[];
  suggestedQuestions?: string[];
  provider: 'gemini' | 'local_catalog';
}

export function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = (customApiKey && customApiKey.trim() !== '') 
    ? customApiKey.trim() 
    : (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.API_KEY || '').trim();

  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

export async function testGeminiConnection(customApiKey?: string): Promise<{ success: boolean; message: string; model?: string }> {
  const ai = getGeminiClient(customApiKey);
  if (!ai) {
    return {
      success: false,
      message: 'لم يتم العثور على مفتاح Gemini API. يرجى إدخال المفتاح أولاً.'
    };
  }

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'مرحباً، أجب بكلمة واحدة: متصل'
    });
    return {
      success: true,
      message: 'تم الاتصال بنموذج Google Gemini بنجاح! الذكاء الاصطناعي جاهز للعمل.',
      model: 'gemini-3.8-flash'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `فشل الاتصال بـ Gemini: ${err?.message || 'تأكد من صحة المفتاح وتفعيل الحصة'}`
    };
  }
}

/**
 * Intelligent local catalog fallback when Gemini API key is missing or quota is limited
 */
function searchLocalCatalog(
  userQuery: string,
  catalog: AssistantProduct[],
  settings?: any
): AssistantChatResponse {
  const q = userQuery.toLowerCase().trim();
  const queryTokens = q.split(/\s+/).filter(t => t.length > 1);

  // Score products based on keyword match
  const scored = catalog.map(p => {
    let score = 0;
    const title = (p.title || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();

    if (title.includes(q)) score += 10;
    if (desc.includes(q)) score += 4;
    if (cat.includes(q)) score += 5;

    for (const t of queryTokens) {
      if (title.includes(t)) score += 3;
      if (desc.includes(t)) score += 1;
      if (cat.includes(t)) score += 2;
    }

    if (p.ownerVerified) score += 1;
    return { product: p, score };
  });

  const matching = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(item => item.product);

  const storeName = settings?.storeName || 'يمن ستور';

  let reply = '';
  if (matching.length > 0) {
    reply = `أهلاً بك في ${storeName}! ✨\nوجدت لك ${matching.length} منتج يطابق بحثك عن "${userQuery}". يمكنك الضغط على أي منتج أدناه لفتح صفحته مباشرة والتسوق أو الحجز المسبق:`;
  } else if (q.includes('شحن') || q.includes('توصيل')) {
    reply = `خدمات الشحن والتوصيل في ${storeName}: 🚚\nنوفر توصيلاً آمناً وسريعاً لكافة المحافظات مع ضمان سلامة المنتجات 100%. يمكنك مراجعة رسوم التوصيل لكل منتج في صفحته الخاصة.`;
  } else if (q.includes('عربون') || q.includes('حجز')) {
    reply = `نظام الحجز المسبق ودفع العربون في ${storeName}: 📦\nيضمن لك حجز السلعة باسمك لعدة أيام (غالباً 3 إلى 5 أيام) من المتاجر الموثقة عبر دفع عربون رمزي لضمان عدم بيعها لغيرك حتى إتمام الاستلام.`;
  } else if (q.includes('ضمان') || q.includes('وثق') || q.includes('توثيق')) {
    reply = `الضمان والمتاجر الموثقة في ${storeName}: 🛡️\nجميع المتاجر المعتمدة تحمل شارة التوثيق الزرقاء مع مراجعة هوياتها وسجلاتها التجارية. حقك محفوظ بنسبة 100% عند الشراء من خلال المنصة.`;
  } else {
    reply = `مرحباً بك! أنا مساعد ${storeName} الذكي. 🛍️\nأنا هنا لمساعدتك في البحث عن المنتجات، معرفة الأسعار، أو الاستفسار عن الشحن والحجز المسبق في المتجر. بماذا يمكنني مساعدتك اليوم؟`;
  }

  return {
    reply,
    products: matching,
    suggestedQuestions: [
      'ما هي المنتجات الأكثر طلباً؟',
      'كيف يعمل نظام دفع العربون والحجز؟',
      'عرض الأجهزة والإلكترونيات'
    ],
    provider: 'local_catalog'
  };
}

export async function processAssistantMessage(
  payload: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const { message, history = [], catalogProducts = [], storeSettings } = payload;
  const userMessage = (message || '').trim();

  if (!userMessage) {
    return {
      reply: 'مرحباً بك! كيف يمكنني مساعدتك في التسوق أو البحث عن منتجات اليوم؟',
      products: [],
      provider: 'local_catalog'
    };
  }

  const ai = getGeminiClient(storeSettings?.geminiApiKey);

  // If no Gemini client / API key, use rich local catalog search
  if (!ai) {
    return searchLocalCatalog(userMessage, catalogProducts, storeSettings);
  }

  try {
    const storeName = storeSettings?.storeName || 'يمن ستور';
    const storeDesc = storeSettings?.storeDescription || 'سوق مركزي رقمي في اليمن يجمع المنتجات والماركات العالمية مع خدمات الحجز المسبق';

    // Prepare catalog summary for Gemini (limit to top 60 to prevent token bloat)
    const catalogSnippet = catalogProducts.slice(0, 70).map(p => {
      return `[ID: ${p.id}] ${p.title} | السعر: ${p.price} ر.ي | القسم: ${p.category || 'عام'} | متجر: ${p.ownerName || 'متجر معتمد'} ${p.ownerVerified ? '(موثق ✓)' : ''} | متوفر: ${p.stock !== undefined && p.stock !== null ? p.stock : 'كمية متوفرة'}`;
    }).join('\n');

    const systemInstruction = `
أنت "مساعد ${storeName} الذكي" الرسمي، مدعوم بنموذج Gemini من Google.
أنت خبير المتجر ومساعد تسوق شخصي مخصص حصرياً لخدمة عملاء وزوار منصة "${storeName}".

معلومات المنصة:
- اسم المتجر: ${storeName}
- وصف المنصة: ${storeDesc}
- سياسة الحجز المسبق: حجز السلع عبر دفع عربون رمزي للمتاجر الموثقة لضمان عدم بيعها لغير العميل لمدة محددة (عادة 3 إلى 5 أيام).
- الضمان: ضمان المنصة 100% وشحن آمن لجميع المحافظات.
- التواصل: يمكن للمستخدمين مراسلة المتاجر وإدارة المتجر مباشرة عبر تبويب الرسائل.

قواعد صارمة جداً:
1. أنت محصور حصرياً في إجابات المتجر ومنتجاته وسياساته. إذا سألك المستخدم عن أي موضوع خارجي (مثل برمجة، سياسة، طبخ عام، مواضيع عامة)، اعتذر بأدب ولباقة وقل: "أنا مساعد ${storeName} المخصص لمساعدتك في التسوق والبحث عن المنتجات داخل المتجر فقط. يسعدني مساعدتك في أي استفسار يخص المتجر ومنتجاته!"
2. عندما يبحث المستخدم عن منتج أو يطلب ترشيحات، تفحص كتالوج المنتجات المتوفرة أدناه.
3. إذا وجدت منتجات مطابقة أو مشابهة، اذكرها في نص الإجابة بأسلوب جذاب ومفيد، وضع معرّفاتها (ID) بدقة في مصفوفة matchedProductIds (بحد أقصى 6 معرفات).
4. اكتب دائماً باللغة العربية الواضحة والفصيحة، مع استخدام الرموز التعبيرية المناسبة والتنسيق المرتب.
5. إذا لم يكن المنتج المطلوب متوفراً، أخبر العميل بلباقة واقترح منتجات أو أقسام قريبة متوفرة في المتجر.

كتالوج المنتجات الحالي في المتجر:
${catalogSnippet || 'لا توجد منتجات حالياً'}
`.trim();

    // Build chat contents from recent history
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Keep up to last 6 history messages
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text }]
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Gemini request timeout')), 12000)
    );

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents as any,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'نص الرد الكامل باللغة العربية بأسلوب راقٍ وشامل'
            },
            matchedProductIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'مصفوفة معرفات المنتجات المطابقة من الكتالوج (حسب الـ ID)'
            },
            suggestedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-3 أسئلة مقترحة سريعة'
            }
          },
          required: ['reply']
        }
      }
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const rawText = response.text || '';
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (parsed && parsed.reply) {
      const matchedIds: string[] = Array.isArray(parsed.matchedProductIds) ? parsed.matchedProductIds : [];
      // Resolve product objects from catalog
      const matchedProducts = catalogProducts.filter(p => matchedIds.includes(p.id));

      // If Gemini suggested IDs that aren't exact, fallback to search matching
      const finalProducts = matchedProducts.length > 0 
        ? matchedProducts 
        : searchLocalCatalog(userMessage, catalogProducts, storeSettings).products;

      return {
        reply: parsed.reply,
        products: finalProducts.slice(0, 6),
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : undefined,
        provider: 'gemini'
      };
    }

    // Fallback if parsing failed
    return searchLocalCatalog(userMessage, catalogProducts, storeSettings);

  } catch (error: any) {
    console.error('Gemini Assistant Error:', error?.message || error);
    // Graceful fallback to local catalog search
    const fallback = searchLocalCatalog(userMessage, catalogProducts, storeSettings);
    return fallback;
  }
}
