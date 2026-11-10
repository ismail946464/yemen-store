import fs from "fs";
import path from "path";
import crypto from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  type Firestore
} from "firebase/firestore";
import { sanitizeDatabaseId } from "./firebaseAdmin.js";

export interface StoreAccount {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  photoURL?: string;
  password: string;
  passwordHash?: string;
  role: "admin" | "store" | "user" | "delivery";
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
export const MASTER_ADMIN_UID = "MQAwCYqFztd2PZbV1fRMxKRqoYX2";

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

let serverFirestoreDb: Firestore | null = null;

export function getServerFirestore(): Firestore | null {
  if (serverFirestoreDb) return serverFirestoreDb;
  const cfg = getAppletConfig();
  if (!cfg?.apiKey || !cfg?.projectId) return null;
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(cfg);
    const dbId = sanitizeDatabaseId(cfg.firestoreDatabaseId || process.env.FIRESTORE_DATABASE_ID);
    serverFirestoreDb = getFirestore(app, dbId);
    return serverFirestoreDb;
  } catch (err: any) {
    console.warn("Server firestore init notice:", err?.message);
    return null;
  }
}

export function hasServiceAccount(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function getRestDocUrl(docId: string): string | null {
  const cfg = getAppletConfig();
  if (!cfg?.apiKey || !cfg?.projectId) return null;
  const dbId = sanitizeDatabaseId(cfg.firestoreDatabaseId || process.env.FIRESTORE_DATABASE_ID);
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/storeAccounts/${docId}?key=${cfg.apiKey}`;
}

// Ensure master admin is pre-populated
export function seedMasterAdmin(): StoreAccount {
  const existing = memoryAccountsStore.get(MASTER_ADMIN_EMAIL);
  if (existing) {
    existing.uid = MASTER_ADMIN_UID;
    existing.role = "admin";
    return existing;
  }

  const adminAccount: StoreAccount = {
    uid: MASTER_ADMIN_UID,
    email: MASTER_ADMIN_EMAIL,
    name: "Ismail Ali",
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
    const cached = memoryAccountsStore.get(normalizedEmail)!;
    if (normalizedEmail === MASTER_ADMIN_EMAIL) {
      cached.uid = MASTER_ADMIN_UID;
      cached.role = "admin";
    }
    return cached;
  }

  // 2. Direct Server Firestore check
  const db = getServerFirestore();
  if (db) {
    try {
      const snap = await getDoc(doc(db, "storeAccounts", docId));
      if (snap.exists()) {
        const acc = snap.data() as StoreAccount;
        if (normalizedEmail === MASTER_ADMIN_EMAIL) {
          acc.uid = MASTER_ADMIN_UID;
          acc.role = "admin";
        }
        memoryAccountsStore.set(normalizedEmail, acc);
        return acc;
      }

      // Also check users collection to preserve profile modifications
      const targetUid = normalizedEmail === MASTER_ADMIN_EMAIL ? MASTER_ADMIN_UID : `u_${docId.slice(4)}`;
      const userSnap = await getDoc(doc(db, "users", targetUid));
      if (userSnap.exists()) {
        const u = userSnap.data();
        const acc: StoreAccount = {
          uid: targetUid,
          email: normalizedEmail,
          name: u.name || "مستخدم",
          phone: u.phone || "",
          photoURL: u.photoURL || "",
          password: MASTER_ADMIN_DEFAULT_PASS,
          passwordHash: hashPassword(MASTER_ADMIN_DEFAULT_PASS),
          role: normalizedEmail === MASTER_ADMIN_EMAIL ? "admin" : (u.role || "user"),
          status: "active",
          pointsBalance: u.pointsBalance || 0,
          agreedToDisclaimer: true,
          createdAt: u.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        memoryAccountsStore.set(normalizedEmail, acc);
        return acc;
      }
    } catch (err: any) {
      console.warn("Direct firestore account get notice:", err?.message);
    }
  }

  // If master admin and not found yet in Firestore, guarantee existence
  if (normalizedEmail === MASTER_ADMIN_EMAIL) {
    return seedMasterAdmin();
  }

  // 3. REST API check fallback
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

  if (normalizedEmail === MASTER_ADMIN_EMAIL) {
    account.uid = MASTER_ADMIN_UID;
    account.role = "admin";
    if (!account.name) {
      account.name = "Ismail Ali";
    }
  }

  // Update in memory
  memoryAccountsStore.set(normalizedEmail, account);

  // 1. Direct Server Firestore Client SDK (Primary & 100% reliable)
  const db = getServerFirestore();
  if (db) {
    try {
      await setDoc(doc(db, "storeAccounts", docId), account, { merge: true });
      // Sync to users collection so existing app queries keep working
      await setDoc(doc(db, "users", account.uid), {
        name: account.name,
        email: account.email,
        phone: account.phone || "",
        photoURL: account.photoURL || "",
        role: account.role,
        pointsBalance: account.pointsBalance || 0,
        agreedToDisclaimer: Boolean(account.agreedToDisclaimer),
        createdAt: account.createdAt,
        lastSeen: account.lastLoginAt,
        isOnline: true
      }, { merge: true });
      return true;
    } catch (err: any) {
      console.warn("Server Firestore save notice:", err?.message);
    }
  }

  // 2. REST API fallback
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

  // Direct Server Firestore list
  const db = getServerFirestore();
  if (db) {
    try {
      const snap = await getDocs(collection(db, "storeAccounts"));
      snap.forEach((d) => {
        const acc = d.data() as StoreAccount;
        if (acc?.email) {
          accountsMap.set(acc.email.toLowerCase(), acc);
          memoryAccountsStore.set(acc.email.toLowerCase(), acc);
        }
      });
    } catch (err: any) {
      console.warn("Server firestore list notice:", err?.message);
    }
  }

  return Array.from(accountsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function deleteAccountRecord(identifier: string): Promise<boolean> {
  const normalized = identifier.trim().toLowerCase();
  if (normalized === MASTER_ADMIN_UID) {
    return false; // Cannot delete primary master admin UID
  }

  let targetEmail = "";
  let targetUid = "";

  if (normalized.includes("@")) {
    targetEmail = normalized;
    if (targetEmail === MASTER_ADMIN_EMAIL) {
      return false; // Cannot delete master email globally
    }
    const existing = await getAccountByEmail(normalized);
    if (existing) targetUid = existing.uid;
  } else {
    targetUid = identifier.trim();
    if (targetUid === MASTER_ADMIN_UID) {
      return false;
    }
    for (const [em, acc] of memoryAccountsStore.entries()) {
      if (acc.uid === targetUid) {
        targetEmail = em;
        break;
      }
    }
  }

  const docId = targetEmail ? getAccountDocId(targetEmail) : "";
  if (targetEmail && targetEmail !== MASTER_ADMIN_EMAIL) {
    memoryAccountsStore.delete(targetEmail);
  }

  // 1. Delete from Firestore via direct Server Firestore Client SDK
  const db = getServerFirestore();
  if (db) {
    try {
      if (docId && targetEmail !== MASTER_ADMIN_EMAIL) {
        await deleteDoc(doc(db, "storeAccounts", docId));
      }
      if (targetUid && targetUid !== MASTER_ADMIN_UID) {
        await deleteDoc(doc(db, "users", targetUid));
      }
      // Also delete any matching document in users by email if not master admin
      if (targetEmail && targetEmail !== MASTER_ADMIN_EMAIL) {
        const qUsers = query(collection(db, "users"), where("email", "==", targetEmail));
        const uSnap = await getDocs(qUsers);
        for (const uDoc of uSnap.docs) {
          if (uDoc.id !== MASTER_ADMIN_UID) {
            await deleteDoc(doc(db, "users", uDoc.id));
          }
        }
      }
    } catch (err: any) {
      console.warn("Delete account notice:", err.message);
    }
  }

  return true;
}
