import { processUpdateProfile } from "../_lib/accountService.js";
import { verifyAuthToken } from "../_lib/authMiddleware.js";

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
    const rawHeader = req.headers?.authorization || req.headers?.Authorization;
    const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const caller = await verifyAuthToken(authHeader);
    if (!caller) {
      return res.status(401).json({
        success: false,
        message: "غير مصرح: يرجى تسجيل الدخول أولاً لتحديث الملف الشخصي"
      });
    }

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { email, name, phone, photoURL } = body || {};
    const targetEmail = String(email || caller.email || "").trim().toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({ success: false, message: "البريد الإلكتروني مطلوب" });
    }

    const callerEmail = (caller.email || "").trim().toLowerCase();
    const isCallerAdmin = caller.role === "admin" || Boolean(caller.isMasterAdmin);
    if (callerEmail !== targetEmail && !isCallerAdmin) {
      return res.status(403).json({
        success: false,
        message: "مرفوض: لا يمكنك تعديل بيانات حساب آخر"
      });
    }

    const result = await processUpdateProfile({ email: targetEmail, name, phone, photoURL });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error("update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "حدث خطأ غير متوقع أثناء تحديث الملف الشخصي"
    });
  }
}
