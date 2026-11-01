import { getSenderConfig } from "../_lib/otpService.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const config = await getSenderConfig();
    return res.status(200).json({
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser,
      hasSmtpPass: Boolean(config.smtpPass)
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || "Internal server error" });
  }
}
