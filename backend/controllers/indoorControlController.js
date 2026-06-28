const pool = require('../config/database');

// 1. جلب جميع المباني
exports.getBuildings = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM indoor_buildings ORDER BY id DESC');
        res.json({ success: true, buildings: result.rows });
    } catch (err) {
        console.error('getBuildings error:', err);
        res.status(500).json({ error: 'فشل في جلب قائمة المباني' });
    }
};

// 2. إنشاء مبنى جديد
exports.createBuilding = async (req, res) => {
    try {
        const { name, floor_plan_url, scale_ratio } = req.body;
        const result = await pool.query(
            `INSERT INTO indoor_buildings (name, floor_plan_url, scale_ratio) 
             VALUES ($1, $2, $3) RETURNING *`,
            [name, floor_plan_url, scale_ratio || 1.0]
        );
        res.json({ success: true, building: result.rows[0] });
    } catch (err) {
        console.error('createBuilding error:', err);
        res.status(500).json({ error: 'فشل في إنشاء المبنى' });
    }
};

// 3. جلب التصميم الكامل للمبنى والرفوف
exports.getLayout = async (req, res) => {
    try {
        const { buildingId } = req.params;

        // جلب معلومات المبنى
        const buildingRes = await pool.query('SELECT * FROM indoor_buildings WHERE id = $1', [buildingId]);
        if (buildingRes.rows.length === 0) {
            return res.status(404).json({ error: 'المبنى غير موجود' });
        }

        // جلب الرفوف والمنتجات بجوين واحد سريع
        const layoutRes = await pool.query(
            `SELECT 
                su.id as unit_id, su.unit_code, su.x, su.y, su.width, su.depth, su.height, su.rotation,
                sl.id as level_id, sl.level_number, sl.height_offset,
                pp.id as placement_id, pp.product_name, pp.product_id, pp.quantity, pp.max_capacity
             FROM shelving_units su
             LEFT JOIN shelf_levels sl ON sl.unit_id = su.id
             LEFT JOIN product_placements pp ON pp.shelf_level_id = sl.id
             WHERE su.building_id = $1
             ORDER BY su.id, sl.level_number, pp.id`,
            [buildingId]
        );

        // تجميع البيانات في هيكل شجري منطقي
        const unitsMap = {};
        layoutRes.rows.forEach(row => {
            if (!unitsMap[row.unit_id]) {
                unitsMap[row.unit_id] = {
                    id: row.unit_id,
                    unit_code: row.unit_code,
                    x: parseFloat(row.x),
                    y: parseFloat(row.y),
                    width: parseFloat(row.width),
                    depth: parseFloat(row.depth),
                    height: parseFloat(row.height),
                    rotation: parseFloat(row.rotation),
                    levels: []
                };
            }

            if (row.level_id) {
                let level = unitsMap[row.unit_id].levels.find(l => l.id === row.level_id);
                if (!level) {
                    level = {
                        id: row.level_id,
                        level_number: row.level_number,
                        height_offset: parseFloat(row.height_offset),
                        placements: []
                    };
                    unitsMap[row.unit_id].levels.push(level);
                }

                if (row.placement_id) {
                    level.placements.push({
                        id: row.placement_id,
                        product_name: row.product_name,
                        product_id: row.product_id,
                        quantity: row.quantity,
                        max_capacity: row.max_capacity
                    });
                }
            }
        });

        res.json({
            success: true,
            building: buildingRes.rows[0],
            shelves: Object.values(unitsMap)
        });
    } catch (err) {
        console.error('getLayout error:', err);
        res.status(500).json({ error: 'فشل في جلب مخطط التحكم الداخلي' });
    }
};

