const jwt = require('jsonwebtoken');

/**
 * Middleware للتحقق من صلاحيات الأدمن
 */
const isAdmin = (req, res, next) => {
    try {
        // التحقق من وجود user في الـ request (من auth middleware)
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // التحقق من أن المستخدم أدمن
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied. Admin privileges required.',
                message: 'هذه الصفحة متاحة للمسؤولين فقط'
            });
        }

        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({ error: 'Server error in admin verification' });
    }
};

module.exports = { isAdmin };
