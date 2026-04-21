const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { addReelsTable } = require('./migrations/add_reels_table');

addReelsTable()
    .then(() => { console.log('🎉 Reels tables created!'); process.exit(0); })
    .catch(e => { console.error('❌', e.message); process.exit(1); });
