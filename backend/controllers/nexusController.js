const pool = require('../config/database');
const { uploadToCloud } = require('../utils/storage');

/* ============================================================
   بالنوفا نكسس — كتالوج مركزي

   الأدمن العام يبني كتالوجاً من تصنيفات ومنتجات. وكل صاحب حساب
   يملك محلاً يفتحه فيرى الكتالوج، ويضغط على منتج فيصير منتجاً في
   محلّه — داخل التصنيف الذي يختاره هو في محلّه، لا الذي اختاره
   الأدمن هنا.

   والنسخ نسخة لا رابط: المنتج في المحلّ صفّ في ‎shop_products‎
   يملكه صاحب المحلّ، يعدّل سعره واسمه ويحذفه كما يشاء. ولا يتغيّر
   شيء في محلّه إن عدّل الأدمن الكتالوج بعدها — وهذا هو المقصود،
   فالسعر عنده سعره هو.

   ويبقى ‎nexus_product_id‎ على الصفّ المنسوخ، لا ليربطه بل ليُعرف
   أنّه مأخوذ من هنا: فلا يُضاف مرّتين بالخطأ، وتظهر عليه علامة
   «عندك» في الكتالوج.
   ============================================================ */

const isAdmin = (req) => req.user?.role === 'admin';

const denyNonAdmin = (req, res) => {
    if (isAdmin(req)) return false;
    res.status(403).json({ error: 'هذا القسم للأدمن العام' });
    return true;
};

const parsePrice = (value) => {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const num = parseFloat(value);
    return Number.isNaN(num) ? null : num;
};

const parseId = (value) => {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
};

/* الصور تُرفع كما في بقيّة المشروع: إلى R2، وإلى Base64 حين لا
   يكون مُهيّأً — فالقرص على Vercel للقراءة فقط */
const uploadImages = async (req) => {
    const files = Array.isArray(req.files)
        ? req.files
        : (req.files?.images || (req.file ? [req.file] : []));

    const urls = [];
    for (const file of files) {
        const url = file.buffer
            ? await uploadToCloud(file.buffer, file.originalname, file.mimetype)
            : `/uploads/${file.filename}`;
        if (url) urls.push(url);
    }
    return urls;
};

const normalizeProduct = (row) => {
    if (!row) return row;

    let images = [];
    if (Array.isArray(row.images)) images = row.images.filter(Boolean);
    else if (typeof row.images === 'string') {
        try { images = (JSON.parse(row.images) || []).filter(Boolean); } catch { images = []; }
    }
    if (!images.length && row.image_url) images = [row.image_url];

    return {
        ...row,
        images,
        image_url: row.image_url || images[0] || null,
        price: row.price === null || row.price === undefined || row.price === '' ? null : row.price
    };
};

/* ============================================================
   العرض
   ============================================================ */

/**
 * كل ما يحتاجه الكتالوج في طلب واحد.
 *
 * التصنيفات والمنتجات ومحلّات هذا المستخدم وما سبق أن أضافه —
 * أربعة طلبات لو فُصلت، وكلّها مطلوبة قبل أن يُرسم شيء.
 */
