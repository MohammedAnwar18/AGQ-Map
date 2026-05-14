// Menu data + components
const CATEGORIES = [
  { id: 'coffee',      ar: 'القهوة',              en: 'Coffee',       count: 14 },
  { id: 'hot',         ar: 'المشروبات الساخنة',  en: 'Hot Drinks',   count: 12 },
  { id: 'cold',        ar: 'المشروبات الباردة',  en: 'Cold Drinks',  count: 11 },
  { id: 'matcha',      ar: 'الماتشا',             en: 'Matcha',       count: 6  },
  { id: 'protein',     ar: 'البروتين',            en: 'Protein',      count: 5  },
  { id: 'frappuccino', ar: 'فرابتشينو',           en: 'Frappuccino',  count: 9  },
  { id: 'milkshake',   ar: 'الميلك شيك',          en: 'Milkshake',    count: 8  },
  { id: 'smoothie',    ar: 'السموذي',             en: 'Smoothie',     count: 7  },
  { id: 'juice',       ar: 'العصائر الطازجة',    en: 'Fresh Juice',  count: 10 },
  { id: 'croissant',   ar: 'الكرواسون',           en: 'Croissant',    count: 5  },
  { id: 'cookies',     ar: 'الكوكيز',             en: 'Cookies',      count: 6  },
  { id: 'muffin',      ar: 'المافن',              en: 'Muffin',       count: 4  },
  { id: 'donut',       ar: 'دونات',               en: 'Donuts',       count: 6  },
  { id: 'cake',        ar: 'الكيك',               en: 'Cake',         count: 9  },
  { id: 'sandwich',    ar: 'الساندويشات',         en: 'Sandwiches',   count: 8  },
  { id: 'salad',       ar: 'السلطات',             en: 'Salads',       count: 5  },
];

const FEATURED = [
  {
    id: 'f1',
    name: 'لاتيه المختبر',
    sub: 'Signature Lab Latte',
    desc: 'إسبريسو مزدوج • حليب مبخّر • شراب الفانيلا المعتّق',
    price: 18,
    tag: 'الأكثر طلباً',
    cat: 'coffee',
  },
  {
    id: 'f2',
    name: 'ماتشا التركيز',
    sub: 'Focus Matcha',
    desc: 'ماتشا أوكيناوا • حليب الشوفان • قطرة عسل',
    price: 22,
    tag: 'موصى به',
    cat: 'matcha',
  },
  {
    id: 'f3',
    name: 'سموذي الطاقة',
    sub: 'Energy Smoothie',
    desc: 'مانجو • أناناس • زنجبيل • كرفس',
    price: 19,
    tag: 'صحي',
    cat: 'smoothie',
  },
  {
    id: 'f4',
    name: 'كرواسون الزبدة',
    sub: 'Butter Croissant',
    desc: 'مخبوز يومياً • زبدة فرنسية • 72 طبقة',
    price: 12,
    tag: 'طازج اليوم',
    cat: 'croissant',
  },
];

const TIMELINE = [
  { time: '06:30', label: 'تحميص اليوم', desc: 'تحميص الحبوب الطازجة لدفعة الصباح' },
  { time: '07:00', label: 'فتح الأبواب', desc: 'استقبال أول الزوار وموجة الإفطار' },
  { time: '11:00', label: 'تجارب المختبر', desc: 'إطلاق مشروب الأسبوع التجريبي' },
  { time: '17:00', label: 'ساعة الهدوء', desc: 'جلسات قراءة وعمل عميق' },
  { time: '23:00', label: 'إغلاق', desc: 'نراكم غداً مع روست جديد' },
];

window.CL_DATA = { CATEGORIES, FEATURED, TIMELINE };
