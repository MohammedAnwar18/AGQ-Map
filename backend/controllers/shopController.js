const pool = require('../config/database');

// --- 1. Search Shops ---
const searchShops = async (req, res) => {
    try {
        const { query } = req.query;
        const userId = req.user ? (req.user.id || req.user.userId) : null;

        if (!query) return res.json({ shops: [] });

        let result;
        if (userId) {
            result = await pool.query(`
                SELECT s.id, s.name, s.category, s.profile_picture, 
                       s.latitude, s.longitude, s.floor,
                       s.parent_shop_id,
                       parent.name AS parent_shop_name,
                       parent.category AS parent_shop_category,
                       EXISTS(SELECT 1 FROM shop_followers WHERE shop_id = s.id AND user_id = $2::int) as is_followed
                FROM shops s
                LEFT JOIN shops parent ON s.parent_shop_id = parent.id
                WHERE s.name ILIKE $1 AND s.is_hidden = FALSE
                ORDER BY 
                    CASE WHEN s.parent_shop_id IS NULL THEN 0 ELSE 1 END,
                    s.name ASC
                LIMIT 15
            `, [`%${query}%`, parseInt(userId)]);
        } else {
            result = await pool.query(`
                SELECT s.id, s.name, s.category, s.profile_picture, 
                       s.latitude, s.longitude, s.floor,
                       s.parent_shop_id,
                       parent.name AS parent_shop_name,
                       parent.category AS parent_shop_category,
                       FALSE as is_followed
                FROM shops s
                LEFT JOIN shops parent ON s.parent_shop_id = parent.id
                WHERE s.name ILIKE $1 AND s.is_hidden = FALSE
                ORDER BY 
                    CASE WHEN s.parent_shop_id IS NULL THEN 0 ELSE 1 END,
                    s.name ASC
                LIMIT 15
            `, [`%${query}%`]);
        }

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
                       NULL::text as product_description, NULL::text[] as product_images,
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
                       p.description as product_description, p.images as product_images,
                       p.id as product_id, 'product' as result_type
                FROM shop_products p
                JOIN shops s ON p.shop_id = s.id
                LEFT JOIN shops parent ON s.parent_shop_id = parent.id
                WHERE p.name ILIKE $2 ${priceCondition} AND s.is_hidden = FALSE
                ORDER BY p.price ASC
                LIMIT 30
            )
            SELECT * FROM matching_shops
            UNION ALL
            SELECT * FROM matching_products
            ORDER BY result_type, product_price ASC NULLS LAST
        `;

        const result = await pool.query(sql, params);

        const shopsMap = {};
        result.rows.forEach(row => {
            if (!shopsMap[row.id]) {
                shopsMap[row.id] = {
                    id: row.id, name: row.name, category: row.category,
                    profile_picture: row.profile_picture, latitude: row.latitude,
                    longitude: row.longitude, floor: row.floor,
                    parent_shop_id: row.parent_shop_id,
                    parent_shop_name: row.parent_shop_name,
                    is_followed: row.is_followed, products: []
                };
            }
            if (row.result_type === 'product' && row.product_id) {
                shopsMap[row.id].products.push({
                    id: row.product_id, name: row.product_name,
                    description: row.product_description,
                    price: row.product_price, images: row.product_images
                });
            }
        });

        res.json({ results: Object.values(shopsMap) });
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

        console.log(`User ${userId} attempting to follow shop ${shopId}`);

        await pool.query(`
            INSERT INTO shop_followers (user_id, shop_id)
            VALUES ($1::int, $2::int)
            ON CONFLICT (user_id, shop_id) DO NOTHING
        `, [parseInt(userId), shopId]);

        console.log(`âœ… User ${userId} successfully followed shop ${shopId}`);
        res.json({ message: 'Shop followed successfully', shopId });
    } catch (error) {
        console.error('âŒ Follow shop error:', error);
        res.status(500).json({ error: 'Failed to follow shop: ' + error.message });
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
                  AND parent.category = 'Ø¨Ù†Ùƒ'
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

        console.log(`ðŸ“‹ User ${userId} has ${result.rows.length} followed shops in DB`);
        res.json({ shops: result.rows });
    } catch (error) {
        console.error('âŒ Get followed shops error:', error);
        res.status(500).json({ error: 'Failed to get followed shops' });
    }
};

// --- 5. Create Shop (Admin) ---
const createShop = async (req, res) => {
    try {
        const { name, latitude, longitude, category, parent_shop_id, floor } = req.body;
        const ownerId = req.user.id || req.user.userId;

        console.log('Creating shop with data:', { name, latitude, longitude, category, ownerId, parent_shop_id, floor });

        // Ensure lat/long are valid numbers
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'Invalid coordinates provided' });
        }

        try {
            const result = await pool.query(`
                INSERT INTO shops (name, latitude, longitude, category, owner_id, parent_shop_id, floor, location)
                VALUES ($1, $2::numeric, $3::numeric, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography)
                RETURNING *
            `, [name, lat, lon, category || 'General', ownerId, parent_shop_id || null, floor || null]);

            const newShop = result.rows[0];
            console.log('Shop created successfully:', newShop.id);

            // Auto-follow for the creator
            try {
                await pool.query(`
                    INSERT INTO shop_followers (user_id, shop_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `, [ownerId, newShop.id]);
            } catch (followError) {
                console.error('Auto-follow failed but shop was created:', followError);
            }

            res.json(newShop);
        } catch (dbError) {
            console.error('Create shop database error details:', dbError.message, dbError.stack);
            res.status(500).json({ error: 'Database error: ' + dbError.message });
        }
    } catch (e) {
        console.error('Create shop error system level:', e);
        res.status(500).json({ error: 'Failed to create shop: ' + (e.message || 'Server error') });
    }
};

// --- 5.1 Delete Shop (Admin) ---
const deleteShop = async (req, res) => {
    try {
        const shopId = req.params.id;

        const result = await pool.query('DELETE FROM shops WHERE id = $1 RETURNING id', [shopId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        res.json({ message: 'Shop deleted successfully' });
    } catch (e) {
        console.error('Delete shop error:', e);
        res.status(500).json({ error: 'Failed to delete shop' });
    }
};

// --- 6. Get Shop Profile (Info + Posts + Products) ---
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

        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const shop = shopResult.rows[0];
        const isOwner = currentUserId && shop.owner_id === currentUserId;

        let userRole = null;
        if (currentUserId) {
            const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [parseInt(currentUserId)]);
            userRole = userRes.rows[0]?.role;
        }

        if (shop.is_hidden && !isOwner && userRole !== 'admin') {
            return res.status(404).json({ error: 'Shop not found or is hidden' });
        }

        // 2. Get Shop Posts
        let postsResult;
        if (currentUserId) {
            postsResult = await pool.query(`
                SELECT p.*,
                       (SELECT COUNT(*)::int FROM likes WHERE post_id = p.id) as likes_count,
                       (SELECT COUNT(*)::int FROM comments WHERE post_id = p.id) as comments_count,
                       EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) as is_liked
                FROM posts p
                WHERE p.shop_id = $1
                ORDER BY p.created_at DESC
            `, [shopId, currentUserId]);
        } else {
            postsResult = await pool.query(`
                SELECT p.*,
                       (SELECT COUNT(*)::int FROM likes WHERE post_id = p.id) as likes_count,
                       (SELECT COUNT(*)::int FROM comments WHERE post_id = p.id) as comments_count,
                       FALSE as is_liked
                FROM posts p
                WHERE p.shop_id = $1
                ORDER BY p.created_at DESC
            `, [shopId]);
        }

        // 3. Get Shop Products
        const productsResult = await pool.query(`
            SELECT * FROM shop_products WHERE shop_id = $1 ORDER BY created_at DESC
        `, [shopId]);

        // 4. Get Internal Shops (If this is a Mall/Complex)
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
        res.status(500).json({ error: 'Failed to get shop profile' });
    }
};

// --- 7. Update Shop Profile (Text) ---
const updateShopProfile = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { bio, opening_hours, contact_info, name, latitude, longitude, category } = req.body;
        const userId = req.user.userId;

        // Fetch fresh user role
        const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        const userRole = userRes.rows[0]?.role;

        // Check Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const ownerId = shopCheck.rows[0].owner_id;

        if (userRole !== 'admin' && ownerId !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Dynamic Query Construction
        let queryParts = [];
        let values = [];
        let index = 1;

        if (name !== undefined) {
            queryParts.push(`name = $${index++}`);
            values.push(name);
        }
        if (bio !== undefined) {
            queryParts.push(`bio = $${index++}`);
            values.push(bio);
        }
        if (opening_hours !== undefined) {
            queryParts.push(`opening_hours = $${index++}`);
            values.push(opening_hours);
        }
        if (contact_info !== undefined) {
            queryParts.push(`contact_info = $${index++}`);
            values.push(contact_info);
        }
        if (category !== undefined) {
            queryParts.push(`category = $${index++}`);
            values.push(category);
        }
        if (req.body.parent_shop_id !== undefined) {
            queryParts.push(`parent_shop_id = $${index++}`);
            values.push(req.body.parent_shop_id || null);
        }
        if (req.body.floor !== undefined) {
            queryParts.push(`floor = $${index++}`);
            values.push(req.body.floor || null);
        }
        if (req.body.enable_proximity_notifications !== undefined) {
            queryParts.push(`enable_proximity_notifications = $${index++}`);
            values.push(req.body.enable_proximity_notifications);
        }
        if (req.body.is_hidden !== undefined) {
            queryParts.push(`is_hidden = $${index++}`);
            values.push(req.body.is_hidden);
        }
        if (req.body.hidden_sections !== undefined && userRole === 'admin') {
            queryParts.push(`hidden_sections = $${index++}`);
            values.push(req.body.hidden_sections);
        }
        if (req.body.proximity_radius !== undefined) {
            queryParts.push(`proximity_radius = $${index++}`);
            values.push(parseInt(req.body.proximity_radius) || 500);
        }

        // Handle Coordinates
        let latVal = parseFloat(latitude);
        let lonVal = parseFloat(longitude);
        if (!isNaN(latVal) && !isNaN(lonVal)) {
            // Use separate parameters for columns and point to avoid type deduction ambiguity in Postgres
            queryParts.push(`latitude = $${index++}`);
            values.push(latVal);

            queryParts.push(`longitude = $${index++}`);
            values.push(lonVal);

            // ST_MakePoint(longitude, latitude) -> (x, y)
            queryParts.push(`location = ST_SetSRID(ST_MakePoint($${index++}, $${index++}), 4326)::geography`);
            values.push(lonVal); // For ST_MakePoint first arg
            values.push(latVal); // For ST_MakePoint second arg
        }

        if (queryParts.length === 0) {
            return res.json({ message: 'No changes provided' });
        }

        values.push(shopId);
        const queryStr = `UPDATE shops SET ${queryParts.join(', ')} WHERE id = $${index++} RETURNING *`;
        const result = await pool.query(queryStr, values);

        res.json(result.rows[0]);
    } catch (e) {
        console.error('Update profile error:', e);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

/**
 * Update shop images (profile_picture, cover_picture)
 */
const updateShopImages = async (req, res) => {
    try {
        const shopId = req.params.id;
        const userId = req.user.id || req.user.userId;
        const userRole = req.user.role;
        const { uploadToCloud, deleteFileFromCloud } = require('../utils/storage');

        // Check Permissions & Get old images
        const shopCheck = await pool.query('SELECT owner_id, profile_picture, cover_picture FROM shops WHERE id = $1', [shopId]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const { owner_id: ownerId, profile_picture: oldProfilePic, cover_picture: oldCoverPic } = shopCheck.rows[0];

        if (userRole !== 'admin' && ownerId !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        let updateQueryPart = [];
        let params = [];
        let index = 1;

        if (req.files) {
            if (req.files.profile_picture) {
                const file = req.files.profile_picture[0];
                const url = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
                updateQueryPart.push(`profile_picture = $${index++}`);
                params.push(url);
                if (oldProfilePic) try { deleteFileFromCloud(oldProfilePic); } catch (e) { }
            }

            if (req.files.cover_picture) {
                const file = req.files.cover_picture[0];
                const url = await uploadToCloud(file.buffer, file.originalname, file.mimetype);
                updateQueryPart.push(`cover_picture = $${index++}`);
                params.push(url);
                if (oldCoverPic) try { deleteFileFromCloud(oldCoverPic); } catch (e) { }
            }
        }

        if (updateQueryPart.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        params.push(shopId);
        const query = `UPDATE shops SET ${updateQueryPart.join(', ')} WHERE id = $${index} RETURNING *`;
        const updateRes = await pool.query(query, params);

        res.json({
            message: 'Shop updated successfully',
            shop: updateRes.rows[0]
        });

    } catch (e) {
        console.error('Update shop images error:', e);
        res.status(500).json({
            error: 'Failed to update images',
            details: e.message
        });
    }
};

// --- 8. Create Shop Post ---
const createShopPost = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { content } = req.body;
        const userId = req.user.id || req.user.userId;
        const userRole = req.user.role;
        const { uploadToCloud } = require('../utils/storage');

        // Check Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const ownerId = shopCheck.rows[0].owner_id;
        if (userRole !== 'admin' && ownerId !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Handle images
        let media_urls = [];
        let image_url = null;
        let media_type = 'text';
        const { title, external_link, post_type } = req.body;

        // 1. Get Shop Location
        const shopRes = await pool.query('SELECT latitude, longitude FROM shops WHERE id = $1', [shopId]);
        const { latitude, longitude } = shopRes.rows[0];

        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file =>
                uploadToSupabase(file.buffer, file.originalname, file.mimetype)
            );
            media_urls = await Promise.all(uploadPromises);
            image_url = media_urls[0];
            media_type = req.files[0].mimetype.startsWith('video/') ? 'video' : 'image';
        }

        const result = await pool.query(`
            INSERT INTO posts (
                shop_id, content, image_url, media_urls, media_type,
                location, address, title, external_link, post_type, created_at
            )
            VALUES (
                $1, $2, $3, $4, $5, 
                ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, 
                'Shop Location', $8, $9, $10,
                NOW()
            )
            RETURNING *, ST_X(location::geometry) as longitude, ST_Y(location::geometry) as latitude
        `, [shopId, content, image_url, media_urls, media_type, longitude, latitude, title || null, external_link || null, post_type || 'news']);

        res.json({
            ...result.rows[0],
            location: { latitude, longitude }
        });
    } catch (error) {
        console.error('Create shop post error:', error);
        res.status(500).json({
            error: 'Failed to create post',
            details: error.message,
            stack: error.stack.split('\n')[0]
        });
    }
};

// --- 8.5 Add Product ---
const addProduct = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { name, price, description, old_price, category } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { uploadToSupabase } = require('../utils/storage');

        // Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (!shopCheck.rows.length) return res.status(404).json({ error: 'Shop not found' });
        if (userRole !== 'admin' && shopCheck.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        let image_urls = [];
        let image_url = null;
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file =>
                uploadToSupabase(file.buffer, file.originalname, file.mimetype)
            );
            image_urls = await Promise.all(uploadPromises);
            image_url = image_urls[0];
        }

        const result = await pool.query(`
            INSERT INTO shop_products (shop_id, name, price, description, image_url, image_urls, old_price, category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [shopId, name, price, description, image_url, image_urls, old_price || null, category || null]);

        res.json(result.rows[0]);
    } catch (e) {
        console.error('Add product error:', e);
        res.status(500).json({
            error: 'Failed to add product',
            details: e.message,
            stack: e.stack.split('\n')[0]
        });
    }
};

