import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: `${API_URL}/ar-models` });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const arModelService = {
    // ── عام ───────────────────────────────────────────────────
    getBySlug: async (slug) => {
        const response = await api.get(`/public/${encodeURIComponent(slug)}`);
        return response.data;
    },

    // ── إدارة ─────────────────────────────────────────────────
    list: async () => {
        const response = await api.get('/');
        return response.data;
    },

    create: async (data) => {
        const response = await api.post('/', data);
        return response.data;
    },

    update: async (id, data) => {
        const response = await api.put(`/${id}`, data);
        return response.data;
    },

    remove: async (id) => {
        const response = await api.delete(`/${id}`);
        return response.data;
    },

    /**
     * يرفع ملفاً إلى Cloudflare R2 مباشرةً من المتصفح.
     * الخادم يوقّع الرابط فقط، فلا يمرّ المجسّم الكبير عبره —
     * وهذا يتجاوز حدّ حجم الطلب في الدوال السحابية ويجعل الرفع أسرع.
     */
    uploadFile: async (file, onProgress) => {
        const { data } = await api.post('/upload-url', {
            fileName: file.name,
            contentType: file.type || 'application/octet-stream'
        });

        await axios.put(data.uploadUrl, file, {
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            onUploadProgress: (e) => {
                if (!onProgress || !e.total) return;
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        if (!data.publicUrl) {
            throw new Error('R2_PUBLIC_URL غير مضبوط، فلا يمكن توليد رابط عرض للملف');
        }
        return data.publicUrl;
    }
};

export default arModelService;
