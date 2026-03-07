const pool = require('./config/database');
const shopController = require('./controllers/shopController');

// Mock req/res
const req = {
    user: { userId: 1 }, // Try user 1
    query: { query: 'القدس' }
};
const res = {
    json: (data) => console.log('JSON Output:', JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (data) => console.log('Status', code, 'JSON Output:', data) })
};

async function test() {
    console.log('Testing searchShops for user 1...');
    await shopController.searchShops(req, res);

    console.log('\nTesting getFollowedShops for user 1...');
    await shopController.getFollowedShops(req, res);

    process.exit(0);
}
test();
