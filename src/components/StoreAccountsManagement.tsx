import React, { useState, useEffect } from 'react';
import { 
  KeyRound, Users, UserPlus, Search, RefreshCw, Eye, EyeOff, 
  Copy, Check, Shield, Trash2, Edit3, ShieldAlert, Sparkles, CheckCircle2 
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

interface StoreAccountItem {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  password: string;
  role: 'admin' | 'store' | 'user';
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
}

export default function StoreAccountsManagement() {
  const { getAuthHeaders, isDarkMode, getThemeClasses } = useAppContext();
  
  const [accounts, setAccounts] = useState<StoreAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // New account modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'store' | 'admin'>('user');
  const [isCreating, setIsCreating] = useState(false);

  // Edit password modal
  const [editingAccount, setEditingAccount] = useState<StoreAccountItem | null>(null);
  const [updatedPassword, setUpdatedPassword] = useState('');
  const [updatedRole, setUpdatedRole] = useState<'user' | 'store' | 'admin'>('user');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete modal
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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-6 rounded-3xl border transition ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-2xl">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black">إدارة الحسابات وكلمات المرور الخاصة بالمتجر</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              قاعدة بيانات الحسابات الداخلية المباشرة للمتجر. يمكنك من هنا رؤية وإعادة ضبط كلمات المرور، تعيين الأدوار، ومنع التكرار.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setNewPassword(handleGenerateRandomPass());
                setShowAddModal(true);
              }}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة حساب يدوي جديد</span>
            </button>

            <button
              onClick={fetchAccounts}
              disabled={loading}
              className="p-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-2xl transition"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
            <span className="text-[11px] text-gray-400 font-bold block">إجمالي الحسابات</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">{accounts.length}</span>
          </div>

          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
            <span className="text-[11px] text-gray-400 font-bold block">حسابات العملاء</span>
            <span className="text-2xl font-black text-blue-600 mt-1 block">{totalUsers}</span>
          </div>

          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
            <span className="text-[11px] text-gray-400 font-bold block">حسابات المتاجر</span>
            <span className="text-2xl font-black text-purple-600 mt-1 block">{totalStores}</span>
          </div>

          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
            <span className="text-[11px] text-gray-400 font-bold block">المدراء</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">{totalAdmins}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث بالبريد الإلكتروني، الاسم، أو الهاتف..."
          className={`w-full pr-11 pl-4 py-3.5 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            isDarkMode 
              ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          }`}
        />
      </div>

      {/* Accounts List Table */}
      <div className={`rounded-3xl border overflow-hidden transition ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
        {loading ? (
          <div className="p-12 text-center text-gray-400 font-medium">جاري تحميل الحسابات...</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-medium">لم يتم العثور على أي حسابات مطابقة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className={`border-b font-black text-gray-400 uppercase text-[10px] tracking-wider ${isDarkMode ? 'border-gray-800 bg-gray-800/30' : 'border-gray-100 bg-gray-50/50'}`}>
                <tr>
                  <th className="py-4 px-5">المستخدم</th>
                  <th className="py-4 px-5">البريد الإلكتروني</th>
                  <th className="py-4 px-5">كلمة المرور</th>
                  <th className="py-4 px-5">الصلاحية</th>
                  <th className="py-4 px-5">الهاتف</th>
                  <th className="py-4 px-5">تاريخ الإنشاء</th>
                  <th className="py-4 px-5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredAccounts.map((acc) => {
                  const isMaster = acc.email === '1ismaai0lll@gmail.com';
                  const isPassRevealed = revealedPasswords[acc.email];

                  return (
                    <tr key={acc.email} className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition ${isMaster ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''}`}>
                      <td className="py-4 px-5 font-bold">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs ${
                            acc.role === 'admin' ? 'bg-amber-600' : acc.role === 'store' ? 'bg-purple-600' : 'bg-emerald-600'
                          }`}>
                            {acc.name.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-black">{acc.name}</span>
                            {isMaster && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">المدير العام للمتجر ⭐</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5 font-mono text-[11px]" dir="ltr">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span>{acc.email}</span>
                          <button
                            onClick={() => handleCopy(acc.email, acc.email)}
                            className="p-1 hover:text-emerald-600 text-gray-400 transition"
                            title="نسخ البريد"
                          >
                            {copiedEmail === acc.email ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-xl font-mono text-xs font-bold" dir="ltr">
                          <span>
                            {isPassRevealed ? acc.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(acc.email)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                          >
                            {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.password, `pass_${acc.email}`)}
                            className="text-gray-400 hover:text-emerald-600 transition"
                            title="نسخ كلمة المرور"
                          >
                            {copiedEmail === `pass_${acc.email}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          acc.role === 'admin' 
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                            : acc.role === 'store'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}>
                          {acc.role === 'admin' ? 'مدير' : acc.role === 'store' ? 'صاحب متجر' : 'عميل'}
                        </span>
                      </td>

                      <td className="py-4 px-5 font-mono text-gray-500">{acc.phone || '—'}</td>

                      <td className="py-4 px-5 text-gray-400 text-[11px]">
                        {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('ar-EG') : '—'}
                      </td>

                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingAccount(acc);
                              setUpdatedPassword('');
                              setUpdatedRole(acc.role);
                            }}
                            className="p-2 hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 dark:hover:bg-emerald-950/40 rounded-xl transition"
                            title="تعديل كلمة المرور أو الصلاحية"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {!isMaster && (
                            <button
                              onClick={() => setDeletingEmail(acc.email)}
                              className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-600 dark:hover:bg-red-950/40 rounded-xl transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'}`}>
            <h3 className="text-lg font-black mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
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
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
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
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
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
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold">كلمة المرور المخصصة</label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(handleGenerateRandomPass())}
                    className="text-[11px] text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>توليد تلقائي</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border font-mono text-sm font-bold ${isDarkMode ? 'bg-gray-800 border-gray-700 text-emerald-400' : 'bg-gray-50 border-gray-200 text-emerald-700'}`}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">الصلاحية في المتجر</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                >
                  <option value="user">عميل (User)</option>
                  <option value="store">صاحب متجر (Store)</option>
                  <option value="admin">مسؤول نظام (Admin)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl text-xs font-black transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'}`}>
            <h3 className="text-lg font-black mb-1 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-600" />
              <span>تعديل حساب: {editingAccount.name}</span>
            </h3>
            <p className="text-xs text-gray-400 font-mono mb-4" dir="ltr">{editingAccount.email}</p>

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold">كلمة مرور جديدة (اختياري)</label>
                  <button
                    type="button"
                    onClick={() => setUpdatedPassword(handleGenerateRandomPass())}
                    className="text-[11px] text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>توليد تلقائي</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={updatedPassword}
                  onChange={(e) => setUpdatedPassword(e.target.value)}
                  placeholder={`الحالية: ${editingAccount.password}`}
                  className={`w-full px-4 py-2.5 rounded-xl border font-mono text-sm ${isDarkMode ? 'bg-gray-800 border-gray-700 text-emerald-400' : 'bg-gray-50 border-gray-200 text-emerald-700'}`}
                  dir="ltr"
                />
                <p className="text-[10px] text-gray-500 mt-1">اتركها فارغة إذا لم ترغب بتغيير كلمة المرور.</p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">تعديل الصلاحية</label>
                <select
                  value={updatedRole}
                  onChange={(e) => setUpdatedRole(e.target.value as any)}
                  disabled={editingAccount.email === '1ismaai0lll@gmail.com'}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                >
                  <option value="user">عميل (User)</option>
                  <option value="store">صاحب متجر (Store)</option>
                  <option value="admin">مسؤول نظام (Admin)</option>
                </select>
                {editingAccount.email === '1ismaai0lll@gmail.com' && (
                  <p className="text-[10px] text-amber-500 mt-1">حساب المدير العام الرئيسي لا يمكن خفض صلاحيته.</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl text-xs font-black transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl text-center ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'}`}>
            <div className="w-14 h-14 mx-auto bg-red-100 dark:bg-red-950/50 text-red-600 rounded-2xl flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black mb-1">هل أنت متأكد من حذف الحساب؟</h3>
            <p className="text-xs text-gray-500 font-mono mb-6" dir="ltr">{deletingEmail}</p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingEmail(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl text-xs font-black transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition disabled:opacity-50"
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
