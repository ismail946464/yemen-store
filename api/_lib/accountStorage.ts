import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getFirebaseAdmin } from "./firebaseAdmin.js";

export interface StoreAccount {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  password: string;
  passwordHash?: string;
  role: "admin" | "store" | "user";
  status: "active" | "suspended";
  pointsBalance: number;
  agreedToDisclaimer: boolean;
  createdAt: string;
  lastLoginAt: string;
}

// In-memory cache for instant lookups & dev resilience
const memoryAccountsStore = new Map<string, StoreAccount>();

// Auto-seed master admin account
const MASTER_ADMIN_EMAIL = "1ismaai0lll@gmail.com";
const MASTER_ADMIN_DEFAULT_PASS = "Admin@Yemen2026";

export function getAccountDocId(email: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
  return `acc_${hash}`;
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password.trim()).digest("hex");
}

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

function getRestDocUrl(docId: string): string | null {
  const cfg = getAppletConfig();
  if (!cfg?.apiKey || !cfg?.projectId) return null;
  const dbId = cfg.firestoreDatabaseId || "(default)";
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/storeAccounts/${docId}?key=${cfg.apiKey}`;
}

function getRestCollectionUrl(): string | null {
  const cfg = getAppletConfig();
  if (!cfg?.apiKey || !cfg?.projectId) return null;
  const dbId = cfg.firestoreDatabaseId || "(default)";
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/storeAccounts?key=${cfg.apiKey}`;
}

// Ensure master admin is pre-populated
export function seedMasterAdmin(): StoreAccount {
  const adminDocId = getAccountDocId(MASTER_ADMIN_EMAIL);
  const existing = memoryAccountsStore.get(MASTER_ADMIN_EMAIL);
  if (existing) return existing;

  const adminAccount: StoreAccount = {
    uid: `u_${adminDocId.slice(4)}`,
    email: MASTER_ADMIN_EMAIL,
    name: "المدير العام للمتجر",
    phone: "777000000",
    password: MASTER_ADMIN_DEFAULT_PASS,
    passwordHash: hashPassword(MASTER_ADMIN_DEFAULT_PASS),
    role: "admin",
    status: "active",
    pointsBalance: 10000,
    agreedToDisclaimer: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: new Date().toISOString()
  };
  memoryAccountsStore.set(MASTER_ADMIN_EMAIL, adminAccount);
  return adminAccount;
}

// Initialize seed
seedMasterAdmin();

export async function getAccountByEmail(email: string): Promise<StoreAccount | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const docId = getAccountDocId(normalizedEmail);

  // 1. In-memory check
  if (memoryAccountsStore.has(normalizedEmail)) {
    return memoryAccountsStore.get(normalizedEmail)!;
  }

  // If master admin, guarantee existence
  if (normalizedEmail === MASTER_ADMIN_EMAIL) {
    return seedMasterAdmin();
  }

  // 2. Admin SDK check
  if (hasServiceAccount()) {
    const { db } = getFirebaseAdmin();
    if (db) {
      try {
        const snap = await db.collection("storeAccounts").doc(docId).get();
        if (snap.exists) {
          const acc = snap.data() as StoreAccount;
          memoryAccountsStore.set(normalizedEmail, acc);
          return acc;
        }
      } catch (err: any) {
        console.warn("Firestore Admin account get notice:", err?.message);
      }
    }
  }

  // 3. REST API check
  const url = getRestDocUrl(docId);
  if (url) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        const json = await res.json();
        const f = json?.fields;
        if (f) {
          const acc: StoreAccount = {
            uid: f.uid?.stringValue || `u_${docId.slice(4)}`,
            email: f.email?.stringValue || normalizedEmail,
            name: f.name?.stringValue || "مستخدم",
            phone: f.phone?.stringValue || "",
            password: f.password?.stringValue || "",
            passwordHash: f.passwordHash?.stringValue || "",
            role: (f.role?.stringValue as any) || "user",
            status: (f.status?.stringValue as any) || "active",
            pointsBalance: Number(f.pointsBalance?.integerValue || 0),
            agreedToDisclaimer: Boolean(f.agreedToDisclaimer?.booleanValue),
            createdAt: f.createdAt?.stringValue || new Date().toISOString(),
            lastLoginAt: f.lastLoginAt?.stringValue || new Date().toISOString()
          };
          memoryAccountsStore.set(normalizedEmail, acc);
          return acc;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function saveAccount(account: StoreAccount): Promise<boolean> {
  const normalizedEmail = account.email.trim().toLowerCase();
  const docId = getAccountDocId(normalizedEmail);

  // Update in memory
  memoryAccountsStore.set(normalizedEmail, account);

  // 1. Admin SDK
  if (hasServiceAccount()) {
    const { db } = getFirebaseAdmin();
    if (db) {
      try {
        await db.collection("storeAccounts").doc(docId).set(account, { merge: true });
        // Sync to users collection so existing app queries keep working
        await db.collection("users").doc(account.uid).set({
          name: account.name,
          email: account.email,
          phone: account.phone || "",
          role: account.role,
          pointsBalance: account.pointsBalance,
          agreedToDisclaimer: account.agreedToDisclaimer,
          createdAt: account.createdAt,
          lastSeen: account.lastLoginAt,
          isOnline: true
        }, { merge: true });
        return true;
      } catch (err: any) {
        console.warn("Failed saving account via Admin SDK:", err?.message);
      }
    }
  }

  // 2. REST API
  const url = getRestDocUrl(docId);
  if (url) {
    try {
      const fields: Record<string, any> = {
        uid: { stringValue: account.uid },
        email: { stringValue: account.email },
        name: { stringValue: account.name },
        phone: { stringValue: account.phone || "" },
        password: { stringValue: account.password },
        passwordHash: { stringValue: account.passwordHash || hashPassword(account.password) },
        role: { stringValue: account.role },
        status: { stringValue: account.status },
        pointsBalance: { integerValue: String(account.pointsBalance || 0) },
        agreedToDisclaimer: { booleanValue: Boolean(account.agreedToDisclaimer) },
        createdAt: { stringValue: account.createdAt },
        lastLoginAt: { stringValue: account.lastLoginAt }
      };

      await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields })
      });
      return true;
    } catch {
      // ignore
    }
  }

  return true;
}

