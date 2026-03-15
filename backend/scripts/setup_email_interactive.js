const fs = require('fs');
const path = require('path');
const readline = require('readline');
const nodemailer = require('nodemailer');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const envPath = path.join(__dirname, '..', '.env');

console.log('\n📧 إعداد واختبار البريد الإلكتروني (Gmail) 📧');
console.log('====================================================\n');

rl.question('1️⃣  أدخل عنوان بريدك الإلكتروني (Gmail): ', (email) => {
    rl.question('2️⃣  أدخل "كلمة مرور التطبيقات" (App Password) المكونة من 16 حرف: ', async (password) => {

        email = email.trim();
        password = password.trim();

        console.log('\n🔄 جاري تحديث ملف .env...');

        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Remove old EMAIL_ lines
        envContent = envContent.split('\n').filter(line => !line.startsWith('EMAIL_') && line.trim() !== '').join('\n');

        const newConfig = `
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=${email}
EMAIL_PASS=${password}
EMAIL_FROM="PalNovaa Security" <${email}>`;

        fs.writeFileSync(envPath, envContent + '\n' + newConfig);
        console.log('✅ تم تحديث الإعدادات.');

        console.log('\n🔄 جاري تجربة إرسال بريد إلكتروني...');

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: email,
                pass: password
            }
        });

        try {
            const info = await transporter.sendMail({
                from: `"PalNovaa Test" <${email}>`,
                to: email, // Send to self
                subject: "PalNovaa Email Test",
                text: "إذا وصلت هذه الرسالة، فهذا يعني أن إعدادات البريد تعمل بنجاح! 🎉",
                html: "<b>إذا وصلت هذه الرسالة، فهذا يعني أن إعدادات البريد تعمل بنجاح! 🎉</b>"
            });

            console.log('\n🎉 نجاح! تم إرسال رسالة تجريبية إلى بريدك.');
            console.log('معرف الرسالة: %s', info.messageId);
            console.log('\nيمكنك الآن استخدام استعادة كلمة المرور والتحقق من الحساب.');

        } catch (error) {
            console.error('\n❌ فشل الإرسال. يرجى التأكد من صحة كلمة مرور التطبيقات.');
            console.error('تفاصيل الخطأ:', error.message);
            if (error.code === 'EAUTH') {
                console.log('\nتلميح: تأكد من تفعيل "التحقق بخطوتين" وإنشاء "كلمة مرور تطبيقات" جديدة.');
            }
        }

        rl.close();
    });
});
