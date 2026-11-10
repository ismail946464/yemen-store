import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { getFirebaseAdmin } from "./api/_lib/firebaseAdmin.js";
import { processSendOtp, processVerifyOtp, getSenderConfig } from "./api/_lib/otpService.js";
import { requireAdminAuth } from "./api/_lib/authMiddleware.js";
import {
  processRegisterStoreAccount,
  processUpdateProfile,
  processLoginStoreAccount,
  processAdminListAccounts,
  processAdminUpdateAccount,
  processAdminDeleteAccount,
  processAdminCreateAccount
} from "./api/_lib/accountService.js";
import { processAssistantMessage, testGeminiConnection } from "./api/_lib/geminiAssistant.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parsing with error middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Global JSON syntax error handler to prevent HTML responses
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ success: false, message: "صيغة البيانات غير صحيحة (Invalid JSON)" });
    }
    next(err);
  });

  const { db } = getFirebaseAdmin();
  let cleanupMonths = 3;
  let autoCleanupEnabled = true;

  // Listen to configuration changes only if full service account credentials exist
  const hasServiceAccount = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 
    process.env.FIREBASE_PRIVATE_KEY || 
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );

  if (db && hasServiceAccount) {
    try {
      db.collection("settings").doc("global").onSnapshot((snap) => {
        if (snap.exists) {
          const data = snap.data();
          cleanupMonths = data?.cleanupMonths || 3;
          autoCleanupEnabled = data?.autoCleanupEnabled !== undefined ? data.autoCleanupEnabled : true;
          console.log(`Server settings updated: cleanupMonths=${cleanupMonths}, autoCleanupEnabled=${autoCleanupEnabled}`);
        }
      }, () => {
        // Silently catch listener errors
      });
    } catch {
      // Ignore
    }
  }

  // Safe server log helper
  const addLog = async (message: string, type: "info" | "error" | "success" = "info") => {
    if (!db || !hasServiceAccount) {
      console.log(`[Log] ${type.toUpperCase()}: ${message}`);
      return;
    }
    try {
      await db.collection("serverLogs").add({
        message,
        type,
        timestamp: new Date().toISOString()
      });
    } catch {
      console.log(`[Log] ${type.toUpperCase()}: ${message}`);
    }
  };

  // Background task: Delete products older than X months
  const cleanupOldProducts = async () => {
    if (!db || !hasServiceAccount) {
      return;
    }
    if (!autoCleanupEnabled) {
      return;
    }

    try {
      const productsRef = db.collection("products");
      const thresholdDate = new Date();
      thresholdDate.setMonth(thresholdDate.getMonth() - cleanupMonths);
      
      const q = productsRef.where("createdAt", "<", thresholdDate.toISOString());
      const querySnapshot = await q.get();
      
      let deletedCount = 0;
      const batch = db.batch();
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        await addLog(`تم حذف ${deletedCount} منتج قديم بنجاح.`, "success");
      }
    } catch (error: any) {
      console.error("Error during product cleanup:", error?.message);
    }
  };

  // Schedule cleanup periodically
  setInterval(cleanupOldProducts, 24 * 60 * 60 * 1000);

  // ==========================================
  // API ROUTES (ALWAYS RETURN JSON)
  // ==========================================

  // Direct Store Accounts System (Internal Accounts & Store-Issued Passwords)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, name, password, phone, photoURL, agreedToDisclaimer } = req.body || {};
      const result = await processRegisterStoreAccount({ email, name, password, phone, photoURL, agreedToDisclaimer });
      return res.status(result.success ? 200 : 400).json(result);
    } catch (err: any) {
      console.error("register route error:", err);
      return res.status(500).json({ success: false, message: "حدث خطأ غير متوقع أثناء إنشاء الحساب" });
    }
  });

  app.post("/api/auth/update-profile", async (req, res) => {
    try {
      const { email, name, phone, photoURL } = req.body || {};
      if (!email) {
        return res.status(400).json({ success: false, message: "البريد الإلكتروني مطلوب" });
      }
      const result = await processUpdateProfile({ email, name, phone, photoURL });
      return res.status(result.success ? 200 : 400).json(result);
    } catch (err: any) {
      console.error("update-profile error:", err);
      return res.status(500).json({ success: false, message: "حدث خطأ غير متوقع أثناء تحديث الملف الشخصي" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await processLoginStoreAccount({ email, password });
      return res.status(result.success ? 200 : 400).json(result);
    } catch (err: any) {
      console.error("login route error:", err);
      return res.status(500).json({ success: false, message: "حدث خطأ غير متوقع أثناء تسجيل الدخول" });
    }
  });

  // Admin Account Management
  app.get("/api/admin/accounts", async (req, res) => {
    const admin = await requireAdminAuth(req, res);
    if (!admin) return;
    try {
      const result = await processAdminListAccounts();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Internal error" });
    }
  });

  app.post("/api/admin/accounts", async (req, res) => {
    const admin = await requireAdminAuth(req, res);
    if (!admin) return;
    try {
      const { action, payload } = req.body || {};
      if (action === "create") {
        const result = await processAdminCreateAccount(payload || {});
        return res.status(result.success ? 200 : 400).json(result);
      }
      if (action === "update") {
        const result = await processAdminUpdateAccount(payload || {});
        return res.status(result.success ? 200 : 400).json(result);
      }
      if (action === "delete") {
        const target = payload?.email || payload?.id || (typeof payload === "string" ? payload : "");
        const targetId = payload?.id || "";
        const result = await processAdminDeleteAccount(target, targetId);
        return res.status(result.success ? 200 : 400).json(result);
      }
      return res.status(400).json({ success: false, message: "إجراء غير معروف" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Internal error" });
    }
  });

  // 1. Send OTP Endpoint
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ success: false, message: "يرجى إدخال بريد إلكتروني صالح" });
      }

      const result = await processSendOtp(email);
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
    } catch (error: any) {
      console.error("send-otp error:", error);
      return res.status(500).json({ success: false, message: "حدث خطأ غير متوقع أثناء إرسال رمز التحقق" });
    }
  });

  // 2. Verify OTP Endpoint
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, code } = req.body || {};
      if (!email || !code) {
        return res.status(400).json({ success: false, message: "يرجى تقديم البريد الإلكتروني ورمز التحقق" });
      }

      const result = await processVerifyOtp(email, code);
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
    } catch (error: any) {
      console.error("verify-otp error:", error);
      return res.status(500).json({ success: false, message: "حدث خطأ غير متوقع أثناء التحقق" });
    }
  });

  // 3. Sender & SMTP Configuration Info
  app.get("/api/auth/otp-settings", async (req, res) => {
    try {
      const config = await getSenderConfig();
      return res.json({
        senderEmail: config.senderEmail,
        senderName: config.senderName,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        hasSmtpPass: Boolean(config.smtpPass)
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Internal error" });
    }
  });

  // 4. Save Sender & SMTP Config (Admin only)
  app.post("/api/auth/save-smtp-settings", async (req, res) => {
    const admin = await requireAdminAuth(req, res);
    if (!admin) return;

    try {
      const { otpSenderEmail, otpSenderName, smtpHost, smtpPort, smtpUser, smtpPass } = req.body || {};
      if (!db || !hasServiceAccount) {
        return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة بحساب الخدمة" });
      }

      const updates: Record<string, any> = {};
      if (otpSenderEmail) updates.otpSenderEmail = String(otpSenderEmail).trim();
      if (otpSenderName) updates.otpSenderName = String(otpSenderName).trim();
      if (smtpHost) updates.smtpHost = String(smtpHost).trim();
      if (smtpPort) updates.smtpPort = Number(smtpPort);
      if (smtpUser) updates.smtpUser = String(smtpUser).trim();
      if (smtpPass !== undefined) updates.smtpPass = String(smtpPass);

      await db.collection("settings").doc("global").set(updates, { merge: true });
      await addLog(`تم تحديث إعدادات بريد الإرسال: ${otpSenderEmail || "yemenstore@gmail.com"} (${otpSenderName || "اليمن"})`, "success");

      return res.json({ success: true, message: "تم حفظ إعدادات البريد بنجاح" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Internal error" });
    }
  });

  // 5. Cleanup Old Products Trigger (Admin only)
  app.get("/api/admin/cleanup-products", async (req, res) => {
    const admin = await requireAdminAuth(req, res);
    if (!admin) return;

    try {
      await cleanupOldProducts();
      return res.json({ success: true, message: "تم تنفيذ عملية التنظيف" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // 6. Gemini Store AI Assistant
  app.post("/api/ai/assistant", async (req, res) => {
    try {
      const { message, history, catalogProducts, catalog, storeSettings } = req.body || {};

      let effectiveSettings = storeSettings || {};

      // If geminiApiKey not provided in request and db has settings/global, fetch from DB
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

      return res.json({ success: true, ...response });
    } catch (err: any) {
      console.error("AI Assistant route error:", err);
      return res.status(500).json({ 
        success: false, 
        reply: "عذراً، حدث خطأ مؤقت في التواصل مع المساعد الذكي. يرجى المحاولة لاحقاً.",
        products: [],
        provider: "error"
      });
    }
  });

  // 6.1 Test Gemini API Connection
  app.post("/api/ai/test-gemini", async (req, res) => {
    try {
      const { apiKey } = req.body || {};
      let keyToTest = apiKey;

      if (!keyToTest && db && hasServiceAccount) {
        try {
          const snap = await db.collection("settings").doc("global").get();
          if (snap.exists && snap.data()?.geminiApiKey) {
            keyToTest = snap.data()?.geminiApiKey;
          }
        } catch {}
      }

      const result = await testGeminiConnection(keyToTest);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Internal error" });
    }
  });

  // 7. Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Fallback 404 handler for unknown /api routes - ALWAYS RETURN JSON
  app.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, message: `المسار ${req.originalUrl} غير موجود` });
  });

  // Vite middleware for development (with HMR disabled per constraints) vs static dist for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`Port ${PORT} in use, exiting process so runner can restart cleanly.`);
      process.exit(1);
    } else {
      console.error("Server error:", err);
    }
  });
}

startServer();
