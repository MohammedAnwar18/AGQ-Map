const pool = require('c:\\Users\\Moham\\Desktop\\APPAGQ\\backend\\config\\database');

(async () => {
    try {
        console.log('⏳ Connecting to Database and checking digital_letters table...');
        
        // Ensure table is created
        await pool.query(`
            CREATE TABLE IF NOT EXISTS digital_letters (
                id             SERIAL PRIMARY KEY,
                slug           VARCHAR(100) UNIQUE NOT NULL,
                title          VARCHAR(255) NOT NULL,
                sender_name    VARCHAR(255),
                recipient_name VARCHAR(255),
                content        TEXT,
                image_url      TEXT,
                music_url      TEXT,
                envelope_color VARCHAR(50) DEFAULT 'maroon',
                seal_design    VARCHAR(50) DEFAULT 'wax-classic',
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by     INTEGER
            )
        `);
        console.log('✅ Table verified!');

        // Get an admin user ID to associate
        const adminRes = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        const adminId = adminRes.rows[0]?.id || null;

        // Check if example letter already exists
        const checkRes = await pool.query("SELECT id FROM digital_letters WHERE slug = 'palestine-party'");
        if (checkRes.rows.length === 0) {
            await pool.query(`
                INSERT INTO digital_letters 
                    (slug, title, sender_name, recipient_name, content, envelope_color, seal_design, created_by)
                VALUES 
                    ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                'palestine-party',
                'حفل استقبال بالنوفا الخاص',
                'إدارة منصة بالنوفا',
                'الضيف الكريم المحترم',
                `يسرنا دعوتكم لحضور الإطلاق التجريبي للميزات ثلاثية الأبعاد والمواقع التفاعلية الجديدة على الخريطة المكانية.\n\nتاريخ الحفل: الجمعة القادمة\nالمكان: منصة بالنوفا الرقمية`,
                'royal-gold',
                'crown-wax',
                adminId
            ]);
            console.log('✅ Mock digital letter created successfully! Slug is: palestine-party');
        } else {
            console.log('ℹ️ Mock letter already exists.');
        }

    } catch (err) {
        console.error('❌ Error executing mock insert:', err);
    } finally {
        await pool.end();
    }
})();
