require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log("Checking database...");
        
        // 1. Check if ar_contents table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'ar_contents'
            );
        `);
        const tableExists = tableCheck.rows[0].exists;
        console.log("Table 'ar_contents' exists:", tableExists);
        
        if (tableExists) {
            // Check columns
            const columns = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'ar_contents'
            `);
            console.log("Table columns:");
            console.table(columns.rows);
        } else {
            console.log("Table does not exist. Let's create it!");
            // Run the migration commands here
            await pool.query(`
                CREATE TABLE IF NOT EXISTS ar_contents (
                    id SERIAL PRIMARY KEY,
                    latitude NUMERIC NOT NULL,
                    longitude NUMERIC NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    content TEXT,
                    shape VARCHAR(50) DEFAULT 'crystal',
                    bearing NUMERIC DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    location GEOGRAPHY(Point, 4326)
                )
            `);
            
            await pool.query(`
                CREATE INDEX IF NOT EXISTS ar_contents_location_idx ON ar_contents USING GIST (location)
            `);
            console.log("✅ Created 'ar_contents' table and index successfully!");
        }

        // 2. Check users role to see who is admin
        const admins = await pool.query(`
            SELECT id, username, email, role FROM users WHERE role = 'admin' LIMIT 5
        `);
        console.log("Admin accounts in DB:");
        console.table(admins.rows);

        process.exit(0);
    } catch (e) {
        console.error("Database connection/query error:", e);
        process.exit(1);
    }
}
check();
