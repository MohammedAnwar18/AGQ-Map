const pool = require('../config/database');

// --- 1. Search Shops ---
const searchShops = async (req, res) => {
    try {
        const { query } = req.query;
        const userId = req.user ? (req.user.id || req.user.userId) : null;

        if (!query) return res.json({ shops: [] });

        const q = `%${query}%`;
        const limit = 20;

        let sql;
        let params;

        if (userId) {
            sql = `
                SELECT id, name, category, profile_picture, latitude, longitude, floor, 
                       parent_shop_id, parent_shop_name, is_followed, is_locked, 'shop' as type
                FROM (
                    SELECT s.id, s.name, s.category, s.profile_picture, 
                           s.latitude, s.longitude, s.floor, s.parent_shop_id,
                           parent.name AS parent_shop_name,
                           s.is_locked,
                           EXISTS(SELECT 1 FROM shop_followers WHERE shop_id = s.id AND user_id = $2::int) as is_followed
                    FROM shops s
                    LEFT JOIN shops parent ON s.parent_shop_id = parent.id
                    WHERE s.name ILIKE $1 AND s.is_hidden = FALSE
                    LIMIT $3
                ) s
                UNION ALL
                SELECT id, name, category, NULL as profile_picture, latitude, longitude, NULL as floor,
                       university_id as parent_shop_id, university_name as parent_shop_name, is_followed, FALSE as is_locked, 'facility' as type
                FROM (
                    SELECT f.id, f.name, f.category, f.latitude, f.longitude, f.university_id,
                           s.name as university_name,
                           EXISTS(SELECT 1 FROM shop_followers WHERE shop_id = f.university_id AND user_id = $2::int) as is_followed
                    FROM university_facilities f
                    JOIN shops s ON f.university_id = s.id
                    WHERE f.name ILIKE $1
                    LIMIT $3
                ) f
                ORDER BY type DESC, name ASC
            `;
            params = [q, parseInt(userId), limit];
        } else {
            sql = `
                SELECT id, name, category, profile_picture, latitude, longitude, floor, 
                       parent_shop_id, parent_shop_name, FALSE as is_followed, is_locked, 'shop' as type
                FROM (
                    SELECT s.id, s.name, s.category, s.profile_picture, 
                           s.latitude, s.longitude, s.floor, s.parent_shop_id,
                           parent.name AS parent_shop_name,
                           s.is_locked
                    FROM shops s
                    LEFT JOIN shops parent ON s.parent_shop_id = parent.id
                    WHERE s.name ILIKE $1 AND s.is_hidden = FALSE
                    LIMIT $2
                ) s
                UNION ALL
                SELECT id, name, category, NULL as profile_picture, latitude, longitude, NULL as floor,
                       university_id as parent_shop_id, university_name as parent_shop_name, FALSE as is_followed, FALSE as is_locked, 'facility' as type
                FROM (
                    SELECT f.id, f.name, f.category, f.latitude, f.longitude, f.university_id,
                           s.name as university_name
                    FROM university_facilities f
                    JOIN shops s ON f.university_id = s.id
                    WHERE f.name ILIKE $1
                    LIMIT $2
                ) f
                ORDER BY type DESC, name ASC
            `;
            params = [q, limit];
        }

        result = await pool.query(sql, params);
        res.json({ shops: result.rows });
    } catch (error) {
        console.error('Search shops error:', error);
        res.status(500).json({ error: 'Failed to search shops' });
    }
};

