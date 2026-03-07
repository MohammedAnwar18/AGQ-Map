const pool = require('./config/database');
const shopController = require('./controllers/shopController');

const req = {
    user: { userId: 1 },
    params: { id: '7' },
    query: { query: 'القدس' }
};
const res = {
    json: (data) => console.log('JSON Output:', JSON.stringify(data)),
    status: (code) => ({ json: (data) => console.log('Status', code, 'Output:', data) })
};

async function test() {
    console.log('\\n--- Test Follow Shop ---');
    await shopController.followShop(req, res);

    console.log('\\n--- Test Get Followed Shops ---');
    await shopController.getFollowedShops(req, res);

    process.exit(0);
}
test();
