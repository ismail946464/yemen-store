import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from './firestoreUtils';

export interface ProductQuestionItem {
  id: string;
  productId: string;
  productTitle: string;
  storeId: string;
  storeName: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  question: string;
  answer: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function askProductQuestion(input: {
  productId: string;
  productTitle: string;
  storeId: string;
  storeName: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  question: string;
}): Promise<string> {
  const cleanQuestion = String(input.question || '').trim().slice(0, 1000);
  if (!cleanQuestion || cleanQuestion.length < 4) {
    throw new Error('يرجى كتابة سؤال واضح لا يقل عن 4 أحرف');
  }
  if (!input.productId || !input.userId) {
    throw new Error('بيانات المنتج أو المستخدم غير مكتملة');
  }

  const nowIso = new Date().toISOString();
  const cleanPhoto =
    typeof input.userPhoto === 'string' &&
    input.userPhoto.trim().length > 0 &&
    input.userPhoto.length <= 850000
      ? input.userPhoto
      : null;

  const payload = {
    productId: String(input.productId).slice(0, 128),
    productTitle: String(input.productTitle || 'منتج').trim().slice(0, 200),
    storeId: String(input.storeId || 'global').slice(0, 128),
    storeName: String(input.storeName || 'المتجر').trim().slice(0, 200),
    userId: String(input.userId).slice(0, 128),
    userName: String(input.userName || 'عميل').trim().slice(0, 150),
    userPhoto: cleanPhoto,
    question: cleanQuestion,
    answer: null,
    answeredByName: null,
    answeredAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const docRef = await addDoc(collection(db, 'productQuestions'), payload);

    if (payload.storeId && payload.storeId !== 'global' && payload.storeId !== payload.userId) {
      await addDoc(collection(db, 'notifications'), {
        userId: payload.storeId,
        title: `استفسار جديد حول: ${payload.productTitle.slice(0, 60)}`,
        message: `سأل ${payload.userName}: "${cleanQuestion.slice(0, 120)}"`,
        type: 'system',
        read: false,
        actionUrl: `/product/${payload.productId}`,
        createdAt: nowIso,
      }).catch(() => {});
    }

    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'productQuestions', auth);
    throw err;
  }
}

export async function answerProductQuestion(params: {
  question: ProductQuestionItem;
  answer: string;
  responderName: string;
}): Promise<void> {
  const cleanAnswer = String(params.answer || '').trim().slice(0, 2000);
  if (!cleanAnswer) {
    throw new Error('يرجى كتابة الرد قبل الحفظ');
  }
  const nowIso = new Date().toISOString();

  try {
    await updateDoc(doc(db, 'productQuestions', params.question.id), {
      answer: cleanAnswer,
      answeredByName: String(params.responderName || params.question.storeName || 'المتجر').trim().slice(0, 200),
      answeredAt: nowIso,
      updatedAt: nowIso,
    });

    if (params.question.userId) {
      await addDoc(collection(db, 'notifications'), {
        userId: params.question.userId,
        title: `رد المتجر على استفسارك: ${params.question.productTitle.slice(0, 50)}`,
        message: `${params.responderName || params.question.storeName}: "${cleanAnswer.slice(0, 120)}"`,
        type: 'system',
        read: false,
        actionUrl: `/product/${params.question.productId}`,
        createdAt: nowIso,
      }).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `productQuestions/${params.question.id}`, auth);
    throw err;
  }
}

export async function deleteProductQuestion(questionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'productQuestions', questionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `productQuestions/${questionId}`, auth);
    throw err;
  }
}
