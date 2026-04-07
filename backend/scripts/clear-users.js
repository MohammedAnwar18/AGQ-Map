const pool = require('../config/database');

async function clearUsers() {
    try {
        console.log('--- Database Cleanup Started ---');

        const tables = [
            'likes', 'comments', 'friendships', 'friend_requests',
            'notifications', 'messages', 'shop_products', 'shop_followers',
            'local_news', 'community_members', 'posts',
            'shops', 'communities', 'users'
        ];

        for (const table of tables) {
            try {
                console.log(`Cleaning table: ${table}...`);
                await pool.query(`DELETE FROM ${table}`);
            } catch (err) {
                console.log(`Table ${table} skipped or error: ${err.message}`);
            }
        }

        console.log('--- Cleanup Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Final Cleanup failed:', error);
        process.exit(1);
    }
}

clearUsers();
