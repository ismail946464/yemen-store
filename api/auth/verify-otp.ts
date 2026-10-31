import { processVerifyOtp } from "../_lib/otpService";

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
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

    const { email, code } = body || {};
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "يرجى تقديم البريد الإلكتروني ورمز التحقق"
      });
    }

    const result = await processVerifyOtp(email, code);
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (error: any) {
    console.error("verify-otp serverless error:", error);
    return res.status(500).json({
      success: false,
      message: "حدث خطأ غير متوقع أثناء التحقق من الرمز"
    });
  }
}
