import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: `${API_URL}/ar-indoor`, timeout: 25000 });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

/** رسالة الخادم كما كتبها، لا "Request failed with status code 500" */
export const arError = (err, fallback) =>
    err?.response?.data?.error || err?.message || fallback;

export const arIndoorService = {
    list: async () => (await api.get('/')).data,
    create: async (payload) => (await api.post('/', payload)).data,
    get: async (id) => (await api.get(`/${id}`)).data,
    update: async (id, patch) => (await api.put(`/${id}`, patch)).data,
    saveMap: async (id, nodes, edges) => (await api.put(`/${id}/map`, { nodes, edges })).data,
    remove: async (id) => (await api.delete(`/${id}`)).data,

    // مفتوح بلا حساب: من يفتح الرابط يمشي فوراً
    open: async (slug) => (await api.get(`/public/${slug}`)).data
};

export default arIndoorService;