// 4. حفظ أو تحديث تصميم الرفوف
exports.saveLayout = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { buildingId, shelves } = req.body;

        // 1. جلب المعرفات الحالية للرفوف في قاعدة البيانات للمبنى المحدد
        const currentShelvesRes = await client.query(
            'SELECT id FROM shelving_units WHERE building_id = $1',
            [buildingId]
        );
        const currentIds = currentShelvesRes.rows.map(r => r.id);
        const incomingIds = shelves.filter(s => s.id).map(s => s.id);

        // 2. حذف الرفوف التي لم تعد موجودة في التصميم الجديد
        const idsToDelete = currentIds.filter(id => !incomingIds.includes(id));
        if (idsToDelete.length > 0) {
            await client.query('DELETE FROM shelving_units WHERE id = ANY($1)', [idsToDelete]);
        }

        // 3. إضافة وتحديث الرفوف القادمة
        for (const shelf of shelves) {
            let unitId = shelf.id;

            if (unitId) {
                // تحديث الرف الحالي
                await client.query(
                    `UPDATE shelving_units 
                     SET unit_code = $1, x = $2, y = $3, width = $4, depth = $5, height = $6, rotation = $7
                     WHERE id = $8 AND building_id = $9`,
                    [shelf.unit_code, shelf.x, shelf.y, shelf.width, shelf.depth, shelf.height, shelf.rotation, unitId, buildingId]
                );
            } else {
                // إضافة رف جديد
                const insertRes = await client.query(
                    `INSERT INTO shelving_units (building_id, unit_code, x, y, width, depth, height, rotation)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [buildingId, shelf.unit_code, shelf.x, shelf.y, shelf.width, shelf.depth, shelf.height, shelf.rotation]
                );
                unitId = insertRes.rows[0].id;
            }

            // إدارة المستويات (Levels) والمنتجات (Placements) داخل هذا الرف
            if (shelf.levels && shelf.levels.length > 0) {
                // جلب المستويات الحالية للرف
                const currentLevelsRes = await client.query(
                    'SELECT id FROM shelf_levels WHERE unit_id = $1',
                    [unitId]
                );
                const currentLevelIds = currentLevelsRes.rows.map(l => l.id);
                const incomingLevelIds = shelf.levels.filter(l => l.id).map(l => l.id);

                // حذف المستويات القديمة
                const levelsToDelete = currentLevelIds.filter(id => !incomingLevelIds.includes(id));
                if (levelsToDelete.length > 0) {
                    await client.query('DELETE FROM shelf_levels WHERE id = ANY($1)', [levelsToDelete]);
                }

                for (const lvl of shelf.levels) {
                    let levelId = lvl.id;

                    if (levelId) {
                        // تحديث المستوى
                        await client.query(
                            `UPDATE shelf_levels SET level_number = $1, height_offset = $2 WHERE id = $3`,
                            [lvl.level_number, lvl.height_offset, levelId]
                        );
                    } else {
                        // إضافة مستوى جديد
                        const insertLvlRes = await client.query(
                            `INSERT INTO shelf_levels (unit_id, level_number, height_offset)
                             VALUES ($1, $2, $3) RETURNING id`,
                            [unitId, lvl.level_number, lvl.height_offset]
                        );
                        levelId = insertLvlRes.rows[0].id;
                    }

                    // إدارة المنتجات في هذا المستوى
                    if (lvl.placements && lvl.placements.length > 0) {
                        const currentPlacementsRes = await client.query(
                            'SELECT id FROM product_placements WHERE shelf_level_id = $1',
                            [levelId]
                        );
                        const currentPlacementIds = currentPlacementsRes.rows.map(p => p.id);
                        const incomingPlacementIds = lvl.placements.filter(p => p.id).map(p => p.id);

                        // حذف المنتجات القديمة
                        const placementsToDelete = currentPlacementIds.filter(id => !incomingPlacementIds.includes(id));
                        if (placementsToDelete.length > 0) {
                            await client.query('DELETE FROM product_placements WHERE id = ANY($1)', [placementsToDelete]);
                        }

                        for (const p of lvl.placements) {
                            if (p.id) {
                                // تحديث المنتج
                                await client.query(
                                    `UPDATE product_placements 
                                     SET product_name = $1, product_id = $2, quantity = $3, max_capacity = $4
                                     WHERE id = $5`,
                                    [p.product_name, p.product_id, p.quantity, p.max_capacity, p.id]
                                );
                            } else {
                                // إضافة منتج جديد على الرف
                                await client.query(
                                    `INSERT INTO product_placements (shelf_level_id, product_name, product_id, quantity, max_capacity)
                                     VALUES ($1, $2, $3, $4, $5)`,
                                    [levelId, p.product_name, p.product_id, p.quantity, p.max_capacity]
                                );
                            }
                        }
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'تم حفظ وتحديث مخطط التحكم الداخلي بنجاح' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('saveLayout error:', err);
        res.status(500).json({ error: 'فشل في حفظ وتحديث المخطط' });
    } finally {
        client.release();
    }
};

// 5. تحديث كمية المخزون لرف معين
exports.updateStock = async (req, res) => {
    try {
        const { placementId } = req.params;
        const { quantity } = req.body;

        const result = await pool.query(
            `UPDATE product_placements 
             SET quantity = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`,
            [quantity, placementId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'لم يتم العثور على المنتج المخصص على الرف' });
        }

        res.json({ success: true, placement: result.rows[0] });
    } catch (err) {
        console.error('updateStock error:', err);
        res.status(500).json({ error: 'فشل في تحديث كمية المخزون' });
    }
};

// 6. إنشاء مهمة تعيين جديدة للموظف
exports.createTask = async (req, res) => {
    try {
        const { description, shelf_level_id, assigned_to } = req.body;

        const result = await pool.query(
            `INSERT INTO indoor_tasks (description, shelf_level_id, assigned_to)
             VALUES ($1, $2, $3) RETURNING *`,
            [description, shelf_level_id, assigned_to]
        );

        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('createTask error:', err);
        res.status(500).json({ error: 'فشل في إنشاء وتكليف المهمة' });
    }
};

// 7. جلب جميع المهام
exports.getTasks = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.*, u.username as assigned_username, sl.level_number, su.unit_code
             FROM indoor_tasks t
             LEFT JOIN users u ON u.id = t.assigned_to
             LEFT JOIN shelf_levels sl ON sl.id = t.shelf_level_id
             LEFT JOIN shelving_units su ON su.id = sl.unit_id
             ORDER BY t.id DESC`
        );
        res.json({ success: true, tasks: result.rows });
    } catch (err) {
        console.error('getTasks error:', err);
        res.status(500).json({ error: 'فشل في جلب قائمة المهام' });
    }
};

