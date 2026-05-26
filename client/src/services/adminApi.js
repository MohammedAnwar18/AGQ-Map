import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const adminApi = axios.create({
    baseURL: `${API_URL}/admin`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// إضافة Token تلقائياً
adminApi.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// معالجة الأخطاء
adminApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        } else if (error.response?.status === 403) {
            // ليس لديه صلاحيات أدمن
            alert('Access Denied: Admin privileges required');
            window.location.href = '/map';
        }
        return Promise.reject(error);
    }
);

// Admin Services
export const adminService = {
    // Dashboard Stats
    getStats: async () => {
        const response = await adminApi.get('/stats');
        return response.data;
    },

    // User Management
    getAllUsers: async (search = '', page = 1, limit = 20) => {
        const response = await adminApi.get('/users', {
            params: { search, page, limit }
        });
        return response.data;
    },

    getUserDetails: async (userId) => {
        const response = await adminApi.get(`/users/${userId}`);
        return response.data;
    },

    deleteUser: async (userId) => {
        const response = await adminApi.delete(`/users/${userId}`);
        return response.data;
    },

    toggleUserStatus: async (userId, is_active) => {
        const response = await adminApi.patch(`/users/${userId}/status`, { is_active });
        return response.data;
    },

    // Post Management
    getAllPosts: async (page = 1, limit = 50) => {
        const response = await adminApi.get('/posts', {
            params: { page, limit }
        });
        return response.data;
    },

    deletePost: async (postId) => {
        const response = await adminApi.delete(`/posts/${postId}`);
        return response.data;
    },

    createPost: async (formData) => {
        const response = await adminApi.post('/posts', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    // Shop Management
    getAllShops: async (search = '', page = 1, limit = 50) => {
        const response = await adminApi.get('/shops', {
            params: { search, page, limit }
        });
        return response.data;
    },

    deleteShop: async (shopId) => {
        const response = await adminApi.delete(`/shops/${shopId}`);
        return response.data;
    },

    toggleShopStatus: async (shopId, is_hidden) => {
        const response = await adminApi.patch(`/shops/${shopId}/status`, { is_hidden });
        return response.data;
    },

    toggleShopLock: async (shopId, is_locked) => {
        const response = await adminApi.patch(`/shops/${shopId}/lock`, { is_locked });
        return response.data;
    },

    // Admin Notifications
    sendNotification: async (targetUser, message) => {
        const response = await adminApi.post('/notifications/send', { targetUser, message });
        return response.data;
    }
};

export default adminApi;
