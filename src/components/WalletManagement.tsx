import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Wallet, Plus, Trash2, Edit, Copy, ShieldCheck, MapPin, Smartphone, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../AppContext';

export interface MerchantWallet {
  id: string;
  name: string;
  accountNumber: string;
  accountName: string;
  transferType: 'subscriber' | 'point';
  pointDetails?: string;
  isActive: boolean;
  notes?: string;
}

const PRESET_WALLETS = [
  { name: 'الكريمي كاش (Kuraimi)' },
  { name: 'محفظة جوالي (Jawali)' },
  { name: 'محفظة جيب (Jeeb)' },
  { name: 'محفظة فلوسك (Floosak)' },
  { name: 'ون كاش (OneCash)' },
  { name: 'موبايل موني (Mobile Money)' },
  { name: 'حساب بنكي / صرافة أخرى' }
];

export default function WalletManagement({ merchantId }: { merchantId: string }) {
  const { getThemeClasses } = useAppContext();
  const [wallets, setWallets] = useState<MerchantWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingWallet, setEditingWallet] = useState<MerchantWallet | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingWalletId, setDeletingWalletId] = useState<string | null>(null);

  const [form, setForm] = useState<MerchantWallet>({
    id: '',
    name: 'الكريمي كاش (Kuraimi)',
    accountNumber: '',
    accountName: '',
    transferType: 'subscriber',
    pointDetails: '',
    isActive: true,
    notes: ''
  });

  useEffect(() => {
    if (!merchantId) return;
    const fetchWallets = async () => {
      try {
        setLoading(true);
        const ref = doc(db, 'storeWallets', merchantId);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data()?.wallets) {
          setWallets(snap.data().wallets);
        } else {
          setWallets([]);
        }
      } catch (err) {
        console.error('Error fetching merchant wallets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWallets();
  }, [merchantId]);

  const saveWalletsToDb = async (updatedList: MerchantWallet[]) => {
    setIsSaving(true);
    try {
      const ref = doc(db, 'storeWallets', merchantId);
      await setDoc(ref, { wallets: updatedList, updatedAt: new Date().toISOString() }, { merge: true });
      setWallets(updatedList);
      toast.success('تم تحديث المحافظ الإلكترونية بنجاح');
      return true;
    } catch (err: any) {
      console.error('Error saving wallets:', err);
      toast.error('حدث خطأ أثناء حفظ المحافظ');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setForm({
      id: Date.now().toString(),
      name: 'الكريمي كاش (Kuraimi)',
      accountNumber: '',
      accountName: '',
      transferType: 'subscriber',
      pointDetails: '',
      isActive: true,
      notes: ''
    });
    setEditingWallet(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (w: MerchantWallet) => {
    setForm(w);
    setEditingWallet(w);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.accountNumber.trim() || !form.accountName.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة (اسم المحفظة، رقم الحساب، اسم صاحب الحساب)');
      return;
    }

    if (form.transferType === 'point' && !form.pointDetails?.trim()) {
      toast.error('يرجى كتابة تفاصيل النقطة أو الوكيل للتحويل');
      return;
    }

    let updatedList: MerchantWallet[];
    if (editingWallet) {
      updatedList = wallets.map(w => w.id === editingWallet.id ? form : w);
    } else {
      updatedList = [...wallets, { ...form, id: Date.now().toString() }];
    }

    const success = await saveWalletsToDb(updatedList);
    if (success) {
      setIsModalOpen(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingWalletId) return;
    const updated = wallets.filter(w => w.id !== deletingWalletId);
    setDeletingWalletId(null);
    await saveWalletsToDb(updated);
  };

  const handleToggleStatus = async (id: string) => {
    const updated = wallets.map(w => w.id === id ? { ...w, isActive: !w.isActive } : w);
    await saveWalletsToDb(updated);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DA] dark:border-[#232730]">
        <div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </span>
            <span>إدارة المحافظ الإلكترونية</span>
          </h3>
          <p className="text-xs sm:text-sm text-[#5C5B57] dark:text-zinc-400 font-medium mt-1">
            أضف محافظك الإلكترونية (كريمي كاش، جوالي، جيب، وغيرها) مع تحديد رقم كل محفظة وخيار التحويل لمشترك أو لنقطة.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className={`min-h-[44px] px-5 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs flex items-center gap-2 transition shrink-0 self-start sm:self-center`}
        >
          <Plus className="w-4 h-4" />
          <span>إضافة محفظة جديدة</span>
        </button>
      </div>

      {/* Info Notice Box */}
      <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-[#5C5B57] dark:text-zinc-300 leading-relaxed">
          <p className="font-bold text-[#111214] dark:text-[#F4F4F2] text-sm mb-0.5">كيف تظهر المحافظ للعملاء؟</p>
          عندما يختار العميل الدفع عبر المحافظ الإلكترونية، تظهر له المحافظ المفعّلة هنا مع رقم الحساب ونوع التحويل وإمكانية إرفاق إشعار التحويل لتأكيد الطلب.
        </div>
      </div>

      {/* Wallets List */}
      {loading ? (
        <div className="p-12 text-center border border-[#E5E2DA] dark:border-[#232730] rounded-lg bg-white dark:bg-[#131519]">
          <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-bold">جاري تحميل المحافظ الإلكترونية...</p>
        </div>
      ) : wallets.length === 0 ? (
        <div className="p-10 rounded-lg border border-dashed border-[#E5E2DA] dark:border-[#232730] text-center space-y-4 bg-[#FAF9F6] dark:bg-[#101216]">
          <div className="w-12 h-12 rounded-lg bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center mx-auto text-[#5C5B57] dark:text-zinc-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">لم تقم بإضافة أي محفظة حتى الآن</h4>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 max-w-md mx-auto">
              أضف محفظتك الأولى ليتمكن الزبائن من الدفع لك مباشرة عبر التحويل الإلكتروني وسندات الدفع.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className={`min-h-[44px] px-5 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition inline-flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            <span>أضف أول محفظة الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className={`p-5 rounded-lg border transition flex flex-col justify-between ${
                wallet.isActive
                  ? 'bg-white dark:bg-[#131519] border-[#E5E2DA] dark:border-[#232730]'
                  : 'bg-[#FAF9F6] dark:bg-[#101216] border-dashed border-[#E5E2DA] dark:border-[#232730] opacity-65'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E5E2DA] dark:border-[#232730]">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center shrink-0 text-[#111214] dark:text-[#F4F4F2]">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#111214] dark:text-[#F4F4F2] leading-snug">
                        {wallet.name}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 border ${
                        wallet.transferType === 'point'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
                          : 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60'
                      }`}>
                        {wallet.transferType === 'point' ? <MapPin className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                        <span>{wallet.transferType === 'point' ? 'تحويل لنقطة / وكيل' : 'تحويل لمشترك (حساب)'}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(wallet.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                      wallet.isActive
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
                        : 'bg-[#EFEDE6] text-[#5C5B57] border-[#E5E2DA] dark:bg-[#1C1F26] dark:text-zinc-400 dark:border-[#232730]'
                    }`}
                  >
                    {wallet.isActive ? 'مفعلة' : 'معطلة'}
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730]">
                    <span className="text-[#5C5B57] dark:text-zinc-400 font-bold">رقم الحساب:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-[#111214] dark:text-[#F4F4F2] tabular-nums" dir="ltr">
                      <span>{wallet.accountNumber}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wallet.accountNumber);
                          toast.success('تم نسخ الرقم');
                        }}
                        className="text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white p-1"
                        title="نسخ الرقم"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <span className="text-[#5C5B57] dark:text-zinc-400 font-medium">صاحب الحساب:</span>
                    <span className="font-bold text-[#111214] dark:text-[#F4F4F2]">{wallet.accountName}</span>
                  </div>

                  {wallet.transferType === 'point' && wallet.pointDetails && (
                    <div className="p-2.5 rounded-md bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200">
                      <span className="font-bold block mb-0.5">تفاصيل النقطة / الوكيل:</span>
                      <p className="font-medium">{wallet.pointDetails}</p>
                    </div>
                  )}

                  {wallet.notes && (
                    <p className="text-[11px] text-[#5C5B57] dark:text-zinc-400 px-1">
                      ملاحظة: {wallet.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E5E2DA] dark:border-[#232730] flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(wallet)}
                  className="min-h-[38px] px-3 py-1.5 rounded-md bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>
                <button
                  onClick={() => setDeletingWalletId(wallet.id)}
                  className="min-h-[38px] px-3 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Wallet Confirmation Modal */}
      {deletingWalletId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl p-6 bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] shadow-xl text-center space-y-5">
            <div className="w-12 h-12 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2] mb-1">حذف المحفظة الإلكترونية</h4>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-medium">
                هل أنت متأكد من حذف هذه المحفظة؟ لن تظهر بعد الآن في خيارات الدفع للعملاء.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isSaving}
                className="flex-1 min-h-[44px] py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
              >
                نعم، احذف
              </button>
              <button
                type="button"
                onClick={() => setDeletingWalletId(null)}
                className="flex-1 min-h-[44px] py-2.5 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Wallet Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#131519] border border-[#E5E2DA] dark:border-[#232730] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#FAF9F6] dark:bg-[#101216] border-b border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between">
              <h4 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{editingWallet ? 'تعديل المحفظة الإلكترونية' : 'إضافة محفظة إلكترونية جديدة'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 -ml-2 rounded-lg flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">
                  اسم المحفظة الإلكترونية أو البنك
                </label>
                <select
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                >
                  {PRESET_WALLETS.map((pw, i) => (
                    <option key={i} value={pw.name}>{pw.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">
                  رقم المحفظة أو رقم الحساب / الهاتف
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: 777123456 أو 12345678"
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2.5 text-sm font-mono font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400 dir-ltr text-right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">
                  اسم صاحب الحساب (المستلم)
                </label>
                <input
                  type="text"
                  required
                  placeholder="الاسم الكامل كما يظهر في تطبيق المحفظة"
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  className="w-full min-h-[44px] bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] rounded-lg px-3.5 py-2.5 text-sm font-bold text-[#111214] dark:text-[#F4F4F2] outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2] block">
                  طريقة التحويل المطلوبة من العميل
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, transferType: 'subscriber' })}
                    className={`p-3 rounded-lg border text-right transition ${
                      form.transferType === 'subscriber'
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-400 font-medium'
                    }`}
                  >
                    <span className="text-xs flex items-center gap-1.5 font-bold">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>تحويل لمشترك</span>
                    </span>
                    <span className="text-[10px] opacity-80 block mt-1">من تطبيق العميل إلى رقم محفظتك مباشرة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, transferType: 'point' })}
                    className={`p-3 rounded-lg border text-right transition ${
                      form.transferType === 'point'
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'border-[#E5E2DA] dark:border-[#232730] text-[#5C5B57] dark:text-zinc-400 font-medium'
                    }`}
                  >
                    <span className="text-xs flex items-center gap-1.5 font-bold">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>تحويل لنقطة / وكيل</span>
                    </span>
                    <span className="text-[10px] opacity-80 block mt-1">تحويل إلى نقطة صرافة أو وكيل معتمد</span>
                  </button>
                </div>
              </div>

              {form.transferType === 'point' && (
                <div className="space-y-1.5 p-3.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                  <label className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
                    تفاصيل النقطة / الوكيل (الاسم والمدينة والرقم)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: نقطة صرافة الأمل - صنعاء شارع الزبيري - كود الوكيل 1234"
                    value={form.pointDetails}
                    onChange={(e) => setForm({ ...form, pointDetails: e.target.value })}
                    className="w-full min-h-[44px] bg-white dark:bg-[#131519] border border-amber-300 dark:border-amber-700 rounded-lg px-3.5 py-2 text-xs font-bold text-[#111214] dark:text-[#F4F4F2] outline-none"
                  />
                  <p className="text-[10px] text-amber-800 dark:text-amber-400">
                    ستظهر هذه التفاصيل للعميل عند اختيار هذه المحفظة ليقوم بالتحويل إليها بدقة.
                  </p>
                </div>
              )}

              <label className="flex items-center justify-between p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] cursor-pointer">
                <span className="text-xs font-bold text-[#111214] dark:text-[#F4F4F2]">
                  تفعيل هذه المحفظة لاستقبال الطلبات
                </span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </label>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] font-bold text-xs transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`min-h-[44px] px-6 py-2.5 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white font-bold text-xs transition disabled:opacity-50`}
                >
                  {isSaving ? 'جاري الحفظ...' : (editingWallet ? 'حفظ التعديلات' : 'إضافة المحفظة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