// --- 8.6 Update Product ---
const updateProduct = async (req, res) => {
    try {
        const { id, productId } = req.params; // id is shopId
        const { name, price, description, old_price, category } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { uploadToSupabase } = require('../utils/storage');

        // Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (!shopCheck.rows.length) return res.status(404).json({ error: 'Shop not found' });
        if (userRole !== 'admin' && shopCheck.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        let queryParts = [];
        let values = [];
        let index = 1;

        if (name !== undefined) { queryParts.push(`name = $${index++}`); values.push(name); }
        if (price !== undefined) { queryParts.push(`price = $${index++}`); values.push(price); }
        if (description !== undefined) { queryParts.push(`description = $${index++}`); values.push(description); }
        if (old_price !== undefined) { queryParts.push(`old_price = $${index++}`); values.push(old_price || null); }
        if (category !== undefined) { queryParts.push(`category = $${index++}`); values.push(category || null); }

        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file =>
                uploadToSupabase(file.buffer, file.originalname, file.mimetype)
            );
            const urls = await Promise.all(uploadPromises);

            queryParts.push(`image_url = $${index++}`);
            values.push(urls[0]);

            queryParts.push(`image_urls = $${index++}`);
            values.push(urls);
        }

        if (queryParts.length === 0) return res.json({ message: 'No changes provided' });

        values.push(productId);
        values.push(id);

        const queryStr = `UPDATE shop_products SET ${queryParts.join(', ')} WHERE id = $${index++} AND shop_id = $${index} RETURNING *`;
        const result = await pool.query(queryStr, values);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

        res.json(result.rows[0]);
    } catch (e) {
        console.error('Update product error:', e);
        res.status(500).json({
            error: 'Failed to update product',
            details: e.message,
            stack: e.stack.split('\n')[0]
        });
    }
};

