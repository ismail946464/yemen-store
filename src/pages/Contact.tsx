import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, ArrowRight, User, Hash, Clock, Check, CheckCheck, Loader2, Mic, Search, PenSquare, ChevronDown, Camera, BadgeCheck, Trash2, X, Download, Maximize2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  limit, 
  setDoc,
  serverTimestamp,
  increment,
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { motion, AnimatePresence } from 'motion/react';

export default function Contact() {
  const { userData, user, getThemeClasses, isAdmin, isStore, settings, markMessagesAsRead, isDarkMode } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRecipientId = searchParams.get('to');
  const recipientId = (rawRecipientId && user && rawRecipientId === user.uid) ? null : rawRecipientId;
  const [recipientProfile, setRecipientProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Prevent user from starting a conversation with themselves
  useEffect(() => {
    if (user && rawRecipientId === user.uid) {
      toast.error('لا يمكنك بدء محادثة مع نفسك');
      navigate('/contact', { replace: true });
    }
  }, [user, rawRecipientId, navigate]);

  // Automatically clear unread messages badge when user opens the Contact / Chat page
  useEffect(() => {
    if (user) {
      markMessagesAsRead();
    }
  }, [user]);

  // Search users functionality
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) {
        setUserSearchResults([]);
        return;
      }

      setSearchingUsers(true);
      try {
        // Query users by name or email
        // Note: Firestore doesn't support full-text search easily, so we fetch and filter
        // In a real app, you'd use a server-side search or specific partial match queries
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(20));
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        // Filter based on roles and search term
        const filtered = results.filter(u => {
          if (u.id === user?.uid) return false;
          
          const match = (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
          
          if (!match) return false;

          // RESTRICTION: Regular users can only find stores or admins
          const currentUserRole = userData?.role || 'user';
          if (currentUserRole === 'user') {
            return u.role === 'store' || u.role === 'admin';
          }
          
          return true;
        });

        setUserSearchResults(filtered);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearchingUsers(false);
      }
    };

    const timer = setTimeout(searchUsers, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, userData?.role, user?.uid]);

  const [activeTab, setActiveTab] = useState<'messages' | 'orders'>('messages');
  
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [userProfilesCache, setUserProfilesCache] = useState<Record<string, any>>({});
  const [text, setText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Derive conversation ID
  const participants = [user?.uid || 'guest', recipientId || 'admin'].sort();
  const conversationId = participants.join('_');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch recipient info for the ACTIVE conversation header
  useEffect(() => {
    if (!recipientId || !user) {
      setRecipientProfile(null);
      return;
    }
    
    // Check cache first
    if (userProfilesCache[recipientId]) {
      setRecipientProfile(userProfilesCache[recipientId]);
      return;
    }
    
    if (recipientId === 'admin') {
      setRecipientProfile({ name: 'إدارة المتجر', role: 'admin' });
    } else {
      const fetchRecipient = async () => {
        try {
          const storeSnap = await getDoc(doc(db, 'storeProfiles', recipientId));
          if (storeSnap.exists()) {
            const data = storeSnap.data();
            setRecipientProfile(data);
            setUserProfilesCache(prev => ({ ...prev, [recipientId]: data }));
          } else {
            const userSnap = await getDoc(doc(db, 'users', recipientId));
            if (userSnap.exists()) {
              const data = userSnap.data();
              setRecipientProfile(data);
              setUserProfilesCache(prev => ({ ...prev, [recipientId]: data }));
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchRecipient();
    }
  }, [recipientId, userProfilesCache]);

  // Fetch names for ALL conversations in the sidebar
  useEffect(() => {
    if (!user) return;
    
    const fetchMissingProfiles = async () => {
      const missingIds = conversations
        .map(c => c.participants.find((p: string) => p !== user?.uid))
        .filter((id): id is string => !!id && id !== 'admin' && !userProfilesCache[id]);

      if (missingIds.length === 0) return;

      const newProfiles = { ...userProfilesCache };
      let changed = false;

      for (const id of missingIds) {
        try {
          const storeSnap = await getDoc(doc(db, 'storeProfiles', id));
          if (storeSnap.exists()) {
            newProfiles[id] = storeSnap.data();
            changed = true;
          } else {
            const userSnap = await getDoc(doc(db, 'users', id));
            if (userSnap.exists()) {
              newProfiles[id] = userSnap.data();
              changed = true;
            }
          }
        } catch (e) {
          console.error(`Error fetching profile for ${id}:`, e);
        }
      }

      if (changed) {
        setUserProfilesCache(newProfiles);
      }
    };

    if (conversations.length > 0) {
      fetchMissingProfiles();
    }
  }, [conversations, user?.uid]);

  // Error Handling removed here and using the imported one from firestoreUtils

  // Listen for messages in this conversation
  useEffect(() => {
    if (!user || !recipientId) {
      setMessages([]);
      return;
    }
    
    setLoading(true);
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      where('participants', 'array-contains', user.uid),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setMessages(msgs);
      setLoading(false);

      // Auto-read messages sent by OTHER person
      let hasNewUnread = false;
      msgs.forEach(m => {
        if (m.senderId !== user.uid && !m.isRead) {
          hasNewUnread = true;
          updateDoc(doc(db, 'messages', m.id), { isRead: true }).catch(e => 
            handleFirestoreError(e, OperationType.UPDATE, `messages/${m.id}`, auth)
          );
        }
      });

      if (conversationId && msgs.length > 0) {
        setDoc(doc(db, 'conversations', conversationId), {
          [`unreadCount.${user.uid}`]: 0
        }, { merge: true }).catch(e => console.warn("Notice resetting unread count (handled):", e?.message || e));
      }
    }, (err) => {
      console.warn("Messages listener notice (handled):", err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId, user]);

  // Listen for ALL conversations
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })));
    }, (err) => {
      console.warn("Conversations listener notice (handled):", err.message);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && selectedImages.length === 0) || !user) return;
    if (recipientId && recipientId === user.uid) {
      toast.error('لا يمكنك إرسال رسالة لنفسك');
      return;
    }

    if (selectionMode) {
      setSelectionMode(false);
    }

    const msgText = text.trim();
    const msgImages = [...selectedImages];
    setText('');
    setSelectedImages([]);
    setIsSending(true);

    try {
      const msgData = {
        text: msgText,
        images: msgImages,
        senderId: user.uid,
        recipientId: recipientId || 'admin',
        conversationId: conversationId,
        participants: participants,
        createdAt: new Date().toISOString(),
        isRead: false
      };

      await addDoc(collection(db, 'messages'), msgData);

      // Update conversation metadata
      await setDoc(doc(db, 'conversations', conversationId), {
        participants: participants,
        lastMessage: msgImages.length > 0 ? (msgText || `أرسل ${msgImages.length} صور`) : msgText,
        lastMessageAt: new Date().toISOString(),
        [`unreadCount.${recipientId || 'admin'}`]: increment(1)
      }, { merge: true });

    } catch (e) {
      console.error("Message send error:", e);
      handleFirestoreError(e, OperationType.WRITE, `messages_in_${conversationId}`, auth);
      setText(msgText);
      setSelectedImages(msgImages);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 10 - selectedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast.error('يمكنك إرسال 10 صور كحد أقصى في المرة الواحدة');
    }

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file as File);
    });
    
    // Reset file input
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSelection = (convId: string) => {
    setSelectedIds(prev => 
      prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId]
    );
  };

  const handleDeleteConversations = async () => {
    if (!user || selectedIds.length === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!user || selectedIds.length === 0) return;
    
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    const toastId = toast.loading('جاري حذف المحادثات...');

    try {
      for (const convId of selectedIds) {
        // 1. Delete messages first - MUST match security rule filters
        const msgsQuery = query(
          collection(db, 'messages'), 
          where('conversationId', '==', convId),
          where('participants', 'array-contains', user.uid)
        );
        const msgsSnap = await getDocs(msgsQuery);
        
        if (!msgsSnap.empty) {
          const batch = writeBatch(db);
          msgsSnap.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }

        // 2. Delete conversation doc
        await deleteDoc(doc(db, 'conversations', convId));
      }

      toast.success('تم حذف المحادثات بنجاح', { id: toastId });
      setSelectedIds([]);
      setSelectionMode(false);
    } catch (error) {
      console.error("Delete Error:", error);
      toast.error('فشل حذف بعض المحادثات', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 m-4">
        <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">يرجى تسجيل الدخول للمراسلة</h2>
        <p className="text-gray-500 mb-6">يجب أن تكون عضواً لتتمكن من الدردشة مع البائعين</p>
        <button onClick={() => window.location.href = '/'} className={`${getThemeClasses('bg')} text-white px-8 py-3 rounded-xl font-bold transition shadow-lg`}>العودة للرئيسية</button>
      </div>
    );
  }

  const allConversations = conversations.sort((a, b) => {
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  const listToRender = allConversations;

  return (
    <div className={`max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col md:flex-row rounded-3xl shadow-2xl border overflow-hidden m-4 font-tajawal relative ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
      
      {/* Sidebar */}
      <div className={`md:w-96 border-l flex flex-col min-h-0 ${isDarkMode ? 'border-slate-800' : 'border-gray-100'} ${recipientId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Top Header Section */}
        <div className="p-4 flex items-center justify-between">
           <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition">
             <h2 className="text-xl font-black text-gray-900 dark:text-white">{userData?.username || userData?.storeName || 'الدردشة'}</h2>
             <ChevronDown className="w-4 h-4 mt-1" />
           </div>
           <div className="flex items-center gap-1">
             {selectionMode ? (
               <button 
                 onClick={() => {
                   setSelectionMode(false);
                   setSelectedIds([]);
                 }}
                 className="p-2 hover:bg-gray-100 rounded-full transition text-gray-500"
               >
                  <X className="w-6 h-6" />
               </button>
             ) : (
               <button 
                 onClick={() => setSelectionMode(true)}
                 className="p-2 hover:bg-gray-100 rounded-full transition text-gray-500"
               >
                  <PenSquare className="w-6 h-6" />
               </button>
             )}
           </div>
        </div>

        {/* Search Bar - "Ask AI or search" */}
        <div className="px-4 pb-4">
           <div className="relative group">
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                 <Search className="w-5 h-5 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input 
                type="text"
                placeholder="ابحث عن مستخدم أو محادثة..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.length > 0) setShowSearchModal(true);
                  else setShowSearchModal(false);
                }}
                onFocus={() => {
                  if (searchTerm.length > 0) setShowSearchModal(true);
                }}
                className="w-full bg-white border border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-[15px] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-100 transition-all placeholder:text-gray-600 font-medium"
              />
              <div className="absolute inset-y-0 left-10 flex items-center">
                 {searchingUsers && (
                   <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                 )}
              </div>
              <div className="absolute inset-y-0 left-4 flex items-center">
                 <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 p-[1.5px] opacity-20 group-focus-within:opacity-100 transition-opacity">
                    <div className="w-full h-full bg-white rounded-full"></div>
                 </div>
              </div>

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showSearchModal && (searchTerm.length >= 2 || userSearchResults.length > 0) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[60] max-h-64 overflow-y-auto custom-scrollbar"
                  >
                    <div className="p-2 border-b border-gray-50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest px-2">نتائج البحث عن المستخدمين</span>
                      <button onClick={() => setShowSearchModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-900 font-black">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {userSearchResults.length > 0 ? (
                      userSearchResults.map(u => (
                        <Link
                          key={u.id}
                          to={`/contact?to=${u.id}`}
                          onClick={() => {
                            setSearchTerm('');
                            setShowSearchModal(false);
                          }}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                            {u.photoURL || u.logoUrl ? (
                              <img src={u.photoURL || u.logoUrl} className="w-full h-full object-cover" />
                            ) : <User className="w-5 h-5 text-gray-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-bold text-gray-900 truncate">
                                {u.name || u.displayName || u.username || u.storeName || 'مستخدم'}
                              </span>
                              {u.role === 'admin' && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-current" />}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${u.role === 'store' ? 'bg-purple-50 text-purple-600' : u.role === 'admin' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                {u.role === 'store' ? 'متجر' : u.role === 'admin' ? 'إدارة' : 'مستخدم'}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))
                    ) : !searchingUsers && searchTerm.length >= 2 ? (
                      <div className="p-6 text-center text-gray-400 text-xs font-bold leading-relaxed">
                        لا توجد متاجر أو مسؤولين بهذا الاسم حالياً.<br/>
                        <span className="text-[10px] opacity-70">يمنع التراسل المباشر بين المستخدمين</span>
                      </div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
        </div>

        {/* Tabs: Messages / Orders */}
        <div className={`flex items-center justify-around border-b mb-2 px-4 ${isDarkMode ? 'border-slate-800' : 'border-gray-100'}`}>
           <button 
             onClick={() => setActiveTab('messages')}
             className={`flex-1 py-4 text-[15px] font-black transition-all relative ${
               activeTab === 'messages' 
                 ? (isDarkMode ? 'text-white border-b-2 border-white' : 'text-gray-900 border-b-2 border-gray-900') 
                 : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
             }`}
           >
             الرسائل
           </button>
           <button 
             onClick={() => setActiveTab('orders')}
             className={`flex-1 py-4 text-[15px] font-black transition-all relative ${
               activeTab === 'orders' 
                 ? (isDarkMode ? 'text-white border-b-2 border-white' : 'text-gray-900 border-b-2 border-gray-900') 
                 : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
             }`}
           >
             الطلبات
           </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {listToRender.filter(c => {
            if (!searchTerm) return true;
            return c.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase());
          }).map(conv => {
            const otherId = conv.participants.find((p: string) => p !== user.uid);
            const isActive = recipientId === otherId;
            const unreadCount = conv.unreadCount?.[user.uid] || 0;
            const isUnread = unreadCount > 0;
            const isSelected = selectedIds.includes(conv.id);
            
            return (
              <div key={conv.id} className="relative flex items-center">
                {selectionMode && (
                  <div className="pr-4 shrink-0">
                    <button 
                      onClick={() => toggleSelection(conv.id)}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                )}
                
                <Link 
                  to={selectionMode ? '#' : `/contact?to=${otherId}`}
                  onClick={async (e) => {
                    if (selectionMode) {
                      e.preventDefault();
                      toggleSelection(conv.id);
                    } else {
                      // Mark conversation as read when clicked
                      try {
                        await setDoc(doc(db, 'conversations', conv.id), {
                          [`unreadCount.${user.uid}`]: 0
                        }, { merge: true });
                        markMessagesAsRead();
                      } catch (err) {
                        console.warn("Notice marking as read (handled):", err);
                      }
                    }
                  }}
                  className={`flex-1 flex items-center gap-4 p-4 transition-all duration-200 group relative ${isActive && !selectionMode ? 'bg-blue-50/40' : isUnread ? 'bg-blue-50/10' : 'hover:bg-gray-50/80'} ${selectionMode && isSelected ? 'bg-red-50/10' : ''}`}
                >
            <div className="relative shrink-0">
              <div className={`w-16 h-16 rounded-full p-[2.5px] ${isUnread ? 'bg-gradient-to-tr from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20' : 'bg-gray-100'}`}>
                 <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white group-hover:scale-105 transition-transform">
                    {(userProfilesCache[otherId || '']?.photoURL || userProfilesCache[otherId || '']?.logoUrl) ? (
                      <img 
                        src={userProfilesCache[otherId || '']?.photoURL || userProfilesCache[otherId || '']?.logoUrl} 
                        className="w-full h-full object-cover" 
                        alt=""
                      />
                    ) : (
                      <User className="text-gray-300 w-8 h-8" />
                    )}
                 </div>
              </div>
              <div className="absolute bottom-0 left-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
            </div>
            
            <div className="flex-1 min-w-0 text-right space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className={`text-[16px] md:text-[17px] ${
                  isUnread 
                    ? (isDarkMode ? 'font-black text-white' : 'font-black text-gray-900') 
                    : (isDarkMode ? 'font-bold text-gray-200' : 'font-bold text-gray-700')
                }`}>
                  {otherId === 'admin' ? 'إدارة المتجر' : (userProfilesCache[otherId || '']?.name || userProfilesCache[otherId || '']?.displayName || userProfilesCache[otherId || '']?.username || userProfilesCache[otherId || '']?.storeName || `مستخدم (${otherId?.slice(0, 5)})`)}
                </span>
                {otherId === 'admin' && <BadgeCheck className="w-4 h-4 text-blue-500 fill-current" />}
              </div>
              <p className={`text-sm truncate leading-relaxed ${
                isUnread 
                  ? (isDarkMode ? 'text-blue-400 font-bold' : 'text-blue-700 font-bold') 
                  : (isDarkMode ? 'text-gray-400 font-medium' : 'text-gray-600 font-medium')
              }`}>
                {conv.lastMessage}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0 pr-2">
               <span className={`text-[10px] font-bold ${
                 isUnread 
                   ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') 
                   : (isDarkMode ? 'text-gray-500 font-semibold' : 'text-gray-400 font-semibold')
               }`}>
                 {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
               </span>
               {isUnread && (
                 <div className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-blue-500/30 animate-in zoom-in duration-300">
                   {unreadCount > 99 ? '+99' : unreadCount}
                 </div>
               )}
            </div>
                
                <button className="opacity-0 lg:group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-100 rounded-full shrink-0">
                  <Camera className="w-5 h-5 text-gray-400" />
                </button>
              </Link>
              </div>
            );
          })}

          {listToRender.length === 0 && (
             <div className="p-10 text-center opacity-20 mt-10">
               <p className="text-[10px] font-black uppercase tracking-[0.2em]">لا توجد محادثات</p>
             </div>
          )}

          <AnimatePresence>
            {selectionMode && selectedIds.length > 0 && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="absolute bottom-6 left-4 pr-4 pl-4 right-4 z-20"
              >
                <button 
                  onClick={handleDeleteConversations}
                  disabled={isDeleting}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-2xl shadow-red-500/30 flex items-center justify-center gap-3 hover:bg-red-700 transition active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  حذف {selectedIds.length} محادثة
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {viewingImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setViewingImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={viewingImage} 
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" 
                alt="Full screen view"
              />
              
              {/* Actions */}
              <div className="absolute top-0 right-0 left-0 p-4 flex justify-between items-center pointer-events-none">
                <div className="flex gap-3 pointer-events-auto">
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = viewingImage;
                      link.download = `yemen_store_img_${Date.now()}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast.success('بدأ التحميل...');
                    }}
                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl text-white transition-all active:scale-95 border border-white/10 flex items-center gap-2"
                    title="تحميل الصورة"
                  >
                    <Download className="w-6 h-6" />
                    <span className="text-sm font-bold">تحميل</span>
                  </button>
                </div>
                <button 
                  onClick={() => setViewingImage(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl text-white transition-all active:scale-95 border border-white/10 pointer-events-auto"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Content */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${!recipientId ? 'hidden md:flex' : 'flex'}`}>
         {recipientId ? (
           <>
             {/* Unified Chat Interface Header */}
              <div className={`p-4 md:p-5 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-10 ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/80 border-gray-100'}`}>
                <div className="flex items-center gap-4">
                   <Link to="/contact" className="md:hidden p-2 hover:bg-gray-100 rounded-full transition">
                     <ArrowRight className="w-5 h-5" />
                   </Link>
                   <div className="relative">
                     <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-200 p-[2px]`}>
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white">
                           {recipientProfile?.logoUrl || recipientProfile?.photoURL ? (
                             <img src={recipientProfile.logoUrl || recipientProfile.photoURL} className="w-full h-full object-cover" />
                           ) : <User className="text-gray-300 w-6 h-6" />}
                        </div>
                     </div>
                     <div className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                   </div>
                   <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-black text-gray-900 dark:text-white text-sm md:text-lg">
                          {recipientProfile?.name || recipientProfile?.displayName || recipientProfile?.username || recipientProfile?.storeName || (recipientId ? `مستخدم (${recipientId.slice(0, 5)})` : 'جاري التحميل...')}
                        </h3>
                        {recipientId === 'admin' && <BadgeCheck className="w-4 h-4 text-blue-500 fill-current" />}
                      </div>
                      <p className="text-[10px] md:text-xs text-blue-600 font-bold flex items-center gap-1">
                        نشط الآن
                      </p>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button className="p-2.5 hover:bg-gray-50 rounded-full transition text-gray-500">
                      <Clock className="w-5 h-5" />
                   </button>
                   <button className="p-2.5 hover:bg-gray-50 rounded-full transition text-gray-500">
                      <Hash className="w-5 h-5" />
                   </button>
                </div>
             </div>

             {/* Chat Bubbles */}
              <div className={`flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-6 ${isDarkMode ? 'bg-slate-950/40' : 'bg-gray-50/20'} custom-scrollbar`}>
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                     <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-10">
                     <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center mb-6 ring-4 ring-blue-50">
                        <MessageSquare className="w-10 h-10 text-blue-500" />
                     </div>
                     <h4 className="text-lg font-black text-gray-900 dark:text-white">أهلاً بك في الدردشة!</h4>
                     <p className="text-xs text-gray-500 mt-2 max-w-xs leading-relaxed">
                       ابدأ المحادثة مع الإدارة أو البائع حالاً، استفسر عن السعر أو الجودة أو موعد التوصيل.
                     </p>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const isMine = m.senderId === user.uid;
                    const showDate = i === 0 || new Date(messages[i-1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                    
                    return (
                      <div key={m.id} className="space-y-4">
                        {showDate && (
                          <div className="flex justify-center my-8 relative">
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-gray-100"></div>
                            <span className={`relative text-[10px] font-black px-4 py-1.5 rounded-full border uppercase tracking-widest ${isDarkMode ? "bg-slate-800 text-gray-200 border-slate-700" : "bg-white text-gray-900 border-gray-100"}`}>

                              {new Date(m.createdAt).toLocaleDateString('ar-YE', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                          </div>
                        )}
                        <motion.div 
                          initial={{ opacity: 0, x: isMine ? -20 : 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}
                        >
                          <div className={`max-w-[85%] md:max-w-[70%] px-5 py-3.5 rounded-3xl shadow-sm relative group ${
                            isMine 
                            ? (isDarkMode ? 'bg-slate-800 text-slate-100 rounded-br-none border border-slate-700' : 'bg-white text-gray-800 rounded-br-none border border-gray-100') 
                            : `${getThemeClasses('bg')} text-white rounded-bl-none shadow-blue-500/10`
                          }`}>
                            {m.images && m.images.length > 0 && (
                              <div className={`grid gap-2 mb-2 ${m.images.length === 1 ? 'grid-cols-1' : m.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {m.images.map((img: string, idx: number) => (
                                  <img 
                                    key={idx} 
                                    src={img} 
                                    alt={`Image ${idx}`} 
                                    className="rounded-xl w-full h-auto max-h-60 object-cover cursor-pointer hover:brightness-90 transition"
                                    onClick={() => setViewingImage(img)}
                                  />
                                ))}
                              </div>
                            )}
                            {m.text && <p className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap">{m.text}</p>}
                            <div className={`flex items-center gap-1.5 mt-2 justify-end ${isMine ? 'text-gray-400' : 'text-white/60'}`}>
                              <span className="text-[10px] font-black">
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isMine && (
                                m.isRead ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" /> : <Check className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
             </div>

             {/* Bottom Action Bar */}
             <div className={`p-2 md:p-6 border-t shrink-0 z-10 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-gray-100 bg-white"}`}>

                {/* Image Previews */}
                {selectedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 animate-in slide-in-from-bottom-2 px-2">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative group w-14 h-14 md:w-20 md:h-20">
                        <img src={img} className="w-full h-full object-cover rounded-xl border border-gray-100" />
                        <button 
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 md:p-1 rounded-full shadow-lg opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                   <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      ref={imageInputRef} 
                      onChange={handleImageSelect} 
                      className="hidden" 
                   />
                   <button 
                      type="button" 
                      onClick={() => imageInputRef.current?.click()}
                      className="p-3 text-gray-400 hover:bg-gray-50 rounded-full transition shrink-0"
                   >
                      <Camera className="w-6 h-6" />
                   </button>
                   <div className="flex-1 relative">
                      <textarea 
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                        placeholder="اكتب رسالتك بلهجتك اليمنية..."
                        className={`w-full ${isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500" : "bg-gray-50 border-gray-100 text-slate-900 placeholder-slate-400"} border rounded-2xl px-6 py-3.5 text-[15px] resize-none outline-none transition-all max-h-32`}

                        rows={1}
                      />
                   </div>
                   <button 
                      type="submit"
                      disabled={isSending || (!text.trim() && selectedImages.length === 0)}
                      className={`${getThemeClasses('bg')} text-white p-4 rounded-2xl shadow-xl transition-all duration-300 active:scale-95 disabled:grayscale disabled:opacity-20 flex items-center justify-center shrink-0 hover:brightness-110 shadow-blue-500/20`}
                   >
                      <Send className="w-6 h-6 rtl:-scale-x-100" />
                   </button>
                </form>
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-6">
              <div className="w-32 h-32 rounded-full bg-gray-50 flex items-center justify-center ring-8 ring-white shadow-inner">
                 <MessageSquare className="w-16 h-16 text-gray-200" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">رسائلك تجتمع هنا</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  اختر محادثة من القائمة الجانبية للبدء.
                </p>
              </div>
           </div>
         )}
      </div>

      {/* Bottom Padding for selection mode on mobile */}
      <div className="md:hidden h-20" />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center space-y-6"
            >
              <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-2">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2">تأكيد الحذف</h3>
                <p className="text-gray-500 font-medium">
                  هل أنت متأكد من حذف <span className="font-bold text-red-600">{selectedIds.length}</span> محادثة؟
                  هذا الإجراء سيحذف كافة الرسائل نهائياً.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmDelete}
                  className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition shadow-xl shadow-red-200 active:scale-95"
                >
                  نعم، احذف المحادثات
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full bg-gray-50 text-gray-500 font-black py-4 rounded-2xl hover:bg-gray-100 transition active:scale-95"
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
      `}</style>
    </div>
  );
}
