const pool = require('../config/database');
const { uploadToCloud } = require('../utils/storage');
const sharp = require('sharp');

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
    let thumb = null;

    for (const file of files) {
        const url = file.buffer
            ? await uploadToCloud(file.buffer, file.originalname, file.mimetype)
            : `/uploads/${file.filename}`;
        if (url) urls.push(url);

        // المصغّرة من الصورة الأولى وحدها — هي ما تُعرض في الشبكة
        if (!thumb && file.buffer) thumb = await makeThumb(file.buffer);
    }

    urls.thumb = thumb;
    return urls;
};

/* عرض المصغّرة — يكفي بطاقةً في شبكة من عمودين أو ثلاثة على هاتف
   بكثافة بكسل مضاعفة، ولا يزيد عن ذلك فيُهدَر */
const THUMB_WIDTH = 320;

/**
 * يبني مصغّرة من بايتات صورة.
 *
 * ‎WebP‎ لأنّه ثلث حجم ‎JPEG‎ عند نفس الجودة، ومدعوم في كل متصفّح
 * يعمل عليه هذا الموقع أصلاً. ولا تُكبَّر صورة أصغر من الحدّ:
 * التكبير يزيد البايتات ولا يزيد التفصيل.
 */
const makeThumb = async (buffer) => {
    try {
        const data = await sharp(buffer)
            .rotate()                       // يحترم وسم الاتّجاه في صور الهواتف
            .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
            .webp({ quality: 70 })
            .toBuffer();

        return { data, mime: 'image/webp' };
    } catch (error) {
        console.error('Nexus thumb error:', error.message);
        return null;
    }
};

/** بايتات صورة من رابط ‎data:‎ أو من الشبكة */
const bytesOf = async (url) => {
    if (!url) return null;

    if (url.startsWith('data:')) {
        const comma = url.indexOf(',');
        if (comma < 0) return null;
        return Buffer.from(url.slice(comma + 1), 'base64');
    }

    if (/^https?:\/\//.test(url)) {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            return Buffer.from(await response.arrayBuffer());
        } catch {
            return null;
        }
    }

    return null;
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
                SELECT c.id, c.name, c.sort_order,
                       CASE WHEN c.image_url LIKE 'data:%' THEN NULL ELSE c.image_url END AS image_url,
                       (SELECT COUNT(*)::int FROM nexus_products p
                         WHERE p.category_id = c.id AND p.is_active) AS products_count
                FROM nexus_categories c
                ORDER BY c.sort_order ASC, c.id ASC
            `),
            /*
             * أعمدة مُسمّاة لا ‎p.*‎.
             *
             * ‎p.*‎ كان يحمل ‎image_url‎ و‎images‎ معاً — ونفس الصورة في
             * الاثنين. وحين تكون ‎Base64‎ صار الصفُّ الواحد ثلاثة
             * ميجابايت، والطلبُ عشرات. فلا بايتَ صورةٍ في هذا الجسم:
             * الشبكة تطلب ‎thumb‎ من مساره، والمتصفّح يُخزّنه فلا
             * يُطلب ثانيةً.
             *
             * و‎has_image‎ يُحسب بـ‎<> ''‎ لا بـ‎IS NOT NULL‎ وحده:
             * صفوف قديمة قد تحمل نصّاً فارغاً لا ‎NULL‎.
             */
            pool.query(`
                SELECT p.id, p.category_id, p.name, p.price, p.description,
                       p.sort_order, p.is_active, p.created_at,
                       (p.image_url IS NOT NULL AND p.image_url <> '') AS has_image,
                       (p.thumb IS NOT NULL) AS has_thumb,
                       c.name AS category_name
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
            /* ‎normalizeProduct‎ لا يُستعمل هنا: لا صور في الصفوف لتُطبَّع،
               وما يحتاجه العميل هو مسار المصغّرة */
            products: products.rows.map(row => ({
                ...row,
                price: row.price === null || row.price === undefined || row.price === '' ? null : row.price,
                thumb: row.has_image ? `/api/nexus/products/${row.id}/thumb` : null
            })),
            shops: shops.rows,
            adopted,
            is_admin: admin
        });
    } catch (error) {
        console.error('Nexus catalog error:', error);
        res.status(500).json({ error: 'تعذّر تحميل الكتالوج' });
    }
};

/**
 * مصغّرة منتج — المسار الذي تطلبه الشبكة لكل بطاقة.
 *
 * بلا حساب، لأنّ وسم ‎<img>‎ لا يحمل ترويسة تخويل. وهي صور منتجات
 * في كتالوج، لا شيء خاصّ فيها — ومن يملك الرابط يرى الصورة، وهذا
 * ما يجب أن يُعرف قبل أن يُرفع ما لا يُراد أن يُرى.
 *
 * ومع تخزين طويل: المصغّرة لا تتغيّر إلّا بتغيير صورة المنتج،
 * وعندها تُمحى من القاعدة فيُعاد بناؤها. فيُحمَّل الكتالوج صوراً
 * مرّةً واحدة في عمر المتصفّح.
 *
 * والبناء المتأخّر: منتجٌ رُفع قبل هذا التعديل لا مصغّرة له، فتُبنى
 * عند أوّل طلب وتُحفظ. فلا هجرةَ تمرّ على كل الصفوف، ولا صورةَ
 * كاملةً تُرسل مرّتين.
 */