// --- 8.7 Delete Product ---
const deleteProduct = async (req, res) => {
    try {
        const { id, productId } = req.params; // id is shopId
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { deleteFileFromCloud } = require('../utils/storage');

        // Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (!shopCheck.rows.length) return res.status(404).json({ error: 'Shop not found' });
        if (userRole !== 'admin' && shopCheck.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        // Get product image before delete
        const prodData = await pool.query('SELECT image_url FROM shop_products WHERE id = $1 AND shop_id = $2', [productId, id]);
        const imageUrl = prodData.rows[0]?.image_url;

        await pool.query('DELETE FROM shop_products WHERE id = $1 AND shop_id = $2', [productId, id]);

        if (imageUrl) deleteFileFromCloud(imageUrl);

        res.json({ message: 'Product deleted' });
    } catch (e) {
        console.error('Delete product error:', e);
        res.status(500).json({ error: 'Failed to delete product' });
    }
};

// --- 9. Assign Shop Owner (Admin Only) ---
const assignShopOwner = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can assign owners' });
        }
        const shopId = req.params.id;
        const { username } = req.body; // Assign by username

        // 1. Find User ID
        const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const newOwnerId = userRes.rows[0].id;

        // 2. Update Shop
        await pool.query('UPDATE shops SET owner_id = $1 WHERE id = $2', [newOwnerId, shopId]);

        res.json({ message: `Shop ownership assigned to ${username}` });
    } catch (error) {
        console.error('Assign owner error:', error);
        res.status(500).json({ error: 'Failed to assign owner' });
    }
};

