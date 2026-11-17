export interface StoreCategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const STORE_CATEGORY_ICON_OPTIONS = [
  { value: 'store', label: 'محل / متجر عام' },
  { value: 'pharmacy', label: 'صيدلية / طب' },
  { value: 'mall', label: 'مول / مركز تجاري' },
  { value: 'mechanic', label: 'محل ميكانيكي / صيانة' },
  { value: 'food', label: 'مطعم / كافيه' },
  { value: 'electronics', label: 'إلكترونيات واتصالات' },
  { value: 'fashion', label: 'ملابس وأزياء' },
  { value: 'car', label: 'سيارات وقطع غيار' },
];

export const DEFAULT_STARTER_STORE_CATEGORIES: Omit<StoreCategoryItem, 'id'>[] = [
  { name: 'صيدليات', slug: 'pharmacies', icon: 'pharmacy', order: 1 },
  { name: 'محلات', slug: 'shops', icon: 'store', order: 2 },
  { name: 'مولات', slug: 'malls', icon: 'mall', order: 3 },
  { name: 'محلات ميكانيكية', slug: 'mechanic-shops', icon: 'mechanic', order: 4 },
  { name: 'مطاعم وكافيهات', slug: 'restaurants-cafes', icon: 'food', order: 5 },
  { name: 'إلكترونيات واتصالات', slug: 'electronics-telecom', icon: 'electronics', order: 6 },
];

export const sortStoreCategories = (list: StoreCategoryItem[]): StoreCategoryItem[] => {
  return [...list].sort((a, b) => {
    const orderDiff = (Number(a.order) || 999) - (Number(b.order) || 999);
    if (orderDiff !== 0) return orderDiff;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
  });
};

export const doesStoreMatchCategory = (
  storeProfile: { storeCategoryIds?: string[] } | null | undefined,
  category: Pick<StoreCategoryItem, 'id' | 'slug' | 'name'>
): boolean => {
  const assigned = Array.isArray(storeProfile?.storeCategoryIds) ? storeProfile!.storeCategoryIds : [];
  if (assigned.length === 0) return false;
  return assigned.includes(category.id) || assigned.includes(category.slug) || assigned.includes(category.name);
};

export const getAssignedStoreCategories = (
  storeProfile: { storeCategoryIds?: string[] } | null | undefined,
  allCategories: StoreCategoryItem[]
): StoreCategoryItem[] => {
  const assigned = Array.isArray(storeProfile?.storeCategoryIds) ? storeProfile!.storeCategoryIds : [];
  if (assigned.length === 0 || allCategories.length === 0) return [];
  return allCategories.filter(
    (cat) => assigned.includes(cat.id) || assigned.includes(cat.slug) || assigned.includes(cat.name)
  );
};
