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

// ── In-Memory API Cache System ──────────────────────────────────────────────
const apiCache = new Map();
const CACHE_TTL = 15000; // 15 seconds TTL

const getCacheKey = (url, config) => {
    return JSON.stringify({ url, params: config?.params });
};

// Clear all cached responses on mutations (POST, PUT, DELETE)
export const clearApiCache = () => {
    apiCache.clear();
};

// Interceptor to clear cache on any mutations (success or error)
api.interceptors.response.use(
    (response) => {
        const method = response.config?.method?.toLowerCase();
        if (method && ['post', 'put', 'delete'].includes(method)) {
            clearApiCache();
        }
        return response;
    },
    (error) => {
        const method = error.config?.method?.toLowerCase();
        if (method && ['post', 'put', 'delete'].includes(method)) {
            clearApiCache();
        }
        
        if (error.response?.status === 401) {
            const requestUrl = error.config?.url || '';
            // فقط أعد التوجيه للصفحة الرئيسية إذا كان الطلب لـ /auth/me
            // أما المسارات الثانوية (shops, friends, posts...) فلا نريد إخراج المستخدم
            const isAuthEndpoint = requestUrl.includes('/auth/me') || requestUrl.includes('/auth/login');
            if (isAuthEndpoint) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Override api.get to resolve from cache if valid
const originalGet = api.get;
api.get = async function (url, config) {
    // Exclude auth check and camera routes from cache
    const isExcluded = url.includes('/auth/me') || url.includes('/cameras');
    if (isExcluded || config?.bypassCache) {
        return originalGet.call(this, url, config);
    }

    const key = getCacheKey(url, config);
    const cached = apiCache.get(key);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.response;
    }

    const response = await originalGet.call(this, url, config);
    apiCache.set(key, {
        timestamp: Date.now(),
        response: response
    });
    return response;
};

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

    cancelFriendRequest: async (receiverId) => {
        const response = await api.delete(`/friends/request/cancel/${receiverId}`);
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


// Smart Search Service (shops + products + price)
export const smartSearchService = {
    search: async ({ query, productQuery, priceMin, priceMax, priceExact }) => {
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (productQuery) params.append('productQuery', productQuery);
        if (priceMin !== undefined && priceMin !== '') params.append('priceMin', priceMin);
        if (priceMax !== undefined && priceMax !== '') params.append('priceMax', priceMax);
        if (priceExact !== undefined && priceExact !== '') params.append('priceExact', priceExact);
        const response = await api.get('/shops/smart-search?' + params.toString());
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
    },
    createGeofenceNotification: async () => {
        const response = await api.post('/notifications/geofence');
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
    },
    deleteMessage: async (messageId) => {
        const response = await api.delete(`/messages/${messageId}`);
        return response.data;
    },
    deleteConversation: async (friendId) => {
        const response = await api.delete(`/messages/conversation/${friendId}`);
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

// Historical Map Services (for Atlas communities)
export const historicalMapService = {
    getAll: async (communityId) => {
        const response = await api.get(`/communities/${communityId}/historical-maps`);
        return response.data;
    },

    add: async (communityId, data) => {
        const response = await api.post(`/communities/${communityId}/historical-maps`, data);
        return response.data;
    },

    update: async (communityId, mapId, data) => {
        const response = await api.put(`/communities/${communityId}/historical-maps/${mapId}`, data);
        return response.data;
    },

    delete: async (communityId, mapId) => {
        const response = await api.delete(`/communities/${communityId}/historical-maps/${mapId}`);
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

    sendNotification: async (shopId, message, targeting = null) => {
        const payload = { message };
        if (targeting) {
            payload.lat = targeting.lat;
            payload.lon = targeting.lon;
            payload.radius = targeting.radius;
        }
        const response = await api.post(`/shops/${shopId}/notify`, payload);
        return response.data;
    },

    getAllForMap: async () => {
        const response = await api.get('/shops/map/all');
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
    },

    deleteFacility: async (facilityId) => {
        const response = await api.delete(`/shops/facilities/${facilityId}`);
        return response.data;
    },

    updateUniversityFacility: async (facilityId, formData) => {
        const response = await api.put(`/shops/facilities/${facilityId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    
    renameFacility: async (facilityId, name) => {
        const response = await api.put(`/shops/facilities/${facilityId}`, { name });
        return response.data;
    },

    getPanoramas: async (shopId) => {
        const response = await api.get(`/shops/${shopId}/panoramas?t=${Date.now()}`);
        return response.data;
    },

    addPanorama: async (shopId, formData) => {
        const response = await api.post(`/shops/${shopId}/panoramas`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    deletePanorama: async (panoramaId) => {
        const response = await api.delete(`/shops/panoramas/${panoramaId}`);
        return response.data;
    }
};

// ── Reel Services (Spatial Reels) ──────────────────────────────────────────
export const reelService = {
    getReels: async (limit = 30, offset = 0) => {
        const response = await api.get(`/reels?limit=${limit}&offset=${offset}`);
        return response.data;
    },
    createReel: async (data) => {
        const response = await api.post('/reels', data);
        return response.data;
    },
    deleteReel: async (id) => {
        const response = await api.delete(`/reels/${id}`);
        return response.data;
    },
    toggleLike: async (id) => {
        const response = await api.post(`/reels/${id}/like`);
        return response.data;
    },
    getComments: async (id) => {
        const response = await api.get(`/reels/${id}/comments`);
        return response.data;
    },
    addComment: async (id, content) => {
        const response = await api.post(`/reels/${id}/comments`, { content });
        return response.data;
    },
    deleteComment: async (commentId) => {
        const response = await api.delete(`/reels/comments/${commentId}`);
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

// Magazine Services
export const magazineService = {
    getMagazines: async () => {
        const response = await api.get('/magazines');
        return response.data;
    },
    getMagazineById: async (id) => {
        const response = await api.get(`/magazines/${id}`);
        return response.data;
    },
    getAllMagazines: async () => {
        const response = await api.get('/magazines/admin/all');
        return response.data;
    },
    createMagazine: async (data) => {
        const response = await api.post('/magazines', data);
        return response.data;
    },
    updateMagazine: async (id, data) => {
        const response = await api.put(`/magazines/${id}`, data);
        return response.data;
    },
    deleteMagazine: async (id) => {
        const response = await api.delete(`/magazines/${id}`);
        return response.data;
    },
    savePage: async (data) => {
        const response = await api.post('/magazines/page', data);
        return response.data;
    },
    uploadImage: async (formData) => {
        const response = await api.post('/magazines/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    setCoverImage: async (id, formData) => {
        const response = await api.post(`/magazines/${id}/cover`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    uploadSpatial: async (formData) => {
        const response = await api.post('/magazines/upload-spatial', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    }
};

// Page Services (User-designed pages)
export const pageService = {
    savePage: async (data) => {
        const response = await api.post('/pages/save', data);
        return response.data;
    },
    viewPage: async (slug) => {
        const response = await api.get(`/pages/view/${slug}`);
        return response.data;
    },
    getMyPages: async (userId = null) => {
        const url = userId ? `/pages/user/${userId}` : '/pages/my-pages';
        const response = await api.get(url);
        return response.data;
    },
    deletePage: async (id) => {
        const response = await api.delete(`/pages/${id}`);
        return response.data;
    }
};

// ── Live Camera Services ────────────────────────────────────────────────────
export const cameraService = {
    getAll: async () => {
        const response = await api.get('/cameras');
        return response.data.cameras;
    },
    create: async (cameraData) => {
        const response = await api.post('/cameras', cameraData);
        return response.data;
    },
    deleteCamera: async (id) => {
        const response = await api.delete(`/cameras/${id}`);
        return response.data;
    },
    update: async (id, cameraData) => {
        const response = await api.put(`/cameras/${id}`, cameraData);
        return response.data;
    }
};

// Spatial AR Services
export const arService = {
    getNearby: async (lat, lng, radius = 2000) => {
        const response = await api.get(`/ar?lat=${lat}&lng=${lng}&radius=${radius}`);
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/ar', data);
        return response.data;
    },
    deleteARContent: async (id) => {
        const response = await api.delete(`/ar/${id}`);
        return response.data;
    },
    uploadSnapshot: async (base64Image) => {
        const response = await api.post('/ar/upload-snapshot', { image: base64Image });
        return response.data;
    }
};

// Fitness Services
export const fitnessService = {
    saveRun: async (runData) => {
        const response = await api.post('/fitness', runData);
        return response.data;
    },
    getActiveRuns: async () => {
        const response = await api.get('/fitness/active');
        return response.data;
    }
};





// Study Space Services
export const studySpaceService = {
    getVideos: async () => {
        const response = await api.get('/study-space/videos');
        return response.data;
    },
    upsertVideo: async (data) => {
        const response = await api.post('/study-space/videos', data);
        return response.data;
    },
    getBooks: async () => {
        const response = await api.get('/study-space/books');
        return response.data;
    },
    uploadBook: async (formData) => {
        const response = await api.post('/study-space/books', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
        });
        return response.data;
    },
    deleteBook: async (id) => {
        const response = await api.delete(`/study-space/books/${id}`);
        return response.data;
    },
    translate: async (text) => {
        // ── كشف لغة المصدر ───────────────────────────────────────────────
        const hasArabic  = /[\u0600-\u06FF]/.test(text);
        const hasChinese = /[\u4E00-\u9FFF]/.test(text);
        const hasFrench  = /[àâçéèêëîïôùûüæœ]/i.test(text);
        const hasSpanish = /[áéíóúüñ¿¡]/i.test(text);
        const hasGerman  = /[äöüß]/i.test(text);

        let srcLang = 'en';
        if (hasArabic)       srcLang = 'ar';
        else if (hasChinese) srcLang = 'zh-CN';
        else if (hasFrench)  srcLang = 'fr';
        else if (hasSpanish) srcLang = 'es';
        else if (hasGerman)  srcLang = 'de';

        const tgtLang  = hasArabic ? 'en' : 'ar';
        const langpair = `${srcLang}|${tgtLang}`;

        // ── مساعد: ترجمة جزء واحد (≤ 450 حرف) ──────────────────────────
        const translateChunk = async (chunk) => {
            const res  = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langpair}`
            );
            const data = await res.json();
            if (data?.responseStatus === 200) return data.responseData.translatedText;
            throw new Error(data?.responseDetails || 'فشل في الترجمة');
        };

        // ── تقسيم النص الكبير إلى أجزاء ذكية على حدود الجمل ─────────────
        const CHUNK_SIZE = 450;
        if (text.length <= CHUNK_SIZE) {
            return await translateChunk(text);
        }

        // قسّم على الجمل (. ! ? \n) لتجنب قطع الكلمات
        const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
        const chunks    = [];
        let   current   = '';

        for (const sentence of sentences) {
            if ((current + sentence).length > CHUNK_SIZE && current) {
                chunks.push(current.trim());
                current = sentence;
            } else {
                current += sentence;
            }
        }
        if (current.trim()) chunks.push(current.trim());

        // ── ترجمة كل جزء وانتظار النتائج ─────────────────────────────────
        const translated = [];
        for (const chunk of chunks) {
            const result = await translateChunk(chunk);
            translated.push(result);
            // تأخير بسيط لتجنب Rate-Limit
            if (chunks.length > 1) await new Promise(r => setTimeout(r, 300));
        }

        return translated.join(' ');
    }
};


// ── خدمات التحكم الداخلي ثلاثي الأبعاد 3D Indoor Control ───────────────────
export const indoorControlService = {
    getBuildings: async () => {
        const response = await api.get('/indoor-control/buildings');
        return response.data;
    },
    createBuilding: async (buildingData) => {
        const response = await api.post('/indoor-control/buildings', buildingData);
        return response.data;
    },
    updateBuilding: async (buildingId, buildingData) => {
        const response = await api.put(`/indoor-control/buildings/${buildingId}`, buildingData);
        return response.data;
    },
    getLayout: async (buildingId) => {
        const response = await api.get(`/indoor-control/layout/${buildingId}`);
        return response.data;
    },
    saveLayout: async (buildingId, shelves) => {
        const response = await api.post('/indoor-control/layout/save', { buildingId, shelves });
        return response.data;
    },
    updateStock: async (placementId, quantity) => {
        const response = await api.put(`/indoor-control/stock/${placementId}`, { quantity });
        return response.data;
    },
    createTask: async (taskData) => {
        const response = await api.post('/indoor-control/tasks', taskData);
        return response.data;
    },
    getTasks: async () => {
        const response = await api.get('/indoor-control/tasks');
        return response.data;
    },
    updateTaskStatus: async (taskId, status) => {
        const response = await api.put(`/indoor-control/tasks/${taskId}`, { status });
        return response.data;
    },
    logScan: async (locationCode, actionType) => {
        const response = await api.post('/indoor-control/log', { location_code: locationCode, action_type: actionType });
        return response.data;
    },
    updateBuildingShapes: async (buildingId, shapesData) => {
        const response = await api.put(`/indoor-control/buildings/${buildingId}/shapes`, { shapesData });
        return response.data;
    }
};

// ── خدمات المجسمات ثلاثية الأبعاد على الخريطة 3D Map Models ──────────────────
export const map3DService = {
    getModels: async () => {
        const response = await api.get('/map-3d-models');
        return response.data;
    },
    uploadModel: async (formData) => {
        const response = await api.post('/map-3d-models', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    updateModel: async (id, modelData) => {
        const response = await api.put(`/map-3d-models/${id}`, modelData);
        return response.data;
    },
    deleteModel: async (id) => {
        const response = await api.delete(`/map-3d-models/${id}`);
        return response.data;
    }
};

// ── خدمات الأظرف والدعوات الرقمية 3D Digital Letters ────────────────────────
export const digitalLettersService = {
    getAll: async () => {
        const response = await api.get('/digital-letters');
        return response.data;
    },
    getBySlug: async (slug) => {
        const response = await api.get(`/digital-letters/slug/${slug}`);
        return response.data;
    },
    create: async (formData) => {
        const response = await api.post('/digital-letters', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    update: async (id, formData) => {
        const response = await api.put(`/digital-letters/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/digital-letters/${id}`);
        return response.data;
    }
};

export default api;

