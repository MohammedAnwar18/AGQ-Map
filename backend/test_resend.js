require('dotenv').config();
const { sendOtpEmail } = require('./utils/emailService');

async function test() {
    await sendOtpEmail('modeegamer2@gmail.com', '777777');
    console.log('Test complete');
}

test();
