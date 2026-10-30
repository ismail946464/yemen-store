import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Wallet, Plus, Trash2, Edit, Check, AlertCircle, Copy, CheckCircle2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../AppContext';

export interface MerchantWallet {
  id: string;
  name: string; // e.g. "الكريمي كاش", "محفظة جوالي", "محفظة جيب", etc.
  accountNumber: string; // Phone or Account number
  accountName: string; // Recipient full name
  transferType: 'subscriber' | 'point'; // تحويل لمشترك أو تحويل لنقطة
  pointDetails?: string; // If transferType === 'point', name of point / agent
  isActive: boolean;
  notes?: string;
}

const PRESET_WALLETS = [
  { name: 'الكريمي كاش (Kuraimi)', icon: '🟢', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'محفظة جوالي (Jawali)', icon: '🔵', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'محفظة جيب (Jeeb)', icon: '🟣', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: 'محفظة فلوسك (Floosak)', icon: '🟠', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: 'ون كاش (OneCash)', icon: '🔴', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { name: 'موبايل موني (Mobile Money)', icon: '🟡', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: 'حساب بنكي / صرافة أخرى', icon: '🏛️', color: 'bg-slate-50 text-slate-700 border-slate-200' }
];

export default function WalletManagement({ merchantId }: { merchantId: string }) {
  const { isDarkMode } = useAppContext();
  const [wallets, setWallets] = useState<MerchantWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingWallet, setEditingWallet] = useState<MerchantWallet | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
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

  // Fetch Wallets
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المحفظة؟')) return;
    const updated = wallets.filter(w => w.id !== id);
    await saveWalletsToDb(updated);
  };

  const handleToggleStatus = async (id: string) => {
    const updated = wallets.map(w => w.id === id ? { ...w, isActive: !w.isActive } : w);
    await saveWalletsToDb(updated);
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            إدارة المحافظ الإلكترونية
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            أضف محافظك الإلكترونية (كريمي كاش، جوالي، جيب، وغيرها) مع تحديد رقم كل محفظة وخيار التحويل لمشترك أو لنقطة لتظهر لعملائك عند الدفع.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-6 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm flex items-center gap-2 hover:scale-102 active:scale-95 transition shadow-lg shrink-0 self-start sm:self-center"
        >
          <Plus className="w-5 h-5" />
          إضافة محفظة جديدة
        </button>
      </div>

      {/* Info Notice Box */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
          <p className="font-black text-sm mb-0.5">كيف تظهر المحافظ للعملاء؟</p>
          عندما يضغط العميل على زر الشراء ويختار الدفع عبر المحافظ الإلكترونية، سيظهر له خيار المحافظ التي تضيفها هنا مع رقم الحساب وخيار التحويل المباشر لمشترك أو لنقطة مع إمكانية رفع إشعار التحويل لتأكيد الطلب.
        </div>
      </div>

      {/* Wallets List */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400 font-bold">جاري تحميل المحافظ الإلكترونية...</p>
        </div>
      ) : wallets.length === 0 ? (
        <div className="p-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1">لم تقم بإضافة أي محفظة حتى الآن</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              أضف محفظتك الأولى ليتمكن الزبائن من الدفع لك مباشرة عبر التحويل الإلكتروني وسندات الدفع.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            أضف أول محفظة الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className={`p-6 rounded-3xl border transition-all duration-300 relative flex flex-col justify-between group ${
                wallet.isActive
                  ? isDarkMode 
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg' 
                    : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
                  : 'bg-slate-100/50 dark:bg-slate-950/40 border-dashed border-slate-300 dark:border-slate-800 opacity-60'
              }`}
            >
              <div className="space-y-4">
                {/* Header Card */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">💳</span>
                    <div>
                      <h4 className="font-black text-base text-slate-900 dark:text-white leading-tight">
                        {wallet.name}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                        wallet.transferType === 'point'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}>
                        {wallet.transferType === 'point' ? '📍 تحويل لنقطة / وكيل' : '📲 تحويل لمشترك (حساب)'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(wallet.id)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition ${
                      wallet.isActive 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {wallet.isActive ? 'مفعلة' : 'معطلة'}
                  </button>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 font-bold">رقم المحفظة / الحساب:</span>
                    <div className="flex items-center gap-1.5 font-mono font-black text-sm text-slate-900 dark:text-white" dir="ltr">
                      <span>{wallet.accountNumber}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wallet.accountNumber);
                          toast.success('تم نسخ الرقم');
                        }}
                        className="text-slate-400 hover:text-slate-700 p-1"
                        title="نسخ الرقم"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <span className="text-slate-400 font-bold">اسم صاحب الحساب:</span>
                    <span className="font-black text-slate-800 dark:text-slate-200">{wallet.accountName}</span>
                  </div>

                  {wallet.transferType === 'point' && wallet.pointDetails && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200">
                      <span className="font-bold block mb-0.5">تفاصيل النقطة / الوكيل:</span>
                      <p className="font-medium">{wallet.pointDetails}</p>
                    </div>
                  )}

                  {wallet.notes && (
                    <p className="text-[10px] text-slate-400 font-medium px-1">
                      ملاحظة: {wallet.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(wallet)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center gap-1 transition"
                >
                  <Edit className="w-3.5 h-3.5" />
                  تعديل
                </button>
                <button
                  onClick={() => handleDelete(wallet.id)}
                  className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs font-black flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Wallet Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                {editingWallet ? 'تعديل المحفظة الإلكترونية' : 'إضافة محفظة إلكترونية جديدة'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition font-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Wallet Name Select or Preset */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  اسم المحفظة الإلكترونية أو البنك:
                </label>
                <select
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {PRESET_WALLETS.map((pw, i) => (
                    <option key={i} value={pw.name}>{pw.name}</option>
                  ))}
                </select>
              </div>

              {/* Account / Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  رقم المحفظة أو رقم الحساب / الهاتف:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: 777123456 أو 12345678"
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dir-ltr text-right"
                />
              </div>

              {/* Account Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  اسم صاحب الحساب (المستلم):
                </label>
                <input
                  type="text"
                  required
                  placeholder="الاسم الكامل كما يظهر في تطبيق المحفظة"
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Transfer Type: Subscriber vs Point */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  طريقة التحويل المطلوبة من العميل:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, transferType: 'subscriber' })}
                    className={`p-3.5 rounded-2xl border text-right transition ${
                      form.transferType === 'subscriber'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-black'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold'
                    }`}
                  >
                    <span className="text-xs block">📲 تحويل لمشترك</span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">من تطبيق العميل إلى رقم محفظتك مباشرة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, transferType: 'point' })}
                    className={`p-3.5 rounded-2xl border text-right transition ${
                      form.transferType === 'point'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-black'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold'
                    }`}
                  >
                    <span className="text-xs block">📍 تحويل لنقطة / وكيل</span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">تحويل إلى نقطة صرافة أو وكيل معتمد</span>
                  </button>
                </div>
              </div>

              {/* Point Details if transferType === 'point' */}
              {form.transferType === 'point' && (
                <div className="space-y-1.5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                  <label className="text-xs font-black text-amber-950 dark:text-amber-200 block">
                    تفاصيل النقطة / الوكيل (الاسم والمدينة والرقم):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: نقطة صرافة الأمل - صنعاء شارع الزبيري - كود الوكيل 1234"
                    value={form.pointDetails}
                    onChange={(e) => setForm({ ...form, pointDetails: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none"
                  />
                  <p className="text-[10px] text-amber-800 dark:text-amber-400">
                    ستظهر هذه التفاصيل للعميل عند اختيار هذه المحفظة ليقوم بالتحويل إليها بدقة.
                  </p>
                </div>
              )}

              {/* Active Switch */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  تفعيل هذه المحفظة لاستقبال الطلبات
                </span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-7 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
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