const getProductThumb = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).end();

        const found = await pool.query(
            'SELECT thumb, thumb_mime, image_url FROM nexus_products WHERE id = $1',
            [id]
        );
        if (!found.rows.length) return res.status(404).end();

        const row = found.rows[0];

        const serve = (data, mime) => {
            res.set('Content-Type', mime || 'image/webp');
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
            res.set('Access-Control-Allow-Origin', '*');
            return res.send(data);
        };

        if (row.thumb) return serve(row.thumb, row.thumb_mime);

        // لا مصغّرة بعد: نبنيها من الصورة الأصلية ونحفظها
        const bytes = await bytesOf(row.image_url);
        if (!bytes) return res.status(204).end();

        const built = await makeThumb(bytes);
        if (!built) return res.status(204).end();

        /* الحفظ لا يُؤخّر الرد: من ينتظر الصورة لا شأن له بالكتابة،
           وفشلُها لا يمنع العرض — تُعاد المحاولة في الطلب التالي */
        pool.query(
            'UPDATE nexus_products SET thumb = $1, thumb_mime = $2 WHERE id = $3',
            [built.data, built.mime, id]
        ).catch(err => console.error('Nexus thumb save error:', err.message));

        return serve(built.data, built.mime);
    } catch (error) {
        console.error('Nexus thumb error:', error);
        return res.status(500).end();
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
                (category_id, name, price, description, image_url, images, sort_order, is_active,
                 thumb, thumb_mime)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, TRUE, $8, $9)
            RETURNING id, category_id, name, price, description, sort_order, is_active, created_at,
                      (image_url IS NOT NULL AND image_url <> '') AS has_image
        `, [
            parseId(req.body.category_id),
            name.slice(0, 160),
            parsePrice(req.body.price),
            req.body.description ? String(req.body.description).slice(0, 1000) : null,
            images[0] || null,
            JSON.stringify(images),
            parseInt(req.body.sort_order, 10) || 0,
            images.thumb?.data || null,
            images.thumb?.mime || null
        ]);

        const saved = result.rows[0];
        res.json({
            ...saved,
            thumb: saved.has_image ? `/api/nexus/products/${saved.id}/thumb` : null
        });
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

            /* صورة جديدة تعني مصغّرة جديدة. ولو فشل بناؤها نُفرّغ
               العمود فيُبنى عند أوّل طلب — ولا تبقى مصغّرة الصورة
               القديمة فوق صورة جديدة */
            parts.push(`thumb = $${i++}`, `thumb_mime = $${i++}`);
            values.push(images.thumb?.data || null, images.thumb?.mime || null);
        }

        if (!parts.length) return res.status(400).json({ error: 'لا تغيير' });

        values.push(id);
        const result = await pool.query(
            `UPDATE nexus_products SET ${parts.join(', ')} WHERE id = $${i}
             RETURNING id, category_id, name, price, description, sort_order, is_active, created_at,
                       (image_url IS NOT NULL AND image_url <> '') AS has_image`,
            values
        );

        if (!result.rows.length) return res.status(404).json({ error: 'المنتج غير موجود' });

        const saved = result.rows[0];
        res.json({
            ...saved,
            price: saved.price === null || saved.price === '' ? null : saved.price,
            /* طابع زمني يكسر تخزين المتصفّح: الصورة تغيّرت والمسار واحد،
               فبلا الطابع يبقى القديم معروضاً إلى الأبد */
            thumb: saved.has_image ? `/api/nexus/products/${saved.id}/thumb?v=${Date.now()}` : null
        });
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
const resolveShopCategory = async (shopId, body, runner = pool) => {
    const given = body.category_id;
    if (given !== undefined && given !== '' && given !== null && given !== 'null') {
        return parseId(given);
    }

    const name = String(body.category || '').trim().slice(0, 120);
    if (!name) return null;

    const existing = await runner.query(
        'SELECT id FROM shop_product_categories WHERE shop_id = $1 AND name = $2',
        [shopId, name]
    );
    if (existing.rows.length) return existing.rows[0].id;

    const created = await runner.query(
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

/* سقف الدفعة الواحدة — من يحدّد مئة منتج بضغطة يستحقّ أن
   تمرّ دفعته، ومن يرسل ألفاً يرسل شيئاً أخر */
const MAX_ADOPT = 120;

/**
 * ينسخ عدّة منتجات إلى محلّ واحد بطلب واحد.
 *
 * واحداً واحداً يعني ثلاثين رحلة إلى الخادم لمن يرتّب قائمة
 * طعامه، وكل رحلة قد تنقطع فيبقى نصف المحدّد مضافاً ونصفه لا.
 *
 * والدفعة لا تسقط كلّها لأنّ منتجاً أُخفي أو حُذف بين فتح
 * الكتالوج والضغط: كل منتج له نتيجته، وما نجح يُحفظ. والمعاملة
 * تضمن ألّا يُنشأ تصنيف جديد ثمّ يبقى فارغاً لو انقطع شيء بعده.
 */
const adoptMany = async (req, res) => {
    const client = await pool.connect();

    try {
        const shopId = parseId(req.body.shop_id);
        const rawIds = Array.isArray(req.body.product_ids) ? req.body.product_ids : [];

        // المكرّر يُسقط هنا لا في الحلقة: واجهة مرتبكة قد ترسله
        const ids = [...new Set(rawIds.map(parseId).filter(Boolean))];

        if (!shopId) return res.status(400).json({ error: 'المحلّ مطلوب' });
        if (!ids.length) return res.status(400).json({ error: 'لم تحدّد أي منتج' });
        if (ids.length > MAX_ADOPT) {
            return res.status(400).json({ error: `الحدّ ${MAX_ADOPT} منتجاً في المرّة` });
        }

        // ١) المحلّ لهذا المستخدم؟
        const shop = await client.query('SELECT id, name, owner_id FROM shops WHERE id = $1', [shopId]);
        if (!shop.rows.length) return res.status(404).json({ error: 'المحلّ غير موجود' });

        if (!isAdmin(req) && shop.rows[0].owner_id !== req.user.userId) {
            return res.status(403).json({ error: 'هذا المحلّ ليس لك' });
        }

        await client.query('BEGIN');

        // ٢) التصنيف مرّة واحدة لا لكل منتج: وإلّا أُنشئ مرّات
        const categoryId = await resolveShopCategory(shopId, req.body, client);

        // ٣) المنتجات المتاحة منها، وما سبق أن أُضيف — استعلامان لا ‎2n‎
        const found = await client.query(
            'SELECT * FROM nexus_products WHERE id = ANY($1::int[]) AND is_active',
            [ids]
        );
        const byId = new Map(found.rows.map(row => [row.id, normalizeProduct(row)]));

        const existing = await client.query(
            `SELECT nexus_product_id FROM shop_products
             WHERE shop_id = $1 AND nexus_product_id = ANY($2::int[])`,
            [shopId, ids]
        );
        const already = new Set(existing.rows.map(row => row.nexus_product_id));

        const added = [];
        const skipped = [];

        for (const id of ids) {
            const item = byId.get(id);

            /* الرمز لا النصّ: الواجهة تفرّق بين «موجود عندك» فتضع علامة،
               و«غير متاح» فلا تضعها. ومقارنة النصّ العربي تنكسر بتعديل حرف */
            if (!item) { skipped.push({ id, code: 'missing', why: 'غير متاح' }); continue; }
            if (already.has(id)) { skipped.push({ id, code: 'duplicate', name: item.name, why: 'عندك سلفاً' }); continue; }

            /* السعر سعر الكتالوج كما هو: دفعة من عشرين منتجاً لا
               يمكن أن تحمل سعراً واحداً لكلّها، ولصاحب المحلّ أن يُعدّل
               أسعاره في محلّه بعدها */
            const inserted = await client.query(`
                INSERT INTO shop_products
                    (shop_id, name, price, description, image_url, images,
                     category_id, sort_order, is_available, nexus_product_id)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 0, TRUE, $8)
                RETURNING id
            `, [
                shopId,
                item.name,
                item.price,
                item.description,
                item.image_url,
                JSON.stringify(item.images),
                categoryId,
                id
            ]);

            added.push({ id, name: item.name, product_id: inserted.rows[0].id });
        }

        await client.query('COMMIT');

        const where = shop.rows[0].name;
        const message = added.length
            ? `أُضيف ${added.length} منتجاً إلى ${where}${skipped.length ? ` · ${skipped.length} تُجاوز` : ''}`
            : `لا جديد — كلّ ما حدّدتَه موجود عندك سلفاً`;

        res.json({
            success: true,
            shop_id: shopId,
            category_id: categoryId,
            added,
            skipped,
            message
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Nexus adopt many error:', error);
        res.status(500).json({ error: 'تعذّرت الإضافة إلى المحلّ' });
    } finally {
        client.release();
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
    getProductThumb,
    addCategory,
    updateCategory,
    deleteCategory,
    addProduct,
    updateProduct,
    deleteProduct,
    adoptProduct,
    adoptMany,
    getShopCategories
};
