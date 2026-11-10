import crypto from "crypto";
import {
  StoreAccount,
  getAccountByEmail,
  saveAccount,
  getAllAccounts,
  deleteAccountRecord,
  getAccountDocId,
  hashPassword,
  MASTER_ADMIN_UID,
  getServerFirestore
} from "./accountStorage.js";
import { createSignedSessionToken, AuthUser } from "./authMiddleware.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

function generateStorePassword(): string {
  // Generates memorable, high-entropy store password like "YM-749201"
  const digits = crypto.randomInt(100000, 1000000).toString();
  return `YM-${digits}`;
}

export async function processRegisterStoreAccount(input: {
  email: string;
  name?: string;
  password?: string;
  phone?: string;
  photoURL?: string;
  agreedToDisclaimer?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  password?: string;
  user?: any;
  sessionToken?: string;
}> {
  const emailRaw = String(input.email || "").trim();
  const normalizedEmail = emailRaw.toLowerCase();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return {
      success: false,
      message: "يرجى إدخال بريد إلكتروني صالح."
    };
  }

  // Strict Uniqueness check 1: store accounts
  const existing = await getAccountByEmail(normalizedEmail);
  if (existing) {
    return {
      success: false,
      message: "عذراً، هذا البريد مسجل مسبقاً في النظام. لا يمكن تسجيل أكثر من حساب بنفس البريد. يرجى تسجيل الدخول بحسابك."
    };
  }

  // Strict Uniqueness check 2: check Firestore users collection
  const db = getServerFirestore();
  if (db) {
    try {
      const q = query(collection(db, "users"), where("email", "==", normalizedEmail));
      const uSnap = await getDocs(q);
      if (!uSnap.empty) {
        return {
          success: false,
          message: "عذراً، هذا البريد مسجل مسبقاً في النظام. لا يمكن تسجيل أكثر من حساب بنفس البريد. يرجى تسجيل الدخول بحسابك."
        };
      }
    } catch {}
  }

  const userPassword = String(input.password || "").trim();
  if (userPassword && userPassword.length < 4) {
    return {
      success: false,
      message: "كلمة المرور قصيرة جداً. يرجى اختيار كلمة مرور من 4 خانات على الأقل."
    };
  }

  const password = userPassword || generateStorePassword();
  const displayName = String(input.name || "").trim() || normalizedEmail.split("@")[0] || "مستخدم";
  const phone = String(input.phone || "").trim();
  const photoURL = String(input.photoURL || "").trim();
  const isMasterAdmin = normalizedEmail === "1ismaai0lll@gmail.com";
  const docId = getAccountDocId(normalizedEmail);
  const uid = `u_${docId.slice(4)}`;

  const newAccount: StoreAccount = {
    uid,
    email: normalizedEmail,
    name: displayName,
    phone,
    photoURL,
    password,
    passwordHash: hashPassword(password),
    role: isMasterAdmin ? "admin" : "user",
    status: "active",
    pointsBalance: 0,
    agreedToDisclaimer: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  await saveAccount(newAccount);

  const sessionToken = createSignedSessionToken({
    uid,
    email: normalizedEmail,
    role: newAccount.role
  });

  return {
    success: true,
    message: "تم إنشاء حسابك في المتجر بنجاح!",
    password,
    user: {
      uid,
      email: normalizedEmail,
      displayName,
      phone,
      photoURL,
      role: newAccount.role,
      pointsBalance: 0,
      agreedToDisclaimer: true,
      createdAt: newAccount.createdAt
    },
    sessionToken
  };
}

export async function processUpdateProfile(input: {
  email: string;
  name?: string;
  phone?: string;
  photoURL?: string;
}): Promise<{ success: boolean; message: string; user?: any }> {
  const normalizedEmail = String(input.email || "").trim().toLowerCase();
  const account = await getAccountByEmail(normalizedEmail);
  if (!account) {
    return { success: false, message: "لم يتم العثور على الحساب" };
  }

  if (input.name) account.name = String(input.name).trim();
  if (input.phone !== undefined) account.phone = String(input.phone).trim();
  if (input.photoURL !== undefined) account.photoURL = String(input.photoURL).trim();

  await saveAccount(account);

  return {
    success: true,
    message: "تم تحديث الملف الشخصي بنجاح",
    user: {
      uid: account.uid,
      email: account.email,
      displayName: account.name,
      phone: account.phone || "",
      photoURL: account.photoURL || "",
      role: account.role,
      pointsBalance: account.pointsBalance || 0,
      agreedToDisclaimer: true,
      createdAt: account.createdAt
    }
  };
}

export async function processLoginStoreAccount(input: {
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  message: string;
  user?: any;
  sessionToken?: string;
}> {
  const normalizedEmail = String(input.email || "").trim().toLowerCase();
  const trimmedPassword = String(input.password || "").trim();

  if (!normalizedEmail || !trimmedPassword) {
    return {
      success: false,
      message: "يرجى كتابة البريد الإلكتروني وكلمة المرور المسجلة الخاصة بك."
    };
  }

  const account = await getAccountByEmail(normalizedEmail);
  if (!account) {
    return {
      success: false,
      message: "لم يتم العثور على حساب مسجل بهذا البريد. يرجى التأكد من البريد أو إنشاء حساب جديد."
    };
  }

  if (account.status === "suspended") {
    return {
      success: false,
      message: "هذا الحساب موقوف حالياً من قبل إدارة المتجر."
    };
  }

  // Check password (matches plain text or hash)
  const isCorrect =
    account.password === trimmedPassword ||
    account.passwordHash === hashPassword(trimmedPassword);

  if (!isCorrect) {
    return {
      success: false,
      message: "كلمة المرور غير صحيحة. يرجى إدخال كلمة المرور التي استلمتها عند التسجيل بدقة."
    };
  }

  // Update last login
  account.lastLoginAt = new Date().toISOString();
  await saveAccount(account);

  const sessionToken = createSignedSessionToken({
    uid: account.uid,
    email: account.email,
    role: account.role
  });

  return {
    success: true,
    message: "تم تسجيل الدخول بنجاح",
    user: {
      uid: account.uid,
      email: account.email,
      displayName: account.name,
      phone: account.phone || "",
      photoURL: account.photoURL || "",
      role: account.role,
      pointsBalance: account.pointsBalance || 0,
      agreedToDisclaimer: Boolean(account.agreedToDisclaimer),
      createdAt: account.createdAt
    },
    sessionToken
  };
}

export async function processAdminListAccounts(): Promise<{
  success: boolean;
  accounts: StoreAccount[];
}> {
  const accounts = await getAllAccounts();
  return {
    success: true,
    accounts
  };
}

export async function processAdminUpdateAccount(payload: {
  id?: string;
  email?: string;
  password?: string;
  role?: "admin" | "store" | "user" | "delivery";
  name?: string;
  phone?: string;
  status?: "active" | "suspended";
}): Promise<{ success: boolean; message: string }> {
  let targetEmail = String(payload.email || "").trim().toLowerCase();
  const targetId = String(payload.id || "").trim();

  let account: StoreAccount | null = null;
  if (targetEmail) {
    account = await getAccountByEmail(targetEmail);
  }
  if (!account && targetId) {
    const all = await getAllAccounts();
    account = all.find(a => a.uid === targetId) || null;
    if (account) targetEmail = account.email;
  }

  if (account) {
    if (payload.password) {
      account.password = String(payload.password).trim();
      account.passwordHash = hashPassword(account.password);
    }
    if (payload.role && ["admin", "store", "user", "delivery"].includes(payload.role)) {
      if (targetEmail === "1ismaai0lll@gmail.com" || account.uid === MASTER_ADMIN_UID) {
        account.role = "admin";
      } else {
        account.role = payload.role as any;
      }
    }
    if (payload.name) account.name = String(payload.name).trim();
    if (payload.phone !== undefined) account.phone = String(payload.phone).trim();
    if (payload.status) account.status = payload.status;
    await saveAccount(account);
  }

  // Also directly update in Firestore users collection
  if (targetId || account?.uid) {
    const uidToUpdate = targetId || account?.uid;
    if (uidToUpdate) {
      const db = getServerFirestore();
      if (db) {
        try {
          const updates: Record<string, any> = {};
          if (payload.role && (uidToUpdate !== MASTER_ADMIN_UID || payload.role === "admin")) {
            updates.role = payload.role;
          }
          if (payload.name) updates.name = payload.name;
          if (payload.phone !== undefined) updates.phone = payload.phone;
          if (Object.keys(updates).length > 0) {
            await setDoc(doc(db, "users", uidToUpdate), updates, { merge: true });
          }
          // If promoted to store, also ensure storeProfiles doc exists
          if (payload.role === "store") {
            const storeRef = doc(db, "storeProfiles", uidToUpdate);
            const sSnap = await getDoc(storeRef);
            if (!sSnap.exists()) {
              const oneYear = new Date();
              oneYear.setFullYear(oneYear.getFullYear() + 1);
              let storePlatformName = "المنصة";
              try {
                const globalSnap = await getDoc(doc(db, "settings", "global"));
                if (globalSnap.exists() && globalSnap.data()?.storeName) {
                  storePlatformName = globalSnap.data().storeName;
                }
              } catch {
                // ignore
              }
              await setDoc(storeRef, {
                userId: uidToUpdate,
                name: payload.name || account?.name || "متجر جديد",
                description: `متجر رسمي معتمد في منصة ${storePlatformName}`,
                logoUrl: account?.photoURL || "",
                verified: true,
                verifiedUntil: oneYear.toISOString(),
                updatedAt: new Date().toISOString()
              }, { merge: true });
            }
          }
        } catch (err: any) {
          console.warn("Update user in users collection notice:", err?.message);
        }
      }
    }
  }

  return { success: true, message: "تم تحديث بيانات الحساب والرتبة بنجاح" };
}

export async function processAdminDeleteAccount(identifier: string, targetId?: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = String(identifier || "").trim().toLowerCase();
  const uid = String(targetId || "").trim();

  if (uid === MASTER_ADMIN_UID || (normalizedEmail === "1ismaai0lll@gmail.com" && (!uid || uid === MASTER_ADMIN_UID))) {
    return { success: false, message: "لا يمكن حذف حساب المدير العام الرئيسي للمتجر" };
  }

  const ok = await deleteAccountRecord(uid || normalizedEmail);
  if (ok) {
    return { success: true, message: "تم حذف الحساب نهائياً بنجاح" };
  }
  return { success: false, message: "فشل حذف الحساب" };
}

export async function processAdminCreateAccount(input: {
  email: string;
  name: string;
  password?: string;
  role?: "admin" | "store" | "user" | "delivery";
  phone?: string;
}): Promise<{ success: boolean; message: string; account?: StoreAccount }> {
  const normalizedEmail = String(input.email || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { success: false, message: "يرجى إدخال بريد إلكتروني صالح" };
  }

  const existing = await getAccountByEmail(normalizedEmail);
  if (existing) {
    return { success: false, message: "هذا البريد مسجل بالفعل في المتجر" };
  }

  const password = String(input.password || "").trim() || generateStorePassword();
  const docId = getAccountDocId(normalizedEmail);
  const uid = `u_${docId.slice(4)}`;

  const account: StoreAccount = {
    uid,
    email: normalizedEmail,
    name: String(input.name || "").trim() || "مستخدم جديد",
    phone: String(input.phone || "").trim(),
    password,
    passwordHash: hashPassword(password),
    role: input.role || "user",
    status: "active",
    pointsBalance: 0,
    agreedToDisclaimer: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  await saveAccount(account);
  return { success: true, message: "تم إنشاء الحساب بنجاح", account };
}
