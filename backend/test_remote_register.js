const axios = require('axios');

async function testRegister() {
    try {
        console.log('Testing Remote Register...');
        const res = await axios.post('https://agq-backend.onrender.com/api/auth/register', {
            username: 'test_remote_ai_' + Date.now(),
            email: 'test' + Date.now() + '@remote.com',
            password: 'password123',
            full_name: 'Test Remote',
            gender: 'male'
        });
        console.log('Success:', res.data);
    } catch (error) {
        console.log('Failed:', error.response ? error.response.data : error.message);
    }
}

testRegister();
