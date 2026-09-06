/**
 * بحث ذكي للنصوص العربية والإنجليزية داخل الواجهة.
 *
 * يتسامح مع:
 *  • اختلاف الهمزات والألف المقصورة والتاء المربوطة  (إسبريسو = اسبرسو = أسبريسو)
 *  • التشكيل والتطويل والمسافات الزائدة
 *  • الأرقام العربية والإنجليزية
 *  • الأخطاء الإملائية الخفيفة عبر مسافة التحرير (شاورمه ≈ شاورما)
 *  • اختلاف اللغة عبر قاموس مترادفات (coffee = قهوة = kahwa)
 *
 * ملاحظة: قاموس المترادفات هنا نسخة موازية لما في
 * backend/utils/searchTerms.js — الخادم يبحث بـ SQL والواجهة تبحث محلياً،
 * فيُحدَّثان معاً عند إضافة مصطلحات جديدة.
 */

// ── تطبيع النص ───────────────────────────────────────────────
const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

export const normalizeText = (text) => {
    if (!text && text !== 0) return '';
    return String(text)
        .replace(/[ً-ٰٟ]/g, '')      // التشكيل
        .replace(/ـ/g, '')                      // التطويل ـ
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[ؤئ]/g, 'ء')
        .replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d])
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')           // ترقيم ورموز
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
};

// ── قاموس المترادفات ─────────────────────────────────────────
const SYNONYM_GROUPS = [
    ['قهوه', 'coffee', 'kahwa', 'espresso', 'اسبريسو', 'كابتشينو', 'cappuccino', 'latte', 'لاتيه', 'مكياتو', 'macchiato', 'موكا', 'mocha'],
    ['شاي', 'tea', 'shay', 'نعناع', 'mint'],
    ['عصير', 'juice', 'aseer', 'عصائر', 'smoothie', 'سموذي'],
    ['ماء', 'مياه', 'water', 'maya'],
    ['بيتزا', 'pizza'],
    ['برجر', 'برغر', 'burger', 'hamburger', 'همبرجر', 'تشيز برجر', 'cheeseburger'],
    ['شاورما', 'shawarma', 'shawerma', 'شورما'],
    ['فلافل', 'falafel'],
    ['حمص', 'hummus', 'hommos'],
    ['فطور', 'breakfast', 'افطار'],
    ['غداء', 'lunch'],
    ['عشاء', 'dinner'],
    ['دجاج', 'chicken', 'فروج', 'بروست', 'broast'],
    ['لحم', 'لحمه', 'meat', 'beef', 'steak', 'ستيك'],
    ['سمك', 'fish', 'اسماك', 'سلمون', 'salmon'],
    ['حلويات', 'حلو', 'dessert', 'sweets', 'كنافه', 'kunafa', 'بقلاوه', 'baklava'],
    ['كيك', 'كعك', 'cake', 'gateau', 'جاتوه', 'تشيز كيك', 'cheesecake'],
    ['ايس كريم', 'ايسكريم', 'بوظه', 'ice cream', 'icecream', 'gelato', 'جيلاتو'],
    ['خبز', 'bread', 'مخبوزات', 'bakery', 'مخبز', 'فرن', 'كرواسون', 'croissant'],
    ['ساندويش', 'سندويش', 'sandwich', 'سندويشه'],
    ['سلطه', 'salad', 'سيزر', 'caesar'],
    ['معجنات', 'pastry', 'pastries', 'فطاير', 'مناقيش'],
    ['مشروبات', 'drinks', 'beverages', 'مشروب', 'soda', 'صودا'],
    ['جبنه', 'cheese', 'جبن'],
    ['بطاطا', 'potato', 'fries', 'بطاطس', 'فرايز'],
    ['رز', 'ارز', 'rice'],
    ['مقبلات', 'appetizer', 'appetizers', 'starters'],

    ['مطعم', 'مطاعم', 'restaurant', 'مأكولات', 'ماكولات'],
    ['كافيه', 'كافي', 'مقهى', 'cafe', 'coffee shop', 'كوفي'],
    ['سوبرماركت', 'سوبر ماركت', 'بقاله', 'supermarket', 'market', 'ماركت', 'مقصف'],
    ['صيدليه', 'pharmacy', 'دواء', 'ادويه', 'medicine'],
    ['مستشفى', 'hospital', 'مشفى'],
    ['عياده', 'clinic', 'طبيب', 'doctor'],
    ['ملابس', 'clothes', 'clothing', 'البسه', 'boutique', 'بوتيك', 'fashion', 'موضه'],
    ['احذيه', 'حذاء', 'shoes', 'كندره', 'sneakers'],
    ['الكترونيات', 'electronics', 'اجهزه'],
    ['موبايل', 'جوال', 'هاتف', 'تلفون', 'phone', 'mobile', 'smartphone'],
    ['حاسوب', 'كمبيوتر', 'laptop', 'computer', 'لابتوب'],
    ['حلاق', 'حلاقه', 'barber', 'صالون', 'salon', 'كوافير'],
    ['مكتبه', 'قرطاسيه', 'bookstore', 'stationery', 'كتب', 'books'],
    ['بنك', 'bank', 'صراف', 'atm'],
    ['بنزين', 'محطه وقود', 'gas station', 'petrol', 'fuel', 'وقود'],
    ['فندق', 'hotel', 'نزل'],
    ['خضار', 'خضروات', 'vegetables', 'فواكه', 'fruits', 'فاكهه'],
    ['لحام', 'ملحمه', 'butcher'],
    ['ورد', 'زهور', 'flowers', 'florist', 'مشتل'],
    ['العاب', 'toys', 'لعبه'],
    ['اثاث', 'furniture', 'مفروشات'],
    ['عطور', 'perfume', 'perfumes', 'عطر'],
    ['مجوهرات', 'ذهب', 'gold', 'jewelry', 'صاغه'],
    ['رياضه', 'sport', 'sports', 'gym', 'جيم', 'نادي'],
    ['صيانه', 'repair', 'تصليح', 'ورشه', 'workshop'],
    ['سياره', 'سيارات', 'car', 'cars', 'auto'],
    ['مغسله', 'laundry', 'تنظيف', 'dry clean'],

    ['كبير', 'large', 'big'],
    ['وسط', 'medium', 'ميديم'],
    ['صغير', 'small', 'سمول'],
    ['حار', 'ساخن', 'hot'],
    ['بارد', 'cold', 'ايس', 'iced']
];

