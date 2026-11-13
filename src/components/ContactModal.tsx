import React from 'react';
import { X, MessageCircle, Phone, Mail, Facebook, Send, ExternalLink, MessageSquare, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface Contact {
  type: string;
  value: string;
  label?: string;
}

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  contacts: Contact[];
  getThemeClasses: (type: any) => string;
}

export default function ContactModal({ isOpen, onClose, title, contacts, getThemeClasses }: ContactModalProps) {
  const navigate = useNavigate();

  const getIcon = (type: string) => {
    switch (type) {
      case 'whatsapp': return <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'telegram': return <Send className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
      case 'facebook': return <Facebook className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'phone': return <Phone className="w-5 h-5 text-[#111214] dark:text-[#F4F4F2]" />;
      case 'email': return <Mail className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'chat': return <MessageSquare className="w-5 h-5 text-[#111214] dark:text-[#F4F4F2]" />;
      case 'website': return <Globe className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400" />;
      default: return <ExternalLink className="w-5 h-5 text-[#5C5B57] dark:text-zinc-400" />;
    }
  };

  const handleClick = (e: React.MouseEvent, contact: Contact) => {
    if (contact.type === 'chat') {
      e.preventDefault();
      onClose();
      navigate(contact.value === 'admin' ? '/contact' : `/contact?to=${contact.value}`);
    }
  };

  const getLink = (contact: Contact) => {
    const val = (contact.value || '').trim();
    switch (contact.type) {
      case 'chat':
        return '#';
      case 'whatsapp': {
        const digits = val.replace(/[^0-9]/g, '');
        return digits ? `https://wa.me/${digits}` : '#';
      }
      case 'phone':
        return val ? `tel:${val}` : '#';
      case 'email':
        return val ? `mailto:${val}` : '#';
      case 'telegram': {
        if (/^https?:\/\//i.test(val)) return val;
        const clean = val.replace(/^@/, '').replace(/^t\.me\//i, '');
        return clean ? `https://t.me/${clean}` : '#';
      }
      case 'facebook': {
        if (/^https?:\/\//i.test(val)) return val;
        return val ? `https://facebook.com/${val.replace(/^\//, '')}` : '#';
      }
      case 'instagram': {
        if (/^https?:\/\//i.test(val)) return val;
        return val ? `https://instagram.com/${val.replace(/^@/, '')}` : '#';
      }
      case 'tiktok': {
        if (/^https?:\/\//i.test(val)) return val;
        return val ? `https://tiktok.com/@${val.replace(/^@/, '')}` : '#';
      }
      default:
        if (!val) return '#';
        return /^https?:\/\//i.test(val) ? val : `https://${val}`;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative bg-white dark:bg-[#131519] rounded-xl border border-[#E5E2DA] dark:border-[#232730] shadow-xl w-full max-w-sm overflow-hidden"
          >
            <div className="px-5 py-4 bg-[#FAF9F6] dark:bg-[#101216] border-b border-[#E5E2DA] dark:border-[#232730] flex justify-between items-center">
              <h3 className="font-display text-base font-bold text-[#111214] dark:text-[#F4F4F2] truncate">{title}</h3>
              <button
                onClick={onClose}
                className="w-11 h-11 -ml-2 rounded-lg flex items-center justify-center text-[#5C5B57] dark:text-zinc-400 hover:bg-[#EFEDE6] dark:hover:bg-[#1C1F26] transition"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {contacts.length > 0 ? contacts.map((contact, index) => (
                <a
                  key={index}
                  href={getLink(contact)}
                  onClick={(e) => handleClick(e, contact)}
                  target={contact.type === 'chat' || contact.type === 'phone' || contact.type === 'email' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 p-3 min-h-[56px] bg-[#FAF9F6] dark:bg-[#101216] rounded-lg border border-[#E5E2DA] dark:border-[#232730] hover:border-[#111214] dark:hover:border-zinc-500 transition group"
                >
                  <div className="w-10 h-10 bg-white dark:bg-[#1C1F26] border border-[#E5E2DA] dark:border-[#232730] rounded-lg flex items-center justify-center shrink-0">
                    {getIcon(contact.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[#5C5B57] dark:text-zinc-400 uppercase tracking-tight">
                      {contact.label || contact.type}
                    </p>
                    <p className="text-sm font-bold text-[#111214] dark:text-[#F4F4F2] truncate" dir="ltr">
                      {contact.value}
                    </p>
                  </div>
                  <div className={`${getThemeClasses('text')} opacity-60 group-hover:opacity-100 transition shrink-0`}>
                    {contact.type === 'chat' ? <MessageSquare className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                  </div>
                </a>
              )) : (
                <div className="text-center py-10 text-sm font-medium text-[#5C5B57] dark:text-zinc-400">
                  لا توجد معلومات تواصل متاحة حالياً
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-[#FAF9F6] dark:bg-[#101216] border-t border-[#E5E2DA] dark:border-[#232730] text-xs text-[#5C5B57] dark:text-zinc-400 text-center font-medium">
              نشكركم على تواصلكم معنا دائماً
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
