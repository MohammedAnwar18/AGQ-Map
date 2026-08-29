/**
 * أدوات البحث الذكي: تطبيع النص العربي وتوسيع المصطلحات بين العربية والإنجليزية.
 *
 * الهدف: أن يجد المستخدم المنتج سواء كتب "قهوة" أو "coffee" أو "kahwa"،
 * ومع اختلاف الهمزات والتاء المربوطة والتشكيل.
 */

// ── تطبيع النص العربي ────────────────────────────────────────────────
// يوحّد الألف والياء والتاء المربوطة، ويزيل التشكيل والتطويل.
const normalizeArabic = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/[ً-ٰٟ]/g, '')   // التشكيل
        .replace(/ـ/g, '')                   // التطويل ـ
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[ؤئ]/g, 'ء')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
};

/**
 * قاموس ثنائي اللغة للمصطلحات الشائعة في المحلات والمنتجات.
 * كل سطر مجموعة مترادفات: البحث بأي كلمة منها يطابق البقية.
 */
const SYNONYM_GROUPS = [
    // مأكولات ومشروبات
    ['قهوه', 'قهوة', 'coffee', 'kahwa', 'espresso', 'اسبريسو', 'كابتشينو', 'cappuccino', 'latte', 'لاتيه'],
    ['شاي', 'tea', 'shay'],
    ['عصير', 'juice', 'aseer', 'عصائر'],
    ['ماء', 'مياه', 'water', 'maya'],
    ['بيتزا', 'pizza'],
    ['برجر', 'برغر', 'burger', 'hamburger', 'همبرجر'],
    ['شاورما', 'shawarma', 'shawerma'],
    ['فلافل', 'falafel'],
    ['حمص', 'hummus', 'hommos'],
    ['فطور', 'breakfast', 'افطار'],
    ['غداء', 'lunch'],
    ['عشاء', 'dinner'],
    ['دجاج', 'chicken', 'فروج'],
    ['لحم', 'لحمه', 'meat', 'beef'],
    ['سمك', 'fish', 'اسماك'],
    ['حلويات', 'حلو', 'dessert', 'sweets', 'كنافه', 'kunafa', 'كنافة'],
    ['كيك', 'كعك', 'cake', 'gateau', 'جاتوه'],
    ['ايس كريم', 'ايسكريم', 'بوظه', 'بوظة', 'ice cream', 'icecream', 'gelato'],
    ['خبز', 'bread', 'مخبوزات', 'bakery', 'مخبز', 'فرن'],
    ['ساندويش', 'سندويش', 'sandwich'],
    ['سلطه', 'سلطة', 'salad'],
    ['معجنات', 'pastry', 'pastries'],
    ['مشروبات', 'drinks', 'beverages', 'مشروب'],

    // فئات محلات
    ['مطعم', 'مطاعم', 'restaurant', 'مأكولات'],
    ['كافيه', 'كافي', 'مقهى', 'cafe', 'coffee shop', 'كوفي'],
    ['سوبرماركت', 'سوبر ماركت', 'بقاله', 'بقالة', 'supermarket', 'market', 'ماركت', 'مقصف'],
    ['صيدليه', 'صيدلية', 'pharmacy', 'دواء', 'ادويه', 'medicine'],
    ['مستشفى', 'hospital', 'مشفى'],
    ['عياده', 'عيادة', 'clinic', 'طبيب', 'doctor'],
    ['ملابس', 'clothes', 'clothing', 'البسه', 'boutique', 'بوتيك', 'fashion', 'موضه'],
    ['احذيه', 'احذية', 'حذاء', 'shoes', 'كندره', 'sneakers'],
    ['الكترونيات', 'electronics', 'اجهزه', 'اجهزة'],
    ['موبايل', 'جوال', 'هاتف', 'تلفون', 'phone', 'mobile', 'smartphone'],
    ['حاسوب', 'كمبيوتر', 'laptop', 'computer', 'لابتوب'],
    ['حلاق', 'حلاقه', 'حلاقة', 'barber', 'صالون', 'salon', 'كوافير'],
    ['مكتبه', 'مكتبة', 'قرطاسيه', 'قرطاسية', 'bookstore', 'stationery', 'كتب', 'books'],
    ['بنك', 'bank', 'صراف', 'atm'],
    ['بنزين', 'محطه وقود', 'محطة وقود', 'gas station', 'petrol', 'fuel', 'وقود'],
    ['فندق', 'hotel', 'نزل'],
    ['خضار', 'خضروات', 'vegetables', 'فواكه', 'fruits', 'فاكهه'],
    ['لحام', 'ملحمه', 'ملحمة', 'butcher'],
    ['ورد', 'زهور', 'flowers', 'florist', 'مشتل'],
    ['العاب', 'toys', 'لعبه', 'لعبة'],
    ['اثاث', 'furniture', 'مفروشات'],
    ['عطور', 'perfume', 'perfumes', 'عطر'],
    ['مجوهرات', 'ذهب', 'gold', 'jewelry', 'صاغه', 'صاغة'],
    ['رياضه', 'رياضة', 'sport', 'sports', 'gym', 'جيم', 'نادي'],
    ['مدرسه', 'مدرسة', 'school'],
    ['جامعه', 'جامعة', 'university', 'كليه', 'كلية', 'college'],
    ['مسجد', 'mosque', 'جامع'],
    ['كنيسه', 'كنيسة', 'church'],
    ['حديقه', 'حديقة', 'park', 'منتزه', 'garden'],
    ['صيانه', 'صيانة', 'repair', 'تصليح', 'ورشه', 'ورشة', 'workshop'],
    ['سياره', 'سيارة', 'سيارات', 'car', 'cars', 'auto'],
    ['مغسله', 'مغسلة', 'laundry', 'تنظيف', 'dry clean']
];

