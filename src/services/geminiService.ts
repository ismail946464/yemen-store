import {
  runStandaloneStoreAi,
  type AssistantProduct,
  type AssistantPromoHint,
  type AssistantAction,
  type AssistantComparisonRow,
  type AssistantStatItem
} from './storeAiEngine';

export type {
  AssistantProduct,
  AssistantPromoHint,
  AssistantAction,
  AssistantComparisonRow,
  AssistantStatItem
};

/**
 * Frontend client service for Yemen Store AI Assistant (Gemini)
 * Communicates with server-side proxy route /api/ai/assistant
 */

export interface AssistantResponse {
  success: boolean;
  reply: string;
  products: AssistantProduct[];
  suggestedQuestions?: string[];
  actions?: AssistantAction[];
  comparisonRows?: AssistantComparisonRow[];
  promoHints?: AssistantPromoHint[];
  statsHighlight?: AssistantStatItem[];
  provider?: string;
}

export async function askStoreAssistant(params: {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  catalogProducts?: AssistantProduct[];
  storeSettings?: any;
  activePromos?: AssistantPromoHint[];
  categories?: Array<{ name: string; slug?: string }>;
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
    console.info('Using standalone store AI engine fallback:', error?.message || error);
    const standaloneResult = runStandaloneStoreAi(
      params.message,
      params.catalogProducts || [],
      params.storeSettings,
      {
        history: params.history,
        activePromos: params.activePromos,
        categories: params.categories
      }
    );

    return {
      success: true,
      reply: standaloneResult.reply,
      products: standaloneResult.products,
      suggestedQuestions: standaloneResult.suggestedQuestions,
      actions: standaloneResult.actions,
      comparisonRows: standaloneResult.comparisonRows,
      promoHints: standaloneResult.promoHints,
      statsHighlight: standaloneResult.statsHighlight,
      provider: 'standalone_store_ai'
    };
  }
}

export const aiSystem = {
  async generateLogicUpdate(_prompt: string, _currentAppConfig: any) {
    return {};
  }
};
