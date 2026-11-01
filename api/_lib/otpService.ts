import crypto from "crypto";
import nodemailer from "nodemailer";
import { getFirebaseAdmin } from "./firebaseAdmin.js";
import { createSignedSessionToken } from "./authMiddleware.js";
import {
  fetchOtpRecord,
  saveOtpRecord,
  updateOtpAttempts,
  deleteOtpRecord,
  hasServiceAccount
} from "./otpStorage.js";

export interface SenderConfig {
  senderEmail: string;
  senderName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

export function generateSecureCode(): string {
  // 6-digit cryptographically secure random number
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(code: string, email: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest("hex");
}

export async function getSenderConfig(): Promise<SenderConfig> {
  const { db } = getFirebaseAdmin();
  let senderEmail = process.env.OTP_SENDER_EMAIL || process.env.SMTP_USER || "yemenstore@gmail.com";
  let senderName = process.env.OTP_SENDER_NAME || "اليمن";
  let smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  let smtpPort = Number(process.env.SMTP_PORT) || 465;
  let smtpUser = process.env.SMTP_USER || senderEmail;
  let smtpPass = process.env.SMTP_PASS || "";

  if (db && hasServiceAccount()) {
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
    } catch {
      // Fallback to environment variables
    }
  }

  return { senderEmail, senderName, smtpHost, smtpPort, smtpUser, smtpPass };
}

export async function processSendOtp(email: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();

  // 1. Rate Limiting Check: minimum 60 seconds between OTP requests per email
  const existingRecord = await fetchOtpRecord(normalizedEmail);
  if (existingRecord?.lastRequestedAt && now - existingRecord.lastRequestedAt < 60000) {
    const remainingSecs = Math.ceil((60000 - (now - existingRecord.lastRequestedAt)) / 1000);
    return {
      success: false,
      message: `يرجى الانتظار ${remainingSecs} ثانية قبل طلب رمز تحقق جديد.`
    };
  }

  // 2. Generate secure code and SHA-256 hash
  const code = generateSecureCode();
  const codeHash = hashOtp(code, normalizedEmail);
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  // 3. Store hashed OTP safely across serverless / dev environments
  await saveOtpRecord({
    email: normalizedEmail,
    codeHash,
    expiresAt,
    attempts: 0,
    lastRequestedAt: now,
    createdAt: new Date(now).toISOString()
  });

  // 4. Dispatch Email via SMTP
  const config = await getSenderConfig();
  const senderString = `"${config.senderName}" <${config.senderEmail}>`;

  if (config.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

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
          </div>
        `
      });
    } catch (err: any) {
      console.warn("SMTP email dispatch warning:", err?.message);
    }
  }

  // NOTE: Strict privacy & security: Never return codePreview in response, never expose code in public logs
  return {
    success: true,
    message: "تم إرسال رمز التحقق بنجاح إلى بريدك الإلكتروني"
  };
}

export async function processVerifyOtp(
  email: string,
  code: string
): Promise<{ success: boolean; message: string; user?: any; sessionToken?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = String(code).trim();
  const now = Date.now();

  const record = await fetchOtpRecord(normalizedEmail);

  if (!record || !record.codeHash) {
    return {
      success: false,
      message: "لم يتم العثور على رمز تحقق صالح لهذا البريد. يرجى طلب رمز جديد."
    };
  }

  // Expiration check (10 minutes)
  if (now > record.expiresAt) {
    await deleteOtpRecord(normalizedEmail);
    return {
      success: false,
      message: "انتهت صلاحية رمز التحقق (أكثر من 10 دقائق). يرجى طلب رمز جديد."
    };
  }

  // Maximum attempts check (5 attempts)
  if (record.attempts >= 5) {
    await deleteOtpRecord(normalizedEmail);
    return {
      success: false,
      message: "تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى طلب رمز جديد."
    };
  }

  // Compare SHA-256 hash
  const incomingHash = hashOtp(trimmedCode, normalizedEmail);
  if (incomingHash !== record.codeHash) {
    const newAttempts = record.attempts + 1;
    await updateOtpAttempts(normalizedEmail, newAttempts);

    return {
      success: false,
      message: `رمز التحقق غير صحيح. متبقي ${5 - newAttempts} محاولات.`
    };
  }

  // Verification successful! Delete OTP record immediately
  await deleteOtpRecord(normalizedEmail);

  // Authenticate user profile
  const isMasterAdmin = normalizedEmail === "1ismaai0lll@gmail.com";
  const safeHash = crypto.createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 24);
  const uid = `u_${safeHash}`;
  const initialName = normalizedEmail.split("@")[0] || "مستخدم";

  let userData = {
    name: initialName,
    email: normalizedEmail,
    phone: "",
    photoURL: "",
    role: isMasterAdmin ? "admin" : "user",
    pointsBalance: 0,
    agreedToDisclaimer: false,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    isOnline: true
  };

  const { db } = getFirebaseAdmin();
  if (hasServiceAccount() && db) {
    try {
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const existingData = userSnap.data();
        if (isMasterAdmin && existingData?.role !== "admin") {
          await userRef.update({ role: "admin", isOnline: true, lastSeen: new Date().toISOString() });
          userData.role = "admin";
        } else {
          await userRef.update({ isOnline: true, lastSeen: new Date().toISOString() });
          userData = { ...userData, ...existingData };
        }
      } else {
        await userRef.set(userData);
      }
    } catch {
      // Handled gracefully
    }
  }

  const sessionToken = createSignedSessionToken({
    uid,
    email: normalizedEmail,
    role: userData.role
  });

  return {
    success: true,
    message: "تم التحقق وتسجيل الدخول بنجاح",
    sessionToken,
    user: {
      uid,
      ...userData
    }
  };
}