// 8. تحديث حالة المهمة
exports.updateTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body; // pending, in_progress, completed

        let query = `UPDATE indoor_tasks SET status = $1`;
        const params = [status, taskId];

        if (status === 'completed') {
            query += `, completed_at = CURRENT_TIMESTAMP`;
        }

        query += ` WHERE id = $2 RETURNING *`;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'المهمة غير موجودة' });
        }

        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        console.error('updateTaskStatus error:', err);
        res.status(500).json({ error: 'فشل في تحديث حالة المهمة' });
    }
};

// 9. تسجيل المسح الداخلي وحركة الموظفين (QR Check-in)
exports.logScan = async (req, res) => {
    try {
        const { location_code, action_type } = req.body;
        const userId = req.user?.id || null;

        const result = await pool.query(
            `INSERT INTO indoor_logs (user_id, location_code, action_type)
             VALUES ($1, $2, $3) RETURNING *`,
            [userId, location_code, action_type || 'check_in']
        );

        res.json({ success: true, log: result.rows[0] });
    } catch (err) {
        console.error('logScan error:', err);
        res.status(500).json({ error: 'فشل في تسجيل عملية المسح' });
    }
};

// 10. تحديث المجسمات ثلاثية الأبعاد للمبنى
exports.updateBuildingShapes = async (req, res) => {
    try {
        const { buildingId } = req.params;
        const { shapesData } = req.body;

        await pool.query(
            'UPDATE indoor_buildings SET shapes_data = $1 WHERE id = $2',
            [shapesData, buildingId]
        );

        res.json({ success: true, message: 'تم تحديث المجسمات ثلاثية الأبعاد بنجاح' });
    } catch (err) {
        console.error('updateBuildingShapes error:', err);
        res.status(500).json({ error: 'فشل في حفظ المجسمات ثلاثية الأبعاد' });
    }
};
