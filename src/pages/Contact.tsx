import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, ArrowRight, User, Clock, Check, CheckCheck,
  Loader2, Search, PenSquare, ChevronDown, Camera, BadgeCheck, Trash2,
  X, Download, Bot, ShoppingBag
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
  const { userData, user, getThemeClasses, settings, markMessagesAsRead, openLoginModal } = useAppContext();
  const currentStoreName = settings?.storeName || 'يمن ستور';
  const aiAssistantName = `مستشار ${currentStoreName}`;
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

  // Clear unread messages badge when opening Contact
  useEffect(() => {
    if (user) {
      markMessagesAsRead();
    }
  }, [user]);

  // Load active products so the store assistant references the real-time catalog
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
        const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));

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
        console.error('Search error:', err);
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
      text: `مرحباً بك في ${currentStoreName}.\nأنا مستشار المتجر المختص لمساعدتك في البحث عن المنتجات، معرفة الأسعار، والاستفسار عن التوصيل والحجز المسبق. بماذا تود البدء اليوم؟`,
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

  const participants = [user?.uid || 'guest', recipientId || 'admin'].sort();
  const conversationId = participants.join('_');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, guestMessages, isAiThinking]);

  // Fetch recipient info
  useEffect(() => {
    if (!recipientId || (!user && recipientId !== 'ai_assistant')) {
      setRecipientProfile(null);
      return;
    }

    if (recipientId === 'ai_assistant') {
      setRecipientProfile({
        name: aiAssistantName,
        role: 'ai',
        displayName: aiAssistantName,
        isOnline: true
      });
      return;
    }

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

  // Fetch profiles for sidebar conversations
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

  // Listen for messages in active conversation
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
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      setMessages(msgs);
      setLoading(false);

      msgs.forEach(m => {
        if (m.senderId !== user.uid && !m.isRead) {
          updateDoc(doc(db, 'messages', m.id), { isRead: true }).catch(e =>
            handleFirestoreError(e, OperationType.UPDATE, `messages/${m.id}`, auth)
          );
        }
      });

      if (conversationId && msgs.length > 0) {
        setDoc(doc(db, 'conversations', conversationId), {
          [`unreadCount.${user.uid}`]: 0
        }, { merge: true }).catch(e => console.warn('Notice resetting unread count:', e?.message || e));
      }
    }, (err) => {
      console.warn('Messages listener notice:', err.message);
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
      setConversations(snapshot.docs.map(d => ({ id: d.id, ...d.data() as any })));
    }, (err) => {
      console.warn('Conversations listener notice:', err.message);
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

    // Guest Chat with Store Consultant
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
      } catch {
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

      await setDoc(doc(db, 'conversations', conversationId), {
        participants: participants,
        lastMessage: msgImages.length > 0 ? (msgText || `أرسل ${msgImages.length} صور`) : msgText,
        lastMessageAt: new Date().toISOString(),
        [`unreadCount.${recipientId || 'admin'}`]: increment(1)
      }, { merge: true });

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
            lastMessage: aiRes.reply || 'رد مستشار المتجر',
            lastMessageAt: new Date().toISOString(),
            [`unreadCount.${user.uid}`]: 0
          }, { merge: true });
        } catch (aiErr) {
          console.error('Assistant error:', aiErr);
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
      console.error('Message send error:', e);
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
      } catch {
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
      console.error('sendQuickMessage error:', err);
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

        await deleteDoc(doc(db, 'conversations', convId));
      }

      toast.success('تم حذف المحادثات بنجاح', { id: toastId });
      setSelectedIds([]);
      setSelectionMode(false);
    } catch (error) {
      console.error('Delete Error:', error);
      toast.error('فشل حذف بعض المحادثات', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user && recipientId !== 'ai_assistant') {
    return (
      <div className="w-full max-w-xl mx-auto my-auto p-6 flex flex-col items-center justify-center text-center space-y-6" dir="rtl">
        <div className={`w-14 h-14 rounded-lg ${getThemeClasses('bg')} flex items-center justify-center text-white`}>
          <Bot className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-[#111214] dark:text-[#F4F4F2]">
            مركز المحادثات ومستشار المتجر
          </h2>
          <p className="text-[#5C5B57] dark:text-zinc-400 text-sm font-medium max-w-sm mx-auto leading-relaxed">
            تحدث مباشرة مع مستشار {currentStoreName} للبحث عن أي منتج، معرفة الأسعار، أو الاستفسار عن الشحن والتوصيل.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-1">
          <Link
            to="/contact?to=ai_assistant"
            className={`flex-1 min-h-[44px] px-5 py-3 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition`}
          >
            <Bot className="w-4 h-4" />
            <span>بدء محادثة مستشار المتجر</span>
          </Link>
          <button
            onClick={() => openLoginModal()}
            className="flex-1 min-h-[44px] px-5 py-3 bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#131519] dark:hover:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] rounded-lg font-bold text-sm transition border border-[#E5E2DA] dark:border-[#232730]"
          >
            تسجيل الدخول للمراسلة
          </button>
        </div>
      </div>
    );
  }

  const allConversations = [...conversations].sort((a, b) => {
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  const listToRender = allConversations;
  const activeMessages = (!user && recipientId === 'ai_assistant') ? guestMessages : messages;

  return (
    <div
      className="w-full max-w-6xl mx-auto h-full flex flex-col md:flex-row md:rounded-lg md:border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden min-h-0 relative"
      dir="rtl"
    >
      {/* Sidebar Pane */}
      <div className={`md:w-80 lg:w-96 border-l border-[#E5E2DA] dark:border-[#232730] flex flex-col min-h-0 bg-white dark:bg-[#131519] ${recipientId ? 'hidden md:flex' : 'flex'}`}>

        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216]">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2]">
              {userData?.username || userData?.storeName || 'المحادثات'}
            </h2>
            <ChevronDown className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
          </div>
          <div className="flex items-center gap-1">
            {selectionMode ? (
              <button
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedIds([]);
                }}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] rounded-lg transition text-[#5C5B57] dark:text-zinc-400"
                aria-label="إلغاء التحديد"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setSelectionMode(true)}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] rounded-lg transition text-[#5C5B57] dark:text-zinc-400"
                title="تحديد لحذف المحادثات"
                aria-label="تحديد المحادثات"
              >
                <PenSquare className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-[#E5E2DA] dark:border-[#232730]">
          <div className="relative">
            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />
            </div>
            <input
              type="text"
              placeholder="ابحث عن متجر أو محادثة..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                if (e.target.value.length > 0) setShowSearchModal(true);
                else setShowSearchModal(false);
              }}
              onFocus={() => {
                if (searchTerm.length > 0) setShowSearchModal(true);
              }}
              className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg py-2 pr-10 pl-9 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-[#131519] focus:border-[#111214] dark:focus:border-zinc-400 transition text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57]/70 dark:placeholder:text-zinc-500 font-medium"
            />
            {searchingUsers && (
              <div className="absolute inset-y-0 left-3 flex items-center">
                <Loader2 className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400 animate-spin" />
              </div>
            )}

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showSearchModal && (searchTerm.length >= 2 || userSearchResults.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#131519] rounded-lg shadow-xl border border-[#E5E2DA] dark:border-[#232730] overflow-hidden z-[60] max-h-64 overflow-y-auto"
                >
                  <div className="px-3 py-2 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#111214] dark:text-[#F4F4F2]">نتائج البحث عن المتاجر</span>
                    <button
                      onClick={() => setShowSearchModal(false)}
                      className="p-1 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] rounded-md text-[#5C5B57] dark:text-zinc-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {userSearchResults.length > 0 ? (
                    <div className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                      {userSearchResults.map(u => (
                        <Link
                          key={u.id}
                          to={`/contact?to=${u.id}`}
                          onClick={() => {
                            setSearchTerm('');
                            setShowSearchModal(false);
                          }}
                          className="flex items-center gap-3 p-3 hover:bg-[#FAF9F6] dark:hover:bg-[#1C1F26] transition"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[#EFEDE6] dark:bg-[#101216] flex items-center justify-center overflow-hidden border border-[#E5E2DA] dark:border-[#232730] shrink-0">
                            {u.photoURL || u.logoUrl ? (
                              <img src={u.photoURL || u.logoUrl} className="w-full h-full object-cover" alt="" />
                            ) : <User className="w-4 h-4 text-[#5C5B57] dark:text-zinc-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] truncate">
                                {u.name || u.displayName || u.username || u.storeName || 'مستخدم'}
                              </span>
                              {u.role === 'admin' && <BadgeCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />}
                            </div>
                            <span className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-400">
                              {u.role === 'store' ? 'متجر' : u.role === 'admin' ? 'إدارة' : 'مستخدم'}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : !searchingUsers && searchTerm.length >= 2 ? (
                    <div className="p-5 text-center text-[#5C5B57] dark:text-zinc-400 text-xs font-medium leading-relaxed">
                      لا توجد متاجر أو مسؤولين بهذا الاسم حالياً.
                      <span className="block text-[10px] opacity-75 mt-1">يمنع التراسل المباشر بين المستخدمين</span>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Flush Underline Tabs */}
        <div className="flex items-center border-b border-[#E5E2DA] dark:border-[#232730] px-2">
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 min-h-[44px] py-2.5 text-xs font-bold transition border-b-2 ${
              activeTab === 'messages'
                ? 'border-[#111214] dark:border-[#F4F4F2] text-[#111214] dark:text-[#F4F4F2]'
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
            }`}
          >
            الرسائل
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 min-h-[44px] py-2.5 text-xs font-bold transition border-b-2 ${
              activeTab === 'orders'
                ? 'border-[#111214] dark:border-[#F4F4F2] text-[#111214] dark:text-[#F4F4F2]'
                : 'border-transparent text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-[#F4F4F2]'
            }`}
          >
            الطلبات
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E5E2DA] dark:divide-[#232730]">
          {/* Pinned Store Consultant */}
          <div className="p-2">
            <Link
              to="/contact?to=ai_assistant"
              className={`flex items-center gap-3 p-3 rounded-lg border transition relative ${
                recipientId === 'ai_assistant'
                  ? `${getThemeClasses('bg')} text-white border-transparent`
                  : 'bg-[#FAF9F6] dark:bg-[#101216] border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                recipientId === 'ai_assistant'
                  ? 'bg-white/15 text-white'
                  : 'bg-[#111214] dark:bg-[#1C1F26] text-white'
              }`}>
                <Bot className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-between gap-1.5 mb-0.5">
                  <span className="text-xs sm:text-sm font-bold truncate">
                    {aiAssistantName}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                    recipientId === 'ai_assistant'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2]'
                  }`}>
                    مستشار المتجر
                  </span>
                </div>
                <p className={`text-xs truncate ${
                  recipientId === 'ai_assistant' ? 'text-white/80' : 'text-[#5C5B57] dark:text-zinc-400'
                }`}>
                  البحث عن المنتجات والأسعار والتوصيل
                </p>
              </div>
            </Link>
          </div>

          {user && listToRender.filter(c => {
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
                  <div className="pr-3 shrink-0">
                    <button
                      onClick={() => toggleSelection(conv.id)}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center transition ${
                        isSelected
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'border-[#E5E2DA] dark:border-[#232730] hover:border-[#111214]'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
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
                      try {
                        await setDoc(doc(db, 'conversations', conv.id), {
                          [`unreadCount.${user.uid}`]: 0
                        }, { merge: true });
                        markMessagesAsRead();
                      } catch (err) {
                        console.warn('Notice marking as read:', err);
                      }
                    }
                  }}
                  className={`flex-1 flex items-center gap-3 p-3.5 transition ${
                    isActive && !selectionMode
                      ? 'bg-[#FAF9F6] dark:bg-[#101216]'
                      : isUnread
                        ? 'bg-[#FAF9F6]/60 dark:bg-[#101216]/60'
                        : 'hover:bg-[#FAF9F6] dark:hover:bg-[#101216]'
                  }`}
                >
                  <div className="w-11 h-11 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center overflow-hidden shrink-0">
                    {(userProfilesCache[otherId || '']?.photoURL || userProfilesCache[otherId || '']?.logoUrl) ? (
                      <img
                        src={userProfilesCache[otherId || '']?.photoURL || userProfilesCache[otherId || '']?.logoUrl}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <User className="text-[#5C5B57] dark:text-zinc-400 w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-right space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm truncate ${
                        isUnread
                          ? 'font-bold text-[#111214] dark:text-[#F4F4F2]'
                          : 'font-bold text-[#111214]/85 dark:text-[#F4F4F2]/85'
                      }`}>
                        {otherId === 'admin'
                          ? 'إدارة المتجر'
                          : (userProfilesCache[otherId || '']?.name || userProfilesCache[otherId || '']?.displayName || userProfilesCache[otherId || '']?.username || userProfilesCache[otherId || '']?.storeName || `مستخدم (${otherId?.slice(0, 5)})`)}
                      </span>
                      {otherId === 'admin' && <BadgeCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
                    </div>
                    <p className={`text-xs truncate ${
                      isUnread
                        ? 'text-[#111214] dark:text-[#F4F4F2] font-bold'
                        : 'text-[#5C5B57] dark:text-zinc-400 font-medium'
                    }`}>
                      {conv.lastMessage}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums">
                      {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {isUnread && (
                      <span className={`min-w-[20px] h-5 px-1.5 rounded-md ${getThemeClasses('bg')} flex items-center justify-center text-[10px] font-bold text-white tabular-nums`}>
                        {unreadCount > 99 ? '+99' : unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}

          {user && listToRender.length === 0 && (
            <div className="p-8 text-center text-[#5C5B57] dark:text-zinc-400">
              <p className="text-xs font-medium">لا توجد محادثات أخرى</p>
            </div>
          )}

          <AnimatePresence>
            {selectionMode && selectedIds.length > 0 && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="p-3 bg-white dark:bg-[#131519] border-t border-[#E5E2DA] dark:border-[#232730]"
              >
                <button
                  onClick={handleDeleteConversations}
                  disabled={isDeleting}
                  className="w-full min-h-[44px] bg-rose-600 text-white py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>حذف {selectedIds.length} محادثة</span>
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
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setViewingImage(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative max-w-5xl w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={viewingImage}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                alt="عرض الصورة"
              />

              <div className="absolute top-0 right-0 left-0 p-4 flex justify-between items-center pointer-events-none">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = viewingImage;
                    link.download = `store_img_${Date.now()}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success('بدأ التحميل...');
                  }}
                  className="min-h-[44px] px-4 py-2 bg-black/70 hover:bg-black text-white rounded-lg transition border border-white/15 flex items-center gap-2 pointer-events-auto text-xs font-bold"
                  title="تحميل الصورة"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل</span>
                </button>
                <button
                  onClick={() => setViewingImage(null)}
                  className="w-11 h-11 bg-black/70 hover:bg-black rounded-lg text-white transition border border-white/15 flex items-center justify-center pointer-events-auto"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Content Pane */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#131519] ${!recipientId ? 'hidden md:flex' : 'flex'}`}>
        {recipientId ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <Link
                  to="/contact"
                  className="md:hidden w-10 h-10 flex items-center justify-center hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] rounded-lg transition text-[#111214] dark:text-[#F4F4F2] shrink-0"
                  aria-label="العودة للمحادثات"
                >
                  <ArrowRight className="w-5 h-5" />
                </Link>

                {recipientId === 'ai_assistant' ? (
                  <div className={`w-10 h-10 rounded-lg ${getThemeClasses('bg')} text-white flex items-center justify-center shrink-0`}>
                    <Bot className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] overflow-hidden flex items-center justify-center shrink-0">
                    {recipientProfile?.logoUrl || recipientProfile?.photoURL ? (
                      <img src={recipientProfile.logoUrl || recipientProfile.photoURL} className="w-full h-full object-cover" alt="" />
                    ) : <User className="text-[#5C5B57] dark:text-zinc-400 w-5 h-5" />}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display font-bold text-[#111214] dark:text-[#F4F4F2] text-sm sm:text-base leading-tight truncate">
                      {recipientId === 'ai_assistant'
                        ? aiAssistantName
                        : (recipientProfile?.name || recipientProfile?.displayName || recipientProfile?.username || recipientProfile?.storeName || (recipientId ? `مستخدم (${recipientId.slice(0, 5)})` : 'جاري التحميل...'))}
                    </h3>
                    {recipientId === 'ai_assistant' ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] shrink-0">
                        مستشار المتجر
                      </span>
                    ) : recipientId === 'admin' ? (
                      <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : null}
                  </div>
                  <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 truncate">
                    {recipientId === 'ai_assistant' ? 'الإجابة الفورية عن منتجات وأسعار المتجر' : 'محادثة مباشرة'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {recipientId === 'ai_assistant' ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-400 border border-[#E5E2DA] dark:border-[#232730] hidden sm:inline-flex">
                    خاص بالمتجر فقط
                  </span>
                ) : (
                  <span className="p-2 text-[#5C5B57] dark:text-zinc-400">
                    <Clock className="w-4 h-4" />
                  </span>
                )}
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-5 bg-[#FAF9F6]/60 dark:bg-[#0A0B0D]/40 overscroll-contain touch-pan-y">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className={`w-7 h-7 ${getThemeClasses('text')} animate-spin`} />
                </div>
              ) : activeMessages.length === 0 ? (
                recipientId === 'ai_assistant' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 max-w-lg mx-auto">
                    <div className={`w-14 h-14 rounded-lg ${getThemeClasses('bg')} flex items-center justify-center text-white mb-4`}>
                      <Bot className="w-7 h-7" />
                    </div>
                    <h4 className="font-display text-lg font-bold text-[#111214] dark:text-[#F4F4F2] mb-2">
                      مرحباً بك في {aiAssistantName}
                    </h4>
                    <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 leading-relaxed font-medium">
                      اسألني عن أي منتج متوفر في المتجر، قارن الأسعار، أو استفسر عن التوصيل وشروط الحجز المسبق ودفع العربون.
                    </p>

                    <div className="mt-6 w-full space-y-2 text-right">
                      <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 block px-1">
                        أسئلة يمكنك طرحها بنقرة واحدة:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          'ابحث لي عن عسل يمني أصلي',
                          'ما هي أحدث الهواتف المتوفرة؟',
                          'كيف يعمل نظام الحجز المسبق والعربون؟',
                          'ما هي سياسة الضمان والتوصيل في المنصة؟'
                        ].map((prompt, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => sendQuickMessage(prompt)}
                            className="min-h-[44px] p-3 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] hover:border-[#111214] dark:hover:border-zinc-500 transition text-xs font-bold text-[#111214] dark:text-[#F4F4F2] text-right flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{prompt}</span>
                            <ArrowRight className="w-3.5 h-3.5 rotate-180 text-[#5C5B57] dark:text-zinc-400 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8">
                    <div className="w-14 h-14 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center mb-4">
                      <MessageSquare className="w-6 h-6 text-[#5C5B57] dark:text-zinc-400" />
                    </div>
                    <h4 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2]">أهلاً بك في المحادثة</h4>
                    <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
                      ابدأ المحادثة مع الإدارة أو البائع حالاً للاستفسار عن السعر أو المواصفات أو موعد التوصيل.
                    </p>
                  </div>
                )
              ) : (
                activeMessages.map((m, i) => {
                  const currentUid = user?.uid || 'guest';
                  const isMine = m.senderId === currentUid;
                  const isAi = m.senderId === 'ai_assistant';
                  const showDate = i === 0 || new Date(activeMessages[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();

                  return (
                    <div key={m.id} className="space-y-4">
                      {showDate && (
                        <div className="flex justify-center my-6 relative">
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-[#E5E2DA] dark:bg-[#232730]"></div>
                          <span className="relative text-[10px] font-bold px-3 py-1 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] dark:text-zinc-400">
                            {new Date(m.createdAt).toLocaleDateString('ar-YE', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[92%] sm:max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-lg relative ${
                            isMine
                              ? `${getThemeClasses('bg')} text-white`
                              : isAi
                                ? 'bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730]'
                                : 'bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730]'
                          }`}
                        >
                          {isAi && (
                            <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-[#E5E2DA] dark:border-[#232730] text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400">
                              <Bot className="w-3.5 h-3.5" />
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
                                  className="rounded-md w-full h-auto max-h-60 object-cover cursor-pointer hover:opacity-95 transition border border-black/10"
                                  onClick={() => setViewingImage(img)}
                                />
                              ))}
                            </div>
                          )}

                          {m.text && <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{m.text}</p>}

                          {/* Product Cards from Store Consultant */}
                          {m.productCards && Array.isArray(m.productCards) && m.productCards.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#E5E2DA] dark:border-[#232730] space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                                <span className="flex items-center gap-1.5">
                                  <ShoppingBag className="w-3.5 h-3.5 text-[#5C5B57] dark:text-zinc-400" />
                                  <span>منتجات مقترحة ({m.productCards.length})</span>
                                </span>
                                <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-normal">اضغط للمعاينة</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {m.productCards.map((p: any) => (
                                  <div
                                    key={p.id}
                                    onClick={() => navigate(`/product/${p.id}`)}
                                    className="flex items-center gap-2.5 p-2 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] hover:border-[#111214] dark:hover:border-zinc-500 transition cursor-pointer text-right"
                                  >
                                    <div className="w-12 h-12 rounded-md overflow-hidden bg-white dark:bg-[#131519] shrink-0 border border-[#E5E2DA] dark:border-[#232730]">
                                      {p.image || (p.images && p.images[0]) ? (
                                        <img
                                          src={p.image || p.images[0]}
                                          alt={p.title}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#5C5B57] dark:text-zinc-400">
                                          <ShoppingBag className="w-4 h-4" />
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 font-medium block truncate">
                                        {p.category || 'منتج'}
                                      </span>
                                      <h5 className="font-bold text-xs truncate leading-tight">
                                        {p.title}
                                      </h5>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="font-bold text-xs tabular-nums">
                                          {Number(p.price || 0).toLocaleString()} <span className="text-[9px] font-normal text-[#5C5B57] dark:text-zinc-400">ر.ي</span>
                                        </span>
                                        <span className="text-[10px] font-bold text-[#5C5B57] dark:text-zinc-300">
                                          عرض
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Suggested Questions */}
                          {m.suggestedQuestions && Array.isArray(m.suggestedQuestions) && m.suggestedQuestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5 pt-2.5 border-t border-[#E5E2DA] dark:border-[#232730]">
                              {m.suggestedQuestions.map((sq: string, sqIdx: number) => (
                                <button
                                  key={sqIdx}
                                  type="button"
                                  onClick={() => sendQuickMessage(sq)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition text-right"
                                >
                                  {sq}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className={`flex items-center gap-1.5 mt-2 justify-end ${
                            isMine ? 'text-white/75' : 'text-[#5C5B57] dark:text-zinc-400'
                          }`}>
                            <span className="text-[10px] font-medium tabular-nums">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMine && (
                              m.isRead ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  );
                })
              )}

              {/* Thinking Indicator */}
              {isAiThinking && (
                <div className="flex justify-end">
                  <div className="p-3 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-[#5C5B57] dark:text-zinc-400" />
                    <div>
                      <p className="text-xs font-bold">{aiAssistantName} يبحث في المتجر...</p>
                      <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400">جاري تجهيز الرد والمنتجات</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer Bar */}
            <div className="p-3 sm:p-4 border-t border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] shrink-0 z-10 space-y-2 pb-[max(12px,env(safe-area-inset-bottom))]">
              {recipientId === 'ai_assistant' && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                  <span className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 shrink-0">اقتراحات:</span>
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
                      className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] border border-[#E5E2DA] dark:border-[#232730] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] shrink-0 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {selectedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-1">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative w-14 h-14">
                      <img src={img} className="w-full h-full object-cover rounded-md border border-[#E5E2DA] dark:border-[#232730]" alt="" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-[#111214] text-white w-5 h-5 rounded-full flex items-center justify-center"
                        aria-label="حذف الصورة"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-2.5">
                {recipientId !== 'ai_assistant' && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-11 h-11 rounded-lg flex items-center justify-center transition shrink-0 border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-300 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26]"
                    title="إرفاق صور"
                    aria-label="إرفاق صور"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                )}
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
                        ? 'اسأل مستشار المتجر عن أي منتج أو خدمة...'
                        : 'اكتب رسالتك هنا...'
                    }
                    className="w-full min-h-[44px] max-h-32 leading-normal bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] placeholder-[#5C5B57]/70 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-[#131519] focus:border-[#111214] dark:focus:border-zinc-400 rounded-lg px-4 py-2.5 text-sm resize-none outline-none transition"
                    disabled={isAiThinking}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSending || isAiThinking || (!text.trim() && selectedImages.length === 0)}
                  className={`w-11 h-11 rounded-lg transition flex items-center justify-center shrink-0 ${
                    isSending || isAiThinking || (!text.trim() && selectedImages.length === 0)
                      ? 'bg-[#EFEDE6] dark:bg-[#1C1F26] text-[#5C5B57]/50 dark:text-zinc-600 border border-[#E5E2DA] dark:border-[#232730]'
                      : `${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white`
                  }`}
                  aria-label="إرسال"
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
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4 bg-[#FAF9F6]/50 dark:bg-[#0A0B0D]/30">
            <div className="w-16 h-16 rounded-xl bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-[#5C5B57] dark:text-zinc-400" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">رسائلك تجتمع هنا</h3>
              <p className="text-[#5C5B57] dark:text-zinc-400 text-xs max-w-xs mx-auto leading-relaxed">
                اختر محادثة من القائمة الجانبية أو ابدأ الحديث مع مستشار المتجر.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] rounded-xl shadow-xl w-full max-w-sm p-6 text-center space-y-5"
            >
              <div className="mx-auto w-12 h-12 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">تأكيد الحذف</h3>
                <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium leading-relaxed">
                  هل أنت متأكد من حذف <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{selectedIds.length}</span> محادثة؟ هذا الإجراء سيحذف كافة الرسائل نهائياً.
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={confirmDelete}
                  className="flex-1 min-h-[44px] bg-rose-600 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-rose-700 transition"
                >
                  نعم، احذف
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs py-2.5 rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
