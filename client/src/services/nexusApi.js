import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: `${API_URL}/nexus`, timeout: 30000 });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

/** رسالة الخادم كما كتبها — لا «Request failed with status code 500» */
export const nexusError = (err, fallback = 'تعذّر إتمام الطلب') =>
    err?.response?.data?.error || err?.message || fallback;

/*
 * الصور تُرسل ‎multipart‎ والباقي ‎JSON‎.
 *
 * ‎FormData‎ لا يحمل ‎null‎ ولا ‎undefined‎: يحوّلهما إلى النصّين
 * "null" و"undefined" فيصل السعر الفارغ إلى الخادم كنصّ. فنُسقط
 * ما لا قيمة له، ونُرسل النصّ الفارغ وحده دلالةً على «بلا سعر».
 */
const form = (fields, files = []) => {
    const data = new FormData();

    for (const [key, value] of Object.entries(fields)) {
        if (value === null || value === undefined) continue;
        data.append(key, value);
    }

    for (const file of files) data.append('images', file);
    return data;
};

/** التصنيف صورة واحدة، والخادم يستقبلها بحقل ‎image‎ */
const imageForm = (fields, file) => {
    const data = new FormData();

    for (const [key, value] of Object.entries(fields)) {
        if (value === null || value === undefined) continue;
        data.append(key, value);
    }

    if (file) data.append('image', file);
    return data;
};

/*
 * ذاكرة الكتالوج.
 *
 * فتح القسم كان ينتظر الشبكة في كل مرّة. والكتالوج لا يتغيّر بين
 * دقيقة ودقيقة، فيُعرض المحفوظ فوراً ويُجدَّد في الخلفية — فيرى
 * المستخدم منتجاته في اللحظة، ثمّ تُصحَّح إن تغيّر شيء.
 *
 * و‎sessionStorage‎ لا ‎localStorage‎: الكتالوج يحمل ما أضافه هذا
 * المستخدم إلى محلّاته، وبقاؤه بعد الخروج يُظهر بيانات حسابٍ لمن
 * يدخل بعده على نفس الجهاز.
 */
const CACHE_KEY = 'palnovaa.nexus.catalog.v1';
const CACHE_TTL = 5 * 60 * 1000;

export const readCache = () => {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;

        const held = JSON.parse(raw);
        if (!held?.at || Date.now() - held.at > CACHE_TTL) return null;

        return held.data;
    } catch {
        return null;
    }
};

const writeCache = (data) => {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
    } catch {
        /* الحصّة ممتلئة أو التخزين ممنوع — الميزة تُفقد ولا شيء ينكسر */
    }
};

export const dropCache = () => {
    try { sessionStorage.removeItem(CACHE_KEY); } catch { /* لا شيء */ }
};

export const nexusService = {
    /** التصنيفات والمنتجات ومحلّات المستخدم وما أضافه — في طلب واحد */
    catalog: async () => {
        const data = (await api.get('/')).data;
        writeCache(data);
        return data;
    },

    shopCategories: async (shopId) => (await api.get(`/shops/${shopId}/categories`)).data,

    /** ينسخ المنتج إلى محلّ، في التصنيف الذي يختاره صاحبه */
    adopt: async (productId, payload) => {
        dropCache();
        return (await api.post(`/products/${productId}/adopt`, payload)).data;
    },

    /**
     * ينسخ عدّة منتجات بطلب واحد.
     *
     * والمعاملة في الخادم: تصنيف واحد يُنشأ مرّة، وما نجح يُحفظ ولو
     * تجاوز بعضَه — فلا يبقى نصف المحدَّد مضافاً ونصفه لا.
     */
    adoptMany: async (payload) => {
        dropCache();
        return (await api.post('/products/adopt-many', payload)).data;
    },

    // ── الأدمن ──
    addCategory: async (fields, file) => {
        dropCache();
        return (await api.post('/categories', imageForm(fields, file))).data;
    },

    updateCategory: async (id, fields, file) => {
        dropCache();
        return (await api.put(`/categories/${id}`, imageForm(fields, file))).data;
    },

    removeCategory: async (id) => {
        dropCache();
        return (await api.delete(`/categories/${id}`)).data;
    },

    /* كل تغيير في الكتالوج يُسقط المحفوظ: وإلّا رأى الأدمن كتالوجه
       القديم بعد أن أضاف إليه، فظنّ الإضافة لم تنجح */
    addProduct: async (fields, images) => {
        dropCache();
        return (await api.post('/products', form(fields, images))).data;
    },

    updateProduct: async (id, fields, images) => {
        dropCache();
        return (await api.put(`/products/${id}`, form(fields, images))).data;
    },

    removeProduct: async (id) => {
        dropCache();
        return (await api.delete(`/products/${id}`)).data;
    }
};

export default nexusService;
