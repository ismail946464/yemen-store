import React from 'react';
import { X, MessageCircle, Phone, Mail, Facebook, Send, ExternalLink, MessageSquare } from 'lucide-react';
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
      case 'whatsapp': return <MessageCircle className="w-6 h-6 text-green-500" />;
      case 'telegram': return <Send className="w-6 h-6 text-blue-400" />;
      case 'facebook': return <Facebook className="w-6 h-6 text-blue-600" />;
      case 'phone': return <Phone className="w-6 h-6 text-gray-600" />;
      case 'email': return <Mail className="w-6 h-6 text-red-500" />;
      case 'chat': return <MessageSquare className="w-6 h-6 text-purple-600" />;
      default: return <ExternalLink className="w-6 h-6 text-gray-400" />;
    }
  };

  const handleClick = (e: React.MouseEvent, contact: Contact) => {
    if (contact.type === 'chat') {
      e.preventDefault();
      onClose();
      navigate(contact.value === 'admin' ? '/contact' : `/contact?to=${contact.value}`);
      return;
    }
  };

  const getLink = (contact: Contact) => {
    switch (contact.type) {
      case 'chat': return '#';
      default: return '#';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden pt-5"
          >
            <div className="px-6 pb-4 border-b border-gray-100 flex justify-between items-center">
               <h3 className="text-xl font-bold text-gray-900">{title}</h3>
               <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                 <X className="w-5 h-5 text-gray-400" />
               </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {contacts.length > 0 ? contacts.map((contact, index) => (
                <a 
                  key={index}
                  href={getLink(contact)}
                  onClick={(e) => handleClick(e, contact)}
                  target={contact.type === 'chat' ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition group border border-transparent hover:border-gray-200"
                >
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                    {getIcon(contact.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">{contact.label || contact.type}</p>
                    <p className="text-sm font-bold text-gray-900 truncate" dir="ltr">{contact.value}</p>
                  </div>
                  <motion.div 
                    whileHover={{ x: -4 }}
                    className={`${getThemeClasses('text')} opacity-0 group-hover:opacity-100 transition`}
                  >
                    {contact.type === 'chat' ? <MessageSquare className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                  </motion.div>
                </a>
              )) : (
                <div className="text-center py-10 text-gray-400">
                   <p>لا توجد معلومات تواصل متاحة حالياً</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 italic text-[10px] text-gray-400 text-center">
               نشكركم على تواصلكم معنا دائماً.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