// فهرس عكسي: كل مصطلح مُطبَّع → مجموعة مترادفاته
const SYNONYM_INDEX = (() => {
    const index = new Map();
    for (const group of SYNONYM_GROUPS) {
        const normalizedGroup = group.map(normalizeArabic);
        for (const term of normalizedGroup) {
            if (!index.has(term)) index.set(term, new Set());
            normalizedGroup.forEach(t => index.get(term).add(t));
        }
    }
    return index;
})();

// كلمات لا تفيد البحث، نتجاهلها
const STOP_WORDS = new Set([
    'في', 'من', 'على', 'عن', 'الى', 'ال', 'هل', 'يوجد', 'اين', 'وين', 'بدي', 'اريد', 'ابحث',
    'محل', 'محلات', 'مكان', 'اماكن', 'منتج', 'منتجات', 'اقرب', 'قريب', 'لي', 'عند', 'مع',
    'a', 'an', 'the', 'is', 'are', 'in', 'on', 'at', 'of', 'for', 'me', 'i', 'want', 'need',
    'find', 'search', 'show', 'near', 'nearby', 'where', 'shop', 'store', 'product'
]);

/**
 * يحوّل جملة المستخدم إلى قائمة مصطلحات بحث موسّعة.
 * مثال: "بدي قهوة" → ['قهوه', 'coffee', 'kahwa', 'espresso', ...]
 */
const expandQuery = (rawQuery, { maxTerms = 24 } = {}) => {
    const normalized = normalizeArabic(rawQuery);
    if (!normalized) return { normalized: '', terms: [] };

    const words = normalized.split(' ').filter(Boolean);
    const terms = new Set();

    // الجملة كاملة أولاً (أعلى دقة)
    if (normalized.length >= 2) terms.add(normalized);

    // مطابقة الجملة كاملة مع القاموس (مثل "ice cream")
    if (SYNONYM_INDEX.has(normalized)) {
        SYNONYM_INDEX.get(normalized).forEach(t => terms.add(t));
    }

    for (const word of words) {
        if (word.length < 2 || STOP_WORDS.has(word)) continue;
        terms.add(word);
        if (SYNONYM_INDEX.has(word)) {
            SYNONYM_INDEX.get(word).forEach(t => terms.add(t));
        }
    }

    // الكلمات الثنائية المتجاورة (مثل "سوبر ماركت")
    for (let i = 0; i < words.length - 1; i++) {
        const pair = `${words[i]} ${words[i + 1]}`;
        if (SYNONYM_INDEX.has(pair)) {
            SYNONYM_INDEX.get(pair).forEach(t => terms.add(t));
        }
    }

    return {
        normalized,
        terms: Array.from(terms).filter(Boolean).slice(0, maxTerms)
    };
};

/**
 * تعبير SQL يطبّع عموداً نصياً بنفس قواعد normalizeArabic،
 * حتى تتطابق المقارنة بين ما يكتبه المستخدم وما في قاعدة البيانات.
 */
const sqlNormalize = (column) =>
    `lower(translate(coalesce(${column}, ''), 'أإآٱىةؤئـ', 'اااايهءء'))`;

module.exports = {
    normalizeArabic,
    expandQuery,
    sqlNormalize,
    SYNONYM_GROUPS
};
