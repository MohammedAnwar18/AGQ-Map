const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');

// Simple auth middleware for push routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

/**
 * @route POST /subscription
 * @desc Register or update a user's push subscription
 * @access Private
 */
router.post('/subscribe', authenticateToken, async (req, res) => {
    const { subscription } = req.body;
    const userId = req.user.id;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    try {
        // Upsert the subscription for this user
        // Using UNIQUE(user_id, subscription) to avoid duplicate rows for same user and device
        await pool.query(
            `INSERT INTO push_subscriptions (user_id, subscription)
             VALUES ($1, $2)
             ON CONFLICT (user_id, subscription) DO NOTHING`,
            [userId, subscription]
        );

        res.status(201).json({ success: true, message: 'Subscription saved' });
    } catch (error) {
        console.error('Push subscribe error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @route POST /unsubscribe
 * @desc Remove a push subscription
 * @access Private
 */
router.post('/unsubscribe', authenticateToken, async (req, res) => {
    const { endpoint } = req.body;
    const userId = req.user.id;

    if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint required' });
    }

    try {
        await pool.query(
            `DELETE FROM push_subscriptions 
             WHERE user_id = $1 AND (subscription->>'endpoint') = $2`,
            [userId, endpoint]
        );
        res.json({ success: true, message: 'Unsubscribed successfully' });
    } catch (error) {
        console.error('Push unsubscribe error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
