import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getFirebaseAdmin } from "./firebaseAdmin.js";
import { getAccountByEmail } from "./accountStorage.js";

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
  let verifiedEmail = "";
  let verifiedUid = "";
  let tokenRole: string | undefined;

  try {
    const { app } = getFirebaseAdmin();
    if (app) {
      const adminAuth = (await import("firebase-admin/auth")).getAuth(app);
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded && decoded.email) {
        verifiedEmail = decoded.email.toLowerCase();
        verifiedUid = decoded.uid;
        tokenRole = decoded.role;
      }
    }
  } catch {
    // Fall through to Identity Toolkit REST verification
  }

  // Fallback REST verification using Firebase Web API key if Admin SDK failed
  if (!verifiedEmail) {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (cfg?.apiKey) {
          const restRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: token })
            }
          );
          if (restRes.ok) {
            const restJson: any = await restRes.json();
            const userRec = restJson?.users?.[0];
            if (userRec?.email) {
              verifiedEmail = String(userRec.email).toLowerCase();
              verifiedUid = String(userRec.localId || "");
            }
          }
        }
      }
    } catch {
      // REST lookup failed
    }
  }

  if (verifiedEmail) {
    const isMaster = verifiedEmail === "1ismaai0lll@gmail.com";
    let resolvedRole = isMaster ? "admin" : (tokenRole || "user");
    if (!isMaster) {
      try {
        const stored = await getAccountByEmail(verifiedEmail);
        if (stored?.role) {
          resolvedRole = stored.role;
        }
      } catch {
        // ignore lookup failure
      }
    }
    return {
      uid: verifiedUid,
      email: verifiedEmail,
      role: resolvedRole,
      isMasterAdmin: isMaster
    };
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
