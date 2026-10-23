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

export const nexusService = {
    /** التصنيفات والمنتجات ومحلّات المستخدم وما أضافه — في طلب واحد */
    catalog: async () => (await api.get('/')).data,

    shopCategories: async (shopId) => (await api.get(`/shops/${shopId}/categories`)).data,

    /** ينسخ المنتج إلى محلّ، في التصنيف الذي يختاره صاحبه */
    adopt: async (productId, payload) =>
        (await api.post(`/products/${productId}/adopt`, payload)).data,

    // ── الأدمن ──
    addCategory: async (fields, file) =>
        (await api.post('/categories', imageForm(fields, file))).data,

    updateCategory: async (id, fields, file) =>
        (await api.put(`/categories/${id}`, imageForm(fields, file))).data,

    removeCategory: async (id) => (await api.delete(`/categories/${id}`)).data,

    addProduct: async (fields, images) =>
        (await api.post('/products', form(fields, images))).data,

    updateProduct: async (id, fields, images) =>
        (await api.put(`/products/${id}`, form(fields, images))).data,

    removeProduct: async (id) => (await api.delete(`/products/${id}`)).data
};

export default nexusService;
