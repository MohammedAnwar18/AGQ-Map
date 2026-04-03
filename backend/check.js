const pool = require('./config/database');

pool.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'push_subscriptions';", (err, res) => { 
    console.log(err || res.rows); 
    if (!err && res.rows.length > 0) {
        pool.query("INSERT INTO push_subscriptions (user_id, subscription) VALUES (1, '{\"test\":1}') ON CONFLICT DO NOTHING;", (err2, res2) => {
            console.log("INSERT test:", err2 || "SUCCESS");
            process.exit();
        });
    } else {
        process.exit();
    }
});
