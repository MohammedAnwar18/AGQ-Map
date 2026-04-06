const pool = require('../config/database');

// Get all communities, with "is_joined" status for current user
const getAllCommunities = async (req, res) => {
    try {
        const userId = req.user.userId;

        const query = `
            SELECT c.*, 
            EXISTS(SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1) as is_joined,
            (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id) as members_count
            FROM communities c
            ORDER BY c.created_at DESC
        `;

        const result = await pool.query(query, [userId]);
        res.json({ communities: result.rows });
    } catch (error) {
        console.error('Get communities error:', error);
        res.status(500).json({ error: 'Server error getting communities' });
    }
};

// Create a community (Admin only)
const createCommunity = async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const query = `
            INSERT INTO communities (name, description)
            VALUES ($1, $2)
            RETURNING *,
            false as is_joined,
            0 as members_count
        `;
        
        const result = await pool.query(query, [name, description || '']);
        
        res.status(201).json({ community: result.rows[0], message: 'Community created successfully' });
    } catch (error) {
        console.error('Create community error:', error);
        res.status(500).json({ error: 'Server error creating community' });
    }
};

// Join a community
const joinCommunity = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check if exists
        const commCheck = await pool.query('SELECT id FROM communities WHERE id = $1', [id]);
        if (commCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Community not found' });
        }

        // Check if already joined
        const memberCheck = await pool.query(
            'SELECT id FROM community_members WHERE community_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (memberCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Already joined this community' });
        }

        await pool.query(
            'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)',
            [id, userId]
        );

        res.json({ message: 'Joined community successfully' });
    } catch (error) {
        console.error('Join community error:', error);
        res.status(500).json({ error: 'Server error joining community' });
    }
};

// Get community posts
const getCommunityPosts = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check if user is member? (Optional requirement, usually yes for privacy, but user said "User location ... not visible to others", assumed content is shared within community)
        // I'll enforce membership to see posts
        const memberCheck = await pool.query(
            'SELECT id FROM community_members WHERE community_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'You must join this community to view posts' });
        }

        const query = `
        SELECT 
          p.id, p.user_id, p.content, p.image_url, p.media_urls, p.media_type,
          ST_X(p.location::geometry) as longitude,
          ST_Y(p.location::geometry) as latitude,
          p.address, p.created_at,
          u.username, u.full_name, u.profile_picture,
          (SELECT COUNT(*)::int FROM comments WHERE post_id = p.id) as comments_count,
          (SELECT COUNT(*)::int FROM likes WHERE post_id = p.id) as likes_count,
          EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) as is_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.community_id = $1
        ORDER BY p.created_at DESC
        LIMIT 100
      `;

        const result = await pool.query(query, [id, userId]);

        res.json({
            posts: result.rows.map(post => ({
                id: post.id,
                content: post.content,
                image_url: post.image_url,
                media_urls: post.media_urls || (post.image_url ? [post.image_url] : []),
                media_type: post.media_type || 'image',
                location: {
                    latitude: post.latitude,
                    longitude: post.longitude
                },
                address: post.address,
                created_at: post.created_at,
                user: {
                    id: post.user_id,
                    username: post.username,
                    full_name: post.full_name,
                    profile_picture: post.profile_picture
                },
                comments_count: post.comments_count || 0,
                likes_count: post.likes_count || 0,
                is_liked: post.is_liked || false
            }))
        });

    } catch (error) {
        console.error('Get community posts error:', error);
        res.status(500).json({ error: 'Server error fetching community posts' });
    }
};

module.exports = {
    getAllCommunities,
    joinCommunity,
    getCommunityPosts,
    createCommunity
};