// فهرس عكسي: مصطلح مُطبَّع ← كل مترادفاته
const SYNONYM_INDEX = (() => {
    const index = new Map();
    for (const group of SYNONYM_GROUPS) {
        const normalized = group.map(normalizeText).filter(Boolean);
        for (const term of normalized) {
            if (!index.has(term)) index.set(term, new Set());
            normalized.forEach(other => index.get(term).add(other));
        }
    }
    return index;
})();

// كلمات لا تُضيّق البحث فنتجاهلها
const STOP_WORDS = new Set([
    'في', 'من', 'على', 'عن', 'الى', 'ال', 'هل', 'يوجد', 'بدي', 'اريد', 'ابحث', 'مع', 'او',
    'a', 'an', 'the', 'is', 'are', 'in', 'on', 'at', 'of', 'for', 'and', 'or', 'with'
]);

// ── مسافة التحرير (ليفنشتاين) مع خروج مبكر ───────────────────
const editDistance = (a, b, limit) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > limit) return limit + 1;

    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        let rowMin = i;

        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,        // إدراج
                previous[j] + 1,           // حذف
                previous[j - 1] + cost     // استبدال
            );
            if (current[j] < rowMin) rowMin = current[j];
        }

        if (rowMin > limit) return limit + 1;  // لا أمل في التحسّن
        previous = current;
    }

    return previous[b.length];
};

// كم خطأً إملائياً نسامح به حسب طول الكلمة
const toleranceFor = (word) => {
    if (word.length <= 3) return 0;
    if (word.length <= 5) return 1;
    return 2;
};

/** يوسّع كلمة إلى نفسها ومترادفاتها */
const variantsOf = (word) => {
    const synonyms = SYNONYM_INDEX.get(word);
    return synonyms ? [word, ...synonyms] : [word];
};

/**
 * يقارن كلمة بحث واحدة بنصّ مُطبَّع، ويعيد درجة (0 = لا تطابق).
 * التطابق التام أعلى من البداية، ثم الاحتواء، ثم التقريبي.
 */
const scoreToken = (token, haystack, haystackWords) => {
    let best = 0;

    for (const variant of variantsOf(token)) {
        const isSynonym = variant !== token;
        const weight = isSynonym ? 0.8 : 1;

        if (haystackWords.includes(variant)) {
            best = Math.max(best, 100 * weight);
            continue;
        }
        if (haystackWords.some(word => word.startsWith(variant))) {
            best = Math.max(best, 72 * weight);
            continue;
        }
        if (haystack.includes(variant)) {
            best = Math.max(best, 48 * weight);
            continue;
        }

        // تطابق تقريبي: نقبل خطأً أو خطأين حسب الطول
        const limit = toleranceFor(variant);
        if (limit > 0) {
            for (const word of haystackWords) {
                const distance = editDistance(variant, word, limit);
                if (distance <= limit) {
                    best = Math.max(best, (34 - distance * 8) * weight);
                    break;
                }
            }
        }
    }

    return best;
};

/**
 * يعيد درجة مطابقة النص للاستعلام.
 * كل كلمة في الاستعلام يجب أن تُطابق شيئاً، وإلا فالنتيجة صفر.
 */
export const matchScore = (text, query) => {
    const haystack = normalizeText(text);
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return 1;
    if (!haystack) return 0;

    const haystackWords = haystack.split(' ').filter(Boolean);
    const tokens = normalizedQuery.split(' ').filter(w => w && !STOP_WORDS.has(w));

    // استعلام كله كلمات وقف: نعود إلى المطابقة النصية المباشرة
    if (!tokens.length) return haystack.includes(normalizedQuery) ? 40 : 0;

    let total = 0;
    for (const token of tokens) {
        const score = scoreToken(token, haystack, haystackWords);
        if (!score) return 0;      // كلمة لم تُطابق ⇒ النتيجة مرفوضة
        total += score;
    }

    const average = total / tokens.length;

    // نصّ أقصر يغطّيه الاستعلام أكثر يُرجَّح على نصّ طويل ورد فيه عرضاً:
    // «قهوة» تسبق «كوب قهوة سادة» عند البحث عن قهوة
    const coverage = Math.min(1, tokens.length / Math.max(1, haystackWords.length));
    return average * (0.75 + 0.25 * coverage);
};

/**
 * يرشّح قائمة ويرتّبها حسب قوة المطابقة.
 * fields: دالة تُعيد الحقول القابلة للبحث لكل عنصر.
 * الحقول اللاحقة أقل وزناً من الأولى (الاسم أهم من الوصف).
 */
export const smartFilter = (items, query, fields) => {
    if (!query || !query.trim()) return items;

    return items
        .map(item => {
            const values = fields(item).filter(Boolean);
            let best = 0;

            values.forEach((value, index) => {
                const weight = index === 0 ? 1 : Math.max(0.45, 1 - index * 0.2);
                best = Math.max(best, matchScore(value, query) * weight);
            });

            return { item, score: best };
        })
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(entry => entry.item);
};
