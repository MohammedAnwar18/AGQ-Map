const pool = require('../config/database');

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('🌿 Adding Flora Palestina community...');

        const communityName = 'نباتات فلسطين |  Flora Palestina';
        const communityDesc = 'يضم هذا المجتمع المصورين الذين يسعون لتوثيق النباتات البرية والأصناف البلدية، مع التركيز على حماية الموروث الطبيعي من الاندثار. ومن خلال تبادل الصور والمعلومات العلمية والشعبية، يعمل المجتمع كأرشيف حي يُبرز جمال الزهور النادرة وعراقة الأشجار المعمرة، مكرساً الوعي البيئي كفعل صمود وانتماء للتراب الفلسطيني.';
        const communityIcon = '🌺';

        // Check if exists
        const res = await client.query('SELECT id FROM communities WHERE name = $1', [communityName]);

        if (res.rows.length === 0) {
            const insertRes = await client.query(
                'INSERT INTO communities (name, description, icon_url) VALUES ($1, $2, $3) RETURNING id',
                [communityName, communityDesc, communityIcon]
            );
            console.log(`✅ Community "${communityName}" created with ID: ${insertRes.rows[0].id}`);
        } else {
            // Update description if already exists
            await client.query(
                'UPDATE communities SET description = $1, icon_url = $3 WHERE name = $2',
                [communityDesc, communityName, communityIcon]
            );
            console.log(`ℹ️ Community "${communityName}" already exists — description updated.`);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
