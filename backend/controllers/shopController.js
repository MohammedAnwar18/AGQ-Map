const pool = require('../config/database');

// --- 1. Search Shops ---
const searchShops = async (req, res) => {
    try {
        const { query } = req.query;
        const userId = req.user.id || req.user.userId;

        if (!query) return res.json({ shops: [] });

        const result = await pool.query(`
            SELECT s.id, s.name, s.category, s.profile_picture, s.latitude, s.longitude,
                   EXISTS(SELECT 1 FROM shop_followers WHERE shop_id = s.id AND user_id = $2::int) as is_followed
            FROM shops s
            WHERE s.name ILIKE $1 AND s.is_hidden = FALSE
            LIMIT 10
        `, [`%${query}%`, parseInt(userId)]);

        res.json({ shops: result.rows });
    } catch (error) {
        console.error('Search shops error:', error);
        res.status(500).json({ error: 'Failed to search shops' });
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

        console.log(`✅ User ${userId} successfully followed shop ${shopId}`);
        res.json({ message: 'Shop followed successfully', shopId });
    } catch (error) {
        console.error('❌ Follow shop error:', error);
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
                  AND parent.category = 'بنك'
                  AND child.is_hidden = FALSE
            ),
            AllRelevantShopIds AS (
                SELECT id FROM FollowedShops
                UNION
                SELECT id FROM BankChildren
            )
            SELECT s.*,
            (
                SELECT json_agg(json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'full_name', u.full_name,
                    'latitude', u.last_latitude,
                    'longitude', u.last_longitude,
                    'profile_picture', u.profile_picture,
                    'car_type', sd.car_type,
                    'plate_number', sd.plate_number,
                    'passengers_capacity', sd.passengers_capacity
                ))
                FROM shop_drivers sd
                JOIN users u ON sd.user_id = u.id
                WHERE sd.shop_id = s.id AND sd.is_active = TRUE AND u.last_latitude IS NOT NULL
            ) as active_drivers,
            (s.id IN (SELECT id FROM FollowedShops)) as is_followed
            FROM shops s
            WHERE s.id IN (SELECT id FROM AllRelevantShopIds)
            ORDER BY s.name ASC
        `, [userId]);

        console.log(`📋 User ${userId} has ${result.rows.length} followed shops in DB`);
        res.json({ shops: result.rows });
    } catch (error) {
        console.error('❌ Get followed shops error:', error);
        res.status(500).json({ error: 'Failed to get followed shops' });
    }
};

// --- 5. Create Shop (Admin) ---
const createShop = async (req, res) => {
    try {
        const { name, latitude, longitude, category, parent_shop_id, floor } = req.body;
        const ownerId = req.user.userId;

        console.log('Creating shop with data:', { name, latitude, longitude, category, ownerId });

        // Ensure lat/long are valid numbers
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'Invalid coordinates provided' });
        }

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
    } catch (e) {
        console.error('Create shop error database level:', e);
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
        const currentUserId = req.user.id || req.user.userId;

        // 1. Get Shop Details
        const shopResult = await pool.query(`
            SELECT s.*, 
                   u.username as owner_name, -- Fetch owner name
                   (SELECT COUNT(*)::int FROM shop_followers WHERE shop_id = s.id) as followers_count,
                   EXISTS(SELECT 1 FROM shop_followers WHERE shop_id = s.id AND user_id = $2::int) as is_followed
            FROM shops s
            LEFT JOIN users u ON s.owner_id = u.id -- Join with users
            WHERE s.id = $1::int
        `, [shopId, parseInt(currentUserId)]);

        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const shop = shopResult.rows[0];
        const isOwner = shop.owner_id === currentUserId;

        const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [parseInt(currentUserId)]);
        const userRole = userRes.rows[0]?.role;

        if (shop.is_hidden && !isOwner && userRole !== 'admin') {
            return res.status(404).json({ error: 'Shop not found or is hidden' });
        }

        // 2. Get Shop Posts
        const postsResult = await pool.query(`
            SELECT p.*,
                   (SELECT COUNT(*)::int FROM likes WHERE post_id = p.id) as likes_count,
                   (SELECT COUNT(*)::int FROM comments WHERE post_id = p.id) as comments_count,
                   EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) as is_liked
            FROM posts p
            WHERE p.shop_id = $1
            ORDER BY p.created_at DESC
        `, [shopId, currentUserId]);

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
        const queryStr = `UPDATE shops SET ${queryParts.join(', ')} WHERE id = $${index}`;

        await pool.query(queryStr, values);

        res.json({ message: 'Shop updated successfully' });
    } catch (error) {
        console.error('Update shop error:', error);
        res.status(500).json({ error: 'Failed', details: error.message });
    }
};

// --- 7.5 Update Shop Images (Profile/Cover) ---
const updateShopImages = async (req, res) => {
    try {
        const shopId = req.params.id;
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { uploadToSupabase, deleteFileFromCloud } = require('../utils/storage');

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

        if (req.files['profile_picture']) {
            const file = req.files['profile_picture'][0];
            const url = await uploadToSupabase(file.buffer, file.originalname, file.mimetype);
            updateQueryPart.push(`profile_picture = $${index++}`);
            params.push(url);
            // Cleanup old pic
            if (oldProfilePic) deleteFileFromCloud(oldProfilePic);
        }

        if (req.files['cover_picture']) {
            const file = req.files['cover_picture'][0];
            const url = await uploadToSupabase(file.buffer, file.originalname, file.mimetype);
            updateQueryPart.push(`cover_picture = $${index++}`);
            params.push(url);
            // Cleanup old pic
            if (oldCoverPic) deleteFileFromCloud(oldCoverPic);
        }

        if (updateQueryPart.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        params.push(shopId);
        const query = `UPDATE shops SET ${updateQueryPart.join(', ')} WHERE id = $${index}`;

        await pool.query(query, params);

        // Fetch updated images to return to frontend
        const updatedRes = await pool.query('SELECT profile_picture, cover_picture FROM shops WHERE id = $1', [shopId]);

        res.json({
            message: 'Shop updated successfully',
            profile_picture: updatedRes.rows[0].profile_picture,
            cover_picture: updatedRes.rows[0].cover_picture
        });

    } catch (e) {
        console.error('Update shop images error:', e);
        res.status(500).json({
            error: 'Failed to update images',
            details: e.message,
            stack: e.stack.split('\n')[0] // Log just the first line of the stack
        });
    }
};

// --- 8. Create Shop Post ---
const createShopPost = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { content } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { uploadToSupabase } = require('../utils/storage');

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
        const { name, price, description, old_price } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { uploadToSupabase } = require('../utils/storage');

        // Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (!shopCheck.rows.length) return res.status(404).json({ error: 'Shop not found' });
        if (userRole !== 'admin' && shopCheck.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        let image_url = null;
        if (req.file) {
            image_url = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
        }

        const result = await pool.query(`
            INSERT INTO shop_products (shop_id, name, price, description, image_url, old_price)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [shopId, name, price, description, image_url, old_price || null]);

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
        const { name, price, description, old_price } = req.body;
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

        if (req.file) {
            const url = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
            queryParts.push(`image_url = $${index++}`);
            values.push(url);
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

        // 3. Insert Notifications for all followers
        // Sender ID is the current user (Owner)
        await pool.query(`
            INSERT INTO notifications (user_id, sender_id, type, message)
            SELECT user_id, $1, 'shop_alert', $2
            FROM shop_followers
            WHERE shop_id = $3
        `, [userId, payload, shopId]);

        res.json({ message: 'Notification sent successfully' });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
};

