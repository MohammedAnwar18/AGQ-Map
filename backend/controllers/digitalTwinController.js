const pool = require('../config/database');

exports.getLatestProject = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM digital_twin_projects ORDER BY created_at DESC LIMIT 1`
        );
        if (result.rows.length === 0) {
            return res.json({ project: null });
        }
        res.json({ success: true, project: result.rows[0] });
    } catch (err) {
        console.error('getLatestProject error:', err);
        res.status(500).json({ error: 'فشل في جلب مشروع التوأم الرقمي' });
    }
};

exports.saveProject = async (req, res) => {
    try {
        const {
            projectName,
            geojsonData,
            customPoints,
            customBuildings,
            customStreets,
            pointMappings,
            buildingTheme,
            buildingColor,
            heightProp,
            defaultHeight,
            activeBasemap,
            centerCoords
        } = req.body;

        const userId = req.user?.id || null;

        const result = await pool.query(
            `INSERT INTO digital_twin_projects 
            (project_name, geojsonData, customPoints, customBuildings, customStreets, pointMappings, buildingTheme, buildingColor, heightProp, defaultHeight, activeBasemap, centerCoords, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
            [
                projectName || 'مشروع توأم رقمي عام',
                geojsonData ? JSON.stringify(geojsonData) : null,
                customPoints ? JSON.stringify(customPoints) : null,
                customBuildings ? JSON.stringify(customBuildings) : null,
                customStreets ? JSON.stringify(customStreets) : null,
                pointMappings ? JSON.stringify(pointMappings) : null,
                buildingTheme,
                buildingColor,
                heightProp,
                defaultHeight,
                activeBasemap,
                centerCoords ? JSON.stringify(centerCoords) : null,
                userId
            ]
        );

        res.json({ success: true, message: 'تم حفظ ونشر التوأم الرقمي بنجاح', project: result.rows[0] });
    } catch (err) {
        console.error('saveProject error:', err);
        res.status(500).json({ error: 'فشل في حفظ ونشر التوأم الرقمي' });
    }
};