// --- 1b. Smart Search: Shops + Products + Price Filter ---
const smartSearch = async (req, res) => {
    try {
        const { query, priceMin, priceMax, priceExact, productQuery } = req.query;
        const userId = req.user ? (req.user.id || req.user.userId) : null;

        if (!query && !productQuery) return res.json({ results: [] });

        const shopQuery = query ? `%${query}%` : '%';
        const prodQuery = productQuery ? `%${productQuery}%` : (query ? `%${query}%` : '%');

        let priceCondition = '';
        const params = [shopQuery, prodQuery];
        let paramIdx = 3;

        if (priceExact !== undefined && priceExact !== '') {
            priceCondition = `AND p.price = $` + paramIdx;
            params.push(parseFloat(priceExact));
            paramIdx++;
        } else {
            if (priceMin !== undefined && priceMin !== '') {
                priceCondition += ` AND p.price >= $` + paramIdx;
                params.push(parseFloat(priceMin));
                paramIdx++;
            }
            if (priceMax !== undefined && priceMax !== '') {
                priceCondition += ` AND p.price <= $` + paramIdx;
                params.push(parseFloat(priceMax));
                paramIdx++;
            }
        }

        if (userId) params.push(parseInt(userId));
        const userParamIdx = paramIdx;
        const isFollowedExpr = userId
            ? `EXISTS(SELECT 1 FROM shop_followers WHERE shop_id = s.id AND user_id = $` + userParamIdx + `::int)`
            : 'FALSE';

        const sql = `
            WITH matching_shops AS (
                SELECT s.id, s.name, s.category, s.profile_picture,
                       s.latitude, s.longitude, s.floor, s.parent_shop_id,
                       parent.name AS parent_shop_name,
                       ${isFollowedExpr} as is_followed,
                       NULL::numeric as product_price, NULL::text as product_name,
                       NULL::text as product_description, NULL::text as product_image_url,
                       NULL::int as product_id, 'shop' as result_type
                FROM shops s
                LEFT JOIN shops parent ON s.parent_shop_id = parent.id
                WHERE (s.name ILIKE $1 OR s.category ILIKE $1) AND s.is_hidden = FALSE
                LIMIT 20
            ),
            matching_products AS (
                SELECT s.id, s.name, s.category, s.profile_picture,
                       s.latitude, s.longitude, s.floor, s.parent_shop_id,
                       parent.name AS parent_shop_name,
                       ${isFollowedExpr} as is_followed,
                       p.price as product_price, p.name as product_name,
                       p.description as product_description, p.image_url as product_image_url,
                       p.id as product_id, 'product' as result_type
                FROM shop_products p
                JOIN shops s ON p.shop_id = s.id
                LEFT JOIN shops parent ON s.parent_shop_id = parent.id
                WHERE p.name ILIKE $2 ${priceCondition} AND s.is_hidden = FALSE
                LIMIT 30
            ),
            matching_facilities AS (
                SELECT f.id, f.name, f.category, NULL::text as profile_picture,
                       f.latitude, f.longitude, NULL::text as floor, f.university_id as parent_shop_id,
                       s.name AS parent_shop_name,
                       ${isFollowedExpr.replace('s.id', 'f.university_id')} as is_followed,
                       NULL::numeric as product_price, NULL::text as product_name,
                       NULL::text as product_description, NULL::text as product_image_url,
                       NULL::int as product_id, 'facility' as result_type
                FROM university_facilities f
                JOIN shops s ON f.university_id = s.id
                WHERE (f.name ILIKE $1 OR f.category ILIKE $1) AND s.is_hidden = FALSE
                LIMIT 20
            )
            SELECT * FROM matching_shops
            UNION ALL
            SELECT * FROM matching_products
            UNION ALL
            SELECT * FROM matching_facilities
            ORDER BY result_type ASC, product_price ASC NULLS LAST
        `;

        const result = await pool.query(sql, params);

        const shopsMap = {};
        const facilities = [];

        result.rows.forEach(row => {
            if (row.result_type === 'facility') {
                facilities.push({
                    id: row.id,
                    name: row.name,
                    category: row.category,
                    latitude: row.latitude,
                    longitude: row.longitude,
                    parent_shop_name: row.parent_shop_name,
                    is_followed: row.is_followed,
                    result_type: 'facility'
                });
                return;
            }

            if (!shopsMap[row.id]) {
                shopsMap[row.id] = {
                    id: row.id, name: row.name, category: row.category,
                    profile_picture: row.profile_picture, latitude: row.latitude,
                    longitude: row.longitude, floor: row.floor,
                    parent_shop_id: row.parent_shop_id,
                    parent_shop_name: row.parent_shop_name,
                    is_followed: row.is_followed, products: [],
                    result_type: 'shop'
                };
            }
            if (row.result_type === 'product' && row.product_id) {
                shopsMap[row.id].products.push({
                    id: row.product_id, name: row.product_name,
                    description: row.product_description,
                    price: row.product_price, image_url: row.product_image_url
                });
            }
        });

        const mergedResults = [
            ...Object.values(shopsMap),
            ...facilities
        ];

        res.json({
            results: mergedResults
        });
    } catch (error) {
        console.error('Smart search error:', error);
        res.status(500).json({ error: 'Smart search failed: ' + error.message });
    }
};

// --- 2. Follow Shop ---
const followShop = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const shopId = parseInt(req.params.id);

        if (isNaN(shopId)) {
            return res.status(400).json({ error: 'Invalid shop ID' });
        }

        await pool.query(`
            INSERT INTO shop_followers (user_id, shop_id)
            VALUES ($1::int, $2::int)
            ON CONFLICT (user_id, shop_id) DO NOTHING
        `, [parseInt(userId), shopId]);

        res.json({ message: 'Shop followed successfully', shopId });
    } catch (error) {
        console.error('Follow shop error:', error);
        res.status(500).json({ error: 'Failed to follow shop' });
    }
};

// --- 3. Unfollow Shop ---
const unfollowShop = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const shopId = parseInt(req.params.id);

        if (isNaN(shopId)) {
            return res.status(400).json({ error: 'Invalid shop ID' });
        }

        await pool.query('DELETE FROM shop_followers WHERE user_id = $1::int AND shop_id = $2::int', [parseInt(userId), shopId]);

        res.json({ message: 'Shop unfollowed', shopId });
    } catch (error) {
        console.error('Unfollow shop error:', error);
        res.status(500).json({ error: 'Failed to unfollow shop' });
    }
};

// --- 4. Get Followed Shops ---
const getFollowedShops = async (req, res) => {
    try {
        const userId = parseInt(req.user.id || req.user.userId);

        const result = await pool.query(`
            WITH FollowedShops AS (
                SELECT s.id
                FROM shops s
                JOIN shop_followers sf ON s.id = sf.shop_id
                WHERE sf.user_id = $1::int AND s.is_hidden = FALSE
            ),
            BankChildren AS (
                SELECT child.id
                FROM shops child
                JOIN shops parent ON child.parent_shop_id = parent.id
                WHERE parent.id IN (SELECT id FROM FollowedShops) 
                  AND parent.category = 'بنك'
                  AND child.is_hidden = FALSE
            ),
            AllRelevantShopIds AS (
                SELECT id FROM FollowedShops
                UNION
                SELECT id FROM BankChildren
            )
            SELECT s.*,
            (s.id IN (SELECT id FROM FollowedShops)) as is_followed
            FROM shops s
            WHERE s.id IN (SELECT id FROM AllRelevantShopIds)
            ORDER BY s.name ASC
        `, [userId]);

        res.json({ shops: result.rows });
    } catch (error) {
        console.error('Get followed shops error:', error);
        res.status(500).json({ error: 'Failed to get followed shops' });
    }
};

