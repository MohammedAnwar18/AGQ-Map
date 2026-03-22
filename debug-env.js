const path = require('path');
require('dotenv').config({ path: path.join(__dirname, './backend/.env') });

console.log('--- ENV DEBUG ---');
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 10));
console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT);
console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('-----------------');

const pool = require('./backend/config/database');
pool.query('SELECT NOW()').then(res => {
    console.log('✅ DB Connected at:', res.rows[0].now);
    process.exit(0);
}).catch(err => {
    console.error('❌ DB Connection Failed:', err.message);
    process.exit(1);
});