const getCatalog = async (req, res) => {
    try {
        const userId = req.user.userId;
        const admin = isAdmin(req);

        const [categories, products, shops] = await Promise.all([
            pool.query(`
                SELECT c.id, c.name, c.image_url, c.sort_order,
                       (SELECT COUNT(*)::int FROM nexus_products p
                         WHERE p.category_id = c.id AND p.is_active) AS products_count
                FROM nexus_categories c
                ORDER BY c.sort_order ASC, c.id ASC
            `),
            pool.query(`
                SELECT p.*, c.name AS category_name
                FROM nexus_products p
                LEFT JOIN nexus_categories c ON c.id = p.category_id
                ${admin ? '' : 'WHERE p.is_active'}
                ORDER BY p.sort_order ASC, p.created_at DESC
            `),
            /* الأدمن يضيف لأي محلّ، وغيره لما يملكه هو */
            admin
                ? pool.query('SELECT id, name, profile_picture, category FROM shops ORDER BY name ASC')
                : pool.query(
                    'SELECT id, name, profile_picture, category FROM shops WHERE owner_id = $1 ORDER BY name ASC',
                    [userId]
                )
        ]);

        /*
         * ما أضافه هذا المستخدم من قبل.
         *
         * خريطة ‎{ معرّف المنتج: [معرّفات المحلّات] }‎ — فتظهر العلامة
         * على البطاقة فوراً، ويُمنع التكرار قبل أن يحدث لا بعده.
         */
        const adopted = {};
        const shopIds = shops.rows.map(s => s.id);

        if (shopIds.length) {
            const mine = await pool.query(`
                SELECT DISTINCT nexus_product_id, shop_id
                FROM shop_products
                WHERE nexus_product_id IS NOT NULL AND shop_id = ANY($1::int[])
            `, [shopIds]);

            for (const row of mine.rows) {
                (adopted[row.nexus_product_id] ||= []).push(row.shop_id);
            }
        }

        res.json({
            categories: categories.rows,
            products: products.rows.map(normalizeProduct),
            shops: shops.rows,
            adopted,
            is_admin: admin
        });
    } catch (error) {
        console.error('Nexus catalog error:', error);
        res.status(500).json({ error: 'تعذّر تحميل الكتالوج' });
    }
};

/* ============================================================
   التصنيفات — للأدمن
   ============================================================ */

const addCategory = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'اسم التصنيف مطلوب' });

        const images = await uploadImages(req);

        const result = await pool.query(`
            INSERT INTO nexus_categories (name, image_url, sort_order)
            VALUES ($1, $2, $3)
            ON CONFLICT (name) DO UPDATE
                SET image_url = COALESCE(EXCLUDED.image_url, nexus_categories.image_url)
            RETURNING *
        `, [name.slice(0, 120), images[0] || null, parseInt(req.body.sort_order, 10) || 0]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Nexus add category error:', error);
        res.status(500).json({ error: 'تعذّرت إضافة التصنيف' });
    }
};

const updateCategory = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'معرّف غير صالح' });

        const parts = [];
        const values = [];
        let i = 1;

        if (req.body.name !== undefined) {
            const name = String(req.body.name).trim();
            if (!name) return res.status(400).json({ error: 'اسم التصنيف مطلوب' });
            parts.push(`name = $${i++}`);
            values.push(name.slice(0, 120));
        }
        if (req.body.sort_order !== undefined) {
            parts.push(`sort_order = $${i++}`);
            values.push(parseInt(req.body.sort_order, 10) || 0);
        }

        const images = await uploadImages(req);
        if (images.length) { parts.push(`image_url = $${i++}`); values.push(images[0]); }

        if (!parts.length) return res.status(400).json({ error: 'لا تغيير' });

        values.push(id);
        const result = await pool.query(
            `UPDATE nexus_categories SET ${parts.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );

        if (!result.rows.length) return res.status(404).json({ error: 'التصنيف غير موجود' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Nexus update category error:', error);
        res.status(500).json({ error: 'تعذّر التعديل' });
    }
};

/**
 * حذف تصنيف لا يحذف منتجاته.
 *
 * ‎ON DELETE SET NULL‎ يُبقيها بلا تصنيف فتظهر في «غير مصنّف»
 * ويعاد توزيعها. وحذف عشرين منتجاً لأن أحدهم أراد تسمية أفضل
 * للتصنيف خسارة لا تُسترجع.
 */
const deleteCategory = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'معرّف غير صالح' });

        const result = await pool.query('DELETE FROM nexus_categories WHERE id = $1 RETURNING id', [id]);
        if (!result.rows.length) return res.status(404).json({ error: 'التصنيف غير موجود' });

        res.json({ success: true, id });
    } catch (error) {
        console.error('Nexus delete category error:', error);
        res.status(500).json({ error: 'تعذّر الحذف' });
    }
};

/* ============================================================
   المنتجات — للأدمن
   ============================================================ */

const addProduct = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'اسم المنتج مطلوب' });

        const images = await uploadImages(req);

        const result = await pool.query(`
            INSERT INTO nexus_products
                (category_id, name, price, description, image_url, images, sort_order, is_active)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, TRUE)
            RETURNING *
        `, [
            parseId(req.body.category_id),
            name.slice(0, 160),
            parsePrice(req.body.price),
            req.body.description ? String(req.body.description).slice(0, 1000) : null,
            images[0] || null,
            JSON.stringify(images),
            parseInt(req.body.sort_order, 10) || 0
        ]);

        res.json(normalizeProduct(result.rows[0]));
    } catch (error) {
        console.error('Nexus add product error:', error);
        res.status(500).json({ error: 'تعذّرت إضافة المنتج' });
    }
};

const updateProduct = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'معرّف غير صالح' });

        const parts = [];
        const values = [];
        let i = 1;

        if (req.body.name !== undefined) {
            const name = String(req.body.name).trim();
            if (!name) return res.status(400).json({ error: 'اسم المنتج مطلوب' });
            parts.push(`name = $${i++}`);
            values.push(name.slice(0, 160));
        }

        // السعر اختياري: نصّ فارغ يعني «بلا سعر» لا «لا تغيّره»
        if (req.body.price !== undefined) {
            parts.push(`price = $${i++}`);
            values.push(parsePrice(req.body.price));
        }
        if (req.body.description !== undefined) {
            parts.push(`description = $${i++}`);
            values.push(req.body.description ? String(req.body.description).slice(0, 1000) : null);
        }
        if (req.body.category_id !== undefined) {
            parts.push(`category_id = $${i++}`);
            values.push(parseId(req.body.category_id));
        }
        if (req.body.sort_order !== undefined) {
            parts.push(`sort_order = $${i++}`);
            values.push(parseInt(req.body.sort_order, 10) || 0);
        }
        if (req.body.is_active !== undefined) {
            parts.push(`is_active = $${i++}`);
            values.push(String(req.body.is_active) !== 'false');
        }

        const images = await uploadImages(req);
        if (images.length) {
            parts.push(`image_url = $${i++}`, `images = $${i++}::jsonb`);
            values.push(images[0], JSON.stringify(images));
        }

        if (!parts.length) return res.status(400).json({ error: 'لا تغيير' });

        values.push(id);
        const result = await pool.query(
            `UPDATE nexus_products SET ${parts.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );

        if (!result.rows.length) return res.status(404).json({ error: 'المنتج غير موجود' });
        res.json(normalizeProduct(result.rows[0]));
    } catch (error) {
        console.error('Nexus update product error:', error);
        res.status(500).json({ error: 'تعذّر التعديل' });
    }
};

