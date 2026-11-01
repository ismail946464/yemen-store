import { getFirebaseAdmin } from "../_lib/firebaseAdmin.js";
import { requireAdminAuth } from "../_lib/authMiddleware.js";

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

  // Enforce server-side Admin authorization
  const admin = await requireAdminAuth(req, res);
  if (!admin) {
    return;
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

    const { otpSenderEmail, otpSenderName, smtpHost, smtpPort, smtpUser, smtpPass } = body || {};
    const { db } = getFirebaseAdmin();
    if (!db) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة" });
    }

    const updates: Record<string, any> = {};
    if (otpSenderEmail) updates.otpSenderEmail = String(otpSenderEmail).trim();
    if (otpSenderName) updates.otpSenderName = String(otpSenderName).trim();
    if (smtpHost) updates.smtpHost = String(smtpHost).trim();
    if (smtpPort) updates.smtpPort = Number(smtpPort);
    if (smtpUser) updates.smtpUser = String(smtpUser).trim();
    if (smtpPass !== undefined) updates.smtpPass = String(smtpPass);

    await db.collection("settings").doc("global").set(updates, { merge: true });

    return res.status(200).json({ success: true, message: "تم حفظ إعدادات البريد بنجاح" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || "Internal server error" });
  }
}
