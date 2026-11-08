import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { User, Shield, LogOut, Camera, Loader2, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Profile() {
  const { 
    user, 
    userData, 
    isAdmin, 
    isStore, 
    settings, 
    logout, 
    getThemeClasses, 
    isDarkMode, 
    toggleDarkMode, 
    updateUserProfile,
    effectiveTheme,
    setUserTheme,
    allowUserThemeOverride
  } = useAppContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setPhone(userData.phone || '');
      setPhotoURL(userData.photoURL || '');
    }
  }, [userData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً (الأقصى 1 ميجابايت)");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const result = await promise;
      setPhotoURL(result);
      toast.success("تم اختيار الصورة، اضغط حفظ لتطبيق التغييرات");
    } catch (error) {
      console.error(error);
      toast.error("فشل معالجة الصورة");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    setMessage('');
    try {
      const targetUid = (user.email?.toLowerCase() === '1ismaai0lll@gmail.com' || user.uid === 'u_32cd7332ee7ec2e0c1121512')
        ? 'MQAwCYqFztd2PZbV1fRMxKRqoYX2'
        : user.uid;

      // 1. Direct Firestore user doc update
      await setDoc(doc(db, 'users', targetUid), {
        name,
        phone,
        photoURL
      }, { merge: true });

      // 2. Call backend update-profile to update storeAccounts
      await updateUserProfile({ name, phone, photoURL });

      // 3. If user is store/admin, also update storeProfiles doc
      if (isAdmin || isStore) {
        await setDoc(doc(db, 'storeProfiles', targetUid), {
          name,
          logoUrl: photoURL,
          whatsapp: phone
        }, { merge: true }).catch(() => {});
      }

      setMessage('تم التحديث بنجاح!');
      toast.success("تم تحديث وحفظ الملف الشخصي بنجاح");
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setMessage('حدث خطأ أثناء التحديث.');
      toast.error("حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <User className="h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">الملف الشخصي</h2>
        <p className="text-gray-600 dark:text-gray-300 font-bold">الرجاء تسجيل الدخول لعرض ملفك الشخصي</p>
      </div>
    );
  }

  return (
    <div className={`max-w-md mx-auto p-6 rounded-3xl shadow-sm border mt-10 relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
      <div className="flex justify-between items-center mb-6 pt-2">
        {(isAdmin || isStore) ? (
          <Link 
            to="/admin" 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg transition-transform hover:scale-105 active:scale-95 ${isAdmin ? 'bg-purple-600' : getThemeClasses('bg')}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>لوحة التحكم</span>
          </Link>
        ) : <div />}

        <button 
          onClick={toggleDarkMode}
          className={`p-3 rounded-2xl transition-all duration-300 flex items-center gap-2 border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
          title={isDarkMode ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-xs font-black">{isDarkMode ? 'وضع النهار' : 'وضع الليل'}</span>
        </button>
      </div>
      
      <div className="flex flex-col items-center mb-8 pt-4">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center relative">
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="h-12 w-12 text-gray-300" />
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`absolute bottom-0 right-0 p-2 ${getThemeClasses('bg')} ${getThemeClasses('hover')} text-white rounded-full shadow-lg transition transform hover:scale-110`}
            title="تغيير الصورة"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
        <h2 className={`text-xl font-bold mt-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{name || 'مستخدم جديد'}</h2>
        <p className={`text-sm font-black tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-900'}`}>{user.email}</p>
      </div>

      {isAdmin && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 border ${isDarkMode ? 'bg-purple-900/20 border-purple-800/50 text-purple-300' : 'bg-purple-50 border-purple-100 text-purple-700'}`}>
          <Shield className="h-6 w-6" />
          <div>
            <span className="block font-bold">حساب إداري</span>
            <span className="text-sm opacity-90">لديك صلاحيات كاملة لإدارة المتجر.</span>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-lg mb-6 ${message.includes('نجاح') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className={`block text-sm font-black mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>الاسم الكريم</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className={`w-full border rounded-lg p-3 outline-none focus:ring-2 ${getThemeClasses('ring')} transition-all text-right font-black ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:bg-gray-750' : 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white'}`}
          />
        </div>
        <div>
          <label className={`block text-sm font-black mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>رقم الهاتف (اختياري)</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className={`w-full border rounded-lg p-3 outline-none focus:ring-2 ${getThemeClasses('ring')} transition-all text-left font-black ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:bg-gray-750' : 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white'}`}
            dir="ltr"
            placeholder="+967..."
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${getThemeClasses('bg')} ${getThemeClasses('hover')} font-bold rounded-xl py-3.5 transition-all shadow-md active:scale-98 disabled:opacity-50`}
        >
          {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </form>

      {/* مظهر وتصميم المنصة (الثيم) */}
      <div className={`mt-8 pt-6 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <h3 className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              مظهر وتصميم الموقع
            </h3>
          </div>
          {allowUserThemeOverride ? (
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              تخصيص حر
            </span>
          ) : (
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              محدد من الإدارة
            </span>
          )}
        </div>

        {allowUserThemeOverride ? (
          <div>
            <p className={`text-xs mb-3 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              اختر الستايل المناسب لك، سيتم تطبيق الألوان والتفاصيل تلقائياً عبر كامل أقسام المنصة:
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'white', name: 'أبيض (الأساسي)', color: '#ffffff', bgClass: 'bg-white border-2 border-black', ringClass: 'ring-black' },
                { id: 'green', name: 'أخضر', color: '#059669', bgClass: 'bg-emerald-600', ringClass: 'ring-emerald-500' },
                { id: 'blue', name: 'أزرق', color: '#2563eb', bgClass: 'bg-blue-600', ringClass: 'ring-blue-500' },
                { id: 'red', name: 'أحمر', color: '#e11d48', bgClass: 'bg-rose-600', ringClass: 'ring-rose-500' },
                { id: 'black', name: 'أسود', color: '#09090b', bgClass: 'bg-zinc-950', ringClass: 'ring-zinc-800' }
              ].map((t) => {
                const isSelected = effectiveTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setUserTheme(t.id as any);
                      toast.success(`تم تغيير ستايل الموقع إلى ${t.name}`, { id: 'theme-change' });
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all ${
                      isSelected
                        ? `scale-105 shadow-md ring-2 ${t.ringClass} ${isDarkMode ? 'bg-gray-800 border-white/30' : 'bg-gray-50 border-gray-400'}`
                        : `${isDarkMode ? 'border-gray-800 hover:bg-gray-800/60' : 'border-gray-200 hover:bg-gray-50'}`
                    }`}
                  >
                    <div 
                      className={`w-7 h-7 rounded-xl shadow-xs transition-transform ${t.bgClass} ${isSelected ? 'scale-110' : ''}`}
                      style={t.id !== 'white' ? { backgroundColor: t.color } : {}}
                    />
                    <span className={`text-[10px] font-black ${isSelected ? (isDarkMode ? 'text-white' : 'text-gray-900') : (isDarkMode ? 'text-gray-400' : 'text-gray-600')}`}>
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-3 ${isDarkMode ? 'bg-gray-800/60 border-gray-700/60 text-gray-300' : 'bg-amber-50/60 border-amber-200/60 text-amber-900'}`}>
            <span className="text-xl shrink-0">🔒</span>
            <div className="leading-relaxed">
              <span className="font-black block mb-0.5">ستايل موحد للمنصة</span>
              <span>حددت إدارة المنصة ستايل موحد لجميع المستخدمين حالياً ({
                effectiveTheme === 'green' ? 'الأخضر' :
                effectiveTheme === 'blue' ? 'الأزرق' :
                effectiveTheme === 'red' ? 'الأحمر' :
                effectiveTheme === 'black' ? 'الأسود' : 'الأبيض'
              }).</span>
            </div>
          </div>
        )}
      </div>

      <div className={`mt-8 pt-6 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        <button
          onClick={() => {
            logout();
          }}
          className={`w-full flex items-center justify-center gap-2 border-2 font-bold rounded-xl py-3 transition-all ${isDarkMode ? 'border-red-900/30 text-red-500 hover:bg-red-900/20 hover:border-red-800/50' : 'border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200'}`}
        >
          <LogOut className="h-5 w-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
