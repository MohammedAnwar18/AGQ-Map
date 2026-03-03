const pool = require('../config/database');

async function addShopLocationColumn() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting shop location migration...');

        // 1. Add location column if not exists
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'location') THEN 
                    ALTER TABLE shops ADD COLUMN location GEOGRAPHY(POINT, 4326);
                    RAISE NOTICE 'Added location column to shops';
                END IF; 
            END $$;
        `);
        console.log('✅ Added location column');

        // 2. Update existing records
        await client.query(`
            UPDATE shops 
            SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography 
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL;
        `);
        console.log('✅ Updated existing shops with location');

        // 3. Add Index
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_shops_location 
            ON shops USING GIST(location);
        `);
        console.log('✅ Created spatial index on shops(location)');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

if (require.main === module) {
    addShopLocationColumn();
}
