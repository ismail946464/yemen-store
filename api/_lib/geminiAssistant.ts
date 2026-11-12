import { GoogleGenAI, Type } from "@google/genai";
import { runStandaloneStoreAi } from "./storeAiEngine.js";

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
  provider: 'gemini' | 'standalone_store_ai' | 'local_catalog';
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

export async function processAssistantMessage(
  payload: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const { message, history = [], catalogProducts = [], storeSettings } = payload;
  const userMessage = (message || '').trim();

  if (!userMessage) {
    return {
      reply: 'مرحباً بك! كيف يمكنني مساعدتك في التسوق أو البحث عن منتجات اليوم؟',
      products: [],
      provider: 'standalone_store_ai'
    };
  }

  const ai = getGeminiClient(storeSettings?.geminiApiKey);

  // If no Gemini client / API key, use comprehensive standalone store AI engine
  if (!ai) {
    return runStandaloneStoreAi(userMessage, catalogProducts, storeSettings);
  }

  try {
    const storeName = storeSettings?.storeName || 'يمن ستور';
    const storeDesc = storeSettings?.storeDescription || 'سوق مركزي رقمي في اليمن يجمع المنتجات والماركات العالمية مع خدمات الحجز المسبق';

    // Intelligently select the most relevant products rather than dumping 70 raw products
    const queryTokens = userMessage.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const sortedProducts = [...catalogProducts].sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      const aMatches = queryTokens.filter(t => aTitle.includes(t)).length;
      const bMatches = queryTokens.filter(t => bTitle.includes(t)).length;
      return bMatches - aMatches;
    }).slice(0, 30);

    const catalogSnippet = sortedProducts.map(p => {
      return `[ID: ${p.id}] ${p.title} | ${p.price} ر.ي | ${p.category || 'عام'}`;
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

    // Keep up to last 4 history messages to keep context lean and fast
    const recentHistory = history.slice(-4);
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

    let timeoutTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error('Gemini request timeout')), 25000);
    });

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

    let response: any;
    try {
      response = await Promise.race([generatePromise, timeoutPromise]);
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }

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

      // If Gemini suggested IDs that aren't exact, fallback to standalone AI engine matching
      const finalProducts = matchedProducts.length > 0 
        ? matchedProducts 
        : runStandaloneStoreAi(userMessage, catalogProducts, storeSettings).products;

      return {
        reply: parsed.reply,
        products: finalProducts.slice(0, 6),
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : undefined,
        provider: 'gemini'
      };
    }

    // Fallback if parsing failed
    return runStandaloneStoreAi(userMessage, catalogProducts, storeSettings);

  } catch (error: any) {
    console.warn('Gemini Assistant Notice (served via standalone store AI engine):', error?.message || error);
    // Graceful fallback to standalone store AI engine
    return runStandaloneStoreAi(userMessage, catalogProducts, storeSettings);
  }
}
