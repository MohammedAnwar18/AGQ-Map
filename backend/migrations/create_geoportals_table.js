const pool = require('../config/database');

async function migrateGeoportals() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Geoportal tables migration...');
        await client.query('BEGIN');

        // 1. Enable PostGIS & pgcrypto
        await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
        await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

        // 2. Create geoportals table
        await client.query(`
            CREATE TABLE IF NOT EXISTS geoportals (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                slug VARCHAR(255) UNIQUE NOT NULL,
                title_ar VARCHAR(255) NOT NULL,
                title_en VARCHAR(255),
                description TEXT,
                logo_url TEXT,
                favicon_url TEXT,
                header_banner_url TEXT,
                primary_color VARCHAR(50) DEFAULT '#0F1E33',
                secondary_color VARCHAR(50) DEFAULT '#F5A623',
                accent_color VARCHAR(50) DEFAULT '#06D6F2',
                custom_domain VARCHAR(255) UNIQUE,
                is_domain_verified BOOLEAN DEFAULT false,
                is_public BOOLEAN DEFAULT true,
                auth_config JSONB DEFAULT '{"require_login": false, "allowed_roles": ["user", "staff", "admin"], "welcome_msg": "مرحباً بكم في البوابة المكانية الرسمية"}'::jsonb,
                map_config JSONB DEFAULT '{"center": [31.9038, 35.2034], "zoom": 13, "basemap": "satellite"}'::jsonb,
                header_links JSONB DEFAULT '[{"title": "الخدمات الإلكترونية", "url": "#"}, {"title": "تواصل معنا", "url": "#"}]'::jsonb,
                tools_config JSONB DEFAULT '{"measurement": true, "identify": true, "legend": true, "export": true, "search": true}'::jsonb,
                created_by INT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Create geoportal_layers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS geoportal_layers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                geoportal_id UUID NOT NULL REFERENCES geoportals(id) ON DELETE CASCADE,
                layer_name VARCHAR(255) NOT NULL,
                geometry_type VARCHAR(50) DEFAULT 'Polygon',
                r2_file_key TEXT,
                r2_file_url TEXT,
                z_index INT DEFAULT 1,
                is_visible_by_default BOOLEAN DEFAULT true,
                is_private BOOLEAN DEFAULT false,
                style_config JSONB DEFAULT '{"fill_color": "#3B82F6", "fill_opacity": 0.4, "stroke_color": "#1D4ED8", "stroke_width": 2, "point_radius": 6, "point_icon": "circle"}'::jsonb,
                popup_config JSONB DEFAULT '{"title_field": "name", "show_all_attributes": true, "visible_fields": []}'::jsonb,
                feature_count INT DEFAULT 0,
                bbox JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Create geoportal_features table
        await client.query(`
            CREATE TABLE IF NOT EXISTS geoportal_features (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                layer_id UUID NOT NULL REFERENCES geoportal_layers(id) ON DELETE CASCADE,
                geom GEOMETRY(Geometry, 4326),
                properties JSONB DEFAULT '{}'::jsonb
            );
        `);

        // Indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_geoportals_slug ON geoportals(slug);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_geoportals_custom_domain ON geoportals(custom_domain);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_geoportal_layers_portal_id ON geoportal_layers(geoportal_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_geoportal_features_layer_id ON geoportal_features(layer_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_geoportal_features_geom ON geoportal_features USING GIST(geom);`);

        await client.query('COMMIT');
        console.log('✅ Geoportal tables migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration error:', error);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    migrateGeoportals().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrateGeoportals;
