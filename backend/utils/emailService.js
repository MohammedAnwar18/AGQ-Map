const nodemailer = require('nodemailer');

let transporter;

const createTransporter = async () => {
    if (transporter) return transporter;

    // 1. إذا توفرت إعدادات حقيقية في .env استخدمها
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else {
        // 2. إذا لم تتوفر، استخدم حساب اختياري (Ethereal)
        console.log('⚠️ No real email config found. Creating test account...');
        try {
            const testAccount = await nodemailer.createTestAccount();

            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            console.log('✅ Test email account created:', testAccount.user);
        } catch (err) {
            console.error('Failed to create test account:', err);
        }
    }
    return transporter;
};

const sendOtpEmail = async (to, otpCode) => {
    try {
        const mailTransporter = await createTransporter();
        if (!mailTransporter) return false;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"PalNova Security" <noreply@palnova.com>',
            to: to,
            subject: 'PalNova - رمز التحقق الخاص بك',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; direction: rtl; text-align: right;">
                    <h2 style="color: #4A90E2;">PalNova Verification</h2>
                    <p>مرحباً،</p>
                    <p>رمز الدخول الخاص بك هو:</p>
                    <h1 style="background-color: #f4f4f4; padding: 10px; text-align: center; letter-spacing: 5px; border-radius: 5px; font-family: monospace;">${otpCode}</h1>
                    <p>هذا الرمز صالح لمدة 5 دقائق.</p>
                </div>
            `
        };

        const info = await mailTransporter.sendMail(mailOptions);
        console.log('📨 Message sent: %s', info.messageId);

        // رابط معاينة الإيميل (مهم جداً للتطوير)
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log('🔗 Preview URL (Click to see email): %s', previewUrl);
            console.log('🔑 OTP Code (Backup):', otpCode);
        } else if (!process.env.EMAIL_USER) {
            console.log('🔑 OTP Code (Test Mode):', otpCode);
        }

        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        // Fallback for dev
        console.log('🔑 OTP Code (Fallback):', otpCode);
        return true; // نرجع true حتى يكمل النظام العملية في وضع التطوير
    }
};

module.exports = { sendOtpEmail };
