import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  X,
  Send,
  ShoppingCart,
  ExternalLink,
  RotateCcw,
  Maximize2,
  Copy,
  Check,
  CheckCircle,
  Ticket,
  Store,
  ChevronLeft,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import {
  askStoreAssistant,
  type AssistantAction,
  type AssistantComparisonRow,
  type AssistantProduct,
  type AssistantPromoHint,
  type AssistantStatItem,
} from '../services/geminiService';
import { buildBaseProductForCart } from '../lib/variantUtils';
import { safeCopyText } from '../lib/deviceSafe';

interface DrawerMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  products?: AssistantProduct[];
  suggestedQuestions?: string[];
  actions?: AssistantAction[];
  comparisonRows?: AssistantComparisonRow[];
  promoHints?: AssistantPromoHint[];
  statsHighlight?: AssistantStatItem[];
}

const LAUNCHPAD_PROMPTS = [
  { label: 'الأكثر طلباً الآن', q: 'ما هي المنتجات الأكثر طلباً؟' },
  { label: 'عروض وتخفيضات اليوم', q: 'عرض أحدث العروض والخصومات' },
  { label: 'أكواد وكوبونات الخصم', q: 'هل يوجد كوبونات خصم نشطة؟' },
  { label: 'مقارنة أفضل المنتجات', q: 'قارن لي بين أفضل المنتجات المتوفرة' },
  { label: 'خيارات اقتصادية موثقة', q: 'ما هي أرخص المنتجات المتوفرة من متاجر موثقة؟' },
  { label: 'سياسة العربون والحجز', q: 'كيف يعمل الحجز المسبق بالعربون والاستلام؟' },
];

let aiCatalogCache: {
  products: any[];
  promos: AssistantPromoHint[];
  categories: Array<{ name: string; slug?: string }>;
  fetchedAt: number;
} | null = null;

