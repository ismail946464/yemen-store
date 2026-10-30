
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any) {
  const isQuotaError = (error as any)?.code === 'resource-exhausted' || (error as any)?.message?.includes('Quota exceeded');
  
  const errInfo: FirestoreErrorInfo = {
    error: isQuotaError ? 'تم تجاوز حصة العمليات اليومية المجانية (Quota Exceeded). سيتم تصفير العداد غداً.' : (error instanceof Error ? error.message : String(error)),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }

  if (isQuotaError) {
    console.warn('Firestore Quota Exceeded:', path);
    // Only throw for critical operations if needed, or just warn in console to prevent UI crash
    // For now, still throw so it follows the required pattern, but we've translated the message
  } else {
    console.error('Firestore Error details:', JSON.stringify(errInfo, null, 2));
  }
  
  // We throw the JSON string so the system can catch it
  throw new Error(JSON.stringify(errInfo));
}
