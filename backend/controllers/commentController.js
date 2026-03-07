const pool = require('../config/database');

const { createNotification } = require('./notificationController');

/**
 * الحصول على تعليقات منشور
 */
const getComments = async (req, res) => {
    try {
        const { postId } = req.params;

        const result = await pool.query(
            `SELECT 
                c.id, c.content, c.created_at, c.parent_id,
                u.id as user_id, u.username, u.full_name, u.profile_picture
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.post_id = $1
             ORDER BY c.created_at ASC`,
            [postId]
        );

        res.json({ comments: result.rows });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Server error fetching comments' });
    }
};

/**
 * إضافة تعليق جديد أو رد
 */
const addComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content, parentId } = req.body; // parentId for replies
        const userId = req.user.userId;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const result = await pool.query(
            `INSERT INTO comments (post_id, user_id, content, parent_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, content, created_at, parent_id`,
            [postId, userId, content, parentId || null]
        );

        const newComment = result.rows[0];

        // 1. Notify Post Owner (if top-level comment or not the owner)
        const postResult = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
        if (postResult.rows.length > 0) {
            const postOwnerId = postResult.rows[0].user_id;
            if (postOwnerId !== userId && !parentId) {
                const preview = content.length > 20 ? content.substring(0, 20) + '...' : content;
                await createNotification(postOwnerId, userId, 'comment', `علق على منشورك: ${preview}`);
            }
        }

        // 2. Notify Parent Comment Owner (if it's a reply)
        if (parentId) {
            const parentResult = await pool.query('SELECT user_id FROM comments WHERE id = $1', [parentId]);
            if (parentResult.rows.length > 0) {
                const parentOwnerId = parentResult.rows[0].user_id;
                if (parentOwnerId !== userId) {
                    const preview = content.length > 20 ? content.substring(0, 20) + '...' : content;
                    await createNotification(parentOwnerId, userId, 'reply', `رد على تعليقك: ${preview}`);
                }
            }
        }

        // Get user details to return with the comment
        const userResult = await pool.query(
            'SELECT id as user_id, username, full_name, profile_picture FROM users WHERE id = $1',
            [userId]
        );

        res.status(201).json({
            message: 'Comment added successfully',
            comment: {
                ...newComment,
                ...userResult.rows[0]
            }
        });

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Server error adding comment' });
    }
};

module.exports = { getComments, addComment };
