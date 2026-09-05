const pool = require('../config/database');

/**
 * أعمدة الميزات الجديدة لصفحة المحل:
 *  - shops.social_links      روابط فيسبوك/إنستغرام/واتساب/تيك توك
 *  - shops.cover_video_url   غلاف فيديو يوتيوب يضبطه الأدمن العام
 *  - shop_product_categories.image_url   صورة اختيارية تمثّل القسم
 *  - shop_products.options   الأحجام والإضافات { sizes:[], extras:[] }
 *
 * الترحيل يعمل تلقائياً عند إقلاع الخادم، وهذا الملف لتشغيله يدوياً:
 *   node backend/migrations/add_shop_media_columns.js
 */
async function addShopMediaColumns() {
    const client = await pool.connect();
    try {
        console.log('🚀 Shop media migration: starting...');

        await client.query(`
            ALTER TABLE shops
                ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS cover_video_url TEXT;
        `);
        console.log('✅ shops.social_links + shops.cover_video_url');

        await client.query(`
            ALTER TABLE shop_product_categories
                ADD COLUMN IF NOT EXISTS image_url TEXT;
        `);
        console.log('✅ shop_product_categories.image_url');

        await client.query(`
            ALTER TABLE shop_products
                ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}'::jsonb;
        `);
        console.log('✅ shop_products.options');

        // تقرير مختصر بما صار موجوداً فعلاً
        const check = await client.query(`
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND (
                    (table_name = 'shops' AND column_name IN ('social_links', 'cover_video_url'))
                 OR (table_name = 'shop_product_categories' AND column_name = 'image_url')
                 OR (table_name = 'shop_products' AND column_name = 'options')
              )
            ORDER BY table_name, column_name;
        `);
        console.log(`📋 الأعمدة الموجودة (${check.rows.length}/4):`);
        check.rows.forEach(r => console.log(`   • ${r.table_name}.${r.column_name}`));

        console.log('✨ Shop media migration completed successfully');
    } catch (error) {
        console.error('❌ Shop media migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    addShopMediaColumns()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = addShopMediaColumns;
