import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * خدمة الذكاء الاصطناعي لإدارة منطق التطبيق وتحديث الأكواد ديناميكياً
 */
export const aiSystem = {
  /**
   * توليد تكوين برمجي جديد بناءً على طلب المستخدم
   */
  async generateLogicUpdate(prompt: string, currentAppConfig: any) {
    if (!API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const systemInstruction = `
      أنت مهندس واجهات (Frontend Architect) خبير لمشروع "يمن ستور". مهمتك هي تحديث إعدادات المتجر بناءً على طلب المستخدم.
      
      قدراتك البرمجية والبرمجية:
      1. تحكم كامل في CSS: يمكنك كتابة كود CSS احترافي وشامل (Keyframe Animations, Grid layouts, Flexbox, Glassmorphism, Advanced Selectors).
      2. التصميم الإبداعي: استخدم المتغيرات (CSS Variables) والظلال (Box Shadows) والحواف المستديرة (Border Radius) بذكاء لجعل المتجر يبدو عصرياً.
      3. العناصر المستهدفة: استهدف عناصر مثل .brand-card, .btn-primary, .nav-bar, #hero-section لتحقيق تغييرات دقيقة.
      4. ميزة الاستمرارية: لا تحذف الإعدادات الحالية إلا إذا طلب المستخدم تغيير الهوية بالكامل. قم بدمج التحسينات البرمجية الجديدة مع الهوية البصرية الموجودة.
      
      قواعد الإخراج (Output Rules):
      - يجب أن يكون الرد JSON حصراً.
      - لا تشرح الكود، فقط قم بإنتاجه في الحقول المناسبة.
      - في حقل customCss، اكتب الكود الذي يغير المظهر بوضوح وبطريقة نظيفة.
    `;

    const fullPrompt = `التكوين الحالي للمتجر: ${JSON.stringify(currentAppConfig)}\nطلب المستخدم لتعديل المتجر: ${prompt}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: fullPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customCss: { type: Type.STRING },
              bannerMessage: { type: Type.STRING },
              features: { type: Type.ARRAY, items: { type: Type.STRING } },
              themeColor: { type: Type.STRING },
              storeFont: { type: Type.STRING },
              storeName: { type: Type.STRING },
              heroTitle: { type: Type.STRING },
              heroSubtitle: { type: Type.STRING },
            }
          }
        }
      });
      
      const text = response.text;
      if (!text) {
        throw new Error("تلقى النظام رداً فارغاً من الذكاء الاصطناعي");
      }
      
      try {
        // Since we requested application/json, the text should be clean JSON
        return JSON.parse(text.trim());
      } catch (parseError) {
        // Fallback for cases where markdown might still be present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("رد الذكاء الاصطناعي لا يحتوي على صيغة JSON صحيحة");
      }
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      throw error;
    }
  }
};