export default function AiConciergeDrawer() {
  const {
    isAiDrawerOpen,
    aiDrawerInitialQuery,
    closeAiDrawer,
    settings,
    getThemeClasses,
    user,
    login,
    addToCart,
    openCartDrawer,
  } = useAppContext();
  const navigate = useNavigate();

  const currentStoreName = settings?.storeName || 'متجر محيط';
  const [messages, setMessages] = useState<DrawerMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `أهلاً بك في ${currentStoreName}. اسألني عن أي منتج، ميزانية محددة، مقارنة بين خيارين، أكواد الخصم الفعالة، أو تفاصيل العربون والتوصيل وسأجيبك فوراً من بيانات المتجر الحية.`,
      suggestedQuestions: [
        'ما هي المنتجات الأكثر طلباً؟',
        'عرض أحدث العروض والخصومات',
        'هل يوجد كوبونات خصم نشطة؟',
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<any[]>(() => aiCatalogCache?.products || []);
  const [catalogLoaded, setCatalogLoaded] = useState(() => Boolean(aiCatalogCache));
  const [activePromos, setActivePromos] = useState<AssistantPromoHint[]>(() => aiCatalogCache?.promos || []);
  const [categories, setCategories] = useState<Array<{ name: string; slug?: string }>>(() => aiCatalogCache?.categories || []);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const lastAutoQueryRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAiDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAiDrawer();
    };
    window.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
    };
  }, [isAiDrawerOpen, closeAiDrawer]);

  useEffect(() => {
    if (!isAiDrawerOpen) return;
    if (aiCatalogCache && Date.now() - aiCatalogCache.fetchedAt < 180_000) {
      setCatalogProducts(aiCatalogCache.products);
      setActivePromos(aiCatalogCache.promos);
      setCategories(aiCatalogCache.categories);
      setCatalogLoaded(true);
      return;
    }

    let cancelled = false;
    Promise.all([
      getDocs(query(collection(db, 'products'), where('status', '==', 'active'), limit(90))),
      getDocs(query(collection(db, 'promoCodes'), where('active', '==', true), limit(20))),
      getDocs(query(collection(db, 'categories'), limit(30))),
    ])
      .then(([prodSnap, promoSnap, catSnap]) => {
        if (cancelled) return;
        const prods = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const nowMs = Date.now();
        const promos = promoSnap.docs
          .map((d) => ({ id: d.id, ...d.data() as any }))
          .filter((c) => !c.expiresAt || new Date(c.expiresAt).getTime() >= nowMs)
          .filter((c) => c.maxUses === null || c.maxUses === undefined || Number(c.usedCount || 0) < Number(c.maxUses))
          .map((c) => ({
            code: String(c.code || ''),
            discountType: (c.discountType || 'percent') as 'percent' | 'fixed',
            discountValue: Number(c.discountValue || 0),
            minOrderAmount: Number(c.minOrderAmount || 0),
            expiresAt: c.expiresAt || '',
          }))
          .filter((c) => c.code);
        const cats = catSnap.docs.map((d) => ({
          name: String(d.data()?.name || ''),
          slug: String(d.data()?.slug || ''),
        }));

        aiCatalogCache = { products: prods, promos, categories: cats, fetchedAt: Date.now() };
        setCatalogProducts(prods);
        setActivePromos(promos);
        setCategories(cats);
        setCatalogLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setCatalogLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAiDrawerOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, isAiDrawerOpen]);

  const sendQuery = async (rawText: string) => {
    const clean = rawText.trim();
    if (!clean || isThinking) return;

    const userMsg: DrawerMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: clean,
    };

    const nextHistory = [...messages, userMsg]
      .filter((m) => m.id !== 'welcome')
      .slice(-8)
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        text: m.text,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await askStoreAssistant({
        message: clean,
        history: nextHistory,
        catalogProducts,
        storeSettings: settings,
        activePromos,
        categories,
      });

      const botMsg: DrawerMessage = {
        id: `a_${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        products: res.products || [],
        suggestedQuestions: res.suggestedQuestions || [],
        actions: res.actions || [],
        comparisonRows: res.comparisonRows || [],
        promoHints: res.promoHints || [],
        statsHighlight: res.statsHighlight || [],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: 'تعذر معالجة الطلب حالياً. يرجى المحاولة مرة أخرى.',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    if (!isAiDrawerOpen || !catalogLoaded || !aiDrawerInitialQuery) return;
    if (lastAutoQueryRef.current === aiDrawerInitialQuery) return;
    lastAutoQueryRef.current = aiDrawerInitialQuery;
    void sendQuery(aiDrawerInitialQuery);
  }, [isAiDrawerOpen, catalogLoaded, aiDrawerInitialQuery]);

  useEffect(() => {
    if (!isAiDrawerOpen) {
      lastAutoQueryRef.current = '';
    }
  }, [isAiDrawerOpen]);

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: `بدأت محادثة جديدة في ${currentStoreName}. كيف أساعدك الآن؟`,
        suggestedQuestions: [
          'ما هي المنتجات الأكثر طلباً؟',
          'عرض أحدث العروض والخصومات',
          'هل يوجد كوبونات خصم نشطة؟',
        ],
      },
    ]);
    lastAutoQueryRef.current = '';
  };

  const handleCopyCoupon = async (code: string) => {
    const ok = await safeCopyText(code);
    try {
      sessionStorage.setItem('yemen_pending_coupon', code);
    } catch {}
    if (ok) {
      setCopiedCode(code);
      toast.success(`تم نسخ الكود ${code} وتجهيزه للسلة`);
      window.setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleAddProduct = (p: AssistantProduct) => {
    if (!user) {
      login();
      return;
    }
    const baseProd = buildBaseProductForCart({
      id: p.id,
      title: p.title,
      price: p.price,
      image: p.image,
      category: p.category,
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      ownerVerified: p.ownerVerified,
      deliveryFee: p.deliveryFee,
      noDelivery: p.noDelivery,
      stock: p.stock,
      depositAmount: p.depositAmount,
    });
    addToCart(baseProd, 1);
    toast.success(`أُضيف «${p.title}» إلى السلة`);
  };

  if (!isAiDrawerOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 flex justify-end"
      dir="rtl"
      onClick={closeAiDrawer}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        aria-label="المستشار الذكي الفوري"
        className="w-full max-w-lg h-full bg-white dark:bg-[#131519] border-r border-[#E5E2DA] dark:border-[#232730] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getThemeClasses('bg')}`}>
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-extrabold text-[#111214] dark:text-[#F4F4F2] truncate">
                مستشار {currentStoreName}
              </h2>
              <p className="text-[11px] font-medium text-[#5C5B57] dark:text-zinc-400 tabular-nums truncate">
                {catalogProducts.length > 0
                  ? `${catalogProducts.length} منتج نشط · ${activePromos.length} كوبون فعال`
                  : 'استشارة تسوق ذكية فورية'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              title="محادثة جديدة"
              aria-label="محادثة جديدة"
              className="w-8 h-8 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] hover:text-[#111214] dark:hover:text-white flex items-center justify-center transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                closeAiDrawer();
                navigate('/contact?to=ai_assistant');
              }}
              title="توسيع في شاشة كاملة"
              aria-label="توسيع في شاشة كاملة"
              className="w-8 h-8 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] hover:text-[#111214] dark:hover:text-white flex items-center justify-center transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={closeAiDrawer}
              aria-label="إغلاق المستشار"
              className="w-8 h-8 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#5C5B57] hover:text-[#111214] dark:hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages Scroll Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Launchpad Quick Prompts if fresh */}
          {messages.length <= 1 && (
            <div className="grid grid-cols-2 gap-2">
              {LAUNCHPAD_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => sendQuery(item.q)}
                  className="p-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:border-[#111214]/40 dark:hover:border-zinc-500 text-right transition-colors"
                >
                  <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block line-clamp-1">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 line-clamp-1 mt-0.5 block">
                    {item.q}
                  </span>
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex flex-col gap-2 ${isUser ? 'items-start' : 'items-end'}`}>
                <div
                  className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? `${getThemeClasses('bg')} font-semibold`
                      : 'bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2]'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Live Stats */}
                {!isUser && msg.statsHighlight && msg.statsHighlight.length > 0 && (
                  <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {msg.statsHighlight.map((st, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519]"
                      >
                        <span className="text-[10px] text-[#5C5B57] dark:text-zinc-400 block">{st.label}</span>
                        <span className="text-xs sm:text-sm font-extrabold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                          {st.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Promo Coupons */}
                {!isUser && msg.promoHints && msg.promoHints.length > 0 && (
                  <div className="w-full space-y-2">
                    {msg.promoHints.map((promo) => (
                      <div
                        key={promo.code}
                        className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/25 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <span className="font-mono font-extrabold text-xs text-emerald-800 dark:text-emerald-300 tracking-wider">
                              {promo.code}
                            </span>
                            <span className="text-[11px] font-bold text-[#111214] dark:text-[#F4F4F2] tabular-nums">
                              · خصم {promo.discountType === 'percent' ? `${promo.discountValue}%` : `${promo.discountValue.toLocaleString()} ر.ي`}
                            </span>
                          </div>
                          {promo.minOrderAmount > 0 && (
                            <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400 mt-0.5 tabular-nums">
                              الحد الأدنى للطلب: {promo.minOrderAmount.toLocaleString()} ر.ي
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCoupon(promo.code)}
                          className="min-h-[32px] px-2.5 py-1 rounded-md bg-white dark:bg-[#131519] border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
                        >
                          {copiedCode === promo.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode === promo.code ? 'نُسخ' : 'نسخ'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Side-by-Side Comparison */}
                {!isUser && msg.comparisonRows && msg.comparisonRows.length > 0 && (
                  <div className="w-full rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-x-auto">
                    <table className="w-full text-[11px] text-right">
                      <thead>
                        <tr className="border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#5C5B57] dark:text-zinc-400">
                          <th className="py-2 px-2.5 font-bold">المعيار</th>
                          {msg.comparisonRows.map((c) => (
                            <th key={c.id} className="py-2 px-2.5 font-extrabold text-[#111214] dark:text-[#F4F4F2] max-w-[110px] truncate">
                              {c.title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2DA] dark:divide-[#232730] tabular-nums">
                        <tr>
                          <td className="py-2 px-2.5 font-semibold text-[#5C5B57] dark:text-zinc-400">السعر</td>
                          {msg.comparisonRows.map((c) => (
                            <td key={c.id} className={`py-2 px-2.5 font-extrabold ${getThemeClasses('price')}`}>
                              {Number(c.price || 0).toLocaleString()} ر.ي
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-2.5 font-semibold text-[#5C5B57] dark:text-zinc-400">المتجر</td>
                          {msg.comparisonRows.map((c) => (
                            <td key={c.id} className="py-2 px-2.5 font-medium truncate max-w-[110px]">
                              {c.storeName} {c.verified ? '✓' : ''}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-2.5 font-semibold text-[#5C5B57] dark:text-zinc-400">الاستلام</td>
                          {msg.comparisonRows.map((c) => (
                            <td key={c.id} className="py-2 px-2.5 text-[#5C5B57] dark:text-zinc-300">
                              {c.deliveryLabel}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Product Cards */}
                {!isUser && msg.products && msg.products.length > 0 && (
                  <div className="w-full space-y-2">
                    {msg.products.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] flex items-center gap-3"
                      >
                        <div className="w-14 h-14 rounded-md overflow-hidden border border-[#E5E2DA] dark:border-[#232730] bg-[#EFEDE6] dark:bg-[#1C1F26] shrink-0 flex items-center justify-center">
                          {p.image ? (
                            <img src={p.image} alt={p.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-[#5C5B57] opacity-40" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] text-[#5C5B57] dark:text-zinc-400">
                            <Store className="w-3 h-3 shrink-0" />
                            <span className="truncate">{p.ownerName || 'متجر'}</span>
                            {p.ownerVerified && <CheckCircle className={`w-3 h-3 shrink-0 ${getThemeClasses('verified')}`} />}
                          </div>
                          <p className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] line-clamp-1">
                            {p.title}
                          </p>
                          <div className="flex items-baseline gap-2 tabular-nums">
                            <span className={`text-xs font-extrabold ${getThemeClasses('price')}`}>
                              {Number(p.price || 0).toLocaleString()} ر.ي
                            </span>
                            {Number(p.originalPrice || 0) > Number(p.price || 0) && (
                              <span className="text-[10px] line-through text-[#5C5B57] dark:text-zinc-500">
                                {Number(p.originalPrice).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!p.noDelivery && (
                            <button
                              type="button"
                              onClick={() => handleAddProduct(p)}
                              title="أضف للسلة"
                              aria-label="أضف للسلة"
                              className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              closeAiDrawer();
                              navigate(`/product/${p.id}`);
                            }}
                            title="عرض المنتج"
                            aria-label="عرض المنتج"
                            className="w-8 h-8 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-[#111214] dark:text-[#F4F4F2] flex items-center justify-center"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Deep Action Buttons */}
                {!isUser && msg.actions && msg.actions.length > 0 && (
                  <div className="w-full flex flex-wrap gap-1.5">
                    {msg.actions.map((act, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          closeAiDrawer();
                          if (act.to === '/cart') {
                            openCartDrawer();
                          } else {
                            navigate(act.to);
                          }
                        }}
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[11px] font-bold text-[#111214] dark:text-[#F4F4F2] inline-flex items-center gap-1 transition-colors"
                      >
                        <span>{act.label}</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Suggested Follow-Ups */}
                {!isUser && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                  <div className="w-full flex flex-wrap gap-1.5 pt-0.5">
                    {msg.suggestedQuestions.map((sq, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => sendQuery(sq)}
                        className="px-2.5 py-1 rounded-md border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] hover:border-[#111214]/40 dark:hover:border-zinc-500 text-[11px] font-semibold text-[#5C5B57] dark:text-zinc-300 hover:text-[#111214] dark:hover:text-white transition-colors"
                      >
                        {sq}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isThinking && (
            <div className="flex justify-end">
              <div className="px-3.5 py-2 rounded-xl border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-xs font-semibold text-[#5C5B57] dark:text-zinc-400">
                جاري البحث في الكتالوج والرد...
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuery(input);
          }}
          className="p-3.5 border-t border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اسأل عن منتج، ميزانية، كوبون أو مقارنة..."
            className="flex-1 min-h-[42px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-xs sm:text-sm font-medium text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57] dark:placeholder:text-zinc-500 outline-none focus:border-[#111214] dark:focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            aria-label="إرسال"
            className={`min-h-[42px] px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors ${getThemeClasses('bg')} ${getThemeClasses('hover')}`}
          >
            <Send className="w-4 h-4 rtl:-scale-x-100" />
          </button>
        </form>
      </aside>
    </div>
  );
}
