import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { getFirebaseAdmin } from "./api/_lib/firebaseAdmin";
import { processSendOtp, processVerifyOtp, getSenderConfig } from "./api/_lib/otpService";
import { requireAdminAuth } from "./api/_lib/authMiddleware";

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

  // 6. Health check
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
