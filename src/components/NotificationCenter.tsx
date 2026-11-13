import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAppContext } from '../AppContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export default function NotificationCenter() {
  const { user, getThemeClasses } = useAppContext();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setNotifications(items.slice(0, 30));
    }, (err) => {
      console.warn("Notifications listener notice (handled):", err.message);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`, auth);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notifications/${id}`, auth);
    }
  };

  const handleAction = (n: any) => {
    markAsRead(n.id);
    if (n.actionUrl) {
      navigate(n.actionUrl);
      setIsOpen(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="التنبيهات"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next && unreadCount > 0) {
            notifications.forEach(n => !n.read && markAsRead(n.id));
          }
        }}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition-colors"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold tabular-nums rounded-md flex items-center justify-center border border-white dark:border-[#0A0B0D]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 mt-2 w-80 max-w-[90vw] rounded-xl shadow-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between">
                <h3 className="font-bold text-sm">التنبيهات</h3>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => notifications.forEach(n => !n.read && markAsRead(n.id))}
                    className={`text-xs ${getThemeClasses('text')} font-semibold hover:underline`}
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>

              <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-[#5C5B57] dark:text-zinc-400">
                    <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-medium">لا توجد تنبيهات حالياً</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 transition-colors cursor-pointer relative group hover:bg-[#F6F5F0] dark:hover:bg-[#1C1F26] ${!n.read ? getThemeClasses('bgLight') : ''}`}
                      onClick={() => handleAction(n)}
                    >
                      <div className="flex gap-3">
                        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                          n.type === 'verification_expiry'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : n.type === 'order'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-[#EFEDE6] text-[#111214] dark:bg-[#1C1F26] dark:text-zinc-300'
                        }`}>
                          {n.type === 'verification_expiry' ? <AlertTriangle className="w-4 h-4" /> :
                            n.type === 'order' ? <CheckCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold mb-0.5">{n.title}</p>
                          <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 line-clamp-2 leading-relaxed">{n.message}</p>
                          {n.type === 'verification_expiry' && (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] bg-[#111214] dark:bg-[#F4F4F2] text-white dark:text-[#111214] px-2.5 py-0.5 rounded-md font-bold">
                              تجديد الآن <ArrowRight className="w-3 h-3 rotate-180" />
                            </span>
                          )}
                          <p className="text-[10px] text-[#5C5B57] dark:text-zinc-500 mt-1.5 tabular-nums">
                            {new Date(n.createdAt).toLocaleDateString('ar-YE', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 transition-opacity self-start"
                          aria-label="حذف التنبيه"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
