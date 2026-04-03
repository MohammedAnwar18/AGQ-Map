const pool = require('./config/database');
pool.query("INSERT INTO push_subscriptions (user_id, subscription) VALUES (2, '{\"endpoint\": \"test\"}'::jsonb) ON CONFLICT (user_id, subscription) DO NOTHING", (err) => { console.log('ERROR:', err); process.exit(); });
