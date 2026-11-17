import { testGeminiConnection } from "../_lib/geminiAssistant.js";
import { requireAdminAuth } from "../_lib/authMiddleware.js";
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

  const admin = await requireAdminAuth(req, res);
  if (!admin) return;

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { apiKey } = body || {};
    let keyToTest = apiKey;

    const { db } = getFirebaseAdmin();
    const hasServiceAccount = Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_PRIVATE_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );

    if (!keyToTest && db && hasServiceAccount) {
      try {
        const snap = await db.collection("settings").doc("global").get();
        if (snap.exists && snap.data()?.geminiApiKey) {
          keyToTest = snap.data()?.geminiApiKey;
        }
      } catch {
        // ignore
      }
    }

    const result = await testGeminiConnection(keyToTest);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error" });
  }
}
