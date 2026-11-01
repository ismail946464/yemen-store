import crypto from "crypto";
import {
  StoreAccount,
  getAccountByEmail,
  saveAccount,
  getAllAccounts,
  deleteAccountRecord,
  getAccountDocId,
  hashPassword
} from "./accountStorage.js";
import { createSignedSessionToken, AuthUser } from "./authMiddleware.js";

function generateStorePassword(): string {
  // Generates memorable, high-entropy store password like "YM-749201"
  const digits = crypto.randomInt(100000, 1000000).toString();
  return `YM-${digits}`;
}

export async function processRegisterStoreAccount(input: {
  email: string;
  name?: string;
  phone?: string;
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

  // Strict Uniqueness check
  const existing = await getAccountByEmail(normalizedEmail);
  if (existing) {
    return {
      success: false,
      message: "عذراً، هذا البريد مسجل مسبقاً في النظام. لا يمكن تكرار الحسابات. يرجى تسجيل الدخول بكلمة المرور الخاصة به."
    };
  }

  const displayName = String(input.name || "").trim() || normalizedEmail.split("@")[0] || "مستخدم";
  const phone = String(input.phone || "").trim();
  const password = generateStorePassword();
  const isMasterAdmin = normalizedEmail === "1ismaai0lll@gmail.com";
  const docId = getAccountDocId(normalizedEmail);
  const uid = `u_${docId.slice(4)}`;

  const newAccount: StoreAccount = {
    uid,
    email: normalizedEmail,
    name: displayName,
    phone,
    password,
    passwordHash: hashPassword(password),
    role: isMasterAdmin ? "admin" : "user",
    status: "active",
    pointsBalance: 0,
    agreedToDisclaimer: false,
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
      role: newAccount.role,
      pointsBalance: 0,
      agreedToDisclaimer: false,
      createdAt: newAccount.createdAt
    },
    sessionToken
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
  email: string;
  password?: string;
  role?: "admin" | "store" | "user";
  name?: string;
  phone?: string;
  status?: "active" | "suspended";
}): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = String(payload.email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: false, message: "البريد الإلكتروني مطلوب" };
  }

  const account = await getAccountByEmail(normalizedEmail);
  if (!account) {
    return { success: false, message: "الحساب غير موجود" };
  }

  if (payload.password) {
    account.password = String(payload.password).trim();
    account.passwordHash = hashPassword(account.password);
  }
  if (payload.role && ["admin", "store", "user"].includes(payload.role)) {
    // Master admin remains admin
    if (normalizedEmail === "1ismaai0lll@gmail.com") {
      account.role = "admin";
    } else {
      account.role = payload.role;
    }
  }
  if (payload.name) account.name = String(payload.name).trim();
  if (payload.phone !== undefined) account.phone = String(payload.phone).trim();
  if (payload.status) account.status = payload.status;

  await saveAccount(account);
  return { success: true, message: "تم تحديث بيانات الحساب بنجاح" };
}

export async function processAdminDeleteAccount(email: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (normalizedEmail === "1ismaai0lll@gmail.com") {
    return { success: false, message: "لا يمكن حذف حساب المدير العام للمتجر" };
  }

  const ok = await deleteAccountRecord(normalizedEmail);
  if (ok) {
    return { success: true, message: "تم حذف الحساب نهائياً بنجاح" };
  }
  return { success: false, message: "فشل حذف الحساب" };
}

export async function processAdminCreateAccount(input: {
  email: string;
  name: string;
  password?: string;
  role?: "admin" | "store" | "user";
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
