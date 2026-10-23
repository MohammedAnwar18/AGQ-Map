import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: `${API_URL}/rasters`, timeout: 60000 });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const rasterError = (err, fallback = 'تعذّر إتمام الطلب') =>
    err?.response?.data?.error || err?.message || fallback;

/*
 * قالب رابط البلاطات كما يفهمه ‎MapLibre‎.
 *
 * نسبيّ حين لا يكون ‎VITE_API_URL‎ مضبوطاً، فيعمل على نفس النطاق
 * بلا ‎CORS‎ ولا إعداد.
 */
export const tileTemplate = (rasterId) => `${API_URL}/rasters/${rasterId}/{z}/{x}/{y}`;

/* عدد البلاطات في الدفعة الواحدة.

   حدّ جسم الطلب على ‎Vercel‎ أربعة ميجا ونصف. والبلاطة ‎WebP‎ عشرون
   كيلوبايتاً وسطياً، فعشرون بلاطة أربعُ مئة كيلوبايت — هامش واسع
   يحتمل بلاطات كثيفة التفصيل دون أن تُرفض الدفعة كلّها. */
export const BATCH = 20;

export const rasterService = {
    /** الخريطة: الجاهز المرئي فقط. والأدمن: الكلّ بـ ‎all‎ */
    list: async (all = false) => (await api.get('/', { params: all ? { all: true } : {} })).data,

    create: async (payload) => (await api.post('/', payload)).data,

    /**
     * دفعة بلاطات. الموضع في اسم الحقل لا في بيان موازٍ، فلا
     * يختلّ الترتيب بين الملفّات ومواضعها.
     */
    putTiles: async (rasterId, batch, onUploadProgress) => {
        const data = new FormData();
        for (const { tile, blob } of batch) {
            data.append(`t_${tile.z}_${tile.x}_${tile.y}`, blob, `${tile.z}_${tile.x}_${tile.y}.webp`);
        }

        return (await api.post(`/${rasterId}/tiles`, data, { onUploadProgress })).data;
    },

    finish: async (rasterId, isVisible = true) =>
        (await api.post(`/${rasterId}/finish`, { is_visible: isVisible })).data,

    update: async (rasterId, patch) => (await api.patch(`/${rasterId}`, patch)).data,

    remove: async (rasterId) => (await api.delete(`/${rasterId}`)).data
};

export default rasterService;