/**
 * حذف منتج من الكتالوج لا يسحبه من المحلّات.
 *
 * ما نُسخ صار ملك صاحب المحلّ. وسحبه من تحته لأن الأدمن رتّب
 * كتالوجه يُفرغ رفوفه بلا أن يعلم.
 */
const deleteProduct = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'معرّف غير صالح' });

        const result = await pool.query('DELETE FROM nexus_products WHERE id = $1 RETURNING id', [id]);
        if (!result.rows.length) return res.status(404).json({ error: 'المنتج غير موجود' });

        res.json({ success: true, id });
    } catch (error) {
        console.error('Nexus delete product error:', error);
        res.status(500).json({ error: 'تعذّر الحذف' });
    }
};

/* ============================================================
   النسخ إلى المحلّ — لكل صاحب محلّ
   ============================================================ */

/**
 * يُنشئ تصنيفاً في المحلّ أو يجد الموجود.
 *
 * نفس منطق ‎shopController‎: معرّف إن أُرسل، وإلّا اسمٌ يُنشأ إن لم
 * يكن. فيستطيع صاحب المحلّ أن يختار «مشروبات» الموجود أو يكتب
 * تصنيفاً جديداً في نفس اللحظة بلا أن يخرج من الكتالوج.
 */
const resolveShopCategory = async (shopId, body) => {
    const given = body.category_id;
    if (given !== undefined && given !== '' && given !== null && given !== 'null') {
        return parseId(given);
    }

    const name = String(body.category || '').trim().slice(0, 120);
    if (!name) return null;

    const existing = await pool.query(
        'SELECT id FROM shop_product_categories WHERE shop_id = $1 AND name = $2',
        [shopId, name]
    );
    if (existing.rows.length) return existing.rows[0].id;

    const created = await pool.query(
        'INSERT INTO shop_product_categories (shop_id, name) VALUES ($1, $2) RETURNING id',
        [shopId, name]
    );
    return created.rows[0].id;
};

