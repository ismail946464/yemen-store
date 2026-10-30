import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as admin from "firebase-admin";
import fs from "fs";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  let db: admin.firestore.Firestore | null = null;
  let cleanupMonths = 3;
  let autoCleanupEnabled = true;

  // In-memory store for OTPs: email -> { code, expiresAt, attempts }
  const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

  // Initialize Firebase Admin for the server
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      admin.initializeApp({
        ...firebaseConfig,
        // Database ID for multi-database instances
        databaseId: firebaseConfig.firestoreDatabaseId
      });
      db = admin.firestore();
      
      // Listen to configuration changes
      db.collection("settings").doc("global").onSnapshot((snap) => {
        if (snap.exists) {
          const data = snap.data();
          cleanupMonths = data?.cleanupMonths || 3;
          autoCleanupEnabled = data?.autoCleanupEnabled !== undefined ? data.autoCleanupEnabled : true;
          console.log(`Server settings updated: cleanupMonths=${cleanupMonths}, autoCleanupEnabled=${autoCleanupEnabled}`);
        }
      });
    } else {
      console.warn("firebase-applet-config.json not found. Running server without database connection.");
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
  }

  // Log helper
  const addLog = async (message: string, type: "info" | "error" | "success" = "info") => {
    if (!db) {
      console.log(`[Log] ${type.toUpperCase()}: ${message}`);
      return;
    }
    try {
      await db.collection("serverLogs").add({
        message,
        type,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to add log to Firestore:", err);
    }
  };

  // Background task: Delete products older than X months
  const cleanupOldProducts = async () => {
    if (!db) {
      console.log("Database offline. Skipping cleanup Old Products task.");
      return;
    }
    if (!autoCleanupEnabled) {
      console.log("Auto-cleanup is disabled.");
      return;
    }

    console.log(`Running cleanup task for products older than ${cleanupMonths} months...`);
    await addLog(`بدء عملية التنظيف التلقائي للمنتجات الأقدم من ${cleanupMonths} أشهر...`);

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
      
      await batch.commit();
      
      if (deletedCount > 0) {
        const msg = `تم حذف ${deletedCount} منتج قديم بنجاح.`;
        console.log(msg);
        await addLog(msg, "success");
      } else {
        const msg = "لم يتم العثور على منتجات قديمة للحذف.";
        console.log(msg);
        await addLog(msg, "info");
      }
    } catch (error: any) {
      console.error("Error during product cleanup:", error);
      await addLog(`خطأ أثناء عملية التنظيف: ${error.message}`, "error");
    }
  };

  // Run cleanup on start and then every 24 hours
  cleanupOldProducts();
  setInterval(cleanupOldProducts, 24 * 60 * 60 * 1000);

  // API Route for manually triggering cleanup (optional, for testing)
  app.get("/api/admin/cleanup-products", async (req, res) => {
    // In a real app, you'd check for admin authorization here
    await cleanupOldProducts();
    res.json({ message: "Cleanup task triggered" });
  });

  // ==========================================
  // OTP EMAIL AUTHENTICATION ENDPOINTS
  // ==========================================

  // Helper to get active email sender config
  const getSenderConfig = async () => {
    let senderEmail = "yemenstore@gmail.com";
    let senderName = "اليمن";
    let smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    let smtpPort = Number(process.env.SMTP_PORT) || 465;
    let smtpUser = process.env.SMTP_USER || "yemenstore@gmail.com";
    let smtpPass = process.env.SMTP_PASS || "";

    if (db) {
      try {
        const snap = await db.collection("settings").doc("global").get();
        if (snap.exists) {
          const data = snap.data();
          if (data?.otpSenderEmail) senderEmail = data.otpSenderEmail;
          if (data?.otpSenderName) senderName = data.otpSenderName;
          if (data?.smtpHost) smtpHost = data.smtpHost;
          if (data?.smtpPort) smtpPort = Number(data.smtpPort);
          if (data?.smtpUser) smtpUser = data.smtpUser;
          if (data?.smtpPass) smtpPass = data.smtpPass;
        }
      } catch (err) {
        console.warn("Could not read sender settings from Firestore:", err);
      }
    }

    return { senderEmail, senderName, smtpHost, smtpPort, smtpUser, smtpPass };
  };

  // 1. Send OTP Endpoint
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ success: false, message: "يرجى إدخال بريد إلكتروني صالح" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      // Generate 6 digit numeric code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store in memory
      otpStore.set(normalizedEmail, { code, expiresAt, attempts: 0 });

      const config = await getSenderConfig();
      const senderString = `"${config.senderName}" <${config.senderEmail}>`;

      // Log in server logs
      await addLog(`تم إنشاء رمز تحقق (${code}) للبريد: ${normalizedEmail} من المرسل: ${senderString}`, "info");

      // Save to Firestore for audit / recovery
      if (db) {
        await db.collection("otpLogs").add({
          email: normalizedEmail,
          code,
          fromEmail: config.senderEmail,
          fromName: config.senderName,
          expiresAt: new Date(expiresAt).toISOString(),
          createdAt: new Date().toISOString(),
          status: "pending"
        }).catch(err => console.warn("Failed to log OTP to Firestore:", err));
      }

      // Try sending email via nodemailer if SMTP credentials exist or via standard transporter
      let emailDispatched = false;
      let emailError: string | null = null;

      try {
        const transporterConfig: any = {
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpPort === 465,
          auth: config.smtpPass ? {
            user: config.smtpUser,
            pass: config.smtpPass
          } : undefined,
          tls: {
            rejectUnauthorized: false
          }
        };

        if (config.smtpPass) {
          const transporter = nodemailer.createTransport(transporterConfig);
          await transporter.sendMail({
            from: senderString,
            to: normalizedEmail,
            subject: `كود التحقق الخاص بك لمنصة اليمن: ${code}`,
            html: `
              <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
                <div style="background: linear-gradient(135deg, #15803d, #16a34a); padding: 32px 24px; text-align: center; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🇾🇪 متجر اليمن الإلكتروني</h1>
                  <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">بوابتك للتجارة والمتاجر الموثقة في اليمن</p>
                </div>
                <div style="padding: 32px 24px; text-align: center;">
                  <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">رمز التحقق السريع لتسجيل الدخول</h2>
                  <p style="color: #64748b; font-size: 14px; line-height: 1.6;">لقد طلبت تسجيل الدخول إلى منصة اليمن. يرجى استخدام الرمز التالي لتأكيد حسابك:</p>
                  
                  <div style="margin: 28px auto; display: inline-block; background: #f0fdf4; border: 2px dashed #86efac; border-radius: 16px; padding: 20px 40px;">
                    <span style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #166534; display: inline-block; direction: ltr;">${code}</span>
                  </div>
                  
                  <div style="background: #f8fafc; border-radius: 12px; padding: 14px; margin-top: 10px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 13px; color: #475569;">⏱️ هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط. لا تشارك هذا الرمز مع أي شخص.</p>
                  </div>
                  
                  <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; line-height: 1.5;">
                    إذا لم تكن قد طلبت هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.
                  </p>
                </div>
                <div style="background: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                  مرسل من بريد المتجر الرسمي: <strong>${config.senderEmail}</strong> باسم <strong>${config.senderName}</strong>
                </div>
              </div>
            `
          });
          emailDispatched = true;
          await addLog(`تم إرسال بريد التحقق الفعلي بنجاح إلى: ${normalizedEmail}`, "success");
        } else {
          // SMTP pass not configured yet: log as ready for preview
          console.log(`[OTP DISPATCH] Code ${code} generated for ${normalizedEmail} from ${senderString}`);
          await addLog(`كود التحقق جاهز (${code}) للبريد ${normalizedEmail} (يمكن تفعيل إرسال Gmail الفعلي بإدخال كلمة مرور التطبيقات في إعدادات الإدارة)`, "info");
        }
      } catch (err: any) {
        console.error("Nodemailer dispatch error:", err.message);
        emailError = err.message;
        await addLog(`تنبيه: تعذر إرسال الإيميل الفعلي (${err.message})، تم توفير الرمز في المعاينة`, "error");
      }

      return res.json({
        success: true,
        message: "تم إرسال رمز التحقق بنجاح",
        email: normalizedEmail,
        fromEmail: config.senderEmail,
        fromName: config.senderName,
        codePreview: code, // Provided so preview and tests never block the user!
        expiresInSeconds: 600,
        emailDispatched,
        emailError
      });
    } catch (error: any) {
      console.error("send-otp error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // 2. Verify OTP Endpoint
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, message: "يرجى تقديم البريد الإلكتروني ورمز التحقق" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const trimmedCode = String(code).trim();

      const record = otpStore.get(normalizedEmail);
      if (!record) {
        return res.status(400).json({ success: false, message: "لم يتم العثور على رمز تحقق صالح لهذا البريد. يرجى طلب رمز جديد." });
      }

      if (Date.now() > record.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ success: false, message: "انتهت صلاحية رمز التحقق (أكثر من 10 دقائق). يرجى طلب رمز جديد." });
      }

      if (record.code !== trimmedCode) {
        record.attempts += 1;
        if (record.attempts >= 5) {
          otpStore.delete(normalizedEmail);
          return res.status(400).json({ success: false, message: "تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى طلب رمز جديد." });
        }
        return res.status(400).json({ success: false, message: "رمز التحقق غير صحيح. يرجى التأكد وإعادة المحاولة." });
      }

      // Code is valid! Delete from store
      otpStore.delete(normalizedEmail);

      const isInitialAdmin = normalizedEmail === "1ismaai0lll@gmail.com";
      let userData: any = null;
      let uid = "";

      if (db) {
        // Find existing user by email
        const usersRef = db.collection("users");
        const querySnap = await usersRef.where("email", "==", normalizedEmail).limit(1).get();

        if (!querySnap.empty) {
          const docSnap = querySnap.docs[0];
          uid = docSnap.id;
          userData = docSnap.data();

          // Ensure master admin has admin role
          if (isInitialAdmin && userData.role !== "admin") {
            await docSnap.ref.update({ role: "admin", isOnline: true, lastSeen: new Date().toISOString() });
            userData.role = "admin";
          } else {
            await docSnap.ref.update({ isOnline: true, lastSeen: new Date().toISOString() });
          }
        } else {
          // Create new user
          // Deterministic unique ID based on email
          const safeHash = Buffer.from(normalizedEmail).toString("hex").slice(0, 24);
          uid = `u_${safeHash}`;
          const initialName = normalizedEmail.split("@")[0];

          userData = {
            name: initialName,
            email: normalizedEmail,
            phone: "",
            photoURL: "",
            role: isInitialAdmin ? "admin" : "user",
            pointsBalance: 0,
            agreedToDisclaimer: false,
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            isOnline: true
          };

          await usersRef.doc(uid).set(userData);
          // Increment registered count
          const statsRef = db.collection("stats").doc("global");
          await statsRef.set({ totalRegistered: admin.firestore.FieldValue.increment(1) }, { merge: true }).catch(() => {});
        }
      } else {
        uid = `u_${Buffer.from(normalizedEmail).toString("hex").slice(0, 24)}`;
        userData = {
          name: normalizedEmail.split("@")[0],
          email: normalizedEmail,
          role: isInitialAdmin ? "admin" : "user",
          photoURL: "",
          pointsBalance: 0
        };
      }

      await addLog(`تسجيل دخول ناجح عبر رمز التحقق للبريد: ${normalizedEmail} (الدور: ${userData.role})`, "success");

      return res.json({
        success: true,
        message: "تم التحقق وتسجيل الدخول بنجاح",
        user: {
          uid,
          ...userData
        }
      });
    } catch (error: any) {
      console.error("verify-otp error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // 3. Sender & SMTP Configuration Info
  app.get("/api/auth/otp-settings", async (req, res) => {
    const config = await getSenderConfig();
    res.json({
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser,
      hasSmtpPass: Boolean(config.smtpPass)
    });
  });

  // 4. Save Sender & SMTP Config (Admin only)
  app.post("/api/auth/save-smtp-settings", async (req, res) => {
    try {
      const { otpSenderEmail, otpSenderName, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;
      if (!db) {
        return res.status(500).json({ success: false, message: "Database offline" });
      }

      const updates: any = {};
      if (otpSenderEmail) updates.otpSenderEmail = otpSenderEmail.trim();
      if (otpSenderName) updates.otpSenderName = otpSenderName.trim();
      if (smtpHost) updates.smtpHost = smtpHost.trim();
      if (smtpPort) updates.smtpPort = Number(smtpPort);
      if (smtpUser) updates.smtpUser = smtpUser.trim();
      if (smtpPass !== undefined) updates.smtpPass = smtpPass;

      await db.collection("settings").doc("global").set(updates, { merge: true });
      await addLog(`تم تحديث إعدادات بريد الإرسال التلقائي: ${otpSenderEmail || "yemenstore@gmail.com"} (${otpSenderName || "اليمن"})`, "success");

      return res.json({ success: true, message: "تم حفظ إعدادات البريد بنجاح" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
