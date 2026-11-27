import { GoogleGenAI, Type } from "@google/genai";
import {
  runStandaloneStoreAi,
  normalizeArabic,
  type AssistantProduct,
  type AssistantPromoHint,
  type AssistantAction,
  type AssistantComparisonRow,
  type AssistantStatItem,
  type AssistantChatResponse as EngineResponse
} from "./storeAiEngine.js";

export type { AssistantProduct, AssistantPromoHint, AssistantAction, AssistantComparisonRow, AssistantStatItem };

export interface AssistantChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  catalogProducts?: AssistantProduct[];
  storeSettings?: any;
  activePromos?: AssistantPromoHint[];
  categories?: Array<{ name: string; slug?: string }>;
}

export interface AssistantChatResponse extends Omit<EngineResponse, 'provider'> {
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
    await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: 'مرحباً، أجب بكلمة واحدة: متصل'
    });
    return {
      success: true,
      message: 'تم الاتصال بنموذج Google Gemini بنجاح! الذكاء الاصطناعي جاهز للعمل.',
      model: 'gemini-4-hydrogen'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `فشل الاتصال بـ Gemini: ${err?.message || 'تأكد من صحة المفتاح وتفعيل الحصة'}`
    };
  }
}

/**
 * Sanitizes chat history so Gemini always receives:
 * 1) Non-empty turns
 * 2) Starting with role 'user' (never 'model' welcome greeting)
 * 3) Strict user -> model alternation with trailing duplicate userMessage stripped
 */
function buildAlternatingContents(
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  userMessage: string
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const normalizedCurrent = userMessage.trim();
  const rawTurns: Array<{ role: 'user' | 'model'; text: string }> = [];

  for (const h of history.slice(-8)) {
    const txt = String(h?.text || '').trim();
    if (!txt) continue;
    const role: 'user' | 'model' = h.role === 'assistant' ? 'model' : 'user';
    rawTurns.push({ role, text: txt });
  }

  // Drop trailing duplicate if client already persisted userMessage into history
  if (
    rawTurns.length > 0 &&
    rawTurns[rawTurns.length - 1].role === 'user' &&
    rawTurns[rawTurns.length - 1].text === normalizedCurrent
  ) {
    rawTurns.pop();
  }

  // Drop leading 'model' turns (e.g. initial welcome message)
  while (rawTurns.length > 0 && rawTurns[0].role === 'model') {
    rawTurns.shift();
  }

  // Merge consecutive turns of the same role so alternation is strictly maintained
  const merged: Array<{ role: 'user' | 'model'; text: string }> = [];
  for (const turn of rawTurns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.text = `${last.text}\n${turn.text}`;
    } else {
      merged.push({ ...turn });
    }
  }

  // Ensure the turn immediately before the new 'userMessage' is 'model' (if non-empty)
  if (merged.length > 0 && merged[merged.length - 1].role === 'user') {
    merged.pop();
  }

  // Cap at last 4 alternating turns
  const finalTurns = merged.slice(-4);
  const contents = finalTurns.map((t) => ({
    role: t.role,
    parts: [{ text: t.text }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: normalizedCurrent }]
  });

  return contents;
}

const ALLOWED_ACTION_ROUTES = new Set([
  '/cart',
  '/orders',
  '/requests',
  '/watchlist',
  '/search-stores',
  '/safety-guide',
  '/contact?to=admin',
  '/delivery',
  '/'
]);

