import { requireAdminAuth } from "../_lib/authMiddleware.js";
import {
  processAdminListAccounts,
  processAdminUpdateAccount,
  processAdminDeleteAccount,
  processAdminCreateAccount
} from "../_lib/accountService.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Enforce server-side Admin authorization
  const admin = await requireAdminAuth(req, res);
  if (!admin) {
    return;
  }

  try {
    if (req.method === "GET") {
      const result = await processAdminListAccounts();
      return res.status(200).json(result);
    }

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { action, payload } = body || {};

    if (action === "create") {
      const result = await processAdminCreateAccount(payload || {});
      return res.status(result.success ? 200 : 400).json(result);
    }

    if (action === "update") {
      const result = await processAdminUpdateAccount(payload || {});
      return res.status(result.success ? 200 : 400).json(result);
    }

    if (action === "delete") {
      const { email } = payload || {};
      const result = await processAdminDeleteAccount(email);
      return res.status(result.success ? 200 : 400).json(result);
    }

    return res.status(400).json({ success: false, message: "إجراء غير معروف" });
  } catch (error: any) {
    console.error("admin accounts error:", error);
    return res.status(500).json({ success: false, message: error?.message || "Internal server error" });
  }
}
