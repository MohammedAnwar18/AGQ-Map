const pool = require('../config/database');

/**
 * حفظ تصميم صفحة جديد أو تحديث تصميم قائم
 */
exports.savePage = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { name, slug, config, status = 'published' } = req.body;

        if (!name || !slug || !config) {
            return res.status(400).json({ error: 'Name, Slug and Config are required' });
        }

        // Check if slug is taken by someone else
        const slugCheck = await pool.query('SELECT user_id FROM user_design_pages WHERE slug = $1', [slug]);
        if (slugCheck.rows.length > 0 && slugCheck.rows[0].user_id !== userId) {
            return res.status(400).json({ error: 'هذا الرابط مستخدم بالفعل، يرجى اختيار اسم آخر.' });
        }

        const result = await pool.query(
            `INSERT INTO user_design_pages (user_id, name, slug, config, status, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (slug) 
             DO UPDATE SET name = $2, config = $4, status = $5, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, name, slug, config, status]
        );

        res.json({
            success: true,
            message: 'تم حفظ ونشر الصفحة بنجاح!',
            page: result.rows[0]
        });
    } catch (error) {
        console.error('Save Page Error:', error);
        res.status(500).json({ error: 'فشل في حفظ الصفحة' });
    }
};

/**
 * جلب تفاصيل صفحة باستخدام الرابط (Slug)
 */
exports.getPageBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const result = await pool.query(
            'SELECT p.*, u.username as owner_name FROM user_design_pages p JOIN users u ON p.user_id = u.id WHERE p.slug = $1',
            [slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'الصفحة غير موجودة' });
        }

        // Increment views
        pool.query('UPDATE user_design_pages SET views = views + 1 WHERE slug = $1', [slug]);

        res.json({
            success: true,
            page: result.rows[0]
        });
    } catch (error) {
        console.error('Get Page Error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الصفحة' });
    }
};

/**
 * جلب جميع صفحات المستخدم الحالي
 */
exports.getMyPages = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const result = await pool.query(
            'SELECT * FROM user_design_pages WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        res.json({
            success: true,
            pages: result.rows
        });
    } catch (error) {
        console.error('Get My Pages Error:', error);
        res.status(500).json({ error: 'فشل في جلب صفحاتك' });
    }
};

/**
 * حذف صفحة منشورة
 */
exports.deletePage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id || req.user.userId;

        // التأكد أن المستخدم هو صاحب الصفحة
        const check = await pool.query('SELECT user_id FROM user_design_pages WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'الصفحة غير موجودة' });
        
        if (check.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'غير مسموح لك بحذف هذه الصفحة' });
        }

        await pool.query('DELETE FROM user_design_pages WHERE id = $1', [id]);
        res.json({ success: true, message: 'تم حذف الصفحة بنجاح' });
    } catch (error) {
        console.error('Delete Page Error:', error);
        res.status(500).json({ error: 'فشل حذف الصفحة' });
    }
};

/**
 * جلب صفحات مستخدم معين (للعرض في البروفايل)
 */
exports.getUserPages = async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT id, name, slug, status, created_at, views FROM user_design_pages WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        res.json({
            success: true,
            pages: result.rows
        });
    } catch (error) {
        console.error('Get User Pages Error:', error);
        res.status(500).json({ error: 'فشل في جلب صفحات المستخدم' });
    }
};
