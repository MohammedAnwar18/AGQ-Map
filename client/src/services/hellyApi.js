import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: `${API_URL}/helly`, timeout: 180000 });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const hellyService = {
    list: async () => (await api.get('/')).data,
    get: async (id) => (await api.get(`/${id}`)).data,
    create: async (data) => (await api.post('/', data)).data,
    step: async (id) => (await api.post(`/${id}/step`)).data,
    inject: async (id, content) => (await api.post(`/${id}/inject`, { content })).data,
    report: async (id) => (await api.post(`/${id}/report`)).data,
    chat: async (id, agentId, message) => (await api.post(`/${id}/agents/${agentId}/chat`, { message })).data,
    remove: async (id) => (await api.delete(`/${id}`)).data
};

export default hellyService;