// --- 9.5 Remove Shop Owner (Admin Only) ---
const removeShopOwner = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can remove owners' });
        }
        const shopId = req.params.id;

        await pool.query('UPDATE shops SET owner_id = NULL WHERE id = $1', [shopId]);

        res.json({ message: 'Shop owner removed successfully' });
    } catch (error) {
        console.error('Remove owner error:', error);
        res.status(500).json({ error: 'Failed to remove owner' });
    }
};

// --- 10. Get My Managed Shops ---
const getManagedShops = async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query('SELECT * FROM shops WHERE owner_id = $1', [userId]);
        res.json({ shops: result.rows });
    } catch (error) {
        console.error('Get managed shops error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

// --- 11. Send Notification to Followers ---
const sendNotificationToFollowers = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { message } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

        if (!message) return res.status(400).json({ error: 'Message is required' });

        // 1. Verify Ownership & Get Shop Details
        const shopRes = await pool.query('SELECT owner_id, name, latitude, longitude, profile_picture FROM shops WHERE id = $1', [shopId]);
        if (shopRes.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const shop = shopRes.rows[0];
        if (userRole !== 'admin' && shop.owner_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // 2. Prepare Payload (JSON)
        // We store JSON in the text message field to handle the structured data
        const payload = JSON.stringify({
            shopId: shopId,
            shopName: shop.name,
            shopImage: shop.profile_picture, // Store current image
            text: message,
            location: { latitude: shop.latitude, longitude: shop.longitude }
        });

        // 3. Geographic Targeting Check
        const { lat, lon, radius } = req.body;
        let whereClause = 'WHERE sf.shop_id = $3';
        let queryParams = [userId, payload, shopId];

        if (lat && lon && radius) {
            // Target followers within specific area
            // We use ST_DWithin to check if user's last known location is within 'radius' meters of (lon, lat)
            whereClause += ` AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(u.last_longitude, u.last_latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                $6
            )`;
            queryParams.push(parseFloat(lon), parseFloat(lat), parseFloat(radius));
        }

        // 4. Insert Notifications for all followers (filtered if area provided)
        await pool.query(`
            INSERT INTO notifications (user_id, sender_id, type, message)
            SELECT sf.user_id, $1, 'shop_alert', $2
            FROM shop_followers sf
            JOIN users u ON sf.user_id = u.id
            ${whereClause}
        `, queryParams);

        res.json({ message: 'Notification sent successfully' });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
};


// --- 18. Add University Facility ---
const addUniversityFacility = async (req, res) => {
    try {
        const { id } = req.params; // Shop/University ID
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { name, category, icon, latitude, longitude, description } = req.body;

        // Permissions: Only Owner or Admin can add
        const shopRes = await pool.query('SELECT owner_id, category FROM shops WHERE id = $1', [id]);
        if (shopRes.rows.length === 0) return res.status(404).json({ error: 'University not found' });
        if (shopRes.rows[0].category !== 'University') return res.status(400).json({ error: 'Not a University' });
        if (userRole !== 'admin' && shopRes.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized to add facilities' });

        const result = await pool.query(`
            INSERT INTO university_facilities (university_id, name, category, icon, latitude, longitude, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [id, name, category, icon || 'ðŸ“', latitude, longitude, description || '']);

        res.status(201).json({ message: 'Facility added', facility: result.rows[0] });
    } catch (error) {
        console.error('Add facility error:', error);
        res.status(500).json({ error: 'Failed to add facility' });
    }
};

// --- 19. Get University Facilities ---
const getUniversityFacilities = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT * FROM university_facilities WHERE university_id = $1 ORDER BY category, name
        `, [id]);

        // Group by category for easier frontend rendering
        const facilitiesByCategory = {};
        result.rows.forEach(fac => {
            if (!facilitiesByCategory[fac.category]) {
                facilitiesByCategory[fac.category] = [];
            }
            facilitiesByCategory[fac.category].push(fac);
        });

        res.json({ facilities: facilitiesByCategory, list: result.rows });
    } catch (error) {
        console.error('Get facilities error:', error);
        res.status(500).json({ error: 'Failed to get facilities' });
    }
};

// --- 20. Get Single Facility Profile (Info + Posts + Specialties) ---
const getFacilityProfile = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const userId = req.user.userId;

        // 1. Get Facility Details
        const facilityRes = await pool.query(`
            SELECT f.*, s.name as university_name, s.owner_id as uni_owner_id
            FROM university_facilities f
            JOIN shops s ON f.university_id = s.id
            WHERE f.id = $1
        `, [facilityId]);

        if (facilityRes.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });
        const facility = facilityRes.rows[0];

        // 2. Get Posts (Events, News, etc.)
        const postsRes = await pool.query(`
            SELECT fp.*, u.username, u.profile_picture as user_avatar
            FROM facility_posts fp
            LEFT JOIN users u ON fp.user_id = u.id
            WHERE fp.facility_id = $1
            ORDER BY fp.created_at DESC
        `, [facilityId]);

        // 3. Get Specialties (Colleges only)
        let specialties = [];
        if (facility.category === 'Ø§Ù„ÙƒÙ„ÙŠØ§Øª') {
            const specRes = await pool.query(`
                SELECT * FROM university_specialties WHERE facility_id = $1 ORDER BY name
            `, [facilityId]);
            specialties = specRes.rows;
        }

        res.json({
            facility,
            posts: postsRes.rows,
            specialties,
            is_admin: req.user.role === 'admin' || facility.uni_owner_id === userId
        });
    } catch (error) {
        console.error('Get facility profile error:', error);
        res.status(500).json({ error: 'Failed to get facility details' });
    }
};

// --- 21. Add Post to Facility ---
const addFacilityPost = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { title, content, post_type, event_date } = req.body;
        const userId = req.user.userId;

        // Check permission (Uni owner or Admin)
        const checkRes = await pool.query(`
            SELECT s.owner_id FROM university_facilities f 
            JOIN shops s ON f.university_id = s.id 
            WHERE f.id = $1
        `, [facilityId]);

        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });
        if (req.user.role !== 'admin' && checkRes.rows[0].owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { uploadToSupabase } = require('../utils/storage');
        let media_urls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const url = await uploadToSupabase(file.buffer, file.originalname, file.mimetype);
                media_urls.push(url);
            }
        }

        const result = await pool.query(`
            INSERT INTO facility_posts (facility_id, user_id, title, content, post_type, event_date, media_urls, media_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [facilityId, userId, title, content, post_type || 'news', event_date || null, media_urls, media_urls.length > 0 ? 'image' : 'text']);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add facility post error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

// --- 22. Add Specialty to College ---
const addCollegeSpecialty = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { name, description, degree_level } = req.body;
        const userId = req.user.userId;

        // Permission check
        const checkRes = await pool.query(`
            SELECT s.owner_id, f.category FROM university_facilities f 
            JOIN shops s ON f.university_id = s.id 
            WHERE f.id = $1
        `, [facilityId]);

        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'College not found' });
        if (checkRes.rows[0].category !== 'Ø§Ù„ÙƒÙ„ÙŠØ§Øª') return res.status(400).json({ error: 'Not a College' });
        if (req.user.role !== 'admin' && checkRes.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        const result = await pool.query(`
            INSERT INTO university_specialties (facility_id, name, description, degree_level)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [facilityId, name, description, degree_level]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add specialty error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

// --- 23. Post Interactions (Like/Comment) ---

// --- 22-A. Delete University Facility (Admin or University Owner) ---
const deleteUniversityFacility = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;

        // Check facility and get university owner
        const facilityCheck = await pool.query(`
            SELECT f.id, s.owner_id 
            FROM university_facilities f
            JOIN shops s ON f.university_id = s.id
            WHERE f.id = $1
        `, [facilityId]);

        if (facilityCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Facility not found' });
        }

        const uniOwnerId = facilityCheck.rows[0].owner_id;

        // Permission: Admin OR University Owner
        if (userRole !== 'admin' && uniOwnerId !== userId) {
            return res.status(403).json({ error: 'Unauthorized: You do not own this university' });
        }

        // Delete dependencies first
        await pool.query('DELETE FROM facility_posts WHERE facility_id = $1', [facilityId]);
        await pool.query('DELETE FROM university_specialties WHERE facility_id = $1', [facilityId]);
        await pool.query('DELETE FROM university_facilities WHERE id = $1', [facilityId]);

        res.json({ message: 'Facility deleted successfully' });
    } catch (error) {
        console.error('Delete facility error:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف المرفق. يرجى المحاولة لاحقاً.' });
    }
};