// --- 5. Create Shop (Admin) ---
const createShop = async (req, res) => {
    try {
        const { name, latitude, longitude, category, parent_shop_id, floor, custom_design, icon_size, text_size, min_zoom, text_min_zoom } = req.body;
        const ownerId = req.user.id || req.user.userId;

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'Invalid coordinates provided' });
        }

        const parsedIconSize = (icon_size === '' || icon_size === undefined || icon_size === null || isNaN(parseInt(icon_size))) ? null : parseInt(icon_size);
        const parsedTextSize = (text_size === '' || text_size === undefined || text_size === null || isNaN(parseInt(text_size))) ? null : parseInt(text_size);
        const parsedMinZoom = (min_zoom === '' || min_zoom === undefined || min_zoom === null || isNaN(parseFloat(min_zoom))) ? null : parseFloat(min_zoom);
        const parsedTextMinZoom = (text_min_zoom === '' || text_min_zoom === undefined || text_min_zoom === null || isNaN(parseFloat(text_min_zoom))) ? null : parseFloat(text_min_zoom);

        let newShop;
        try {
            const result = await pool.query(`
                INSERT INTO shops (name, latitude, longitude, category, owner_id, parent_shop_id, floor, location, custom_design, icon_size, text_size, min_zoom, text_min_zoom)
                VALUES ($1, $2::numeric, $3::numeric, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography, $8, $9, $10, $11, $12)
                RETURNING *
            `, [name, lat, lon, category || 'General', ownerId, parent_shop_id || null, floor || null, custom_design || {}, parsedIconSize, parsedTextSize, parsedMinZoom, parsedTextMinZoom]);
            newShop = result.rows[0];
        } catch (dbErr) {
            console.warn("Failed to create shop with custom size/zoom settings (missing columns?), falling back to standard insert:", dbErr.message);
            const result = await pool.query(`
                INSERT INTO shops (name, latitude, longitude, category, owner_id, parent_shop_id, floor, location, custom_design)
                VALUES ($1, $2::numeric, $3::numeric, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography, $8)
                RETURNING *
            `, [name, lat, lon, category || 'General', ownerId, parent_shop_id || null, floor || null, custom_design || {}]);
            newShop = {
                ...result.rows[0],
                icon_size: null,
                text_size: null,
                min_zoom: null,
                text_min_zoom: null
            };
        }

        // Auto-follow for the creator
        await pool.query(`
            INSERT INTO shop_followers (user_id, shop_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [ownerId, newShop.id]);

        res.json(newShop);
    } catch (e) {
        console.error('Create shop error:', e);
        res.status(500).json({ error: 'Failed to create shop' });
    }
};

// --- 5.1 Delete Shop (Admin) ---
const deleteShop = async (req, res) => {
    try {
        const shopId = req.params.id;
        const result = await pool.query('DELETE FROM shops WHERE id = $1 RETURNING id', [shopId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Shop not found' });
        res.json({ message: 'Shop deleted successfully' });
    } catch (e) {
        console.error('Delete shop error:', e);
        res.status(500).json({ error: 'Failed to delete shop' });
    }
};

// --- 6. Get Shop Profile ---
const getShopProfile = async (req, res) => {
    try {
        const shopId = parseInt(req.params.id);
        const currentUserId = req.user ? (req.user.id || req.user.userId) : null;

        let shopResult;
        if (currentUserId) {
            shopResult = await pool.query(`
                SELECT s.*, 
                       u.username as owner_name,
                       (SELECT COUNT(*)::int FROM shop_followers WHERE shop_id = s.id) as followers_count,
                       EXISTS(SELECT 1 FROM shop_followers WHERE shop_id = s.id AND user_id = $2::int) as is_followed
                FROM shops s
                LEFT JOIN users u ON s.owner_id = u.id
                WHERE s.id = $1::int
            `, [shopId, parseInt(currentUserId)]);
        } else {
            shopResult = await pool.query(`
                SELECT s.*, 
                       u.username as owner_name,
                       (SELECT COUNT(*)::int FROM shop_followers WHERE shop_id = s.id) as followers_count,
                       FALSE as is_followed
                FROM shops s
                LEFT JOIN users u ON s.owner_id = u.id
                WHERE s.id = $1::int
            `, [shopId]);
        }

        if (shopResult.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const shop = shopResult.rows[0];

        let userRole = null;
        if (currentUserId) {
            const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [parseInt(currentUserId)]);
            userRole = userRes.rows[0]?.role;
        }

        // Block access to locked shops (admins can still view)
        if (shop.is_locked && userRole !== 'admin') {
            return res.status(423).json({ error: 'Shop is locked', is_locked: true });
        }

        const isOwner = currentUserId && (String(shop.owner_id) === String(currentUserId) || userRole === 'admin');

        if (shop.is_hidden && !isOwner && userRole !== 'admin') {
            return res.status(404).json({ error: 'Shop hidden' });
        }

        const postsResult = await pool.query(`
            SELECT p.*,
                   (SELECT COUNT(*)::int FROM likes WHERE post_id = p.id) as likes_count,
                   (SELECT COUNT(*)::int FROM comments WHERE post_id = p.id) as comments_count,
                   ${currentUserId ? 'EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2)' : 'FALSE'} as is_liked
            FROM posts p
            WHERE p.shop_id = $1
            ORDER BY p.created_at DESC
        `, currentUserId ? [shopId, currentUserId] : [shopId]);

        const productsResult = await pool.query('SELECT * FROM shop_products WHERE shop_id = $1 ORDER BY created_at DESC', [shopId]);

        const internalShopsResult = await pool.query(`
            SELECT id, name, category, profile_picture, floor, is_verified 
            FROM shops 
            WHERE parent_shop_id = $1 
            ORDER BY floor ASC, name ASC
        `, [shopId]);

        res.json({
            shop: { ...shop, is_owner: isOwner },
            posts: postsResult.rows,
            products: productsResult.rows,
            internal_shops: internalShopsResult.rows
        });
    } catch (error) {
        console.error('Get shop profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};

// --- 7. Update Shop Profile ---
const updateShopProfile = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { bio, opening_hours, contact_info, name, latitude, longitude, category } = req.body;
        const userId = req.user.userId;

        const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        const userRole = userRes.rows[0]?.role;

        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const isAuthorized = userRole === 'admin' || String(shopCheck.rows[0].owner_id) === String(userId);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        const buildAndRunQuery = async (includeCustomFields) => {
            let queryParts = [];
            let values = [];
            let index = 1;

            let fields = ['name', 'bio', 'opening_hours', 'contact_info', 'category', 'parent_shop_id', 'floor', 'enable_proximity_notifications', 'is_hidden', 'proximity_radius', 'custom_design'];
            if (includeCustomFields) {
                fields = fields.concat(['icon_size', 'text_size', 'min_zoom', 'text_min_zoom']);
            }

            fields.forEach(field => {
                if (req.body[field] !== undefined) {
                    queryParts.push(`${field} = $${index++}`);
                    let val = req.body[field];
                    if (val === '') {
                        val = null;
                    } else if (field === 'custom_design' && typeof val === 'string') {
                        val = JSON.parse(val);
                    } else if (['icon_size', 'text_size'].includes(field)) {
                        val = (val === null || isNaN(parseInt(val))) ? null : parseInt(val);
                    } else if (['min_zoom', 'text_min_zoom'].includes(field)) {
                        val = (val === null || isNaN(parseFloat(val))) ? null : parseFloat(val);
                    }
                    values.push(val);
                }
            });

            if (latitude !== undefined && longitude !== undefined) {
                const lat = parseFloat(latitude);
                const lon = parseFloat(longitude);
                queryParts.push(`latitude = $${index++}`);
                values.push(lat);
                queryParts.push(`longitude = $${index++}`);
                values.push(lon);
                queryParts.push(`location = ST_SetSRID(ST_MakePoint($${index++}, $${index++}), 4326)::geography`);
                values.push(lon, lat);
            }

            if (queryParts.length === 0) return { noChanges: true };

            values.push(shopId);
            const result = await pool.query(`UPDATE shops SET ${queryParts.join(', ')} WHERE id = $${index} RETURNING *`, values);
            return result.rows[0];
        };

        let updatedShop;
        try {
            updatedShop = await buildAndRunQuery(true);
        } catch (dbErr) {
            console.warn("Failed to update shop with custom size/zoom settings, retrying with standard fields:", dbErr.message);
            updatedShop = await buildAndRunQuery(false);
        }

        if (updatedShop && updatedShop.noChanges) {
            return res.json({ message: 'No changes' });
        }

        res.json(updatedShop);
    } catch (e) {
        console.error('Update profile error:', e);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

const updateShopImages = async (req, res) => {
    try {
        const shopId = req.params.id;
        const userId = req.user.id || req.user.userId;
        const userRole = req.user.role;
        const { uploadToCloud, deleteFileFromCloud } = require('../utils/storage');

        const shopCheck = await pool.query('SELECT owner_id, profile_picture, cover_picture FROM shops WHERE id = $1', [shopId]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const isAuthorized = userRole === 'admin' || String(shopCheck.rows[0].owner_id) === String(userId);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        let queryParts = [];
        let params = [];
        let index = 1;

        if (req.files) {
            if (req.files.profile_picture) {
                const file = req.files.profile_picture[0];
                const url = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
                queryParts.push(`profile_picture = $${index++}`);
                params.push(url);
                if (shopCheck.rows[0].profile_picture) try { deleteFileFromCloud(shopCheck.rows[0].profile_picture); } catch (e) { }
            }
            if (req.files.cover_picture) {
                const file = req.files.cover_picture[0];
                const url = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
                queryParts.push(`cover_picture = $${index++}`);
                params.push(url);
                if (shopCheck.rows[0].cover_picture) try { deleteFileFromCloud(shopCheck.rows[0].cover_picture); } catch (e) { }
            }
        }

        if (queryParts.length === 0) return res.status(400).json({ error: 'No images' });

        params.push(shopId);
        const result = await pool.query(`UPDATE shops SET ${queryParts.join(', ')} WHERE id = $${index} RETURNING *`, params);
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update images' });
    }
};

const createShopPost = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { content, title, external_link, post_type } = req.body;
        const userId = req.user.id || req.user.userId;

        const shopRes = await pool.query('SELECT owner_id, latitude, longitude FROM shops WHERE id = $1', [shopId]);
        if (shopRes.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const isAuthorized = req.user.role === 'admin' || String(shopRes.rows[0].owner_id) === String(userId);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        const { uploadToSupabase } = require('../utils/storage');
        let image_url = null, media_urls = [], media_type = 'text';

        if (req.files && req.files.length > 0) {
            media_urls = await Promise.all(req.files.map(f => uploadToSupabase(f.buffer, f.originalname, f.mimetype)));
            image_url = media_urls[0];
            media_type = req.files[0].mimetype.startsWith('video/') ? 'video' : 'image';
        }

        const result = await pool.query(`
            INSERT INTO posts (shop_id, content, image_url, media_urls, media_type, location, title, external_link, post_type)
            VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8, $9, $10)
            RETURNING *
        `, [shopId, content, image_url, media_urls, media_type, shopRes.rows[0].longitude, shopRes.rows[0].latitude, title, external_link, post_type || 'news']);

        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create post' });
    }
};

const deleteShopPost = async (req, res) => {
    try {
        const { id, postId } = req.params;
        const userId = req.user.userId;
        const { deleteFileFromCloud } = require('../utils/storage');

        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (shopRes.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        const postRes = await pool.query('SELECT image_url FROM posts WHERE id = $1 AND shop_id = $2', [postId, id]);
        if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

        await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
        if (postRes.rows[0].image_url) try { deleteFileFromCloud(postRes.rows[0].image_url); } catch (e) { }

        res.json({ message: 'Post deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const addProduct = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { name, price, description, old_price, category } = req.body;
        const { uploadToSupabase } = require('../utils/storage');

        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        let media_urls = [];
        if (req.files) media_urls = await Promise.all(req.files.map(f => uploadToSupabase(f.buffer, f.originalname, f.mimetype)));

        // Sanitize price values: empty string or invalid number should be null for numeric columns
        const parsedPrice = (price === '' || price === undefined || price === null || isNaN(parseFloat(price))) ? null : parseFloat(price);
        const parsedOldPrice = (old_price === '' || old_price === undefined || old_price === null || isNaN(parseFloat(old_price))) ? null : parseFloat(old_price);

        const result = await pool.query(`
            INSERT INTO shop_products (shop_id, name, price, description, image_url, image_urls, old_price, category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [shopId, name, parsedPrice, description, media_urls[0] || null, media_urls, parsedOldPrice, category]);
        res.json(result.rows[0]);
    } catch (e) {
        console.error('addProduct error:', e);
        res.status(500).json({ error: 'Failed to add product' });
    }
};

