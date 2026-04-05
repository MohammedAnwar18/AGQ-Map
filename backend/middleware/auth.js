const jwt = require('jsonwebtoken');

/**
 * Middleware للتحقق من JWT Token (إلزامي)
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Robust user object: ensure userId exists for all controllers
        req.user = {
            ...decoded,
            userId: decoded.userId || decoded.id // Handle both legacy and current formats
        };

        next();
    });
};

/**
 * Middleware اختياري: يحلل الـ Token إذا وُجد لكن لا يرفض الطلب إن لم يكن موجوداً
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            req.user = null;
        } else {
            req.user = {
                ...decoded,
                userId: decoded.userId || decoded.id
            };
        }
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied: Admins only' });
    }
};

module.exports = { authenticateToken, optionalAuth, isAdmin };
