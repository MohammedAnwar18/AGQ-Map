const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const envPath = path.join(__dirname, '..', '.env');

console.log('\n📧 إعداد البريد الإلكتروني للمشروع (Gmail/Outlook) 📧');
console.log('====================================================\n');
console.log('لتشغيل الإرسال الفعلي، نحتاج لبيانات حسابك.\n');
console.log('ملاحظة لمستخدمي Gmail:');
console.log('1. يجب تفعيل "التحقق بخطوتين" (2-Step Verification).');
console.log('2. يجب إنشاء "كلمة مرور للتطبيقات" (App Password) واستخدامها ككلمة مرور هنا.');
console.log('   (لا تستخدم كلمة مرور حسابك العادية!)\n');

rl.question('1️⃣  ما هو مزود البريد؟ (كتب 1 لـ Gmail، أو 2 لـ Outlook): ', (providerChoice) => {
    let service = 'gmail';
    let host = 'smtp.gmail.com';

    if (providerChoice.trim() === '2') {
        service = 'hotmail';
        host = 'smtp.office365.com';
    }

    rl.question('2️⃣  أدخل عنوان بريدك الإلكتروني: ', (email) => {
        rl.question('3️⃣  أدخل "كلمة مرور التطبيقات" (App Password): ', (password) => {

            // قراءة محتوى .env الحالي
            let envContent = '';
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }

            // إزالة الإعدادات القديمة إن وجدت
            envContent = envContent.replace(/EMAIL_.*\n/g, ''); // Basic clean up of lines starting with EMAIL_
            // قد يكون الريجيكس بسيطاً، لذا سنضيف البيانات في النهاية للتأكد من أنها تطغى على القديم

            const emailConfig = `
# Email Configuration (Added by script)
EMAIL_SERVICE=${service}
EMAIL_HOST=${host}
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=${email.trim()}
EMAIL_PASS=${password.trim()}
EMAIL_FROM="PalNovaa Security" <${email.trim()}>
`;

            fs.appendFileSync(envPath, emailConfig);

            console.log('\n✅ تم حفظ إعدادات البريد بنجاح!');
            console.log('🔄 يرجى إعادة تشغيل السيرفر لتفعيل التغييرات.');

            rl.close();
        });
    });
});
