import React from 'react';

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10" dir="rtl" aria-busy="true" aria-label="جاري تحميل المنتجات">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex flex-col space-y-3">
          <div className="aspect-[4/5] rounded-lg border border-[#E5E2DA] dark:border-[#232730] skeleton-shimmer" />
          <div className="space-y-2">
            <div className="w-24 h-3 rounded skeleton-shimmer" />
            <div className="w-4/5 h-4 rounded skeleton-shimmer" />
            <div className="flex items-center justify-between pt-1">
              <div className="w-20 h-4 rounded skeleton-shimmer" />
              <div className="w-8 h-8 rounded-lg skeleton-shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StoreGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" dir="rtl" aria-busy="true" aria-label="جاري تحميل المتاجر">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] overflow-hidden"
        >
          <div className="h-36 skeleton-shimmer" />
          <div className="p-5 pt-0 space-y-3">
            <div className="flex items-end justify-between -mt-7">
              <div className="w-14 h-14 rounded-lg border-2 border-white dark:border-[#131519] skeleton-shimmer" />
              <div className="w-14 h-4 rounded skeleton-shimmer mb-1" />
            </div>
            <div className="w-40 h-5 rounded skeleton-shimmer" />
            <div className="w-full h-3.5 rounded skeleton-shimmer" />
            <div className="w-3/4 h-3.5 rounded skeleton-shimmer" />
            <div className="pt-3 border-t border-[#E5E2DA] dark:border-[#232730] flex items-center justify-between">
              <div className="w-24 h-3.5 rounded skeleton-shimmer" />
              <div className="w-20 h-3.5 rounded skeleton-shimmer" />
            </div>
            <div className="w-full h-10 rounded-lg skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" dir="rtl" aria-busy="true">
      <div className="w-28 h-9 rounded-lg skeleton-shimmer mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        <div className="lg:col-span-6 aspect-square rounded-lg skeleton-shimmer" />
        <div className="lg:col-span-6 space-y-5 pt-2">
          <div className="w-36 h-4 rounded skeleton-shimmer" />
          <div className="w-3/4 h-9 rounded-lg skeleton-shimmer" />
          <div className="w-32 h-4 rounded skeleton-shimmer" />
          <div className="h-24 rounded-lg skeleton-shimmer" />
          <div className="h-28 rounded-lg skeleton-shimmer" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-14 rounded-lg skeleton-shimmer" />
            <div className="h-14 rounded-lg skeleton-shimmer" />
          </div>
          <div className="h-12 rounded-lg skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function OrderListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="max-w-4xl mx-auto space-y-5" dir="rtl" aria-busy="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-[#E5E2DA] dark:border-[#232730] bg-white dark:bg-[#131519] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#E5E2DA] dark:border-[#232730] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg skeleton-shimmer" />
              <div className="space-y-2">
                <div className="w-36 h-4 rounded skeleton-shimmer" />
                <div className="w-24 h-3 rounded skeleton-shimmer" />
              </div>
            </div>
            <div className="w-28 h-7 rounded-md skeleton-shimmer" />
          </div>
          <div className="space-y-2">
            <div className="w-full h-11 rounded-lg skeleton-shimmer" />
            <div className="w-full h-11 rounded-lg skeleton-shimmer" />
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[#E5E2DA] dark:border-[#232730]">
            <div className="w-28 h-4 rounded skeleton-shimmer" />
            <div className="w-24 h-6 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8" dir="rtl" aria-busy="true">
      <div className="h-9 w-56 rounded-lg skeleton-shimmer" />
      <div className="h-44 w-full rounded-lg skeleton-shimmer" />
      <ProductGridSkeleton count={4} />
    </div>
  );
}
