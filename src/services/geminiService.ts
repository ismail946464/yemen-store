import { runStandaloneStoreAi } from './storeAiEngine';

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch('/api/ai/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.message || `Server responded with ${res.status}`);
    }

    const data: AssistantResponse = await res.json();
    return data;
  } catch (error: any) {
    // When offline, installed as PWA, or if backend timeout occurs:
    // Execute the dedicated Standalone Store AI Engine directly on the client!
    console.info('Using standalone store AI engine fallback:', error?.message || error);
    const standaloneResult = runStandaloneStoreAi(
      params.message,
      params.catalogProducts || [],
      params.storeSettings
    );

    return {
      success: true,
      reply: standaloneResult.reply,
      products: standaloneResult.products,
      suggestedQuestions: standaloneResult.suggestedQuestions,
      provider: 'standalone_store_ai'
    };
  }
}

export const aiSystem = {
  async generateLogicUpdate(_prompt: string, _currentAppConfig: any) {
    return {};
  }
};
