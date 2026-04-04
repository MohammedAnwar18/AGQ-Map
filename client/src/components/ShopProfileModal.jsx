import React, { useState, useEffect, useRef } from 'react';
import { shopService, postService, commentService, getImageUrl } from '../services/api';
import { cartService } from '../services/cartService';
import { optimizeImage } from '../utils/imageOptimizer';
import CartModal from './CartModal';
import ImageCropperModal from './ImageCropperModal';
import PostDetailModal from './PostDetailModal';
import './Modal.css';

// --- Assets / Icons ---
// --- Assets / Icons ---
const CameraIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2-2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
    </svg>
);

const PhotoIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
);

const SendIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

const TrashIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

const EditIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);
// ... existing icons ...

const TaxiIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fbab15' }}>
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
        <circle cx="7" cy="17" r="2"></circle>
        <path d="M9 17h6"></path>
        <circle cx="17" cy="17" r="2"></circle>
    </svg>
);

const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const MallIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"></path>
        <path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"></path>
        <path d="M5 21V7"></path>
        <path d="M19 21V7"></path>
        <path d="M9 7v14"></path>
        <path d="M15 7v14"></path>
        <path d="M11 3v4"></path>
        <path d="M13 3v4"></path>
    </svg>
);

const ProductImageSlider = ({ images, getImageUrl }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
    };

    if (!images || images.length === 0) return null;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img
                src={getImageUrl(images[currentIndex])}
                alt="Product"
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }}
            />
            {images.length > 1 && (
                <>
                    <button
                        onClick={handlePrev}
                        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', zIndex: 10 }}
                    >‹</button>
                    <button
                        onClick={handleNext}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', zIndex: 10 }}
                    >›</button>
                    <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 10 }}>
                        {images.map((_, idx) => (
                            <div key={idx} style={{ width: 6, height: 6, borderRadius: '50%', background: idx === currentIndex ? 'var(--primary)' : 'rgba(0,0,0,0.2)' }} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const SUPERMARKET_CATEGORIES = [
    "الكل", "العروض", "الخبز", "المعلبات", "التوابل", "الخضروات والفواكه",
    "البيض والالبان والاجبان", "مستلزمات المنزل", "المنظفات", "المفرزات",
    "الصحة والجمال", "مواد غذائية", "اكل صحي", "الصوصات",
    "مستلزمات الشواء", "الحلويات", "المشروبات", "التسالي"
];

const ShopProfileModal = ({ shop, onClose, currentUser, onFollowChange, userLocation }) => {
    const [shopData, setShopData] = useState(shop);
    const [posts, setPosts] = useState([]);
    const [products, setProducts] = useState([]);
    const [activeTab, setActiveTab] = useState((shop.category === 'صراف آلي' || shop.category === 'فرع بنك') ? 'about' : 'products');
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [internalShops, setInternalShops] = useState([]); // Shops inside this mall

    // Search State
    const [productSearchQuery, setProductSearchQuery] = useState('');

    // Cart
    const [showCart, setShowCart] = useState(false);
    const [cartCount, setCartCount] = useState(cartService.getItemCount());
    const [selectedPost, setSelectedPost] = useState(null); // Track post to view in detail
    const [targetRoom, setTargetRoom] = useState(null); // Indoor navigation target room (x, y, name)

    // Inputs for Images
    const coverInputRef = useRef(null);
    const profileInputRef = useRef(null);
    const [cropState, setCropState] = useState({ isOpen: false, file: null, type: null, aspect: 1 });

    // Create State
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [showAddProduct, setShowAddProduct] = useState(false);

    // Forms
    const [newPostContent, setNewPostContent] = useState('');
    const [postImages, setPostImages] = useState([]);
    const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '', image: null, category: '' });
    const [productImages, setProductImages] = useState([]);
    const [selectedProductCategory, setSelectedProductCategory] = useState('الكل');

    // Info Editing
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [editingCategory, setEditingCategory] = useState(false);
    const [categoryInput, setCategoryInput] = useState('');

    // Drivers State (Taxi Office)
    const [drivers, setDrivers] = useState([]);
    const [newDriverData, setNewDriverData] = useState({ username: '', car_type: '', plate_number: '', passengers: 4 });
    const [loadingDrivers, setLoadingDrivers] = useState(false);

    // Requests State (Taxi Office - for Owner)
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);

    // Driver's Own Requests
    const [myDriverRequests, setMyDriverRequests] = useState([]);

    // Simulator Mock State
    const [simResult, setSimResult] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simPrompt, setSimPrompt] = useState('');
    const [expandedAgentIndex, setExpandedAgentIndex] = useState(null);
    const [agentChatStates, setAgentChatStates] = useState({});

    // PERMISSIONS:
    // 1. System Admin: Can assign owners, remove owners, and edit everything.
    const isSystemAdmin = currentUser?.role === 'admin';
    // 2. Shop Owner/Manager: Can edit shop details and send notifications, but CANNOT assign/remove owners.
    const isShopOwner = shopData?.is_owner || (currentUser?.id === shopData.owner_id);

    // Effective Permissions
    const canAssignOwner = isSystemAdmin; // STRICTLY System Admin Only
    const canEditShop = isSystemAdmin || isShopOwner; // Admin OR Owner

    // Check if current user is a driver in this shop
    const isDriver = drivers.some(d => d.id === currentUser?.id);

    useEffect(() => {
        if (shop?.id) loadShopData();

        const updateCount = () => setCartCount(cartService.getItemCount());
        window.addEventListener('cart-updated', updateCount);
        return () => window.removeEventListener('cart-updated', updateCount);
    }, [shop]);

    // Load drivers when entering Taxi Services
    useEffect(() => {
        if (shopData?.category === 'مكتب تاكسي' && (activeTab === 'products' || activeTab === 'drivers')) {
            loadDrivers();
        }
    }, [activeTab, shopData?.category]);

    // Load driver's own requests when they become a driver
    useEffect(() => {
        if (isDriver && shopData?.category === 'مكتب تاكسي') {
            loadMyDriverRequests();
        }
    }, [isDriver, shopData?.category]);

    const loadShopData = async () => {
        setLoading(true);
        try {
            const data = await shopService.getProfile(shop.id);
            setShopData(data.shop);
            setPosts(data.posts || []);
            setProducts(data.products || []);
            setInternalShops(data.internal_shops || []);
            setIsFollowing(data.shop.is_followed);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleDeleteShop = async () => {
        if (!confirm('هل أنت متأكد من حذف هذا المحل بشكل نهائي؟')) return;
        try {
            await shopService.deleteShop(shopData.id);
            alert('تم حذف المحل بنجاح.');
            if (onFollowChange) onFollowChange(); // Trigger map refresh
            onClose();
        } catch (e) {
            console.error(e);
            alert('حدث خطأ أثناء محاولة حذف المحل.');
        }
    };

    const handleFollow = async () => {
        try {
            if (isFollowing) {
                await shopService.unfollow(shopData.id);
                setShopData(prev => ({
                    ...prev,
                    followers_count: Math.max(0, parseInt(prev.followers_count || 0) - 1)
                }));
            } else {
                await shopService.follow(shopData.id);
                setShopData(prev => ({
                    ...prev,
                    followers_count: parseInt(prev.followers_count || 0) + 1
                }));
            }
            setIsFollowing(!isFollowing);
            if (onFollowChange) onFollowChange();
        } catch (e) {
            console.error(e);
        }
    };

    const handleImageUpload = async (type, file) => {
        if (!file) return;

        try {
            // Optimize image before upload
            const optimizedFile = await optimizeImage(file, { maxWidth: 1024, quality: 0.75 });

            const formData = new FormData();
            formData.append(type, optimizedFile);

            const res = await shopService.uploadImages(shopData.id, formData);
            setShopData(prev => ({
                ...prev,
                [type]: res[type] || prev[type]
            }));
            loadShopData();
        } catch (e) {
            alert('فشل تحديث الصورة');
            console.error(e);
        }
    };

    // Drivers Logic (Taxi)
    const loadDrivers = async () => {
        if (!shopData?.id) return;
        setLoadingDrivers(true);
        try {
            const data = await shopService.getDrivers(shopData.id);
            setDrivers(data.drivers || []);
        } catch (error) {
            console.error("Failed to load drivers", error);
        } finally {
            setLoadingDrivers(false);
        }
    };

    const handleAddDriver = async (e) => {
        e.preventDefault();
        if (!newDriverData.username.trim()) return;
        try {
            await shopService.addDriver(shopData.id, newDriverData);
            setNewDriverData({ username: '', car_type: '', plate_number: '', passengers: 4 });
            loadDrivers();
            alert('تم إضافة السائق والسيارة بنجاح');
        } catch (error) {
            alert('فشل إضافة السائق: ' + (error.response?.data?.error || 'خطأ غير معروف'));
        }
    };

    const handleRemoveDriver = async (driverId) => {
        if (!window.confirm('هل أنت متأكد من إزالة هذا السائق؟')) return;
        try {
            await shopService.removeDriver(shopData.id, driverId);
            setDrivers(drivers.filter(d => d.id !== driverId));
        } catch (e) {
            alert('فشل الحذف');
        }
    };

    const handleRequestTaxi = async () => {
        try {
            if (!navigator.geolocation) {
                alert('المتصفح لا يدعم تحديد الموقع');
                return;
            }

            navigator.geolocation.getCurrentPosition(async (position) => {
                try {
                    await shopService.requestTaxi(shopData.id, {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        address: 'موقعي الحالي'
                    });
                    alert('تم إرسال طلبك بنجاح! سيتم إشعارك عند قبول الطلب.');
                } catch (error) {
                    alert(error.response?.data?.error || 'فشل إرسال الطلب');
                }
            }, (error) => {
                alert('فشل تحديد موقعك. يرجى تفعيل خدمة الموقع.');
            });
        } catch (error) {
            console.error(error);
        }
    };

    const loadRequests = async () => {
        if (!shopData?.id || !canEditShop) return;
        setLoadingRequests(true);
        try {
            const data = await shopService.getShopRequests(shopData.id);
            setRequests(data.requests || []);
        } catch (error) {
            console.error("Failed to load requests", error);
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleUpdateRequestStatus = async (requestId, status, driverId = null) => {
        try {
            await shopService.updateRequestStatus(requestId, status, driverId);
            loadRequests(); // Reload
            if (isDriver) loadMyDriverRequests(); // Reload driver's requests too
            alert('تم تحديث حالة الطلب بنجاح');
        } catch (error) {
            alert('فشل التحديث');
        }
    };

    const loadMyDriverRequests = async () => {
        if (!shopData?.id || !isDriver) return;
        try {
            const data = await shopService.getShopRequests(shopData.id);
            // Filter only requests assigned to current user
            const myRequests = data.requests.filter(r => r.driver_id === currentUser?.id);
            setMyDriverRequests(myRequests);
        } catch (error) {
            console.error("Failed to load my driver requests", error);
        }
    };

    // State for editing product
    const [editingProduct, setEditingProduct] = useState(null);

    // Mall logic
    const [showAddInternalShop, setShowAddInternalShop] = useState(false);
    const [newInternalShopData, setNewInternalShopData] = useState({ name: '', category: '', floor: '', owner_username: '' });

    const handleAddInternalShop = async (e) => {
        e.preventDefault();
        try {
            // Logic to create a shop with parent_shop_id
            // We use the same createShop API but with extra fields
            await shopService.createShop({
                name: newInternalShopData.name,
                category: newInternalShopData.category,
                floor: newInternalShopData.floor,
                parent_shop_id: shopData.id,
                latitude: shopData.latitude, // Same location as mall
                longitude: shopData.longitude
            });
            setShowAddInternalShop(false);
            setNewInternalShopData({ name: '', category: '', floor: '', owner_username: '' });
            loadShopData(); // Refresh list
            alert('تم إضافة المحل للمجمع بنجاح');
        } catch (error) {
            alert('فشل إضافة المحل');
        }
    };

    const handleUpdateName = async () => {
        if (!nameInput.trim()) return;
        try {
            await shopService.updateProfile(shopData.id, { name: nameInput });
            setShopData(prev => ({ ...prev, name: nameInput }));
            setEditingName(false);
            if (onFollowChange) onFollowChange(); // Refresh map
            alert('تم تحديث اسم المؤسسة بنجاح!');
        } catch (error) {
            alert('فشل تحديث الاسم');
        }
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('content', newPostContent);

            // Loop through files and optimize if image
            for (let i = 0; i < postImages.length; i++) {
                if (postImages[i].type.startsWith('image/')) {
                    const optimizedFile = await optimizeImage(postImages[i], { maxWidth: 1200 });
                    formData.append('images', optimizedFile);
                } else {
                    formData.append('images', postImages[i]); // Keep video as is
                }
            }

            const post = await shopService.createPost(shopData.id, formData);
            setPosts([post, ...posts]);
            setNewPostContent('');
            setPostImages([]);
            setShowCreatePost(false);
        } catch (e) {
            console.error(e);
            alert('فشل النشر');
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryUpdate = async () => {
        if (!categoryInput.trim()) return;
        try {
            // Assuming updateProfile handles partial updates or we send the field we want
            // If the API requires full object, this might need adjustment, but usually simple updates support this.
            // We use the generic updateProfile method.
            const res = await shopService.updateProfile(shopData.id, { category: categoryInput });
            setShopData(prev => ({ ...prev, category: categoryInput })); // Optimistic or use res if available
            setEditingCategory(false);
        } catch (e) {
            console.error(e);
            alert('فشل تحديث التصنيف');
        }
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('name', newProduct.name);
            formData.append('price', newProduct.price);
            formData.append('description', newProduct.description);
            formData.append('old_price', newProduct.old_price || '');
            formData.append('category', newProduct.category || '');

            // Handle multiple images
            if (productImages && productImages.length > 0) {
                for (let i = 0; i < productImages.length; i++) {
                    const optimizedFile = await optimizeImage(productImages[i], { maxWidth: 800 });
                    formData.append('images', optimizedFile);
                }
            } else if (newProduct.image) { // Fallback for single image upload
                const optimizedFile = await optimizeImage(newProduct.image, { maxWidth: 800 });
                formData.append('images', optimizedFile);
            }

            let savedProduct;
            if (editingProduct) {
                savedProduct = await shopService.updateProduct(shopData.id, editingProduct.id, formData);
                setProducts(products.map(p => p.id === editingProduct.id ? savedProduct : p));
                alert('تم تعديل المنتج');
            } else {
                savedProduct = await shopService.addProduct(shopData.id, formData);
                setProducts([savedProduct, ...products]);
                alert('تم إضافة المنتج');
            }

            setNewProduct({ name: '', price: '', old_price: '', description: '', image: null, category: '' });
            setProductImages([]);
            setEditingProduct(null);
            setShowAddProduct(false);
        } catch (e) {
            console.error(e);
            alert('فشل حفظ المنتج');
        }
    };

    // Helper to open edit form
    const openEditProduct = (prod) => {
        setEditingProduct(prod);
        setNewProduct({
            name: prod.name,
            price: prod.price,
            old_price: prod.old_price || '',
            description: prod.description || '',
            category: prod.category || '',
            image: null
        });
        setProductImages([]);
        setShowAddProduct(true);
    };

    const handleDeleteProduct = async (prodId) => {
        if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
        try {
            await shopService.deleteProduct(shopData.id, prodId);
            setProducts(products.filter(p => p.id !== prodId));
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeletePost = async (postId) => {
        if (!confirm('هل أنت متأكد من حذف هذا المنشور؟')) return;
        try {
            // Using postService.deletePost as defined in api.js
            await postService.deletePost(postId);
            setPosts(posts.filter(p => p.id !== postId));
        } catch (e) {
            console.error(e);
            alert('فشل حذف المنشور');
        }
    };

    const handleLike = async (postId) => {
        setPosts(posts.map(p => {
            if (p.id === postId) {
                const currentLikes = parseInt(p.likes_count) || 0;
                return {
                    ...p,
                    is_liked: !p.is_liked,
                    likes_count: p.is_liked ? Math.max(0, currentLikes - 1) : currentLikes + 1
                };
            }
            return p;
        }));
        try {
            await postService.toggleLike(postId);
        } catch (e) {
            console.error(e);
        }
    };

    const handleComment = async (postId, content) => {
        if (!content || !content.trim()) return;
        try {
            await commentService.addComment(postId, content);
            setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: (parseInt(p.comments_count) || 0) + 1 } : p));
        } catch (e) {
            console.error(e);
            alert('فشل إضافة التعليق. يرجى المحاولة لاحقاً.');
        }
    };

    // --- Helper for Status ---
    const getShopStatus = () => {
        if (!shopData.opening_hours) return null;
        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const now = new Date();
        const currentDayName = days[now.getDay()];

        const hoursText = shopData.opening_hours;
        // Search for current day line, e.g., "الخميس: 09:00 - 17:00"
        const dayRegex = new RegExp(`${currentDayName}:\\s*(.*)`);
        const match = hoursText.match(dayRegex);

        if (!match) return null; // No data for today

        const timeRange = match[1];
        if (timeRange.includes('مغلق')) return { isOpen: false, text: 'مغلق' };

        // Parse times "09:00 - 17:00"
        // Parse times "09:00 - 17:00" or "9:00 صباحاً - 5:00 مساءً"
        const times = timeRange.match(/(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)?\s*-\s*(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)?/);
        if (!times) return null;

        const [_, h1, m1, p1, h2, m2, p2] = times;

        let startH = parseInt(h1);
        if (p1 && p1.includes('مساء') && startH !== 12) startH += 12;
        if (p1 && p1.includes('صباح') && startH === 12) startH = 0;

        let endH = parseInt(h2);
        if (p2 && p2.includes('مساء') && endH !== 12) endH += 12;
        if (p2 && p2.includes('صباح') && endH === 12) endH = 0;

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = startH * 60 + parseInt(m1);
        const endMinutes = endH * 60 + parseInt(m2);

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
            return { isOpen: true, text: 'مفتوح' };
        } else {
            return { isOpen: false, text: 'مغلق' };
        }
    };

    const status = getShopStatus();

    // --- Render Helpers ---

    if (!shopData) return null;


    const coverUrl = shopData.cover_picture
        ? getImageUrl(shopData.cover_picture)
        : 'linear-gradient(135deg, #6366f1, #a855f7)';

    const profileUrl = getImageUrl(shopData.profile_picture);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container"
                style={{
                    overflowY: 'auto',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onClick={e => e.stopPropagation()}>

                {/* Standard Modal Header */}
                <div className="modal-header">
                    <h2>{shopData?.name || 'الملف الشخصي'}</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                {/* Body wrapper to match standard formatting and flex flow */}
                <div style={{ flex: 1, padding: 0, display: 'block', overflowY: 'auto' }}>
                    {/* Header / Hero */}
                    <div style={{
                        height: '250px',
                        background: shopData.cover_picture ? `url(${coverUrl}) center/cover` : coverUrl,
                        position: 'relative'
                    }}>


                    {canEditShop && (
                        <div style={{ position: 'absolute', right: 20, top: 20 }}>
                            <button onClick={() => coverInputRef.current.click()} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', padding: '8px 12px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CameraIcon /> تغيير الغلاف
                            </button>
                            <input type="file" ref={coverInputRef} accept="image/*" hidden onChange={e => {
                                if (e.target.files[0]) {
                                    setCropState({ isOpen: true, file: e.target.files[0], type: 'cover_picture', aspect: 3 });
                                }
                                e.target.value = null;
                            }} />
                        </div>
                    )}

                    <div style={{ position: 'absolute', bottom: -50, right: 30 }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: 120, height: 120, borderRadius: '50%',
                                border: '2px solid var(--bg-primary)',
                                background: profileUrl ? `url(${profileUrl}) center/cover` : '#fbab15',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '3rem', color: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                            }}>
                                {!profileUrl && shopData.name[0]}
                            </div>
                            {canEditShop && (
                                <button onClick={() => profileInputRef.current.click()} style={{
                                    position: 'absolute', bottom: 5, right: 0,
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: 'var(--primary)', border: '2px solid var(--bg-primary)',
                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                }}>
                                    <CameraIcon />
                                </button>
                            )}
                            <input type="file" ref={profileInputRef} accept="image/*" hidden onChange={e => {
                                if (e.target.files[0]) {
                                    setCropState({ isOpen: true, file: e.target.files[0], type: 'profile_picture', aspect: 1 });
                                }
                                e.target.value = null;
                            }} />
                        </div>
                    </div>
                </div>

                {/* Shop Info & Stats */}
                <div style={{ marginTop: 60, padding: '0 30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                {editingName ? (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={nameInput}
                                            onChange={e => setNameInput(e.target.value)}
                                            style={{
                                                fontSize: '1.8rem', fontWeight: 'bold', background: 'var(--bg-secondary)',
                                                border: '1px solid var(--primary)', color: 'var(--text-primary)',
                                                padding: '2px 10px', borderRadius: 8, width: 250
                                            }}
                                            autoFocus
                                        />
                                        <button onClick={handleUpdateName} style={{ background: '#10b981', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer' }}>حفظ</button>
                                        <button onClick={() => setEditingName(false)} style={{ background: '#6b7280', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer' }}>✕</button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{shopData.name}</h1>
                                        {canEditShop && (
                                            <button
                                                onClick={() => { setEditingName(true); setNameInput(shopData.name); }}
                                                style={{
                                                    background: 'rgba(251, 171, 21, 0.15)', border: 'none', color: '#fbab15',
                                                    cursor: 'pointer', padding: '6px', borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s ease', marginLeft: '5px'
                                                }}
                                                title="تعديل الاسم"
                                                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                <EditIcon />
                                            </button>
                                        )}
                                    </div>
                                )}
                                {status && (
                                    <span style={{
                                        background: status.isOpen ? '#dcfce7' : '#fee2e2',
                                        color: status.isOpen ? '#166534' : '#991b1b',
                                        padding: '2px 8px', borderRadius: '15px', fontSize: '0.65rem', fontWeight: 'bold',
                                        border: `1px solid ${status.isOpen ? '#bbf7d0' : '#fecaca'}`,
                                        display: 'inline-flex', alignItems: 'center'
                                    }}>
                                        {status.text}
                                    </span>
                                )}
                            </div>
                            {editingCategory ? (
                                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 5 }}>
                                    <select
                                        className="input"
                                        value={categoryInput}
                                        onChange={e => setCategoryInput(e.target.value)}
                                        style={{ padding: '6px 10px', fontSize: '0.9rem', width: '200px' }}
                                        autoFocus
                                    >
                                        <option value="" disabled>اختر التصنيف</option>
                                        <option value="مكتب تاكسي">مكتب تاكسي 🚕</option>
                                        <option value="مطعم">مطعم 🍔</option>
                                        <option value="ملابس">ملابس 👕</option>
                                        <option value="سوبر ماركت">سوبر ماركت 🛒</option>
                                        <option value="إلكترونيات">إلكترونيات 📱</option>
                                        <option value="أخرى">أخرى (كتابة يدوية)</option>
                                    </select>
                                    {categoryInput === 'أخرى' && (
                                        <input
                                            className="input"
                                            placeholder="اكتب التصنيف..."
                                            onChange={e => setCategoryInput(e.target.value)}
                                            style={{ padding: '6px 10px', fontSize: '0.9rem', width: '150px' }}
                                        />
                                    )}
                                    <button onClick={handleCategoryUpdate} className="btn-small is-primary" style={{ padding: '6px 12px' }}>حفظ</button>
                                    <button onClick={() => setEditingCategory(false)} className="btn-small" style={{ padding: '6px 12px' }}>إلغاء</button>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', margin: '5px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {shopData.category}
                                    {canEditShop && (
                                        <button
                                            onClick={() => { setCategoryInput(shopData.category || ''); setEditingCategory(true); }}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--text-muted)', fontSize: '0.9rem', padding: 0,
                                                display: 'flex', alignItems: 'center'
                                            }}
                                            title="تعديل التصنيف"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        </button>
                                    )}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 20, marginTop: 10, color: 'var(--text-muted)' }}>
                                <span><b>{shopData.followers_count}</b> متابع</span>
                                <span><b>{posts.length}</b> منشور</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {currentUser?.role === 'admin' && (
                                <button onClick={handleDeleteShop} className="btn-small btn-reject" style={{ fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}>
                                    <TrashIcon /> حذف المحل
                                </button>
                            )}
                            <button onClick={handleFollow} className={`btn-small ${isFollowing ? 'btn-reject' : 'btn-accept'}`} style={{ fontFamily: 'inherit' }}>
                                {isFollowing ? 'إلغاء المتابعة' : 'متابعة'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Driver Dashboard (Shows if current user is a driver in this shop) */}
                {isDriver && shopData.category === 'مكتب تاكسي' && (
                    <div style={{
                        background: 'linear-gradient(135deg, #fbab15 0%, #f59e0b 100%)',
                        margin: '20px 30px',
                        padding: '20px',
                        borderRadius: 16,
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(251, 171, 21, 0.3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15 }}>
                            <div style={{ fontSize: '2rem' }}>🚕</div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>لوحة السائق</h3>
                                <p style={{ margin: '5px 0 0', opacity: 0.9, fontSize: '0.9rem' }}>أنت سائق في هذا المكتب</p>
                            </div>
                        </div>

                        {/* Driver Info */}
                        {(() => {
                            const myInfo = drivers.find(d => d.id === currentUser?.id);
                            if (!myInfo) return null;
                            return (
                                <div style={{
                                    background: 'rgba(255,255,255,0.15)',
                                    backdropFilter: 'blur(10px)',
                                    padding: 15,
                                    borderRadius: 12,
                                    marginBottom: 15
                                }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, fontSize: '0.9rem' }}>
                                        <div>
                                            <div style={{ opacity: 0.8 }}>السيارة</div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{myInfo.car_type || 'غير محدد'}</div>
                                        </div>
                                        <div>
                                            <div style={{ opacity: 0.8 }}>اللوحة</div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1rem', fontFamily: 'monospace' }}>{myInfo.plate_number || '---'}</div>
                                        </div>
                                        <div>
                                            <div style={{ opacity: 0.8 }}>الركاب</div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{myInfo.passengers_capacity || 4} 👤</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Active Requests */}
                        <div>
                            <h4 style={{ margin: '0 0 10px', fontSize: '1.1rem' }}>
                                الطلبات المُعينة لك ({myDriverRequests.length})
                            </h4>
                            {myDriverRequests.length === 0 ? (
                                <div style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    padding: 20,
                                    borderRadius: 12,
                                    textAlign: 'center',
                                    opacity: 0.8
                                }}>
                                    لا توجد طلبات حالياً
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {myDriverRequests.map(req => (
                                        <div key={req.id} style={{
                                            background: 'rgba(255,255,255,0.95)',
                                            color: '#1f2937',
                                            padding: 15,
                                            borderRadius: 12,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <img src={getImageUrl(req.profile_picture) || '/default-user.png'} style={{
                                                        width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fbab15'
                                                    }} />
                                                    <div>
                                                        <div style={{ fontWeight: 'bold' }}>{req.full_name || req.username}</div>
                                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>📞 {req.phone_number || 'غير متوفر'}</div>
                                                    </div>
                                                </div>
                                                <div style={{
                                                    background: req.status === 'accepted' ? '#dbeafe' : '#d1fae5',
                                                    color: req.status === 'accepted' ? '#1e40af' : '#065f46',
                                                    padding: '4px 10px',
                                                    borderRadius: 20,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {req.status === 'accepted' ? '✅ مقبول' : '🚗 في الطريق'}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 10 }}>
                                                📍 {req.pickup_address}
                                            </div>
                                            {req.status === 'accepted' && (
                                                <button
                                                    onClick={() => handleUpdateRequestStatus(req.id, 'arrived')}
                                                    style={{
                                                        width: '100%',
                                                        background: '#fbab15',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '10px',
                                                        borderRadius: 8,
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ✅ تأكيد الوصول
                                                </button>
                                            )}
                                            {req.status === 'arrived' && (
                                                <button
                                                    onClick={() => handleUpdateRequestStatus(req.id, 'completed')}
                                                    style={{
                                                        width: '100%',
                                                        background: '#10b981',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '10px',
                                                        borderRadius: 8,
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ✔️ إكمال الرحلة
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Navigation Tabs */}
                <div style={{
                    display: 'flex', gap: 30,
                    borderBottom: '1px solid var(--bg-tertiary)', marginTop: 25,
                    padding: '0 30px'
                }}>
                    {[
                        ...((shopData.category === 'صراف آلي' || shopData.category === 'فرع بنك') ? [] : ['products']),
                        'timeline',
                        ...((shopData.category === 'مكتب تاكسي' && canEditShop) ? ['requests', 'drivers'] : []),
                        ...(canEditShop ? ['simulate'] : []),
                        'about'
                    ].map(tab => (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab);
                                if (tab === 'drivers') loadDrivers();
                                if (tab === 'requests') loadRequests();
                            }}
                            style={{
                                border: 'none', background: 'none',
                                padding: '15px 5px',
                                fontSize: '1rem', fontWeight: activeTab === tab ? 'bold' : 'normal',
                                color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                                cursor: 'pointer',
                                fontFamily: 'inherit'
                            }}
                        >
                            {/* Make tab label dynamic */}
                            {(() => {
                                if (tab === 'products') {
                                    if (shopData.category === 'مكتب تاكسي') return 'الخدمات';
                                    if (shopData.category === 'مركز تسوق' || shopData.category === 'مجمع تجاري' || shopData.category === 'Mall') return 'الدليل';
                                    return 'المنتجات';
                                }
                                if (tab === 'timeline') return 'أخبار';
                                if (tab === 'drivers') return 'السائقين';
                                if (tab === 'requests') return 'الطلبات';
                                if (tab === 'mall_map') return 'خريطة المول 🗺️';
                                if (tab === 'simulate') return 'محاكي الأعمال';
                                return 'حول';
                            })()}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div style={{ padding: '30px', minHeight: '300px', background: 'var(--bg-secondary)' }}>

                    {/* --- Simulator Tab --- */}
                    {activeTab === 'simulate' && (
                        <div style={{ animation: 'fadeIn 0.5s', maxWidth: '600px', margin: '0 auto' }}>
                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>

                                <h2 style={{ margin: 0, color: '#fbab15' }}>محاكي الأعمال الذكي (MiroFish)</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>توقع أثر قراراتك التجارية قبل تنفيذها باستخدام الذكاء الاصطناعي</p>
                            </div>

                            {!simResult ? (
                                <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>اطرح سيناريو أو فرضية لتوقع نتيجتها:</label>
                                    <textarea
                                        className="input"
                                        value={simPrompt}
                                        onChange={(e) => setSimPrompt(e.target.value)}
                                        placeholder="مثال: ماذا لو قمت بعمل خصم 20% يوم الثلاثاء القادم، هل سيزيد المبيعات والربح؟"
                                        style={{ width: '100%', minHeight: '120px', resize: 'vertical', marginBottom: '15px' }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        disabled={isSimulating || !simPrompt.trim()}
                                        style={{ width: '100%', background: isSimulating ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', padding: '12px', fontSize: '1.1rem', fontWeight: 'bold', color: 'white', cursor: isSimulating ? 'not-allowed' : 'pointer', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                                        onClick={() => {
                                            setIsSimulating(true);
                                            setTimeout(() => {
                                                setIsSimulating(false);
                                                
                                                // Dynamic News and Local Contexts Integration
                                                const hasIncursion = Math.random() > 0.6; // 40% chance of military presence simulation
                                                let currentNews = "";
                                                let currentAdvice = "";
                                                
                                                if (hasIncursion) {
                                                    currentNews = "يوجد نشاط مكثف لجيش الاحتلال في المنطقة وتسكير لبعض الطرقات، مما يضعف الحركة.";
                                                    currentAdvice = "الوضع الأمني متوتر، إطلاق العرض الآن سيؤدي لخسارة لأن الشوارع فارغة والناس تلزم بيوتها لتجنب الخطر، ننصح بتأجيله حتى هدوء الأوضاع.";
                                                } else {
                                                    const normalNews = [
                                                        "حالة استقرار نسبي في المنطقة، حركة السير طبيعية والناس يخرجون بحرية.",
                                                        "الأوضاع الاقتصادية الحالية تجعل المستهلك يبحث عن التخفيضات المباشرة لتقليل المصاريف.",
                                                        "الطقس مستقر والحركة في السوق المحيطة نشطة، وقت ممتاز للترويج."
                                                    ];
                                                    currentNews = normalNews[Math.floor(Math.random() * normalNews.length)];
                                                    currentAdvice = "الأوضاع تسمح بالترويج، ننصح بتطبيق العرض لجذب الزوار وتنشيط المبيعات اليوم.";
                                                }
                                                
                                                // Grabbing real products from shopData to make AI aware of business type
                                                const shopProducts = (shopData?.data?.products || shopData?.products) || [];
                                                const getRandomProduct = () => shopProducts.length > 0 
                                                    ? shopProducts[Math.floor(Math.random() * shopProducts.length)].name 
                                                    : 'أحد منتجاتكم';

                                                const jobs = ["طالب جامعي", "موظف حكومي", "صانع محتوى", "ربة منزل", "مدير مبيعات", "مهندس", "صاحب عمل حر", "طبيب"];
                                                const budgets = ["متوسطة", "محدودة جداً", "مرتفعة", "حذرة"];
                                                
                                                const generateAgent = () => {
                                                    const prod = getRandomProduct();
                                                    
                                                    let agentThoughts = [];
                                                    if (hasIncursion) {
                                                        agentThoughts = [
                                                            `حياتي أهم من التخفيضات، لن أغادر المنزل بسبب تواجد الجيش.`,
                                                            `كنت أرغب حقاً بتجربة ${prod} لكن الوضع خطير بالخارج.`,
                                                            `الأوضاع في الشوارع المجاورة غير مستقرة، سألغي فكرة الخروج نهائياً.`
                                                        ];
                                                    } else {
                                                        agentThoughts = [
                                                            `العرض ممتاز، قمت بتوفير ميزانيتي خصيصاً لتجربة ${prod}.`,
                                                            `كنت أبحث عن سبب للخروج، هذا العرض على ${prod} جاء في وقته!`,
                                                            `سمعت الكثير عن ${prod} الخاصة بكم، العرض شجعني على القدوم.`,
                                                            `صنف مخفض؟ سأشتري ${prod} فقط وأمضي بسرعة لتوفير المال.`,
                                                            `لا يناسب ميزانيتي حالياً، سأنتظر عروضاً أقوى.`
                                                        ];
                                                    }

                                                    const personas = [
                                                        "اجتماعي ومبذر نسبياً", "حذر اقتصادياً ويراقب الأخبار", "يبحث عن الملاذ الهادئ", "يتأثر بالأحداث الأمنية ويفضل البقاء بالمنزل", "عملي يهمه التوفير", "يحب تجربة الأشياء الجديدة"
                                                    ];

                                                    return {
                                                        id: "#" + (Math.floor(Math.random() * 9000) + 1000),
                                                        message: agentThoughts[Math.floor(Math.random() * agentThoughts.length)],
                                                        details: {
                                                            age: Math.floor(Math.random() * 40) + 18,
                                                            job: jobs[Math.floor(Math.random() * jobs.length)],
                                                            budget: budgets[Math.floor(Math.random() * budgets.length)],
                                                            persona: personas[Math.floor(Math.random() * personas.length)]
                                                        }
                                                    };
                                                };
                                                
                                                let baseFollowers = parseInt(shopData?.followers_count, 10);
                                                if (isNaN(baseFollowers) || baseFollowers < 1) baseFollowers = 10;
                                                const realisticAgentsCount = Math.min(300, Math.max(50, baseFollowers * 5 + Math.floor(Math.random() * 20)));
                                                
                                                const dynamicLogs = [];
                                                for(let i = 0; i < realisticAgentsCount; i++) {
                                                    dynamicLogs.push(generateAgent());
                                                }

                                                setSimResult({
                                                    confidence: hasIncursion ? Math.floor(Math.random() * 5) + 90 : Math.floor(Math.random() * 15) + 80,
                                                    customersExpected: hasIncursion ? '-' + (Math.floor(Math.random() * 40) + 30) + '%' : '+' + (Math.floor(Math.random() * 30) + 12) + '%',
                                                    revenueExpected: hasIncursion ? '-' + (Math.floor(Math.random() * 50) + 20) + '%' : (Math.random() > 0.4 ? '+' : '-') + (Math.floor(Math.random() * 18)) + '%',
                                                    advice: currentAdvice + ` (السياق الإخباري: ${currentNews})`,
                                                    agentLogs: dynamicLogs
                                                });
                                            }, 2500);
                                        }}>
                                        {isSimulating ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <span className="spinner-small" style={{ borderColor: 'white', borderTopColor: 'transparent', width: '16px', height: '16px' }}></span>
                                                <span suppressHydrationWarning>جاري محاكاة الخوارزمية لعملاء المنطقة...</span>
                                            </div>
                                        ) : 'تشغيل المحاكاة'}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ background: 'var(--bg-primary)', padding: '25px', borderRadius: '12px', border: '1px solid var(--primary)', boxShadow: '0 8px 25px rgba(251, 171, 21, 0.15)', animation: 'fadeIn 0.4s ease-out' }}>
                                    <h3 style={{ margin: '0 0 20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>نتيجة المحاكاة التقريبية</h3>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                        <div style={{ background: '#dcfce7', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.9rem', color: '#166534', marginBottom: '5px', fontWeight: 'bold' }}>عدد الزوار المتوقع</div>
                                            <div style={{ fontSize: '1.8rem', color: '#15803d', fontWeight: '900', direction: 'ltr' }}>{simResult.customersExpected}</div>
                                        </div>
                                        <div style={{ background: '#fee2e2', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.9rem', color: '#991b1b', marginBottom: '5px', fontWeight: 'bold' }}>إجمالي الربح المتوقع</div>
                                            <div style={{ fontSize: '1.8rem', color: '#b91c1c', fontWeight: '900', direction: 'ltr' }}>{simResult.revenueExpected}</div>
                                        </div>
                                    </div>

                                    <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderRight: '4px solid #3b82f6' }}>
                                        <h4 style={{ margin: '0 0 8px', color: '#3b82f6' }}>ذكاء MiroFish (دقة {simResult.confidence}%):</h4>
                                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6' }}>{simResult.advice}</p>
                                    </div>

                                    <div style={{ marginBottom: '20px' }}>
                                        <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>تفاصيل عقول العملاء المبرمجين ({simResult.agentLogs.length} عميل):</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                                            {simResult.agentLogs.map((log, idx) => (
                                                <div key={idx} style={{ flexShrink: 0, background: 'var(--bg-tertiary)', borderRadius: '8px', overflow: 'hidden', border: expandedAgentIndex === idx ? '1px solid var(--primary)' : '1px solid transparent', transition: 'all 0.2s' }}>
                                                    <div
                                                        style={{ padding: '10px 12px', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                        onClick={() => setExpandedAgentIndex(expandedAgentIndex === idx ? null : idx)}
                                                    >
                                                        <span><span style={{ fontWeight: 'bold', color: '#fbab15' }}>العميل {log.id}:</span> {log.message}</span>
                                                        <span style={{ opacity: 0.5 }}>{expandedAgentIndex === idx ? '▲' : '▼'}</span>
                                                    </div>
                                                    {expandedAgentIndex === idx && (
                                                        <div style={{ background: 'var(--bg-primary)', padding: '12px', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                                                                <div><span style={{ opacity: 0.7 }}>العمر:</span> {log.details.age} سنة</div>
                                                                <div><span style={{ opacity: 0.7 }}>الوظيفة:</span> {log.details.job}</div>
                                                                <div><span style={{ opacity: 0.7 }}>الميزانية:</span> {log.details.budget}</div>
                                                                <div><span style={{ opacity: 0.7 }}>الشخصية:</span> {log.details.persona}</div>
                                                            </div>
                                                            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                                                {!agentChatStates[idx] ? (
                                                                    <button 
                                                                        className="btn btn-secondary"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setAgentChatStates(prev => ({...prev, [idx]: 'loading'}));
                                                                            setTimeout(() => {
                                                                                setAgentChatStates(prev => ({...prev, [idx]: 'replied'}));
                                                                            }, 2000);
                                                                        }}
                                                                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                                    >
                                                                        معرفة السبب المتوقع
                                                                    </button>
                                                                ) : agentChatStates[idx] === 'loading' ? (
                                                                    <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                        جاري استجواب العميل عبر خوارزمية السرب... <span className="spinner-small" style={{ borderColor: 'transparent', borderTopColor: 'var(--primary)' }}></span>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '4px solid var(--primary)', color: 'var(--text-primary)', fontSize: '0.9rem', animation: 'fadeIn 0.3s' }}>
                                                                        <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--primary)' }}>رد العميل {log.id}:</strong>
                                                                        "{log.message.includes('العرض ممتاز') || log.message.includes('جاء في وقته') || log.message.includes('شجعني') 
                                                                            ? 'لأكون صريحاً، أنا أنتبه لميزانيتي باستمرار وعرضك على هذا المنتج تحديداً كان ذكياً! وفر علي نقوداً كنت سأصرفها في مكان آخر.' 
                                                                            : 'الوضع بصراحة لا يشجع على الذهاب بأي شكل من الأشكال. ربما في ظروف أخرى أو لو وفرتم خدمة توصيل آمنة سأفكر في الأمر.'}"
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-secondary"
                                        style={{ width: '100%', marginTop: '10px' }}
                                        onClick={() => { setSimResult(null); setSimPrompt(''); }}
                                    >
                                        إجراء محاكاة جديدة
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- Products Tab --- */}
                    {/* --- Taxi Services Tab (Uber Style) --- */}
                    {activeTab === 'products' && shopData.category === 'مكتب تاكسي' && (
                        <div style={{ animation: 'fadeIn 0.5s' }}>
                            <div style={{ textAlign: 'center', padding: '30px 20px', background: 'linear-gradient(135deg, #fbab15 0%, #f59e0b 100%)', borderRadius: 16, color: 'white', marginBottom: 25, boxShadow: '0 4px 15px rgba(251, 171, 21, 0.3)' }}>
                                <h2 style={{ margin: '0 0 10px', fontSize: '1.8rem' }}>احجز رحلتك الآن</h2>
                                <p style={{ margin: '0 0 20px', opacity: 0.9 }}>أقرب سائق إليك على بعد نقرة واحدة</p>
                                <button className="pulse-button" style={{
                                    background: 'white', color: '#fbab15', border: 'none',
                                    padding: '15px 40px', borderRadius: 50, fontSize: '1.2rem', fontWeight: 'bold',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', transition: 'transform 0.2s'
                                }} onClick={handleRequestTaxi}>
                                    🚖 طلب أقرب تاكسي
                                </button>
                            </div>

                            <h3 style={{ margin: '0 0 15px', color: 'var(--text-primary)' }}>السائقون المتاحون ({drivers.length})</h3>

                            {loadingDrivers ? <div className="spinner"></div> : (
                                drivers.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>لا يوجد سائقين متاحين حالياً.</p> :
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                                        {drivers.map(driver => (
                                            <div key={driver.id} style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 15, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                                    <div style={{ position: 'relative' }}>
                                                        <img src={getImageUrl(driver.profile_picture) || '/default-user.png'} style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fbab15' }} />
                                                        <div style={{ position: 'absolute', bottom: -5, right: -5, background: '#fbab15', color: 'white', borderRadius: '50%', padding: 4, fontSize: '0.7rem' }}>🚕</div>
                                                    </div>
                                                    <div>
                                                        <h4 style={{ margin: 0 }}>{driver.full_name || driver.username}</h4>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                            ⭐ 4.9 • كابتن
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontSize: '0.9rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>السيارة:</span>
                                                        <span style={{ fontWeight: 'bold' }}>{driver.car_type || 'غير محدد'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>اللوحة:</span>
                                                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{driver.plate_number || '---'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>الركاب:</span>
                                                        <span style={{ fontWeight: 'bold' }}>{driver.passengers_capacity || 4} 👤</span>
                                                    </div>
                                                </div>

                                                <button style={{
                                                    background: '#fbab15', color: 'white', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginTop: 'auto'
                                                }} onClick={() => {
                                                    alert(`تم إرسال طلب للكابتن ${driver.username}.`);
                                                }}>
                                                    طلب هذا السائق
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                            )}
                        </div>
                    )}

                    {/* --- Bank View --- */}
                    {activeTab === 'products' && shopData.category === 'بنك' && (
                        <div style={{ animation: 'fadeIn 0.5s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, flexWrap: 'wrap', gap: 15 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                    <div style={{ background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-color)', width: 50, height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        🏦
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>شبكة {shopData.name}</h2>
                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>استكشف الفروع والصرافات الآلية التابعة للبنك</p>
                                    </div>
                                </div>
                                {canEditShop && (
                                    <button
                                        onClick={() => setShowAddInternalShop(!showAddInternalShop)}
                                        style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                    >
                                        {showAddInternalShop ? 'إلغاء' : '+ إضافة فرع/صراف'}
                                    </button>
                                )}
                            </div>

                            {showAddInternalShop && (
                                <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 16, marginBottom: 25, border: '1px solid var(--border-color)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
                                    <h3 style={{ marginTop: 0, marginBottom: 20, color: 'var(--text-primary)' }}>تسجيل فرع أو صراف آلي جديد</h3>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        try {
                                            const lat = parseFloat(newInternalShopData.lat || shopData.latitude);
                                            const lon = parseFloat(newInternalShopData.lon || shopData.longitude);

                                            if (isNaN(lat) || isNaN(lon)) {
                                                alert('الرجاء إدخال إحداثيات صحيحة أو تركها لتأخذ إحداثيات الفرع الرئيسي');
                                                return;
                                            }

                                            // Ensure we are using the generic system logic for hierarchical shops
                                            await shopService.create({
                                                name: newInternalShopData.name,
                                                category: newInternalShopData.category, // 'فرع بنك' or 'صراف آلي'
                                                parent_shop_id: shopData.id,
                                                latitude: lat,
                                                longitude: lon
                                            });
                                            alert('تم الإضافة بنجاح');
                                            setShowAddInternalShop(false);
                                            loadShopData(); // Reload to get new banks
                                            setNewInternalShopData({ name: '', category: 'فرع بنك', floor: '', lat: '', lon: '' });
                                        } catch (error) {
                                            console.error("Failed to add bank child", error);
                                            alert("حدث خطأ أثناء الإضافة");
                                        }
                                    }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>الاسم (مثال: فرع رام الله، صراف الإرسال)</label>
                                            <input
                                                className="input"
                                                value={newInternalShopData.name}
                                                onChange={e => setNewInternalShopData({ ...newInternalShopData, name: e.target.value })}
                                                required
                                                style={{ width: '100%', padding: '12px' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>النوع</label>
                                            <select
                                                className="input"
                                                value={newInternalShopData.category}
                                                onChange={e => setNewInternalShopData({ ...newInternalShopData, category: e.target.value })}
                                                required
                                                style={{ width: '100%', padding: '12px' }}
                                            >
                                                <option value="فرع بنك">فرع بنك</option>
                                                <option value="صراف آلي">صراف آلي</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>خط العرض (Latitude) - اختياري</label>
                                            <input
                                                className="input"
                                                type="number" step="any"
                                                placeholder={shopData.latitude}
                                                value={newInternalShopData.lat || ''}
                                                onChange={e => setNewInternalShopData({ ...newInternalShopData, lat: e.target.value })}
                                                style={{ width: '100%', padding: '12px' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>خط الطول (Longitude) - اختياري</label>
                                            <input
                                                className="input"
                                                type="number" step="any"
                                                placeholder={shopData.longitude}
                                                value={newInternalShopData.lon || ''}
                                                onChange={e => setNewInternalShopData({ ...newInternalShopData, lon: e.target.value })}
                                                style={{ width: '100%', padding: '12px' }}
                                            />
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>اتركه فارغاً لاعتماد موقع البنك الحالي</p>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                                            <button type="submit" className="btn-small is-primary" style={{ padding: '12px 30px', fontSize: '1rem', background: 'var(--primary)', border: 'none', color: 'white' }}>تأكيد الإضافة</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {internalShops.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px', background: 'var(--bg-primary)', borderRadius: 16, color: 'var(--text-primary)' }}>
                                    <h3>لا توجد فروع أو صرافات مسجلة حالياً</h3>
                                    <p style={{ color: 'var(--text-muted)' }}>يمكنك البدء بإنشاء شبكة فروع البنك لعرضها على الخريطة</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Group by Category (ATM/Branch) */}
                                    {['فرع بنك', 'صراف آلي'].map(category => {
                                        const items = internalShops.filter(s => s.category === category);
                                        if (items.length === 0) return null;
                                        return (
                                            <div key={category}>
                                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '2px solid var(--border-color)', marginBottom: 15, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                                                    {category === 'صراف آلي' ? '🏧 ' : '🏦 '} {category === 'صراف آلي' ? 'الصرافات الآلية' : 'الفروع'}
                                                </h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 15 }}>
                                                    {items.map(s => (
                                                        <div
                                                            key={s.id}
                                                            onClick={async () => {
                                                                try {
                                                                    const data = await shopService.getProfile(s.id);
                                                                    setShopData(data.shop);
                                                                    setInternalShops(data.internal_shops || []);
                                                                    setProducts(data.products || []);
                                                                    setPosts(data.posts || []);
                                                                    setIsFollowing(data.shop.is_followed);
                                                                    setActiveTab((data.shop.category === 'صراف آلي' || data.shop.category === 'فرع بنك') ? 'about' : 'products');
                                                                    const container = document.querySelector('.modal-container');
                                                                    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
                                                                } catch (error) {
                                                                    console.error("Failed to load internal profile", error);
                                                                }
                                                            }}
                                                            style={{
                                                                background: 'var(--bg-primary)', padding: 15, borderRadius: 12, border: '1px solid var(--border-color)',
                                                                display: 'flex', gap: 15, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                                            }}
                                                            onMouseOver={e => {
                                                                e.currentTarget.style.transform = 'translateY(-3px)';
                                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                            }}
                                                            onMouseOut={e => {
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                                            }}
                                                        >
                                                            <div style={{ position: 'relative' }}>
                                                                <div style={{ width: 60, height: 60, borderRadius: 10, background: 'white', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontSize: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                                    {category === 'صراف آلي' ? '🏧' : '🏦'}
                                                                </div>
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 2 }}>{s.name}</div>
                                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.category}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- Regular Products Tab --- */}
                    {activeTab === 'products' &&
                        shopData.category !== 'مكتب تاكسي' &&
                        shopData.category !== 'بنك' &&
                        !(shopData.category === 'مركز تسوق' || shopData.category === 'مجمع تجاري' || shopData.category === 'Mall') && (
                            <div>
                                {canEditShop && (
                                    <button className="btn-small is-primary" style={{ marginBottom: 20 }} onClick={() => {
                                        setEditingProduct(null);
                                        setNewProduct({ name: '', price: '', old_price: '', description: '', image: null, category: '' });
                                        setProductImages([]);
                                        setShowAddProduct(true);
                                    }}>
                                        + إضافة منتج
                                    </button>
                                )}

                                {showAddProduct && (
                                    <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 12, marginBottom: 20 }}>
                                        <h3 style={{ marginTop: 0 }}>
                                            {editingProduct
                                                ? (shopData.category === 'مكتب تاكسي' ? 'تعديل الخدمة' : 'تعديل المنتج')
                                                : (shopData.category === 'مكتب تاكسي' ? 'خدمة توصيل جديدة' : 'منتج جديد')}
                                        </h3>
                                        <form onSubmit={handleSaveProduct}>
                                            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', marginBottom: 5 }}>
                                                        {shopData.category === 'مكتب تاكسي' ? 'اسم الوجهة/الخدمة' : 'اسم المنتج'}
                                                    </label>
                                                    <input className="input" type="text" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required style={{ width: '100%' }} placeholder={shopData.category === 'مكتب تاكسي' ? 'مثال: توصيلة للمطار' : ''} />
                                                </div>
                                                {(['سوبر ماركت', 'سوبرماركت', 'Supermarket', 'supermarket'].includes(shopData.category)) && (
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', marginBottom: 5 }}>القسم</label>
                                                        <select
                                                            className="input"
                                                            value={newProduct.category}
                                                            onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                                                            style={{ width: '100%', padding: '8px' }}
                                                        >
                                                            <option value="">اختر القسم...</option>
                                                            {SUPERMARKET_CATEGORIES.filter(c => c !== 'الكل').map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                                <div style={{ width: '100px' }}>
                                                    <label style={{ display: 'block', marginBottom: 5 }}>
                                                        {shopData.category === 'مكتب تاكسي' ? 'التكلفة' : 'السعر الحالي'}
                                                    </label>
                                                    <input className="input" type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} required style={{ width: '100%' }} />
                                                </div>
                                                <div style={{ width: '100px' }}>
                                                    <label style={{ display: 'block', marginBottom: 5 }}>
                                                        {shopData.category === 'مكتب تاكسي' ? 'سعر سابق' : 'السعر القديم'}
                                                    </label>
                                                    <input className="input" type="number" value={newProduct.old_price} onChange={e => setNewProduct({ ...newProduct, old_price: e.target.value })} style={{ width: '100%' }} placeholder="اختياري" />
                                                </div>
                                            </div>
                                            <textarea
                                                className="input"
                                                placeholder={shopData.category === 'مكتب تاكسي' ? 'تفاصيل الرحلة، نوع السيارة، عدد الركاب المسموح...' : 'وصف المنتج...'}
                                                value={newProduct.description}
                                                onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                                                style={{ width: '100%', marginBottom: 10 }}
                                            ></textarea>
                                            <div style={{ marginBottom: 15 }}>
                                                <div
                                                    onClick={() => document.getElementById('product-image-input').click()}
                                                    style={{
                                                        border: '2px dashed var(--border-color)',
                                                        borderRadius: 12,
                                                        padding: 20,
                                                        textAlign: 'center',
                                                        cursor: 'pointer',
                                                        background: 'var(--bg-secondary)',
                                                        transition: 'all 0.2s',
                                                        minHeight: '120px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                                >
                                                    {productImages.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                                                            {productImages.map((img, idx) => (
                                                                <div key={idx} style={{ position: 'relative' }}>
                                                                    <img src={URL.createObjectURL(img)} style={{ height: 60, width: 60, objectFit: 'cover', borderRadius: 8 }} />
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const updated = [...productImages];
                                                                            updated.splice(idx, 1);
                                                                            setProductImages(updated);
                                                                        }}
                                                                        style={{
                                                                            position: 'absolute', top: -5, right: -5,
                                                                            background: '#ef4444', color: 'white',
                                                                            border: 'none', borderRadius: '50%',
                                                                            width: 18, height: 18, cursor: 'pointer',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px'
                                                                        }}
                                                                    >✕</button>
                                                                </div>
                                                            ))}
                                                            <div style={{ width: 60, height: 60, border: '2px dashed var(--border-color)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>+</div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            {shopData.category === 'مكتب تاكسي' ? <TaxiIcon /> : <PhotoIcon />}
                                                            <span style={{ marginTop: 8, fontSize: '0.9rem' }}>
                                                                {editingProduct ? 'إضافة/تغيير الصور (يمكنك اختيار عدة صور)' : (shopData.category === 'مكتب تاكسي' ? 'اضغط لإضافة صورة للسيارة/الوجهة' : 'اضغط لإضافة صور المنتج (يمكنك اختيار عدة صور)')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    id="product-image-input"
                                                    type="file"
                                                    multiple
                                                    onChange={e => setProductImages([...productImages, ...Array.from(e.target.files)])}
                                                    accept="image/*"
                                                    hidden
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                                <button type="button" className="btn-small" onClick={() => setShowAddProduct(false)} style={{ flex: 1 }}>إلغاء</button>
                                                <button type="submit" className="btn-small is-primary" style={{ flex: 2 }}>حفظ</button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {/* Supermarket Categories Bar */}
                                {(['سوبر ماركت', 'سوبرماركت', 'Supermarket', 'supermarket'].includes(shopData.category)) && (
                                    <div style={{
                                        display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 15, marginBottom: 20,
                                        scrollbarWidth: 'none', msOverflowStyle: 'none',
                                        paddingTop: '5px'
                                    }}>
                                        {SUPERMARKET_CATEGORIES.map(cat => {
                                            const isActive = selectedProductCategory === cat;
                                            return (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSelectedProductCategory(cat)}
                                                    style={{
                                                        whiteSpace: 'nowrap', padding: '10px 22px', borderRadius: 30,
                                                        border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                        cursor: 'pointer', fontWeight: 'bold',
                                                        fontFamily: "'Tajawal', sans-serif",
                                                        background: isActive ? 'var(--primary)' : 'var(--bg-secondary)',
                                                        color: isActive ? 'white' : 'var(--text-primary)',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        boxShadow: isActive ? '0 8px 20px rgba(251, 171, 21, 0.35)' : '0 2px 5px rgba(0,0,0,0.05)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.95rem',
                                                        flexShrink: 0
                                                    }}
                                                    onMouseOver={e => {
                                                        if (!isActive) {
                                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                        }
                                                    }}
                                                    onMouseOut={e => {
                                                        if (!isActive) {
                                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                        }
                                                    }}
                                                >
                                                    {cat}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div style={{ marginBottom: 25 }}>
                                    <div style={{ position: 'relative', marginBottom: 15 }}>
                                        <input
                                            className="input"
                                            type="text"
                                            placeholder={shopData.category === 'مكتب تاكسي' ? 'بحث في الوجهات/الخدمات...' : 'بحث في المنتجات...'}
                                            value={productSearchQuery}
                                            onChange={e => setProductSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '12px 45px 12px 15px',
                                                borderRadius: '12px',
                                                fontSize: '1rem',
                                                fontFamily: "'Tajawal', sans-serif"
                                            }}
                                        />
                                        <div style={{ position: 'absolute', top: '50%', right: '15px', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
                                            <SearchIcon />
                                        </div>
                                    </div>

                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                                    {products
                                        .filter(p => {
                                            const matchesSearch = (p.name || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                                                (p.description && p.description.toLowerCase().includes(productSearchQuery.toLowerCase()));

                                            // Category filter for supermarket
                                            const matchesCategory = selectedProductCategory === 'الكل' ||
                                                (selectedProductCategory === 'العروض' && p.old_price && parseFloat(p.old_price) > parseFloat(p.price)) ||
                                                (p.category === selectedProductCategory);

                                            // Sale check: has old_price AND old_price > price
                                            const isOnSale = p.old_price && parseFloat(p.old_price) > parseFloat(p.price);

                                            if (['سوبر ماركت', 'سوبرماركت', 'Supermarket', 'supermarket'].includes(shopData.category) && !matchesCategory) return false;
                                            return matchesSearch;
                                        })
                                        .length === 0 ? <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: '20px' }}>
                                        {products.length === 0 ? 'لا توجد منتجات.' : 'لا توجد منتجات تطابق البحث/الفلتر.'}
                                    </p> :
                                        products
                                            .filter(p => {
                                                const matchesSearch = (p.name || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                                                    (p.description && p.description.toLowerCase().includes(productSearchQuery.toLowerCase()));

                                                // Category filter for supermarket
                                                const matchesCategory = selectedProductCategory === 'الكل' ||
                                                    (selectedProductCategory === 'العروض' && p.old_price && parseFloat(p.old_price) > parseFloat(p.price)) ||
                                                    (p.category === selectedProductCategory);

                                                const isOnSale = p.old_price && parseFloat(p.old_price) > parseFloat(p.price);

                                                if (['سوبر ماركت', 'سوبرماركت', 'Supermarket', 'supermarket'].includes(shopData.category) && !matchesCategory) return false;
                                                return matchesSearch;
                                            })
                                            .map(product => {
                                                // Start Taxi Custom Design
                                                if (shopData.category === 'مكتب تاكسي') {
                                                    return (
                                                        <div key={product.id} style={{
                                                            background: 'var(--bg-primary)',
                                                            borderRadius: 16,
                                                            overflow: 'hidden',
                                                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                                            border: '1px solid #fbab15', // Taxi Yellow Border
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            position: 'relative'
                                                        }}>
                                                            {/* Taxi Header Stripe */}
                                                            <div style={{ height: '8px', background: 'repeating-linear-gradient(45deg, #000, #000 10px, #fbab15 10px, #fbab15 20px)' }}></div>

                                                            <div style={{ padding: 15, flex: 1 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <h4 style={{ margin: '0 0 5px', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{product.name}</h4>
                                                                    <span style={{
                                                                        background: '#fbab15', color: '#000',
                                                                        fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', fontSize: '0.9rem'
                                                                    }}>
                                                                        {product.price} ₪
                                                                    </span>
                                                                </div>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                                                    {product.old_price && parseFloat(product.old_price) > parseFloat(product.price) && (
                                                                        <span style={{ color: '#ef4444', textDecoration: 'line-through', fontSize: '0.85rem' }}>{product.old_price} ₪</span>
                                                                    )}
                                                                </div>

                                                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 15px', lineHeight: '1.4' }}>
                                                                    {product.description || 'خدمة توصيل سريعة وآمنة.'}
                                                                </p>

                                                                {/* Image if available, simplified for taxi */}
                                                                {product.image_url && (
                                                                    <div style={{ height: '100px', marginBottom: 15, borderRadius: '8px', overflow: 'hidden' }}>
                                                                        <img src={getImageUrl(product.image_url)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Actions */}
                                                            <div style={{ padding: '0 15px 15px', display: 'flex', gap: 10 }}>
                                                                <button
                                                                    onClick={() => {
                                                                        const note = window.prompt('(اختياري) ملاحظات للسائق أو تفاصيل الموقع:', '');
                                                                        if (note !== null) {
                                                                            cartService.addItem({ ...product, shop_name: shopData.name, note: note });
                                                                            alert('تم إضافة الحجز إلى قائمة رحلاتك! يرجى تأكيد الطلب من السلة. 🚖');
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        flex: 1, padding: '10px',
                                                                        background: '#000', color: '#fbab15',
                                                                        border: 'none', borderRadius: '8px',
                                                                        cursor: 'pointer', fontWeight: 'bold',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                                                                    }}
                                                                >
                                                                    <span>حجز الآن</span>
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                                                </button>
                                                                {canEditShop && (
                                                                    <>
                                                                        <button onClick={() => openEditProduct(product)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', width: 40, cursor: 'pointer' }}>✏️</button>
                                                                        <button onClick={() => handleDeleteProduct(product.id)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', width: 40, cursor: 'pointer' }}>×</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                // End Taxi Custom Design

                                                // Default Design
                                                return (
                                                    <div key={product.id} style={{ background: 'var(--bg-primary)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', transition: 'transform 0.2s' }}>
                                                        <div style={{ aspectRatio: '1/1', background: '#f3f4f6', position: 'relative', borderBottom: '1px solid var(--bg-tertiary)' }}>
                                                            {/* Instagram-like Image Carousel */}
                                                            {product.image_urls && product.image_urls.length > 0 ? (
                                                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                                                    <ProductImageSlider images={product.image_urls} getImageUrl={getImageUrl} />
                                                                </div>
                                                            ) : product.image_url ? (
                                                                <img
                                                                    src={getImageUrl(product.image_url)}
                                                                    alt={product.name}
                                                                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }}
                                                                />
                                                            ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa' }}>No Image</div>}

                                                            {canEditShop && (
                                                                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 5, zIndex: 10 }}>
                                                                    <button onClick={() => openEditProduct(product)} style={{ background: 'rgba(255, 255, 255, 0.9)', color: '#333', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>✏️</button>
                                                                    <button onClick={() => handleDeleteProduct(product.id)} style={{ background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>×</button>
                                                                </div>
                                                            )}

                                                            {/* Sale Badge */}
                                                            {product.old_price && parseFloat(product.old_price) > parseFloat(product.price) && (
                                                                <div style={{ position: 'absolute', top: 10, left: 10, background: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 5 }}>
                                                                    عرض خاص
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ padding: 15 }}>
                                                            <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{product.name}</h4>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                                                                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>{product.price} شيكل</div>
                                                                {product.old_price && parseFloat(product.old_price) > parseFloat(product.price) && (
                                                                    <div style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: '0.9rem' }}>{product.old_price} شيكل</div>
                                                                )}
                                                            </div>

                                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '8px 0', lineHeight: '1.5' }}>{product.description}</p>
                                                            <button
                                                                onClick={() => {
                                                                    cartService.addItem({ ...product, shop_name: shopData.name });
                                                                    alert('تمت الإضافة للسلة');
                                                                }}
                                                                style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                                                            >
                                                                اضافة للسلة
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                    }
                                </div>

                                {/* Floating Cart Button */}
                                <button
                                    onClick={() => setShowCart(true)}
                                    style={{
                                        position: 'fixed', bottom: 30, left: 20, zIndex: 2100,
                                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                        border: '2px solid var(--primary)', borderRadius: '50px',
                                        padding: '10px 18px', fontSize: '1rem', fontWeight: 'bold',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: 'pointer'
                                    }}
                                >
                                    {shopData.category === 'مكتب تاكسي' ? 'حجوزاتي' : 'السلة'} 🛒
                                    {cartCount > 0 && <span style={{ background: 'red', color: 'white', borderRadius: '50%', padding: '1px 7px', fontSize: '0.85rem' }}>{cartCount}</span>}
                                </button>
                            </div>
                        )}

                    {activeTab === 'drivers' && (
                        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <h3 style={{ borderBottom: '2px solid #fbab15', paddingBottom: 10, marginBottom: 20 }}>🚖 إدارة السائقين (التاكسي)</h3>

                            {/* Add Driver Form */}
                            <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 12, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                <h4 style={{ margin: '0 0 10px' }}>إضافة سائق جديد</h4>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 10 }}>أدخل اسم المستخدم (Username) للمستخدم الذي تريد تعيينه كسائق. سيظهر موقعه لمتابعي المكتب.</p>
                                <form onSubmit={handleAddDriver} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <input
                                        className="input"
                                        value={newDriverData.username}
                                        onChange={e => setNewDriverData({ ...newDriverData, username: e.target.value })}
                                        placeholder="اسم المستخدم (Username) للسائق"
                                        required
                                        style={{ width: '100%' }}
                                    />
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                        <input
                                            className="input"
                                            value={newDriverData.car_type}
                                            onChange={e => setNewDriverData({ ...newDriverData, car_type: e.target.value })}
                                            placeholder="نوع السيارة (مثال: Toyota Prius)"
                                            style={{ flex: 1, minWidth: '150px' }}
                                        />
                                        <input
                                            className="input"
                                            value={newDriverData.plate_number}
                                            onChange={e => setNewDriverData({ ...newDriverData, plate_number: e.target.value })}
                                            placeholder="رقم اللوحة"
                                            style={{ flex: 1, minWidth: '120px' }}
                                        />
                                        <input
                                            className="input"
                                            type="number"
                                            value={newDriverData.passengers}
                                            onChange={e => setNewDriverData({ ...newDriverData, passengers: e.target.value })}
                                            placeholder="ركاب"
                                            style={{ width: 80 }}
                                            min="1" max="10"
                                        />
                                    </div>
                                    <button type="submit" className="btn-small is-primary" style={{ alignSelf: 'flex-end' }}>+ إضافة السائق</button>
                                </form>
                            </div>

                            {/* Drivers List */}
                            <div>
                                <h4 style={{ margin: '0 0 15px' }}>السائقين الحاليين ({drivers.length})</h4>
                                {loadingDrivers ? <div className="spinner"></div> : (
                                    drivers.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>لا يوجد سائقين مسجلين.</p> :
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {drivers.map(driver => (
                                                <div key={driver.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '12px', borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                                        <div style={{ position: 'relative' }}>
                                                            <img
                                                                src={getImageUrl(driver.profile_picture) || '/default-user.png'}
                                                                style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }}
                                                                alt={driver.username}
                                                            />
                                                            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, background: driver.latitude ? '#22c55e' : '#9ca3af', border: '2px solid white', borderRadius: '50%' }} title={driver.latitude ? 'متصل (موقعه متاح)' : 'غير متصل'}></span>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{driver.full_name || driver.username}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>@{driver.username}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveDriver(driver.id)}
                                                        style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
                                                    >
                                                        إزالة
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'requests' && (
                        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <h3 style={{ borderBottom: '2px solid #fbab15', paddingBottom: 10, marginBottom: 20 }}>📋 طلبات التاكسي الحالية</h3>

                            {loadingRequests ? <div className="spinner"></div> : (
                                requests.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>لا توجد طلبات حالياً</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                                        {requests.map(req => (
                                            <div key={req.id} style={{
                                                background: 'var(--bg-primary)', borderRadius: 12, padding: 20,
                                                border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                                        <img src={getImageUrl(req.profile_picture) || '/default-user.png'} style={{
                                                            width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fbab15'
                                                        }} />
                                                        <div>
                                                            <h4 style={{ margin: 0 }}>{req.full_name || req.username}</h4>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📞 {req.phone_number || 'غير متوفر'}</div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                                                📍 {req.pickup_address}
                                                            </div>
                                                            {/* Additional User Info */}
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 15px', marginTop: 8 }}>
                                                                {req.marital_status && (
                                                                    <div style={{ fontSize: '0.75rem', color: '#fbab15', fontWeight: '600' }}>
                                                                        💍 {req.marital_status}
                                                                    </div>
                                                                )}
                                                                {req.workplace && (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        💼 {req.workplace}
                                                                    </div>
                                                                )}
                                                                {(req.education || req.institution) && (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        🎓 {req.education || ''} {req.institution ? `(${req.institution})` : ''}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        background: req.status === 'pending' ? '#fef3c7' : req.status === 'accepted' ? '#dbeafe' : '#d1fae5',
                                                        color: req.status === 'pending' ? '#92400e' : req.status === 'accepted' ? '#1e40af' : '#065f46',
                                                        padding: '5px 12px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 'bold'
                                                    }}>
                                                        {req.status === 'pending' ? '⏳ قيد الانتظار' : req.status === 'accepted' ? '✅ تم القبول' : '🚗 في الطريق'}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <select
                                                                style={{
                                                                    flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)',
                                                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)'
                                                                }}
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        handleUpdateRequestStatus(req.id, 'accepted', e.target.value);
                                                                    }
                                                                }}
                                                                defaultValue=""
                                                            >
                                                                <option value="">اختر سائق...</option>
                                                                {drivers.map(d => (
                                                                    <option key={d.id} value={d.id}>{d.full_name || d.username} - {d.car_type}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => handleUpdateRequestStatus(req.id, 'cancelled')}
                                                                style={{
                                                                    background: '#fee2e2', color: '#ef4444', border: 'none',
                                                                    padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold'
                                                                }}
                                                            >
                                                                إلغاء
                                                            </button>
                                                        </>
                                                    )}
                                                    {req.status === 'accepted' && (
                                                        <button
                                                            onClick={() => handleUpdateRequestStatus(req.id, 'arrived')}
                                                            style={{
                                                                flex: 1, background: '#fbab15', color: 'white', border: 'none',
                                                                padding: '10px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold'
                                                            }}
                                                        >
                                                            ✅ تأكيد الوصول
                                                        </button>
                                                    )}
                                                    {req.status === 'arrived' && (
                                                        <button
                                                            onClick={() => handleUpdateRequestStatus(req.id, 'completed')}
                                                            style={{
                                                                flex: 1, background: '#10b981', color: 'white', border: 'none',
                                                                padding: '10px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold'
                                                            }}
                                                        >
                                                            ✔️ إكمال الرحلة
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {showCart && <CartModal onClose={() => setShowCart(false)} />}

                    {/* --- Mall Directory View --- */}
                    {activeTab === 'products' && (shopData.category === 'مركز تسوق' || shopData.category === 'مجمع تجاري' || shopData.category === 'Mall') && (
                        <div style={{ animation: 'fadeIn 0.5s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, flexWrap: 'wrap', gap: 15 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                    <div style={{ background: 'var(--primary)', color: 'white', width: 50, height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <MallIcon />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>دليل المحلات</h2>
                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>تصفح المتاجر والخدمات داخل {shopData.name}</p>
                                    </div>
                                </div>
                                {canEditShop && (
                                    <button
                                        onClick={() => setShowAddInternalShop(!showAddInternalShop)}
                                        style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                    >
                                        {showAddInternalShop ? 'إلغاء' : '+ إضافة محل'}
                                    </button>
                                )}
                            </div>

                            {showAddInternalShop && (
                                <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 16, marginBottom: 25, border: '2px solid var(--primary)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
                                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>تسجيل محل جديد في المجمع</h3>
                                    <form onSubmit={handleAddInternalShop} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>اسم المحل</label>
                                            <input
                                                className="input"
                                                placeholder="مثال: ديفاكتو، مطعم زيت وزعتر..."
                                                value={newInternalShopData.name}
                                                onChange={e => setNewInternalShopData({ ...newInternalShopData, name: e.target.value })}
                                                required
                                                style={{ width: '100%', padding: '12px' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>التصنيف</label>
                                            <select
                                                className="input"
                                                value={newInternalShopData.category}
                                                onChange={e => setNewInternalShopData({ ...newInternalShopData, category: e.target.value })}
                                                required
                                                style={{ width: '100%', padding: '12px' }}
                                            >
                                                <option value="">اختر التصنيف...</option>
                                                <option value="ملابس">ملابس</option>
                                                <option value="أحذية">أحذية</option>
                                                <option value="إلكترونيات">إلكترونيات</option>
                                                <option value="مطعم">مطعم</option>
                                                <option value="كافيه">كافيه</option>
                                                <option value="سوبر ماركت">سوبر ماركت</option>
                                                <option value="عطور">عطور</option>
                                                <option value="أخرى">أخرى</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>الطابق</label>
                                            <select
                                                className="input"
                                                value={newInternalShopData.floor}
                                                onChange={e => setNewInternalShopData({ ...newInternalShopData, floor: e.target.value })}
                                                required
                                                style={{ width: '100%', padding: '12px' }}
                                            >
                                                <option value="">اختيار الطابق...</option>
                                                <option value="الأرضي">الطابق الأرضي</option>
                                                <option value="الأول">الطابق الأول</option>
                                                <option value="الثاني">الطابق الثاني</option>
                                                <option value="الثالث">الطابق الثالث</option>
                                                <option value="B1">الطابق B1</option>
                                                <option value="B2">الطابق B2</option>
                                            </select>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                                            <button type="submit" className="btn-small is-primary" style={{ padding: '12px 30px', fontSize: '1rem' }}>تأكيد الإضافة</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {internalShops.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px', background: 'var(--bg-primary)', borderRadius: 16, color: 'var(--text-muted)' }}>
                                    <h3>لا توجد محلات مسجلة حالياً</h3>
                                    <p>المجمع لا يزال جديداً، ترقبوا الافتتاحات قريباً!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Group by Floor */}
                                    {['الأرضي', 'الأول', 'الثاني', 'الثالث', 'B1', 'B2'].map(floor => {
                                        const floorShops = internalShops.filter(s => s.floor === floor);
                                        if (floorShops.length === 0) return null;
                                        return (
                                            <div key={floor}>
                                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '2px solid var(--primary)', marginBottom: 15, fontSize: '1.2rem' }}>
                                                    <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 10px', borderRadius: 6, fontSize: '0.9rem' }}>الطابق {floor}</span>
                                                </h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 15 }}>
                                                    {floorShops.map(s => (
                                                        <div
                                                            key={s.id}
                                                            onClick={async () => {
                                                                try {
                                                                    const data = await shopService.getProfile(s.id);
                                                                    setShopData(data.shop);
                                                                    setInternalShops(data.internal_shops || []);
                                                                    setProducts(data.products || []);
                                                                    setPosts(data.posts || []);
                                                                    setIsFollowing(data.shop.is_followed);
                                                                    setActiveTab('products');
                                                                    // Smoothly scroll to top of modal
                                                                    const container = document.querySelector('.modal-container');
                                                                    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
                                                                } catch (error) {
                                                                    console.error("Failed to load internal shop profile", error);
                                                                }
                                                            }}
                                                            style={{
                                                                background: 'var(--bg-primary)', padding: 15, borderRadius: 12, border: '1px solid var(--border-color)',
                                                                display: 'flex', gap: 15, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                                            }}
                                                            onMouseOver={e => {
                                                                e.currentTarget.style.transform = 'translateY(-3px)';
                                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                            }}
                                                            onMouseOut={e => {
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                                            }}
                                                        >
                                                            <div style={{ position: 'relative' }}>
                                                                <img src={getImageUrl(s.profile_picture) || '/default-shop.png'} style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover' }} />
                                                                {s.is_verified && <div style={{ position: 'absolute', top: -5, right: -5, background: '#1da1f2', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: 2 }}>{s.name}</div>
                                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.category}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- Timeline Tab --- */}
                    {activeTab === 'timeline' && (
                        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                            {canEditShop && (
                                <div className="create-post-card" style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 16, marginBottom: 25, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                    <h3 style={{ margin: '0 0 15px', fontSize: '1.1rem' }}>إنشاء منشور جديد</h3>
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            className="input"
                                            placeholder={`أخبر متابعينك بآخر أخبار ${shopData.name}...`}
                                            value={newPostContent}
                                            onChange={e => setNewPostContent(e.target.value)}
                                            style={{
                                                width: '100%',
                                                minHeight: '100px',
                                                padding: '12px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)',
                                                resize: 'vertical',
                                                marginBottom: '15px',
                                                background: 'var(--bg-secondary)',
                                                transition: 'all 0.2s'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                        />
                                    </div>

                                    {/* Image Previews */}
                                    {postImages.length > 0 && (
                                        <div style={{ display: 'flex', gap: 10, marginBottom: 15, overflowX: 'auto', paddingBottom: 5 }}>
                                            {Array.from(postImages).map((file, idx) => (
                                                <div key={idx} style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                                                    {file.type.startsWith('video/') ? (
                                                        <video src={URL.createObjectURL(file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <img src={URL.createObjectURL(file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            const newFiles = Array.from(postImages);
                                                            newFiles.splice(idx, 1);
                                                            setPostImages(newFiles);
                                                        }}
                                                        style={{
                                                            position: 'absolute', top: 2, right: 2,
                                                            background: 'rgba(0,0,0,0.6)', color: 'white',
                                                            border: 'none', borderRadius: '50%',
                                                            width: 20, height: 20, cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '12px'
                                                        }}>
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                id="post-images-input"
                                                type="file"
                                                multiple
                                                accept="image/*,video/*"
                                                onChange={e => setPostImages([...postImages, ...Array.from(e.target.files)])}
                                                hidden
                                            />
                                            <label
                                                htmlFor="post-images-input"
                                                className="action-btn"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '8px 16px', borderRadius: '25px',
                                                    cursor: 'pointer', color: 'var(--primary)',
                                                    background: 'color-mix(in srgb, var(--primary), transparent 90%)',
                                                    fontWeight: '600', transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--primary), transparent 80%)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--primary), transparent 90%)'}
                                            >
                                                <PhotoIcon />
                                                <span>إضافة صور</span>
                                            </label>
                                        </div>

                                        <button
                                            onClick={handleCreatePost}
                                            className="btn-primary-glow"
                                            disabled={!newPostContent && postImages.length === 0}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '8px 20px', borderRadius: '25px',
                                                border: 'none',
                                                background: (!newPostContent && postImages.length === 0) ? 'var(--text-muted)' : 'var(--primary)',
                                                color: 'white', fontWeight: 'bold',
                                                cursor: (!newPostContent && postImages.length === 0) ? 'not-allowed' : 'pointer',
                                                opacity: (!newPostContent && postImages.length === 0) ? 0.7 : 1,
                                                boxShadow: (!newPostContent && postImages.length === 0) ? 'none' : '0 4px 15px rgba(251, 171, 21, 0.3)',
                                                transition: 'all 0.2s transform'
                                            }}
                                        >
                                            <span>نشر</span>
                                            <SendIcon />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {posts.map(post => (
                                <div key={post.id} style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 15, marginBottom: 15 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#fbab15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: '1px solid var(--border-color)' }}>
                                                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                                    <img src={getImageUrl(shopData.profile_picture) || '/default-shop.png'} alt={shopData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            </div>
                                            <strong>{shopData.name}</strong>
                                        </div>
                                        {canEditShop && (
                                            <button
                                                onClick={() => handleDeletePost(post.id)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    padding: 5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'color 0.2s'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                                                onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                                title="حذف المنشور"
                                            >
                                                <TrashIcon />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => setSelectedPost(post)}>{post.content}</div>
                                    {post.image_url && (
                                        <div onClick={() => setSelectedPost(post)} style={{ cursor: 'pointer' }}>
                                            {post.media_type === 'video' ? (
                                                <video
                                                    src={getImageUrl(post.image_url)}
                                                    controls
                                                    style={{ width: '100%', maxHeight: 400, borderRadius: 8, background: '#000' }}
                                                />
                                            ) : (
                                                <img src={getImageUrl(post.image_url)} style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 8 }} />
                                            )}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '20px', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--borderColor)' }}>
                                        <button
                                            onClick={() => handleLike(post.id)}
                                            className="interaction-btn"
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                color: post.is_liked ? '#e0245e' : 'var(--text-secondary)',
                                                fontSize: '0.95rem', fontWeight: '500', transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.color = post.is_liked ? '#e0245e' : '#e0245e'}
                                            onMouseOut={e => e.currentTarget.style.color = post.is_liked ? '#e0245e' : 'var(--text-secondary)'}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill={post.is_liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                            </svg>
                                            <span>{post.likes_count}</span>
                                        </button>

                                        <button
                                            className="interaction-btn"
                                            onClick={() => setSelectedPost(post)}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.95rem', fontWeight: '500', transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.color = 'var(--primary)'}
                                            onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                            </svg>
                                            <span>{post.comments_count}</span>
                                        </button>
                                    </div>
                                    <form
                                        style={{ marginTop: 10, display: 'flex', gap: '8px' }}
                                        onSubmit={async e => {
                                            e.preventDefault();
                                            const input = e.target.elements.commentInput;
                                            const val = input.value;
                                            if (!val.trim()) return;
                                            input.value = '';
                                            await handleComment(post.id, val);
                                        }}
                                    >
                                        <input
                                            name="commentInput"
                                            type="text"
                                            placeholder="أضف تعليقاً..."
                                            className="input"
                                            autoComplete="off"
                                            style={{ flex: 1, fontSize: '0.9rem', padding: '8px 12px' }}
                                        />
                                        <button type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <SendIcon />
                                        </button>
                                    </form>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* --- About Tab --- */}
                    {activeTab === 'about' && (
                        <div style={{ display: 'grid', gap: 20 }}>
                            <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 10 }}>
                                <h3>من نحن</h3>
                                <p>{shopData.bio || 'لا توجد نبذة.'}</p>
                            </div>
                            <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 10 }}>
                                <h3>ساعات العمل</h3>
                                {shopData.opening_hours ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {shopData.opening_hours.split('\n').map((line, idx) => {
                                            const firstColonIndex = line.indexOf(':');
                                            if (firstColonIndex === -1) return null;

                                            const day = line.substring(0, firstColonIndex).trim();
                                            const hours = line.substring(firstColonIndex + 1).trim();

                                            // Highlight current day
                                            const isToday = line.includes(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][new Date().getDay()]);
                                            return (
                                                <div key={idx} style={{
                                                    display: 'flex', justifyContent: 'space-between',
                                                    padding: '8px 0', borderBottom: '1px solid var(--borderColor)',
                                                    fontWeight: isToday ? 'bold' : 'normal',
                                                    color: isToday ? 'var(--primary)' : 'inherit'
                                                }}>
                                                    <span>{day}</span>
                                                    <span style={{ direction: 'rtl', unicodeBidi: 'embed' }}>{hours}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : <p>غير محدد</p>}
                            </div>
                            <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 10 }}>
                                <h3>التواصل</h3>
                                <p>{shopData.contact_info}</p>
                            </div>

                            {/* ADMIN ONLY: Assign Owner */}
                            {canAssignOwner && (
                                <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 10, border: '2px solid var(--primary)' }}>
                                    <h3 style={{ color: 'var(--primary)', marginTop: 0 }}>إدارة ملكية المحل (خاص بالمشرف العام)</h3>
                                    <p style={{ fontSize: '0.9rem', marginBottom: 10 }}>هذه الخاصية متاحة فقط لمشرف التطبيق:</p>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        const username = e.target.elements.username.value;
                                        if (!username) return;
                                        if (!confirm(`هل أنت متأكد من تعيين ${username} مالكاً لهذا المحل؟`)) return;
                                        try {
                                            await shopService.assignOwner(shopData.id, username);
                                            alert('تم تعيين المالك بنجاح');
                                            loadShopData(); // Refresh to update permissions
                                        } catch (err) {
                                            alert('فشلت العملية. تأكد من اسم المستخدم.');
                                            console.error(err);
                                        }
                                    }} style={{ display: 'flex', gap: 10 }}>
                                        <input name="username" className="input" placeholder="اسم المستخدم (Username)" style={{ flex: 1 }} />
                                        <button type="submit" className="btn-small is-primary">تعيين</button>
                                    </form>

                                    {shopData.owner_id && (
                                        <div style={{ marginTop: 15, paddingTop: 15, borderTop: '1px solid var(--border-color)' }}>
                                            <p style={{ fontSize: '0.9rem', marginBottom: 10 }}>
                                                المالك الحالي: <b>{shopData.owner_name || 'غير معروف'}</b> (ID: {shopData.owner_id})
                                            </p>
                                            <button
                                                className="btn-small btn-reject"
                                                style={{ width: '100%' }}
                                                onClick={async () => {
                                                    if (!confirm('هل أنت متأكد من إزالة المالك الحالي؟ سيفقد صلاحيات الإدارة.')) return;
                                                    try {
                                                        await shopService.removeOwner(shopData.id);
                                                        alert('تم إزالة المالك بنجاح');
                                                        loadShopData();
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('فشلت العملية');
                                                    }
                                                }}
                                            >
                                                إزالة المالك الحالي
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Owner/Admin Settings: Update Name & Location */}
                            {canEditShop && (
                                <div style={{ display: 'grid', gap: 20 }}>
                                    {/* Proximity Notification Feature */}
                                    <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                                        <div>
                                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span>📡</span> ميزة اشعار القرب
                                            </h3>
                                            <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.4 }}>
                                                عند تفعيل هذه الميزة، سيتم إرسال إشعار تلقائي للمتابعين عند مرورهم بالقرب من المحل (500 متر) يحتوي على أفضل العروض.
                                            </p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                const newValue = !shopData.enable_proximity_notifications;
                                                try {
                                                    await shopService.updateProfile(shopData.id, { enable_proximity_notifications: newValue });
                                                    setShopData(prev => ({ ...prev, enable_proximity_notifications: newValue }));
                                                    alert(`تم ${newValue ? 'تفعيل' : 'إيقاف'} ميزة إشعار القرب بنجاح.`);
                                                } catch (err) {
                                                    console.error(err);
                                                    alert('فشلت العملية، يرجى المحاولة لاحقاً.');
                                                }
                                            }}
                                            style={{
                                                padding: '10px 20px',
                                                borderRadius: '30px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                background: shopData.enable_proximity_notifications ? '#22c55e' : 'var(--bg-tertiary)',
                                                color: shopData.enable_proximity_notifications ? 'white' : 'var(--text-muted)',
                                                transition: 'all 0.3s',
                                                boxShadow: shopData.enable_proximity_notifications ? '0 4px 12px rgba(34, 197, 94, 0.3)' : 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8
                                            }}
                                        >
                                            {shopData.enable_proximity_notifications ? 'مفعل' : 'تعطيل'}
                                        </button>
                                    </div>

                                    {/* Shop Visibility Toggle */}
                                    <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)', marginTop: 20 }}>
                                        <div>
                                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span>👁️</span> عرض المحل على الخريطة
                                            </h3>
                                            <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.4 }}>
                                                عند تعطيل هذه الميزة، سيتم إخفاء محلك عن الخريطة ولن يتمكن أي مستخدم من رويته.
                                            </p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                const newIsHidden = !shopData.is_hidden;
                                                try {
                                                    await shopService.updateProfile(shopData.id, { is_hidden: newIsHidden });
                                                    setShopData(prev => ({ ...prev, is_hidden: newIsHidden }));
                                                    alert(`تم ${newIsHidden ? 'إخفاء' : 'إظهار'} المحل بنجاح.`);
                                                    if (onFollowChange) onFollowChange(); // Trigger map refresh
                                                } catch (err) {
                                                    console.error(err);
                                                    alert('فشلت العملية، يرجى المحاولة لاحقاً.');
                                                }
                                            }}
                                            style={{
                                                padding: '10px 20px',
                                                borderRadius: '30px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                background: !shopData.is_hidden ? '#22c55e' : 'var(--bg-tertiary)',
                                                color: !shopData.is_hidden ? 'white' : 'var(--text-muted)',
                                                transition: 'all 0.3s',
                                                boxShadow: !shopData.is_hidden ? '0 4px 12px rgba(34, 197, 94, 0.3)' : 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8
                                            }}
                                        >
                                            {!shopData.is_hidden ? 'مرئي للجميع' : 'مخفي'}
                                            {!shopData.is_hidden ? '✓' : '✗'}
                                        </button>
                                    </div>

                                    {/* Send Notification Tool */}
                                    <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 10 }}>
                                        <h3>إرسال إشعار للمتابعين</h3>
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            const message = e.target.elements.message.value;
                                            if (!message.trim()) return;
                                            if (!confirm('هل أنت متأكد من إرسال هذا الإشعار لجميع المتابعين؟')) return;

                                            try {
                                                await shopService.sendNotification(shopData.id, message);
                                                alert('تم إرسال الإشعار بنجاح');
                                                e.target.reset();
                                            } catch (err) {
                                                console.error(err);
                                                alert('فشل الإرسال');
                                            }
                                        }}>
                                            <textarea
                                                name="message"
                                                className="input"
                                                placeholder="اكتب رسالة الإشعار هنا..."
                                                style={{ width: '100%', minHeight: '80px', marginBottom: 10 }}
                                                required
                                            ></textarea>
                                            <button type="submit" className="btn-small is-primary">إرسال الإشعار 🔔</button>
                                        </form>
                                    </div>

                                    <div style={{ background: 'var(--bg-primary)', padding: 20, borderRadius: 10 }}>
                                        <h3>الإعدادات العامة</h3>
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            const form = e.target;
                                            const openingHours = Array.from(form.querySelectorAll('.schedule-row')).map(row => {
                                                const day = row.dataset.day;
                                                const isOpen = row.querySelector('.toggle-open').checked;
                                                if (!isOpen) return `${day}: مغلق`;
                                                const from = row.querySelector('.time-from').value;
                                                const to = row.querySelector('.time-to').value;

                                                const formatTime = (t) => {
                                                    const [h, m] = t.split(':');
                                                    let hours = parseInt(h);
                                                    const suffix = hours >= 12 ? 'مساءً' : 'صباحاً';
                                                    hours = hours % 12 || 12;
                                                    return `${hours}:${m} ${suffix}`;
                                                };

                                                return `${day}: ${formatTime(from)} - ${formatTime(to)}`;
                                            }).join('\n');

                                            const updates = {
                                                name: form.name.value,
                                                bio: form.bio.value,
                                                contact_info: form.contact_info.value,
                                                opening_hours: openingHours,
                                                latitude: form.latitude.value,
                                                longitude: form.longitude.value
                                            };
                                            try {
                                                await shopService.updateProfile(shopData.id, updates);
                                                alert('تم التحديث بنجاح');
                                                loadShopData();
                                            } catch (err) {
                                                console.error(err);
                                                alert('فشل التحديث: ' + (err.response?.data?.details || err.response?.data?.error || err.message));
                                            }
                                        }}>
                                            <div style={{ marginBottom: 10 }}>
                                                <label style={{ display: 'block', marginBottom: 5 }}>اسم المحل</label>
                                                <input name="name" className="input" defaultValue={shopData.name} style={{ width: '100%' }} />
                                            </div>
                                            <div style={{ marginBottom: 10 }}>
                                                <label style={{ display: 'block', marginBottom: 5 }}>نبذة (Bio)</label>
                                                <textarea name="bio" className="input" defaultValue={shopData.bio} style={{ width: '100%' }} />
                                            </div>
                                            <div style={{ marginBottom: 10 }}>
                                                <label style={{ display: 'block', marginBottom: 5 }}>رقم التواصل (Contact Phone)</label>
                                                <input name="contact_info" className="input" defaultValue={shopData.contact_info} placeholder="059xxxxxxx" style={{ width: '100%' }} />
                                            </div>

                                            <div style={{ marginBottom: 15, background: 'var(--bg-tertiary)', padding: 10, borderRadius: 8 }}>
                                                <label style={{ display: 'block', marginBottom: 10, fontWeight: 'bold' }}>ساعات الدوام (Weekly Schedule)</label>
                                                {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(day => {
                                                    // Try to parse existing hours for defaults (Handle both 24h and 12h formats)
                                                    // 12h regex: "9:00 صباحاً - 5:00 مساءً"
                                                    // 24h regex: "09:00 - 17:00"
                                                    const dayRegex = new RegExp(`${day}:\\s*(\\d{1,2}:\\d{2})\\s*(صباحاً|مساءً)?\\s*-\\s*(\\d{1,2}:\\d{2})\\s*(صباحاً|مساءً)?`);
                                                    const match = (shopData.opening_hours || '').match(dayRegex);
                                                    const isClosed = (shopData.opening_hours || '').includes(`${day}: مغلق`);
                                                    const defaultOpen = match ? true : (isClosed ? false : true);

                                                    const parseTo24 = (timeStr, suffix) => {
                                                        const [h, m] = timeStr.split(':');
                                                        let hours = parseInt(h);
                                                        if (suffix === 'مساءً' && hours !== 12) hours += 12;
                                                        if (suffix === 'صباحاً' && hours === 12) hours = 0;
                                                        return `${hours.toString().padStart(2, '0')}:${m}`;
                                                    };

                                                    const defaultFrom = match ? (match[2] ? parseTo24(match[1], match[2]) : match[1]) : '09:00';
                                                    const defaultTo = match ? (match[4] ? parseTo24(match[3], match[4]) : match[3]) : '17:00';

                                                    return (
                                                        <div key={day} className="schedule-row" data-day={day} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                                                            <span style={{ width: 60, fontWeight: 'bold' }}>{day}</span>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}>
                                                                <input type="checkbox" className="toggle-open" defaultChecked={defaultOpen} onChange={e => {
                                                                    const inputs = e.target.closest('.schedule-row').querySelectorAll('input[type="time"]');
                                                                    inputs.forEach(i => i.disabled = !e.target.checked);
                                                                }} />
                                                                مفتوح
                                                            </label>
                                                            <input type="time" className="input time-from" defaultValue={defaultFrom} disabled={!defaultOpen} style={{ padding: 4 }} />
                                                            <span>-</span>
                                                            <input type="time" className="input time-to" defaultValue={defaultTo} disabled={!defaultOpen} style={{ padding: 4 }} />
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', marginBottom: 5 }}>خط العرض</label>
                                                    <input name="latitude" className="input" defaultValue={shopData.latitude} style={{ width: '100%' }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', marginBottom: 5 }}>خط الطول</label>
                                                    <input name="longitude" className="input" defaultValue={shopData.longitude} style={{ width: '100%' }} />
                                                </div>
                                            </div>
                                            <button type="submit" className="btn-small is-primary">حفظ الإعدادات</button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                <style>{`
                .btn-small { padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-weight: bold; font-family: inherit; }
                .btn-accept { background: var(--primary); color: white; }
                .btn-reject { background: #ef4444; color: white; }
                .is-primary { background: var(--primary); color: white; }
                .input { background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px; border-radius: 6px; }
                .btn-primary-glow {
                    background: var(--primary);
                    color: white;
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
                    transition: all 0.3s ease;
                }
                .btn-primary-glow:hover {
                    box-shadow: 0 0 25px rgba(99, 102, 241, 0.6);
                    transform: translateY(-1px);
                }
            `}</style>
                {/* Image Cropper Modal for Profile/Cover updates */}
                {cropState.isOpen && (
                    <ImageCropperModal
                        imageFile={cropState.file}
                        aspect={cropState.aspect}
                        onCancel={() => setCropState({ isOpen: false, file: null, type: null, aspect: 1 })}
                        onCropDone={(croppedFile) => {
                            handleImageUpload(cropState.type, croppedFile);
                            setCropState({ isOpen: false, file: null, type: null, aspect: 1 });
                        }}
                    />
                )}
                </div>
            </div >
        </div >
    );
};

export default ShopProfileModal;
