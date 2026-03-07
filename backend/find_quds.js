const pool = require('./config/database');
async function run() {
    try {
        const res = await pool.query("SELECT * FROM shops WHERE name LIKE '%القدس%' OR category LIKE '%القدس%'");
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