// --- 22-B. Rename University Facility (Admin or Owner) ---
const renameUniversityFacility = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { name } = req.body;
        const userId = req.user.userId;

        if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

        const checkRes = await pool.query(`
            SELECT f.id, s.owner_id FROM university_facilities f
            JOIN shops s ON f.university_id = s.id
            WHERE f.id = $1
        `, [facilityId]);

        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });
        if (req.user.role !== 'admin' && checkRes.rows[0].owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await pool.query(
            'UPDATE university_facilities SET name = $1 WHERE id = $2 RETURNING *',
            [name.trim(), facilityId]
        );

        res.json({ message: 'Facility renamed', facility: result.rows[0] });
    } catch (error) {
        console.error('Rename facility error:', error);
        res.status(500).json({ error: 'Failed to rename facility' });
    }
};

const togglePostLike = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        const checkRes = await pool.query('SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);

        if (checkRes.rows.length > 0) {
            await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
            res.json({ liked: false });
        } else {
            await pool.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [userId, postId]);
            res.json({ liked: true });
        }
    } catch (error) {
        res.status(500).json({ error: 'Like failed' });
    }
};

const addPostComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;

        const result = await pool.query(`
            INSERT INTO comments (user_id, post_id, content)
            VALUES ($1, $2, $3)
            RETURNING *, (SELECT username FROM users WHERE id = $1) as username, (SELECT profile_picture FROM users WHERE id = $1) as profile_picture
        `, [userId, postId, content]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Comment failed' });
    }
};

