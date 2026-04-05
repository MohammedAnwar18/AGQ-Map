import axios from 'axios';

// Improved: Use relative path by default for unified Vercel deployment
const API_URL = import.meta.env.VITE_API_URL || '/api';

console.log('🔌 Connecting to API at:', API_URL);

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 15000 // Add timeout to detect hanging connections
});

// Helper: Image URL Resolver
export const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // Remove /api from the end of the URL if present, then append the file path
    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '';
    return `${baseUrl}${url}`;
};

// إضافة Token تلقائياً للطلبات
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// معالجة الأخطاء
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token منتهي أو غير صالح
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth Services
export const authService = {
    register: async (userData) => {
        const response = await api.post('/auth/register', userData);
        return response.data;
    },

    login: async (credentials) => {
        const response = await api.post('/auth/login', credentials);
        return response.data;
    },

    verifyOtp: async (data) => {
        const response = await api.post('/auth/verify-otp', data);
        return response.data;
    },

    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data;
    },

    updateLocation: async (latitude, longitude) => {
        const response = await api.put('/auth/update-location', { latitude, longitude });
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    forgotPassword: async (email) => {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },

    resetPassword: async (data) => {
        // data: { email, otp, newPassword }
        const response = await api.post('/auth/reset-password', data);
        return response.data;
    }
};

