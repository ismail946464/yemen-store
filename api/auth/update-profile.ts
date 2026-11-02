import { processUpdateProfile } from "../_lib/accountService.js";

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

    const { email, name, phone, photoURL } = body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: "البريد الإلكتروني مطلوب" });
    }

    const result = await processUpdateProfile({ email, name, phone, photoURL });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error("update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "حدث خطأ غير متوقع أثناء تحديث الملف الشخصي"
    });
  }
}
