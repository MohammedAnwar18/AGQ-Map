import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/* نبضة الحضور تتكرّر كل ثانية: مهلة قصيرة عمداً، فنبضة متأخّرة
   عشر ثوانٍ لا قيمة لها وتُعطّل التي بعدها. */
const api = axios.create({ baseURL: `${API_URL}/game`, timeout: 12000 });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

/** رسالة الخطأ كما كتبها الخادم لا "Request failed with status code 500" */
const said = (err, fallback) =>
    err?.response?.data?.error || err?.message || fallback;

export const gameService = {
    me: async () => (await api.get('/me')).data,

    updateMe: async (name, appearance) =>
        (await api.patch('/me', { name, appearance })).data,

    lookup: async (code) => (await api.get(`/player/${code}`)).data,

    openWorld: async (code) => (await api.get(`/world/${code}`)).data,

    saveWorld: async (world, title) =>
        (await api.put('/world', { world, title })).data,

    setOpen: async (open) => (await api.post('/world/open', { open })).data,

    presence: async (payload) => (await api.post('/presence', payload)).data,

    // تُرسَل عند الإغلاق، وقد لا تصل — ومهلة العشرين ثانية تتكفّل
    leave: async () => {
        try { await api.post('/presence/leave'); } catch { /* المهلة تتكفّل */ }
    }
};

export { said as gameError };
export default gameService;
