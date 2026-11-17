import { processAssistantMessage } from "../_lib/geminiAssistant.js";
import { getFirebaseAdmin } from "../_lib/firebaseAdmin.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "الطريقة غير مسموحة" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { message, history, catalogProducts, catalog, storeSettings } = body || {};
    let effectiveSettings = storeSettings || {};

    const { db } = getFirebaseAdmin();
    const hasServiceAccount = Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_PRIVATE_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );

    if (!effectiveSettings.geminiApiKey && db && hasServiceAccount) {
      try {
        const settingsSnap = await db.collection("settings").doc("global").get();
        if (settingsSnap.exists) {
          const data = settingsSnap.data();
          if (data?.geminiApiKey) {
            effectiveSettings = { ...effectiveSettings, geminiApiKey: data.geminiApiKey };
          }
        }
      } catch {
        // ignore
      }
    }

    let products = catalogProducts || catalog;
    if ((!products || products.length === 0) && db && hasServiceAccount) {
      try {
        const snap = await db.collection("products").where("status", "==", "active").limit(100).get();
        products = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      } catch {
        // ignore
      }
    }

    const response = await processAssistantMessage({
      message: String(message || ""),
      history: Array.isArray(history) ? history : [],
      catalogProducts: Array.isArray(products) ? products : [],
      storeSettings: effectiveSettings
    });

    return res.status(200).json({ success: true, ...response });
  } catch (err: any) {
    console.error("AI Assistant route error:", err);
    return res.status(500).json({
      success: false,
      reply: "عذراً، حدث خطأ مؤقت في التواصل مع المساعد الذكي. يرجى المحاولة لاحقاً.",
      products: [],
      provider: "error"
    });
  }
}
