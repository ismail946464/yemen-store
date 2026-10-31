import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let initializedApp: App | null = null;
let firestoreDb: Firestore | null = null;

export function getFirebaseAdmin(): { app: App | null; db: Firestore | null } {
  if (initializedApp && firestoreDb) {
    return { app: initializedApp, db: firestoreDb };
  }

  const databaseId = process.env.FIRESTORE_DATABASE_ID || "ai-studio-3645fbbf-8fe8-4b8a-9113-047a44e34c52";

  const currentApps = getApps();
  if (currentApps.length > 0 && currentApps[0]) {
    initializedApp = currentApps[0];
    try {
      firestoreDb = getFirestore(initializedApp, databaseId);
    } catch {
      firestoreDb = getFirestore(initializedApp);
    }
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
      try {
        firestoreDb = getFirestore(initializedApp, databaseId);
      } catch {
        firestoreDb = getFirestore(initializedApp);
      }
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
      try {
        firestoreDb = getFirestore(initializedApp, databaseId);
      } catch {
        firestoreDb = getFirestore(initializedApp);
      }
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
      try {
        firestoreDb = getFirestore(initializedApp, targetDbId);
      } catch {
        firestoreDb = getFirestore(initializedApp);
      }
      return { app: initializedApp, db: firestoreDb };
    }

    // 4. Default initialization (e.g. GCP metadata / ADC)
    initializedApp = initializeApp();
    try {
      firestoreDb = getFirestore(initializedApp, databaseId);
    } catch {
      firestoreDb = getFirestore(initializedApp);
    }
  } catch (err: any) {
    console.warn("Firebase Admin initialization notice:", err?.message || err);
  }

  return { app: initializedApp, db: firestoreDb };
}