export async function processAssistantMessage(
  payload: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const {
    message,
    history = [],
    catalogProducts = [],
    storeSettings,
    activePromos = [],
    categories = []
  } = payload;
  const userMessage = (message || '').trim();

  if (!userMessage) {
    return {
      reply: 'مرحباً بك! كيف يمكنني مساعدتك في التسوق أو البحث عن منتجات اليوم؟',
      products: [],
      provider: 'standalone_store_ai'
    };
  }

  const ai = getGeminiClient(storeSettings?.geminiApiKey);
  const standaloneOptions = { history, activePromos, categories };

  // If no Gemini client / API key, use comprehensive standalone store AI engine
  if (!ai) {
    return runStandaloneStoreAi(userMessage, catalogProducts, storeSettings, standaloneOptions);
  }

  try {
    const storeName = storeSettings?.storeName || 'متجر محيط';
    const storeDesc = storeSettings?.storeDescription || 'سوق مركزي رقمي في اليمن يجمع المنتجات والماركات العالمية مع خدمات الحجز المسبق';

    // Pre-score catalog using Arabic normalization so Gemini sees the most relevant 35 products
    const normMsg = normalizeArabic(userMessage);
    const queryTokens = normMsg.split(/\s+/).filter((t) => t.length > 1);
    const sortedProducts = [...catalogProducts]
      .sort((a, b) => {
        const aHay = normalizeArabic(`${a.title || ''} ${a.category || ''} ${a.ownerName || ''} ${a.description || ''}`);
        const bHay = normalizeArabic(`${b.title || ''} ${b.category || ''} ${b.ownerName || ''} ${b.description || ''}`);
        const aMatches = queryTokens.filter((t) => aHay.includes(t)).length + (a.ownerVerified ? 0.5 : 0);
        const bMatches = queryTokens.filter((t) => bHay.includes(t)).length + (b.ownerVerified ? 0.5 : 0);
        return bMatches - aMatches;
      })
      .slice(0, 35);

    const catalogSnippet = sortedProducts
      .map((p) => {
        const stockStr = p.stock === null || p.stock === undefined ? 'متوفر' : `مخزون:${p.stock}`;
        const delivStr = p.noDelivery
          ? 'استلام من المتجر فقط'
          : Number(p.deliveryFee || 0) === 0
            ? 'توصيل مجاني'
            : `توصيل:${p.deliveryFee} ر.ي`;
        const depStr = p.depositAmount ? ` | عربون:${p.depositAmount}` : '';
        const offerStr = p.hasOffer ? ` | عرض:${p.offerTitle || p.offerExtras || 'خصم'}` : '';
        const verStr = p.ownerVerified ? '✓موثق' : '';
        return `[ID: ${p.id}] ${p.title} | السعر:${p.price} ر.ي${p.originalPrice && p.originalPrice > p.price ? ` (بدلاً من ${p.originalPrice})` : ''} | القسم:${p.category || 'عام'} | المتجر:${p.ownerName || '-'} ${verStr} | ${delivStr} | ${stockStr}${depStr}${offerStr}`;
      })
      .join('\n');

    const promoSnippet = activePromos.length > 0
      ? activePromos
          .slice(0, 10)
          .map((c) => `كود: ${c.code} (${c.discountType === 'percent' ? `${c.discountValue}%` : `${c.discountValue} ر.ي`}${c.minOrderAmount ? `, حد أدنى ${c.minOrderAmount} ر.ي` : ''})`)
          .join(' | ')
      : 'لا توجد كوبونات عامة نشطة حالياً';

    const categorySnippet = categories.length > 0
      ? categories.map((c) => c.name).filter(Boolean).join('، ')
      : Array.from(new Set(catalogProducts.map((p) => p.category).filter(Boolean))).join('، ');

    const systemInstruction = `
أنت "مستشار ${storeName} الذكي" الرسمي، مدعوم بتقنية Gemini من Google.
أنت خبير تسوق شخصي وتجاري متخصص حصرياً في خدمة عملاء وزوار منصة "${storeName}".

معلومات ومميزات المنصة الكاملة:
- اسم المنصة: ${storeName} — ${storeDesc}
- الأقسام المتاحة: ${categorySnippet || 'متنوعة'}
- أكواد الخصم (الكوبونات) النشطة: ${promoSnippet}
- طرق الدفع: الدفع نقداً عند الاستلام، أو عبر المحافظ الإلكترونية المعتمدة (بنك الكريمي، جوالي، جيب، ون كاش، كاش إكسبرس) بدون رسوم إضافية من المنصة، مع إرفاق إشعار التحويل في صفحة السلة (/cart).
- الحجز المسبق بالعربون: تجميد السلعة باسم العميل عبر سداد عربون (عادة 20% أو المحدد في المنتج) لمدة 3-5 أيام، ثم سداد الباقي عند الاستلام.
- التفاوض على السعر: يمكن للعميل الضغط على «تفاوض على السعر» في صفحة المنتج وتقديم عرضه، ومتابعة الرد في «طلباتي -> عروض الأسعار» (/orders).
- اطلب تسعيرة (/requests): إذا لم يجد العميل سلعته بالكتالوج، ينشر طلباً لتتنافس المتاجر الموثقة على تسعيره.
- رادار الأسعار والمفضلة (/watchlist): لتنبيه العميل عند انخفاض السعر أو توفر المخزون.
- الأسئلة والأجوبة العامة: متاحة في أسفل صفحة كل منتج للتواصل العلني مع التاجر.
- الشحن والتوصيل: تغطية لجميع المحافظات اليمنية مع تحديد الموقع بالـ GPS، بالإضافة لخيار الاستلام المباشر من مقر المتجر للمنتجات المحددة.

قواعد صارمة ودقيقة:
1. التزم حصرياً بشؤون التسوق والمنتجات وخدمات ${storeName}. للمواضيع الخارجة عن التجارة والتسوق اعتذر بلباقة وأعد توجيه العميل لخدمات المتجر.
2. لا تكرر إجابة نمطية واحدة أبداً؛ افهم نية العميل بدقة (سؤال عن منتج، مقارنة، ميزانية، كوبونات، تفاوض، تتبع طلب، شحن، مندوب، فتح متجر) وأجب ببيانات دقيقة ومباشرة من الكتالوج الحقيقي أدناه.
3. لا تخترع منتجات أو أسعاراً أو كوبونات غير موجودة في البيانات المزودة.
4. ضع معرفات المنتجات (ID) المطابقة بدقة في matchedProductIds (بحد أقصى 6).
5. إذا طلب العميل مقارنة بين منتجات، اجعل wantsComparison = true واختر 2-4 منتجات في matchedProductIds.
6. إذا كان من المفيد توجيه العميل لصفحة معينة، أضف إجراءً أو اثنين في actions مستخدماً المسارات المسموحة فقط: /cart, /orders, /requests, /watchlist, /search-stores, /safety-guide, /contact?to=admin, /delivery.

كتالوج المنتجات الحالي (${catalogProducts.length} منتج):
${catalogSnippet || 'لا توجد منتجات حالياً'}
`.trim();

    const contents = buildAlternatingContents(history, userMessage);

    let timeoutTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error('Gemini request timeout')), 25000);
    });

    const generatePromise = ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: contents as any,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'نص الرد الدقيق والمخصص باللغة العربية بأسلوب راقٍ وواضح ومباشر'
            },
            matchedProductIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'مصفوفة معرفات المنتجات المطابقة من الكتالوج (حسب الـ ID)'
            },
            suggestedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-3 أسئلة متابعة ذكية ومرتبطة بالسياق الحالي'
            },
            wantsComparison: {
              type: Type.BOOLEAN,
              description: 'true فقط إذا طلب العميل مقارنة بين المنتجات'
            },
            includePromos: {
              type: Type.BOOLEAN,
              description: 'true إذا سأل العميل عن كوبونات أو أكواد خصم'
            },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  route: { type: Type.STRING }
                },
                required: ['label', 'route']
              },
              description: 'روابط إجراءات سريعة مفيدة للمستخدم من المسارات المسموحة فقط'
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
      const matchedProducts = catalogProducts.filter((p) => matchedIds.includes(p.id));

      const standaloneHint = runStandaloneStoreAi(userMessage, catalogProducts, storeSettings, standaloneOptions);
      const finalProducts = matchedProducts.length > 0 ? matchedProducts : standaloneHint.products;

      const safeActions: AssistantAction[] | undefined = Array.isArray(parsed.actions)
        ? parsed.actions
            .filter((a: any) => a?.label && a?.route && (ALLOWED_ACTION_ROUTES.has(a.route) || String(a.route).startsWith('/product/')))
            .slice(0, 2)
            .map((a: any, idx: number) => ({
              label: String(a.label).trim(),
              route: String(a.route).trim(),
              kind: idx === 0 ? ('primary' as const) : ('secondary' as const)
            }))
        : standaloneHint.actions;

      const comparisonRows: AssistantComparisonRow[] | undefined =
        (parsed.wantsComparison || standaloneHint.comparisonRows) && finalProducts.length >= 2
          ? finalProducts.slice(0, 4).map((p) => {
              const safePrice = Math.max(0, Math.round(Number(p.price || 0)));
              const rawDep = Number(p.depositAmount || 0);
              const dep = safePrice > 0
                ? Math.min(safePrice, rawDep > 0 ? Math.round(rawDep) : Math.max(1000, Math.round(safePrice * 0.2)))
                : 0;
              return {
                id: p.id,
                title: p.title,
                price: safePrice,
                originalPrice: Number(p.originalPrice || 0) > safePrice ? Number(p.originalPrice) : undefined,
                deliveryFee: p.noDelivery ? undefined : Number(p.deliveryFee || 0),
                noDelivery: Boolean(p.noDelivery),
                depositAmount: dep,
                ownerName: p.ownerName || '',
                ownerVerified: Boolean(p.ownerVerified),
                category: p.category || '',
                stock: p.stock ?? null
              };
            })
          : undefined;

      const promoHints =
        (parsed.includePromos || standaloneHint.promoHints) && activePromos.length > 0
          ? activePromos.slice(0, 5)
          : undefined;

      return {
        reply: String(parsed.reply).trim(),
        products: finalProducts.slice(0, 6),
        suggestedQuestions:
          Array.isArray(parsed.suggestedQuestions) && parsed.suggestedQuestions.length > 0
            ? parsed.suggestedQuestions.slice(0, 3)
            : standaloneHint.suggestedQuestions,
        actions: safeActions && safeActions.length > 0 ? safeActions : undefined,
        comparisonRows,
        promoHints,
        statsHighlight: standaloneHint.statsHighlight,
        provider: 'gemini'
      };
    }

    return runStandaloneStoreAi(userMessage, catalogProducts, storeSettings, standaloneOptions);
  } catch (error: any) {
    console.warn('Gemini Assistant Notice (served via standalone store AI engine):', error?.message || error);
    return runStandaloneStoreAi(userMessage, catalogProducts, storeSettings, standaloneOptions);
  }
}
