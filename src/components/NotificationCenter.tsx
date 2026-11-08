import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit, deleteDoc } from 'firebase/firestore';
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
      console.warn("Notifications listener error (handled):", err.message);
    });

    return () => unsubscribe();
  }, [user]);

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
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next && unreadCount > 0) {
            notifications.forEach(n => !n.read && markAsRead(n.id));
          }
        }}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-black text-gray-900">التنبيهات</h3>
                {notifications.length > 0 && (
                  <button 
                    onClick={() => {
                        notifications.forEach(n => !n.read && markAsRead(n.id));
                    }}
                    className={`text-xs ${getThemeClasses('text')} font-bold hover:underline`}
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-gray-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">لا توجد تنبيهات حالياً</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-4 border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer relative group ${!n.read ? getThemeClasses('bgLight') : ''}`}
                      onClick={() => handleAction(n)}
                    >
                      <div className="flex gap-3">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          n.type === 'verification_expiry' ? 'bg-orange-100 text-orange-600' : 
                          n.type === 'order' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {n.type === 'verification_expiry' ? <AlertTriangle className="w-4 h-4" /> : 
                           n.type === 'order' ? <CheckCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-gray-900 mb-1">{n.title}</p>
                          <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{n.message}</p>
                          {n.type === 'verification_expiry' && (
                             <button className="mt-2 text-[10px] bg-black text-white px-3 py-1 rounded-full font-black flex items-center gap-1">
                               تجديد الآن <ArrowRight className="w-3 h-3 rotate-180" />
                             </button>
                          )}
                          <p className="text-[9px] text-gray-400 mt-2">
                            {new Date(n.createdAt).toLocaleDateString('ar-YE', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {!n.read && (
                        <div className={`absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 ${getThemeClasses('bg')} rounded-full`} />
                      )}
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