const updateProduct = async (req, res) => {
    try {
        const { id: shopId, productId } = req.params;
        const { name, price, description, old_price, category } = req.body;
        const { uploadToSupabase } = require('../utils/storage');

        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        let queryParts = [];
        let vals = [];
        let idx = 1;

        const fields = ['name', 'price', 'description', 'old_price', 'category'];
        fields.forEach(f => {
            if (req.body[f] !== undefined) {
                queryParts.push(`${f} = $${idx++}`);
                // Sanitize numeric fields
                if (f === 'price' || f === 'old_price') {
                    const val = (req.body[f] === '' || req.body[f] === null || isNaN(parseFloat(req.body[f]))) ? null : parseFloat(req.body[f]);
                    vals.push(val);
                } else {
                    vals.push(req.body[f]);
                }
            }
        });

        if (req.files && req.files.length > 0) {
            const urls = await Promise.all(req.files.map(f => uploadToSupabase(f.buffer, f.originalname, f.mimetype)));
            queryParts.push(`image_url = $${idx++}`, `image_urls = $${idx++}`);
            vals.push(urls[0], urls);
        }

        if (queryParts.length === 0) return res.json({ message: 'No changes' });

        vals.push(productId, shopId);
        const result = await pool.query(`UPDATE shop_products SET ${queryParts.join(', ')} WHERE id = $${idx++} AND shop_id = $${idx} RETURNING *`, vals);
        res.json(result.rows[0]);
    } catch (e) {
        console.error('updateProduct error:', e);
        res.status(500).json({ error: 'Failed to update product' });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id: shopId, productId } = req.params;
        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        await pool.query('DELETE FROM shop_products WHERE id = $1 AND shop_id = $2', [productId, shopId]);
        res.json({ message: 'Product deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const assignShopOwner = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [req.body.username]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        await pool.query('UPDATE shops SET owner_id = $1 WHERE id = $2', [userRes.rows[0].id, req.params.id]);
        res.json({ message: 'Owner assigned' });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const removeShopOwner = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        await pool.query('UPDATE shops SET owner_id = NULL WHERE id = $1', [req.params.id]);
        res.json({ message: 'Owner removed' });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getManagedShops = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM shops WHERE owner_id = $1', [req.user.userId]);
        res.json({ shops: result.rows });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const sendNotificationToFollowers = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { message, lat, lon, radius } = req.body;
        const shopRes = await pool.query('SELECT owner_id, name, latitude, longitude, profile_picture FROM shops WHERE id = $1', [shopId]);
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        const payload = JSON.stringify({ shopId, shopName: shopRes.rows[0].name, shopImage: shopRes.rows[0].profile_picture, text: message, location: { latitude: shopRes.rows[0].latitude, longitude: shopRes.rows[0].longitude } });

        let sql = `INSERT INTO notifications (user_id, sender_id, type, message) SELECT sf.user_id, $1, 'shop_alert', $2 FROM shop_followers sf JOIN users u ON sf.user_id = u.id WHERE sf.shop_id = $3`;
        let params = [req.user.userId, payload, shopId];

        if (lat && lon && radius) {
            sql += ` AND ST_DWithin(ST_SetSRID(ST_MakePoint(u.last_longitude, u.last_latitude), 4326)::geography, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6)`;
            params.push(lon, lat, radius);
        }

        await pool.query(sql, params);
        res.json({ message: 'Sent' });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const addUniversityFacility = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, icon, latitude, longitude, description } = req.body;
        const shopRes = await pool.query('SELECT owner_id, category FROM shops WHERE id = $1', [id]);
        if (shopRes.rows[0].category !== 'University') return res.status(400).json({ error: 'Not a University' });
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        const result = await pool.query(`INSERT INTO university_facilities (university_id, name, category, icon, latitude, longitude, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [id, name, category, icon || '📍', latitude, longitude, description || '']);
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getUniversityFacilities = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM university_facilities WHERE university_id = $1 ORDER BY category, name', [req.params.id]);
        const grouped = {};
        result.rows.forEach(f => { (grouped[f.category] = grouped[f.category] || []).push(f); });
        res.json({ facilities: grouped, list: result.rows });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getFacilityProfile = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const facilityRes = await pool.query(`SELECT f.*, s.name as university_name, s.owner_id as uni_owner_id FROM university_facilities f JOIN shops s ON f.university_id = s.id WHERE f.id = $1`, [facilityId]);
        if (facilityRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const postsRes = await pool.query(`SELECT fp.*, u.username, u.profile_picture as user_avatar FROM facility_posts fp LEFT JOIN users u ON fp.user_id = u.id WHERE fp.facility_id = $1 ORDER BY fp.created_at DESC`, [facilityId]);

        let specialties = [];
        if (facilityRes.rows[0].category === 'الكليات') {
            const specRes = await pool.query('SELECT * FROM university_specialties WHERE facility_id = $1 ORDER BY name', [facilityId]);
            specialties = specRes.rows;
        }

        const userId = req.user?.userId || req.user?.id;
        const is_admin = req.user && (req.user.role === 'admin' || (userId && String(facilityRes.rows[0].uni_owner_id) === String(userId)));
        res.json({ facility: facilityRes.rows[0], posts: postsRes.rows, specialties, is_admin });
    } catch (e) {
        console.error('getFacilityProfile error:', e);
        res.status(500).json({ error: 'Failed' });
    }
};

const addFacilityPost = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { title, content, post_type, event_date } = req.body;
        const checkRes = await pool.query(`SELECT s.owner_id FROM university_facilities f JOIN shops s ON f.university_id = s.id WHERE f.id = $1`, [facilityId]);
        const isAuthorized = req.user.role === 'admin' || String(checkRes.rows[0].owner_id) === String(req.user.userId);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        const { uploadToSupabase } = require('../utils/storage');
        let urls = [];
        if (req.files) urls = await Promise.all(req.files.map(f => uploadToSupabase(f.buffer, f.originalname, f.mimetype)));

        const result = await pool.query(`INSERT INTO facility_posts (facility_id, user_id, title, content, post_type, event_date, media_urls, media_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [facilityId, req.user.userId, title, content, post_type || 'news', event_date || null, urls, urls.length > 0 ? 'image' : 'text']);
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const addCollegeSpecialty = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { name, description, degree_level } = req.body;
        const checkRes = await pool.query(`SELECT s.owner_id, f.category FROM university_facilities f JOIN shops s ON f.university_id = s.id WHERE f.id = $1`, [facilityId]);
        if (checkRes.rows[0].category !== 'الكليات') return res.status(400).json({ error: 'Not a College' });

        const isAuthorized = req.user.role === 'admin' || String(checkRes.rows[0].owner_id) === String(req.user.userId);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        const result = await pool.query(`INSERT INTO university_specialties (facility_id, name, description, degree_level) VALUES ($1, $2, $3, $4) RETURNING *`, [facilityId, name, description, degree_level]);
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const deleteUniversityFacility = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const checkRes = await pool.query(`SELECT s.owner_id FROM university_facilities f JOIN shops s ON f.university_id = s.id WHERE f.id = $1`, [facilityId]);
        const isAuthorized = req.user.role === 'admin' || String(checkRes.rows[0].owner_id) === String(req.user.userId);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        await pool.query('DELETE FROM facility_posts WHERE facility_id = $1', [facilityId]);
        await pool.query('DELETE FROM university_specialties WHERE facility_id = $1', [facilityId]);
        await pool.query('DELETE FROM university_facilities WHERE id = $1', [facilityId]);
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const updateUniversityFacility = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { name, description, icon } = req.body;
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;

        const checkRes = await pool.query(`
            SELECT f.*, s.owner_id 
            FROM university_facilities f 
            JOIN shops s ON f.university_id = s.id 
            WHERE f.id = $1
        `, [facilityId]);

        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });

        const isAuthorized = userRole === 'admin' || String(checkRes.rows[0].owner_id) === String(userId);
        if (!isAuthorized) {
            console.warn(`Unauthorized update attempt by user ${userId} for facility ${facilityId}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const buildAndRunQuery = async (includeCustomFields) => {
            let queryParts = [];
            let vals = [];
            let idx = 1;

            if (name !== undefined) { queryParts.push(`name = $${idx++}`); vals.push(name); }
            if (description !== undefined) { queryParts.push(`description = $${idx++}`); vals.push(description); }

            const { uploadToCloud } = require('../utils/storage');
            let finalIcon = icon;

            if (req.files && req.files.icon_file) {
                finalIcon = await uploadToCloud(req.files.icon_file[0].buffer, req.files.icon_file[0].originalname, req.files.icon_file[0].mimetype);
            }

            if (finalIcon !== undefined) {
                queryParts.push(`icon = $${idx++}`);
                vals.push(finalIcon);
            }

            if (req.files && req.files.cover_file) {
                const url = await uploadToCloud(req.files.cover_file[0].buffer, req.files.cover_file[0].originalname, req.files.cover_file[0].mimetype);
                queryParts.push(`cover_background = $${idx++}`);
                vals.push(url);
            }

            if (includeCustomFields) {
                const fields = ['icon_size', 'text_size', 'min_zoom', 'text_min_zoom'];
                fields.forEach(field => {
                    if (req.body[field] !== undefined) {
                        queryParts.push(`${field} = $${idx++}`);
                        let val = req.body[field];
                        if (val === '') {
                            val = null;
                        } else if (['icon_size', 'text_size'].includes(field)) {
                            val = (val === null || isNaN(parseInt(val))) ? null : parseInt(val);
                        } else if (['min_zoom', 'text_min_zoom'].includes(field)) {
                            val = (val === null || isNaN(parseFloat(val))) ? null : parseFloat(val);
                        }
                        vals.push(val);
                    }
                });
            }

            if (queryParts.length === 0) return { noChanges: true };

            vals.push(facilityId);
            const result = await pool.query(`UPDATE university_facilities SET ${queryParts.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
            return result.rows[0];
        };

        let updatedFacility;
        try {
            updatedFacility = await buildAndRunQuery(true);
        } catch (dbErr) {
            console.warn("Failed to update facility with custom size/zoom settings, retrying with standard fields:", dbErr.message);
            updatedFacility = await buildAndRunQuery(false);
        }

        if (updatedFacility && updatedFacility.noChanges) {
            return res.json(checkRes.rows[0]);
        }

        res.json(updatedFacility);
    } catch (e) {
        console.error('Update facility error:', e);
        res.status(500).json({ error: 'Failed to update facility' });
    }
};

const togglePostLike = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;
        const check = await pool.query('SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
            res.json({ liked: false });
        } else {
            await pool.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [userId, postId]);
            res.json({ liked: true });
        }
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const addPostComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const result = await pool.query(`INSERT INTO comments (user_id, post_id, content) VALUES ($1, $2, $3) RETURNING *, (SELECT username FROM users WHERE id = $1), (SELECT profile_picture FROM users WHERE id = $1)`, [req.user.userId, postId, content]);
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getPostComments = async (req, res) => {
    try {
        const result = await pool.query(`SELECT c.*, u.username, u.profile_picture FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at ASC`, [req.params.postId]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getFollowedUniversitiesFacilities = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const result = await pool.query(`SELECT f.*, s.name as university_name FROM university_facilities f JOIN shops s ON f.university_id = s.id JOIN shop_followers sf ON s.id = sf.shop_id WHERE sf.user_id = $1 AND s.is_hidden = FALSE ORDER BY f.category, f.name`, [userId]);
        res.json({ facilities: result.rows });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getAllShopsMap = async (req, res) => {
    try {
        let shopsRes;
        try {
            shopsRes = await pool.query("SELECT id, name, category, profile_picture, cover_picture, custom_design, hidden_sections, latitude, longitude, floor, parent_shop_id, is_locked, icon_size, text_size, min_zoom, text_min_zoom, 'shop' as type FROM shops WHERE is_hidden = FALSE");
        } catch (dbErr) {
            console.warn("Database error querying custom shop sizes/zooms, falling back to standard columns:", dbErr.message);
            const rawShopsRes = await pool.query("SELECT id, name, category, profile_picture, cover_picture, custom_design, hidden_sections, latitude, longitude, floor, parent_shop_id, is_locked, 'shop' as type FROM shops WHERE is_hidden = FALSE");
            shopsRes = {
                rows: rawShopsRes.rows.map(row => ({
                    ...row,
                    icon_size: null,
                    text_size: null,
                    min_zoom: null,
                    text_min_zoom: null
                }))
            };
        }

        let facilitiesRes;
        try {
            facilitiesRes = await pool.query("SELECT id, name, category, icon, latitude, longitude, university_id as parent_shop_id, FALSE as is_locked, icon_size, text_size, min_zoom, text_min_zoom, 'facility' as type FROM university_facilities");
        } catch (dbErr) {
            console.warn("Database error querying facility custom sizes/zooms, falling back to standard columns:", dbErr.message);
            const rawFacilitiesRes = await pool.query("SELECT id, name, category, icon, latitude, longitude, university_id as parent_shop_id, FALSE as is_locked, 'facility' as type FROM university_facilities");
            facilitiesRes = {
                rows: rawFacilitiesRes.rows.map(row => ({
                    ...row,
                    icon_size: null,
                    text_size: null,
                    min_zoom: null,
                    text_min_zoom: null
                }))
            };
        }

        res.json({
            shops: shopsRes.rows,
            facilities: facilitiesRes.rows,
            all: [...shopsRes.rows, ...facilitiesRes.rows]
        });
    } catch (e) {
        console.error('getAllShopsMap error:', e);
        res.status(500).json({ error: 'Failed' });
    }
};

const getMunicipalityItems = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM municipality_items WHERE municipality_id = $1 AND is_active = TRUE ORDER BY section, created_at DESC', [req.params.id]);
        const grouped = {};
        const sections = ['live_streams', 'public_squares', 'public_parks', 'services', 'tourism', 'culture'];
        sections.forEach(s => grouped[s] = []);
        result.rows.forEach(item => { if (grouped[item.section]) grouped[item.section].push(item); });
        res.json({ items: result.rows, grouped });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const addMunicipalityItem = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { name, section, latitude, longitude, description } = req.body;
        let image_url = null;
        if (req.file) {
            const { uploadToCloud } = require('../utils/storage');
            image_url = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
        const result = await pool.query(`INSERT INTO municipality_items (municipality_id, name, section, latitude, longitude, image_url, description, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [req.params.id, name, section, latitude, longitude, image_url, description, req.user.userId]);
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};

const deleteMunicipalityItem = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        await pool.query('DELETE FROM municipality_items WHERE id = $1', [req.params.itemId]);
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
};


const getShopPanoramas = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM university_panoramas WHERE shop_id = $1 ORDER BY created_at ASC', [id]);
        res.json({ panoramas: result.rows });
    } catch (e) {
        console.error('getShopPanoramas error:', e);
        res.status(500).json({ error: 'Failed to get panoramas' });
    }
};

const addShopPanorama = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, thumbnail_url, equirect_url } = req.body;
        const { uploadToCloud } = require('../utils/storage');
        
        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (shopRes.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
        
        const isAuthorized = req.user.role === 'admin' || String(shopRes.rows[0].owner_id) === String(req.user.userId || req.user.id);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        let finalThumbnailUrl = thumbnail_url;
        let finalEquirectUrl = equirect_url;

        // Handle File Uploads if present
        if (req.files) {
            if (req.files.thumbnail_file) {
                const file = req.files.thumbnail_file[0];
                finalThumbnailUrl = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
            }
            if (req.files.equirect_file) {
                const file = req.files.equirect_file[0];
                finalEquirectUrl = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
            }
        }

        if (!finalEquirectUrl) {
            return res.status(400).json({ error: 'Equirectangular image/URL is required' });
        }

        // If no thumbnail, use the equirect as thumbnail
        if (!finalThumbnailUrl) finalThumbnailUrl = finalEquirectUrl;

        const result = await pool.query(
            `INSERT INTO university_panoramas (shop_id, title, thumbnail_url, equirect_url) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, title, finalThumbnailUrl, finalEquirectUrl]
        );
        res.status(201).json(result.rows[0]);
    } catch (e) {
        console.error('addShopPanorama error:', e);
        res.status(500).json({ error: 'Failed to add panorama' });
    }
};

const deleteShopPanorama = async (req, res) => {
    try {
        const { panoramaId } = req.params;
        
        const panoRes = await pool.query('SELECT shop_id FROM university_panoramas WHERE id = $1', [panoramaId]);
        if (panoRes.rows.length === 0) return res.status(404).json({ error: 'Panorama not found' });
        
        const shopId = panoRes.rows[0].shop_id;
        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        
        const isAuthorized = req.user.role === 'admin' || String(shopRes.rows[0].owner_id) === String(req.user.userId || req.user.id);
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        await pool.query('DELETE FROM university_panoramas WHERE id = $1', [panoramaId]);
        res.json({ message: 'Panorama deleted successfully' });
    } catch (e) {
        console.error('deleteShopPanorama error:', e);
        res.status(500).json({ error: 'Failed to delete panorama' });
    }
};

module.exports = {

    getAllShopsMap,
    getFollowedUniversitiesFacilities,
    searchShops,
    smartSearch,
    followShop,
    unfollowShop,
    getFollowedShops,
    getManagedShops,
    createShop,
    updateShopProfile,
    deleteShop,
    updateShopImages,
    createShopPost,
    deleteShopPost,
    addProduct,
    updateProduct,
    deleteProduct,
    assignShopOwner,
    removeShopOwner,
    sendNotificationToFollowers,
    togglePostLike,
    addPostComment,
    addUniversityFacility,
    addFacilityPost,
    addCollegeSpecialty,
    deleteUniversityFacility,
    updateUniversityFacility,
    addMunicipalityItem,
    deleteMunicipalityItem,
    getShopProfile,
    getUniversityFacilities,
    getFacilityProfile,
    getPostComments,
    getMunicipalityItems,
    getShopPanoramas,
    addShopPanorama,
    deleteShopPanorama
};
