const pool = require('../config/database');

/**
 * واجهة المحل الجديدة (Storefront):
 *  - أقسام للمنتجات لكل محل مع ترتيب قابل للتحكم
 *  - ربط المنتج بقسم + دعم أكثر من صورة
 *  - السعر يصبح اختيارياً (بعض المحلات لا تعرض الأسعار)
 */
async function addStorefrontProducts() {
    const client = await pool.connect();
    try {
        console.log('🚀 Storefront migration: starting...');

        // 1) جدول أقسام المنتجات
        await client.query(`
            CREATE TABLE IF NOT EXISTS shop_product_categories (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                name VARCHAR(120) NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (shop_id, name)
            );
        `);
        console.log('✅ shop_product_categories table ready');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_shop_product_categories_shop
            ON shop_product_categories (shop_id, sort_order);
        `);

        // 2) أعمدة المنتج الجديدة
        await client.query(`
            ALTER TABLE shop_products
            ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES shop_product_categories(id) ON DELETE SET NULL;
        `);
        await client.query(`
            ALTER TABLE shop_products
            ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
        `);
        await client.query(`
            ALTER TABLE shop_products
            ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
        `);
        await client.query(`
            ALTER TABLE shop_products
            ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
        `);
        console.log('✅ shop_products columns ready');

        // 3) السعر اختياري
        await client.query(`
            ALTER TABLE shop_products
            ALTER COLUMN price DROP NOT NULL;
        `).catch(() => console.log('ℹ️ price already nullable'));

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_shop_products_category
            ON shop_products (shop_id, category_id, sort_order);
        `);

        // 4) نقل الصورة المفردة القديمة إلى مصفوفة الصور
        await client.query(`
            UPDATE shop_products
            SET images = to_jsonb(ARRAY[image_url])
            WHERE image_url IS NOT NULL
              AND image_url <> ''
              AND (images IS NULL OR jsonb_array_length(images) = 0);
        `);
        console.log('✅ legacy image_url backfilled into images');

        console.log('✨ Storefront migration completed successfully');
    } catch (error) {
        console.error('❌ Storefront migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    addStorefrontProducts()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = addStorefrontProducts;
