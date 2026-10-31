import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getFirebaseAdmin } from "./firebaseAdmin";

export interface StoredOtpData {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastRequestedAt: number;
  createdAt: string;
}

// In-memory cache for ultra-fast access & fallback
const memoryOtpStore = new Map<string, StoredOtpData>();

interface AppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

let cachedConfig: AppletConfig | null = null;

function getAppletConfig(): AppletConfig | null {
  if (cachedConfig) return cachedConfig;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      cachedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return cachedConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

export function hasServiceAccount(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

export function getOtpDocId(email: string): string {
  return crypto
    .createHash("sha256")
    .update(`otp_key_${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

function getRestDocUrl(docId: string): string | null {
  const cfg = getAppletConfig();
  if (!cfg?.apiKey || !cfg?.projectId) return null;
  const dbId = cfg.firestoreDatabaseId || "(default)";
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/_otps/${docId}?key=${cfg.apiKey}`;
}

export async function fetchOtpRecord(email: string): Promise<StoredOtpData | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const docId = getOtpDocId(normalizedEmail);

  // 1. Check in-memory cache first
  const cached = memoryOtpStore.get(normalizedEmail);
  if (cached && Date.now() < cached.expiresAt) {
    return cached;
  }

  // 2. If service account is available, use Admin SDK
  if (hasServiceAccount()) {
    const { db } = getFirebaseAdmin();
    if (db) {
      try {
        const snap = await db.collection("_otps").doc(docId).get();
        if (snap.exists) {
          const data = snap.data() as StoredOtpData;
          memoryOtpStore.set(normalizedEmail, data);
          return data;
        }
      } catch (err: any) {
        console.warn("Firestore Admin read warning:", err?.message);
      }
    }
  }

  // 3. Use REST API with apiKey
  const url = getRestDocUrl(docId);
  if (url) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        const json = await res.json();
        const fields = json?.fields;
        if (fields) {
          const record: StoredOtpData = {
            email: fields.email?.stringValue || normalizedEmail,
            codeHash: fields.codeHash?.stringValue || "",
            expiresAt: Number(fields.expiresAt?.integerValue || 0),
            attempts: Number(fields.attempts?.integerValue || 0),
            lastRequestedAt: Number(fields.lastRequestedAt?.integerValue || 0),
            createdAt: fields.createdAt?.stringValue || new Date().toISOString()
          };
          memoryOtpStore.set(normalizedEmail, record);
          return record;
        }
      }
    } catch {
      // ignore REST read error, fallback to memory
    }
  }

  return memoryOtpStore.get(normalizedEmail) || null;
}

export async function saveOtpRecord(record: StoredOtpData): Promise<void> {
  const normalizedEmail = record.email.trim().toLowerCase();
  const docId = getOtpDocId(normalizedEmail);

  // Always update memory store
  memoryOtpStore.set(normalizedEmail, record);

  // If service account is available, use Admin SDK
  if (hasServiceAccount()) {
    const { db } = getFirebaseAdmin();
    if (db) {
      try {
        await db.collection("_otps").doc(docId).set(record);
        return;
      } catch (err: any) {
        console.warn("Admin SDK store warning:", err?.message);
      }
    }
  }

  // Fallback to REST API with apiKey
  const url = getRestDocUrl(docId);
  if (url) {
    try {
      await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            email: { stringValue: record.email },
            codeHash: { stringValue: record.codeHash },
            expiresAt: { integerValue: String(record.expiresAt) },
            attempts: { integerValue: String(record.attempts) },
            lastRequestedAt: { integerValue: String(record.lastRequestedAt) },
            createdAt: { stringValue: record.createdAt }
          }
        })
      });
    } catch {
      // Ignore network errors; memory store guarantees persistence within the process
    }
  }
}

export async function updateOtpAttempts(email: string, attempts: number): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const docId = getOtpDocId(normalizedEmail);

  const existing = memoryOtpStore.get(normalizedEmail);
  if (existing) {
    existing.attempts = attempts;
  }

  if (hasServiceAccount()) {
    const { db } = getFirebaseAdmin();
    if (db) {
      try {
        await db.collection("_otps").doc(docId).update({ attempts });
        return;
      } catch {
        // ignore
      }
    }
  }

  const url = getRestDocUrl(docId);
  if (url && existing) {
    try {
      await fetch(`${url}&updateMask.fieldPaths=attempts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            attempts: { integerValue: String(attempts) }
          }
        })
      });
    } catch {
      // ignore
    }
  }
}

export async function deleteOtpRecord(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const docId = getOtpDocId(normalizedEmail);

  memoryOtpStore.delete(normalizedEmail);

  if (hasServiceAccount()) {
    const { db } = getFirebaseAdmin();
    if (db) {
      try {
        await db.collection("_otps").doc(docId).delete();
        return;
      } catch {
        // ignore
      }
    }
  }

  const url = getRestDocUrl(docId);
  if (url) {
    try {
      await fetch(url, { method: "DELETE" });
    } catch {
      // ignore
    }
  }
}
