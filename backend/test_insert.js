const pool = require('./config/database');
async function testInsert() {
    try {
        const name = 'Test Shop ' + Date.now();
        const latitude = 31.9;
        const longitude = 35.2;
        const category = 'General';
        const ownerId = 1; // Assuming user 1 exists

        console.log('Testing INSERT with attributes:', { name, latitude, longitude, category, ownerId });

        const result = await pool.query(`
      INSERT INTO shops (name, latitude, longitude, category, owner_id, location)
      VALUES ($1, $2::numeric, $3::numeric, $4, $5, ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography)
      RETURNING *
    `, [name, latitude, longitude, category, ownerId]);

        console.log('Insert Success:', result.rows[0]);
        process.exit(0);
    } catch (e) {
        console.error('Insert Error details:', e);
        process.exit(1);
    }
}
testInsert();
