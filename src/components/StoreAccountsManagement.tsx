import React, { useState, useEffect } from 'react';
import {
  KeyRound, UserPlus, Search, RefreshCw, Eye, EyeOff,
  Copy, Check, Trash2, Edit3
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

interface StoreAccountItem {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  password: string;
  role: 'admin' | 'store' | 'user' | 'delivery';
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
}

export default function StoreAccountsManagement() {
  const { getAuthHeaders, getThemeClasses } = useAppContext();

  const [accounts, setAccounts] = useState<StoreAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'store' | 'admin' | 'delivery'>('user');
  const [isCreating, setIsCreating] = useState(false);

  const [editingAccount, setEditingAccount] = useState<StoreAccountItem | null>(null);
  const [updatedPassword, setUpdatedPassword] = useState('');
  const [updatedRole, setUpdatedRole] = useState<'user' | 'store' | 'admin' | 'delivery'>('user');
  const [isUpdating, setIsUpdating] = useState(false);

  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/admin/accounts', {
        headers: { ...authHeaders }
      });
      const data = await res.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
      } else {
        toast.error(data.message || 'فشل جلب قائمة الحسابات');
      }
    } catch (err: any) {
      toast.error('خطأ في الاتصال: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const togglePasswordVisibility = (email: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [email]: !prev[email]
    }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(id);
    toast.success('تم النسخ بنجاح');
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleGenerateRandomPass = () => {
    const digits = Math.floor(100000 + Math.random() * 900000);
    return `YM-${digits}`;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('يرجى إدخال بريد إلكتروني صالح');
      return;
    }
    if (!newName.trim()) {
      toast.error('يرجى إدخال اسم صاحب الحساب');
      return;
    }

    setIsCreating(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          action: 'create',
          payload: {
            email: newEmail.trim().toLowerCase(),
            name: newName.trim(),
            phone: newPhone.trim(),
            password: newPassword.trim() || handleGenerateRandomPass(),
            role: newRole
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`تم إنشاء الحساب بنجاح! كلمة المرور: ${data.account?.password}`);
        setShowAddModal(false);
        setNewEmail('');
        setNewName('');
        setNewPhone('');
        setNewPassword('');
        setNewRole('user');
        fetchAccounts();
      } else {
        toast.error(data.message || 'فشل إنشاء الحساب');
      }
    } catch (err: any) {
      toast.error('خطأ: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    setIsUpdating(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          action: 'update',
          payload: {
            email: editingAccount.email,
            password: updatedPassword.trim() || undefined,
            role: updatedRole
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم تحديث الحساب بنجاح!');
        setEditingAccount(null);
        fetchAccounts();
      } else {
        toast.error(data.message || 'فشل التحديث');
      }
    } catch (err: any) {
      toast.error('خطأ: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingEmail) return;

    setIsDeleting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          action: 'delete',
          payload: { email: deletingEmail }
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم حذف الحساب بنجاح');
        setDeletingEmail(null);
        fetchAccounts();
      } else {
        toast.error(data.message || 'فشل الحذف');
      }
    } catch (err: any) {
      toast.error('خطأ: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      acc.email.toLowerCase().includes(term) ||
      acc.name.toLowerCase().includes(term) ||
      (acc.phone && acc.phone.includes(term))
    );
  });

  const totalUsers = accounts.filter(a => a.role === 'user').length;
  const totalStores = accounts.filter(a => a.role === 'store').length;
  const totalAdmins = accounts.filter(a => a.role === 'admin').length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header + 4-Cell Hairline KPI Ledger */}
      <div className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#111214] dark:text-[#F4F4F2]">
                إدارة الحسابات وكلمات المرور
              </h2>
            </div>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 mt-1.5 font-medium">
              قاعدة بيانات الحسابات الداخلية المباشرة للمتجر: استعراض وإعادة ضبط كلمات المرور وتعيين الرتب.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setNewPassword(handleGenerateRandomPass());
                setShowAddModal(true);
              }}
              className={`min-h-[44px] px-4 py-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg font-bold text-xs flex items-center gap-2 transition`}
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة حساب يدوي</span>
            </button>

            <button
              onClick={fetchAccounts}
              disabled={loading}
              className="w-11 h-11 bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] text-[#111214] dark:text-[#F4F4F2] rounded-lg transition flex items-center justify-center"
              title="تحديث البيانات"
              aria-label="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4-Cell Hairline KPI Ledger */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-[#E5E2DA] dark:border-[#232730] divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[#E5E2DA] dark:divide-[#232730] bg-[#FAF9F6] dark:bg-[#101216]">
          <div className="p-4">
            <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-bold block">إجمالي الحسابات</span>
            <span className="text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] mt-1 block tabular-nums">{accounts.length}</span>
          </div>
          <div className="p-4 border-r sm:border-r-0 border-[#E5E2DA] dark:border-[#232730]">
            <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-bold block">حسابات العملاء</span>
            <span className="text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] mt-1 block tabular-nums">{totalUsers}</span>
          </div>
          <div className="p-4">
            <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-bold block">حسابات المتاجر</span>
            <span className="text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] mt-1 block tabular-nums">{totalStores}</span>
          </div>
          <div className="p-4 border-r sm:border-r-0 border-[#E5E2DA] dark:border-[#232730]">
            <span className="text-[11px] text-[#5C5B57] dark:text-zinc-400 font-bold block">المدراء</span>
            <span className="text-2xl font-bold text-[#111214] dark:text-[#F4F4F2] mt-1 block tabular-nums">{totalAdmins}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#5C5B57] dark:text-zinc-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث بالبريد الإلكتروني، الاسم، أو الهاتف..."
          className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] placeholder:text-[#5C5B57]/70 dark:placeholder:text-zinc-500 text-xs sm:text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400 transition"
        />
      </div>

      {/* Accounts Table */}
      <div className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#5C5B57] dark:text-zinc-400 text-xs font-bold">جاري تحميل الحسابات...</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center text-[#5C5B57] dark:text-zinc-400 text-xs font-bold">لم يتم العثور على أي حسابات مطابقة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] font-bold text-[#5C5B57] dark:text-zinc-400 text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">المستخدم</th>
                  <th className="py-3.5 px-4">البريد الإلكتروني</th>
                  <th className="py-3.5 px-4">كلمة المرور</th>
                  <th className="py-3.5 px-4">الصلاحية</th>
                  <th className="py-3.5 px-4">الهاتف</th>
                  <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA] dark:divide-[#232730]">
                {filteredAccounts.map((acc) => {
                  const isMaster = acc.email === '1ismaai0lll@gmail.com';
                  const isPassRevealed = revealedPasswords[acc.email];

                  return (
                    <tr key={acc.email} className={`hover:bg-[#FAF9F6] dark:hover:bg-[#101216] transition ${isMaster ? 'bg-amber-50/40 dark:bg-amber-950/15' : ''}`}>
                      <td className="py-3.5 px-4 font-bold">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#EFEDE6] dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] flex items-center justify-center font-bold text-[#111214] dark:text-[#F4F4F2] text-xs shrink-0">
                            {acc.name.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-bold text-[#111214] dark:text-[#F4F4F2]">{acc.name}</span>
                            {isMaster && (
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">
                                المدير العام للمتجر
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#111214] dark:text-[#F4F4F2]" dir="ltr">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span>{acc.email}</span>
                          <button
                            onClick={() => handleCopy(acc.email, acc.email)}
                            className="p-1 text-[#5C5B57] dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                            title="نسخ البريد"
                          >
                            {copiedEmail === acc.email ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-2 bg-[#FAF9F6] dark:bg-[#101216] border border-[#E5E2DA] dark:border-[#232730] px-2.5 py-1 rounded-md font-mono text-xs font-bold text-[#111214] dark:text-[#F4F4F2]" dir="ltr">
                          <span>{isPassRevealed ? acc.password : '••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(acc.email)}
                            className="text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white transition"
                          >
                            {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.password, `pass_${acc.email}`)}
                            className="text-[#5C5B57] dark:text-zinc-400 hover:text-emerald-600 transition"
                            title="نسخ كلمة المرور"
                          >
                            {copiedEmail === `pass_${acc.email}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          acc.role === 'admin'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
                            : acc.role === 'store'
                              ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60'
                              : acc.role === 'delivery'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60'
                                : 'bg-[#FAF9F6] text-[#111214] border-[#E5E2DA] dark:bg-[#101216] dark:text-[#F4F4F2] dark:border-[#232730]'
                        }`}>
                          {acc.role === 'admin' ? 'مدير' : acc.role === 'store' ? 'صاحب متجر' : acc.role === 'delivery' ? 'مندوب توصيل' : 'عميل'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#5C5B57] dark:text-zinc-400 tabular-nums" dir="ltr">
                        {acc.phone || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-[#5C5B57] dark:text-zinc-400 text-[11px] tabular-nums">
                        {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('ar-EG') : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingAccount(acc);
                              setUpdatedPassword('');
                              setUpdatedRole(acc.role);
                            }}
                            className="w-9 h-9 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] text-[#5C5B57] dark:text-zinc-400 hover:text-[#111214] dark:hover:text-white rounded-md transition flex items-center justify-center"
                            title="تعديل كلمة المرور أو الصلاحية"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {!isMaster && (
                            <button
                              onClick={() => setDeletingEmail(acc.email)}
                              className="w-9 h-9 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#5C5B57] dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition flex items-center justify-center"
                              title="حذف الحساب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add New Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-xl p-6 border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] shadow-xl">
            <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>إضافة حساب جديد في المتجر</span>
            </h3>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="اسم المستخدم"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">البريد الإلكتروني (يمنع التكرار)</label>
                <input
                  type="text"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">رقم الهاتف (اختياري)</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="77XXXXXXX"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold">كلمة المرور المخصصة</label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(handleGenerateRandomPass())}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>توليد تلقائي</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">الصلاحية في المتجر</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                >
                  <option value="user">عميل (User)</option>
                  <option value="delivery">مندوب توصيل (Delivery)</option>
                  <option value="store">صاحب متجر (Store)</option>
                  <option value="admin">مسؤول نظام (Admin)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 min-h-[44px] py-2.5 bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] rounded-lg text-xs font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className={`flex-1 min-h-[44px] py-2.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg text-xs font-bold transition disabled:opacity-50`}
                >
                  {isCreating ? 'جاري الإنشاء...' : 'حفظ وإنشاء الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Password/Role Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-xl p-6 border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] shadow-xl">
            <h3 className="font-display text-base font-bold mb-1 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>تعديل حساب: {editingAccount.name}</span>
            </h3>
            <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-mono mb-4" dir="ltr">{editingAccount.email}</p>

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold">كلمة مرور جديدة (اختياري)</label>
                  <button
                    type="button"
                    onClick={() => setUpdatedPassword(handleGenerateRandomPass())}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>توليد تلقائي</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={updatedPassword}
                  onChange={(e) => setUpdatedPassword(e.target.value)}
                  placeholder={`الحالية: ${editingAccount.password}`}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] font-mono text-sm text-emerald-700 dark:text-emerald-400 outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                  dir="ltr"
                />
                <p className="text-[10px] text-[#5C5B57] dark:text-zinc-400 mt-1">اتركها فارغة إذا لم ترغب بتغيير كلمة المرور.</p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">تعديل الصلاحية</label>
                <select
                  value={updatedRole}
                  onChange={(e) => setUpdatedRole(e.target.value as any)}
                  disabled={editingAccount.email === '1ismaai0lll@gmail.com'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-[#FAF9F6] dark:bg-[#101216] text-sm font-medium outline-none focus:border-[#111214] dark:focus:border-zinc-400"
                >
                  <option value="user">عميل (User)</option>
                  <option value="delivery">مندوب توصيل (Delivery)</option>
                  <option value="store">صاحب متجر (Store)</option>
                  <option value="admin">مسؤول نظام (Admin)</option>
                </select>
                {editingAccount.email === '1ismaai0lll@gmail.com' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">حساب المدير العام الرئيسي لا يمكن خفض صلاحيته.</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="flex-1 min-h-[44px] py-2.5 bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] rounded-lg text-xs font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className={`flex-1 min-h-[44px] py-2.5 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-lg text-xs font-bold transition disabled:opacity-50`}
                >
                  {isUpdating ? 'جاري الحفظ...' : 'تأكيد التعديل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-sm rounded-xl p-6 border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] shadow-xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 rounded-lg flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-display text-base font-bold mb-1">هل أنت متأكد من حذف الحساب؟</h3>
              <p className="text-xs text-[#5C5B57] dark:text-zinc-400 font-mono" dir="ltr">{deletingEmail}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingEmail(null)}
                className="flex-1 min-h-[44px] py-2.5 bg-[#FAF9F6] hover:bg-[#EFEDE6] dark:bg-[#101216] dark:hover:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] rounded-lg text-xs font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 min-h-[44px] py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                {isDeleting ? 'جاري الحذف...' : 'نعم، حذف نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
