import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, ArrowRight, User, Hash, Clock, Check, CheckCheck, 
  Loader2, Mic, Search, PenSquare, ChevronDown, Camera, BadgeCheck, Trash2, 
  X, Download, Maximize2, Sparkles, Bot, ShoppingBag, CheckCircle, ExternalLink, Store 
} from 'lucide-react';
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
import { askStoreAssistant } from '../services/geminiService';
import { runStandaloneStoreAi } from '../services/storeAiEngine';

export default function Contact() {
  const { userData, user, getThemeClasses, isAdmin, isStore, settings, markMessagesAsRead, isDarkMode, openLoginModal } = useAppContext();
  const currentStoreName = settings?.storeName || 'يمن ستور';
  const aiAssistantName = `مساعد ${currentStoreName} الذكي`;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRecipientId = searchParams.get('to');
  const recipientId = (rawRecipientId && user && rawRecipientId === user.uid) ? null : rawRecipientId;
  const [recipientProfile, setRecipientProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

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

  // Load active products from store so the AI assistant can reference the real-time catalog
  useEffect(() => {
    const q = query(collection(db, 'products'), where('status', '==', 'active'), limit(80));
    const unsubscribe = onSnapshot(q, (snap) => {
      const prods = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      setCatalogProducts(prods);
    }, (err) => {
      console.warn('Catalog products sync notice:', err.message);
    });
    return () => unsubscribe();
  }, []);

  // Search users functionality
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) {
        setUserSearchResults([]);
        return;
      }

      setSearchingUsers(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(20));
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        const filtered = results.filter(u => {
          if (u.id === user?.uid) return false;
          
          const match = (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
          
          if (!match) return false;

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
  const [guestMessages, setGuestMessages] = useState<any[]>(() => [
    {
      id: 'guest_welcome',
      text: `مرحباً بك في متجر ${currentStoreName}! ✨\nأنا مساعدك الذكي المعتمد المدعوم بنموذج Google Gemini. أنا هنا لمساعدتك في البحث عن أي منتج، معرفة الأسعار، أو الاستفسار عن الشحن والتوصيل والحجز المسبق في المتجر. بماذا تود البدء اليوم؟`,
      productCards: [],
      suggestedQuestions: [
        'ما هي المنتجات الأكثر طلباً؟',
        'ابحث لي عن هاتف',
        'كيف يعمل نظام دفع العربون والحجز؟'
      ],
      senderId: 'ai_assistant',
      createdAt: new Date().toISOString()
    }
  ]);
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
  }, [messages, guestMessages, isAiThinking]);

  // Fetch recipient info for the ACTIVE conversation header
  useEffect(() => {
    if (!recipientId || (!user && recipientId !== 'ai_assistant')) {
      setRecipientProfile(null);
      return;
    }

    if (recipientId === 'ai_assistant') {
      setRecipientProfile({
        name: aiAssistantName,
        role: 'ai',
        displayName: `${aiAssistantName} (Gemini)`,
        isOnline: true
      });
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
    if (!text.trim() && selectedImages.length === 0) return;
    if (!user && recipientId !== 'ai_assistant') return;
    if (user && recipientId && recipientId === user.uid) {
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

    // Guest Chat with AI Assistant
    if (!user && recipientId === 'ai_assistant') {
      const userGuestMsg = {
        id: `guest_u_${Date.now()}`,
        text: msgText,
        senderId: 'guest',
        createdAt: new Date().toISOString()
      };
      setGuestMessages(prev => [...prev, userGuestMsg]);
      setIsAiThinking(true);
      try {
        const aiHistory = guestMessages.slice(-6).map(m => ({
          role: (m.senderId === 'ai_assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
          text: m.text || ''
        }));

        const aiRes = await askStoreAssistant({
          message: msgText,
          history: aiHistory,
          catalogProducts: catalogProducts,
          storeSettings: settings
        });

        const aiReplyMsg = {
          id: `guest_ai_${Date.now()}`,
          text: aiRes.reply || 'أهلاً بك! يمكنك تصفح المنتجات المتوفرة في المتجر حالياً.',
          productCards: aiRes.products || [],
          suggestedQuestions: aiRes.suggestedQuestions || [],
          senderId: 'ai_assistant',
          createdAt: new Date().toISOString()
        };
        setGuestMessages(prev => [...prev, aiReplyMsg]);
      } catch (err) {
        const fallback = runStandaloneStoreAi(msgText, catalogProducts, settings);
        setGuestMessages(prev => [...prev, {
          id: `guest_ai_${Date.now()}`,
          text: fallback.reply,
          productCards: fallback.products || [],
          suggestedQuestions: fallback.suggestedQuestions || [],
          senderId: 'ai_assistant',
          createdAt: new Date().toISOString()
        }]);
      } finally {
        setIsAiThinking(false);
        setIsSending(false);
      }
      return;
    }

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

      // If talking to Gemini AI Assistant, trigger AI response
      if (recipientId === 'ai_assistant') {
        setIsAiThinking(true);
        try {
          const aiHistory = messages.slice(-6).map(m => ({
            role: (m.senderId === 'ai_assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
            text: m.text || ''
          }));

          const aiRes = await askStoreAssistant({
            message: msgText,
            history: aiHistory,
            catalogProducts: catalogProducts,
            storeSettings: settings
          });

          await addDoc(collection(db, 'messages'), {
            text: aiRes.reply || 'أهلاً بك! يمكنك تصفح المنتجات المتوفرة في المتجر حالياً.',
            productCards: aiRes.products || [],
            suggestedQuestions: aiRes.suggestedQuestions || [],
            senderId: 'ai_assistant',
            recipientId: user.uid,
            conversationId: conversationId,
            participants: participants,
            createdAt: new Date().toISOString(),
            isRead: true
          });

          await setDoc(doc(db, 'conversations', conversationId), {
            participants: participants,
            lastMessage: aiRes.reply || 'رد المساعد الذكي',
            lastMessageAt: new Date().toISOString(),
            [`unreadCount.${user.uid}`]: 0
          }, { merge: true });
        } catch (aiErr) {
          console.error("AI Assistant error:", aiErr);
          const fallback = runStandaloneStoreAi(msgText, catalogProducts, settings);
          await addDoc(collection(db, 'messages'), {
            text: fallback.reply,
            productCards: fallback.products || [],
            suggestedQuestions: fallback.suggestedQuestions || [],
            senderId: 'ai_assistant',
            recipientId: user.uid,
            conversationId: conversationId,
            participants: participants,
            createdAt: new Date().toISOString(),
            isRead: true
          });
        } finally {
          setIsAiThinking(false);
        }
      }

    } catch (e) {
      console.error("Message send error:", e);
      handleFirestoreError(e, OperationType.WRITE, `messages_in_${conversationId}`, auth);
      setText(msgText);
      setSelectedImages(msgImages);
    } finally {
      setIsSending(false);
    }
  };

  const sendQuickMessage = async (quickPrompt: string) => {
    if (!quickPrompt.trim() || isSending || isAiThinking) return;
    if (!user && recipientId !== 'ai_assistant') return;

    const promptText = quickPrompt.trim();

    // Guest AI
    if (!user && recipientId === 'ai_assistant') {
      setIsSending(true);
      const userGuestMsg = {
        id: `guest_q_${Date.now()}`,
        text: promptText,
        senderId: 'guest',
        createdAt: new Date().toISOString()
      };
      setGuestMessages(prev => [...prev, userGuestMsg]);
      setIsAiThinking(true);
      try {
        const aiHistory = guestMessages.slice(-6).map(m => ({
          role: (m.senderId === 'ai_assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
          text: m.text || ''
        }));
        const aiRes = await askStoreAssistant({
          message: promptText,
          history: aiHistory,
          catalogProducts: catalogProducts,
          storeSettings: settings
        });
        const aiReplyMsg = {
          id: `guest_ai_${Date.now()}`,
          text: aiRes.reply,
          productCards: aiRes.products || [],
          suggestedQuestions: aiRes.suggestedQuestions || [],
          senderId: 'ai_assistant',
          createdAt: new Date().toISOString()
        };
        setGuestMessages(prev => [...prev, aiReplyMsg]);
      } catch (err) {
        setGuestMessages(prev => [...prev, {
          id: `guest_err_${Date.now()}`,
          text: 'أعتذر، حدث تأخير بسيط. يمكنك إعادة السؤال أو كتابة استفسارك.',
          senderId: 'ai_assistant',
          createdAt: new Date().toISOString()
        }]);
      } finally {
        setIsAiThinking(false);
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
    try {
      const msgData = {
        text: promptText,
        senderId: user.uid,
        recipientId: recipientId || 'admin',
        conversationId: conversationId,
        participants: participants,
        createdAt: new Date().toISOString(),
        isRead: false
      };

      await addDoc(collection(db, 'messages'), msgData);

      await setDoc(doc(db, 'conversations', conversationId), {
        participants: participants,
        lastMessage: promptText,
        lastMessageAt: new Date().toISOString(),
        [`unreadCount.${recipientId || 'admin'}`]: increment(1)
      }, { merge: true });

      if (recipientId === 'ai_assistant') {
        setIsAiThinking(true);
        const aiHistory = messages.slice(-6).map(m => ({
          role: (m.senderId === 'ai_assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
          text: m.text || ''
        }));

        const aiRes = await askStoreAssistant({
          message: promptText,
          history: aiHistory,
          catalogProducts: catalogProducts,
          storeSettings: settings
        });

        await addDoc(collection(db, 'messages'), {
          text: aiRes.reply,
          productCards: aiRes.products || [],
          suggestedQuestions: aiRes.suggestedQuestions || [],
          senderId: 'ai_assistant',
          recipientId: user.uid,
          conversationId: conversationId,
          participants: participants,
          createdAt: new Date().toISOString(),
          isRead: true
        });

        await setDoc(doc(db, 'conversations', conversationId), {
          participants: participants,
          lastMessage: aiRes.reply,
          lastMessageAt: new Date().toISOString(),
          [`unreadCount.${user.uid}`]: 0
        }, { merge: true });
        setIsAiThinking(false);
      }
    } catch (err) {
      console.error("sendQuickMessage error:", err);
    } finally {
      setIsSending(false);
      setIsAiThinking(false);
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

  if (!user && recipientId !== 'ai_assistant') {
    return (
      <div className="w-full max-w-xl mx-auto my-auto p-6 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center text-white shadow-xs">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white">مركز المحادثات ومستشار المتجر</h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm font-medium max-w-sm mx-auto leading-relaxed">
            تحدث مباشرة مع مستشار {currentStoreName} الذكي للبحث عن أي منتج، معرفة الأسعار، أو الاستفسار عن الشحن والتوصيل.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-2">
          <Link
            to="/contact?to=ai_assistant"
            className="flex-1 px-6 py-3.5 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold text-sm shadow-xs flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Bot className="w-4 h-4" />
            بدء محادثة مستشار المتجر
          </Link>
          <button
            onClick={() => openLoginModal()}
            className="flex-1 px-6 py-3.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-neutral-900 dark:text-neutral-200 rounded-xl font-bold text-sm active:scale-95 transition border border-neutral-200 dark:border-slate-700"
          >
            تسجيل الدخول للمراسلة
          </button>
        </div>
      </div>
    );
  }

  const allConversations = conversations.sort((a, b) => {
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  const listToRender = allConversations;
  const activeMessages = (!user && recipientId === 'ai_assistant') ? guestMessages : messages;

  return (
    <div className={`w-full max-w-6xl mx-auto h-full flex flex-col md:flex-row md:rounded-2xl md:border overflow-hidden min-h-0 font-tajawal relative ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-neutral-200 shadow-xs'}`}>
      
      {/* Sidebar */}
      <div className={`md:w-96 border-l flex flex-col min-h-0 ${isDarkMode ? 'border-slate-800' : 'border-neutral-200'} ${recipientId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Top Header Section */}
        <div className="p-4 flex items-center justify-between border-b border-neutral-100 dark:border-slate-800">
           <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition">
             <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{userData?.username || userData?.storeName || 'المحادثات'}</h2>
             <ChevronDown className="w-4 h-4 text-neutral-500" />
           </div>
           <div className="flex items-center gap-1">
             {selectionMode ? (
               <button 
                 onClick={() => {
                   setSelectionMode(false);
                   setSelectedIds([]);
                 }}
                 className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-lg transition text-neutral-600"
               >
                  <X className="w-5 h-5" />
               </button>
             ) : (
               <button 
                 onClick={() => setSelectionMode(true)}
                 className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-lg transition text-neutral-600"
                 title="تحديد لحذف المحادثات"
               >
                  <PenSquare className="w-5 h-5" />
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {/* Pinned Store Consultant */}
          <Link
            to="/contact?to=ai_assistant"
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 relative group ${
              recipientId === 'ai_assistant'
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                : isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-900'
            }`}
          >
            <div className="relative shrink-0">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                recipientId === 'ai_assistant' ? 'bg-white/10 text-white' : 'bg-neutral-900 text-white'
              }`}>
                <Bot className="w-5 h-5" />
              </div>
              <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
            </div>

            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className={`text-sm font-bold truncate ${recipientId === 'ai_assistant' ? 'text-white' : (isDarkMode ? 'text-white' : 'text-neutral-900')}`}>
                  {aiAssistantName}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  recipientId === 'ai_assistant'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-200 dark:bg-slate-700 text-neutral-800 dark:text-neutral-200'
                }`}>
                  مستشار المتجر
                </span>
              </div>
              <p className={`text-xs truncate ${recipientId === 'ai_assistant' ? 'text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                البحث عن المنتجات والأسعار والتوصيل
              </p>
            </div>
          </Link>

          {listToRender.filter(c => {
            if (c.participants.includes('ai_assistant')) return false;
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
              <div className={`p-3.5 sm:p-4 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-10 ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-neutral-200 shadow-2xs'}`}>
                <div className="flex items-center gap-3">
                   <Link to="/contact" className="md:hidden p-1.5 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-lg transition text-neutral-700 dark:text-neutral-300">
                     <ArrowRight className="w-5 h-5" />
                   </Link>
                   <div className="relative">
                     {recipientId === 'ai_assistant' ? (
                       <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                         <Bot className="w-5 h-5 text-white" />
                       </div>
                     ) : (
                       <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center">
                          {recipientProfile?.logoUrl || recipientProfile?.photoURL ? (
                            <img src={recipientProfile.logoUrl || recipientProfile.photoURL} className="w-full h-full object-cover" alt="" />
                          ) : <User className="text-neutral-400 w-5 h-5" />}
                       </div>
                     )}
                     <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                   </div>
                   <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-neutral-900 dark:text-white text-sm sm:text-base leading-tight">
                          {recipientId === 'ai_assistant' ? aiAssistantName : (recipientProfile?.name || recipientProfile?.displayName || recipientProfile?.username || recipientProfile?.storeName || (recipientId ? `مستخدم (${recipientId.slice(0, 5)})` : 'جاري التحميل...'))}
                        </h3>
                        {recipientId === 'ai_assistant' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-slate-700">
                            مستشار المتجر
                          </span>
                        ) : recipientId === 'admin' ? (
                          <BadgeCheck className="w-4 h-4 text-emerald-600 fill-current" />
                        ) : null}
                      </div>
                      <p className={`text-[11px] font-medium ${recipientId === 'ai_assistant' ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-500'}`}>
                        {recipientId === 'ai_assistant' ? 'متصل دائماً • الإجابة عن منتجات وأسعار المتجر' : 'نشط الآن'}
                      </p>
                   </div>
                </div>
                <div className="flex items-center gap-1.5">
                   {recipientId === 'ai_assistant' ? (
                     <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-slate-700 hidden sm:inline-flex items-center gap-1.5">
                       خاص بالمتجر فقط
                     </span>
                   ) : (
                     <button className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-lg transition text-neutral-500">
                        <Clock className="w-4 h-4" />
                     </button>
                   )}
                </div>
              </div>

              {/* Chat Bubbles */}
              <div className={`flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-6 ${isDarkMode ? 'bg-slate-950/40' : 'bg-gray-50/20'} overscroll-contain touch-pan-y custom-scrollbar`}>
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                     <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : activeMessages.length === 0 ? (
                  recipientId === 'ai_assistant' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 max-w-lg mx-auto">
                       <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-600 p-1 shadow-xl shadow-indigo-500/25 mb-4 animate-in zoom-in duration-300">
                          <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center text-white">
                             <Sparkles className="w-10 h-10 text-yellow-300 animate-pulse" />
                          </div>
                       </div>
                       <h4 className="text-xl font-black text-gray-900 dark:text-white mb-2">مرحباً بك! أنا {aiAssistantName} 🤖✨</h4>
                       <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                         أنا هنا لمساعدتك في كل ما يخص المتجر: اسألني عن أي منتج، قارن الأسعار، استفسر عن خدمات التوصيل، أو شروط الحجز المسبق ودفع العربون.
                       </p>

                       <div className="mt-6 w-full space-y-2 text-right">
                         <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 block px-1">أسئلة يمكنك طرحها بنقرة واحدة:</span>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                           {[
                             '🔍 ابحث لي عن عسل يمني أصلي',
                             '📱 ما هي أحدث الهواتف المتوفرة؟',
                             '📦 كيف يعمل نظام الحجز المسبق والعربون؟',
                             '🛡️ ما هي سياسة الضمان والتوصيل في المنصة؟'
                           ].map((prompt, pIdx) => (
                             <button
                               key={pIdx}
                               type="button"
                               onClick={() => sendQuickMessage(prompt)}
                               className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 shadow-sm hover:shadow transition text-xs font-bold text-gray-800 dark:text-gray-200 text-right active:scale-95 flex items-center gap-2 group"
                             >
                               <span className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition">✦</span>
                               <span className="truncate">{prompt}</span>
                             </button>
                           ))}
                         </div>
                       </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10">
                       <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center mb-6 ring-4 ring-blue-50">
                          <MessageSquare className="w-10 h-10 text-blue-500" />
                       </div>
                       <h4 className="text-lg font-black text-gray-900 dark:text-white">أهلاً بك في الدردشة!</h4>
                       <p className="text-xs text-gray-500 mt-2 max-w-xs leading-relaxed">
                         ابدأ المحادثة مع الإدارة أو البائع حالاً، استفسر عن السعر أو الجودة أو موعد التوصيل.
                       </p>
                    </div>
                  )
                ) : (
                  activeMessages.map((m, i) => {
                    const currentUid = user?.uid || 'guest';
                    const isMine = m.senderId === currentUid;
                    const isAi = m.senderId === 'ai_assistant';
                    const showDate = i === 0 || new Date(activeMessages[i-1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                    
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
                          <div className={`max-w-[92%] sm:max-w-[85%] md:max-w-[75%] px-4 py-3 sm:px-5 sm:py-4 rounded-2xl shadow-xs relative group ${
                            isMine 
                            ? (isDarkMode ? 'bg-white text-neutral-900 rounded-br-xs' : 'bg-neutral-900 text-white rounded-br-xs') 
                            : isAi
                              ? (isDarkMode ? 'bg-slate-900 text-slate-100 rounded-bl-xs border border-slate-800' : 'bg-neutral-50 text-neutral-900 rounded-bl-xs border border-neutral-200')
                              : (isDarkMode ? 'bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700' : 'bg-neutral-100 text-neutral-900 rounded-bl-xs border border-neutral-200')
                          }`}>
                            {/* Consultant Header inside bubble */}
                            {isAi && (
                              <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-neutral-200 dark:border-slate-800 text-xs font-bold text-neutral-600 dark:text-neutral-400">
                                <Bot className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                                <span>{aiAssistantName}</span>
                              </div>
                            )}

                            {m.images && m.images.length > 0 && (
                              <div className={`grid gap-2 mb-2 ${m.images.length === 1 ? 'grid-cols-1' : m.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {m.images.map((img: string, idx: number) => (
                                  <img 
                                    key={idx} 
                                    src={img} 
                                    alt={`Image ${idx}`} 
                                    className="rounded-xl w-full h-auto max-h-60 object-cover cursor-pointer hover:brightness-95 transition border border-black/5"
                                    onClick={() => setViewingImage(img)}
                                  />
                                ))}
                              </div>
                            )}
                            {m.text && <p className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{m.text}</p>}

                            {/* Product Cards Attachment from AI Store Assistant */}
                            {m.productCards && Array.isArray(m.productCards) && m.productCards.length > 0 && (
                              <div className="mt-3.5 pt-3 border-t border-neutral-200 dark:border-slate-800 space-y-2.5">
                                <div className="flex items-center justify-between text-xs font-bold text-neutral-900 dark:text-white">
                                  <span className="flex items-center gap-1.5">
                                    <ShoppingBag className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                                    منتجات مقترحة من المتجر ({m.productCards.length}):
                                  </span>
                                  <span className="text-[11px] text-neutral-500 font-normal">اضغط للمعاينة</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {m.productCards.map((p: any) => (
                                    <div
                                      key={p.id}
                                      onClick={() => navigate(`/product/${p.id}`)}
                                      className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 text-neutral-900 dark:text-white border border-neutral-200 dark:border-slate-800 hover:border-neutral-400 transition cursor-pointer group/card text-right shadow-2xs"
                                    >
                                      {/* Thumbnail image */}
                                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 dark:bg-slate-800 shrink-0 border border-neutral-200 dark:border-slate-700 relative">
                                        {p.image || (p.images && p.images[0]) ? (
                                          <img
                                            src={p.image || p.images[0]}
                                            alt={p.title}
                                            className="w-full h-full object-cover group-hover/card:scale-105 transition duration-200"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                            <ShoppingBag className="w-5 h-5" />
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium block truncate">
                                          {p.category || 'منتج'}
                                        </span>
                                        <h5 className="font-bold text-xs truncate leading-tight group-hover/card:text-neutral-950 dark:group-hover/card:text-white">
                                          {p.title}
                                        </h5>
                                        <div className="flex items-center justify-between mt-1">
                                          <span className="font-black text-xs text-neutral-950 dark:text-white tabular-nums">
                                            {Number(p.price || 0).toLocaleString()} <span className="text-[9px] font-normal text-neutral-500">ر.ي</span>
                                          </span>
                                          <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
                                            عرض ←
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Suggested Questions Chips */}
                            {m.suggestedQuestions && Array.isArray(m.suggestedQuestions) && m.suggestedQuestions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-neutral-200 dark:border-slate-800">
                                {m.suggestedQuestions.map((sq: string, sqIdx: number) => (
                                  <button
                                    key={sqIdx}
                                    type="button"
                                    onClick={() => sendQuickMessage(sq)}
                                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-slate-700 hover:bg-neutral-100 transition active:scale-95 text-right"
                                  >
                                    {sq}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className={`flex items-center gap-1.5 mt-2 justify-end ${
                              isMine 
                                ? (isDarkMode ? 'text-neutral-500' : 'text-neutral-300') 
                                : 'text-neutral-400'
                            }`}>
                              <span className="text-[10px] font-medium tabular-nums">
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

                {/* AI Thinking / Typing Indicator */}
                {isAiThinking && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-end"
                  >
                    <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 text-neutral-800 dark:text-neutral-200 flex items-center gap-3 shadow-2xs">
                      <Loader2 className="w-4 h-4 text-neutral-700 dark:text-neutral-300 animate-spin" />
                      <div>
                        <p className="text-xs font-bold">{aiAssistantName} يبحث في المتجر...</p>
                        <span className="text-[10px] text-neutral-500">جاري صياغة الرد وتحضير المنتجات</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Action Bar */}
              <div className={`p-3 sm:p-4 border-t shrink-0 z-10 space-y-2 pb-[max(12px,env(safe-area-inset-bottom))] ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-neutral-200 bg-white"}`}>
                
                {/* AI Quick Prompts Ribbon (Above Input) */}
                {recipientId === 'ai_assistant' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                    <span className="text-[11px] font-bold text-neutral-400 shrink-0">اقتراحات:</span>
                    {[
                      'ابحث لي عن هاتف',
                      'عسل يمني أصلي',
                      'شروط الحجز والعربون',
                      'ضمان وشحن المنصة'
                    ].map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => sendQuickMessage(chip)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-slate-700 hover:bg-neutral-200 shrink-0 transition active:scale-95"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                {/* Image Previews */}
                {selectedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 animate-in slide-in-from-bottom-2 px-1">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative group w-14 h-14 md:w-20 md:h-20">
                        <img src={img} className="w-full h-full object-cover rounded-xl border border-neutral-200" alt="" />
                        <button 
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-1 -right-1 bg-neutral-900 text-white p-0.5 md:p-1 rounded-full shadow-xs transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-3">
                   <button 
                      type="button" 
                      onClick={() => imageInputRef.current?.click()}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition shrink-0 border ${
                        isDarkMode 
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700' 
                          : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200'
                      }`}
                      title="إرفاق صور"
                   >
                      <Camera className="w-5 h-5" />
                   </button>
                   <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      ref={imageInputRef} 
                      onChange={handleImageSelect} 
                      className="hidden" 
                   />
                   <div className="flex-1 relative">
                      <textarea 
                        rows={1}
                        value={text}
                        onChange={e => {
                          setText(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                        placeholder={
                          recipientId === 'ai_assistant'
                            ? "اسأل مستشار المتجر عن أي منتج أو خدمة..."
                            : "اكتب رسالتك هنا..."
                        }
                        className={`w-full min-h-[44px] max-h-32 leading-normal ${
                          isDarkMode 
                            ? "bg-slate-800/90 border-slate-700 text-white placeholder-slate-400 focus:border-slate-500" 
                            : "bg-neutral-50 border-neutral-300 text-neutral-950 placeholder-neutral-400 focus:bg-white focus:border-neutral-900"
                        } border rounded-xl px-4 py-2.5 text-sm md:text-[15px] resize-none outline-none transition-all`}
                        disabled={isAiThinking}
                      />
                   </div>
                   <button 
                      type="submit"
                      disabled={isSending || isAiThinking || (!text.trim() && selectedImages.length === 0)}
                      className={`w-11 h-11 rounded-xl shadow-xs transition-all duration-200 active:scale-95 flex items-center justify-center shrink-0 ${
                        isSending || isAiThinking || (!text.trim() && selectedImages.length === 0)
                          ? (isDarkMode ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-neutral-100 text-neutral-400 border border-neutral-200')
                          : 'bg-neutral-900 hover:bg-black text-white'
                      }`}
                   >
                      {isAiThinking ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5 rtl:-scale-x-100" />
                      )}
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