const getPostComments = async (req, res) => {
    try {
        const { postId } = req.params;
        const result = await pool.query(`
            SELECT c.*, u.username, u.profile_picture
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC
        `, [postId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get comments' });
    }
};

const deleteShopPost = async (req, res) => {
    try {
        const { id, postId } = req.params; // id is shopId
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { deleteFileFromCloud } = require('../utils/storage');

        // Check Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const ownerId = shopCheck.rows[0].owner_id;
        if (userRole !== 'admin' && ownerId !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Get post image before delete
        const postData = await pool.query('SELECT image_url FROM posts WHERE id = $1 AND shop_id = $2', [postId, id]);
        if (postData.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

        const imageUrl = postData.rows[0]?.image_url;

        await pool.query('DELETE FROM posts WHERE id = $1 AND shop_id = $2', [postId, id]);

        if (imageUrl) {
            try {
                await deleteFileFromCloud(imageUrl);
            } catch (e) {
                console.error('Failed to delete image from cloud', e);
            }
        }

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete shop post error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
};

module.exports = {
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
    renameUniversityFacility,
    addMunicipalityItem,
    deleteMunicipalityItem,
    getShopProfile,
    getUniversityFacilities,
    getFacilityProfile,
    getPostComments,
    getMunicipalityItems
};

// ====================================================================
// --- MUNICIPALITY ITEMS (البلديات) ---
// ====================================================================

/**
 * GET /shops/:id/municipality-items
 * Get all items grouped by section for a municipality
 */
async function getMunicipalityItems(req, res) {
    try {
        const municipalityId = parseInt(req.params.id);

        const result = await pool.query(`
            SELECT id, name, section, latitude, longitude, image_url, description, is_active, created_at
            FROM municipality_items
            WHERE municipality_id = $1 AND is_active = TRUE
            ORDER BY section ASC, created_at DESC
        `, [municipalityId]);

        // Group by section
        const grouped = {};
        const sectionOrder = ['live_streams', 'public_squares', 'public_parks', 'services', 'tourism', 'culture'];
        sectionOrder.forEach(s => { grouped[s] = []; });

        result.rows.forEach(item => {
            if (!grouped[item.section]) grouped[item.section] = [];
            grouped[item.section].push(item);
        });

        res.json({ items: result.rows, grouped });
    } catch (error) {
        console.error('getMunicipalityItems error:', error);
        res.status(500).json({ error: 'Failed to get municipality items' });
    }
}

/**
 * POST /shops/:id/municipality-items
 * Add a new item to a municipality section (Admin only)
 */
async function addMunicipalityItem(req, res) {
    try {
        const municipalityId = parseInt(req.params.id);
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;

        if (userRole !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { name, section, latitude, longitude, description } = req.body;

        if (!name || !section || !latitude || !longitude) {
            return res.status(400).json({ error: 'name, section, latitude, longitude are required' });
        }

        const validSections = ['live_streams', 'public_squares', 'public_parks', 'services', 'tourism', 'culture'];
        if (!validSections.includes(section)) {
            return res.status(400).json({ error: `Invalid section. Must be one of: ${validSections.join(', ')}` });
        }

        let image_url = null;
        if (req.file) {
            const { uploadToCloud } = require('../utils/storage');
            image_url = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);
        }

        const result = await pool.query(`
            INSERT INTO municipality_items (municipality_id, name, section, latitude, longitude, image_url, description, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [municipalityId, name, section, parseFloat(latitude), parseFloat(longitude), image_url, description || null, userId]);

        res.json({ item: result.rows[0] });
    } catch (error) {
        console.error('addMunicipalityItem error:', error);
        res.status(500).json({ error: 'Failed to add municipality item', details: error.message });
    }
}

/**
 * DELETE /shops/municipality-items/:itemId
 * Delete a municipality item (Admin only)
 */
async function deleteMunicipalityItem(req, res) {
    try {
        const itemId = parseInt(req.params.itemId);
        const userRole = req.user.role;

        if (userRole !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const result = await pool.query(
            'DELETE FROM municipality_items WHERE id = $1 RETURNING id',
            [itemId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('deleteMunicipalityItem error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
}


