require('dotenv').config();
const { sendOtpEmail } = require('./utils/emailService');

(async () => {
    console.log('Testing email sender...');
    console.log('User:', process.env.EMAIL_USER);
    // Don't log password
    console.log('Pass length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);

    try {
        const result = await sendOtpEmail('modeegamer2@gmail.com', '123456');
        console.log('Result:', result);
    } catch (err) {
        console.error('Error:', err);
    }
})();