const adoptProduct = async (req, res) => {
    try {
        const productId = parseId(req.params.id);
        const shopId = parseId(req.body.shop_id);

        if (!productId || !shopId) {
            return res.status(400).json({ error: 'المنتج والمحلّ مطلوبان' });
        }

        // ١) المحلّ لهذا المستخدم؟ الأدمن يُضيف لأي محلّ
        const shop = await pool.query('SELECT id, name, owner_id FROM shops WHERE id = $1', [shopId]);
        if (!shop.rows.length) return res.status(404).json({ error: 'المحلّ غير موجود' });

        if (!isAdmin(req) && shop.rows[0].owner_id !== req.user.userId) {
            return res.status(403).json({ error: 'هذا المحلّ ليس لك' });
        }

        // ٢) المنتج موجود ومعروض؟
        const product = await pool.query(
            'SELECT * FROM nexus_products WHERE id = $1 AND is_active',
            [productId]
        );
        if (!product.rows.length) return res.status(404).json({ error: 'المنتج غير متاح' });

        const item = normalizeProduct(product.rows[0]);

        // ٣) مُضاف سلفاً؟ نعيده بلا تكرار — الضغطة المزدوجة شائعة
        const already = await pool.query(
            'SELECT id FROM shop_products WHERE shop_id = $1 AND nexus_product_id = $2 LIMIT 1',
            [shopId, productId]
        );
        if (already.rows.length) {
            return res.json({
                success: true,
                duplicate: true,
                shop_id: shopId,
                product_id: already.rows[0].id,
                message: `«${item.name}» موجود عندك سلفاً في ${shop.rows[0].name}`
            });
        }

        const categoryId = await resolveShopCategory(shopId, req.body);

        /*
         * السعر: ما يكتبه صاحب المحلّ يسبق سعر الكتالوج.
         *
         * سعر الأدمن اقتراح لا إلزام — والمحلّات تختلف. ونصّ فارغ
         * يعني «بلا سعر» وهو مقبول، فالسعر اختياري أصلاً.
         */
        const price = req.body.price !== undefined ? parsePrice(req.body.price) : item.price;

        const inserted = await pool.query(`
            INSERT INTO shop_products
                (shop_id, name, price, description, image_url, images,
                 category_id, sort_order, is_available, nexus_product_id)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 0, TRUE, $8)
            RETURNING id
        `, [
            shopId,
            item.name,
            price,
            item.description,
            item.image_url,
            JSON.stringify(item.images),
            categoryId,
            productId
        ]);

        res.json({
            success: true,
            shop_id: shopId,
            product_id: inserted.rows[0].id,
            category_id: categoryId,
            message: `أُضيف «${item.name}» إلى ${shop.rows[0].name}`
        });
    } catch (error) {
        console.error('Nexus adopt error:', error);
        res.status(500).json({ error: 'تعذّرت الإضافة إلى المحلّ' });
    }
};

/** تصنيفات محلّ بعينه — تُقرأ قبل أن يختار صاحبه أين يضع المنتج */
const getShopCategories = async (req, res) => {
    try {
        const shopId = parseId(req.params.shopId);
        if (!shopId) return res.status(400).json({ error: 'معرّف غير صالح' });

        const shop = await pool.query('SELECT owner_id FROM shops WHERE id = $1', [shopId]);
        if (!shop.rows.length) return res.status(404).json({ error: 'المحلّ غير موجود' });

        if (!isAdmin(req) && shop.rows[0].owner_id !== req.user.userId) {
            return res.status(403).json({ error: 'هذا المحلّ ليس لك' });
        }

        const result = await pool.query(`
            SELECT id, name, sort_order
            FROM shop_product_categories
            WHERE shop_id = $1
            ORDER BY sort_order ASC, id ASC
        `, [shopId]);

        res.json({ categories: result.rows });
    } catch (error) {
        console.error('Nexus shop categories error:', error);
        res.status(500).json({ error: 'تعذّر تحميل التصنيفات' });
    }
};

module.exports = {
    getCatalog,
    addCategory,
    updateCategory,
    deleteCategory,
    addProduct,
    updateProduct,
    deleteProduct,
    adoptProduct,
    getShopCategories
};
