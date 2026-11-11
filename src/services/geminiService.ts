/**
 * Frontend client service for Yemen Store AI Assistant (Gemini)
 * Communicates with server-side proxy route /api/ai/assistant
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

export interface AssistantResponse {
  success: boolean;
  reply: string;
  products: AssistantProduct[];
  suggestedQuestions?: string[];
  provider?: string;
}

export async function askStoreAssistant(params: {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  catalogProducts?: AssistantProduct[];
  storeSettings?: any;
}): Promise<AssistantResponse> {
  try {
    const res = await fetch('/api/ai/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.message || `Server responded with ${res.status}`);
    }

    const data: AssistantResponse = await res.json();
    return data;
  } catch (error: any) {
    console.warn('Store Assistant error (handled):', error?.message || error);
    const q = (params.message || '').toLowerCase().trim();
    const matching = (params.catalogProducts || [])
      .filter(p => (p.title || '').toLowerCase().includes(q) || ((p.category || '')).toLowerCase().includes(q))
      .slice(0, 4);

    return {
      success: true,
      reply: matching.length > 0 
        ? `أهلاً بك! وجدت لك ${matching.length} منتج متوفر في المتجر يطابق استفسارك:` 
        : 'أهلاً بك! يمكنك البحث عن أي منتج بالاسم وسأقوم بعرض تفاصيل السعر والشحن فوراً.',
      products: matching,
      provider: 'client_fallback'
    };
  }
}

export const aiSystem = {
  async generateLogicUpdate(_prompt: string, _currentAppConfig: any) {
    return {};
  }
};
