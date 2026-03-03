const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const email = 'modeegamer2@gmail.com';
const password = 'gjde gdsh sbea puob';

let envContent = '';
if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
}

// Remove old EMAIL_ lines if they exist
envContent = envContent.split('\n').filter(line => !line.startsWith('EMAIL_')).join('\n');

const newConfig = `
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=${email}
EMAIL_PASS=${password}
EMAIL_FROM="PalNova Security" <${email}>
`;

fs.writeFileSync(envPath, envContent.trim() + '\n' + newConfig);
console.log('✅ .env file updated with real email credentials!');
