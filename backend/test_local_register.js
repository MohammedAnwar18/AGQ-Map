const axios = require('axios');

async function testLocalRegister() {
    try {
        console.log('Testing Local Register with Remote DB...');
        const res = await axios.post('http://localhost:5001/api/auth/register', {
            username: 'test_local_to_remote_' + Date.now(),
            email: 'test' + Date.now() + '@local.com',
            password: 'password123',
            full_name: 'Test Local-to-Remote',
            gender: 'male'
        });
        console.log('Success:', res.data);
    } catch (error) {
        console.log('Failed:', error.response ? error.response.data : error.message);
    }
}

testLocalRegister();