export async function getAllAccounts(): Promise<StoreAccount[]> {
  seedMasterAdmin();
  const accountsMap = new Map<string, StoreAccount>();

  // Load from memory first
  memoryAccountsStore.forEach((acc, email) => {
    accountsMap.set(email, acc);
  });

  // Admin SDK
  if (hasServiceAccount()) {
    const { db } = getFirebaseAdmin();
    if (db) {
      try {
        const snap = await db.collection("storeAccounts").get();
        snap.forEach((doc) => {
          const acc = doc.data() as StoreAccount;
          if (acc?.email) {
            accountsMap.set(acc.email.toLowerCase(), acc);
            memoryAccountsStore.set(acc.email.toLowerCase(), acc);
          }
        });
      } catch {
        // ignore
      }
    }
  } else {
    // REST API list
    const url = getRestCollectionUrl();
    if (url) {
      try {
        const res = await fetch(url);
        if (res.status === 200) {
          const json = await res.json();
          const docs = json.documents || [];
          for (const doc of docs) {
            const f = doc.fields;
            if (f?.email?.stringValue) {
              const acc: StoreAccount = {
                uid: f.uid?.stringValue || "",
                email: f.email?.stringValue,
                name: f.name?.stringValue || "مستخدم",
                phone: f.phone?.stringValue || "",
                password: f.password?.stringValue || "",
                passwordHash: f.passwordHash?.stringValue || "",
                role: (f.role?.stringValue as any) || "user",
                status: (f.status?.stringValue as any) || "active",
                pointsBalance: Number(f.pointsBalance?.integerValue || 0),
                agreedToDisclaimer: Boolean(f.agreedToDisclaimer?.booleanValue),
                createdAt: f.createdAt?.stringValue || new Date().toISOString(),
                lastLoginAt: f.lastLoginAt?.stringValue || new Date().toISOString()
              };
              accountsMap.set(acc.email.toLowerCase(), acc);
              memoryAccountsStore.set(acc.email.toLowerCase(), acc);
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return Array.from(accountsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function deleteAccountRecord(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === MASTER_ADMIN_EMAIL) {
    return false; // Cannot delete master admin
  }

  const docId = getAccountDocId(normalizedEmail);
  memoryAccountsStore.delete(normalizedEmail);

  if (hasServiceAccount()) {
    const { db } = getFirebaseAdmin();
    if (db) {
      try {
        await db.collection("storeAccounts").doc(docId).delete();
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

  return true;
}
