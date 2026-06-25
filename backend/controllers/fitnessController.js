const pool = require('../config/database');

/**
 * حفظ مسار اللياقة للمستخدم
 */
const saveRun = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const {
            activity_type,
            duration_seconds,
            distance_km,
            calories_burned,
            avg_speed_kmh,
            path_coordinates
        } = req.body;

        if (!activity_type || duration_seconds === undefined || distance_km === undefined || calories_burned === undefined || avg_speed_kmh === undefined || !path_coordinates) {
            return res.status(400).json({ error: 'جميع حقول المسار الرياضي مطلوبة' });
        }

        // تحويل مصفوفة الإحداثيات إلى نص لتخزينها في قاعدة البيانات
        const coordsStr = typeof path_coordinates === 'string' ? path_coordinates : JSON.stringify(path_coordinates);

        const result = await pool.query(
            `INSERT INTO fitness_runs 
            (user_id, activity_type, duration_seconds, distance_km, calories_burned, avg_speed_kmh, path_coordinates)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [userId, activity_type, duration_seconds, distance_km, calories_burned, avg_speed_kmh, coordsStr]
        );

        res.status(201).json({
            success: true,
            message: 'تم حفظ ونشر مسار اللياقة بنجاح',
            run: result.rows[0]
        });
    } catch (error) {
        console.error('Error saving fitness run:', error);
        res.status(500).json({ error: 'فشل حفظ ونشر مسار اللياقة' });
    }
};

/**
 * جلب المسارات النشطة للمستخدم وأصدقائه (آخر 24 ساعة)
 */
const getFriendsActiveRuns = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        // جلب مسارات الـ 24 ساعة الماضية الخاصة بالمستخدم وأصدقائه من جدول الصداقات
        const result = await pool.query(
            `SELECT fr.id, fr.user_id, fr.activity_type, fr.duration_seconds, 
                    fr.distance_km, fr.calories_burned, fr.avg_speed_kmh, 
                    fr.path_coordinates, fr.created_at,
                    u.username, u.full_name, u.profile_picture
             FROM fitness_runs fr
             JOIN users u ON fr.user_id = u.id
             WHERE (fr.user_id = $1 OR fr.user_id IN (
                 SELECT CASE WHEN f.user1_id = $1 THEN f.user2_id ELSE f.user1_id END 
                 FROM friendships f 
                 WHERE f.user1_id = $1 OR f.user2_id = $1
             ))
             AND fr.created_at >= NOW() - INTERVAL '24 hours'
             ORDER BY fr.created_at DESC`,
            [userId]
        );

        // تحويل إحداثيات المسار من نص (JSON string) إلى مصفوفة لتسهيل معالجتها في الواجهة الأمامية
        const formattedRuns = result.rows.map(row => {
            try {
                row.path_coordinates = JSON.parse(row.path_coordinates);
            } catch (e) {
                row.path_coordinates = [];
            }
            return row;
        });

        res.json({
            success: true,
            runs: formattedRuns
        });
    } catch (error) {
        console.error('Error fetching active fitness runs:', error);
        res.status(500).json({ error: 'فشل جلب المسارات النشطة للأصدقاء' });
    }
};

module.exports = {
    saveRun,
    getFriendsActiveRuns
};