// --- 12. Add Shop Driver ---
const addShopDriver = async (req, res) => {
    try {
        const { id } = req.params; // Shop ID
        const { username, car_type, plate_number, passengers } = req.body;
        const userId = req.user.userId;

        // Check Permissions (Admin or Owner)
        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (shopRes.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        // Find User
        const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const driverId = userRes.rows[0].id;

        // Add Driver with details
        await pool.query(`
            INSERT INTO shop_drivers (shop_id, user_id, car_type, plate_number, passengers_capacity) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (shop_id, user_id) DO UPDATE SET 
                is_active = TRUE, 
                car_type = $3, 
                plate_number = $4, 
                passengers_capacity = $5
        `, [id, driverId, car_type, plate_number, passengers || 4]);

        res.json({ message: 'Driver added successfully' });
    } catch (error) {
        console.error('Add driver error:', error);
        res.status(500).json({ error: 'Failed to add driver' });
    }
};

// --- 13. Get Shop Drivers ---
const getShopDrivers = async (req, res) => {
    try {
        const { id } = req.params;
        // Fetch drivers including their last known location and car details
        const result = await pool.query(`
            SELECT u.id, u.username, u.full_name, u.profile_picture, 
                   u.last_latitude as latitude, u.last_longitude as longitude,
                   sd.car_type, sd.plate_number, sd.passengers_capacity
            FROM shop_drivers sd
            JOIN users u ON sd.user_id = u.id
            WHERE sd.shop_id = $1 AND sd.is_active = TRUE
        `, [id]);
        res.json({ drivers: result.rows });
    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({ error: 'Failed to get drivers' });
    }
};

// --- 14. Remove Shop Driver ---
const removeShopDriver = async (req, res) => {
    try {
        const { id, driverId } = req.params;
        const userId = req.user.userId;

        // Check Permissions
        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (shopRes.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await pool.query('DELETE FROM shop_drivers WHERE shop_id = $1 AND user_id = $2', [id, driverId]);
        res.json({ message: 'Driver removed successfully' });
    } catch (error) {
        console.error('Remove driver error:', error);
        res.status(500).json({ error: 'Failed to remove driver' });
    }
};

// --- 15. Request Taxi ---
const requestTaxi = async (req, res) => {
    try {
        const { id } = req.params; // shopId
        const userId = req.user.userId;
        const { latitude, longitude, address } = req.body;

        // Check active request
        const activeCheck = await pool.query(
            "SELECT id FROM taxi_requests WHERE user_id = $1 AND status IN ('pending', 'accepted', 'arrived')",
            [userId]
        );
        if (activeCheck.rows.length > 0) {
            return res.status(400).json({ error: 'لديك طلب حالي بالفعل' });
        }

        const result = await pool.query(`
            INSERT INTO taxi_requests (user_id, shop_id, pickup_location, pickup_address)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5)
            RETURNING *
        `, [userId, id, longitude, latitude, address || 'موقع محدد']);

        // Notify Shop Owner
        const shopOwnerRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (shopOwnerRes.rows.length > 0) {
            const ownerId = shopOwnerRes.rows[0].owner_id;
            await pool.query(`
                INSERT INTO notifications (user_id, sender_id, type, message)
                VALUES ($1, $2, 'taxi_request', 'لديك طلب تاكسي جديد!')
            `, [ownerId, userId]);
        }

        res.json(result.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to request taxi' });
    }
};

// --- 16. Get Shop REQUESTS (For Admin/Owner) ---
const getShopRequests = async (req, res) => {
    try {
        const { id } = req.params; // shopId
        const userId = req.user.userId;

        const shopRes = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (shopRes.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
        if (req.user.role !== 'admin' && shopRes.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        const result = await pool.query(`
            SELECT tr.*, u.username, u.full_name, u.profile_picture, u.phone_number,
                   ST_X(tr.pickup_location::geometry) as longitude,
                   ST_Y(tr.pickup_location::geometry) as latitude
            FROM taxi_requests tr
            JOIN users u ON tr.user_id = u.id
            WHERE tr.shop_id = $1 AND tr.status IN ('pending', 'accepted', 'arrived')
            ORDER BY tr.created_at DESC
        `, [id]);

        res.json({ requests: result.rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed' });
    }
};

// --- 17. Update Request Status ---
const updateRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, driverId } = req.body;
        const userId = req.user.userId;

        let updateQuery = `UPDATE taxi_requests SET status = $1`;
        let params = [status];
        let idx = 2;

        if (driverId) {
            updateQuery += `, driver_id = $${idx++}`;
            params.push(driverId);
        }

        updateQuery += ` WHERE id = $${idx++} RETURNING *`;
        params.push(requestId);

        const result = await pool.query(updateQuery, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
        const request = result.rows[0];

        // Notify User
        let msg = '';
        let type = 'info';
        if (status === 'accepted') { msg = 'تم قبول طلبك! السائق في الطريق.'; type = 'taxi_accepted'; }
        else if (status === 'arrived') { msg = 'وصل السائق إلى موقعك! 🚖'; type = 'taxi_arrived'; }
        else if (status === 'completed') { msg = 'تم إكمال الرحلة. شكراً لك!'; type = 'taxi_completed'; }
        else if (status === 'cancelled') { msg = 'تم إلغاء طلبك.'; type = 'taxi_cancelled'; }

        if (msg) {
            await pool.query(`
                INSERT INTO notifications (user_id, sender_id, type, message)
                VALUES ($1, $2, $3, $4)
            `, [request.user_id, userId, type, msg]);
        }

        res.json(result.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed' });
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
        `, [id, name, category, icon || '📍', latitude, longitude, description || '']);

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
        if (facility.category === 'الكليات') {
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
        if (checkRes.rows[0].category !== 'الكليات') return res.status(400).json({ error: 'Not a College' });
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
    followShop,
    unfollowShop,
    getFollowedShops,
    createShop,
    deleteShop,
    getShopProfile,
    updateShopProfile,
    updateShopImages,
    createShopPost,
    addProduct,
    updateProduct,
    deleteProduct,
    assignShopOwner,
    removeShopOwner,
    getManagedShops,
    sendNotificationToFollowers,
    addShopDriver,
    getShopDrivers,
    removeShopDriver,
    requestTaxi,
    getShopRequests,
    updateRequestStatus,
    addUniversityFacility,
    getUniversityFacilities,
    getFacilityProfile,
    addFacilityPost,
    addCollegeSpecialty,
    togglePostLike,
    addPostComment,
    getPostComments,
    deleteShopPost
};
