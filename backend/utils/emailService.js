const nodemailer = require('nodemailer');

let transporter;

const createTransporter = async () => {
    if (transporter) return transporter;

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
        return transporter;
    } else {
        console.log('⚠️ No real email config found. Skipping Ethereal (prevent timeout on Render).');
        // Return a dummy transporter that just resolves
        return {
            sendMail: async (mailOptions) => {
                console.log('Mock email sent to:', mailOptions.to);
                return { messageId: 'mock-id-123' };
            }
        };
    }
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

        // Always log OTP for safety when we know it's not a real production email sent successfully
        // Because if EMAIL_PASS is missing, it's a mock!
        if (!process.env.EMAIL_PASS) {
            console.log('🔑 ⚠️ (TEST MODE) OTP Code is:', otpCode);
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
