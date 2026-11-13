import { processChangePassword } from "../_lib/accountService.js";
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
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const caller = await verifyAuthToken(authHeader);
    if (!caller) {
      return res.status(401).json({
        success: false,
        message: "غير مصرح: يرجى تسجيل الدخول أولاً لتغيير كلمة المرور"
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

    const { email, newPassword, currentPassword } = body || {};
    const targetEmail = (email || caller.email || "").trim();
    if (!targetEmail || !newPassword) {
      return res.status(400).json({ success: false, message: "البريد الإلكتروني وكلمة المرور الجديدة مطلوبان" });
    }

    const result = await processChangePassword({
      email: targetEmail,
      newPassword,
      currentPassword,
      caller
    });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error("change-password error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "حدث خطأ غير متوقع أثناء تغيير كلمة المرور"
    });
  }
}
