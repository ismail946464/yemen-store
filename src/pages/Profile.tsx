import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { User, Shield, LogOut, Camera, Loader2, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, userData, isAdmin, isStore, settings, logout, getThemeClasses, isDarkMode, toggleDarkMode } = useAppContext();
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
      await setDoc(doc(db, 'users', targetUid), {
        name,
        phone,
        photoURL
      }, { merge: true });
      setMessage('تم التحديث بنجاح!');
      toast.success("تم تحديث الملف الشخصي");
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">الملف الشخصي</h2>
        <p className="text-gray-900 font-black">الرجاء تسجيل الدخول لعرض ملفك الشخصي</p>
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
            className="absolute bottom-0 right-0 p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition transform hover:scale-110"
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
            className={`w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-600 transition-all text-right font-black ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:bg-gray-750' : 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white'}`}
          />
        </div>
        <div>
          <label className={`block text-sm font-black mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>رقم الهاتف (اختياري)</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className={`w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-600 transition-all text-left font-black ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:bg-gray-750' : 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white'}`}
            dir="ltr"
            placeholder="+967..."
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-green-600 text-white font-bold rounded-lg py-3 hover:bg-green-700 transition disabled:opacity-50"
        >
          {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </form>

      <div className={`mt-8 pt-6 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        <button
          onClick={() => {
            logout();
            toast.success("تم تسجيل الخروج بنجاح");
          }}
          className={`w-full flex items-center justify-center gap-2 border-2 font-bold rounded-lg py-3 transition-all ${isDarkMode ? 'border-red-900/30 text-red-500 hover:bg-red-900/20 hover:border-red-800/50' : 'border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200'}`}
        >
          <LogOut className="h-5 w-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
