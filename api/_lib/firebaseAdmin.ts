import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let initializedApp: App | null = null;
let firestoreDb: Firestore | null = null;

export const DEFAULT_APPLET_DB_ID = "ai-studio-3645fbbf-8fe8-4b8a-9113-047a44e34c52";

/**
 * Sanitizes any database ID input.
 * Handles cases where a user accidentally pastes a full Firebase Console URL
 * (e.g. "https://console.firebase.google.com/project/.../firestore/databases/ai-studio-xxx/data")
 * or a full REST URL, or where someone enters a site URL (e.g. "https://...").
 */
export function sanitizeDatabaseId(raw?: string): string {
  if (!raw || typeof raw !== "string") return DEFAULT_APPLET_DB_ID;
  let val = raw.trim();

  // If someone pasted a Firebase console URL:
  // e.g. https://console.firebase.google.com/project/.../firestore/databases/ai-studio-3645fbbf-8fe8-4b8a-9113-047a44e34c52/data
  if (val.includes("/databases/")) {
    const after = val.split("/databases/")[1];
    val = after.split("/")[0].split("?")[0].trim();
  }

  // If it still starts with http:// or https://, it is an invalid URL (e.g. APP_URL)
  if (val.startsWith("http://") || val.startsWith("https://")) {
    return DEFAULT_APPLET_DB_ID;
  }

  // Special Firestore default database identifier
  if (val === "(default)") return val;

  // Valid Firestore database IDs can only contain lowercase letters, numbers, hyphens, and underscores
  val = val.replace(/[^a-zA-Z0-9_\-]/g, "");
  return val || DEFAULT_APPLET_DB_ID;
}

function resolveDatabaseId(): string {
  if (process.env.FIRESTORE_DATABASE_ID) {
    return sanitizeDatabaseId(process.env.FIRESTORE_DATABASE_ID);
  }

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.firestoreDatabaseId) {
        return sanitizeDatabaseId(config.firestoreDatabaseId);
      }
    }
  } catch {
    // ignore
  }

  return DEFAULT_APPLET_DB_ID;
}

function createFirestoreInstance(app: App, targetDbId: string): Firestore {
  const cleanId = sanitizeDatabaseId(targetDbId);
  if (cleanId === "(default)") {
    return getFirestore(app);
  }
  try {
    return getFirestore(app, cleanId);
  } catch (err) {
    console.warn("Failed to bind named Firestore database ID, falling back to default:", err);
    return getFirestore(app);
  }
}

export function getFirebaseAdmin(): { app: App | null; db: Firestore | null } {
  if (initializedApp && firestoreDb) {
    return { app: initializedApp, db: firestoreDb };
  }

  const databaseId = resolveDatabaseId();

  const currentApps = getApps();
  if (currentApps.length > 0 && currentApps[0]) {
    initializedApp = currentApps[0];
    firestoreDb = createFirestoreInstance(initializedApp, databaseId);
    return { app: initializedApp, db: firestoreDb };
  }

  try {
    // 1. Check for FIREBASE_SERVICE_ACCOUNT_JSON env var (Vercel standard)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch {
        serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "base64").toString("utf8"));
      }

      initializedApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
      });
      firestoreDb = createFirestoreInstance(initializedApp, databaseId);
      return { app: initializedApp, db: firestoreDb };
    }

    // 2. Check for individual FIREBASE credentials
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializedApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        })
      });
      firestoreDb = createFirestoreInstance(initializedApp, databaseId);
      return { app: initializedApp, db: firestoreDb };
    }

    // 3. Check for local firebase-applet-config.json (Cloud Run / Local)
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const targetDbId = config.firestoreDatabaseId || databaseId;
      initializedApp = initializeApp({
        projectId: config.projectId,
        storageBucket: config.storageBucket
      });
      firestoreDb = createFirestoreInstance(initializedApp, targetDbId);
      return { app: initializedApp, db: firestoreDb };
    }

    // 4. Default initialization (e.g. GCP metadata / ADC)
    initializedApp = initializeApp();
    firestoreDb = createFirestoreInstance(initializedApp, databaseId);
  } catch (err: any) {
    console.warn("Firebase Admin initialization notice:", err?.message || err);
  }

  return { app: initializedApp, db: firestoreDb };
}
