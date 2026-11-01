import { getFirebaseAdmin } from "../_lib/firebaseAdmin.js";
import { requireAdminAuth } from "../_lib/authMiddleware.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Enforce server-side Admin authorization
  const admin = await requireAdminAuth(req, res);
  if (!admin) {
    return;
  }

  try {
    const { db } = getFirebaseAdmin();
    if (!db) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متصلة" });
    }

    const snap = await db.collection("settings").doc("global").get();
    const cleanupMonths = snap.exists ? (snap.data()?.cleanupMonths || 3) : 3;
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - cleanupMonths);

    const querySnapshot = await db
      .collection("products")
      .where("createdAt", "<", thresholdDate.toISOString())
      .get();

    let deletedCount = 0;
    const batch = db.batch();
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    if (deletedCount > 0) {
      await batch.commit();
    }

    return res.status(200).json({ success: true, message: `تم حذف ${deletedCount} منتج قديم.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error" });
  }
}