// User Services
export const userService = {
    searchUsers: async (query) => {
        const response = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
        return response.data;
    },

    getUserProfile: async (userId) => {
        const response = await api.get(`/users/${userId}`);
        return response.data;
    },

    updateProfile: async (formData) => {
        const response = await api.put('/users/profile', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    }
};

// Friend Services
export const friendService = {
    sendFriendRequest: async (receiverId) => {
        const response = await api.post('/friends/request', { receiverId });
        return response.data;
    },

    acceptFriendRequest: async (requestId) => {
        const response = await api.post(`/friends/request/${requestId}/accept`);
        return response.data;
    },

    acceptBySender: async (senderId) => {
        const response = await api.post(`/friends/request/sender/${senderId}/accept`);
        return response.data;
    },

    rejectFriendRequest: async (requestId) => {
        const response = await api.post(`/friends/request/${requestId}/reject`);
        return response.data;
    },

    rejectBySender: async (senderId) => {
        const response = await api.post(`/friends/request/sender/${senderId}/reject`);
        return response.data;
    },

    getPendingRequests: async () => {
        const response = await api.get('/friends/requests/pending');
        return response.data;
    },

    getFriends: async () => {
        const response = await api.get('/friends');
        return response.data;
    },

    removeFriend: async (friendId) => {
        const response = await api.delete(`/friends/${friendId}`);
        return response.data;
    },

    toggleLocationSharing: async (friendId) => {
        const response = await api.post(`/friends/${friendId}/location-sharing`);
        return response.data;
    },

    uploadChatImage: async (formData) => {
        const response = await api.post('/friends/upload-image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    }
};

// Post Services
export const postService = {
    createPost: async (formData) => {
        const response = await api.post('/posts', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    getPosts: async (latitude, longitude, radius) => {
        let url = '/posts';
        if (latitude && longitude) {
            url += `?latitude=${latitude}&longitude=${longitude}`;
            if (radius) {
                url += `&radius=${radius}`;
            }
        }
        const response = await api.get(url);
        return response.data;
    },

    deletePost: async (postId) => {
        const response = await api.delete(`/posts/${postId}`);
        return response.data;
    },

    toggleLike: async (postId) => {
        const response = await api.post(`/posts/${postId}/like`);
        return response.data;
    }
};

// Comment Services
export const commentService = {
    getComments: async (postId) => {
        const response = await api.get(`/comments/${postId}`);
        return response.data;
    },

    addComment: async (postId, content, parentId = null) => {
        const response = await api.post(`/comments/${postId}`, { content, parentId });
        return response.data;
    },

    deleteComment: async (commentId) => {
        const response = await api.delete(`/comments/${commentId}`);
        return response.data;
    }
};

// AI Services
export const aiService = {
    chat: async (query, history = [], userLocation = null, userInfo = {}) => {
        const response = await api.post('/ai/chat', { query, chatHistory: history, userLocation, userInfo });
        return response.data;
    }
};

// Notification Services
export const notificationService = {
    getNotifications: async () => {
        const response = await api.get('/notifications');
        return response.data;
    },
    getUnreadCount: async () => {
        const response = await api.get('/notifications/unread-count');
        return response.data;
    },
    getUnreadMessagesCount: async () => {
        const response = await api.get('/notifications/unread-messages-count');
        return response.data;
    },
    markAsRead: async (id) => {
        const response = await api.put(`/notifications/${id}/read`);
        return response.data;
    },
    markAllAsRead: async () => {
        const response = await api.put('/notifications/read-all');
        return response.data;
    }
};

// Message Services
export const messageService = {
    getMessages: async (friendId) => {
        const response = await api.get(`/messages/${friendId}`);
        return response.data;
    },
    sendMessage: async (data) => {
        const response = await api.post('/messages', data);
        return response.data;
    }
};

// News Services
export const newsService = {
    getNews: async (params) => {
        // params: { lat, lon, radius }
        const { lat, lon, radius } = params;
        let queryStr = `?lat=${lat}&lon=${lon}`;
        if (radius) queryStr += `&radius=${radius}`;
        const response = await api.get(`/news${queryStr}`);
        return response.data;
    },
    createNews: async (formData) => {
        const response = await api.post('/news', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    }
};

// Community Services
export const communityService = {
    getAll: async () => {
        const response = await api.get('/communities');
        return response.data;
    },

    join: async (id) => {
        const response = await api.post(`/communities/${id}/join`);
        return response.data;
    },

    getPosts: async (id) => {
        const response = await api.get(`/communities/${id}/posts`);
        return response.data;
    },

    createPost: async (formData) => {
        const response = await api.post('/posts', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    create: async (data) => {
        const response = await api.post('/communities', data);
        return response.data;
    }
};



// Shop Services (Social)
export const shopService = {
    search: async (query) => {
        const response = await api.get(`/shops/search?query=${encodeURIComponent(query)}&t=${Date.now()}`);
        return response.data;
    },

    follow: async (shopId) => {
        const response = await api.post(`/shops/${shopId}/follow`);
        return response.data;
    },

    unfollow: async (shopId) => {
        const response = await api.delete(`/shops/${shopId}/follow`);
        return response.data;
    },

    getFollowing: async () => {
        const response = await api.get(`/shops/following?t=${Date.now()}`);
        return response.data;
    },

    create: async (shopData) => {
        const response = await api.post('/shops', shopData);
        return response.data;
    },

    deleteShop: async (id) => {
        const response = await api.delete(`/shops/${id}`);
        return response.data;
    },

    getProfile: async (id) => {
        const response = await api.get(`/shops/${id}?t=${Date.now()}`);
        return response.data;
    },

    updateProfile: async (id, data) => {
        const response = await api.put(`/shops/${id}`, data);
        return response.data;
    },

    uploadImages: async (id, formData) => {
        const response = await api.put(`/shops/${id}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    addProduct: async (id, formData) => {
        const response = await api.post(`/shops/${id}/products`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    updateProduct: async (shopId, productId, formData) => {
        const response = await api.put(`/shops/${shopId}/products/${productId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    deleteProduct: async (shopId, productId) => {
        const response = await api.delete(`/shops/${shopId}/products/${productId}`);
        return response.data;
    },

    updateShopImages: async (shopId, formData) => {
        const response = await api.put(`/shops/${shopId}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    createPost: async (id, formData) => {
        const response = await api.post(`/shops/${id}/posts`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    assignOwner: async (shopId, username) => {
        const response = await api.post(`/shops/${shopId}/assign-owner`, { username });
        return response.data;
    },

    removeOwner: async (shopId) => {
        const response = await api.delete(`/shops/${shopId}/owner`);
        return response.data;
    },

    getManagedShops: async () => {
        const response = await api.get('/shops/managed/mine');
        return response.data;
    },

    sendNotification: async (shopId, message) => {
        const response = await api.post(`/shops/${shopId}/notify`, { message });
        return response.data;
    },

    getDrivers: async (shopId) => {
        const response = await api.get(`/shops/${shopId}/drivers`);
        return response.data;
    },

    addDriver: async (shopId, driverData) => {
        // driverData: { username, car_type, ... }
        const response = await api.post(`/shops/${shopId}/drivers`, driverData);
        return response.data;
    },

    removeDriver: async (shopId, driverId) => {
        const response = await api.delete(`/shops/${shopId}/drivers/${driverId}`);
        return response.data;
    },

    requestTaxi: async (shopId, data) => {
        const response = await api.post(`/shops/${shopId}/request`, data);
        return response.data;
    },

    getShopRequests: async (shopId) => {
        const response = await api.get(`/shops/${shopId}/requests`);
        return response.data;
    },

    updateRequestStatus: async (requestId, status, driverId) => {
        const response = await api.put(`/shops/requests/${requestId}`, { status, driverId });
        return response.data;
    },

    getFacilities: async (shopId) => {
        const response = await api.get(`/shops/${shopId}/facilities?t=${Date.now()}`);
        return response.data;
    },

    addFacility: async (shopId, facilityData) => {
        const response = await api.post(`/shops/${shopId}/facilities`, facilityData);
        return response.data;
    },

    getFacilityProfile: async (facilityId) => {
        const response = await api.get(`/shops/facilities/${facilityId}?t=${Date.now()}`);
        return response.data;
    },

    addFacilityPost: async (facilityId, formData) => {
        const response = await api.post(`/shops/facilities/${facilityId}/posts`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    addCollegeSpecialty: async (facilityId, data) => {
        const response = await api.post(`/shops/facilities/${facilityId}/specialties`, data);
        return response.data;
    },

    togglePostLike: async (postId) => {
        const response = await api.post(`/shops/posts/${postId}/like`);
        return response.data;
    },

    getPostComments: async (postId) => {
        const response = await api.get(`/shops/posts/${postId}/comments`);
        return response.data;
    },

    addPostComment: async (postId, content) => {
        const response = await api.post(`/shops/posts/${postId}/comments`, { content });
        return response.data;
    },

    deletePost: async (shopId, postId) => {
        const response = await api.delete(`/shops/${shopId}/posts/${postId}`);
        return response.data;
    }
};

// Municipality Items Service (البلديات)
export const municipalityService = {
    getItems: async (municipalityId) => {
        const response = await api.get(`/shops/${municipalityId}/municipality-items?t=${Date.now()}`);
        return response.data;
    },

    addItem: async (municipalityId, formData) => {
        const response = await api.post(`/shops/${municipalityId}/municipality-items`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    deleteItem: async (itemId) => {
        const response = await api.delete(`/shops/municipality-items/${itemId}`);
        return response.data;
    }
};

export default api;

