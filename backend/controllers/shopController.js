const pool = require('../config/database');

// --- 1. Search Shops ---
const searchShops = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json({ shops: [] });

        const result = await pool.query(`
            SELECT id, name, category, profile_picture 
            FROM shops 
            WHERE name ILIKE $1 
            LIMIT 10
        `, [`%${query}%`]);

        res.json({ shops: result.rows });
    } catch (error) {
        console.error('Search shops error:', error);
        res.status(500).json({ error: 'Failed to search shops' });
    }
};

// --- 2. Follow Shop ---
const followShop = async (req, res) => {
    try {
        const userId = req.user.userId;
        const shopId = req.params.id;

        await pool.query(`
            INSERT INTO shop_followers (user_id, shop_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, shop_id) DO NOTHING
        `, [userId, shopId]);

        res.json({ message: 'Shop followed successfully' });
    } catch (error) {
        console.error('Follow shop error:', error);
        res.status(500).json({ error: 'Failed to follow shop' });
    }
};

// --- 3. Unfollow Shop ---
const unfollowShop = async (req, res) => {
    try {
        const userId = req.user.userId;
        const shopId = req.params.id;

        await pool.query(`
            DELETE FROM shop_followers 
            WHERE user_id = $1 AND shop_id = $2
        `, [userId, shopId]);

        res.json({ message: 'Shop unfollowed' });
    } catch (error) {
        console.error('Unfollow shop error:', error);
        res.status(500).json({ error: 'Failed to unfollow shop' });
    }
};

// --- 4. Get Followed Shops ---
const getFollowedShops = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(`
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
            ) as active_drivers
            FROM shops s
            JOIN shop_followers sf ON s.id = sf.shop_id
            WHERE sf.user_id = $1
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
        const { name, latitude, longitude, category } = req.body;
        const result = await pool.query(`
            INSERT INTO shops (name, latitude, longitude, category)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, latitude, longitude, category]);
        res.json(result.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Create fail' });
    }
};

// --- 6. Get Shop Profile (Info + Posts + Products) ---
const getShopProfile = async (req, res) => {
    try {
        const shopId = req.params.id;
        const currentUserId = req.user.userId;

        // 1. Get Shop Details
        const shopResult = await pool.query(`
            SELECT s.*, 
                   u.username as owner_name, -- Fetch owner name
                   (SELECT COUNT(*)::int FROM shop_followers WHERE shop_id = s.id) as followers_count,
                   EXISTS(SELECT 1 FROM shop_followers WHERE shop_id = s.id AND user_id = $2) as is_followed
            FROM shops s
            LEFT JOIN users u ON s.owner_id = u.id -- Join with users
            WHERE s.id = $1
        `, [shopId, currentUserId]);

        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const shop = shopResult.rows[0];
        const isOwner = shop.owner_id === currentUserId;

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

        res.json({
            shop: { ...shop, is_owner: isOwner },
            posts: postsResult.rows,
            products: productsResult.rows
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
        if (req.body.enable_proximity_notifications !== undefined) {
            queryParts.push(`enable_proximity_notifications = $${index++}`);
            values.push(req.body.enable_proximity_notifications);
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

        // Check Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const ownerId = shopCheck.rows[0].owner_id;
        if (userRole !== 'admin' && ownerId !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        let updateQueryPart = [];
        let params = [];
        let index = 1;

        if (req.files['profile_picture']) {
            updateQueryPart.push(`profile_picture = $${index++}`);
            params.push(`/uploads/${req.files['profile_picture'][0].filename}`);
        }

        if (req.files['cover_picture']) {
            updateQueryPart.push(`cover_picture = $${index++}`);
            params.push(`/uploads/${req.files['cover_picture'][0].filename}`);
        }

        if (updateQueryPart.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        params.push(shopId);
        const query = `UPDATE shops SET ${updateQueryPart.join(', ')} WHERE id = $${index}`;

        await pool.query(query, params);
        res.json({ message: 'Shop updated successfully' });

    } catch (e) {
        console.error('Update shop images error:', e);
        res.status(500).json({ error: 'Failed to update images' });
    }
};

// --- 8. Create Shop Post ---
const createShopPost = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { content } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

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

        // 1. Get Shop Location
        const shopRes = await pool.query('SELECT latitude, longitude FROM shops WHERE id = $1', [shopId]);
        const { latitude, longitude } = shopRes.rows[0];

        if (req.files && req.files.length > 0) {
            media_urls = req.files.map(file => `/uploads/${file.filename}`);
            image_url = media_urls[0];
            media_type = req.files[0].mimetype.startsWith('video/') ? 'video' : 'image';
        }

        const result = await pool.query(`
            INSERT INTO posts (
                shop_id, content, image_url, media_urls, media_type,
                location, address, created_at
            )
            VALUES (
                $1, $2, $3, $4, $5, 
                ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, 
                'Shop Location', 
                NOW()
            )
            RETURNING *, ST_X(location::geometry) as longitude, ST_Y(location::geometry) as latitude
        `, [shopId, content, image_url, media_urls, media_type, longitude, latitude]);

        res.json({
            ...result.rows[0],
            location: { latitude, longitude }
        });
    } catch (error) {
        console.error('Create shop post error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
};

// --- 8.5 Add Product ---
const addProduct = async (req, res) => {
    try {
        const shopId = req.params.id;
        const { name, price, description, old_price } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

        // Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (!shopCheck.rows.length) return res.status(404).json({ error: 'Shop not found' });
        if (userRole !== 'admin' && shopCheck.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        let image_url = null;
        if (req.file) { // Assuming single file for product for now
            image_url = `/uploads/${req.file.filename}`;
        }

        const result = await pool.query(`
            INSERT INTO shop_products (shop_id, name, price, description, image_url, old_price)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [shopId, name, price, description, image_url, old_price || null]);

        res.json(result.rows[0]);
    } catch (e) {
        console.error('Add product error:', e);
        res.status(500).json({ error: 'Failed to add product' });
    }
};

// --- 8.6 Update Product ---
const updateProduct = async (req, res) => {
    try {
        const { id, productId } = req.params; // id is shopId
        const { name, price, description, old_price } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

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
            queryParts.push(`image_url = $${index++}`);
            values.push(`/uploads/${req.file.filename}`);
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
        res.status(500).json({ error: 'Failed to update product' });
    }
};

// --- 8.7 Delete Product ---
const deleteProduct = async (req, res) => {
    try {
        const { id, productId } = req.params; // id is shopId
        const userId = req.user.userId;
        const userRole = req.user.role;

        // Permissions
        const shopCheck = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [id]);
        if (!shopCheck.rows.length) return res.status(404).json({ error: 'Shop not found' });
        if (userRole !== 'admin' && shopCheck.rows[0].owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        await pool.query('DELETE FROM shop_products WHERE id = $1 AND shop_id = $2', [productId, id]);
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

module.exports = {
    searchShops,
    followShop,
    unfollowShop,
    getFollowedShops,
    createShop,
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
    getFollowedUniversitiesFacilities,
    deleteShop,
    deleteShopPost,
    togglePostLike,
    addPostComment,
    addUniversityFacility,
    addFacilityPost,
    addCollegeSpecialty,
    deleteUniversityFacility,
    updateUniversityFacility,
    addMunicipalityItem,
    deleteMunicipalityItem,
    addShopPanorama,
    deleteShopPanorama,
    smartSearch,
    getAllShopsMap,
    getUniversityFacilities,
    getFacilityProfile,
    getPostComments,
    getMunicipalityItems,
    getShopPanoramas
};
