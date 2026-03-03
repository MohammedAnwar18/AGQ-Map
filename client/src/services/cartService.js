
const CART_KEY = 'app_cart';
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const cartService = {
    getCart: () => {
        const data = localStorage.getItem(CART_KEY);
        if (!data) return { items: [], timestamp: Date.now() };

        const parsed = JSON.parse(data);
        const now = Date.now();

        // Check if expired
        if (now - parsed.timestamp > EXPIRY_MS) {
            localStorage.removeItem(CART_KEY);
            return { items: [], timestamp: now };
        }

        return parsed;
    },

    saveCart: (cart) => {
        // Always update timestamp on save to refresh the 24h window? 
        // Or keep original timestamp? The user said "save for 24 hours". 
        // Let's keep the original timestamp if it exists, or set new if empty.
        // Actually, usually "cart expires" means "if I leave it for 24h it's gone".
        // Let's reset timestamp only if cart was empty.

        let timestamp = cart.timestamp;
        if (!timestamp) timestamp = Date.now();

        localStorage.setItem(CART_KEY, JSON.stringify({ items: cart.items, timestamp }));

        // Dispatch event for UI updates
        window.dispatchEvent(new Event('cart-updated'));
    },

    addItem: (product) => {
        const cart = cartService.getCart();
        const existingItem = cart.items.find(item => item.id === product.id);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.items.push({ ...product, quantity: 1 });
        }

        cartService.saveCart(cart);
    },

    removeItem: (productId) => {
        const cart = cartService.getCart();
        cart.items = cart.items.filter(item => item.id !== productId);
        cartService.saveCart(cart);
    },

    updateQuantity: (productId, delta) => {
        const cart = cartService.getCart();
        const item = cart.items.find(i => i.id === productId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                cart.items = cart.items.filter(i => i.id !== productId);
            }
        }
        cartService.saveCart(cart);
    },

    clear: () => {
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event('cart-updated'));
    },

    getTotalPrice: () => {
        const cart = cartService.getCart();
        return cart.items.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0);
    },

    getItemCount: () => {
        const cart = cartService.getCart();
        return cart.items.reduce((total, item) => total + item.quantity, 0);
    }
};
