import crypto from "crypto";
import { getFirebaseAdmin } from "./firebaseAdmin.js";

declare global {
  // eslint-disable-next-line no-var
  var __ephemeralSessionSecret: string | undefined;
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  // Avoid any hardcoded static secrets in source code by generating a runtime-secure secret if not set in env
  if (!globalThis.__ephemeralSessionSecret) {
    globalThis.__ephemeralSessionSecret = crypto.randomBytes(32).toString("hex");
  }
  return globalThis.__ephemeralSessionSecret;
}

export interface AuthUser {
  uid: string;
  email: string;
  role: string;
  isMasterAdmin?: boolean;
}

/**
 * Creates a cryptographically signed session token for OTP-authenticated users.
 */
export function createSignedSessionToken(user: { uid: string; email: string; role: string }): string {
  const payload = {
    uid: user.uid,
    email: user.email.toLowerCase().trim(),
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies an incoming Authorization header (Bearer token).
 * Supports both HMAC signed session tokens and Firebase ID tokens.
 */
export async function verifyAuthToken(authHeader?: string): Promise<AuthUser | null> {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  const token = parts[1];

  // 1. Try HMAC signed session token (exactly 2 parts: payloadBase64.signature)
  const tokenParts = token.split(".");
  if (tokenParts.length === 2) {
    const [payloadBase64, providedSig] = tokenParts;
    try {
      const expectedSig = crypto
        .createHmac("sha256", getSessionSecret())
        .update(payloadBase64)
        .digest("base64url");

      const bufProvided = Buffer.from(providedSig);
      const bufExpected = Buffer.from(expectedSig);

      if (bufProvided.length === bufExpected.length && crypto.timingSafeEqual(bufProvided, bufExpected)) {
        const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp > now && payload.email) {
          const isMaster = payload.email.toLowerCase() === "1ismaai0lll@gmail.com";
          return {
            uid: payload.uid,
            email: payload.email,
            role: isMaster ? "admin" : (payload.role || "user"),
            isMasterAdmin: isMaster
          };
        }
      }
    } catch {
      // Signature or JSON parsing failed
    }
  }

  // 2. Try Firebase ID Token verification (from Google Popup Sign-in)
  try {
    const { app } = getFirebaseAdmin();
    if (app) {
      const adminAuth = (await import("firebase-admin/auth")).getAuth(app);
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded && decoded.email) {
        const email = decoded.email.toLowerCase();
        const isMaster = email === "1ismaai0lll@gmail.com";
        return {
          uid: decoded.uid,
          email,
          role: isMaster ? "admin" : (decoded.role || "user"),
          isMasterAdmin: isMaster
        };
      }
    }
  } catch {
    // ID Token verification failed or not a Firebase ID Token
  }

  return null;
}

/**
 * Middleware helper to ensure caller is an admin.
 * Returns the AuthUser if valid, otherwise sends 401/403 and returns null.
 */
export async function requireAdminAuth(req: any, res: any): Promise<AuthUser | null> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const user = await verifyAuthToken(authHeader);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "غير مصرح: يرجى تسجيل الدخول بحساب مسؤول للوصول إلى هذا الإجراء."
    });
    return null;
  }

  if (user.role !== "admin" && !user.isMasterAdmin) {
    res.status(403).json({
      success: false,
      message: "مرفوض: ليس لديك صلاحيات المسؤول لتنفيذ هذه العملية."
    });
    return null;
  }

  return user;
}
