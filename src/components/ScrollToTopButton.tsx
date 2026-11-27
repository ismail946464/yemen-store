import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 480;
      setVisible((prev) => (prev === next ? prev : next));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="العودة للأعلى"
      title="العودة للأعلى"
      className="fixed bottom-20 md:bottom-6 left-4 sm:left-6 z-40 w-10 h-10 rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] text-[#111214] dark:text-[#F4F4F2] shadow-md hover:-translate-y-0.5 transition-transform duration-150 flex items-center justify-center print:hidden"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
